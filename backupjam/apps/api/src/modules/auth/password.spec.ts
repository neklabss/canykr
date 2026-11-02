import { PasswordHasher, passwordProblems } from './password';

describe('PasswordHasher', () => {
  const h = new PasswordHasher(12);
  it('hashes with unique salts and verifies', async () => {
    const a = await h.hash('correct horse battery staple');
    const b = await h.hash('correct horse battery staple');
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$v1$12$8$1$')).toBe(true);
    await expect(h.verify('correct horse battery staple', a)).resolves.toBe(true);
    await expect(h.verify('Correct horse battery staple', a)).resolves.toBe(false);
  });
  it('normalises Unicode (NFKC) so composed/decomposed input matches', async () => {
    const hash = await h.hash('şifre-güçlü-123');
    await expect(h.verify('şifre-güçlü-123'.normalize('NFD'), hash)).resolves.toBe(true);
  });
  it('rejects malformed hashes and flags weaker cost for rehash', async () => {
    await expect(h.verify('x', 'bcrypt$whatever')).resolves.toBe(false);
    expect(new PasswordHasher(15).needsRehash(await h.hash('abcdefghijk'))).toBe(true);
  });
  it('applies the length-first policy', () => {
    expect(passwordProblems('short')).toContain('too_short');
    expect(passwordProblems('qwertyuiop')).toContain('too_common');
    expect(passwordProblems('ayla.drums.forever', 'ayla.drums@x.com')).toContain('contains_email');
    expect(passwordProblems('a sensible long passphrase')).toEqual([]);
  });
});
