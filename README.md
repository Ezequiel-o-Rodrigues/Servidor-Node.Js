# 🖥️ Servidor Node.js Profissional — Do Zero à Produção

> Um guia completo e prático de como construir um servidor Node.js com padrões de produção em um ambiente Linux. Este projeto documenta cada decisão técnica, explicando **o que**, **por que** e **como** implementar cada camada de um servidor profissional.

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Mapa Mental — Arquitetura](#-mapa-mental--arquitetura)
- [Pré-requisitos](#-pré-requisitos)
- [Fase 1 — Fundação](#-fase-1--fundação)
- [Fase 2 — Segurança](#-fase-2--segurança)
- [Fase 3 — Resiliência](#-fase-3--resiliência)
- [Fase 4 — Observabilidade](#-fase-4--observabilidade)
- [Fase 5 — Infraestrutura e Deploy](#-fase-5--infraestrutura-e-deploy)
- [Comandos Úteis](#-comandos-úteis)
- [Estrutura de Pastas](#-estrutura-de-pastas)
- [Tecnologias](#-tecnologias)

---

## 🌐 Visão Geral

Este projeto nasceu de uma pergunta simples: **"O que um servidor profissional dentro de uma empresa tem?"**

A resposta virou este repositório — um servidor construído camada por camada, da forma como é feito em empresas reais. Cada fase adiciona uma responsabilidade nova, e nenhuma fase faz sentido sem a anterior.

Servidor "Hello World"
└── + Estrutura e Logging          → Fase 1 (Fundação)
└── + Helmet, CORS, Rate Limit → Fase 2 (Segurança)
└── + Banco, Cache, Retry  → Fase 3 (Resiliência)
└── + Métricas, Tracing → Fase 4 (Observabilidade)
└── + Docker, CI/CD  → Fase 5 (Infraestrutura)



---

## 🧠 Mapa Mental — Arquitetura


                      ┌─────────────────┐
                      │    CLIENTE       │
                      │  (Browser/App)   │
                      └────────┬─────────┘
                               │
                      ┌────────▼─────────┐
                      │     HELMET       │ ← Headers de segurança
                      │     CORS         │ ← Controle de origem
                      │   RATE LIMIT     │ ← Proteção contra abuso
                      └────────┬─────────┘
                               │
                      ┌────────▼─────────┐
                      │   EXPRESS.JS     │
                      │                  │
                      │  ┌─── /health    │ ← Monitoramento
                      │  ├─── /metrics   │ ← Prometheus
                      │  ├─── /users     │ ← CRUD com banco
                      │  └─── /external  │ ← Retry com backoff
                      └────────┬─────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │               │
       ┌───────▼──────┐ ┌────▼─────┐  ┌─────▼──────┐
       │  PostgreSQL   │ │  Redis   │  │   Logger   │
       │  (dados)      │ │  (cache) │  │   (pino)   │
       │               │ │          │  │            │
       │ • Pool 20 conn│ │ • TTL 60s│  │ • JSON prod│
       │ • Auto-create │ │ • Retry  │  │ • Pretty   │
       │   tables      │ │   3x     │  │   em dev   │
       └───────────────┘ └──────────┘  └────────────┘


### Por que essa ordem?

🏗️ Fase 1 — FUNDAÇÃO
│  "Sem estrutura, o código vira bagunça em 2 semanas"
│
│  ├── Estrutura de pastas → Separação de responsabilidades
│  │   └── POR QUE: Se tudo fica num arquivo só, ninguém consegue
│  │       encontrar nada. Controllers, services, middlewares — cada
│  │       um no seu lugar.
│  │
│  ├── Validação de .env (zod) → O servidor NEM SOBE se faltar config
│  │   └── POR QUE: Já imaginou o servidor subir em produção sem a
│  │       URL do banco? Ele sobe, parece funcionar, e explode quando
│  │       o primeiro usuário acessa. Melhor falhar cedo.
│  │
│  ├── Logging estruturado (pino) → Substitui console.log
│  │   └── POR QUE: console.log não tem timestamp, não tem nível
│  │       (info/error/warn), não tem formato JSON. Em produção,
│  │       você precisa filtrar logs por tipo e pesquisar por data.
│  │       "console.log('deu erro')" não ajuda ninguém às 3h da manhã.
│  │
│  ├── Health check (/health) → "O servidor tá vivo?"
│  │   └── POR QUE: Ferramentas de monitoramento (Docker, Kubernetes,
│  │       load balancers) precisam saber se o servidor tá saudável.
│  │       Sem isso, não tem como automatizar recuperação de falhas.
│  │
│  └── Error handler centralizado → Um lugar só pra tratar erros
│      └── POR QUE: Se cada rota trata erro de um jeito, o cliente
│          recebe respostas inconsistentes. Um middleware central
│          garante formato único e loga tudo automaticamente.
│
🔒 Fase 2 — SEGURANÇA
│  "Se não proteger, vai ser hackeado. É questão de quando, não se."
│
│  ├── Helmet → Headers de segurança automáticos
│  │   └── POR QUE: Uma linha de código que adiciona 11 headers de
│  │       segurança. Protege contra XSS, clickjacking, MIME sniffing
│  │       e mais. Custo zero, proteção enorme.
│  │
│  ├── Rate Limiting → Máximo 100 requests por 15 minutos
│  │   └── POR QUE: Sem isso, qualquer pessoa pode fazer 1 milhão
│  │       de requests por segundo e derrubar seu servidor. Rate
│  │       limiting é a primeira linha de defesa contra DDoS.
│  │
│  ├── CORS → Controle de origens permitidas
│  │   └── POR QUE: Sem CORS, qualquer site pode fazer requests
│  │       para sua API. Com CORS, só os domínios que você autorizar
│  │       conseguem acessar. Essencial para APIs públicas.
│  │
│  └── Validação de input (zod) → Valida TUDO que chega
│      └── POR QUE: Nunca confie no que o cliente envia. SQL injection,
│          XSS, dados malformados — tudo entra pelo input. Validar
│          é obrigatório em toda rota que recebe dados.
│
🔄 Fase 3 — RESILIÊNCIA
│  "Coisas vão falhar. A pergunta é: o servidor sobrevive?"
│
│  ├── PostgreSQL + Connection Pooling → Banco de dados real
│  │   └── POR QUE: Pool de conexões reutiliza conexões existentes
│  │       ao invés de abrir uma nova pra cada request. Sem pool,
│  │       100 requests simultâneas = 100 conexões = banco cai.
│  │       Com pool de 20, as requests esperam na fila.
│  │
│  ├── Redis (cache) → Dados frequentes ficam na memória
│  │   └── POR QUE: Buscar no banco toda vez é lento e caro.
│  │       Se a lista de usuários não muda a cada segundo, guarda
│  │       no Redis por 60s. Próxima request é instantânea.
│  │       Resultado: banco respira, resposta é mais rápida.
│  │
│  ├── Retry com backoff → Tentativas com intervalo crescente
│  │   └── POR QUE: Serviços externos caem. Se você chama uma API
│  │       e ela falha, tenta de novo em 500ms, depois 1s, depois 2s.
│  │       Muitas vezes a falha é temporária. Sem retry, o usuário
│  │       vê erro. Com retry, ele nem percebe.
│  │
│  └── Graceful Shutdown → Encerramento limpo
│      └── POR QUE: Se o servidor recebe SIGTERM (deploy novo, restart),
│          ele precisa terminar as requests em andamento antes de morrer.
│          Sem isso, usuários recebem "connection reset" no meio de
│          uma operação.
│
📊 Fase 4 — OBSERVABILIDADE
│  "Se você não mede, você não sabe. Se não sabe, não pode melhorar."
│
│  ├── Métricas Prometheus (/metrics) → Números sobre tudo
│  │   └── POR QUE: Quantas requests por minuto? Qual o tempo médio
│  │       de resposta? Quanta memória tá usando? Sem métricas, você
│  │       só descobre que tem problema quando o usuário reclama.
│  │       Com métricas + Grafana, você vê em tempo real.
│  │
│  └── Request Logging + Request ID → Rastreamento de requests
│      └── POR QUE: Quando um usuário reporta um erro, você precisa
│          encontrar aquela request específica nos logs. O Request ID
│          é um identificador único que acompanha a request em todo
│          o caminho. "Me passa o request ID" → encontra o log em 5s.
│
🐳 Fase 5 — INFRAESTRUTURA
│  "Funciona na minha máquina" não é deploy.
│
│  ├── Docker → Ambiente idêntico em qualquer lugar
│  │   └── POR QUE: "Funciona no meu PC" é o problema mais clássico.
│  │       Docker empacota tudo (código, dependências, configs) numa
│  │       imagem. Se roda no Docker, roda em qualquer servidor.
│  │       Fim dos "mas aqui funciona".
│  │
│  ├── Docker Compose → Orquestração local
│  │   └── POR QUE: Seu servidor precisa de app + banco + cache.
│  │       Docker Compose sobe tudo com UM comando, configura a rede
│  │       entre eles e garante que o banco suba antes da app.
│  │       docker compose up -d e pronto.
│  │
│  ├── CI/CD (GitHub Actions) → Testes automáticos a cada push
│  │   └── POR QUE: Humanos esquecem de rodar testes. O CI roda
│  │       automaticamente a cada push: type check, build, health
│  │       check. Se falhar, o código não vai pra produção.
│  │       Pega bugs antes de chegarem no usuário.
│  │
│  ├── Deploy script → Deploy com rollback automático
│  │   └── POR QUE: Deploy manual é receita pra desastre.
│  │       O script faz: pull → build → restart → health check.
│  │       Se o health check falhar, faz rollback sozinho.
│  │
│  └── Ambientes separados → dev ≠ staging ≠ produção
│      └── POR QUE: Configurações de dev (logs bonitos, debug ON)
│          são diferentes de produção (logs JSON, debug OFF).
│          Sem separação, ou o dev é ruim ou a produção é insegura.



---

## 📦 Pré-requisitos

- Servidor Linux (Ubuntu 24.04 LTS usado neste guia)
- Acesso root via SSH

---

## 🏗️ Fase 1 — Fundação

### 1.1 Instalar Node.js (via nvm)

> **Por que nvm e não `apt install npm`?**
> O npm do apt vem com Node.js desatualizado (v18) e instala 594 pacotes desnecessários. O nvm instala a versão mais recente direto da fonte.

```bash
# Atualizar o sistema
apt update && apt upgrade -y

# Instalar nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc

# Instalar Node.js LTS
nvm install --lts

# Verificar
node -v   # v22+ ou v24+
npm -v    # v10+
1.2 Criar o projeto

mkdir ~/meu-servidor && cd ~/meu-servidor
npm init -y
1.3 Instalar dependências

# Dependências de produção
npm install express dotenv zod pino pino-pretty

# Dependências de desenvolvimento
npm install -D typescript @types/express @types/node ts-node
Pacote	O que é	Pra que serve
express	Framework web	Cria rotas, recebe requests, envia responses
dotenv	Leitor de .env	Carrega variáveis de ambiente no process.env
zod	Validação	Valida dados (env vars, input de requests)
pino	Logger	Substitui console.log com logs estruturados
pino-pretty	Formatador	Deixa os logs bonitos no terminal em dev
typescript	Linguagem	JavaScript com tipos — pega erros antes de rodar
1.4 Configuração TypeScript

cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
1.5 Estrutura de pastas

mkdir -p src/routes src/controllers src/services src/middlewares src/config src/utils

src/
├── config/         # Configurações (banco, env, logger)
├── controllers/    # Recebe request → chama service
├── middlewares/     # Funções que rodam antes/depois das rotas
├── routes/         # Define os endpoints
├── services/       # Lógica de negócio
└── utils/          # Funções auxiliares
1.6 Validação de ambiente (src/config/env.ts)
Princípio: Fail Fast — se algo essencial está faltando, o servidor deve falhar imediatamente ao iniciar, não 3 horas depois quando alguém acessa uma rota.


import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("3000"),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);
1.7 Logger estruturado (src/config/logger.ts)
Por que não console.log? Porque console.log("deu erro") não tem data, não tem nível, não tem contexto. Em produção, você precisa saber quando aconteceu, quão grave é, e o que estava acontecendo.


import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV !== "production"
      ? { target: "pino-pretty" }  // Bonito no dev
      : undefined,                  // JSON puro em prod
});
Dev:


[14:30:00] INFO: Servidor rodando na porta 4000
[14:30:01] ERROR: Falha ao conectar no banco { err: "connection refused" }
Prod (JSON para ferramentas de log):


{"level":30,"time":1711980600000,"msg":"Servidor rodando na porta 4000"}
1.8 Error Handler (src/middlewares/errorHandler.ts)

import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";
import { env } from "../config/env";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error({ err, path: req.path, method: req.method }, "Erro na requisição");

  if (err.name === "ZodError") {
    return res.status(400).json({ error: "Dados inválidos", details: err.issues });
  }

  res.status(err.status || 500).json({
    error: env.NODE_ENV === "production" ? "Erro interno do servidor" : err.message,
  });
}
Nota de segurança: Em produção, nunca exponha a mensagem real do erro (err.message) para o cliente. Hackers usam mensagens de erro para entender a estrutura interna do servidor.

1.9 Arquivo .env

NODE_ENV=development
PORT=4000
1.10 Testar

npx ts-node src/server.ts
# [14:21:03] INFO: Servidor rodando na porta 4000 [development]

# Em outro terminal:
curl http://localhost:4000/health
# {"status":"ok","uptime":15.38,"timestamp":"2026-04-01T14:43:01.774Z"}
🔒 Fase 2 — Segurança
2.1 Instalar dependências

npm install helmet cors express-rate-limit
npm install -D @types/cors
Pacote	Proteção contra
helmet	XSS, clickjacking, MIME sniffing, e mais 8 ataques
cors	Requests não autorizadas de outros domínios
express-rate-limit	DDoS, brute force, abuso de API
2.2 Rate Limiter (src/middlewares/rateLimiter.ts)

import rateLimit from "express-rate-limit";

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // Janela de 15 minutos
  max: 100,                    // Máximo 100 requests por IP
  message: { error: "Muitas requisições. Tente novamente em 15 minutos." },
  standardHeaders: true,       // Retorna info no header RateLimit-*
  legacyHeaders: false,
});
2.3 CORS (src/config/cors.ts)

import cors from "cors";

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  // Adicione seus domínios aqui
];

export const corsConfig = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Bloqueado pelo CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
});
2.4 Validação de input (src/middlewares/validate.ts)

import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Dados inválidos",
        details: result.error.issues,
      });
    }
    req.body = result.data;
    next();
  };
}
2.5 Verificar headers de segurança

curl -v http://localhost:4000/ 2>&1 | grep -E "^<"

< Content-Security-Policy: default-src 'self'...
< Strict-Transport-Security: max-age=31536000
< X-Content-Type-Options: nosniff
< X-Frame-Options: SAMEORIGIN
< RateLimit-Limit: 100
< RateLimit-Remaining: 99
🔄 Fase 3 — Resiliência
3.1 Instalar serviços

# No servidor Linux
apt install -y postgresql postgresql-contrib redis-server
systemctl start postgresql redis-server
systemctl enable postgresql redis-server
3.2 Criar banco de dados

sudo -u postgres psql -c "CREATE USER appuser WITH PASSWORD 'SUA_SENHA_AQUI';"
sudo -u postgres psql -c "CREATE DATABASE appdb OWNER appuser;"
Nota: Se der erro de autenticação, verifique o arquivo pg_hba.conf. A linha do PostgreSQL local precisa estar como peer e as linhas de host como md5.

3.3 Instalar dependências

npm install pg ioredis
npm install -D @types/pg
3.4 Connection Pool (src/config/database.ts)
Por que pool e não conexão direta? Abrir uma conexão com o banco leva ~50ms. Com pool, as conexões ficam abertas e são reutilizadas. 100 requests simultâneas compartilham 20 conexões ao invés de abrir 100.


import { Pool } from "pg";
import { env } from "./env";
import { logger } from "./logger";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,                      // Máximo de conexões simultâneas
  idleTimeoutMillis: 30000,     // Fecha conexão ociosa após 30s
  connectionTimeoutMillis: 5000, // Timeout de 5s pra conectar
});

pool.on("connect", () => logger.debug("Nova conexão com o banco"));
pool.on("error", (err) => logger.error({ err }, "Erro no pool do banco"));

export async function checkDatabase(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
3.5 Redis Cache (src/config/redis.ts)

import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

export const redis = new Redis(env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) {
      logger.error("Redis: máximo de tentativas atingido");
      return null;
    }
    return Math.min(times * 200, 2000); // 200ms, 400ms, 800ms
  },
});

redis.on("connect", () => logger.info("Redis conectado"));
redis.on("error", (err) => logger.error({ err }, "Erro no Redis"));
3.6 Retry com Backoff (src/utils/retry.ts)
Backoff exponencial: 1ª tentativa falha → espera 500ms → 2ª falha → espera 1s → 3ª tentativa. O intervalo dobra a cada falha, evitando sobrecarregar um serviço que já está com problema.


import { logger } from "../config/logger";

interface RetryOptions {
  attempts: number;
  delayMs: number;
  backoff: number;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = { attempts: 3, delayMs: 500, backoff: 2 }
): Promise<T> {
  let lastError: Error = new Error("Retry failed");
  let delay = options.delayMs;

  for (let i = 1; i <= options.attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      logger.warn(
        { attempt: i, max: options.attempts, err: err.message },
        "Tentativa falhou, retentando..."
      );
      if (i < options.attempts) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= options.backoff;
      }
    }
  }
  throw lastError;
}
3.7 Atualizar .env

NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://appuser:SUA_SENHA@localhost:5432/appdb
REDIS_URL=redis://localhost:6379
3.8 Testar

# Health check com serviços
curl http://localhost:4000/health
# {"status":"ok","services":{"database":"connected","redis":"connected"}}

# Criar usuário no banco
curl -X POST http://localhost:4000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Ezequiel","email":"ezequiel@teste.com"}'
# {"id":1,"name":"Ezequiel","email":"ezequiel@teste.com","created_at":"..."}

# Listar (primeira vez: do banco, segunda vez: do cache Redis)
curl http://localhost:4000/users
📊 Fase 4 — Observabilidade
4.1 Instalar dependências

npm install prom-client response-time
npm install -D @types/response-time
4.2 Métricas Prometheus (src/middlewares/metrics.ts)

import { Registry, collectDefaultMetrics, Counter, Histogram } from "prom-client";
import { Request, Response, NextFunction } from "express";
import responseTime from "response-time";

export const register = new Registry();

collectDefaultMetrics({ register });

const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total de requisições HTTP",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duração das requisições HTTP em segundos",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

export function metricsMiddleware() {
  return responseTime((req: Request, res: Response, time: number) => {
    const route = req.route?.path || req.path;
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode.toString(),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, time / 1000);
  });
}
4.3 Request Logger (src/middlewares/requestLogger.ts)

import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";
import { randomUUID } from "crypto";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers["x-request-id"] as string || randomUUID();
  const start = Date.now();

  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info({
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    }, `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
}
4.4 Endpoint /metrics

curl http://localhost:4000/metrics
Retorna dados que o Prometheus consome:


http_requests_total{method="GET",route="/",status_code="200"} 42
http_request_duration_seconds_sum{method="GET",route="/users"} 0.156
process_resident_memory_bytes 235749376
nodejs_eventloop_lag_seconds 0.01
🐳 Fase 5 — Infraestrutura e Deploy
5.1 Dockerfile (Multi-stage build)
Por que multi-stage? O primeiro estágio instala TUDO (inclusive devDependencies) pra compilar o TypeScript. O segundo estágio só copia o JavaScript compilado e as dependências de produção. Resultado: imagem ~5x menor e mais segura.


# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# Production stage
FROM node:22-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
USER appuser
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "dist/server.js"]
Decisões de segurança:

USER appuser → nunca roda como root
npm ci --omit=dev → sem dependências de desenvolvimento
HEALTHCHECK → Docker reinicia o container automaticamente se o health check falhar
5.2 Docker Compose

services:
  app:
    build: .
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - PORT=4000
      - DATABASE_URL=postgresql://appuser:SUA_SENHA@postgres:5432/appdb
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: SUA_SENHA
      POSTGRES_DB: appdb
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser -d appdb"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
5.3 CI/CD (GitHub Actions)
O pipeline .github/workflows/ci.yml roda automaticamente a cada push:


Push no GitHub
  └── CI inicia
       ├── npm ci (instala dependências)
       ├── npx tsc --noEmit (verifica tipos)
       ├── npx tsc (compila)
       ├── Sobe servidor + banco + redis
       ├── curl /health (testa se tá vivo)
       └── Build Docker image (se branch main)
5.4 Deploy

# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Subir tudo
docker compose up --build -d

# Verificar
docker compose ps
curl http://localhost:4000/health
🛠️ Comandos Úteis

# Docker
docker compose up -d          # Subir todos os serviços
docker compose down            # Parar tudo
docker compose logs -f app     # Ver logs da aplicação
docker compose ps              # Status dos containers
docker compose restart app     # Reiniciar só a app

# Deploy
./deploy.sh                    # Deploy com rollback automático

# Desenvolvimento (sem Docker)
npx ts-node src/server.ts      # Rodar em dev

# Banco de dados
docker compose exec postgres psql -U appuser -d appdb   # Acessar o banco

# Redis
docker compose exec redis redis-cli   # Acessar o Redis
📁 Estrutura de Pastas

meu-servidor/
├── .github/
│   └── workflows/
│       └── ci.yml              # Pipeline CI/CD
├── src/
│   ├── config/
│   │   ├── cors.ts             # Configuração CORS
│   │   ├── database.ts         # Pool PostgreSQL
│   │   ├── env.ts              # Validação de variáveis
│   │   ├── logger.ts           # Logger Pino
│   │   └── redis.ts            # Cliente Redis
│   ├── middlewares/
│   │   ├── cache.ts            # Cache middleware
│   │   ├── errorHandler.ts     # Tratamento de erros
│   │   ├── metrics.ts          # Métricas Prometheus
│   │   ├── rateLimiter.ts      # Rate limiting
│   │   ├── requestLogger.ts    # Log de requests
│   │   └── validate.ts         # Validação de input
│   ├── utils/
│   │   └── retry.ts            # Retry com backoff
│   └── server.ts               # Servidor principal
├── .dockerignore
├── .env.example
├── .gitignore
├── deploy.sh                   # Script de deploy
├── docker-compose.yml          # Orquestração Docker
├── Dockerfile                  # Build da imagem
├── package.json
└── tsconfig.json
🧰 Tecnologias
Tecnologia	Versão	Função
Node.js	22+	Runtime JavaScript
TypeScript	5+	Tipagem estática
Express	4	Framework HTTP
PostgreSQL	16	Banco de dados relacional
Redis	7	Cache em memória
Docker	27+	Containerização
Pino	9+	Logging estruturado
Zod	3+	Validação de schemas
Helmet	8+	Headers de segurança
Prometheus	-	Métricas (via prom-client)
📄 Licença
MIT

Construído como material de estudo. Cada decisão neste servidor foi tomada pensando em como empresas reais operam servidores em produção.
