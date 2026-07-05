import { readFile, writeFile } from 'node:fs/promises';

const updates = [
  updateIndexTs,
  updateTypesTs,
  updateWranglerToml,
];

let changedAny = false;

for (const update of updates) {
  const changed = await update();
  changedAny = changedAny || changed;
}

if (changedAny) {
  console.log('Applied local overrides.');
} else {
  console.log('Local overrides already present.');
}

async function readText(path) {
  return readFile(path, 'utf8');
}

async function writeText(path, content) {
  await writeFile(path, content, 'utf8');
}

function detectEol(content) {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

function replaceOnce(content, search, replacement, label) {
  if (!content.includes(search)) {
    throw new Error(`Could not find expected marker for ${label}.`);
  }

  return content.replace(search, replacement);
}

async function updateIndexTs() {
  const path = 'src/index.ts';
  let content = await readText(path);
  const eol = detectEol(content);
  let changed = false;

  if (!content.includes('function checkEdgeSecret(request: Request, env: Env): Response | null {')) {
    const marker = `  await dbInitPromise;${eol}}${eol}`;
    const injection = [
      `function checkEdgeSecret(request: Request, env: Env): Response | null {`,
      `  const expected = String(env.EDGE_SECRET || '').trim();`,
      ``,
      `  if (!expected) {`,
      `    return new Response('EDGE_SECRET not configured', {`,
      `      status: 500,`,
      `      headers: {`,
      `        'Content-Type': 'text/plain; charset=utf-8',`,
      `        'Cache-Control': 'no-store',`,
      `      },`,
      `    });`,
      `  }`,
      ``,
      `  const actual = String(request.headers.get('X-Edge-Secret') || '').trim();`,
      ``,
      `  if (actual !== expected) {`,
      `    return new Response('Forbidden', {`,
      `      status: 403,`,
      `      headers: {`,
      `        'Content-Type': 'text/plain; charset=utf-8',`,
      `        'Cache-Control': 'no-store',`,
      `      },`,
      `    });`,
      `  }`,
      ``,
      `  return null;`,
      `}`,
      ``,
    ].join(eol);
    content = replaceOnce(content, marker, `${marker}${injection}`, 'src/index.ts edge secret helper');
    changed = true;
  }

  const fetchBlock = [
    `    const edgeSecretBlock = checkEdgeSecret(request, env);`,
    `    if (edgeSecretBlock) {`,
    `      return edgeSecretBlock;`,
    `    }`,
    ``,
  ].join(eol);

  if (!content.includes(`const edgeSecretBlock = checkEdgeSecret(request, env);`)) {
    const marker = `  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {${eol}    void ctx;${eol}`;
    content = replaceOnce(content, marker, `${marker}${fetchBlock}`, 'src/index.ts fetch guard');
    changed = true;
  }

  if (changed) {
    await writeText(path, content);
  }

  return changed;
}

async function updateTypesTs() {
  const path = 'src/types/index.ts';
  let content = await readText(path);
  const eol = detectEol(content);

  if (content.includes('EDGE_SECRET?: string;')) {
    return false;
  }

  const marker = `  JWT_SECRET: string;${eol}`;
  content = replaceOnce(content, marker, `${marker}  EDGE_SECRET?: string;${eol}`, 'src/types/index.ts EDGE_SECRET binding');
  await writeText(path, content);
  return true;
}

async function updateWranglerToml() {
  const path = 'wrangler.toml';
  let content = await readText(path);

  if (content.includes('run_worker_first = true')) {
    return false;
  }

  content = replaceOnce(
    content,
    'run_worker_first = false',
    'run_worker_first = true',
    'wrangler.toml run_worker_first'
  );
  await writeText(path, content);
  return true;
}
