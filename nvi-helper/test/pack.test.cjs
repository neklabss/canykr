'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pack } = require('../scripts/pack.cjs');

test('paket yalnızca çalışma dosyalarını içerir ve geçerli bir zip’tir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nvi-pack-'));
  try {
    const { out, files } = pack(dir);
    assert.ok(files.includes('manifest.json'));
    assert.ok(files.includes('src/background.js'));
    assert.ok(files.includes('src/paste-parser.js'));
    assert.ok(files.every((f) => !/^(test|demo|scripts)\//.test(f) && !f.endsWith('.md')), 'demo/test/betik pakete girmez');
    // Manifest'in importScripts ve panel betik başvuruları pakette olmalı.
    const bg = fs.readFileSync(path.join(__dirname, '../src/background.js'), 'utf8');
    for (const m of bg.matchAll(/importScripts\(([^)]*)\)/g)) {
      for (const name of m[1].match(/'[^']+'/g)) assert.ok(files.includes('src/' + name.slice(1, -1)), name);
    }
    // Manifest'in başvurduğu her dosya (simgeler dahil) pakette olmalı.
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
    const refs = [manifest.background.service_worker, manifest.side_panel.default_path,
      ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)];
    for (const r of refs) assert.ok(files.includes(r), 'manifest başvurusu pakette: ' + r);
    const html = fs.readFileSync(path.join(__dirname, '../src/panel.html'), 'utf8');
    for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) assert.ok(files.includes('src/' + m[1]), m[1]);
    // Zip'i Python'un zipfile modülüyle (bağımsız uygulama) doğrula.
    const listed = execFileSync('python3', ['-I', '-c',
      'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print("\\n".join(z.namelist()))', out]).toString().trim().split('\n');
    assert.deepEqual(listed, files);
    const again = pack(path.join(dir, 'ikinci'));
    assert.ok(fs.readFileSync(out).equals(fs.readFileSync(again.out)), 'aynı kaynaktan aynı paket');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
