import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const KEY_LEN = 32;

/**
 * scrypt password hashing. Format: scrypt$v1$<logN>$<r>$<p>$<salt b64>$<hash b64>.
 * The version + parameters are stored so cost can be raised later (rehash on login).
 */
export class PasswordHasher {
  constructor(private readonly logN = 15, private readonly r = 8, private readonly p = 1) {}

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await this.derive(password, salt, this.logN, this.r, this.p);
    return ['scrypt', 'v1', this.logN, this.r, this.p, salt.toString('base64'), key.toString('base64')].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 7 || parts[0] !== 'scrypt' || parts[1] !== 'v1') return false;
    const [, , logN, r, p, salt, hash] = parts;
    const expected = Buffer.from(hash, 'base64');
    const actual = await this.derive(password, Buffer.from(salt, 'base64'), Number(logN), Number(r), Number(p));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  needsRehash(stored: string): boolean {
    const parts = stored.split('$');
    return parts[1] !== 'v1' || Number(parts[2]) < this.logN;
  }

  private derive(password: string, salt: Buffer, logN: number, r: number, p: number) {
    const N = 2 ** logN;
    return scrypt(password.normalize('NFKC'), salt, KEY_LEN, { N, r, p, maxmem: 256 * N * r });
  }
}

const COMMON = new Set([
  'password', 'password1', 'password123', '1234567890', '12345678910', 'qwertyuiop', 'iloveyou12', 'letmein123',
  'football12', 'backupjam1', 'backupjam123', 'guitarhero', 'musician123', '1q2w3e4r5t', 'qwerty1234', 'aaaaaaaaaa',
]);

/** Length-first policy (NIST SP 800-63B): 10–128 chars, not trivially common, not the email. */
export function passwordProblems(password: string, email?: string | null): string[] {
  const problems: string[] = [];
  if (password.length < 10) problems.push('too_short');
  if (password.length > 128) problems.push('too_long');
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) problems.push('too_common');
  const local = email?.toLowerCase().split('@')[0] ?? '';
  if (local.length >= 4 && lower.includes(local)) problems.push('contains_email');
  return problems;
}
