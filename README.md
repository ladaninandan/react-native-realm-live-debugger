# Realm Live Database Inspector & Debugger

A high-performance, real-time, **Read-Only** Realm Database Inspector for React Native applications. Stream your Realm file schemas, collections, change logs, and individual records directly to a web browser as they update.

---

## Features

- 📂 **Multi-File Support**: Inspect multiple active `.realm` databases concurrently.
- ⚡ **Real-Time Data Streaming**: Instant updates via WebSockets when database records are inserted, modified, or deleted.
- 🔍 **Dynamic Schema Auditing**: Automatically detects schemas, fields, columns, and relations.
- 👓 **JSON Inspector**: View fully-formatted JSON objects for any record in the database.
- 🔎 **Global Table Search**: Instantly search and filter records on the client side.
- 🛠️ **Auto-Reconnect**: Seamless background recovery if the app or debugger server goes offline.
- 🔒 **Read-Only Mode**: Guarantees zero writes back to your database, ensuring safe debug environments.

---

## 📁 Project Structure

```
realm-debugger/
├── package.json         # Node.js dependencies (express, ws)
├── server.js            # Node/Express WebSocket Server
├── README.md            # Setup and usage guide
├── client/
│   └── realmDebuggerClient.ts   # React Native client helper hook
└── public/
    └── index.html       # Sleek HTML5 / Tailwind CSS Live Dashboard
```

---

## 🚀 Getting Started

### 1. Install Server Dependencies

Navigate to the `realm-debugger` folder and install:

```bash
cd realm-debugger
npm install
```

### 2. Start the Debugger Server

Run the server on your development machine and automatically open the debugger in your default browser:

```bash
npm run realm-debugger
```

Or start the server without automatically opening a browser window:

```bash
npm start
```

The server will start on `http://localhost:3000` (or `http://localhost:5000` in development). Keep this window running in the background.

---

## 🔌 Integration into React Native App

To integrate the debugger with any React Native application using Realm, please follow the detailed steps in the [Integration Guide](./INTEGRATION.md).

### Quick Setup:
1. Install the package in your React Native project:
```bash
npm install react-native-realm-live-debugger --legacy-peer-deps
```

2. Initialize the debugger inside your React component where the database is opened:
```typescript
import React, { useEffect } from 'react';
import { useRealm } from '@realm/react';
import { initRealmDebugger } from 'react-native-realm-live-debugger';

// Inside your component:
const realm = useRealm();

useEffect(() => {
  if (__DEV__ && realm) {
    // Initialize the live debugger directly from the package
    const cleanUp = initRealmDebugger(realm, null, () => {});
    return () => cleanUp();
  }
}, [realm]);
```

3. Start the Debugger Server:
In the root directory of your React Native project, run the following command to start the debugger:
```bash
npx realm-debugger
```
This automatically starts the local backend server and opens the Live Dashboard in your default web browser.

> [!NOTE]
> If testing on an **Android physical device**, replace `localhost` with your machine's local IP address (e.g., `ws://192.168.1.5:3000`), or run the reverse port forwarding command:
> `adb reverse tcp:3000 tcp:3000`

---

## 📺 Dashboard Controls

Open `http://localhost:3000` in any web browser:

1. **Left Sidebar**:
   - **Realm Files**: Shows active connected files and status (`online` or `offline`). Select a file to view its schemas.
   - **Schemas**: Select a collection to load its contents into the main view.
2. **Main Table**:
   - Lists all records and columns dynamically.
   - Use the **Search Bar** to filter rows by any value.
3. **JSON Inspector**:
   - Click on any table row to see its fully formatted JSON structure.
4. **Change Event Console**:
   - Real-time logging of all `INSERT`, `UPDATE`, and `DELETE` actions as they occur.
5. **Sync App Button**:
   - Click to request a full refresh from the app if you want to force-align state.
