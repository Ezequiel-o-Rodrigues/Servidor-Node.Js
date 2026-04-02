import { randomBytes, createVerify, createPublicKey } from "crypto";
import jwt from "jsonwebtoken";
import { query } from "../../config/database";
import { env } from "../../config/env";
import { AuthPayload } from "../../middlewares/auth";

const CHALLENGE_TTL_SECONDS = 300; // 5 minutos
const TOKEN_EXPIRY = "24h";

// ==================== GERENCIAR CHAVES ====================

export async function addSSHKey(userId: number, name: string, publicKeyRaw: string) {
  const publicKey = publicKeyRaw.trim();

  // Validar formato da chave
  const parts = publicKey.split(" ");
  if (parts.length < 2) {
    throw Object.assign(new Error("Formato de chave inválido. Esperado: ssh-rsa AAAA... ou ssh-ed25519 AAAA..."), { status: 400 });
  }

  const keyType = parts[0]; // ssh-rsa, ssh-ed25519, ecdsa-sha2-nistp256
  const validTypes = ["ssh-rsa", "ssh-ed25519", "ecdsa-sha2-nistp256", "ecdsa-sha2-nistp384", "ecdsa-sha2-nistp521"];
  if (!validTypes.includes(keyType)) {
    throw Object.assign(new Error(`Tipo de chave não suportado: ${keyType}. Tipos aceitos: ${validTypes.join(", ")}`), { status: 400 });
  }

  // Gerar fingerprint (hash SHA256 da chave)
  const keyData = Buffer.from(parts[1], "base64");
  const { createHash } = await import("crypto");
  const fingerprint = "SHA256:" + createHash("sha256").update(keyData).digest("base64").replace(/=+$/, "");

  // Verificar se a chave já existe
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
  // Verificar se o usuário existe e tem chaves SSH
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

  // Gerar challenge
  const challenge = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000);

  // Limpar challenges expirados
  await query("DELETE FROM ssh_challenges WHERE expires_at < NOW()");

  // Salvar challenge
  await query(
    "INSERT INTO ssh_challenges (user_id, challenge, expires_at) VALUES ($1, $2, $3)",
    [user.id, challenge, expiresAt]
  );

  return {
    challenge,
    expiresIn: CHALLENGE_TTL_SECONDS,
    instructions: `Para assinar o challenge, execute no terminal:\necho -n "${challenge}" | ssh-keygen -Y sign -f ~/.ssh/id_ed25519 -n challenge`,
  };
}

export async function verifyChallenge(username: string, challenge: string, signature: string) {
  // Buscar o challenge e o usuário
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

  // Buscar todas as chaves do usuário
  const keysResult = await query(
    "SELECT id, public_key, key_type, fingerprint FROM user_ssh_keys WHERE user_id = $1",
    [row.user_id]
  );

  // Tentar verificar a assinatura com cada chave
  let verified = false;
  let usedKeyId: number | null = null;

  for (const key of keysResult.rows) {
    try {
      // Converter chave SSH para formato PEM para verificação
      const pemKey = sshPublicKeyToPem(key.public_key);
      const verifier = createVerify("SHA256");
      verifier.update(challenge);

      if (verifier.verify(pemKey, Buffer.from(signature, "base64"))) {
        verified = true;
        usedKeyId = key.id;
        break;
      }
    } catch {
      // Tentar a próxima chave
      continue;
    }
  }

  if (!verified) {
    throw Object.assign(new Error("Assinatura inválida"), { status: 401 });
  }

  // Remover challenge usado
  await query("DELETE FROM ssh_challenges WHERE id = $1", [row.challenge_id]);

  // Atualizar last_used da chave
  if (usedKeyId) {
    await query("UPDATE user_ssh_keys SET last_used = NOW() WHERE id = $1", [usedKeyId]);
  }

  // Atualizar último login
  await query("UPDATE users SET last_login = NOW() WHERE id = $1", [row.user_id]);

  // Gerar JWT
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

// ==================== UTILS ====================

function sshPublicKeyToPem(sshKey: string): string {
  const parts = sshKey.trim().split(" ");
  const keyType = parts[0];
  const keyData = parts[1];

  if (keyType === "ssh-rsa") {
    return `-----BEGIN PUBLIC KEY-----\n${formatPem(rsaDerFromSSH(Buffer.from(keyData, "base64")))}\n-----END PUBLIC KEY-----`;
  }

  // Para ed25519 e ecdsa, usar createPublicKey do Node
  const keyBuffer = Buffer.from(keyData, "base64");
  const key = createPublicKey({
    key: keyBuffer,
    format: "der",
    type: "spki",
  });
  return key.export({ type: "spki", format: "pem" }) as string;
}

function formatPem(der: Buffer): string {
  const b64 = der.toString("base64");
  return b64.match(/.{1,64}/g)?.join("\n") || b64;
}

function rsaDerFromSSH(buf: Buffer): Buffer {
  // Parse SSH RSA public key format to DER SPKI
  let offset = 0;

  function readString(): Buffer {
    const len = buf.readUInt32BE(offset);
    offset += 4;
    const data = buf.subarray(offset, offset + len);
    offset += len;
    return data;
  }

  readString(); // key type (ssh-rsa)
  const e = readString(); // exponent
  const n = readString(); // modulus

  // Build DER SPKI structure for RSA
  function derLength(len: number): Buffer {
    if (len < 128) return Buffer.from([len]);
    if (len < 256) return Buffer.from([0x81, len]);
    return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
  }

  function derInteger(data: Buffer): Buffer {
    // Add leading zero if high bit is set
    const padded = data[0] & 0x80 ? Buffer.concat([Buffer.from([0]), data]) : data;
    return Buffer.concat([Buffer.from([0x02]), derLength(padded.length), padded]);
  }

  const derE = derInteger(e);
  const derN = derInteger(n);
  const rsaKey = Buffer.concat([Buffer.from([0x30]), derLength(derN.length + derE.length), derN, derE]);

  // RSA OID: 1.2.840.113549.1.1.1
  const rsaOid = Buffer.from([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);

  const bitString = Buffer.concat([Buffer.from([0x03]), derLength(rsaKey.length + 1), Buffer.from([0x00]), rsaKey]);

  const spki = Buffer.concat([Buffer.from([0x30]), derLength(rsaOid.length + bitString.length), rsaOid, bitString]);

  return spki;
}
