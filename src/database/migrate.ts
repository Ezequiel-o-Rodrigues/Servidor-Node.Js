import { pool, query } from "../config/database";
import { logger } from "../config/logger";
import * as fs from "fs";
import * as path from "path";

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await query("SELECT name FROM _migrations ORDER BY id");
  return result.rows.map((r: any) => r.name);
}

async function runMigrations() {
  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();

  const migrationsDir = path.join(__dirname, "migrations");
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".js"))
    .sort();

  for (const file of files) {
    const name = path.basename(file, path.extname(file));
    if (executed.includes(name)) {
      logger.debug(`Migration ${name} já executada, pulando...`);
      continue;
    }

    logger.info(`Executando migration: ${name}`);
    const migration = require(path.join(migrationsDir, file));
    await migration.up(query);
    await query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
    logger.info(`Migration ${name} executada com sucesso`);
  }

  logger.info("Todas as migrations executadas");
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, "Erro ao executar migrations");
      process.exit(1);
    });
}

export { runMigrations };
