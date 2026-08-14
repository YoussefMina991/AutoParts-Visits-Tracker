import { createHash, randomBytes, timingSafeEqual, pbkdf2 } from "crypto";

const ITERATIONS = 100_000;
const KEYLEN = 64;
const DIGEST = "sha256";
const SEP = ":";

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(32).toString("hex");
    pbkdf2(password, salt, ITERATIONS, KEYLEN, DIGEST, (err, key) => {
      if (err) return reject(err);
      resolve(`${ITERATIONS}${SEP}${salt}${SEP}${key.toString("hex")}`);
    });
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const parts = hash.split(SEP);
    if (parts.length !== 3) return resolve(false);
    const [itersStr, salt, storedKey] = parts;
    const iters = parseInt(itersStr!, 10);
    pbkdf2(password, salt!, iters, KEYLEN, DIGEST, (err, key) => {
      if (err) return reject(err);
      try {
        const storedBuf = Buffer.from(storedKey!, "hex");
        resolve(timingSafeEqual(key, storedBuf));
      } catch {
        resolve(false);
      }
    });
  });
}
