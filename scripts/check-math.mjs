import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root, readNotes, unescapeHtml, sha256, mathPattern, normalizeTex} from './math-content.mjs';

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'math/data/manifest.json'), 'utf8'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pages = new Map(['index.html', ...manifest.generated.filter(f => f.endsWith('.html'))].map(file => [file, read(file)]));
const ids = new Map();
let linkCount = 0;
let formulaCount = 0;
for (const [file, html] of pages) {
  const found = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => unescapeHtml(m[1]));
  assert.equal(new Set(found).size, found.length, `Duplicate IDs: ${file}`);
  ids.set(file, new Set(found));
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `One page title: ${file}`);
  assert(!/VAULTTOKEN\d+END|\[\[|data-mjx-error|data-mml-node="merror"/.test(html), `Unrendered content: ${file}`);
  assert(!/C:\\Users|file:\/\/|\.obsidian|Review-20|Review-115|Review-132/.test(html), `Private source leaked: ${file}`);
  const formulas = [...html.matchAll(/class="formula(?: formula-block)?" data-tex="([^"]*)" data-display="(true|false)"/g)];
  formulaCount += formulas.length;
  assert.equal((html.match(/<mjx-assistive-mml /g) || []).length, formulas.length, `Accessible math: ${file}`);
  if (file.startsWith('math/')) {
    assert.equal((html.match(/<mjx-container /g) || []).length, formulas.length, `Formula output count: ${file}`);
    assert(!/<script[^>]+src="https?:/.test(html), `External runtime: ${file}`);
  }
}
for (const [file, html] of pages) {
  for (const [, raw] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const target = new URL(unescapeHtml(raw), `https://local.invalid/${file}`);
    if (target.origin !== 'https://local.invalid') continue;
    let pathname = decodeURIComponent(target.pathname).slice(1);
    if (pathname.endsWith('/') || !pathname) pathname += 'index.html';
    const resolved = path.resolve(root, pathname);
    assert(resolved.startsWith(root + path.sep), `Unsafe link: ${file}: ${raw}`);
    assert(fs.existsSync(resolved), `Missing file: ${file}: ${raw}`);
    if (target.hash && ids.has(pathname)) {
      assert(ids.get(pathname).has(decodeURIComponent(target.hash.slice(1))), `Missing anchor: ${file}: ${raw}`);
    }
    linkCount++;
  }
}
const search = JSON.parse(read('math/data/search-index.json'));
const topics = manifest.pages.filter(p => !p.isCourse);
assert.equal(search.length, topics.length, 'Search contains every topic');
assert.equal(new Set(search.map(n => n.url)).size, search.length, 'Unique search URLs');
for (const item of search) {
  assert(topics.some(n => n.url === item.url && n.title === item.title), `Unexpected search entry: ${item.title}`);
  assert(item.text.length > 20, `Searchable content: ${item.title}`);
}
assert.equal(formulaCount, manifest.formulaCount, 'Every formula appears in generated pages');
for (const file of manifest.generated) {
  assert(!/\.pdf$|\.md$|\.obsidian|Review-|Clean\//.test(file), `Unapproved export: ${file}`);
  assert(fs.existsSync(path.join(root, file)), `Missing generated file: ${file}`);
}
const args = process.argv.slice(2);
if (args.length) {
  assert(args.length === 2 && args[0] === '--vault', 'Usage: node scripts/check-math.mjs [--vault /path/to/Mathematics]');
  const notes = readNotes(path.resolve(args[1]));
  assert.equal(notes.length, manifest.pages.length, 'Source page count');
  for (const note of notes) {
    const record = manifest.pages.find(p => p.source === note.source);
    assert(record, `Unexported note: ${note.source}`);
    assert.equal(record.sha256, sha256(note.raw.replace(/\r\n/g, '\n')), `Source changed: ${note.source}`);
    const expected = [...note.text.matchAll(mathPattern())].map(m => ({tex: normalizeTex(m[1] ?? m[2]), display: m[1] !== undefined}));
    const html = pages.get(note.url.slice(1) + 'index.html');
    const actual = [...html.matchAll(/class="formula(?: formula-block)?" data-tex="([^"]*)" data-display="(true|false)"/g)].map(m => ({tex: unescapeHtml(m[1]), display: m[2] === 'true'}));
    assert.deepEqual(actual, expected, `TeX changed: ${note.source}`);
  }
}
console.log(JSON.stringify({pages: pages.size, topicNotes: manifest.topicNotes, courseIndexes: manifest.pages.filter(p => p.isCourse).length, crossCourseGuides: manifest.crossCourseGuides, formulas: formulaCount, internalLinksAndSvgReferences: linkCount, searchEntries: search.length, sourceVerified: Boolean(args.length), errors: []}, null, 2));
