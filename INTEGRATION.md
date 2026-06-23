# 🔌 Integrating Realm Live Debugger into your React Native Project

This guide provides step-by-step instructions to integrate the **Realm Live Debugger Client** into any React Native application.

---

## 🏗️ Architecture Overview

The Realm Live Debugger works on a client-server architecture:
1. **Inspector Server (`server.js`):** A lightweight Node.js server that hosts the web dashboard on port `3000` and orchestrates WebSocket connections.
2. **Inspector Dashboard (`public/`):** A premium Tailwind CSS browser interface to view tables, inspect dynamic JSON, and request database modifications.
3. **Inspector Client Helper (`client/realmDebuggerClient.ts`):** A TypeScript file that integrates directly with the React Native app's Realm lifecycle to stream live updates and perform read-write sync actions.

---

## 🛠️ Step-by-Step Integration

### Step 1: Copy the Client File
Copy the `realmDebuggerClient.ts` helper file from this folder into your React Native project (e.g. into `src/services/realmDebuggerClient.ts` or `src/utils/realmDebuggerClient.ts`).

### Step 2: Ensure Dependencies are Installed
The helper relies on standard React Native WebSockets (built-in) and the `@realm/react` or `realm` package. Make sure `realm` is already installed in your project:
```bash
npm install realm
# or
yarn add realm
```

### Step 3: Initialize the Debugger
To initialize the debugger, call the `initRealmDebugger` function as soon as your Realm database has loaded. 

#### Parameters required by `initRealmDebugger`:
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `initialRealm` | `Realm` | The current active instance of your Realm database. |
| `realmConfig` | `Realm.Configuration` | The configuration object used to open Realm (required to reload Realm on dynamic schema updates). |
| `setRealmInstance` | `(newRealm: Realm) => void` | Callback function to update your app state with the new Realm instance when schemas change. |
| `serverUrl` | `string` *(Optional)* | WebSocket URL of the debugger server. Defaults to `ws://localhost:3000`. |

---

## 💡 Code Examples

Here are standard integration templates depending on how your app manages the Realm database instance.

### Example A: Standard React State & Context Setup
If your React Native app opens Realm dynamically in `App.tsx` and manages it via state:

```typescript
import React, { useEffect, useState } from 'react';
import Realm from 'realm';
import { initRealmDebugger } from './src/utils/realmDebuggerClient';

// 1. Define your Realm config (keep a reference)
const realmConfig: Realm.Configuration = {
  schema: [UserSchema, TodoSchema],
  schemaVersion: 1,
};

export default function App() {
  const [realm, setRealm] = useState<Realm | null>(null);

  useEffect(() => {
    // 2. Open the Realm database
    Realm.open(realmConfig).then((openedRealm) => {
      setRealm(openedRealm);

      // 3. Initialize the debugger (DEV mode only)
      if (__DEV__) {
        initRealmDebugger(
          openedRealm,       // Current instance
          realmConfig,       // Config object
          (newRealm) => {    // Callback to update state on dynamic schema/column changes
            setRealm(newRealm);
          },
          'ws://localhost:3000'
        );
      }
    });
  }, []);

  if (!realm) return <LoadingScreen />;

  return <MainAppLayout realm={realm} />;
}
```

### Example B: Using `@realm/react` Hooks
If your project uses the hook-based `@realm/react` library, you can initialize the debugger inside a wrapper component once the Realm provider successfully loads:

```typescript
import React, { useEffect } from 'react';
import { useRealm } from '@realm/react';
import { initRealmDebugger } from './src/utils/realmDebuggerClient';
import { myRealmConfig } from './realmConfig'; // Keep a reference to your configuration

export function RealmDebuggerConnector() {
  const realm = useRealm();

  useEffect(() => {
    if (__DEV__ && realm) {
      const cleanUp = initRealmDebugger(
        realm,
        myRealmConfig,
        (newRealm) => {
          // Note: React Native @realm/react automatically refreshes hooks on instance changes,
          // but passing a no-op handler complies with client interface.
          console.log('[RealmDebugger] Realm re-opened with new schemas.');
        },
        'ws://localhost:3000'
      );

      return () => cleanUp(); // Cleans up WebSocket and listener on unmount
    }
  }, [realm]);

  return null; // Invisible connector component
}
```

---

## 🔌 Android Device Configuration (Physical & Emulator)

React Native apps running on Android devices need explicit network mapping to reach port `3000` on your development PC:

### Option 1: Port Forwarding (Recommended)
If your Android physical device is connected via USB, or if you are using an Android Emulator, run this command in your development terminal:
```bash
adb reverse tcp:3000 tcp:3000
```
This forces the Android device to route all network calls directed to `localhost:3000` directly to port `3000` on your PC.

### Option 2: IP Address Mapping
Alternatively, you can provide the local IP address of your development machine in the `serverUrl` parameter:
```typescript
initRealmDebugger(
  realm, 
  realmConfig, 
  setRealm, 
  'ws://192.168.1.45:3000' // Your machine's Wi-Fi / Ethernet LAN IP
);
```

---

## ⚠️ Important Best Practices

1. **Gate with `__DEV__`:**
   Always wrap `initRealmDebugger` in a `__DEV__` check. This prevents the debugger WebSocket and hot-reloading code from being bundled into your production release builds.
2. **Schema Versioning:**
   When adding columns dynamically from the web panel, the debugger client automatically increments the `schemaVersion` parameter and re-opens the Realm file. Make sure your app doesn't enforce strict schema version overrides that could conflict with this during active debug sessions.
