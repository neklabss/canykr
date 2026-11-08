'use strict';
// Kontrol basamakları tutan SENTETİK T.C. Kimlik No üretir (ilk 9 hane verilir).
function makeTckn(first9) {
  const d = String(first9).split('').map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  d.push((((odd * 7 - even) % 10) + 10) % 10);
  d.push(d.reduce((a, b) => a + b, 0) % 10);
  return d.join('');
}
module.exports = { makeTckn };
