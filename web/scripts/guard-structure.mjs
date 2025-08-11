// scripts/guard-structure.mjs
import fs from "fs";
import path from "path";

const root = process.cwd();
const mustDirs = [
  "src/app/(dash)/admin",
  "src/app/(dash)/carrier",
  "src/app/(dash)/customer",
  "src/app/login",
  "src/app/api/auth/login",
  "src/app/api/auth/logout",
  "src/app/api/auth/register",
  "src/app/api/auth/me",
  "src/app/api/bids",
  "src/app/api/tasks",
  "src/app/api/carrier",       // singular
  "src/app/api/dev/seed-min",
  "src/lib",
  "prisma",
];

const mustFilesAny = [
  "src/lib/db.ts",
  "src/lib/auth.ts",
  "prisma/schema.prisma",
  // UI pages should exist but can be filled gradually
  "src/app/login/page.tsx",
];

const forbidGlobsUnderApi = [".tsx", ".jsx"]; // UI not allowed under /api

const duplicatePairs = [
  ["src/app/admin", "src/app/(dash)/admin"],
  ["src/app/carrier", "src/app/(dash)/carrier"],
  ["src/app/customer", "src/app/(dash)/customer"],
];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function fail(msg) {
  console.error("❌ " + msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log("✅ " + msg);
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

console.log("🔒 Guarding structure…");

for (const d of mustDirs) {
  if (!exists(d)) fail(`Missing directory: ${d}`);
}

for (const f of mustFilesAny) {
  if (!exists(f)) fail(`Missing file: ${f}`);
}

// No UI under /api
const apiDir = path.join(root, "src/app/api");
if (fs.existsSync(apiDir)) {
  const files = walk(apiDir).map(p => p.replace(root + path.sep, ""));
  for (const file of files) {
    for (const bad of forbidGlobsUnderApi) {
      if (file.endsWith(bad)) fail(`UI file under /api is forbidden: ${file}`);
    }
  }
}

// No duplicate parallel routes
for (const [a, b] of duplicatePairs) {
  if (exists(a) && exists(b)) fail(`Parallel route conflict: both ${a} and ${b} exist`);
}

// tsconfig checks
const tsconfigPath = path.join(root, "tsconfig.json");
try {
  const ts = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
  const co = ts.compilerOptions || {};
  if (co.baseUrl !== ".") fail(`tsconfig.compilerOptions.baseUrl must be "."`);
  const paths = co.paths || {};
  const arr = paths["@/*"];
  if (!Array.isArray(arr) || arr[0] !== "./src/*")
    fail(`tsconfig.paths["@/*"] must be ["./src/*"]`);
} catch (e) {
  fail(`Cannot read/parse tsconfig.json: ${e.message}`);
}

// Require route.ts for API leaves
const apiLeaves = [
  "src/app/api/auth/login",
  "src/app/api/auth/logout",
  "src/app/api/auth/register",
  "src/app/api/auth/me",
  "src/app/api/bids",
  "src/app/api/tasks",
  "src/app/api/carrier",
  "src/app/api/dev/seed-min",
];
for (const leaf of apiLeaves) {
  if (!exists(path.join(leaf, "route.ts"))) {
    fail(`Missing API handler: ${leaf}/route.ts`);
  }
}

if (process.exitCode === 1) {
  console.error("\nStructure guard failed. See messages above. (See STRUCTURE.md for the contract.)");
  process.exit(1);
} else {
  ok("Structure looks good.");
}
