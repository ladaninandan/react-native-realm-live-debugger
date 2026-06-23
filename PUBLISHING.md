# 🚀 Publishing your Realm Live Debugger to NPM

Follow this checklist to publish `react-native-realm-live-debugger` to the public NPM registry.

---

## 📋 Step 1: Create an NPM Account
If you don't already have an NPM account:
1. Go to [https://www.npmjs.com/signup](https://www.npmjs.com/signup).
2. Register your username, email, and password.
3. Verify your email address (NPM will block publications until verified).

---

## 🔑 Step 2: Log In from your CLI
Open your terminal and run:
```bash
npm login
```
*This will prompt you for your username, password, email, and a one-time password (OTP) sent to your email.*

To verify that you are successfully logged in, run:
```bash
npm whoami
```
*It should print your registered NPM username.*

---

## 📦 Step 3: Check package.json Fields
Make sure the fields in your `package.json` are correct before submitting:
* **`name`:** Needs to be unique on npmjs.com. If the name `react-native-realm-live-debugger` is already taken, you can use a scoped name like `@your_username/realm-live-debugger`.
* **`version`:** Starting version (typically `1.0.0` or `0.1.0`).
* **`files`:** We have already configured this so NPM only uploads code and documentation, leaving out development logs and workspace configurations.

---

## 🚀 Step 4: Publish to the Registry

### Option A: Standard Publication
If your package name is unscoped (e.g. `react-native-realm-live-debugger`):
```bash
cd realm-debugger
npm publish
```

### Option B: Scoped Public Publication
If your package name starts with your username (e.g. `@nandan/realm-live-debugger`):
```bash
cd realm-debugger
npm publish --access public
```

---

## 🔄 Step 5: How to Publish Updates later
When you make changes to your code and want to push an update:

1. **Increment the version number:**
   NPM uses Semantic Versioning (`major.minor.patch`). You can run these commands to auto-update your `package.json` version:
   * For bug fixes: `npm version patch` (e.g., `1.0.0` ➡️ `1.0.1`)
   * For new features: `npm version minor` (e.g., `1.0.0` ➡️ `1.1.0`)
   * For breaking changes: `npm version major` (e.g., `1.0.0` ➡️ `2.0.0`)

2. **Publish the new version:**
   ```bash
   npm publish
   ```
