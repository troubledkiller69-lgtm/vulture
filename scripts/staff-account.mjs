import { createInterface } from 'node:readline/promises';
import { writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { passwordHash } from '../src/accounts.mjs';

const [email = '', name = ''] = process.argv.slice(2);
const cleanEmail = email.trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) {
  console.error('Usage: npm run staff:create -- email@example.com "Display Name"');
  process.exit(1);
}
const cleanName = (name.trim() || cleanEmail.split('@')[0]).slice(0, 80);

const terminal = process.env.STAFF_PASSWORD ? null : createInterface({ input: process.stdin, output: process.stdout });
const password = process.env.STAFF_PASSWORD || await terminal.question('Staff password (12+ characters): ');
if (!process.env.STAFF_PASSWORD) {
  const confirm = await terminal.question('Repeat password: ');
  terminal.close();
  if (password !== confirm) {
    console.error('Passwords did not match.');
    process.exit(1);
  }
}
if (password.length < 12 || password.length > 128) {
  console.error('Password must be 12 to 128 characters.');
  process.exit(1);
}

const sql = `INSERT INTO staff_users (email, name, password_hash) VALUES ('${cleanEmail.replaceAll("'", "''")}', '${cleanName.replaceAll("'", "''")}', '${await passwordHash(password)}') ON CONFLICT(email) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash, active = 1;\n`;
const file = new URL('../.staff-account.sql', import.meta.url);
await writeFile(file, sql);
try {
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'd1', 'execute', 'vulture-orders', '--remote', `--file=${file.pathname.slice(1)}`], { stdio: 'inherit' });
  console.log(`Staff account ready for ${cleanEmail}.`);
} finally {
  await unlink(file).catch(() => {});
}
