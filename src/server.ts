import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";

import { env } from "./config/env";
import { logger } from "./config/logger";
import { corsConfig } from "./config/cors";
import { checkDatabase } from "./config/database";
import { checkRedis } from "./config/redis";
import { rateLimiter } from "./middlewares/rateLimiter";
import { requestLogger } from "./middlewares/requestLogger";
import { metricsMiddleware, register } from "./middlewares/metrics";
import { errorHandler } from "./middlewares/errorHandler";
import { loadModules, ModuleDefinition } from "./module-loader";
import { runMigrations } from "./database/migrate";

const app = express();
let loadedModules: ModuleDefinition[] = [];

// ==================== MIDDLEWARES GLOBAIS ====================

app.use(requestLogger);
app.use(metricsMiddleware());
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
  })
);
app.use(corsConfig);
app.use(rateLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ==================== STATIC FILES ====================

// Assets compartilhados do frontend
app.use("/shared", express.static(path.join(__dirname, "frontend", "shared")));
app.use("/assets", express.static(path.join(__dirname, "frontend", "assets")));

// ==================== ROTAS DE SISTEMA ====================

// Health check
app.get("/health", async (_req, res) => {
  const dbOk = await checkDatabase();
  const redisOk = await checkRedis();

  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? "connected" : "disconnected",
      redis: redisOk ? "connected" : "unavailable",
    },
  });
});

// Prometheus metrics
app.get("/metrics", async (_req, res) => {
  res.setHeader("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// API: listar módulos carregados (público)
app.get("/api/system/modules", (_req, res) => {
  res.json(
    loadedModules.map((m) => ({
      slug: m.slug,
      name: m.name,
      description: m.description,
      version: m.version,
      icon: m.icon,
    }))
  );
});

// ==================== PÁGINAS DO FRONTEND ====================

// Login
app.get("/login", (_req, res) => {
  res.sendFile(path.join(__dirname, "modules", "auth", "frontend", "login.html"));
});

// App principal (dashboard)
app.get("/app", (_req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "layouts", "app.html"));
});

// Redirecionar raiz para login
app.get("/", (_req, res) => {
  res.redirect("/login");
});

// ==================== ERROR HANDLER ====================

app.use(errorHandler);

// ==================== BOOTSTRAP ====================

async function bootstrap() {
  logger.info("Inicializando servidor...");

  // 1. Executar migrations
  try {
    await runMigrations();
    logger.info("Migrations executadas com sucesso");
  } catch (err: any) {
    logger.error({ err: err.message }, "Erro nas migrations — continuando sem banco");
  }

  // 2. Carregar módulos (auto-discovery)
  try {
    loadedModules = await loadModules(app);
  } catch (err: any) {
    logger.error({ err: err.message }, "Erro ao carregar módulos");
  }

  // 3. Re-aplicar error handler (precisa ser o último middleware)
  app.use(errorHandler);

  // 4. Iniciar servidor
  const port = parseInt(env.PORT);
  const server = app.listen(port, () => {
    logger.info(`Servidor rodando na porta ${port} [${env.NODE_ENV}]`);
    logger.info(`Login: http://localhost:${port}/login`);
    logger.info(`Dashboard: http://localhost:${port}/app`);
    logger.info(`Health: http://localhost:${port}/health`);
    logger.info(`Metrics: http://localhost:${port}/metrics`);
  });

  // 5. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} recebido, encerrando...`);
    server.close(() => {
      logger.info("Servidor encerrado");
      process.exit(0);
    });

    // Forçar encerramento após 10s
    setTimeout(() => {
      logger.error("Timeout de encerramento, forçando saída");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap();
