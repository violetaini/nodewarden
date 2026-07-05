import { readFile } from 'node:fs/promises';

const checks = [
  {
    path: 'src/index.ts',
    fragments: [
      'function checkEdgeSecret(request: Request, env: Env): Response | null {',
      "const expected = String(env.EDGE_SECRET || '').trim();",
      "request.headers.get('X-Edge-Secret')",
      'const edgeSecretBlock = checkEdgeSecret(request, env);',
    ],
  },
  {
    path: 'src/types/index.ts',
    fragments: [
      'EDGE_SECRET?: string;',
    ],
  },
  {
    path: 'wrangler.toml',
    fragments: [
      'run_worker_first = true',
    ],
  },
];

const failures = [];
const verified = [];

for (const check of checks) {
  const content = await readFile(check.path, 'utf8');
  for (const fragment of check.fragments) {
    if (!content.includes(fragment)) {
      failures.push(`${check.path}: missing ${JSON.stringify(fragment)}`);
    } else {
      verified.push(`${check.path}: found ${JSON.stringify(fragment)}`);
    }
  }
}

for (const line of verified) {
  console.log(`OK ${line}`);
}

if (failures.length > 0) {
  for (const line of failures) {
    console.error(`FAIL ${line}`);
  }
  process.exit(1);
}

console.log('Local override verification passed.');
