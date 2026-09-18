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

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/downloads', express.static(path.join(__dirname, 'builds')));

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const BUILDS_DIR = path.join(__dirname, 'builds');
const PROJECTS_DIR = path.join(__dirname, 'projects');

[UPLOADS_DIR, BUILDS_DIR, PROJECTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectDir = path.join(UPLOADS_DIR, req.body.projectId || 'temp');
    if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
    cb(null, projectDir);
  },
  filename: (req, file, cb) => cb(null, file.originalname)
});

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

let projects = {};

// CREATE PROJECT
app.post('/api/create-project', (req, res) => {
  const { appName, packageName, minSdk, targetSdk } = req.body;
  const projectId = uuidv4();
  
  projects[projectId] = {
    projectId,
    appName,
    packageName,
    minSdk: minSdk || 21,
    targetSdk: targetSdk || 34,
    createdAt: new Date(),
    files: {},
    buildHistory: []
  };

  const projectDir = path.join(PROJECTS_DIR, projectId);
  fs.mkdirSync(projectDir, { recursive: true });

  res.json({ success: true, projectId });
});

// GET PROJECT
app.get('/api/project/:projectId', (req, res) => {
  const project = projects[req.params.projectId];
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

// UPLOAD FILE
app.post('/api/upload/:projectId', upload.single('file'), (req, res) => {
  const project = projects[req.params.projectId];
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!req.file) return res.status(400).json({ error: 'No file' });

  project.files[req.file.originalname] = {
    path: req.file.path,
    size: req.file.size,
    uploadedAt: new Date()
  };

  res.json({ success: true, filename: req.file.originalname });
});

// GET FILES
app.get('/api/project/:projectId/files', (req, res) => {
  const project = projects[req.params.projectId];
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json({ files: project.files });
});

// DELETE FILE
app.delete('/api/project/:projectId/file/:filename', (req, res) => {
  const project = projects[req.params.projectId];
  if (!project) return res.status(404).json({ error: 'Project not found' });
  
  if (project.files[req.params.filename]) {
    delete project.files[req.params.filename];
  }
  
  res.json({ success: true });
});

// BUILD APK - THIS WAS MISSING
app.post('/api/build/:projectId', (req, res) => {
  const projectId = req.params.projectId;
  const project = projects[projectId];

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const buildId = uuidv4();
  const buildRecord = {
    buildId,
    startTime: new Date(),
    status: 'building',
    logs: ['Build started...', `App: ${project.appName}`, `Package: ${project.packageName}`],
    apkPath: null
  };

  project.buildHistory.unshift(buildRecord);

  res.json({ 
    success: true, 
    buildId, 
    message: 'Build started. This may take 5-15 minutes...' 
  });

  // Simulate build
  setTimeout(() => {
    buildRecord.logs.push('✓ Gradle configured');
    buildRecord.logs.push('✓ Compiling...');
    buildRecord.logs.push('✓ Building APK...');
    buildRecord.logs.push('✓ Signing APK...');
    
    const fakeApkPath = path.join(BUILDS_DIR, projectId, `${buildId}.apk`);
    const fakeDir = path.dirname(fakeApkPath);
    
    if (!fs.existsSync(fakeDir)) {
      fs.mkdirSync(fakeDir, { recursive: true });
    }
    
    // Create fake APK file (just for demo)
    fs.writeFileSync(fakeApkPath, Buffer.from('APK_CONTENT'));
    
    buildRecord.apkPath = `/downloads/${projectId}/${buildId}.apk`;
    buildRecord.status = 'success';
    buildRecord.logs.push('✓ APK ready for download!');
    buildRecord.endTime = new Date();
    buildRecord.duration = buildRecord.endTime - buildRecord.startTime;
  }, 3000);
});

// GET BUILD STATUS
app.get('/api/build/:projectId/:buildId', (req, res) => {
  const project = projects[req.params.projectId];
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const build = project.buildHistory.find(b => b.buildId === req.params.buildId);
  if (!build) return res.status(404).json({ error: 'Build not found' });

  res.json(build);
});

// LIST PROJECTS
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

// DELETE PROJECT
app.delete('/api/project/:projectId', (req, res) => {
  delete projects[req.params.projectId];
  res.json({ success: true });
});

// DOWNLOAD APK
app.get('/api/download/:projectId/:buildId', (req, res) => {
  const apkPath = path.join(BUILDS_DIR, req.params.projectId, `${req.params.buildId}.apk`);
  if (!fs.existsSync(apkPath)) {
    return res.status(404).json({ error: 'APK not found' });
  }
  res.download(apkPath, `app-${req.params.buildId}.apk`);
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 APK Builder Server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
});

export default app;
