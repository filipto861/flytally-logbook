import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkDocumentation } from './check-documentation.mjs';
const cli = fileURLToPath(new URL('./check-documentation.mjs', import.meta.url));
function fixture(t, lockVersion = '3.7.0') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-doccheck-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '3.7.0' }));
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ version: lockVersion, packages: { '': { version: lockVersion } } }));
  fs.mkdirSync(path.join(root, 'docs/history'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/history/OLD.md'), '[broken](nonexistent.md)');
  fs.writeFileSync(path.join(root, 'docs/README.md'), '[root](../README.md)');
  fs.writeFileSync(path.join(root, 'README.md'), '[docs](docs/README.md)');
  return root;
}
test('valid relative links and matching package/lock versions produce no findings', t => {
  const r = checkDocumentation(fixture(t));
  assert.equal(r.issues.length, 0);
  assert.equal(r.checkedLinks, 2);
  assert.equal(r.activeFiles, 2);
});
test('history content is preserved but excluded from active link gate', t => {
  const r = checkDocumentation(fixture(t));
  assert.ok(!r.issues.some(x => x.file.startsWith('docs/history/')));
});
test('missing active relative targets are reported with source file', t => {
  const root = fixture(t);
  fs.appendFileSync(path.join(root, 'README.md'), '\n[missing](docs/missing.md)');
  assert.deepEqual(checkDocumentation(root).issues.map(x => x.type), ['missing-link-target']);
});
test('encoded square brackets resolve actual route paths', t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'app/api/map-tile/[z]/[x]/[y]'), { recursive: true });
  fs.writeFileSync(path.join(root, 'app/api/map-tile/[z]/[x]/[y]/route.ts'), 'export {};');
  fs.appendFileSync(path.join(root, 'README.md'), '\n[route](app/api/map-tile/%5Bz%5D/%5Bx%5D/%5By%5D/route.ts)');
  assert.equal(checkDocumentation(root).issues.length, 0);
});
test('version mismatch is reported and the CLI remains report-only (exit 0)', t => {
  const root = fixture(t, '3.8.0');
  const r = checkDocumentation(root);
  assert.equal(r.issues[0].type, 'version-mismatch');
  const child = spawnSync(process.execPath, [cli, '--root', root], { encoding: 'utf8' });
  assert.equal(child.status, 0);
  assert.match(child.stdout, /REPORT ONLY/);
  assert.match(child.stdout, /version-mismatch/);
});
test('an invalid root fails visibly rather than claiming zero findings', () => {
  const child = spawnSync(process.execPath, [cli, '--root', path.join(os.tmpdir(), 'impossible_ft_doccheck_does_not_exist')], { encoding: 'utf8' });
  assert.equal(child.status, 2);
});
