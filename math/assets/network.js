(() => {
  const svg = document.querySelector('#math-graph');
  if (!svg) return;
  const $ = selector => document.querySelector(selector);
  const stage = $('#graph-stage'), camera = $('#graph-camera'), shell = $('#network');
  const inspector = $('#graph-inspector'), query = $('#graph-query'), results = $('#graph-search-results');
  const directory = $('#browse-notes');
  const normalize = text => text.normalize('NFKD').replace(/\p{Mark}/gu, '').toLowerCase();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const makeSvg = (tag, attributes) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value);
    return el;
  };
  fetch('/math/data/graph.json').then(response => {
    if (!response.ok) throw new Error('Network data unavailable');
    return response.json();
  }).then(data => {
    if (!window.d3?.forceSimulation) throw new Error('Layout unavailable');
    const nodes = data.nodes.map(n => ({...n, search: normalize([n.title, ...n.tags].join(' '))}));
    const byId = new Map(nodes.map(n => [n.id, n]));
    const groups = new Map(data.groups.map(g => [g.id, g]));
    const neighbors = new Map(nodes.map(n => [n.id, new Set()]));
    const links = data.links.map(link => {
      neighbors.get(link.source).add(link.target);
      neighbors.get(link.target).add(link.source);
      return {...link, source: byId.get(link.source), target: byId.get(link.target)};
    });
    let selected = new Set(), activeId = null, hoverId = null, activeGroup = '', multi = false;
    let view = {x: 0, y: 0, k: 1}, width = 0, height = 0, gesture = null;
    let request = null;
    const pointers = new Map(), previewCache = new Map();
    const nodeElements = new Map();
    const edgeElements = links.map(link => {
      const el = makeSvg('line', {class: 'graph-edge', 'data-source': link.source.id, 'data-target': link.target.id});
      $('#graph-edges').append(el);
      return {el, link};
    });
    for (const node of nodes) {
      const radius = node.kind === 'course' ? 9 : 3.3 + Math.sqrt(node.degree) * .62;
      const el = makeSvg('g', {class: `graph-node${node.kind === 'course' ? ' is-course' : ''}`, 'data-node': node.id,
        role: 'button', tabindex: '-1', 'aria-label': `${node.title}, ${node.degree} connections`, 'aria-pressed': 'false', style: `--node-color:${node.color}`});
      el.append(makeSvg('circle', {class: 'node-hit', r: Math.max(15, radius + 7)}));
      el.append(makeSvg('circle', {class: 'node-halo', r: radius + 12}));
      el.append(makeSvg('circle', {class: 'node-ring', r: radius + 5}));
      el.append(makeSvg('circle', {class: 'node-core', r: radius}));
      const label = makeSvg('text', {x: radius + 6, y: 3.5});
      label.textContent = node.label;
      el.append(label);
      el.addEventListener('pointerenter', event => {if (event.pointerType !== 'touch' && !pointers.size) hover(node.id);});
      el.addEventListener('pointerleave', () => {if (!pointers.size) hover(null);});
      el.addEventListener('focus', () => hover(node.id));
      el.addEventListener('blur', () => hover(null));
      el.addEventListener('dblclick', event => {event.preventDefault(); location.assign(node.url);});
      nodeElements.set(node.id, el);
      $('#graph-nodes').append(el);
    }
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(n => n.id).distance(l => l.source.course === l.target.course ? 64 : 110).strength(.13))
      .force('charge', d3.forceManyBody().strength(-155))
      .force('collide', d3.forceCollide().radius(n => n.kind === 'course' ? 29 : 20))
      .force('x', d3.forceX(n => n.cx).strength(.025))
      .force('y', d3.forceY(n => n.cy).strength(.09))
      .alphaDecay(.045).on('tick', drawPositions).stop();

    function drawPositions() {
      for (const {el, link} of edgeElements) {
        el.setAttribute('x1', link.source.x); el.setAttribute('y1', link.source.y);
        el.setAttribute('x2', link.target.x); el.setAttribute('y2', link.target.y);
      }
      for (const node of nodes) nodeElements.get(node.id).setAttribute('transform', `translate(${node.x},${node.y})`);
    }
    function setView(next) {
      view = next;
      camera.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
      svg.dataset.zoom = view.k.toFixed(3);
      for (const node of nodes) nodeElements.get(node.id).querySelector('text').style.fontSize = `${(node.kind === 'course' ? 12 : 10) / Math.sqrt(view.k)}px`;
      positionTooltip();
    }
    function frame(list, maxZoom = 1.5) {
      width=stage.clientWidth; height=stage.clientHeight;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      const minX = Math.min(...list.map(n => n.x)) - 40, maxX = Math.max(...list.map(n => n.x)) + 100;
      const minY = Math.min(...list.map(n => n.y)) - 30, maxY = Math.max(...list.map(n => n.y)) + 30;
      const k = Math.max(.15, Math.min(maxZoom, (width - 65) / (maxX - minX), (height - 110) / (maxY - minY)));
      setView({x: width / 2 - (minX + maxX) / 2 * k, y: height / 2 - (minY + maxY) / 2 * k, k});
    }
    function fit() {frame(nodes);}
    function focusSelection() {
      if(!selected.size) return;
      const ids = new Set(selected);
      for(const id of selected) for(const neighbor of neighbors.get(id)) ids.add(neighbor);
      frame(nodes.filter(n=>ids.has(n.id)),2);
    }
    function zoom(factor, point = {x: width / 2, y: height / 2}) {
      const k = Math.max(.15, Math.min(4, view.k * factor)), ratio = k / view.k;
      setView({k, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio});
    }
    function positionTooltip() {
      const tip = $('#graph-tooltip'), node = byId.get(hoverId);
      if (!node || pointers.size) {tip.hidden = true; return;}
      tip.hidden = false;
      tip.style.left = Math.max(12, Math.min(width - tip.offsetWidth - 12, node.x * view.k + view.x + 16)) + 'px';
      tip.style.top = Math.max(42, Math.min(height - tip.offsetHeight - 12, node.y * view.k + view.y - tip.offsetHeight - 12)) + 'px';
    }
    function hover(id) {
      hoverId = id;
      const tip = $('#graph-tooltip');
      tip.replaceChildren();
      if (id) {
        const node = byId.get(id), title = document.createElement('strong'), meta = document.createElement('small');
        title.textContent = node.title;
        meta.textContent = `${groups.get(node.course).label} · ${node.degree} connections · Click to explore`;
        tip.append(title, meta);
      }
      paintState(); positionTooltip();
    }
    function matching() {
      const terms = normalize(query.value.trim()).split(/\s+/).filter(Boolean);
      return nodes.filter(n => (!activeGroup || n.course === activeGroup) && terms.every(t => n.search.includes(t)));
    }
    function paintState() {
      const roots = new Set(selected);
      if (hoverId) roots.add(hoverId);
      const lit = new Set(roots);
      for (const id of roots) for (const neighbor of neighbors.get(id)) lit.add(neighbor);
      const filtering = Boolean(activeGroup || query.value.trim());
      const matches = new Set(filtering ? matching().map(n => n.id) : []);
      for (const id of matches) lit.add(id);
      const focused = roots.size > 0 || filtering;
      for (const node of nodes) {
        const el = nodeElements.get(node.id);
        el.classList.toggle('is-dim', focused && !lit.has(node.id));
        el.classList.toggle('is-lit', focused && lit.has(node.id));
        el.classList.toggle('is-selected', selected.has(node.id));
        el.classList.toggle('is-hover', node.id === hoverId);
        el.setAttribute('aria-pressed', String(selected.has(node.id)));
      }
      for (const {el, link} of edgeElements) {
        const bright = roots.has(link.source.id) || roots.has(link.target.id) || (matches.has(link.source.id) && matches.has(link.target.id));
        el.classList.toggle('is-lit', focused && bright);
        el.classList.toggle('is-dim', focused && !bright);
      }
      for (const button of shell.querySelectorAll('[data-group]')) button.setAttribute('aria-pressed', String(button.dataset.group === activeGroup));
      $('#graph-count').textContent = filtering ? `${matches.size} matching nodes · ${data.nodes.length} in the network` : selected.size ? `${selected.size} selected · ${lit.size} nodes in focus` : `${nodes.length} nodes · ${links.length} connections`;
      shell.dataset.selected = String(selected.size);
    }
    function saveUrl() {
      const url = new URL(location.href);
      url.searchParams.delete('node');
      for (const id of selected) url.searchParams.append('node', id);
      if (activeGroup) url.searchParams.set('group', activeGroup); else url.searchParams.delete('group');
      if (query.value.trim()) url.searchParams.set('find', query.value.trim()); else url.searchParams.delete('find');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    function readUrl() {
      const params = new URLSearchParams(location.search);
      selected = new Set(params.getAll('node').filter(id => byId.has(id)));
      activeId = [...selected].at(-1) ?? null;
      activeGroup = groups.has(params.get('group')) ? params.get('group') : '';
      query.value = params.get('find') || '';
    }
    function select(id, additive = false) {
      if (!byId.has(id)) return;
      if (!additive) selected.clear();
      if (additive && selected.has(id)) selected.delete(id); else selected.add(id);
      activeId = selected.has(id) ? id : [...selected].at(-1) ?? null;
      activeGroup = ''; query.value = ''; results.hidden = true;
      hoverId = null; $('#graph-tooltip').hidden = true;
      for (const [nodeId, el] of nodeElements) el.setAttribute('tabindex', nodeId === (activeId || id) ? '0' : '-1');
      paintState(); showInspector(); saveUrl();
      requestAnimationFrame(focusSelection);
      $('#graph-announcement').textContent = activeId ? `${byId.get(activeId).title} selected. ${byId.get(activeId).degree} connected notes highlighted.` : 'Selection cleared.';
    }
    async function showInspector() {
      request?.abort();
      const node = byId.get(activeId);
      inspector.hidden = !node;
      if (!node) return;
      $('#graph-note-course').textContent = `${groups.get(node.course).label} · ${node.kind === 'course' ? 'Course index' : groups.get(node.course).title}`;
      $('#graph-note-title').textContent = node.title;
      $('#graph-note-meta').textContent = `${node.degree} connected notes${node.tags.length ? ' · ' + node.tags.slice(0, 2).join(' / ') : ''}`;
      $('#graph-read-note').href = node.url;
      const related = $('#graph-related'); related.replaceChildren();
      for (const id of [...neighbors.get(node.id)].sort((a,b) => byId.get(a).title.localeCompare(byId.get(b).title))) {
        const other = byId.get(id), button = document.createElement('button'), label = document.createElement('span'), course = document.createElement('small');
        button.type = 'button'; button.dataset.related = id; label.textContent = other.title; course.textContent = groups.get(other.course).label;
        button.append(label, course); button.addEventListener('click', event => select(id, multi || event.shiftKey)); related.append(button);
      }
      const chips = $('#graph-selection'); chips.replaceChildren();
      if (selected.size > 1) for (const id of selected) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = byId.get(id).label + ' ×';
        button.setAttribute('aria-label', 'Deselect ' + byId.get(id).title); button.addEventListener('click', () => select(id, true)); chips.append(button);
      }
      const preview = $('#graph-preview'); preview.textContent = 'Loading note…'; preview.setAttribute('aria-busy', 'true');
      request = new AbortController();
      try {
        let html = previewCache.get(node.id);
        if (!html) {
          const response = await fetch(node.url, {signal: request.signal});
          if (!response.ok) throw new Error('Note unavailable');
          html = await response.text(); previewCache.set(node.id, html);
        }
        if (activeId !== node.id) return;
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const content = parsed.querySelector('.note-content');
        const excerpts = node.kind === 'course' ? [content.querySelector('h2'), content.querySelector('ul')].filter(Boolean) : [...content.children].filter(el => !['HR'].includes(el.tagName)).slice(0, 2);
        preview.replaceChildren(...excerpts.map(el => document.importNode(el, true)));
        preview.scrollTop = 0;
      } catch (error) {
        if (error.name !== 'AbortError' && activeId === node.id) preview.textContent = 'Use “Read note” to open the full page.';
      } finally {if (activeId === node.id) preview.setAttribute('aria-busy', 'false');}
    }
    function clear() {
      selected.clear(); activeId = null; hoverId = null; activeGroup = ''; query.value = ''; results.hidden = true;
      $('#graph-tooltip').hidden = true; paintState(); showInspector(); saveUrl();
      requestAnimationFrame(fit);
      $('#graph-announcement').textContent = 'Showing the full network.';
    }
    function search() {
      if (!multi) {selected.clear(); activeId = null; showInspector();}
      results.replaceChildren(); results.hidden = !query.value.trim();
      if (query.value.trim()) {
        const found = matching().sort((a,b) => Number(b.search.startsWith(normalize(query.value))) - Number(a.search.startsWith(normalize(query.value))));
        for (const node of found.slice(0, 8)) {
          const button = document.createElement('button'), label = document.createElement('span'), meta = document.createElement('small');
          button.type = 'button'; label.textContent = node.title; meta.textContent = `${groups.get(node.course).label} · ${node.degree} connections`;
          button.append(label,meta); button.addEventListener('click', () => {select(node.id, multi); nodeElements.get(node.id).focus({preventScroll:true});});
          results.append(button);
        }
        if (!found.length) {const message = document.createElement('p'); message.textContent = 'No matching nodes. Try another concept.'; results.append(message);}
      }
      paintState(); saveUrl();
    }
    query.addEventListener('input', search);
    query.addEventListener('keydown', event => {
      if (['ArrowDown','Enter'].includes(event.key) && results.querySelector('button')) {
        event.preventDefault(); if(event.key === 'Enter') results.querySelector('button').click(); else results.querySelector('button').focus();
      }
      if (event.key === 'Escape') {results.hidden = true; query.blur();}
    });
    results.addEventListener('keydown', event => {
      const options = [...results.querySelectorAll('button')], index = options.indexOf(document.activeElement);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {event.preventDefault(); options[(index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length]?.focus();}
      if (event.key === 'Escape') {results.hidden = true; query.focus();}
    });
    document.addEventListener('pointerdown', event => {if (!event.target.closest('.network-search')) results.hidden = true;});
    for (const button of shell.querySelectorAll('[data-group]')) button.addEventListener('click', () => {
      activeGroup = activeGroup === button.dataset.group ? '' : button.dataset.group;
      selected.clear(); activeId = null; hoverId = null; showInspector(); paintState(); saveUrl();
      $('#graph-announcement').textContent = activeGroup ? `${groups.get(activeGroup).label} highlighted.` : 'Showing all courses.';
    });
    $('#graph-clear').addEventListener('click', clear);
    $('#graph-close').addEventListener('click', clear);
    $('#graph-multi').addEventListener('click', event => {multi = !multi; event.currentTarget.setAttribute('aria-pressed', String(multi));});
    $('#graph-labels').addEventListener('change', event => shell.classList.toggle('labels-hidden', !event.target.checked));
    $('#graph-zoom-in').addEventListener('click', () => zoom(1.3));
    $('#graph-zoom-out').addEventListener('click', () => zoom(1 / 1.3));
    $('#graph-fit').addEventListener('click', fit);
    $('#browse-list-link').addEventListener('click', () => {directory.open = true;});
    const point = event => {const rect = svg.getBoundingClientRect(); return {x: event.clientX - rect.left, y: event.clientY - rect.top};};
    const world = p => ({x:(p.x - view.x) / view.k, y:(p.y - view.y) / view.k});
    function pinchGesture() {
      const [a,b] = [...pointers.values()];
      return {type:'pinch', view:{...view}, distance:Math.hypot(a.x-b.x,a.y-b.y), center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
    }
    svg.addEventListener('pointerdown', event => {
      if (event.button !== 0 && event.pointerType !== 'touch') return;
      event.preventDefault(); results.hidden = true;
      pointers.set(event.pointerId, point(event)); svg.setPointerCapture(event.pointerId);
      $('#graph-tooltip').hidden = true;
      if (pointers.size === 2) {
        if (gesture?.node) {gesture.node.fx = null; gesture.node.fy = null; simulation.alphaTarget(0);}
        gesture = pinchGesture(); return;
      }
      if (pointers.size > 2) return;
      let node = byId.get(event.target.closest('[data-node]')?.dataset.node);
      if (event.pointerType === 'touch') {
        const p = point(event);
        const closest = nodes.map(n => ({node:n, distance:Math.hypot(n.x*view.k+view.x-p.x,n.y*view.k+view.y-p.y)})).sort((a,b)=>a.distance-b.distance)[0];
        node = closest?.distance <= 20 ? closest.node : undefined;
      }
      gesture = {type:node ? 'node' : 'pan', node, start:point(event), view:{...view}, moved:false};
      if (node) {node.fx = node.x; node.fy = node.y;}
    });
    svg.addEventListener('pointermove', event => {
      if (!pointers.has(event.pointerId) || !gesture) return;
      const p = point(event); pointers.set(event.pointerId,p);
      if (gesture.type === 'pinch' && pointers.size >= 2) {
        const [a,b] = [...pointers.values()], center = {x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        const k = Math.max(.15, Math.min(4, gesture.view.k * Math.hypot(a.x-b.x,a.y-b.y) / Math.max(1,gesture.distance)));
        const ratio = k / gesture.view.k;
        setView({k,x:center.x-(gesture.center.x-gesture.view.x)*ratio,y:center.y-(gesture.center.y-gesture.view.y)*ratio}); return;
      }
      const dx=p.x-gesture.start.x, dy=p.y-gesture.start.y;
      if (Math.hypot(dx,dy)>4) gesture.moved = true;
      if (!gesture.moved) return;
      svg.classList.add('is-dragging');
      if (gesture.type === 'pan') setView({...view,x:gesture.view.x+dx,y:gesture.view.y+dy});
      else if (gesture.node) {
        const target = world(p); gesture.node.fx = gesture.node.x = target.x; gesture.node.fy = gesture.node.y = target.y;
        if (!reducedMotion) simulation.alpha(.18).alphaTarget(.025).restart();
        drawPositions();
      }
    });
    function pointerEnd(event) {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      if (gesture?.node) {
        gesture.node.fx = null; gesture.node.fy = null; simulation.alphaTarget(0);
        if (!gesture.moved && event.type !== 'pointercancel') select(gesture.node.id, multi || event.shiftKey || event.ctrlKey || event.metaKey);
      } else if (gesture?.type === 'pan' && !gesture.moved && event.type !== 'pointercancel') clear();
      if (pointers.size === 1) gesture = {type:'pan', start:[...pointers.values()][0], view:{...view}, moved:true}; else gesture = null;
      if (!pointers.size) svg.classList.remove('is-dragging');
    }
    svg.addEventListener('pointerup', pointerEnd); svg.addEventListener('pointercancel', pointerEnd);
    svg.addEventListener('wheel', event => {event.preventDefault(); zoom(Math.exp(-event.deltaY * .0015), point(event));}, {passive:false});
    svg.addEventListener('keydown', event => {
      const id = event.target.closest('[data-node]')?.dataset.node;
      if (event.key === 'Escape') {event.preventDefault(); clear(); return;}
      if (['+','=','-'].includes(event.key)) {event.preventDefault(); zoom(event.key === '-' ? 1/1.25 : 1.25); return;}
      if (id && ['Enter',' '].includes(event.key)) {event.preventDefault(); select(id, multi || event.shiftKey); return;}
      if (!event.key.startsWith('Arrow')) return;
      event.preventDefault();
      if (!id) {nodeElements.get(activeId || nodes[0].id).focus(); return;}
      const from = byId.get(id), dir = {ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowDown:[0,1],ArrowUp:[0,-1]}[event.key];
      const next = nodes.filter(n => n.id !== id).map(n => {
        const dx=n.x-from.x,dy=n.y-from.y,forward=dx*dir[0]+dy*dir[1],side=Math.abs(dx*dir[1]-dy*dir[0]);
        return {node:n,score:forward>0 ? Math.hypot(dx,dy)*(1+side/forward) : Infinity};
      }).sort((a,b)=>a.score-b.score)[0];
      if (next && Number.isFinite(next.score)) {for(const el of nodeElements.values()) el.setAttribute('tabindex','-1'); const el=nodeElements.get(next.node.id);el.setAttribute('tabindex','0');el.focus({preventScroll:true});}
    });
    const resize = new ResizeObserver(() => {
      const oldWidth=width, oldHeight=height;
      width=stage.clientWidth; height=stage.clientHeight;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      if(!oldWidth) fit(); else setView({...view,x:view.x+(width-oldWidth)/2,y:view.y+(height-oldHeight)/2});
    });
    resize.observe(stage);
    readUrl(); drawPositions(); paintState(); showInspector();
    if (selected.size) requestAnimationFrame(focusSelection);
    nodeElements.get(activeId || nodes[0].id).setAttribute('tabindex','0');
    $('#graph-loading').hidden=true;
    shell.dataset.ready='true';
    if(matchMedia('(pointer: coarse)').matches) $('#graph-help').textContent='Tap to explore · Drag to move · Pinch to zoom';
    if (!location.hash && !new URLSearchParams(location.search).has('q')) directory.open=false;
    if (location.hash === '#find-note' || location.hash === '#browse-notes') directory.open=true;
    addEventListener('popstate', () => {readUrl();paintState();showInspector();});
    addEventListener('hashchange', () => {if(['#find-note','#browse-notes'].includes(location.hash))directory.open=true;});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)simulation.stop();});
  }).catch(() => {
    $('#graph-loading').textContent = 'The network could not load. Browse the notes below.';
    directory.open=true;
  });
})();
