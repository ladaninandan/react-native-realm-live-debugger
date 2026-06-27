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
| `realmConfig` | `Realm.Configuration` | The configuration object used to open Realm (pass `null` if not using dynamic schema features). |
| `serverUrl` | `string` *(Optional)* | WebSocket URL of the debugger server. Defaults to `ws://localhost:5000` in dev mode. |

> [!WARNING]
> **Do NOT pass a callback function as the 3rd argument.** The 3rd parameter expects a WebSocket URL string, not a function. Passing a function will cause a silent connection failure.

---

## 💡 Code Examples

Here are standard integration templates depending on how your app manages the Realm database instance.

### Example A: Standard React State & Context Setup
If your React Native app opens Realm dynamically in `App.tsx` and manages it via state:

```typescript
import React, { useEffect, useState } from 'react';
import Realm from 'realm';
import { initRealmDebugger } from 'react-native-realm-live-debugger';

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
          openedRealm,       // Current Realm instance
          realmConfig         // Config object (or null)
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
import { initRealmDebugger } from 'react-native-realm-live-debugger';

export function RealmDebuggerConnector() {
  const realm = useRealm();

  useEffect(() => {
    if (__DEV__ && realm) {
      const cleanUp = initRealmDebugger(realm, null);

      return () => cleanUp(); // Cleans up WebSocket and listener on unmount
    }
  }, [realm]);

  return null; // Invisible connector component
}
```

---

## 🔌 Android Device Configuration (Physical & Emulator)

React Native apps running on Android devices need explicit network mapping to reach port `5000` on your development PC:

### Option 1: Port Forwarding (Recommended)
If your Android physical device is connected via USB, or if you are using an Android Emulator, run this command in your development terminal:
```bash
adb reverse tcp:5000 tcp:5000
```
This forces the Android device to route all network calls directed to `localhost:5000` directly to port `5000` on your PC.

### Option 2: IP Address Mapping
Alternatively, you can provide the local IP address of your development machine in the `serverUrl` parameter:
```typescript
initRealmDebugger(
  realm, 
  realmConfig, 
  'ws://192.168.1.45:5000' // Your machine's Wi-Fi / Ethernet LAN IP
);
```

---

## ⚠️ Important Best Practices

1. **Gate with `__DEV__`:**
   Always wrap `initRealmDebugger` in a `__DEV__` check. This prevents the debugger WebSocket and hot-reloading code from being bundled into your production release builds.
2. **Schema Versioning:**
   When adding columns dynamically from the web panel, the debugger client automatically increments the `schemaVersion` parameter and re-opens the Realm file. Make sure your app doesn't enforce strict schema version overrides that could conflict with this during active debug sessions.

## 🎯 Flutter/Dart Integration

We support **Flutter** apps using the `realm` Dart package. You can integrate this by referencing the client library directly from GitHub in your `pubspec.yaml`.

### Step 1: Add Dependency to `pubspec.yaml`
Add the package to your Flutter project's `pubspec.yaml` file:

```yaml
dependencies:
  flutter:
    sdk: flutter
  realm: ^0.10.0 # Or your current Realm version
  
  # Import client directly from the GitHub repository
  realm_live_debugger:
    git:
      url: https://github.com/ladaninandan/react-native-realm-live-debugger.git
      path: client/flutter
```

Then run:
```bash
flutter pub get
```

### Step 2: Initialize in Flutter
Initialize the debugger client when you open your Realm database. Make sure to run it only in debug mode:

```dart
import 'package:flutter/foundation.dart';
import 'package:realm/realm.dart';
import 'package:realm_live_debugger/realm_debugger_client.dart';

void initDatabase() {
  final config = Configuration.local([User.schema, Todo.schema]);
  final realm = Realm(config);

  if (kDebugMode) {
    final debugger = RealmDebuggerClient(
      realm,
      serverUrl: 'ws://localhost:5000', // ws://10.0.2.2:5000 for Android emulator
    );
    debugger.start();
  }
}
```

### Step 3: Run the Dashboard
Start the debugger server on your computer as usual:
```bash
npx realm-debugger
```
If debugging on an **Android Emulator**, remember to run:
```bash
adb reverse tcp:5000 tcp:5000
```

---

## 🤖 Native Android (Kotlin) Integration

We support native Android apps built with the MongoDB Realm Kotlin SDK.

### Step 1: Add Client File
Copy `RealmDebuggerClient.kt` from the repository folder `client/android/RealmDebuggerClient.kt` into your Android project source path (e.g. `com/yourcompany/app/debugger/RealmDebuggerClient.kt`).

### Step 2: Add Dependencies
Ensure you have the **OkHttp** dependency in your app's `build.gradle`:
```gradle
dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
```

### Step 3: Initialize in Kotlin
Initialize the debugger client when opening your Realm database:
```kotlin
import io.realm.debugger.RealmDebuggerClient

val realm = Realm.open(configuration)

// Initialize in debug configurations only
if (BuildConfig.DEBUG) {
    val debugger = RealmDebuggerClient(realm, "ws://10.0.2.2:5000") // 10.0.2.2 maps to local machine from emulator
    debugger.start()
}
```

---

## 🍏 Native iOS (Swift) Integration

We support native iOS apps built with the Realm Swift SDK.

### Step 1: Add Client File
Copy `RealmDebuggerClient.swift` from the repository folder `client/ios/RealmDebuggerClient.swift` into your Xcode project.

### Step 2: Initialize in Swift
Initialize the debugger client when opening your Realm database:
```swift
import RealmSwift

let realm = try! Realm()

#if DEBUG
let debugger = RealmDebuggerClient(realm: realm, serverUrlString: "ws://localhost:5000")
debugger.start()
#endif
```
