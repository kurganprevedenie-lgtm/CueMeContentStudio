import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Общий AES-256-GCM хелпер для файлов с OAuth-токенами соцсетей
// (tiktokTokenStore.ts, youtubeTokenStore.ts, instagramTokenStore.ts) —
// вынесен в одно место, чтобы шифрование не расходилось между копиями при
// будущих правках. Используется и Content Studio (apps/web), и
// autopost-worker — оба читают TOKEN_ENCRYPTION_KEY из своего .env.
function getEncryptionKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY не задан — добавь его в .env (см. .env.example) и перезапусти процесс"
    );
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY должен быть 32 байтами в hex-кодировке (64 символа)"
    );
  }
  return key;
}

/** iv(12) + authTag(16) + ciphertext — одним файлом */
export function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decrypt(data: Buffer): string {
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
