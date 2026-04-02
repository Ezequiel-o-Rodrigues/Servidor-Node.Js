import { randomBytes, createHash } from "crypto";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { tmpdir } from "os";
import jwt from "jsonwebtoken";
import { query } from "../../config/database";
import { env } from "../../config/env";
import { AuthPayload } from "../../middlewares/auth";

const CHALLENGE_TTL_SECONDS = 300;
const TOKEN_EXPIRY = "24h";

// ==================== GERENCIAR CHAVES ====================

export async function addSSHKey(userId: number, name: string, publicKeyRaw: string) {
  const publicKey = publicKeyRaw.trim();

  const parts = publicKey.split(" ");
  if (parts.length < 2) {
    throw Object.assign(new Error("Formato de chave inválido. Esperado: ssh-rsa AAAA... ou ssh-ed25519 AAAA..."), { status: 400 });
  }

  const keyType = parts[0];
  const validTypes = ["ssh-rsa", "ssh-ed25519", "ecdsa-sha2-nistp256", "ecdsa-sha2-nistp384", "ecdsa-sha2-nistp521"];
  if (!validTypes.includes(keyType)) {
    throw Object.assign(new Error(`Tipo de chave não suportado: ${keyType}`), { status: 400 });
  }

  const keyData = Buffer.from(parts[1], "base64");
  const fingerprint = "SHA256:" + createHash("sha256").update(keyData).digest("base64").replace(/=+$/, "");

  const existing = await query(
    "SELECT id FROM user_ssh_keys WHERE user_id = $1 AND fingerprint = $2",
    [userId, fingerprint]
  );
  if (existing.rows.length > 0) {
    throw Object.assign(new Error("Esta chave já está registrada"), { status: 409 });
  }

  const result = await query(
    `INSERT INTO user_ssh_keys (user_id, name, public_key, fingerprint, key_type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, fingerprint, key_type, created_at`,
    [userId, name, publicKey, fingerprint, keyType]
  );

  return result.rows[0];
}

export async function listSSHKeys(userId: number) {
  const result = await query(
    `SELECT id, name, fingerprint, key_type, last_used, created_at
     FROM user_ssh_keys WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function deleteSSHKey(userId: number, keyId: number) {
  const result = await query(
    "DELETE FROM user_ssh_keys WHERE id = $1 AND user_id = $2 RETURNING id, name",
    [keyId, userId]
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Chave não encontrada"), { status: 404 });
  }
  return result.rows[0];
}

// ==================== CHALLENGE-RESPONSE AUTH ====================

export async function createChallenge(username: string) {
  const userResult = await query(
    "SELECT id, active FROM users WHERE username = $1",
    [username]
  );
  if (userResult.rows.length === 0) {
    throw Object.assign(new Error("Usuário não encontrado"), { status: 404 });
  }

  const user = userResult.rows[0];
  if (!user.active) {
    throw Object.assign(new Error("Conta desativada"), { status: 403 });
  }

  const keysResult = await query(
    "SELECT COUNT(*) as count FROM user_ssh_keys WHERE user_id = $1",
    [user.id]
  );
  if (parseInt(keysResult.rows[0].count) === 0) {
    throw Object.assign(new Error("Nenhuma chave SSH registrada para este usuário"), { status: 400 });
  }

  const challenge = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000);

  await query("DELETE FROM ssh_challenges WHERE expires_at < NOW()");
  await query(
    "INSERT INTO ssh_challenges (user_id, challenge, expires_at) VALUES ($1, $2, $3)",
    [user.id, challenge, expiresAt]
  );

  return { challenge, expiresIn: CHALLENGE_TTL_SECONDS };
}

export async function verifyChallenge(username: string, challenge: string, signature: string) {
  const challengeResult = await query(
    `SELECT c.id as challenge_id, c.user_id, c.expires_at, u.username, u.display_name, u.role
     FROM ssh_challenges c
     INNER JOIN users u ON c.user_id = u.id
     WHERE c.challenge = $1 AND u.username = $2 AND c.expires_at > NOW()`,
    [challenge, username]
  );

  if (challengeResult.rows.length === 0) {
    throw Object.assign(new Error("Challenge inválido ou expirado"), { status: 401 });
  }

  const row = challengeResult.rows[0];

  const keysResult = await query(
    "SELECT id, public_key, key_type, fingerprint FROM user_ssh_keys WHERE user_id = $1",
    [row.user_id]
  );

  // Reconstruir a assinatura SSH completa
  let sigContent = signature.trim();
  let fullSig: string;
  if (sigContent.includes("BEGIN SSH SIGNATURE")) {
    fullSig = sigContent;
  } else {
    // É base64 puro do blob SSHSIG, reformatar com headers
    const formatted = sigContent.match(/.{1,76}/g)?.join("\n") || sigContent;
    fullSig = `-----BEGIN SSH SIGNATURE-----\n${formatted}\n-----END SSH SIGNATURE-----`;
  }

  // Usar ssh-keygen -Y verify (a forma oficial e correta)
  let verified = false;
  let usedKeyId: number | null = null;
  const tmpDir = mkdtempSync(join(tmpdir(), "sshverify-"));

  try {
    const sigFile = join(tmpDir, "signature");
    const messageFile = join(tmpDir, "message");
    const allowedSignersFile = join(tmpDir, "allowed_signers");

    // Escrever a mensagem (challenge)
    writeFileSync(messageFile, challenge);

    // Escrever a assinatura
    writeFileSync(sigFile, fullSig + "\n");

    // Tentar cada chave
    for (const key of keysResult.rows) {
      try {
        // Criar arquivo allowed_signers: "email namespaces="challenge" key"
        const allowedLine = `${username} namespaces="challenge" ${key.public_key}`;
        writeFileSync(allowedSignersFile, allowedLine + "\n");

        // Verificar com ssh-keygen
        execSync(
          `ssh-keygen -Y verify -f "${allowedSignersFile}" -I "${username}" -n challenge -s "${sigFile}" < "${messageFile}"`,
          { stdio: "pipe", timeout: 5000 }
        );

        // Se chegou aqui, a verificação passou
        verified = true;
        usedKeyId = key.id;
        break;
      } catch {
        continue;
      }
    }
  } finally {
    // Limpar arquivos temporários
    try {
      unlinkSync(join(tmpDir, "signature"));
      unlinkSync(join(tmpDir, "message"));
      unlinkSync(join(tmpDir, "allowed_signers"));
      require("fs").rmdirSync(tmpDir);
    } catch {}
  }

  if (!verified) {
    throw Object.assign(new Error("Assinatura inválida"), { status: 401 });
  }

  // Limpar challenge usado
  await query("DELETE FROM ssh_challenges WHERE id = $1", [row.challenge_id]);

  if (usedKeyId) {
    await query("UPDATE user_ssh_keys SET last_used = NOW() WHERE id = $1", [usedKeyId]);
  }

  await query("UPDATE users SET last_login = NOW() WHERE id = $1", [row.user_id]);

  const payload: AuthPayload = {
    userId: row.user_id,
    username: row.username,
    role: row.role,
  };

  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

  return {
    token,
    user: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
    },
  };
}
