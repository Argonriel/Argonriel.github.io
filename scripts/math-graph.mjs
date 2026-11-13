import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY} from 'd3-force';
import {courses, escapeHtml as e} from './math-content.mjs';

export const graphId = note => note.url.replace(/^\/math\//, '').replace(/\/$/, '');
const groups = [
  {id: '115a', color: '#d8b17c', x: -340, y: -170},
  {id: '115b', color: '#dc9383', x: -310, y: 210},
  {id: '131a', color: '#93bbaa', x: 290, y: -210},
  {id: '131b', color: '#8faed7', x: 330, y: 180},
  {id: '132', color: '#bba5df', x: 0, y: 80},
  {id: 'connections', color: '#eee4ce', x: 0, y: -100}
];
export function buildGraph(notes, edges) {
  const nodes = notes.map((note, i) => {
    const group = groups.find(g => g.id === (note.course?.id ?? 'connections'));
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    return {id: graphId(note), url: note.url, title: note.title, label: note.isCourse ? note.course.code : note.title,
      course: group.id, kind: note.isCourse ? 'course' : note.course ? 'note' : 'guide', tags: note.tags,
      color: group.color, cx: group.x, cy: group.y, x: group.x + 100 * Math.cos(angle), y: group.y + 100 * Math.sin(angle), degree: 0};
  });
  const byUrl = new Map(nodes.map(n => [n.url, n]));
  const unique = new Map();
  for (const [source, targets] of edges) for (const target of targets) {
    const from = byUrl.get(source), to = byUrl.get(target);
    if (!from || !to || from === to) continue;
    const pair = [from.id, to.id].sort();
    const key = pair.join('|');
    if (unique.has(key)) unique.get(key).mutual = true;
    else unique.set(key, {source: pair[0], target: pair[1], mutual: false});
  }
  const links = [...unique.values()];
  const byId = new Map(nodes.map(n => [n.id, n]));
  for (const link of links) {byId.get(link.source).degree++; byId.get(link.target).degree++;}
  const simulation = forceSimulation(nodes)
    .force('link', forceLink(links.map(l => ({...l}))).id(n => n.id).distance(l => l.source.course === l.target.course ? 64 : 110).strength(.13))
    .force('charge', forceManyBody().strength(-155))
    .force('collide', forceCollide().radius(n => n.kind === 'course' ? 29 : 20))
    .force('x', forceX(n => n.cx).strength(.025))
    .force('y', forceY(n => n.cy).strength(.09)).stop();
  simulation.tick(500);
  return {nodes: nodes.map(({index, vx, vy, ...node}) => ({...node, x: +node.x.toFixed(3), y: +node.y.toFixed(3)})), links,
    groups: groups.map(g => ({...g, label: courses.find(c => c.id === g.id)?.code ?? 'Across courses', title: courses.find(c => c.id === g.id)?.title ?? 'Cross-course guide'}))};
}
export function graphMarkup(graph) {
  return `<section class="network-intro" aria-labelledby="network-title"><div><p class="eyebrow">数学网络</p><h1 id="network-title">Mathematics network</h1></div><p>Follow an idea.<br>See what it connects to.</p></section>
<section class="network-shell" id="network" aria-label="Interactive mathematics network">
<div class="network-toolbar"><div class="network-search"><label for="graph-query" class="sr-only">Find a node</label><span aria-hidden="true">⌕</span><input id="graph-query" type="search" placeholder="Find a concept…" autocomplete="off" aria-controls="graph-search-results"><div id="graph-search-results" class="graph-search-results" hidden></div></div><div class="network-actions"><label class="graph-label-toggle"><input type="checkbox" id="graph-labels" checked> Labels</label><button id="graph-multi" type="button" aria-pressed="false" title="Keep several nodes selected. Shift-click also works.">Multi-select</button><button id="graph-clear" type="button">Clear focus</button><a href="#browse-notes" id="browse-list-link">List view <span aria-hidden="true">↗</span></a></div></div>
<div class="graph-workspace"><div class="graph-stage" id="graph-stage"><svg id="math-graph" role="group" aria-label="Mathematics note network" aria-describedby="graph-help" tabindex="0"><g id="graph-camera"><g id="graph-edges" aria-hidden="true"></g><g id="graph-nodes"></g></g></svg><p id="graph-loading" role="status">Connecting the notes…</p><div class="graph-caption"><span class="graph-live-dot" aria-hidden="true"></span><span id="graph-count">${graph.nodes.length} nodes · ${graph.links.length} connections</span></div><div class="graph-tooltip" id="graph-tooltip" hidden></div><div class="graph-zoom"><button id="graph-zoom-in" type="button" aria-label="Zoom in">+</button><button id="graph-zoom-out" type="button" aria-label="Zoom out">−</button><button id="graph-fit" type="button" aria-label="Fit the whole network" title="Fit the whole network">↺</button></div><p id="graph-help" class="graph-help">Hover to trace · Click to explore · Drag to pan · Scroll to zoom</p></div>
<aside class="graph-inspector" id="graph-inspector" aria-label="Selected note" hidden><button id="graph-close" class="graph-close" type="button" aria-label="Close note preview">×</button><p class="inspector-eyebrow" id="graph-note-course"></p><h2 id="graph-note-title"></h2><p class="graph-note-meta" id="graph-note-meta"></p><a class="graph-read-note" id="graph-read-note" href="/math/">Read note <span aria-hidden="true">↗</span></a><div class="graph-preview note-content" id="graph-preview" aria-busy="false"></div><div class="graph-selection" id="graph-selection"></div><h3>Connected notes</h3><div class="graph-related" id="graph-related"></div></aside></div>
<div class="graph-legend" aria-label="Highlight a course">${graph.groups.map(g => `<button type="button" data-group="${g.id}" aria-pressed="false" style="--group-color:${g.color}" title="${e(g.title)}"><span aria-hidden="true"></span>${e(g.label)}</button>`).join('')}<span class="graph-key">Larger nodes connect more ideas</span></div><p id="graph-announcement" class="sr-only" role="status" aria-live="polite"></p><noscript><p class="graph-noscript">The interactive network needs JavaScript. All course indexes and notes are available below.</p></noscript></section>`;
}
export function graphVendor() {
  const require = createRequire(import.meta.url);
  const forceRequire = createRequire(require.resolve('d3-force'));
  const modules = ['d3-dispatch', 'd3-quadtree', 'd3-timer', 'd3-force'];
  let code = '', license = 'Local D3 modules used by the mathematics network. No CDN is used.\n\n';
  for (const name of modules) {
    const dir = path.dirname(path.dirname(forceRequire.resolve(name)));
    code += fs.readFileSync(path.join(dir, `dist/${name}.min.js`), 'utf8').trimEnd() + ';\n';
    license += `${name}\n${fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8')}\n`;
  }
  return {code, license};
}
