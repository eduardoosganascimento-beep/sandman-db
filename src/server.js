const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS — o front (GitHub Pages / Render) consome a API via HTTP ──
// Defina CORS_ORIGIN no Render para restringir (ex.: https://SEU-USUARIO.github.io).
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// PWA: o service worker e o manifest nunca podem vir do cache do navegador.
app.use((req, res, next) => {
  if (req.path === '/sw.js' || req.path === '/manifest.json') {
    res.set('Cache-Control', 'no-cache, must-revalidate');
  }
  next();
});

app.use(express.json());

// Página visual + PWA (index.html, styles, app.js, manifest, ícones)
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Helpers ────────────────────────────────────────────────────
async function query(res, sql, params = []) {
  try {
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro no banco:', err);
    res.status(500).json({ error: 'Erro ao consultar o banco de dados' });
  }
}

// Executa a rota e traduz os erros mais comuns do Postgres em HTTP.
async function run(res, fn) {
  try {
    await fn();
  } catch (err) {
    const code = err && err.code;
    const message = String(err && err.message || '');
    if (code === '23505' || /duplicate key|unique/i.test(message)) {
      return res.status(409).json({ error: 'Já existe um registro com esse nome' });
    }
    if (code === '23503' || /foreign key/i.test(message)) {
      return res.status(400).json({ error: 'Capítulo informado não existe' });
    }
    if (code === '23502' || /not-null/i.test(message)) {
      return res.status(400).json({ error: 'Campos obrigatórios não preenchidos' });
    }
    console.error('Erro na operação:', err);
    res.status(500).json({ error: 'Erro ao gravar no banco de dados' });
  }
}

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Validação dos payloads de cadastro/edição.
function validate(res, body, required) {
  for (const field of required) {
    if (!text(body[field])) {
      badRequest(res, `O campo "${field}" é obrigatório`);
      return false;
    }
  }
  return true;
}

function chapterId(body) {
  if (body.capitulo_id === undefined || body.capitulo_id === null || body.capitulo_id === '') return null;
  const id = Number(body.capitulo_id);
  return Number.isInteger(id) && id > 0 ? id : NaN;
}

// ── Saúde da API (health check do Render) ──────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', game: 'Sandman' });
  } catch {
    res.status(503).json({ status: 'banco indisponível' });
  }
});

// ── Índice de rotas ────────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({
    game: 'Sandman',
    endpoints: [
      'GET /api/config',
      'GET /api/chapters',
      'GET /api/chapters/:numero',
      'GET /api/characters',
      'GET /api/mechanics?categoria=movimento|combate|recurso',
      'GET /api/enemies',
      'GET /api/difficulties',
      'GET /api/controls',
      'GET /api/checkpoints',
      'GET /api/memories?q=busca',
      'GET|POST /api/memories',
      'GET|PUT|DELETE /api/memories/:id',
      'GET|POST /api/characters',
      'GET|PUT|DELETE /api/characters/:id',
      'POST /api/admin/init',
    ],
  });
});

// ── Leitura: conteúdo do jogo ──────────────────────────────────
app.get('/api/config', (req, res) =>
  query(res, 'SELECT chave, valor FROM game_config ORDER BY chave'));

app.get('/api/chapters', (req, res) =>
  query(res, 'SELECT id, numero, titulo, sinopse, mecanica_nova FROM chapters ORDER BY numero'));

app.get('/api/chapters/:numero', (req, res) =>
  query(res, 'SELECT id, numero, titulo, sinopse, mecanica_nova FROM chapters WHERE numero = $1', [req.params.numero]));

app.get('/api/characters', async (req, res) => {
  const q = text(req.query.q);
  if (q) {
    return query(res,
      `SELECT id, nome, papel, descricao FROM characters
       WHERE nome ILIKE $1 OR papel ILIKE $1 OR descricao ILIKE $1
       ORDER BY id`, [`%${q}%`]);
  }
  query(res, 'SELECT id, nome, papel, descricao FROM characters ORDER BY id');
});

app.get('/api/mechanics', (req, res) => {
  const { categoria } = req.query;
  if (categoria) {
    return query(res,
      'SELECT categoria, nome, descricao, desbloqueio_capitulo FROM mechanics WHERE categoria = $1 ORDER BY id',
      [categoria]);
  }
  return query(res,
    'SELECT categoria, nome, descricao, desbloqueio_capitulo FROM mechanics ORDER BY categoria, id');
});

app.get('/api/enemies', (req, res) =>
  query(res, 'SELECT nome, padrao, descricao FROM enemies ORDER BY id'));

app.get('/api/difficulties', (req, res) =>
  query(res, 'SELECT nome, descricao FROM difficulties ORDER BY id'));

app.get('/api/controls', (req, res) =>
  query(res, 'SELECT acao, teclado, controle, ordem FROM controls ORDER BY ordem'));

app.get('/api/checkpoints', (req, res) =>
  query(res, `SELECT c.tipo, c.descricao, ch.numero AS capitulo
              FROM checkpoints c LEFT JOIN chapters ch ON ch.id = c.capitulo_id
              ORDER BY c.id`));

// ── CRUD: memórias (consulta com busca) ────────────────────────
const MEMORY_COLUMNS = 'm.id, m.nome, m.descricao, m.capitulo_id, ch.numero AS capitulo';
const MEMORY_FROM = 'FROM memories m LEFT JOIN chapters ch ON ch.id = m.capitulo_id';

app.get('/api/memories', async (req, res) => {
  const q = text(req.query.q);
  if (q) {
    return query(res,
      `SELECT ${MEMORY_COLUMNS} ${MEMORY_FROM}
       WHERE m.nome ILIKE $1 OR m.descricao ILIKE $1
       ORDER BY m.id`, [`%${q}%`]);
  }
  query(res, `SELECT ${MEMORY_COLUMNS} ${MEMORY_FROM} ORDER BY m.id`);
});

app.get('/api/memories/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${MEMORY_COLUMNS} ${MEMORY_FROM} WHERE m.id = $1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Memória não encontrada' });
  res.json(rows[0]);
});

app.post('/api/memories', (req, res) => {
  const body = req.body || {};
  if (!validate(res, body, ['nome', 'descricao'])) return;
  const cap = chapterId(body);
  if (Number.isNaN(cap)) return badRequest(res, 'capitulo_id inválido');
  run(res, async () => {
    const { rows } = await pool.query(
      `INSERT INTO memories (nome, descricao, capitulo_id)
       VALUES ($1, $2, $3) RETURNING id, nome, descricao, capitulo_id`,
      [text(body.nome), text(body.descricao), cap]);
    res.status(201).json(rows[0]);
  });
});

app.put('/api/memories/:id', (req, res) => {
  const body = req.body || {};
  if (!validate(res, body, ['nome', 'descricao'])) return;
  const cap = chapterId(body);
  if (Number.isNaN(cap)) return badRequest(res, 'capitulo_id inválido');
  run(res, async () => {
    const { rows } = await pool.query(
      `UPDATE memories SET nome = $1, descricao = $2, capitulo_id = $3
       WHERE id = $4 RETURNING id, nome, descricao, capitulo_id`,
      [text(body.nome), text(body.descricao), cap, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Memória não encontrada' });
    res.json(rows[0]);
  });
});

app.delete('/api/memories/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM memories WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Memória não encontrada' });
    res.json({ status: 'removido', id: Number(req.params.id) });
  } catch (err) {
    console.error('Erro ao remover:', err);
    res.status(500).json({ error: 'Erro ao remover o registro' });
  }
});

// ── CRUD: personagens ──────────────────────────────────────────
app.get('/api/characters/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nome, papel, descricao FROM characters WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Personagem não encontrado' });
  res.json(rows[0]);
});

app.post('/api/characters', (req, res) => {
  const body = req.body || {};
  if (!validate(res, body, ['nome', 'papel', 'descricao'])) return;
  run(res, async () => {
    const { rows } = await pool.query(
      `INSERT INTO characters (nome, papel, descricao)
       VALUES ($1, $2, $3) RETURNING id, nome, papel, descricao`,
      [text(body.nome), text(body.papel), text(body.descricao)]);
    res.status(201).json(rows[0]);
  });
});

app.put('/api/characters/:id', (req, res) => {
  const body = req.body || {};
  if (!validate(res, body, ['nome', 'papel', 'descricao'])) return;
  run(res, async () => {
    const { rows } = await pool.query(
      `UPDATE characters SET nome = $1, papel = $2, descricao = $3
       WHERE id = $4 RETURNING id, nome, papel, descricao`,
      [text(body.nome), text(body.papel), text(body.descricao), req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Personagem não encontrado' });
    res.json(rows[0]);
  });
});

app.delete('/api/characters/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM characters WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Personagem não encontrado' });
    res.json({ status: 'removido', id: Number(req.params.id) });
  } catch (err) {
    console.error('Erro ao remover:', err);
    res.status(500).json({ error: 'Erro ao remover o registro' });
  }
});

// ── Inicialização manual (protegida por token) ─────────────────
app.post('/api/admin/init', async (req, res) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(403).json({ error: 'ADMIN_TOKEN não configurado — endpoint desabilitado' });
  if (req.headers.authorization !== `Bearer ${token}`) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  try {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
    const seed = fs.readFileSync(path.join(__dirname, '..', 'db', 'seed.sql'), 'utf8');
    await pool.query(schema);
    await pool.query(seed);
    res.json({ status: 'banco inicializado' });
  } catch (err) {
    console.error('Falha ao inicializar:', err);
    res.status(500).json({ error: 'Falha ao inicializar o banco', detalhe: err.message });
  }
});

// ── Inicialização automática ───────────────────────────────────
// No primeiro boot (banco vazio) aplica schema + seed. Ambos os arquivos
// usam IF NOT EXISTS / reinsert seguro, então rodar de novo não duplica dados.
async function tableExists(name) {
  try {
    await pool.query(`SELECT 1 FROM ${name} LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

async function ensureDatabase() {
  try {
    if (!(await tableExists('chapters'))) {
      console.log('Banco vazio — aplicando schema e dados do jogo...');
      const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
      const seed = fs.readFileSync(path.join(__dirname, '..', 'db', 'seed.sql'), 'utf8');
      await pool.query(schema);
      await pool.query(seed);
      console.log('✅ Banco inicializado automaticamente.');
      return;
    }
    const count = await pool.query('SELECT COUNT(*)::int AS n FROM chapters');
    if (count.rows[0].n === 0) {
      const seed = fs.readFileSync(path.join(__dirname, '..', 'db', 'seed.sql'), 'utf8');
      await pool.query(seed);
      console.log('✅ Seed aplicado.');
      return;
    }
    console.log('Banco já inicializado.');
  } catch (err) {
    console.error('Falha na inicialização automática do banco:', err.message);
  }
}

// ── 404 e servidor ─────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada. Veja GET /api' }));

app.listen(PORT, async () => {
  console.log(`Sandman API rodando na porta ${PORT}`);
  await ensureDatabase();
});
