// Lists the source files under frontend/src that nothing reachable from src/main.tsx imports (static or dynamic
// `import()` with a literal path). Tests are not roots: a file only a test imports is unreachable.
//
//   cd frontend && node ../docs/sync/tools/unreachable.mjs . | grep ^unreached
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src');
const exts = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
const resolve = (from, spec) => {
  let base;
  if (spec.startsWith('@/')) base = path.join(root, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null;
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const e of exts) if (fs.existsSync(base + e)) return base + e;
  return null;
};
const re = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;
const seen = new Set();
const stack = [path.join(root, 'main.tsx')];
while (stack.length) {
  const f = stack.pop();
  if (seen.has(f)) continue;
  seen.add(f);
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(re)) {
    const r = resolve(f, m[1] || m[2] || m[3]);
    if (r && !seen.has(r)) stack.push(r);
  }
}
const all = [];
const walk = (d) => {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    fs.statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) && all.push(p);
  }
};
for (const d of process.argv.slice(2)) walk(path.join(root, d));
for (const f of all.sort()) console.log((seen.has(f) ? 'REACHED   ' : 'unreached ') + path.relative(root, f));
