const SALT = "tripulante-gestao::v1";

export function hashPassword(password: string): string {
  const input = SALT + "::" + password;
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = ((h1 * 33) ^ c) | 0;
    h2 = ((h2 * 31) + c) | 0;
  }
  const a = (h1 >>> 0).toString(36);
  const b = (h2 >>> 0).toString(36);
  return `${a}.${b}.${input.length.toString(36)}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}
