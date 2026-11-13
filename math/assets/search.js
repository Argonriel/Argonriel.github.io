(() => {
  const form = document.querySelector('#note-search');
  if (!form) return;
  const query = form.querySelector('#query');
  const course = form.querySelector('#course-filter');
  const count = document.querySelector('#result-count');
  const empty = document.querySelector('#no-results');
  const rows = [...document.querySelectorAll('#note-catalog li')];
  const normalize = value => value.normalize('NFKD').replace(/\p{Mark}/gu, '').toLocaleLowerCase();
  fetch('/math/data/search-index.json').then(response => {
    if (!response.ok) throw new Error('Search index unavailable');
    return response.json();
  }).then(notes => {
    const entries = new Map(notes.map(note => [note.url, {...note, search: normalize([note.title, ...note.tags, note.text].join(' '))}]));
    function readUrl() {
      const params = new URLSearchParams(location.search);
      query.value = params.get('q') || '';
      course.value = params.get('course') || '';
    }
    function filter(updateUrl = true) {
      const terms = normalize(query.value.trim()).split(/\s+/).filter(Boolean);
      let visible = 0;
      for (const row of rows) {
        const note = entries.get(row.dataset.url);
        const match = note && (!course.value || course.value === note.course) && terms.every(term => note.search.includes(term));
        row.hidden = !match;
        if (match) visible++;
      }
      count.textContent = `${visible} ${visible === 1 ? 'note or guide' : 'notes and guides'}${query.value.trim() || course.value ? ' found' : ''}`;
      empty.hidden = visible !== 0;
      if (updateUrl) {
        const params = new URLSearchParams();
        if (query.value.trim()) params.set('q', query.value.trim());
        if (course.value) params.set('course', course.value);
        history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : '') + location.hash);
      }
    }
    form.addEventListener('submit', event => { event.preventDefault(); filter(); });
    query.addEventListener('input', () => filter());
    course.addEventListener('change', () => filter());
    form.addEventListener('reset', () => { query.value = ''; course.value = ''; filter(); query.focus(); });
    addEventListener('popstate', () => { readUrl(); filter(false); });
    readUrl();
    filter(false);
    form.hidden = false;
  }).catch(() => {
    count.textContent = 'Search is unavailable. Browse all notes below or use the course indexes.';
  });
})();
