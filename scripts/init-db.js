// Aplica schema.sql + seed.sql no banco apontado por DATABASE_URL.
// Uso:
//   $env:DATABASE_URL="postgresql://..."; npm run db:init
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

(async () => {
  if (!process.env.DATABASE_URL) {
    console.error('Defina a variável DATABASE_URL antes de rodar (veja o README).');
    process.exit(1);
  }
  try {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
    const seed = fs.readFileSync(path.join(__dirname, '..', 'db', 'seed.sql'), 'utf8');
    console.log('Aplicando schema...');
    await pool.query(schema);
    console.log('Inserindo dados do jogo (seed)...');
    await pool.query(seed);
    console.log('✅ Banco do Sandman inicializado com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao inicializar o banco:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
