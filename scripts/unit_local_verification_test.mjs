// Exercise the real verifier with child processes: skipped and timed-out checks must never count as passes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runLocalSuites } from './verify_local_all.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-verifier-'));
fs.mkdirSync(path.join(root, 'scripts'));
try {
  for (const [name, source] of Object.entries({
    passed: "console.log('2 passed, 0 failed')",
    skipped: "console.log('SKIP — browser unavailable'); process.exit(3)",
    legacy_skip: "console.log('SKIP — browser unavailable'); console.log('0 passed, 0 failed')",
    failed: "console.error('assertion failed'); process.exit(1)",
    hung: 'setInterval(() => {}, 1000)',
  })) fs.writeFileSync(path.join(root, 'scripts', `${name}.mjs`), source);
  const lines = [];
  const result = runLocalSuites(['passed', 'skipped', 'legacy_skip', 'failed', 'hung'], { root, timeoutMs: 500, log: (line) => lines.push(line) });
  assert.equal(result.passed, 1, 'only the completed successful suite counts as passed');
  assert.equal(result.skipped, 2, 'both explicit and legacy skips remain visible');
  assert.equal(result.failed, 2, 'an assertion failure and a timeout both block verification');
  assert(lines.some((line) => /^TIMEOUT\s+hung/.test(line)), 'timeout is distinguished from a normal test failure');
  assert(!lines.some((line) => /^PASS\s+(skipped|legacy_skip)/.test(line)), 'a skipped suite never receives a PASS label');
  console.log('5 passed, 0 failed');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
