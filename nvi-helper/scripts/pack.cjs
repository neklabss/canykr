// Dağıtım paketi: yalnızca eklentinin çalışması için gereken dosyalar (demo/test yok).
// Kullanım: node scripts/pack.cjs  →  dist/nvi-helper-<sürüm>.zip
// Bağımlılıksız; Node 22+ (zlib.crc32) gerekir.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const INCLUDE = [/^manifest\.json$/, /^src\/[\w.-]+\.(js|html|css)$/, /^icons\/[\w.-]+\.png$/, /^_locales\/.+\.json$/];

function listFiles(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, base), { withFileTypes: true })) {
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...listFiles(dir, rel));
    else if (INCLUDE.some((re) => re.test(rel))) out.push(rel);
  }
  return out.sort();
}

// Sabit zaman damgası: aynı kaynaktan her seferinde aynı zip üretilir.
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1 | ((2020 - 1980) << 9);

function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const crc = zlib.crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8); local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(deflated.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, deflated);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + deflated.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

function pack(outDir = path.join(ROOT, 'dist')) {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const files = listFiles(ROOT);
  // Manifest'in başvurduğu her dosya pakette olmalı.
  const referenced = ['src/background.js', manifest.side_panel.default_path];
  for (const r of referenced) if (!files.includes(r)) throw new Error('Pakette eksik: ' + r);
  const buf = zip(files.map((name) => ({ name, data: fs.readFileSync(path.join(ROOT, name)) })));
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `nvi-helper-${manifest.version}.zip`);
  fs.writeFileSync(out, buf);
  return { out, files };
}

module.exports = { pack, listFiles };

if (require.main === module) {
  const { out, files } = pack();
  console.log(out + '\n' + files.map((f) => '  ' + f).join('\n'));
}
