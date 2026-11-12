-- ============================================================
-- SANDMAN — Banco de Dados do Jogo
-- Schema PostgreSQL (versão 1.0)
--
-- Organização:
--   1. game_config   → configurações gerais do jogo (chave/valor)
--   2. chapters      → os 5 capítulos da campanha
--   3. characters    → personagens
--   4. mechanics     → mecânicas (movimento, combate, recursos)
--   5. enemies       → padrões de inimigos
--   6. difficulties  → níveis de dificuldade
--   7. controls      → mapa de controles (teclado/controle)
--   8. checkpoints   → checkpoints (início de capítulo e fogueiras)
--   9. memories      → itens narrativos que liberam flashbacks
-- ============================================================

BEGIN;

-- ── 1. Configurações gerais ──────────────────────────────────
CREATE TABLE IF NOT EXISTS game_config (
    chave  TEXT PRIMARY KEY,
    valor  TEXT NOT NULL
);

-- ── 2. Capítulos ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chapters (
    id             SERIAL PRIMARY KEY,
    numero         INTEGER NOT NULL UNIQUE CHECK (numero BETWEEN 1 AND 5),
    titulo         TEXT NOT NULL,
    sinopse        TEXT NOT NULL,
    mecanica_nova  TEXT NOT NULL
);

-- ── 3. Personagens ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS characters (
    id          SERIAL PRIMARY KEY,
    nome        TEXT NOT NULL UNIQUE,
    papel       TEXT NOT NULL,              -- protagonista, motivação, antagonista, aliados...
    descricao   TEXT NOT NULL
);

-- ── 4. Mecânicas ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mechanics (
    id                  SERIAL PRIMARY KEY,
    categoria           TEXT NOT NULL CHECK (categoria IN ('movimento', 'combate', 'recurso')),
    nome                TEXT NOT NULL UNIQUE,
    descricao           TEXT NOT NULL,
    desbloqueio_capitulo INTEGER REFERENCES chapters(numero)  -- NULL = disponível desde o início
);

-- ── 5. Inimigos (padrões de comportamento) ───────────────────
CREATE TABLE IF NOT EXISTS enemies (
    id        SERIAL PRIMARY KEY,
    nome      TEXT NOT NULL UNIQUE,         -- patrulha, investida, ataque à distância
    padrao    TEXT NOT NULL,
    descricao TEXT NOT NULL
);

-- ── 6. Difficultades ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS difficulties (
    id        SERIAL PRIMARY KEY,
    nome      TEXT NOT NULL UNIQUE,
         -- História, Normal, Desafio
    descricao TEXT NOT NULL
);

-- ── 7. Controles ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS controls (
    id        SERIAL PRIMARY KEY,
    acao      TEXT NOT NULL UNIQUE,
    teclado   TEXT NOT NULL,
    control  TEXT NOT NULL,
    ordem    INTEGER NOT NULL DEFAULT 0
);

-- ── 8. Checkpoints ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkpoints (
    id           SERIAL PRIMARY KEY,
    tipo         TEXT NOT NULL CHECK (tipo IN ('capitulo', 'fogueira')),
    descricao    TEXT NOT NULL,
    capitulo_id  INTEGER REFERENCES chapters(id)
);

-- ── 9. Memórias (itens narrativos → flashbacks) ──────────────
-- Tabela criada vazia de propósito: as memórias específicas ainda
-- não foram escritas no design doc. Preencher conforme o roteiro
-- dos flashbacks for definido (próximo passo do plano).
CREATE TABLE IF NOT EXISTS memories (
    id           SERIAL PRIMARY KEY,
    nome         TEXT NOT NULL UNIQUE,
    descricao    TEXT NOT NULL,
    capitulo_id  INTEGER REFERENCES chapters(id)
);

COMMIT;
