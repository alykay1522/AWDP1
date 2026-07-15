/**
 * Password hashing with Node's built-in scrypt — no external dependencies.
 * Stored format: scrypt$N$r$p$<salt b64url>$<hash b64url>
 */
import crypto from "crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SALT_BYTES = 16;

function scryptAsync(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LEN, { N, r, p, maxmem: 128 * 1024 * 1024 }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const N = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
    const salt = Buffer.from(parts[4], "base64url");
    const expected = Buffer.from(parts[5], "base64url");
    const actual = await scryptAsync(password, salt, N, r, p);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
