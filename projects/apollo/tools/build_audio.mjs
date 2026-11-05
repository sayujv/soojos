// Render every Gujarati line in the app to speech and pack it for the artifact.
// Usage: node projects/apollo/tools/build_audio.mjs
// Needs: pip install espeakng-loader ; ffmpeg. Clips are cached by content hash in tools/.audio-cache.
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), app = path.join(here, '..', 'app');
const w = {};
vm.runInNewContext(fs.readFileSync(path.join(app, 'data.js'), 'utf8'), { window: w });
vm.runInNewContext(fs.readFileSync(path.join(app, 'grammar.js'), 'utf8'), { window: w });
vm.runInNewContext(fs.readFileSync(path.join(app, 'speech.js'), 'utf8'), { window: w });
const D = w.APOLLO_DATA, G = w.APOLLO_GRAMMAR, texts = new Set();
for (const p of D.phrases) { texts.add(p.g); if (p.f && p.f.g) texts.add(p.f.g); }
for (const s of D.scenes) for (const st of s.steps) if (st.say) texts.add(st.say);
for (const pt of G.patterns) for (const r of pt.rows) texts.add(r[1]);
for (const st of G.stories) for (const l of st.lines) texts.add(l.g);
const SP = w.APOLLO_SPEECH;
for (const ld of SP.ladders) for (const rg of ld.rungs) texts.add(rg.g);
for (const it of SP.gym) { texts.add(it[1]); if (it[4]) texts.add(it[4][1]); }
const cache = path.join(here, '.audio-cache'); fs.mkdirSync(cache, { recursive: true });
const jobs = path.join(cache, 'jobs.json');
fs.writeFileSync(jobs, JSON.stringify([...texts].map(g => ({ g }))));
execFileSync('python3', [path.join(here, 'speak_gu.py'), jobs, cache], { stdio: 'inherit' });
const manifest = JSON.parse(fs.readFileSync(path.join(cache, 'manifest.json'), 'utf8'));
const out = path.join(app, 'audio'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
const map = {}, packs = {};
for (const [g, fn] of Object.entries(manifest)) {
  if (!texts.has(g)) continue;
  const hsh = fn.replace('.mp3', ''); map[g] = hsh;
  const k = 'pack-' + hsh[0] + '.json';
  (packs[k] = packs[k] || {})[hsh] = fs.readFileSync(path.join(cache, fn)).toString('base64');
}
for (const [k, v] of Object.entries(packs)) fs.writeFileSync(path.join(out, k), JSON.stringify(v));
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({ voice: 'eSpeak NG gu', map, packs: Object.keys(packs).sort() }));
const bytes = fs.readdirSync(out).reduce((n, f) => n + fs.statSync(path.join(out, f)).size, 0);
console.log(`${Object.keys(map).length} clips in ${Object.keys(packs).length} packs, ${(bytes / 1e6).toFixed(2)} MB`);
