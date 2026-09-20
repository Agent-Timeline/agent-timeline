import { spawnSync } from 'node:child_process';
const mode = process.argv[2];
if (!['fixed', 'buggy'].includes(mode)) {
  console.error('Usage: node scripts/verify.mjs fixed|buggy');
  process.exit(2);
}
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--grep', 'same late-result scenario'], {
  stdio: 'inherit', env: { ...process.env, AGENT_TIMELINE_VERIFY: mode }
});
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
