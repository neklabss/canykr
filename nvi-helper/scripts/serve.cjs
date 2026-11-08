// Bağımlılıksız statik sunucu: demo ve tarayıcı testleri için.
// Yalnızca 127.0.0.1'e bağlanır; dışarıya açılmaz.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

function start(port = 0) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/demo/demo.html';
    const file = path.resolve(ROOT, '.' + p);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

module.exports = { start, ROOT };

if (require.main === module) {
  const port = Number(process.env.PORT || 8765);
  start(port).then((s) => {
    console.log('Demo: http://127.0.0.1:' + s.address().port + '/');
  });
}
