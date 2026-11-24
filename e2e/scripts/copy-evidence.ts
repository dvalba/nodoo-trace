import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const e2eDir = path.resolve(here, '..');
const repoRoot = path.resolve(e2eDir, '..');
const resultsDir = path.join(e2eDir, 'test-results');
const sprint = process.argv[2] ?? 'sprint-02';
const evidenceRoot = path.join(repoRoot, 'e2e-evidence', sprint);

if (!existsSync(resultsDir)) {
  console.error(`Sin resultados en ${resultsDir}: nada que copiar.`);
  process.exit(1);
}

const testDirs = readdirSync(resultsDir, { withFileTypes: true }).filter((entry) =>
  entry.isDirectory(),
);
if (testDirs.length === 0) {
  console.error(`Sin resultados por test en ${resultsDir}: nada que copiar.`);
  process.exit(1);
}

for (const entry of testDirs) {
  const target = path.join(evidenceRoot, entry.name);
  mkdirSync(target, { recursive: true });
  cpSync(path.join(resultsDir, entry.name), target, { recursive: true });
  console.log(`e2e-evidence/${sprint}/${entry.name}/`);
}
