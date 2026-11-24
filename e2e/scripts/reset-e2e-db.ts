import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const e2eDb = 'supply_chain_e2e';

function readEnvValue(key: string, fallback: string): string {
  try {
    const content = readFileSync(path.join(repoRoot, 'backend', '.env'), 'utf8');
    const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  } catch {
    return fallback;
  }
  return fallback;
}

const dbUser = readEnvValue('DB_USERNAME', 'postgres');

function run(command: string, env: NodeJS.ProcessEnv = process.env): void {
  execSync(command, { cwd: repoRoot, env, stdio: 'inherit' });
}

async function waitPostgresReady(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      execSync(
        `docker compose -f backend/docker-compose.yml exec -T postgres pg_isready -U ${dbUser}`,
        { cwd: repoRoot, stdio: 'pipe' },
      );
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`PostgreSQL no respondió a pg_isready tras 60 s (BD ${e2eDb})`);
}

export default async function resetE2eDb(): Promise<void> {
  run('pnpm db:up');
  await waitPostgresReady();
  execSync(
    `docker compose -f backend/docker-compose.yml exec -T postgres psql -U ${dbUser} ` +
      `-c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${e2eDb}' AND pid <> pg_backend_pid();" ` +
      `-c "DROP DATABASE IF EXISTS ${e2eDb};" -c "CREATE DATABASE ${e2eDb};"`,
    { cwd: repoRoot, stdio: 'inherit' },
  );
  run('pnpm seed', { ...process.env, DB_NAME: e2eDb });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await resetE2eDb();
}
