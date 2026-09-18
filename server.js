import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import bodyParser from 'body-parser';
import morgan from 'morgan';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('combined'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/downloads', express.static(path.join(__dirname, 'builds')));

// Directories
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const BUILDS_DIR = path.join(__dirname, 'builds');
const PROJECTS_DIR = path.join(__dirname, 'projects');

// Create directories if they don't exist
[UPLOADS_DIR, BUILDS_DIR, PROJECTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectDir = path.join(UPLOADS_DIR, req.body.projectId || 'temp');
    if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
    cb(null, projectDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// In-memory project storage
let projects = {};

// ==================== ROUTES ====================

// 1. CREATE PROJECT
app.post('/api/create-project', (req, res) => {
  const { appName, packageName, minSdk, targetSdk, appIcon } = req.body;
  const projectId = uuidv4();
  
  const projectData = {
    projectId,
    appName,
    packageName,
    minSdk: minSdk || 21,
    targetSdk: targetSdk || 34,
    appIcon,
    createdAt: new Date(),
    files: {},
    buildHistory: []
  };

  projects[projectId] = projectData;

  // Create project directory
  const projectDir = path.join(PROJECTS_DIR, projectId);
  fs.mkdirSync(projectDir, { recursive: true });

  // Create gradle template structure
  createGradleTemplate(projectId, projectData);

  res.json({ success: true, projectId, message: 'Project created successfully' });
});

// 2. GET PROJECT DETAILS
app.get('/api/project/:projectId', (req, res) => {
  const { projectId } = req.params;
  const project = projects[projectId];

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json(project);
});

// 3. UPLOAD FILES
app.post('/api/upload/:projectId', upload.single('file'), (req, res) => {
  const { projectId } = req.params;
  const project = projects[projectId];

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Store file reference
  project.files[req.file.originalname] = {
    path: req.file.path,
    size: req.file.size,
    uploadedAt: new Date()
  };

  // Copy to project directory
  const projectDir = path.join(PROJECTS_DIR, projectId);
  const destPath = path.join(projectDir, req.file.originalname);
  
  try {
    fs.copyFileSync(req.file.path, destPath);
  } catch (err) {
    console.error('Copy error:', err);
  }

  res.json({ 
    success: true, 
    filename: req.file.originalname, 
    message: 'File uploaded successfully' 
  });
});

// 4. GET PROJECT FILES
app.get('/api/project/:projectId/files', (req, res) => {
  const { projectId } = req.params;
  const project = projects[projectId];

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json({ files: project.files });
});

// 5. DELETE FILE
app.delete('/api/project/:projectId/file/:filename', (req, res) => {
  const { projectId, filename } = req.params;
  const project = projects[projectId];

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  if (project.files[filename]) {
    try {
      fs.unlinkSync(project.files[filename].path);
      delete project.files[filename];
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  res.json({ success: true, message: 'File deleted' });
});

// 6. BUILD APK
app.post('/api/build/:projectId', (req, res) => {
  const { projectId } = req.params;
  const project = projects[projectId];

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const buildId = uuidv4();
  const projectDir = path.join(PROJECTS_DIR, projectId);
  const buildOutputDir = path.join(BUILDS_DIR, projectId);

  if (!fs.existsSync(buildOutputDir)) {
    fs.mkdirSync(buildOutputDir, { recursive: true });
  }

  res.json({ 
    success: true, 
    buildId, 
    message: 'Build started. This may take 5-15 minutes...' 
  });

  // Run build asynchronously
  setTimeout(() => {
    executeBuild(projectId, buildId, projectDir, buildOutputDir, project);
  }, 1000);
});

// 7. GET BUILD STATUS
app.get('/api/build/:projectId/:buildId', (req, res) => {
  const { projectId, buildId } = req.params;
  const project = projects[projectId];

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const buildLog = project.buildHistory.find(b => b.buildId === buildId);

  if (!buildLog) {
    return res.status(404).json({ error: 'Build not found' });
  }

  res.json(buildLog);
});

// 8. LIST PROJECTS
app.get('/api/projects', (req, res) => {
  const projectList = Object.values(projects).map(p => ({
    projectId: p.projectId,
    appName: p.appName,
    packageName: p.packageName,
    createdAt: p.createdAt,
    latestBuild: p.buildHistory[0] || null
  }));

  res.json({ projects: projectList });
});

// 9. DELETE PROJECT
app.delete('/api/project/:projectId', (req, res) => {
  const { projectId } = req.params;

  if (!projects[projectId]) {
    return res.status(404).json({ error: 'Project not found' });
  }

  delete projects[projectId];

  // Delete directories
  try {
    const projectDir = path.join(PROJECTS_DIR, projectId);
    const buildDir = path.join(BUILDS_DIR, projectId);
    const uploadDir = path.join(UPLOADS_DIR, projectId);

    if (fs.existsSync(projectDir)) fs.rmSync(projectDir, { recursive: true });
    if (fs.existsSync(buildDir)) fs.rmSync(buildDir, { recursive: true });
    if (fs.existsSync(uploadDir)) fs.rmSync(uploadDir, { recursive: true });
  } catch (err) {
    console.error('Delete error:', err);
  }

  res.json({ success: true, message: 'Project deleted' });
});

// 10. DOWNLOAD APK
app.get('/api/download/:projectId/:buildId', (req, res) => {
  const { projectId, buildId } = req.params;
  const apkPath = path.join(BUILDS_DIR, projectId, `${buildId}.apk`);

  if (!fs.existsSync(apkPath)) {
    return res.status(404).json({ error: 'APK not found' });
  }

  res.download(apkPath, `app-${buildId}.apk`);
});

// ==================== BUILD FUNCTION ====================

function executeBuild(projectId, buildId, projectDir, buildOutputDir, project) {
  const buildRecord = {
    buildId,
    startTime: new Date(),
    status: 'building',
    logs: [],
    apkPath: null
  };

  project.buildHistory.unshift(buildRecord);

  // Create Gradle project structure
  const gradleDir = path.join(projectDir, 'gradle-build');
  fs.mkdirSync(gradleDir, { recursive: true });

  // Copy Gradle wrapper
  copyGradleTemplate(gradleDir, project);

  // Build command
  const buildCommand = `cd ${gradleDir} && ./gradlew assembleRelease 2>&1`;

  exec(buildCommand, { timeout: 3600000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    buildRecord.logs.push(stdout || stderr);

    if (error) {
      buildRecord.status = 'failed';
      buildRecord.logs.push(`Error: ${error.message}`);
    } else {
      // Find APK
      const apkDir = path.join(gradleDir, 'app', 'build', 'outputs', 'apk', 'release');
      
      if (fs.existsSync(apkDir)) {
        const apkFile = fs.readdirSync(apkDir).find(f => f.endsWith('.apk'));
        
        if (apkFile) {
          const sourceApk = path.join(apkDir, apkFile);
          const destApk = path.join(buildOutputDir, `${buildId}.apk`);
          
          try {
            fs.copyFileSync(sourceApk, destApk);
            buildRecord.apkPath = `/downloads/${projectId}/${buildId}.apk`;
            buildRecord.status = 'success';
            buildRecord.logs.push(`✓ APK generated: ${apkFile}`);
          } catch (err) {
            buildRecord.status = 'failed';
            buildRecord.logs.push(`Copy error: ${err.message}`);
          }
        } else {
          buildRecord.status = 'failed';
          buildRecord.logs.push('APK file not found in build output');
        }
      } else {
        buildRecord.status = 'failed';
        buildRecord.logs.push(`Build output directory not found: ${apkDir}`);
      }
    }

    buildRecord.endTime = new Date();
    buildRecord.duration = buildRecord.endTime - buildRecord.startTime;
  });
}

// ==================== GRADLE TEMPLATE SETUP ====================

function createGradleTemplate(projectId, project) {
  // This is just initialization. Actual template copying happens during build.
  const projectDir = path.join(PROJECTS_DIR, projectId);
  fs.mkdirSync(projectDir, { recursive: true });
}

function copyGradleTemplate(targetDir, project) {
  // Create build.gradle
  const buildGradleContent = `plugins {
    id 'com.android.application'
}

android {
    namespace '${project.packageName}'
    compileSdk 34

    defaultConfig {
        applicationId '${project.packageName}'
        minSdk ${project.minSdk}
        targetSdk ${project.targetSdk}
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_11
        targetCompatibility JavaVersion.VERSION_11
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'com.google.android.material:material:1.10.0'
}`;

  fs.writeFileSync(path.join(targetDir, 'build.gradle'), buildGradleContent);

  // Create settings.gradle
  fs.writeFileSync(path.join(targetDir, 'settings.gradle'), `include ':app'`);

  // Create directory structure
  const appDir = path.join(targetDir, 'app');
  const srcDir = path.join(appDir, 'src', 'main');
  const javaDir = path.join(srcDir, 'java', project.packageName.replace(/\./g, '/'));
  const resDir = path.join(srcDir, 'res');

  [appDir, srcDir, javaDir, resDir].forEach(dir => {
    fs.mkdirSync(dir, { recursive: true });
  });

  // Create app/build.gradle
  const appBuildGradleContent = `plugins {
    id 'com.android.application'
}

android {
    namespace '${project.packageName}'
    compileSdk 34

    defaultConfig {
        applicationId '${project.packageName}'
        minSdk ${project.minSdk}
        targetSdk ${project.targetSdk}
        versionCode 1
        versionName "1.0"

        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.debug
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_11
        targetCompatibility JavaVersion.VERSION_11
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'com.google.android.material:material:1.10.0'
    testImplementation 'junit:junit:4.13.2'
    androidTestImplementation 'androidx.test.ext:junit:1.1.5'
    androidTestImplementation 'androidx.test.espresso:espresso-core:3.5.1'
}`;

  fs.writeFileSync(path.join(appDir, 'build.gradle'), appBuildGradleContent);

  // Create MainActivity.java
  const mainActivityContent = `package ${project.packageName};

import androidx.appcompat.app.AppCompatActivity;
import android.os.Bundle;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
    }
}`;

  fs.writeFileSync(path.join(javaDir, 'MainActivity.java'), mainActivityContent);

  // Create activity_main.xml
  const activityXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:gravity="center">

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Welcome to ${project.appName}"
        android:textSize="24sp"
        android:textStyle="bold" />

</LinearLayout>`;

  const layoutDir = path.join(resDir, 'layout');
  fs.mkdirSync(layoutDir, { recursive: true });
  fs.writeFileSync(path.join(layoutDir, 'activity_main.xml'), activityXmlContent);

  // Create AndroidManifest.xml
  const manifestContent = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.Light.DarkActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>

</manifest>`;

  fs.writeFileSync(path.join(srcDir, 'AndroidManifest.xml'), manifestContent);

  // Create strings.xml
  const stringsContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${project.appName}</string>
</resources>`;

  const valuesDir = path.join(resDir, 'values');
  fs.mkdirSync(valuesDir, { recursive: true });
  fs.writeFileSync(path.join(valuesDir, 'strings.xml'), stringsContent);

  // Create gradle wrapper files
  createGradleWrapper(targetDir);
}

function createGradleWrapper(targetDir) {
  const gradleDir = path.join(targetDir, 'gradle', 'wrapper');
  fs.mkdirSync(gradleDir, { recursive: true });

  // gradle-wrapper.properties
  const wrapperProps = `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.0-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists`;

  fs.writeFileSync(path.join(gradleDir, 'gradle-wrapper.properties'), wrapperProps);

  // Create gradlew script (simplified)
  const gradlewScript = `#!/bin/bash
cd "$(dirname "$0")"
exec gradle "$@"`;

  const gradlewPath = path.join(targetDir, 'gradlew');
  fs.writeFileSync(gradlewPath, gradlewScript);
  fs.chmodSync(gradlewPath, '755');
}

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`🚀 APK Builder Server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
});

export default app;
