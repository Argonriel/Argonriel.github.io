import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const courses = [
  {id: '115a', folder: '115A', code: '115A', title: 'Linear Algebra I', description: 'Vector spaces, linear maps, eigenvalues, and inner products.'},
  {id: '115b', folder: '115B', code: '115B', title: 'Linear Algebra II', description: 'Duality, quotient spaces, Jordan form, and quadratic forms.'},
  {id: '131a', folder: '131A_Iqra', code: '131A', title: 'Real Analysis I', description: 'Completeness, sequences, topology, continuity, and differentiation.'},
  {id: '131b', folder: '131B_Inwon', code: '131B', title: 'Real Analysis II', description: 'Metric spaces, integration, function spaces, and Fourier analysis.'},
  {id: '132', folder: '132', code: '132', title: 'Complex Analysis', description: 'Holomorphic functions, Cauchy theory, series, and residues.'}
];
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
export const unescapeHtml = value => value.replace(/&#(\d+);|&(?:amp|lt|gt|quot|#39);/g, (m, n) => n ? String.fromCodePoint(Number(n)) : ({'&amp;':'&', '&lt;':'<', '&gt;':'>', '&quot;':'"', '&#39;':"'"}[m]));
export const slug = value => value.normalize('NFKD').replace(/\p{Mark}/gu, '').toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-|-$/g, '');
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export const mathPattern = () => /\$\$([\s\S]+?)\$\$|(?<!\\)\$(?!\$)([^\n$]+?)(?<!\\)\$/g;
export const normalizeTex = text => text.replace(/^\s*> ?/gm, '').trim();
export function contentOf(raw) {
  let text = raw.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
  let tags = [];
  text = text.replace(/^---\n([\s\S]*?)\n---\n/, (_, frontmatter) => {
    const inline = frontmatter.match(/^tags:\s*\[(.+)\]/m);
    tags = inline ? inline[1].split(',').map(x => x.trim()) : [...frontmatter.matchAll(/^\s+-\s+(.+)$/gm)].map(m => m[1]);
    return '';
  });
  text = text.replace(/^# .+\n/, '').replace(/^返回 .+\n/gm, '').replace(/^(?:MOC|Source): .+\n/gm, '').trim();
  return {text, tags};
}
export function readNotes(vault) {
  const notes = [];
  for (const course of courses) {
    for (const file of fs.readdirSync(path.join(vault, course.folder)).filter(f => f.endsWith('.md')).sort()) {
      const source = `${course.folder}/${file}`;
      const raw = fs.readFileSync(path.join(vault, source), 'utf8');
      const title = file.slice(0, -3);
      const isCourse = title === course.code;
      notes.push({source, raw, title: isCourse ? `${course.code} · ${course.title}` : title,
        name: title, course, isCourse, ...contentOf(raw),
        url: isCourse ? `/math/courses/${course.id}/` : `/math/notes/${course.id}/${slug(title)}/`});
    }
  }
  const source = 'Compactness and continuity.md';
  const raw = fs.readFileSync(path.join(vault, source), 'utf8');
  notes.push({source, raw, name: source.slice(0, -3), title: source.slice(0, -3), isCourse: false,
    course: null, ...contentOf(raw), url: '/math/notes/compactness-and-continuity/'});
  if (new Set(notes.map(n => n.url)).size !== notes.length) throw new Error('Duplicate note URL');
  return notes;
}
export function writeFile(relative, content) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) throw new Error('Output outside repository');
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, content);
}
