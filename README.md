# 🗄️ Sandman DB — Banco de Dados do Jogo

## 🔗 Acesse agora

| O que | Link |
|---|---|
| 👁️ **Ver as tabelas visualmente** | **https://sandman-api.onrender.com/** |
| 🔌 API (JSON) | https://sandman-api.onrender.com/api |
| 📐 Plano do banco (diagrama ER) | [docs/PLANO-BANCO.md](docs/PLANO-BANCO.md) |
| 💻 Código-fonte | https://github.com/eduardoosganascimento-beep/sandman-db |

> A página visual mostra o diagrama das 9 tabelas e os dados de cada uma.
> O plano gratuito do Render "dorme" após alguns minutos sem acesso — o
> primeiro carregamento pode levar até ~50 segundos.

Banco de dados **PostgreSQL** + **API REST** com todo o conteúdo do jogo
**Sandman** (do `PLANO-DO-JOGO.md`), hospedado no **Render**.

O jogo (que roda no navegador) consome esses dados via HTTP em vez de
deixar tudo fixo no código.

## 📦 O que tem no banco

| Tabela | Conteúdo |
|---|---|
| `game_config` | Configurações gerais (nome, gênero, duração, resoluções, regras de morte etc.) |
| `chapters` | Os 5 capítulos (título, sinopse, mecânica nova de cada um) |
| `characters` | Personagens (Sandman, família, colonos, anciãos) |
| `mechanics` | Mecânicas por categoria: `movimento`, `combate`, `recurso` |
| `enemies` | Padrões de inimigos: patrulha, investida, ataque à distância |
| `difficulties` | História, Normal, Desafio |
| `controls` | Mapa de controles: teclado e controle |
| `checkpoints` | Início de cada capítulo + fogueiras |
| `memories` | Itens narrativos que liberam flashbacks (tabela pronta, vazia por enquanto) |

## 🌐 Endpoints da API

| Rota | Retorna |
|---|---|
| `GET /` | **Página visual** com diagrama e tabelas formatadas |
| `GET /health` | Status da API e do banco |
| `GET /api` | Lista de endpoints |
| `GET /api/config` | Configurações gerais |
| `GET /api/chapters` · `GET /api/chapters/:numero` | Capítulos |
| `GET /api/characters` | Personagens |
| `GET /api/mechanics?categoria=combate` | Mecânicas (filtro opcional) |
| `GET /api/enemies` | Inimigos |
| `GET /api/difficulties` | Dificuldades |
| `GET /api/controls` | Controles |
| `GET /api/checkpoints` | Checkpoints |
| `GET /api/memories` | Memórias/flashbacks |
| `POST /api/admin/init` | (Re)aplica schema + seed — exige `Authorization: Bearer $ADMIN_TOKEN` |

## 🚀 Como hospedar no Render (via web)

1. Faça fork/push deste repositório para o seu GitHub.
2. Acesse https://render.com e faça login (pode entrar com o GitHub).
3. **New + → Blueprint** → selecione o repositório `sandman-db`.
   O Render lê o `render.yaml` e cria automaticamente:
   - um banco **PostgreSQL** (`sandman-db`, plano free), e
   - um **Web Service** (`sandman-api`, plano free) já conectado ao banco.
4. Clique em **Apply** e aguarde o deploy.
5. No serviço `sandman-api`, copie o valor de `ADMIN_TOKEN` na aba
   **Environment** e inicialize o banco **uma única vez**:
   ```bash
   curl -X POST https://SEU-SERVICO.onrender.com/api/admin/init \
        -H "Authorization: Bearer SEU_ADMIN_TOKEN"
   ```
   (No Windows PowerShell: `Invoke-RestMethod -Method Post -Uri ... -Headers @{Authorization="Bearer SEU_ADMIN_TOKEN"}`)
6. Pronto! Teste: `https://SEU-SERVICO.onrender.com/api/chapters`

> ⚠️ **Plano free do PostgreSQL no Render:** o banco gratuito expira após
> 90 dias. Para manter para sempre, faça upgrade para o plano pago ou use um
> Postgres externo gratuito (ex.: Neon, Supabase) — basta trocar `DATABASE_URL`.

## 💻 Rodando localmente

```bash
npm install
# Teste sem banco real (usa Postgres em memória):
npm test
# Para rodar a API de verdade, aponte para um Postgres:
$env:DATABASE_URL="postgresql://usuario:senha@host:5432/sandman"
npm run db:init   # cria as tabelas e insere os dados do jogo
npm start         # API em http://localhost:3000
```

## 🗂️ Estrutura

```
sandman-db/
├── db/
│   ├── schema.sql      # definição das tabelas (comentado e organizado)
│   └── seed.sql        # todos os dados extraídos do PLANO-DO-JOGO.md
├── docs/
│   └── PLANO-BANCO.md  # plano do banco: diagrama ER, decisões e roadmap
├── public/
│   └── index.html      # página visual das tabelas (GET / no navegador)
├── src/
│   ├── server.js       # API REST (Express) + servidor da página visual
│   └── db.js           # conexão com o PostgreSQL (pg + SSL)
├── scripts/
│   ├── init-db.js      # aplica schema + seed via linha de comando
│   └── test-local.js   # teste local com pg-mem (sem precisar de banco)
├── render.yaml         # blueprint: cria Postgres + Web Service no Render
└── package.json
```

📖 **Plano completo do banco (diagrama ER, decisões de design e roadmap):**
[`docs/PLANO-BANCO.md`](docs/PLANO-BANCO.md)

## 🎮 Salvamento do jogador

Por decisão de design, o progresso do jogador continua salvo no
`localStorage` (sem conta). Se um dia quiser **save na nuvem**, dá para
adicionar tabelas `players`/`saves` e rotas autenticadas — a estrutura já
está preparada para isso.
