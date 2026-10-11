import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const cost = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 };
const pattern =
  /^scrypt\$1\$131072\$8\$1\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{43})$/;
let active = false;

export class AuthenticationBusy extends Error {
  constructor() {
    super("AUTHENTICATION_BUSY");
  }
}
function derive(password: Buffer, salt: Buffer): Promise<Buffer> {
  if (active) return Promise.reject(new AuthenticationBusy());
  active = true;
  return new Promise<Buffer>((resolve, reject) => {
    try {
      scrypt(password, salt, 32, cost, (error, key) => {
        active = false;
        if (error) reject(new Error("PASSWORD_KDF_FAILED"));
        else resolve(key);
      });
    } catch {
      active = false;
      reject(new Error("PASSWORD_KDF_FAILED"));
    }
  });
}
function passwordBytes(value: unknown): Buffer | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1024 ||
    /[\uD800-\uDFFF]/u.test(value)
  )
    return null;
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > 1024) {
    bytes.fill(0);
    return null;
  }
  return bytes;
}
export async function hashPassword(password: string): Promise<string> {
  const bytes = passwordBytes(password);
  if (!bytes || Array.from(password).length < 15) {
    bytes?.fill(0);
    throw new Error("INVALID_NEW_PASSWORD");
  }
  const salt = randomBytes(16);
  try {
    const key = await derive(bytes, salt);
    try {
      return [
        "scrypt",
        "1",
        "131072",
        "8",
        "1",
        salt.toString("base64url"),
        key.toString("base64url"),
      ].join("$");
    } finally {
      key.fill(0);
    }
  } finally {
    bytes.fill(0);
  }
}
export async function verifyPassword(
  password: unknown,
  encoded: unknown,
): Promise<boolean> {
  const bytes = passwordBytes(password);
  if (!bytes) return false;
  const match =
    typeof encoded === "string" && encoded.length < 200
      ? pattern.exec(encoded)
      : null;
  let salt = Buffer.alloc(16);
  let expected = Buffer.alloc(32);
  let valid = false;
  if (match) {
    const parsedSalt = Buffer.from(match[1] as string, "base64url");
    const parsedKey = Buffer.from(match[2] as string, "base64url");
    if (
      parsedSalt.length === 16 &&
      parsedKey.length === 32 &&
      parsedSalt.toString("base64url") === match[1] &&
      parsedKey.toString("base64url") === match[2]
    ) {
      salt = parsedSalt;
      expected = parsedKey;
      valid = true;
    }
  }
  // Absent/corrupt/unsupported records perform the same bounded KDF work.
  // Never execute cost parameters supplied by an encoded record.
  try {
    const actual = await derive(bytes, salt);
    try {
      const equal = timingSafeEqual(actual, expected);
      return valid && equal;
    } finally {
      actual.fill(0);
    }
  } finally {
    bytes.fill(0);
    expected.fill(0);
  }
}
