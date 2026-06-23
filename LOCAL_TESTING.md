# 🧪 Testing your NPM CLI Tool Locally

To test your new CLI tool locally on your computer before publishing it to NPM, you can use Node's built-in **`npm link`** system. This creates a global symbolic link pointing to your local package directory.

---

## Step 1: Link the Package Globally
Open a terminal, navigate to the `realm-debugger` folder, and link the package:
```bash
cd realm-debugger
npm link
```
*This registers the `react-native-realm-live-debugger` package locally on your computer and hooks the command `realm-debugger` (defined in the `bin` field of `package.json`) into your system's executable path.*

---

## Step 2: Run the Command
Once linked, you can run the command from **any directory** on your machine:
```bash
realm-debugger
```
**What happens:**
1. Your Node.js server starts in the terminal.
2. The script detects your operating system and automatically launches your default web browser to:
   `http://localhost:3000`

---

## Step 3: Link to a React Native App Project
If you have another React Native project running on your PC, you can import the client file as a module rather than copying and pasting it.

1. Open your terminal in the **other React Native project** directory.
2. Run:
   ```bash
   npm link react-native-realm-live-debugger
   ```
3. Now, in your code (e.g. `App.tsx`), you can import the client helper directly:
   ```typescript
   import { initRealmDebugger } from 'react-native-realm-live-debugger';
   ```

---

## Step 4: Unlinking (Cleaning up)
When you are done testing and want to remove the global symbolic links:

1. In the **React Native project** folder:
   ```bash
   npm unlink react-native-realm-live-debugger
   ```
2. In the **`realm-debugger`** folder:
   ```bash
   npm unlink
   ```
