import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { query } from "../../config/database";
import { env } from "../../config/env";
import { AuthPayload } from "../../middlewares/auth";

const TOKEN_EXPIRY = "24h";

export async function loginUser(username: string, password: string) {
  const result = await query(
    "SELECT id, username, password_hash, display_name, role, active FROM users WHERE username = $1",
    [username]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Usuário ou senha inválidos"), { status: 401 });
  }

  const user = result.rows[0];

  if (!user.active) {
    throw Object.assign(new Error("Conta desativada"), { status: 403 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw Object.assign(new Error("Usuário ou senha inválidos"), { status: 401 });
  }

  const payload: AuthPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

  // Atualizar último login
  await query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    },
  };
}

export async function getProfile(userId: number) {
  const result = await query(
    `SELECT u.id, u.username, u.email, u.display_name, u.role, u.created_at, u.last_login,
            COALESCE(
              json_agg(
                json_build_object('module', p.module_slug, 'read', p.can_read, 'write', p.can_write, 'delete', p.can_delete, 'admin', p.can_admin)
              ) FILTER (WHERE p.module_slug IS NOT NULL),
              '[]'
            ) as permissions
     FROM users u
     LEFT JOIN user_module_permissions p ON u.id = p.user_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Usuário não encontrado"), { status: 404 });
  }

  return result.rows[0];
}

export async function getUserModules(userId: number) {
  const result = await query(
    `SELECT m.slug, m.name, m.description, m.icon, m.menu_order,
            p.can_read, p.can_write, p.can_delete, p.can_admin
     FROM modules m
     INNER JOIN user_module_permissions p ON m.slug = p.module_slug
     WHERE p.user_id = $1 AND m.enabled = true AND p.can_read = true
     ORDER BY m.menu_order, m.name`,
    [userId]
  );
  return result.rows;
}

export async function getUserRole(userId: number): Promise<string> {
  const result = await query("SELECT role FROM users WHERE id = $1", [userId]);
  return result.rows[0]?.role || "user";
}
