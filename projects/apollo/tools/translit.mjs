// Apollo romanisation: Gujarati script -> English-reader roman.
// Scheme: aa for long a, i/u for both lengths, ch for ચ and છ, sh for શ/ષ,
// anusvara as n before a consonant and silent at word end, inherent "a" dropped
// at word end and in the V C a C V position (schwa deletion).
const V = { 'અ': 'a', 'આ': 'aa', 'ઇ': 'i', 'ઈ': 'i', 'ઉ': 'u', 'ઊ': 'u', 'ઋ': 'ru', 'એ': 'e', 'ઐ': 'ai', 'ઓ': 'o', 'ઔ': 'au', 'ઍ': 'e', 'ઑ': 'o' };
const M = { 'ા': 'aa', 'િ': 'i', 'ી': 'i', 'ુ': 'u', 'ૂ': 'u', 'ૃ': 'ru', 'ે': 'e', 'ૈ': 'ai', 'ો': 'o', 'ૌ': 'au', 'ૅ': 'e', 'ૉ': 'o' };
const C = { 'ક': 'k', 'ખ': 'kh', 'ગ': 'g', 'ઘ': 'gh', 'ઙ': 'n', 'ચ': 'ch', 'છ': 'ch', 'જ': 'j', 'ઝ': 'jh', 'ઞ': 'n', 'ટ': 't', 'ઠ': 'th', 'ડ': 'd', 'ઢ': 'dh', 'ણ': 'n', 'ત': 't', 'થ': 'th', 'દ': 'd', 'ધ': 'dh', 'ન': 'n', 'પ': 'p', 'ફ': 'f', 'બ': 'b', 'ભ': 'bh', 'મ': 'm', 'ય': 'y', 'ર': 'r', 'લ': 'l', 'ળ': 'l', 'વ': 'v', 'શ': 'sh', 'ષ': 'sh', 'સ': 's', 'હ': 'h' };
const VIRAMA = '્', ANUSVARA = 'ં', CANDRA = 'ઁ', VISARGA = 'ઃ', NUKTA = '઼';

function word(w) {
  // tokenise into syllable units: {c, v, inherent}
  const u = [];
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    if (C[ch]) {
      let k = i + 1; if (w[k] === NUKTA) k++;
      if (w[k] === VIRAMA) { u.push({ c: C[ch], v: '' }); i = k; }
      else if (M[w[k]]) { u.push({ c: C[ch], v: M[w[k]] }); i = k; }
      else { u.push({ c: C[ch], v: 'a', inh: true }); i = k - 1; }
    } else if (V[ch]) u.push({ c: '', v: V[ch] });
    else if (ch === ANUSVARA || ch === CANDRA) { const last = u[u.length - 1]; if (last && last.c !== undefined) last.nasal = true; u.push({ nas: true }); }
    else if (ch === VISARGA || ch === NUKTA) continue;
    else u.push({ raw: ch });
  }
  const isSyl = x => x && x.c !== undefined;
  const hasV = x => isSyl(x) && x.v !== '';
  // final inherent a
  const sy = u.filter(isSyl);
  if (sy.length > 1 && sy[sy.length - 1].inh) sy[sy.length - 1].v = '';
  // medial schwa deletion, right to left: prev has vowel, this inherent, next is consonant with vowel
  for (let j = sy.length - 2; j >= 1; j--) {
    const prev = sy[j - 1], cur = sy[j], nxt = sy[j + 1];
    if (cur.inh && !cur.nasal && cur.v === 'a' && hasV(prev) && nxt.c && hasV(nxt)) cur.v = '';
  }
  let out = '';
  u.forEach((x, i) => {
    if (x.raw !== undefined) out += x.raw;
    else if (x.nas) { const n = u[i + 1]; out += (n && isSyl(n) && n.c) ? 'n' : ''; }
    else out += x.c + x.v;
  });
  return out;
}
export function romanise(s) { return s.split(/(\s+)/).map(t => /\s/.test(t) ? t : word(t)).join(''); }

// Loose key for comparing a hand-written roman with the converter's output.
export function key(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]/g, '').replace(/chh/g, 'ch').replace(/w/g, 'v').replace(/z/g, 'j').replace(/ee/g, 'i').replace(/oo/g, 'u')
    .replace(/([aeiou])\1+/g, '$1').replace(/([a-z])\1+/g, '$1').replace(/h/g, '').replace(/y(?=[aeiou])/g, '').replace(/\s+/g, ' ').trim();
}
export function similarity(a, b) {
  a = key(a); b = key(b);
  const m = a.length, n = b.length; if (!m && !n) return 1;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}
