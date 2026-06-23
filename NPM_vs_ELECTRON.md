# 📦 Distribution Strategy: NPM CLI vs. Electron Desktop App

If you want to publish the Realm Live Debugger for other developers to use, you have two main distribution routes:
1. **An NPM CLI Package (with Client Library):** Running via terminal (e.g. `npx realm-debugger`).
2. **An Electron.js Desktop App:** A standalone downloadable desktop application (like Flipper, Postman, or VS Code).

Here is a comprehensive comparison, followed by a recommendation and step-by-step setup guides for both.

---

## 📊 Comparison Table

| Metric | 🚀 NPM CLI Package (Recommended) | 💻 Electron Desktop App |
| :--- | :--- | :--- |
| **Download Size** | **~200 KB** (Super light, code only) | **150 MB+** (Includes Chromium + Node.js) |
| **RAM Usage** | **Very Low (~30MB)** (Leverages user's existing browser) | **High (150MB - 300MB)** (Runs a custom Chromium window) |
| **Installation Friction** | **Zero** (Instant run using `npx realm-debugger`) | **Medium** (Download, install, approve security warnings) |
| **Cross-Platform Build** | **Easy** (Write once, runs anywhere Node.js runs) | **Hard** (Must compile and code-sign for Mac, Windows, Linux) |
| **User Experience** | Opens inside a new browser tab | Opens in a dedicated desktop window |
| **Access to OS APIs** | Restricted to standard Node.js & browser sandboxes | Full OS filesystem, menu bar, tray icon access |

---

## 🏆 Recommendation: Go with the **NPM CLI Package**

For developer tools like this, **an NPM CLI package is significantly better**. 

### Why?
1. **Developer Habits:** React Native developers live in the terminal. They already run Metro bundler, Android Emulators, and iOS simulators. Running `npx realm-debugger` is second nature.
2. **Zero Bloat:** Electron apps are notorious for being resource-heavy. Since developers already have high-performance web browsers open, reusing their existing browser saves memory and disk space.
3. **Low Maintenance:** You don't have to deal with Apple Developer Accounts (fees for code signing), Windows SmartScreen warnings, or packaging separate Intel vs. Apple Silicon (M1/M2/M3) Mac binaries.

---

## 🛠️ Option 1: How to Build & Publish as an NPM CLI Package

You can package both the **Server (CLI)** and the **Client Helper** inside a single NPM package.

### 1. Structure the Package
```
realm-debugger/
├── bin/
│   └── cli.js            # Launches the server.js file
├── client/
│   └── index.ts          # Exports client helper: initRealmDebugger
├── public/               # Static dashboard assets (html, css, js)
├── server.js             # Express / WS server backend
└── package.json          # Main packaging config
```

### 2. Configure `package.json`
Update your `package.json` to expose both the CLI command and the client library exports:

```json
{
  "name": "react-native-realm-live-debugger",
  "version": "1.0.0",
  "description": "Real-time Live Database Inspector for React Native Realm databases",
  "main": "client/index.js",
  "types": "client/index.d.ts",
  "bin": {
    "realm-debugger": "./bin/cli.js"
  },
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "express": "^4.19.2",
    "open": "^10.1.0",
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

### 3. Build the CLI Loader (`bin/cli.js`)
Create a simple launcher that starts the server and automatically opens the user's browser:
```javascript
#!/usr/bin/env node
const open = require('open');
require('../server.js'); // Starts the Express & WebSocket server

// Wait a second for server initialization, then open dashboard
setTimeout(() => {
  open('http://localhost:3000');
}, 1000);
```

### 4. Publish to NPM
```bash
npm login
npm publish
```
**How others will use it:**
1. Install client library: `npm install react-native-realm-live-debugger`
2. Run the debugger: `npx realm-debugger`

---

## 🛠️ Option 2: How to Build as an Electron Desktop App

If you prefer a standalone desktop app, you can use **Electron Forge** to bundle the server and frontend.

### 1. Install Electron Dependencies
In the `realm-debugger` folder, install Electron:
```bash
npm install --save-dev electron @electron-forge/cli
npx electron-forge import
```

### 2. Create the Electron Main Process (`main.js`)
Create a main entry point for Electron that runs the Express server in the background and loads the dashboard into a native Chromium window:

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

// 1. Start the Debugger Server in the background
require('./server.js');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Realm Live Debugger",
    icon: path.join(__dirname, 'public/favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 2. Load the Local Server Port
  win.loadURL('http://localhost:3000');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

### 3. Configure `package.json` for Electron
Add the main entry pointing to `main.js`:
```json
{
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "package": "electron-forge package",
    "make": "electron-forge make"
  }
}
```

### 4. Build Standalone Installers
To compile installers (e.g. `.exe` for Windows, `.dmg` for Mac):
```bash
npm run make
```
The compiled files will appear in the `out/` directory ready for distribution on GitHub Releases.
