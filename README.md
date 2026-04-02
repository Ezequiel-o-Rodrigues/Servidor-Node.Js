# Servidor Node.js Profissional — Modular & Escalável

> Servidor Node.js com arquitetura modular onde cada módulo é autocontido (backend + frontend). Projetado para escalar qualquer tipo de serviço com gestão centralizada de usuários, permissões e módulos.

---

## Visão Geral

```
Cliente (Browser)
    │
    ▼
┌─────────────────────────────────┐
│  Helmet → CORS → Rate Limit     │  Segurança
├─────────────────────────────────┤
│  Express.js                      │
│  ├── /health          (sistema)  │
│  ├── /metrics     (Prometheus)   │
│  ├── /login           (auth UI)  │
│  ├── /app          (dashboard)   │
│  ├── /api/auth/*      (JWT)      │
│  ├── /api/admin/*     (gestão)   │
│  ├── /api/clientes/*  (CRUD)     │
│  ├── /api/servicos/*  (CRUD)     │
│  └── /m/<modulo>/   (frontends)  │
├─────────────────────────────────┤
│  PostgreSQL │ Redis │ Pino       │  Dados
└─────────────────────────────────┘
```

---

## Stack

| Tecnologia | Função |
|---|---|
| **Node.js 22+** / **TypeScript** | Runtime + tipagem |
| **Express 4** | Framework HTTP |
| **PostgreSQL 16** | Banco de dados |
| **Redis 7** | Cache |
| **Docker / Compose** | Containerização |
| **JWT + bcrypt** | Autenticação |
| **SSH Key Auth** | Login sem senha via challenge-response |
| **Pino** | Logging estruturado |
| **Zod** | Validação de schemas |
| **Helmet** | Headers de segurança |
| **Prometheus** | Métricas (`/metrics`) |

---

## Arquitetura Modular

Cada módulo é autocontido e auto-descoberto pelo `module-loader`:

```
src/modules/<slug>/
├── index.ts              # register() → ModuleDefinition
├── <slug>.routes.ts      # Rotas da API
├── <slug>.controller.ts  # Controllers
├── <slug>.service.ts     # Lógica de negócio
└── frontend/
    ├── index.html        # Página principal do módulo
    └── <slug>.js         # JavaScript do frontend
```

**Para criar um novo módulo**, basta criar a pasta em `src/modules/` com um `index.ts` que exporta `register()`. O sistema descobre automaticamente, registra as rotas em `/api/<slug>/` e serve o frontend em `/m/<slug>/`.

---

## Módulos Implementados

### Auth (`/api/auth/*`)
- Login com usuário/senha (JWT)
- Login via SSH Key (challenge-response)
- Gestão de sessões e perfil
- Middleware de autenticação e autorização por role

### Admin (`/m/admin/`)
- Dashboard com stats do sistema (usuários, módulos, sessões)
- CRUD de usuários (criar, editar, excluir, alterar role)
- Habilitar/desabilitar módulos
- Gestão de permissões por módulo
- Gestão de chaves SSH por usuário

### Clientes (`/m/clientes/`)
- CRUD completo de clientes
- Campos: nome, razão social, CNPJ/CPF, email, telefone, WhatsApp, endereço completo
- Busca por nome, email, telefone, CNPJ
- Link direto para serviços do cliente
- Stats: total, ativos, serviços vinculados

### Serviços (`/m/servicos/`)
- CRUD de serviços com vínculo a clientes
- Campos: nome, tipo, descrição, URLs (site, admin, banco), IP/porta, credenciais do banco, valor mensal, datas
- Ativar/desativar serviço
- Painel de detalhes expandível com todas as informações
- Sistema de links extras (múltiplos links por serviço)
- Filtro por cliente
- Stats: total, ativos, inativos, clientes atendidos

---

## Estrutura de Pastas

```
├── src/
│   ├── config/
│   │   ├── env.ts              # Validação de variáveis (Zod)
│   │   ├── logger.ts           # Logger (Pino)
│   │   ├── database.ts         # Pool PostgreSQL
│   │   ├── cors.ts             # CORS
│   │   └── redis.ts            # Cache Redis
│   ├── middlewares/
│   │   ├── auth.ts             # JWT authenticate + authorize
│   │   ├── errorHandler.ts     # Tratamento centralizado de erros
│   │   ├── metrics.ts          # Prometheus
│   │   ├── rateLimiter.ts      # 100 req/15min
│   │   ├── requestLogger.ts    # Log com Request ID
│   │   └── validate.ts         # Validação Zod
│   ├── database/
│   │   ├── migrate.ts          # Sistema de migrations
│   │   ├── migrations/         # Versões do schema
│   │   └── seeds/              # Super admin seed
│   ├── modules/
│   │   ├── auth/               # Autenticação (senha + SSH)
│   │   ├── admin/              # Painel administrativo
│   │   ├── clientes/           # Gestão de clientes
│   │   └── servicos/           # Gestão de serviços
│   ├── frontend/
│   │   ├── layouts/            # Templates HTML
│   │   └── shared/             # CSS, JS, API client
│   ├── utils/
│   │   └── retry.ts            # Retry com backoff
│   ├── module-loader.ts        # Auto-discovery de módulos
│   └── server.ts               # Entry point
├── scripts/
│   └── ssh-login.sh            # Login via SSH key (CLI)
├── Dockerfile                  # Multi-stage build
├── docker-compose.yml          # App + PostgreSQL + Redis
└── package.json
```

---

## Deploy

### Com Docker (recomendado)

```bash
git clone https://github.com/Ezequiel-o-Rodrigues/Servidor-Node.Js.git
cd Servidor-Node.Js
docker compose up --build -d
docker compose exec app node dist/database/migrate.js
docker compose exec app node dist/database/seeds/seed.js
```

Acesse: `http://localhost:4000/login`

### Desenvolvimento local

```bash
npm install
npm run migrate
npm run seed
npm run dev
```

---

## Acesso

### Login com senha
- **URL:** `http://localhost:4000/login`
- **Super Admin:** `ezequiel` / `28012008`

### Login via SSH Key (CLI)

```bash
# 1. Registre sua chave pública no painel admin
# 2. Execute:
bash scripts/ssh-login.sh
```

O script faz challenge-response com sua chave SSH e abre o browser já autenticado.

---

## API Endpoints

### Sistema
| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/metrics` | Métricas Prometheus |

### Auth (`/api/auth`)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/login` | Login com senha |
| POST | `/logout` | Logout |
| GET | `/profile` | Perfil do usuário logado |
| GET | `/modules` | Módulos do usuário |
| POST | `/ssh/challenge` | Solicitar challenge SSH |
| POST | `/ssh/verify` | Verificar assinatura SSH |
| GET | `/ssh/keys` | Listar chaves SSH |
| POST | `/ssh/keys` | Adicionar chave SSH |
| DELETE | `/ssh/keys/:id` | Remover chave SSH |

### Admin (`/api/admin`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/stats` | Estatísticas do sistema |
| GET | `/users` | Listar usuários |
| POST | `/users` | Criar usuário |
| PUT | `/users/:id` | Atualizar usuário |
| DELETE | `/users/:id` | Excluir usuário |
| GET | `/modules` | Listar módulos |
| PATCH | `/modules/:slug` | Ativar/desativar módulo |

### Clientes (`/api/clientes`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/stats` | Estatísticas de clientes |
| GET | `/` | Listar clientes |
| GET | `/:id` | Detalhes do cliente |
| POST | `/` | Criar cliente |
| PUT | `/:id` | Atualizar cliente |
| DELETE | `/:id` | Excluir cliente |

### Serviços (`/api/servicos`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/stats` | Estatísticas de serviços |
| GET | `/` | Listar serviços |
| GET | `/:id` | Detalhes (com links) |
| POST | `/` | Criar serviço |
| PUT | `/:id` | Atualizar serviço |
| PATCH | `/:id/toggle` | Ativar/desativar |
| DELETE | `/:id` | Excluir serviço |
| POST | `/:id/links` | Adicionar link |
| DELETE | `/links/:id` | Remover link |

---

## Como criar um novo módulo

```typescript
// src/modules/meu-modulo/index.ts
import { ModuleDefinition } from "../../module-loader";
import router from "./meu-modulo.routes";

export function register(): ModuleDefinition {
  return {
    slug: "meu-modulo",
    name: "Meu Módulo",
    description: "Descrição do módulo",
    version: "1.0.0",
    icon: "box",
    menuOrder: 10,
    router,
  };
}
```

O módulo será auto-descoberto, suas rotas registradas em `/api/meu-modulo/` e o frontend servido em `/m/meu-modulo/`.

---

## Variáveis de Ambiente

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://appuser:PASSWORD@localhost:5432/appdb
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-this-secret
```

---

## Segurança

- **Helmet** — Headers de segurança
- **CORS** — Controle de origens
- **Rate Limiting** — 100 req/15min por IP
- **bcrypt** — Hash de senhas (12 rounds)
- **JWT** — Tokens com expiração de 24h
- **SSH Key Auth** — Login sem senha via challenge-response
- **Validação Zod** — Em todas as rotas de entrada
- **Graceful Shutdown** — Encerramento limpo

---

## Licença

MIT

Construído com arquitetura modular para escalar qualquer tipo de serviço.
