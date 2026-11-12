// Conexão com o banco.
// - Com DATABASE_URL (Render) usa PostgreSQL real com a lib `pg`.
// - Sem DATABASE_URL (teste local / desenvolvimento) cai para o pg-mem,
//   um PostgreSQL em memória, aplicando schema.sql + seed.sql na largada.
//   Assim `npm start` funciona sem instalar o Postgres.
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

function buildPool() {
  if (connectionString) {
    // O Render exige SSL para conexões externas. Para conexão interna
    // (web service → banco no mesmo projeto), SSL com rejectUnauthorized
    // false também funciona sem problemas.
    const ssl =
      process.env.PGSSL === 'false'
        ? false
        : { rejectUnauthorized: false };
    return new Pool({ connectionString, ssl });
  }

  // Fallback local: PostgreSQL em memória com os dados do jogo.
  // eslint-disable-next-line global-require
  const { newDb } = require('pg-mem');
  const db = newDb();

  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  const seed = fs.readFileSync(path.join(__dirname, '..', 'db', 'seed.sql'), 'utf8');
  db.public.none(schema);
  db.public.none(seed);
  console.log('⚠️  DATABASE_URL ausente — usando banco em memória (pg-mem) para demonstração local.');

  const { Pool: MemPool } = db.adapters.createPg();
  return new MemPool();
}

const pool = buildPool();

module.exports = { pool };
