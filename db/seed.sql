-- ============================================================
-- SANDMAN — Seed (dados reais extraídos do PLANO-DO-JOGO.md)
-- Seguro para rodar mais de uma vez (limpa e reinsere).
-- ============================================================

BEGIN;

-- Limpa na ordem segura para as chaves estrangeiras
DELETE FROM memories;
DELETE FROM checkpoints;
DELETE FROM controls;
DELETE FROM difficulties;
DELETE FROM enemies;
DELETE FROM mechanics;
DELETE FROM characters;
DELETE FROM chapters;
DELETE FROM game_config;

-- 1. Configurações gerais (seções 1, 9, 10 e 11 do plano)
INSERT INTO game_config (chave, valor) VALUES
    ('titulo_provisorio', 'Sandman'),
    ('genero', 'Ação-aventura 2D (plataforma + combate leve)'),
    ('tema', 'Vingança e reencontro familiar em contexto de colonização'),
    ('plataforma', 'Navegador (desktop e mobile com controles na tela)'),
    ('tecnologia', 'HTML + CSS + JavaScript/TypeScript, Canvas 2D'),
    ('modo', 'Um jogador, narrativa linear'),
    ('publico', '14+ anos, fãs de jogos indie narrativos'),
    ('duracao_alvo_min', '45'),
    ('duracao_alvo_max', '90'),
    ('idioma', 'Português (com opção de inglês depois)'),
    ('resolucao_interna', '320x180'),
    ('tile_size', '16x16'),
    ('coracaoes', '3'),
    ('salvamento', 'localStorage (local, sem conta)'),
    ('vitoria', 'Concluir o capítulo 5'),
    ('derrota', 'Não há game over permanente'),
    ('morte', 'Reinicia no último checkpoint, sem perda de progresso narrativo');

-- 2. Capítulos (seção 5 do plano)
INSERT INTO chapters (numero, titulo, sinopse, mecanica_nova) VALUES
    (1, 'A Aldeia', 'Apresentação da rotina, da família e do ataque', 'Movimento, pulo, esconder-se'),
    (2, 'As Cinzas', 'Sandman sobrevive sozinho, aprende a caçar', 'Combate básico, arco'),
    (3, 'O Treino', 'Anos de preparação, provas dos anciãos', 'Esquiva, contra-ataque, escalada'),
    (4, 'A Trilha', 'Viagem por floresta, rio e acampamentos inimigos', 'Furtividade, armadilhas'),
    (5, 'O Assentamento', 'Invasão do forte, confronto com o líder, resgate', 'Combinação de tudo');

-- 3. Personagens (seção 3 do plano)
INSERT INTO characters (nome, papel, descricao) VALUES
    ('Sandman', 'Protagonista', 'Jovem indígena. Silencioso, determinado, movido por perda e memória. Evolui de sobrevivente a caçador.'),
    ('Família de Sandman', 'Motivação', 'Mãe, pai e irmãos. Aparecem em flashbacks e no resgate final.'),
    ('Colonos portugueses', 'Antagonistas', 'Grupo armado que sequestra e explora. O líder é o alvo final.'),
    ('Anciãos da aldeia', 'Aliados', 'Ensinam habilidades a Sandman durante o treinamento (capítulo 3).');

-- 4. Mecânicas (seções 8.1, 8.2 e 8.3 do plano)
INSERT INTO mechanics (categoria, nome, descricao, desbloqueio_capitulo) VALUES
    ('movimento', 'Correr', 'Correr para os lados', NULL),
    ('movimento', 'Pulo', 'Pulo com altura variável', NULL),
    ('movimento', 'Escalar', 'Escalar superfícies marcadas', 3),
    ('movimento', 'Agachar/Esconder-se', 'Agachar-se em arbustos (furtividade)', NULL),
    ('combate', 'Ataque corpo a corpo', 'Ataque com alcance curto', 2),
    ('combate', 'Esquiva', 'Esquiva com janela de invencibilidade curta', 3),
    ('combate', 'Arco', 'Tiro carregado, munição limitada', 2),
    ('combate', 'Contra-ataque', 'Revidar após esquiva, aprendido nas provas dos anciãos', 3),
    ('recurso', 'Vida', '3 corações, recuperáveis em fogueiras', NULL),
    ('recurso', 'Resistência', 'Limita esquiva e escalada', NULL),
    ('recurso', 'Munição', 'Flechas coletadas no cenário', NULL),
    ('recurso', 'Memórias', 'Itens narrativos que liberam flashbacks', NULL);

-- 5. Inimigos — padrões de comportamento (seção 8.2 do plano)
INSERT INTO enemies (nome, padrao, descricao) VALUES
    ('Patrulha', 'patrulha', 'Inimigo que percorre um trajeto fixo; pode ser evitado com furtividade'),
    ('Investida', 'investida', 'Inimigo que avança rapidamente sobre o jogador quando detectado'),
    ('Atirador', 'ataque à distância', 'Inimigo que ataca à distância, mantendo o jogador sob pressão');

-- 6. Dificuldades (seção 9 do plano)
INSERT INTO difficulties (nome, descricao) VALUES
    ('História', 'Dificuldade reduzida para quem quer curtir a narrativa'),
    ('Normal', 'Experiência padrão do jogo'),
    ('Desafio', 'Dificuldade elevada para jogadores experientes');

-- 7. Controles (seção 8.4 do plano)
INSERT INTO controls (acao, teclado, controle, ordem) VALUES
    ('Mover', '← → / A D', 'Analógico/direcional', 1),
    ('Pular', 'Espaço', 'Botão A', 2),
    ('Atacar', 'J ou Z', 'Botão X', 3),
    ('Esquivar', 'K ou X', 'Botão B', 4),
    ('Arco', 'L ou C (segurar)', 'Gatilho', 5),
    ('Pausar', 'Esc', 'Start', 6);

-- 8. Checkpoints (seção 9 do plano: início de cada capítulo e fogueiras)
INSERT INTO checkpoints (tipo, descricao, capitulo_id)
SELECT 'capitulo', 'Início do capítulo ' || numero::text || ' — ' || titulo, id FROM chapters;
INSERT INTO checkpoints (tipo, descricao, capitulo_id)
VALUES ('fogueira', 'Fogueira — recupera 3 corações e serve de checkpoint (posição a definir no design de fases)', NULL);

COMMIT;
