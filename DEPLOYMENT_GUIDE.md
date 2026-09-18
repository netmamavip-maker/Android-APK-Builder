# APK Builder Studio - Complete Deployment Guide

## 📋 Table of Contents
1. [Local Setup](#local-setup)
2. [GitHub Setup](#github-setup)
3. [Render Deployment](#render-deployment)
4. [Using the Application](#using-the-application)
5. [Troubleshooting](#troubleshooting)

---

## 🚀 Local Setup (For Development)

### Prerequisites
- Docker & Docker Compose installed
- Git installed
- Node.js 18+ (if running without Docker)

### Step 1: Clone or Download
```bash
# If using Git
git clone <your-repo-url>
cd apk-builder-studio

# Or extract the ZIP file
unzip apk-builder-studio.zip
cd apk-builder-studio
```

### Step 2: Setup Environment
```bash
# Copy example env to .env
cp .env.example .env

# No modifications needed for local development
```

### Step 3: Run with Docker
```bash
# Build and start
docker-compose up --build

# Or just run in background
docker-compose up -d
```

### Step 4: Access
- Open browser: `http://localhost:3000`
- That's it! Ready to build APKs locally

### Stop Docker
```bash
docker-compose down
```

---

## 📁 GitHub Setup

### Step 1: Create GitHub Repository
1. Go to https://github.com/new
2. Create repository name: `apk-builder-studio`
3. Make it **Private** (recommended)
4. Click "Create repository"

### Step 2: Push Code to GitHub
```bash
# Navigate to project directory
cd apk-builder-studio

# Initialize Git (if not already done)
git init
git add .
git commit -m "Initial APK Builder Studio commit"

# Add remote
git remote add origin https://github.com/YOUR_USERNAME/apk-builder-studio.git

# Push to GitHub
git branch -M main
git push -u origin main

# Verify at: https://github.com/YOUR_USERNAME/apk-builder-studio
```

### Step 3: Verify Files on GitHub
Check that these files are present:
- `package.json` ✓
- `server.js` ✓
- `Dockerfile` ✓
- `docker-compose.yml` ✓
- `render.yaml` ✓
- `public/index.html` ✓

---

## 🌐 Render Deployment

### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up (GitHub login recommended)
3. Create free account

### Step 2: Connect GitHub to Render
1. Dashboard → "New +" → "Web Service"
2. Click "Connect account" → "GitHub"
3. Authorize Render to access GitHub
4. Select repository: `apk-builder-studio`

### Step 3: Configure Deployment
| Setting | Value |
|---------|-------|
| **Name** | `apk-builder-studio` |
| **Environment** | `Docker` |
| **Region** | `(select closest to you)` |
| **Branch** | `main` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | `Paid - $7/month` (recommended for APK builds) |

### Step 4: Add Environment Variables
```
PORT=3000
NODE_ENV=production
ANDROID_HOME=/opt/android-sdk
```

### Step 5: Deploy
1. Click "Create Web Service"
2. Wait for deployment (5-10 minutes first time)
3. Once deployed, copy the URL shown (e.g., `https://apk-builder-studio.onrender.com`)

### Step 6: Access Your Application
```
https://apk-builder-studio.onrender.com
```

### Verify Deployment
- Open the URL
- Create a test project
- Try uploading files
- Build an APK
- If successful, deployment is complete!

---

## 💻 Using the Application

### Creating Your First APK

#### Step 1: Create Project
```
App Name: HelloWorld
Package: com.example.helloworld
Min SDK: 21
Target SDK: 34
Click: Create Project
```

#### Step 2: Upload Files (Optional)
The app comes with basic files pre-configured. To customize:

**Option A: Use Default Files**
- Just click "BUILD APK NOW"
- App uses standard Hello World template

**Option B: Upload Custom Files**
```
Drag & drop or browse:
- MainActivity.java
- activity_main.xml
- AndroidManifest.xml
- Any other resources
```

#### Step 3: Build APK
1. Click "BUILD APK NOW"
2. Wait for logs to appear
3. First build: 5-10 minutes
4. Subsequent builds: 2-5 minutes

#### Step 4: Download
Once build completes:
1. Look for green "✓ Build successful"
2. Click download link: "📥 Download APK"
3. APK saves to your downloads folder

#### Step 5: Install APK
```bash
# Using adb (Android SDK)
adb install app-<buildid>.apk

# Or manually:
# Transfer APK to Android device
# Open file manager → tap APK → Install
```

---

## 📝 Customizing Your APK

### Change App Icon
1. In project, upload your icon image
2. Place in: `res/mipmap/ic_launcher.png`
3. Rebuild APK

### Change App Name/Label
1. Upload custom `strings.xml` with your app name
2. Rebuild APK

### Change Layout/UI
1. Upload custom `activity_main.xml`
2. Upload custom `MainActivity.java`
3. Rebuild APK

### Add Permissions
Edit `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

### Add Dependencies
Edit `build.gradle`:
```gradle
dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.10.0'
    // Add more as needed
}
```

---

## 🔄 Continuous Deployment

### Auto-Deploy on GitHub Push
1. Render automatically detects changes
2. Any push to `main` branch triggers rebuild
3. New deployment starts automatically
4. Takes 5-10 minutes

### Manual Redeploy
1. Go to Render dashboard
2. Select your service
3. Click "Manual Deploy" → "Deploy latest commit"

---

## ⚙️ Advanced Configuration

### Increase Build Timeout
Edit `render.yaml`:
```yaml
envVars:
  - key: BUILD_TIMEOUT
    value: 7200000  # 2 hours in ms
```

### Change Resource Plan
For faster builds, upgrade Render plan:
- **Free**: Slow, suitable for learning
- **Starter ($7/month)**: Recommended for APK builds
- **Standard ($25+/month)**: Multiple concurrent builds

### Monitor Logs
In Render dashboard:
1. Select service
2. Click "Logs"
3. See real-time build output

---

## 🐛 Troubleshooting

### Problem: "Build failed"
**Solution:**
1. Check logs in Render dashboard
2. Verify Android Manifest syntax
3. Ensure Java code compiles (no syntax errors)
4. Try default template first to verify system works

### Problem: "Timeout"
**Solution:**
1. Upgrade Render plan to Starter ($7)
2. Reduce project complexity
3. Remove large dependencies if possible

### Problem: "APK Download Link Not Working"
**Solution:**
1. Wait 2-3 minutes after build completes
2. Check if APK actually built (check logs)
3. Try rebuilding

### Problem: "Port 3000 already in use" (Local)
**Solution:**
```bash
# Stop existing process
lsof -i :3000
kill -9 <PID>

# Or use different port
docker-compose down
```

### Problem: "Docker build fails"
**Solution:**
```bash
# Clean build
docker-compose down
docker system prune -a
docker-compose up --build
```

### Problem: "Github won't connect"
**Solution:**
1. Check GitHub account is authorized
2. Repository must be public or Render account must have access
3. Try re-connecting GitHub in Render settings

---

## 📊 System Architecture

```
┌─────────────────────────────────────────┐
│        Frontend (React + Tailwind)      │
│  - Project Management Dashboard         │
│  - File Upload & Editor                 │
│  - Build Trigger Interface              │
└──────────────────┬──────────────────────┘
                   │
                   │ REST API
                   ▼
┌─────────────────────────────────────────┐
│      Backend (Express.js + Node.js)     │
│  - Project Database                     │
│  - File Management                      │
│  - Build Queue System                   │
└──────────────────┬──────────────────────┘
                   │
                   │ Docker Container
                   ▼
┌─────────────────────────────────────────┐
│       Android SDK Environment           │
│  - Gradle 8.0                          │
│  - aapt2, d8, apksigner               │
│  - Android SDK 34, NDK 25.1            │
└─────────────────────────────────────────┘
```

---

## 🎯 Next Steps

1. **Deploy to Render** (follow steps above)
2. **Test with sample project**
3. **Create your custom APKs**
4. **Share URL with team** (if needed)
5. **Monitor builds in Render dashboard**

---

## 📞 Support

**For Render Issues:**
- Render Docs: https://render.com/docs
- Render Support: https://render.com/support

**For Docker Issues:**
- Docker Docs: https://docs.docker.com
- Docker Hub: https://hub.docker.com

**For Android Development:**
- Android Docs: https://developer.android.com
- Gradle Docs: https://gradle.org/documentation

---

## ✅ Deployment Checklist

- [ ] GitHub repository created
- [ ] Code pushed to GitHub
- [ ] Render account created
- [ ] GitHub connected to Render
- [ ] render.yaml configured
- [ ] Service deployed on Render
- [ ] Environment variables set
- [ ] Test project created
- [ ] Test APK built successfully
- [ ] APK downloaded and tested

---

**Happy building! 🚀**
