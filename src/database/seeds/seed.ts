import bcrypt from "bcrypt";
import { query, pool } from "../../config/database";
import { logger } from "../../config/logger";

async function seed() {
  logger.info("Iniciando seed do banco de dados...");

  // Criar super admin
  const passwordHash = await bcrypt.hash("28012008", 12);

  await query(
    `INSERT INTO users (username, email, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (username) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = EXCLUDED.role,
       updated_at = NOW()`,
    ["ezequiel", "ezequiel@admin.local", passwordHash, "Ezequiel", "super_admin"]
  );

  logger.info("Super admin 'ezequiel' criado/atualizado");

  // Dar permissão total em todos os módulos para o super admin
  const userResult = await query("SELECT id FROM users WHERE username = 'ezequiel'");
  const userId = userResult.rows[0].id;

  const modulesResult = await query("SELECT slug FROM modules");
  for (const mod of modulesResult.rows) {
    await query(
      `INSERT INTO user_module_permissions (user_id, module_slug, can_read, can_write, can_delete, can_admin)
       VALUES ($1, $2, true, true, true, true)
       ON CONFLICT (user_id, module_slug) DO UPDATE SET
         can_read = true, can_write = true, can_delete = true, can_admin = true`,
      [userId, mod.slug]
    );
  }

  logger.info("Permissões do super admin configuradas");
  logger.info("Seed concluído com sucesso");
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, "Erro no seed");
      process.exit(1);
    });
}

export { seed };
