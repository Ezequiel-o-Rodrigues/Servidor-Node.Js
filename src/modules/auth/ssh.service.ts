import { randomBytes, createHash, createPublicKey, verify as cryptoVerify } from "crypto";
import jwt from "jsonwebtoken";
import { query } from "../../config/database";
import { env } from "../../config/env";
import { AuthPayload } from "../../middlewares/auth";

const CHALLENGE_TTL_SECONDS = 300; // 5 minutos
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

  return {
    challenge,
    expiresIn: CHALLENGE_TTL_SECONDS,
  };
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

  // Decodificar a assinatura SSH (pode vir como base64 do blob inteiro, ou como SSHSIG)
  let signatureData: Buffer;
  try {
    signatureData = decodeSSHSignature(signature);
  } catch (err: any) {
    throw Object.assign(new Error("Formato de assinatura inválido: " + err.message), { status: 400 });
  }

  // Tentar verificar com cada chave
  let verified = false;
  let usedKeyId: number | null = null;

  for (const key of keysResult.rows) {
    try {
      if (key.key_type === "ssh-ed25519") {
        // Para ed25519: construir o signed data no formato SSHSIG e verificar
        const signedData = buildSSHSIGSignedData(challenge);
        const pubKeyObj = ed25519PubKeyFromSSH(key.public_key);

        const isValid = cryptoVerify(null, signedData, pubKeyObj, signatureData);
        if (isValid) {
          verified = true;
          usedKeyId = key.id;
          break;
        }
      } else if (key.key_type === "ssh-rsa") {
        // Para RSA: o hash algorithm no SSHSIG é sha512
        const signedData = buildSSHSIGSignedData(challenge);
        const pubKeyObj = rsaPubKeyFromSSH(key.public_key);

        const isValid = cryptoVerify("sha512", signedData, pubKeyObj, signatureData);
        if (isValid) {
          verified = true;
          usedKeyId = key.id;
          break;
        }
      }
    } catch {
      continue;
    }
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

// ==================== SSH SIGNATURE PARSING ====================

// O ssh-keygen -Y sign produz:
// -----BEGIN SSH SIGNATURE-----
// <base64 do blob SSHSIG>
// -----END SSH SIGNATURE-----
//
// O blob SSHSIG contém:
// - "SSHSIG" (6 bytes magic)
// - uint32 version (1)
// - string publickey
// - string namespace
// - string reserved
// - string hash_algorithm
// - string signature_blob
//
// O signature_blob contém:
// - string algorithm_name
// - string raw_signature
//
// O signed_data que foi assinado é:
// - "SSHSIG" magic preamble
// - uint32 version
// - string namespace
// - string reserved
// - string hash_algorithm
// - string H(message)  (onde H = sha512)

function decodeSSHSignature(input: string): Buffer {
  // Decodificar o base64 (pode ser o blob inteiro ou ter headers)
  let b64 = input.trim();

  // Remover headers se existirem
  if (b64.includes("BEGIN SSH SIGNATURE")) {
    b64 = b64
      .replace(/-----BEGIN SSH SIGNATURE-----/g, "")
      .replace(/-----END SSH SIGNATURE-----/g, "")
      .replace(/\s+/g, "");
  }

  const blob = Buffer.from(b64, "base64");

  // Verificar magic "SSHSIG"
  const magic = blob.subarray(0, 6).toString("ascii");
  if (magic !== "SSHSIG") {
    throw new Error("Magic SSHSIG não encontrado");
  }

  let offset = 6;

  // version (uint32)
  const version = blob.readUInt32BE(offset);
  offset += 4;

  // publickey (string)
  const pubkeyLen = blob.readUInt32BE(offset);
  offset += 4 + pubkeyLen;

  // namespace (string)
  const nsLen = blob.readUInt32BE(offset);
  offset += 4 + nsLen;

  // reserved (string)
  const reservedLen = blob.readUInt32BE(offset);
  offset += 4 + reservedLen;

  // hash_algorithm (string)
  const hashAlgLen = blob.readUInt32BE(offset);
  offset += 4 + hashAlgLen;

  // signature blob (string)
  const sigBlobLen = blob.readUInt32BE(offset);
  offset += 4;
  const sigBlob = blob.subarray(offset, offset + sigBlobLen);

  // Dentro do signature blob:
  // - string algorithm_name
  // - string raw_signature
  let sigOffset = 0;
  const algNameLen = sigBlob.readUInt32BE(sigOffset);
  sigOffset += 4 + algNameLen;

  const rawSigLen = sigBlob.readUInt32BE(sigOffset);
  sigOffset += 4;
  const rawSignature = sigBlob.subarray(sigOffset, sigOffset + rawSigLen);

  return rawSignature;
}

function buildSSHSIGSignedData(message: string): Buffer {
  // Construir o signed_data que o ssh-keygen -Y sign assina
  const namespace = "challenge";
  const hashAlgorithm = "sha512";
  const messageHash = createHash("sha512").update(message).digest();

  const parts: Buffer[] = [];

  // Magic preamble
  parts.push(Buffer.from("SSHSIG"));

  // Version uint32
  const versionBuf = Buffer.alloc(4);
  versionBuf.writeUInt32BE(1, 0);
  parts.push(versionBuf);

  // Namespace (string)
  parts.push(encodeString(namespace));

  // Reserved (empty string)
  parts.push(encodeString(""));

  // Hash algorithm (string)
  parts.push(encodeString(hashAlgorithm));

  // H(message) (string)
  parts.push(encodeString(messageHash));

  return Buffer.concat(parts);
}

function encodeString(data: string | Buffer): Buffer {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(buf.length, 0);
  return Buffer.concat([lenBuf, buf]);
}

// ==================== KEY CONVERSION ====================

function ed25519PubKeyFromSSH(sshKey: string): ReturnType<typeof createPublicKey> {
  const parts = sshKey.trim().split(" ");
  const keyBlob = Buffer.from(parts[1], "base64");

  // Parse SSH key blob: string "ssh-ed25519", string raw_pubkey (32 bytes)
  let offset = 0;
  const typeLen = keyBlob.readUInt32BE(offset);
  offset += 4 + typeLen;
  const rawKeyLen = keyBlob.readUInt32BE(offset);
  offset += 4;
  const rawKey = keyBlob.subarray(offset, offset + rawKeyLen);

  // Ed25519 DER SPKI:
  // SEQUENCE { SEQUENCE { OID 1.3.101.112 }, BIT STRING { raw_key } }
  const ed25519Oid = Buffer.from([0x06, 0x03, 0x2b, 0x65, 0x70]); // OID 1.3.101.112
  const algSeq = Buffer.concat([Buffer.from([0x30, ed25519Oid.length]), ed25519Oid]);
  const bitString = Buffer.concat([Buffer.from([0x03, rawKey.length + 1, 0x00]), rawKey]);
  const spki = Buffer.concat([
    Buffer.from([0x30, algSeq.length + bitString.length]),
    algSeq,
    bitString,
  ]);

  return createPublicKey({ key: spki, format: "der", type: "spki" });
}

function rsaPubKeyFromSSH(sshKey: string): ReturnType<typeof createPublicKey> {
  const parts = sshKey.trim().split(" ");
  const keyBlob = Buffer.from(parts[1], "base64");

  let offset = 0;

  function readBuf(): Buffer {
    const len = keyBlob.readUInt32BE(offset);
    offset += 4;
    const data = keyBlob.subarray(offset, offset + len);
    offset += len;
    return data;
  }

  readBuf(); // key type
  const e = readBuf(); // exponent
  const n = readBuf(); // modulus

  function derInteger(data: Buffer): Buffer {
    const padded = data[0] & 0x80 ? Buffer.concat([Buffer.from([0]), data]) : data;
    return Buffer.concat([Buffer.from([0x02]), derLength(padded.length), padded]);
  }

  function derLength(len: number): Buffer {
    if (len < 128) return Buffer.from([len]);
    if (len < 256) return Buffer.from([0x81, len]);
    return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
  }

  const derN = derInteger(n);
  const derE = derInteger(e);
  const rsaKeyContent = Buffer.concat([derN, derE]);
  const rsaKey = Buffer.concat([Buffer.from([0x30]), derLength(rsaKeyContent.length), rsaKeyContent]);

  const rsaOid = Buffer.from([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);

  const bitString = Buffer.concat([Buffer.from([0x03]), derLength(rsaKey.length + 1), Buffer.from([0x00]), rsaKey]);

  const spkiContent = Buffer.concat([rsaOid, bitString]);
  const spki = Buffer.concat([Buffer.from([0x30]), derLength(spkiContent.length), spkiContent]);

  return createPublicKey({ key: spki, format: "der", type: "spki" });
}
