// Smoke test: sobe o servidor, exercita páginas PWA + CRUD e encerra.
// Uso: node scripts/smoke-test.js
const { spawn } = require('child_process');

const BASE = 'http://127.0.0.1:3111';
const results = [];

async function t(name, fn) {
  try {
    const info = await fn();
    results.push(['OK  ', name, info]);
  } catch (err) {
    results.push(['ERRO', name, err.message]);
  }
}

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  return { res, text };
}

async function main() {
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: __dirname + '/..',
    env: { ...process.env, PORT: '3111' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });

  // espera o /health responder
  let up = false;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + '/health', { signal: AbortSignal.timeout(1000) });
      if (r.ok) { up = true; break; }
    } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!up) {
    console.log('❌ Servidor não subiu.\n' + log);
    server.kill();
    process.exit(1);
  }

  await t('GET /health', async () => (await req('/health')).text);
  await t('GET / (tem manifest + link CRUD + SW)', async () => {
    const { res, text } = await req('/');
    if (res.status !== 200) throw new Error('status ' + res.status);
    if (!text.includes('manifest.json')) throw new Error('sem manifest');
    if (!text.includes('crud.html')) throw new Error('sem link CRUD');
    if (!text.includes('serviceWorker')) throw new Error('sem registro de SW');
    return '200, 3 marcações PWA/CRUD presentes';
  });
  await t('GET /crud.html', async () => {
    const { res, text } = await req('/crud.html');
    if (res.status !== 200) throw new Error('status ' + res.status);
    if (!text.includes('CRUD')) throw new Error('conteúdo inesperado');
    return `200, ${text.length} bytes`;
  });
  await t('GET /manifest.json (no-cache)', async () => {
    const { res, text } = await req('/manifest.json');
    const j = JSON.parse(text);
    if (!j.name || !j.icons?.length) throw new Error('manifest incompleto');
    return `200, ${j.name}, ${j.icons.length} ícones, cache=${res.headers.get('cache-control')}`;
  });
  await t('GET /sw.js (no-cache)', async () => {
    const { res } = await req('/sw.js');
    if (res.status !== 200) throw new Error('status ' + res.status);
    return `200, cache=${res.headers.get('cache-control')}`;
  });
  await t('sw.js: todos os arquivos do SHELL existem', async () => {
    const { text } = await req('/sw.js');
    const block = text.match(/const SHELL = \[([\s\S]*?)\];/);
    if (!block) throw new Error('bloco SHELL não encontrado');
    const files = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const faltando = [];
    for (const f of files) {
      const r = await fetch(BASE + f, { method: 'HEAD' });
      if (!r.ok) faltando.push(`${f} (${r.status})`);
    }
    if (faltando.length) throw new Error('faltando: ' + faltando.join(', '));
    return `${files.length} arquivos no cache do app shell`;
  });
  await t('GET /icons/icon-512.png', async () => {
    const { res } = await req('/icons/icon-512.png');
    if (res.status !== 200) throw new Error('status ' + res.status);
    return '200';
  });

  // ── CRUD ──
  let createdId = null;
  await t('POST /api/memories (cadastro)', async () => {
    const { res, text } = await req('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Flashback de Teste', descricao: 'Criado pelo smoke test', capitulo_id: 1 }),
    });
    if (res.status !== 201) throw new Error('status ' + res.status + ' ' + text);
    createdId = JSON.parse(text).id;
    return `201, id=${createdId}`;
  });
  await t('GET /api/memories?q=Flashback (busca)', async () => {
    const rows = JSON.parse((await req('/api/memories?q=Flashback')).text);
    if (!rows.length) throw new Error('não achou o registro');
    return `${rows.length} registro(s)`;
  });
  await t('PUT /api/memories/:id (edição)', async () => {
    const { res, text } = await req(`/api/memories/${createdId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Flashback Editado', descricao: 'Editado pelo smoke test', capitulo_id: 2 }),
    });
    if (res.status !== 200) throw new Error('status ' + res.status + ' ' + text);
    return '200, nome atualizado';
  });
  await t('POST duplicado → 409', async () => {
    const { res } = await req('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Flashback Editado', descricao: 'x' }),
    });
    if (res.status !== 409) throw new Error('status ' + res.status + ' (esperado 409)');
    return '409 Conflict';
  });
  await t('POST sem campo obrigatório → 400', async () => {
    const { res } = await req('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Só nome' }),
    });
    if (res.status !== 400) throw new Error('status ' + res.status + ' (esperado 400)');
    return '400 Bad Request';
  });
  await t('DELETE /api/memories/:id (exclusão)', async () => {
    const { res, text } = await req(`/api/memories/${createdId}`, { method: 'DELETE' });
    if (res.status !== 200) throw new Error('status ' + res.status);
    return '200, ' + text;
  });
  await t('DELETE inexistente → 404', async () => {
    const { res } = await req('/api/memories/99999', { method: 'DELETE' });
    if (res.status !== 404) throw new Error('status ' + res.status + ' (esperado 404)');
    return '404 Not Found';
  });
  await t('GET /api/characters (CRUD de personagens)', async () => {
    const rows = JSON.parse((await req('/api/characters')).text);
    if (!rows.length) throw new Error('sem personagens');
    return `${rows.length} personagem(ns)`;
  });
  await t('POST /api/characters', async () => {
    const { res, text } = await req('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'NPC de Teste', papel: 'guarda', descricao: 'Criado e removido pelo teste' }),
    });
    if (res.status !== 201) throw new Error('status ' + res.status + ' ' + text);
    const id = JSON.parse(text).id;
    await req(`/api/characters/${id}`, { method: 'DELETE' });
    return `201 + DELETE, id=${id}`;
  });

  server.kill();
  await new Promise((r) => setTimeout(r, 300));

  const falhas = results.filter((r) => r[0] === 'ERRO').length;
  for (const [st, name, info] of results) {
    console.log(`${st === 'OK  ' ? '✅' : '❌'} ${name} → ${info}`);
  }
  console.log(`\n${results.length - falhas}/${results.length} verificações OK`);
  if (log.includes('Erro')) console.log('⚠️  log do servidor contém erros:\n' + log);
  process.exit(falhas ? 1 : 0);
}

main();
