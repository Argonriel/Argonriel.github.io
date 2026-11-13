import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import MarkdownIt from 'markdown-it';
import {root, courses, readNotes, writeFile, escapeHtml as e, slug, sha256, mathPattern, normalizeTex} from './math-content.mjs';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--vault') throw new Error('Usage: node scripts/sync-math.mjs --vault /path/to/Mathematics');
const vault = path.resolve(args[1]);
const git = (...a) => execFileSync('git', ['-C', vault, ...a], {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
const commit = git('rev-parse', 'HEAD').trim();
const sourceDate = git('show', '-s', '--format=%cs', 'HEAD').trim();
const notes = readNotes(vault);
// Publish only reviewed, committed Markdown. Other vault files are never copied.
for (const note of notes) {
  const committed = git('show', `${commit}:${note.source}`).replace(/\r\n/g, '\n');
  if (committed !== note.raw.replace(/\r\n/g, '\n')) throw new Error(`Uncommitted source: ${note.source}`);
}
const require = createRequire(import.meta.url);
const MathJax = require('mathjax');
await MathJax.init({
  loader: {load: ['input/tex', 'output/svg', 'a11y/assistive-mml'], require: createRequire(require.resolve('mathjax'))},
  svg: {fontCache: 'local'},
  // Enable on the document after setup: a static build has no MathJax menu.
  options: {enableAssistiveMml: false}
});
if (!MathJax.tex2svgPromise) throw new Error('MathJax failed to initialize');
MathJax.startup.document.options.enableAssistiveMml = true;
const adaptor = MathJax.startup.adaptor;
const byName = new Map(notes.flatMap(n => [[n.name, n], [n.source.replace(/\.md$/, ''), n]]));
const pdfNames = new Set(['115A_clean.pdf', '115B_clean.pdf', '131A_clean.pdf', '131B_clean.pdf', '132+notes.pdf', '132小抄儿_final.pdf']);
const formulas = [];
const edges = new Map(notes.map(n => [n.url, new Set()]));
const sourcePages = new Set();
const generated = new Map();
const add = (file, data) => generated.set(file, data);
const md = new MarkdownIt({html: false, linkify: false, typographer: false});
md.renderer.rules.blockquote_open = () => '<blockquote class="callout">\n';
md.renderer.rules.table_open = () => '<div class="table-scroll" tabindex="0" role="region" aria-label="Comparison table"><table>\n';
md.renderer.rules.table_close = () => '</table></div>\n';

async function renderNote(note) {
  const held = [];
  const hold = (html, plain = '') => {
    const token = `VAULTTOKEN${held.length}END`;
    held.push({html, plain});
    return token;
  };
  function restore(text, kind = 'html') {
    for (let pass = 0; pass < 4 && /VAULTTOKEN\d+END/.test(text); pass++)
      text = text.replace(/VAULTTOKEN(\d+)END/g, (_, index) => held[Number(index)][kind]);
    return text;
  }
  let text = note.text;
  // Protect TeX before Markdown consumes backslashes, underscores, and table pipes.
  let protectedText = '';
  let offset = 0;
  for (const match of text.matchAll(mathPattern())) {
    const tex = normalizeTex(match[1] ?? match[2]);
    const display = match[1] !== undefined;
    const node = await MathJax.tex2svgPromise(tex, {display});
    const rendered = adaptor.outerHTML(node);
    if (/data-mjx-error|data-mml-node="merror"/.test(rendered)) throw new Error(`Invalid TeX in ${note.source}: ${tex}`);
    formulas.push({file: note.source, tex, display});
    protectedText += text.slice(offset, match.index) + hold(`<span class="formula${display ? ' formula-block' : ''}" data-tex="${e(tex)}" data-display="${display}">${rendered}</span>`, tex);
    offset = match.index + match[0].length;
  }
  text = protectedText + text.slice(offset);
  text = text.replace(/^> \[!([\w-]+)\]\s*(.*)$/gm, (_, type, title) => `> **${title || type[0].toUpperCase() + type.slice(1)}**\n>`);
  text = text.replace(/^\^([\w-]+)\s*$/gm, (_, id) => hold(`<span id="block-${e(id)}" class="block-anchor"></span>`));
  text = text.replace(/!?\[\[([^\]]+)\]\]/g, (_, content) => {
    const pipe = content.indexOf('|');
    const target = (pipe < 0 ? content : content.slice(0, pipe)).trim();
    const [filename, fragment = ''] = target.split('#');
    const name = filename.replace(/\.md$/, '');
    const label = pipe < 0 ? (fragment && !filename ? fragment : name) : content.slice(pipe + 1);
    if (pdfNames.has(path.posix.basename(filename))) {
      const page = fragment.match(/^page=(\d+)$/)?.[1];
      if (fragment && !page) throw new Error(`Unsupported PDF reference: ${target}`);
      sourcePages.add(target);
      return hold(`<span class="source-citation" title="${e(filename + (page ? `, page ${page}` : ''))}">${e(label)}${pipe < 0 && page ? `, p. ${page}` : ''}</span>`, label);
    }
    const linked = filename ? byName.get(name) : note;
    const url = name === 'README' ? '/math/' : linked?.url;
    if (!url) throw new Error(`Unpublished link in ${note.source}: ${target}`);
    const hash = fragment ? '#' + (fragment.startsWith('^') ? `block-${fragment.slice(1)}` : slug(restore(fragment, 'plain'))) : '';
    if (linked && linked.url !== note.url) edges.get(note.url).add(linked.url);
    return hold(`<a href="${e(url + hash)}">${e(label)}</a>`, label);
  });
  const tokens = md.parse(text, {});
  const headings = [];
  const seen = new Set();
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'heading_open') continue;
    const label = restore(tokens[i + 1].content, 'plain').replace(/[*`]/g, '');
    const base = slug(label);
    let id = base;
    let suffix = 2;
    while (seen.has(id)) id = `${base}-${suffix++}`;
    seen.add(id);
    tokens[i].attrSet('id', id);
    if (tokens[i].tag === 'h2') headings.push({id, label});
  }
  note.headings = headings;
  note.html = restore(md.renderer.render(tokens, md.options, {}));
  note.searchText = restore(text, 'plain').replace(/[*#>`]/g, '').replace(/\s+/g, ' ').trim();
}
for (const note of notes) await renderNote(note);

function header() {
  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header"><a class="site-name" href="/">Jiayi Liwei</a><nav aria-label="Main navigation"><a href="/#research">Research</a><a href="/#teaching">Teaching</a><a href="/math/" aria-current="true">Mathematics</a><a href="/files/cv.pdf">CV</a></nav></header>`;
}
function page({title, description, url, body, search = false}) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(title)} | Jiayi Liwei</title><meta name="description" content="${e(description)}"><link rel="canonical" href="https://argonriel.com${url}"><meta property="og:type" content="website"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="https://argonriel.com${url}"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/math/assets/math.css"><link rel="stylesheet" href="/math/assets/formulas.css">${search ? '<script src="/math/assets/search.js" defer></script>' : ''}</head>
<body class="math-site">${header()}${body}<footer class="site-footer"><p>© 2026 Jiayi Liwei</p><p>Mathematics notes · Updated ${e(sourceDate)}</p></footer></body></html>\n`;
}
const courseList = active => `<nav class="course-nav" aria-label="Courses"><a href="/math/">All notes</a>${courses.map(c => `<a href="/math/courses/${c.id}/"${c.id === active ? ' aria-current="page"' : ''}><span>${c.code}</span> ${e(c.title)}</a>`).join('')}</nav>`;
for (const note of notes) {
  const backlinks = notes.filter(other => !other.isCourse && edges.get(other.url).has(note.url));
  const toc = note.headings.length ? `<nav class="toc" aria-label="On this page"><p class="rail-label">On this page</p>${note.headings.map(h => `<a href="#${h.id}">${e(h.label)}</a>`).join('')}</nav>` : '';
  const description = note.isCourse ? note.course.description : `${note.title}: definitions, hypotheses, proof ideas, and examples${note.course ? ` from MATH ${note.course.code}` : ''}.`;
  const body = `<main id="main" class="math-container"><div class="breadcrumbs"><a href="/math/">Mathematics</a>${note.course && !note.isCourse ? `<span aria-hidden="true">/</span><a href="/math/courses/${note.course.id}/">${note.course.code}</a>` : ''}</div><div class="reader-layout"><aside class="reader-rail">${courseList(note.course?.id)}${toc}<a class="rail-search" href="/math/#find-note">Search notes →</a></aside><div class="reader-main"><article class="note"><header class="note-header"><p class="eyebrow">${note.isCourse ? 'Course index' : note.course ? `MATH ${note.course.code} · ${e(note.course.title)}` : 'Connections across courses'}</p><h1>${e(note.title)}</h1>${note.tags.length ? `<p class="note-tags">${note.tags.map(t => `<span>${e(t)}</span>`).join('')}</p>` : ''}</header><div class="note-content">${note.html}</div></article>${!note.isCourse && backlinks.length ? `<section class="backlinks" aria-labelledby="linked-notes"><h2 id="linked-notes">Notes linking here</h2><ul>${backlinks.map(n => `<li><a href="${n.url}">${e(n.title)}</a>${n.course ? `<span class="link-course">${n.course.code}</span>` : ''}</li>`).join('')}</ul></section>` : ''}<p class="reader-return"><a href="${note.course ? `/math/courses/${note.course.id}/` : '/math/'}">← ${note.course ? `${note.course.code} course index` : 'All mathematics notes'}</a></p></div></div></main>`;
  add(`${note.url.slice(1)}index.html`, page({title: note.title, description, url: note.url, body}));
}
const topics = notes.filter(n => !n.isCourse);
const catalog = [...topics].sort((a, b) => a.title.localeCompare(b.title, 'en'));
const searchData = catalog.map(n => ({title: n.title, url: n.url, course: n.course?.id ?? 'connections', tags: n.tags, text: n.searchText}));
const counts = Object.fromEntries(courses.map(c => [c.id, topics.filter(n => n.course?.id === c.id).length]));
const landingBody = `<main class="math-container" id="main"><section class="math-hero"><p class="eyebrow">Definitions · Theorems · Proof ideas</p><h1>Mathematics</h1><p class="math-intro">A connected collection of course notes in linear algebra, real analysis, and complex analysis.</p><p class="collection-meta">${topics.length - 1} topic notes · ${courses.length} courses · 1 cross-course guide</p></section><section aria-labelledby="courses-title"><div class="section-heading"><h2 id="courses-title">Browse by course</h2><p>Start with the hypotheses. Follow the connections.</p></div><div class="course-grid">${courses.map(c => `<a class="course-card" href="/math/courses/${c.id}/"><span class="course-code">MATH ${c.code}</span><h3>${e(c.title)}</h3><p>${e(c.description)}</p><span class="course-count">${counts[c.id]} notes <span aria-hidden="true">↗</span></span></a>`).join('')}</div></section><aside class="reading-guide"><p class="eyebrow">Across courses</p><a href="/math/notes/compactness-and-continuity/">Compactness → Continuity → Uniform continuity <span aria-hidden="true">↗</span></a><p>A guide to the assumptions, proof routes, and counterexamples that connect these ideas.</p></aside><section id="find-note" aria-labelledby="find-title"><div class="section-heading"><h2 id="find-title">Find a note</h2><p>Browse the collection or search by title, concept, or theorem.</p></div><form id="note-search" role="search" hidden><div><label for="query">Search notes</label><input id="query" name="q" type="search" placeholder="Try “Cauchy” or “compactness”" autocomplete="off"></div><div><label for="course-filter">Course</label><select id="course-filter" name="course"><option value="">All courses</option>${courses.map(c => `<option value="${c.id}">${c.code} · ${e(c.title)}</option>`).join('')}<option value="connections">Across courses</option></select></div><button type="reset">Clear</button></form><p id="result-count" class="result-count" role="status" aria-live="polite">${topics.length} notes and guides</p><p id="no-results" hidden>No notes match this search. Try another term or choose all courses.</p><ul class="note-catalog" id="note-catalog">${catalog.map(n => `<li data-url="${n.url}"><a href="${n.url}">${e(n.title)}</a><span>${n.course?.code ?? 'Guide'}</span></li>`).join('')}</ul><noscript><p>All notes are listed above. You can also browse each course index.</p></noscript></section></main>`;
add('math/index.html', page({title: 'Mathematics', description: 'Connected notes in linear algebra, real analysis, and complex analysis, with definitions, theorems, proof ideas, and examples.', url: '/math/', body: landingBody, search: true}));
add('math/data/search-index.json', JSON.stringify(searchData));
const css = adaptor.outerHTML(MathJax.svgStylesheet()).replace(/^<style[^>]*>\n?/, '').replace(/<\/style>$/, '');
add('math/assets/formulas.css', `/* Generated by MathJax ${MathJax.version}. */\n${css.trimEnd()}\n`);
const manifest = {
  source: 'Argonriel/Mathematics', commit, date: sourceDate, mathjax: MathJax.version,
  courses: counts, topicNotes: topics.length - 1, crossCourseGuides: 1, formulaCount: formulas.length,
  noteLinks: [...edges.values()].reduce((sum, set) => sum + set.size, 0), sourceReferences: sourcePages.size,
  pages: notes.map(n => ({source: n.source, sha256: sha256(n.raw.replace(/\r\n/g, '\n')), url: n.url, title: n.title, isCourse: n.isCourse, formulas: formulas.filter(f => f.file === n.source).length})),
  generated: [...generated.keys()].sort()
};
// Remove only obsolete files explicitly owned by the previous manifest, never a whole directory.
const manifestPath = path.join(root, 'math/data/manifest.json');
if (fs.existsSync(manifestPath)) {
  for (const file of JSON.parse(fs.readFileSync(manifestPath, 'utf8')).generated) {
    if (generated.has(file)) continue;
    const target = path.resolve(root, file);
    if (!file.startsWith('math/') || !target.startsWith(path.join(root, 'math') + path.sep)) throw new Error('Unsafe stale output');
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
}
for (const [file, content] of generated) writeFile(file, content);
writeFile('math/data/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
writeFile('.preview/formulas.json', JSON.stringify(formulas));
console.log(JSON.stringify({commit, courses: counts, pages: notes.length + 1, formulas: formulas.length, noteLinks: manifest.noteLinks, bytes: [...generated.values()].reduce((s, v) => s + Buffer.byteLength(v), 0)}, null, 2));
