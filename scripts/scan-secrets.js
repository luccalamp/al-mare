const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TARGETS = [
  "app",
  "lib",
  "scripts",
  "scratch",
  "middleware.ts",
  "next.config.mjs",
  "create-user.js",
];

const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "logs",
  "backups",
  "coverage",
]);

const IGNORED_FILES = [
  ".env",
  ".env.local",
  ".env.example",
];

const FILE_EXTENSIONS = new Set([
  ".js",
  ".cjs",
  ".mjs",
  ".ts",
  ".tsx",
  ".json",
  ".sql",
  ".ps1",
]);

const RULES = [
  {
    name: "hardcoded-supabase-service-role-env",
    regex: /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"`][^'"`\r\n]{8,}['"`]/i,
  },
  {
    name: "hardcoded-service-role-variable",
    regex: /serviceRoleKey\s*[:=]\s*['"`][^'"`\r\n]{8,}['"`]/i,
  },
  {
    name: "supabase-secret-key",
    regex: /sb_secret_[A-Za-z0-9]+/i,
  },
  {
    name: "jwt-like-token",
    regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  },
  {
    name: "private-key-block",
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  },
  {
    name: "generic-api-key-assignment",
    regex: /\b(?:api[_-]?key|access[_-]?token|secretKey)\b\s*[:=]\s*['"`][^'"`\r\n]{12,}['"`]/i,
  },
];

function shouldSkipFile(filePath) {
  const relative = path.relative(ROOT, filePath);
  if (!relative || relative.startsWith("..")) return true;

  const baseName = path.basename(filePath);
  if (IGNORED_FILES.includes(baseName)) return true;

  if (!FILE_EXTENSIONS.has(path.extname(filePath))) return true;

  const segments = relative.split(path.sep);
  return segments.some((segment) => IGNORED_DIRS.has(segment));
}

function walk(entryPath, collected) {
  if (!fs.existsSync(entryPath)) return;
  const stats = fs.statSync(entryPath);

  if (stats.isDirectory()) {
    const baseName = path.basename(entryPath);
    if (IGNORED_DIRS.has(baseName)) return;

    for (const child of fs.readdirSync(entryPath)) {
      walk(path.join(entryPath, child), collected);
    }
    return;
  }

  if (!shouldSkipFile(entryPath)) {
    collected.push(entryPath);
  }
}

function scanFile(filePath) {
  const relative = path.relative(ROOT, filePath);
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const findings = [];

  lines.forEach((line, index) => {
    for (const rule of RULES) {
      if (rule.regex.test(line)) {
        findings.push(`${relative}:${index + 1} [${rule.name}]`);
      }
    }
  });

  return findings;
}

const files = [];
TARGETS.forEach((target) => walk(path.join(ROOT, target), files));

const findings = files.flatMap((filePath) => scanFile(filePath));

if (findings.length > 0) {
  console.error("Potential hardcoded secrets detected:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log("No hardcoded secret patterns detected in scanned files.");
}
