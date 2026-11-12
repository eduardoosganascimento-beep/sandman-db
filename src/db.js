const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

// O Render exige SSL para conexões externas. Para conexão interna
// (web service → banco no mesmo projeto), o SSL com rejectUnauthorized
// false também funciona sem problemas.
const ssl =
  process.env.PGSSL === 'false'
    ? false
    : { rejectUnauthorized: false };

const pool = new Pool({ connectionString, ssl });

module.exports = { pool };
