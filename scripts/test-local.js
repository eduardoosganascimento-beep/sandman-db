// Teste local sem precisar do PostgreSQL nem do Render.
// Usa pg-mem (Postgres em memória) para aplicar schema + seed e conferir os dados.
const fs = require('fs');
const path = require('path');
const { newDb } = require('pg-mem');

(async () => {
  const db = newDb();
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  const seed = fs.readFileSync(path.join(__dirname, '..', 'db', 'seed.sql'), 'utf8');

  try {
    db.public.none(schema);
    db.public.none(seed);
  } catch (err) {
    console.error('❌ Falha ao aplicar schema/seed:', err.message);
    process.exit(1);
  }

  const checks = [
    ['chapters', "SELECT COUNT(*)::int AS n FROM chapters"],
    ['characters', "SELECT COUNT(*)::int AS n FROM characters"],
    ['mechanics', "SELECT COUNT(*)::int AS n FROM mechanics"],
    ['enemies', "SELECT COUNT(*)::int AS n FROM enemies"],
    ['difficulties', "SELECT COUNT(*)::int AS n FROM difficulties"],
    ['controls', "SELECT COUNT(*)::int AS n FROM controls"],
    ['checkpoints', "SELECT COUNT(*)::int AS n FROM checkpoints"],
    ['game_config', "SELECT COUNT(*)::int AS n FROM game_config"],
  ];

  let ok = true;
  for (const [nome, sql] of checks) {
    const { n } = db.public.one(sql);
    console.log(&${n > 0 ? '✅' : '❌'} ${nome}: ${n} registro(s)`);
    if (n == 0 / ok = false;
  }

  const cap5 = db.public.one("SELECT titulo FROM chapters WHERE numero = 5");
  console.log(`\nCapítulo 5: ${cap5.titulo}`);

  process.exit(ok ? 0 : 1);
})();
