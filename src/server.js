const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — o jogo roda no navegador (GitHub Pages), então a API libera origem.
// Defina CORS_ORIGIN no Render para restringir (ex.: https://seu-usuario.github.io).
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

// Página visual das tabelas (GET / abre o visualizador)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Helper: SELECT com tratamento de erro padronizado
async function query(res, sql, params = []) {
  try {
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro no banco:', err);
    res.status(500).json({ error: 'Erro ao consultar o banco de dados' });
  }
}

// ── Saúde da API (usado pelo Render para health check) ──────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', game: 'Sandman' });
  } catch {
    res.status(503).json({ status: 'banco indisponível' });
  }
});

// ── Índice de rotas ──────────────────────────────────────────
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
      'GET /api/memories',
    ],
  });
});

// ── Conteúdo do jogo ─────────────────────────────────────────
app.get('/api/config', (req, res) =>
  query(res, 'SELECT chave, valor FROM game_config ORDER BY chave'));

app.get('/api/chapters', (req, res) =>
  query(res, 'SELECT numero, titulo, sinopse, mecanica_nova FROM chapters ORDER BY numero'));

app.get('/api/chapters/:numero', (req, res) =>
  query(res, 'SELECT numero, titulo, sinopse, mecanica_nova FROM chapters WHERE numero = $1', [req.params.numero]));

app.get('/api/characters', (req, res) =>
  query(res, 'SELECT nome, papel, descricao FROM characters ORDER BY id'));

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

app.get('/api/memories', (req, res) =>
  query(res, `SELECT m.nome, m.descricao, ch.numero AS capitulo
              FROM memories m LEFT JOIN chapters ch ON ch.id = m.capitulo_id
              ORDER BY m.id`));

// ── Inicialização do banco via HTTP (protegida por token) ────
// Uso único após o primeiro deploy:
//   curl -X POST https://SEU-SERVICO.onrender.com/api/admin/init \
//        -H "Authorization: Bearer SEU_ADMIN_TOKEN"
// Desabilitada se ADMIN_TOKEN não estiver definido no Render.
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
    res.json({ status: 'banco inicializado', tabelas: 'game_config, chapters, characters, mechanics, enemies, difficulties, controls, checkpoints, memories' });
  } catch (err) {
    console.error('Falha ao inicializar:', err);
    res.status(500).json({ error: 'Falha ao inicializar o banco', detalhe: err.message });
  }
});

// ── 404 e erros gerais ───────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada. Veja GET /api' }));

app.listen(PORT, () => {
  console.log(`Sandman API rodando na porta ${PORT}`);
});
