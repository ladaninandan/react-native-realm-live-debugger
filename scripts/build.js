#!/usr/bin/env node

/**
 * Build script — Compiles TypeScript and minifies all JS/CSS
 * before publishing to NPM. This ensures the published package
 * contains only minified (unreadable) code.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

// 1. Clean dist folder
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true });
}
fs.mkdirSync(DIST, { recursive: true });

console.log("🔨 Building react-native-realm-live-debugger...\n");

// 2. Compile TypeScript client to JavaScript + declarations
console.log("📦 Compiling TypeScript client...");
const clientDistDir = path.join(DIST, "client");
fs.mkdirSync(clientDistDir, { recursive: true });

execSync(
  `npx tsc`,
  { stdio: "inherit", cwd: ROOT }
);
console.log("   ✅ TypeScript compiled.\n");

// 3. Minify all JS files using terser
console.log("🗜️  Minifying JavaScript files...");

function minifyJsFile(srcFile, destFile) {
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  execSync(`npx terser "${srcFile}" --compress --mangle --output "${destFile}"`, {
    stdio: "inherit",
    cwd: ROOT,
  });
  console.log(`   ✅ ${path.relative(ROOT, destFile)}`);
}

// Minify server.js
minifyJsFile(path.join(ROOT, "server.js"), path.join(DIST, "server.js"));

// Minify bin/cli.js
fs.mkdirSync(path.join(DIST, "bin"), { recursive: true });
const cliSrc = path.join(ROOT, "bin", "cli.js");
const cliDest = path.join(DIST, "bin", "cli.js");
// cli.js needs the shebang line preserved
const cliContent = fs.readFileSync(cliSrc, "utf8");
const hasShebang = cliContent.startsWith("#!/");
const shebangLine = hasShebang ? cliContent.split("\n")[0] + "\n" : "";
execSync(`npx terser "${cliSrc}" --compress --mangle --output "${cliDest}"`, {
  stdio: "inherit",
  cwd: ROOT,
});
// Re-add shebang if it was removed
if (hasShebang) {
  const minified = fs.readFileSync(cliDest, "utf8");
  if (!minified.startsWith("#!/")) {
    fs.writeFileSync(cliDest, shebangLine + minified);
  }
}
console.log(`   ✅ ${path.relative(ROOT, cliDest)}`);

// Minify the compiled client JS
const compiledClientJs = path.join(clientDistDir, "realmDebuggerClient.js");
if (fs.existsSync(compiledClientJs)) {
  const tempFile = compiledClientJs + ".tmp";
  fs.renameSync(compiledClientJs, tempFile);
  execSync(
    `npx terser "${tempFile}" --compress --mangle --output "${compiledClientJs}"`,
    { stdio: "inherit", cwd: ROOT }
  );
  fs.unlinkSync(tempFile);
  console.log(`   ✅ ${path.relative(ROOT, compiledClientJs)}`);
}

// Minify public JS files
const publicJsDir = path.join(ROOT, "public", "js");
const publicDistJs = path.join(DIST, "public", "js");

function minifyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      minifyDir(srcPath, destPath);
    } else if (entry.name.endsWith(".js")) {
      minifyJsFile(srcPath, destPath);
    }
  }
}

minifyDir(publicJsDir, publicDistJs);

// 4. Copy public non-JS files (HTML, CSS) as-is
console.log("\n📋 Copying static assets...");

function copyDir(srcDir, destDir, extensions) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, extensions);
    } else if (!extensions || extensions.some((ext) => entry.name.endsWith(ext))) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`   ✅ ${path.relative(ROOT, destPath)}`);
    }
  }
}

// Copy HTML and CSS
copyDir(path.join(ROOT, "public"), path.join(DIST, "public"), [".html", ".css"]);

// Copy client package.json if exists
const clientPkg = path.join(ROOT, "client", "package.json");
if (fs.existsSync(clientPkg)) {
  fs.copyFileSync(clientPkg, path.join(clientDistDir, "package.json"));
  console.log(`   ✅ dist/client/package.json`);
}

console.log("\n🎉 Build complete! The dist/ folder is ready for publishing.\n");

// Show dist contents
const { execSync: exec2 } = require("child_process");
try {
  console.log("📂 dist/ contents:");
  console.log(exec2("find dist -type f", { cwd: ROOT, encoding: "utf8" }));
} catch {
  // find might not exist on Windows
}
