const FIXED_COLS_PX = 106; // two 52px line-num columns + the 2px divider gutter

const state = {
  staged: [],
  unstaged: [],
  active: null,
  activeKey: null,
  collapsedFolders: new Set(),
  splitRatio: clamp(parseFloat(localStorage.getItem('diff-viewer-split')) || 0.5, 0.15, 0.85),
  sidebarWidth: clamp(parseFloat(localStorage.getItem('diff-viewer-sidebar-width')) || 280, 160, 560),
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function copyButtonHtml(path) {
  return `<button class="copy-btn" data-path="${escapeHtml(path)}" title="Copy path" aria-label="Copy path">
    <svg class="copy-icon" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5.5" y="5.5" width="8" height="9" rx="1.5"></rect>
      <path d="M3.5 10.5h-1a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1"></path>
    </svg>
    <svg class="check-icon" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 8l3.5 3.5L13 4.5"></path>
    </svg>
  </button>`;
}

// Attached directly to each button (not delegated) so it fires before the click can bubble
// to a row's own "select this file" listener — otherwise selecting re-renders the sidebar
// mid-click and wipes the "copied" feedback before it's visible.
function wireCopyButton(btn) {
  if (!btn) return;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(btn.dataset.path).then(() => {
      btn.classList.add('copied');
      clearTimeout(btn._copiedTimeout);
      btn._copiedTimeout = setTimeout(() => btn.classList.remove('copied'), 1200);
    });
  });
}

function applySidebarWidth() {
  document.getElementById('file-list').style.width = `${state.sidebarWidth}px`;
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('diff-viewer-theme', theme);
  document.getElementById('theme-toggle').setAttribute('aria-checked', String(theme === 'dark'));
}

function initTheme() {
  const saved = localStorage.getItem('diff-viewer-theme');
  const theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(theme);
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

// Groups a flat list of changed files into a nested folder/file tree, GitHub-style.
function buildTree(files) {
  const root = { type: 'folder', children: new Map() };
  for (const file of files) {
    const parts = file.path.split('/');
    let node = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      if (!node.children.has(part)) {
        node.children.set(part, isFile ? { type: 'file', file } : { type: 'folder', children: new Map() });
      }
      node = node.children.get(part);
    });
  }
  return root;
}

// GitHub collapses a chain of single-child directories into one row (e.g. "src/components").
function collapseChain(name, node) {
  while (node.type === 'folder' && node.children.size === 1) {
    const [[childName, child]] = node.children;
    if (child.type !== 'folder') break;
    name = `${name}/${childName}`;
    node = child;
  }
  return { name, node };
}

function renderTree(container, node, section, depth, keyPrefix) {
  const folders = [];
  const files = [];
  for (const entry of node.children) {
    (entry[1].type === 'folder' ? folders : files).push(entry);
  }
  folders.sort((a, b) => a[0].localeCompare(b[0]));
  files.sort((a, b) => a[0].localeCompare(b[0]));

  for (const [name, child] of folders) {
    const { name: displayName, node: collapsedNode } = collapseChain(name, child);
    const key = `${keyPrefix}/${displayName}`;
    const collapsed = state.collapsedFolders.has(key);

    const row = document.createElement('div');
    row.className = 'tree-row folder-row';
    row.style.paddingLeft = `${depth * 16 + 12}px`;
    row.innerHTML = `<span class="chevron${collapsed ? ' collapsed' : ''}"></span><span class="folder-name">${escapeHtml(displayName)}</span>`;

    const childWrap = document.createElement('div');
    childWrap.style.display = collapsed ? 'none' : '';

    row.addEventListener('click', () => {
      const nowCollapsed = state.collapsedFolders.has(key);
      if (nowCollapsed) state.collapsedFolders.delete(key);
      else state.collapsedFolders.add(key);
      childWrap.style.display = nowCollapsed ? '' : 'none';
      row.querySelector('.chevron').classList.toggle('collapsed', !nowCollapsed);
    });

    container.appendChild(row);
    container.appendChild(childWrap);
    renderTree(childWrap, collapsedNode, section, depth + 1, key);
  }

  for (const [name, child] of files) {
    const file = child.file;
    const activeKey = `${section}:${file.path}`;
    const row = document.createElement('div');
    row.className = 'tree-row file-row' + (state.activeKey === activeKey ? ' active' : '');
    row.style.paddingLeft = `${depth * 16 + 12}px`;
    row.innerHTML = `<span class="status-badge status-${file.status}">${file.status}</span><span class="file-name">${escapeHtml(name)}</span>${copyButtonHtml(file.path)}`;
    row.addEventListener('click', () => {
      state.activeKey = activeKey;
      state.active = file;
      renderSidebar();
      renderDiff();
    });
    wireCopyButton(row.querySelector('.copy-btn'));
    container.appendChild(row);
  }
}

function renderSection(container, title, files, section) {
  if (!files.length) return;
  const header = document.createElement('div');
  header.className = 'section-header';
  header.textContent = `${title} (${files.length})`;
  container.appendChild(header);
  renderTree(container, buildTree(files), section, 0, section);
}

function renderSidebar() {
  const list = document.getElementById('file-list');
  list.innerHTML = '';
  const total = state.staged.length + state.unstaged.length;
  if (!total) {
    list.innerHTML = '<div class="empty-sidebar">No changes</div>';
  } else {
    renderSection(list, 'Staged Changes', state.staged, 'staged');
    renderSection(list, 'Changes', state.unstaged, 'unstaged');
  }
}

function applySplit(table, ratio) {
  const colOld = table.querySelector('.col-code.left');
  const colNew = table.querySelector('.col-code.right');
  if (!colOld || !colNew) return;
  const tableWidth = table.getBoundingClientRect().width;
  const codeAreaPx = Math.max(tableWidth - FIXED_COLS_PX, 0);
  colOld.style.width = `${(codeAreaPx * ratio / tableWidth) * 100}%`;
  colNew.style.width = `${(codeAreaPx * (1 - ratio) / tableWidth) * 100}%`;

  const divider = document.getElementById('diff-divider');
  if (divider) {
    const leftNumWidth = 52; // matches col.col-num width
    divider.style.left = `${((leftNumWidth + codeAreaPx * ratio) / tableWidth) * 100}%`;
  }
}

function startResizeDrag(e) {
  const table = document.querySelector('.diff-table');
  if (!table) return;
  const divider = document.getElementById('diff-divider');
  const tableWidth = table.getBoundingClientRect().width;
  const codeAreaPx = Math.max(tableWidth - FIXED_COLS_PX, 0);
  const startX = e.clientX;
  const startRatio = state.splitRatio;

  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';
  if (divider) divider.classList.add('dragging');

  function onMove(ev) {
    state.splitRatio = clamp(startRatio + (ev.clientX - startX) / codeAreaPx, 0.15, 0.85);
    applySplit(table, state.splitRatio);
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    if (divider) divider.classList.remove('dragging');
    localStorage.setItem('diff-viewer-split', String(state.splitRatio));
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  e.preventDefault();
}

// Marks the scrollbar-adjacent minimap with one block per contiguous run of added/deleted
// lines, proportional to that run's position in the file. Runs (not individual lines) keep
// the DOM node count down to roughly the number of hunks rather than the number of changed
// lines, so it stays cheap on files with large added/deleted blocks.
function renderMinimap(file) {
  const minimap = document.getElementById('diff-minimap-marks');
  minimap.innerHTML = '';
  if (!file || file.binary || !file.rows.length) return;

  const total = file.rows.length;
  addRuns('del', row => row.left && row.left.type === 'del');
  addRuns('add', row => row.right && row.right.type === 'add');

  function addRuns(kind, isMatch) {
    let runStart = -1;
    for (let i = 0; i <= total; i++) {
      const match = i < total && isMatch(file.rows[i]);
      if (match && runStart === -1) runStart = i;
      if (!match && runStart !== -1) {
        addMark(kind, (runStart / total) * 100, ((i - runStart) / total) * 100);
        runStart = -1;
      }
    }
  }

  function addMark(kind, top, height) {
    const mark = document.createElement('div');
    mark.className = `diff-minimap-mark ${kind}`;
    mark.style.top = `${top}%`;
    mark.style.height = `${height}%`;
    minimap.appendChild(mark);
  }
}

// Sizes/positions the minimap thumb to mirror the scroll pane's current viewport —
// same math a native scrollbar thumb uses (visible fraction, scrolled fraction).
function updateMinimapThumb() {
  const scroll = document.getElementById('diff-scroll');
  const thumb = document.getElementById('diff-minimap-thumb');
  if (!scroll || !thumb) return;
  const { scrollTop, scrollHeight, clientHeight } = scroll;
  if (scrollHeight <= clientHeight) {
    thumb.style.display = 'none';
    return;
  }
  thumb.style.display = 'block';
  thumb.style.top = `${(scrollTop / scrollHeight) * 100}%`;
  thumb.style.height = `${(clientHeight / scrollHeight) * 100}%`;
}

function renderDiff() {
  const scroll = document.getElementById('diff-scroll');
  const file = state.active;

  if (!file) {
    scroll.innerHTML = '<div class="empty">No changes to display.</div>';
    renderMinimap(null);
    updateMinimapThumb();
    return;
  }

  if (file.binary) {
    scroll.innerHTML = `<div class="file-header">${escapeHtml(file.path)}</div><div class="binary-note">Binary file not shown.</div>`;
    renderMinimap(null);
    updateMinimapThumb();
    return;
  }

  const lang = detectLanguage(file.path);
  const rows = file.rows.map(row => {
    const left = row.left, right = row.right;
    const leftClass = left ? left.type : 'blank';
    const rightClass = right ? right.type : 'blank';
    return `<tr>
      <td class="line-num ${leftClass}">${left ? left.num : ''}</td>
      <td class="code ${leftClass}">${left ? highlightLine(left.text, lang) : ''}</td>
      <td class="divider"></td>
      <td class="line-num ${rightClass}">${right ? right.num : ''}</td>
      <td class="code ${rightClass}">${right ? highlightLine(right.text, lang) : ''}</td>
    </tr>`;
  }).join('');

  const heading = file.origPath ? `${file.origPath} → ${file.path}` : file.path;

  scroll.innerHTML = `
    <div class="diff-content">
      <div class="file-header">
        <span class="file-header-text">${escapeHtml(heading)}</span>
        ${copyButtonHtml(file.path)}
      </div>
      <table class="diff-table">
        <colgroup>
          <col class="col-num"><col class="col-code left"><col class="col-divider"><col class="col-num"><col class="col-code right">
        </colgroup>
        <tbody>${rows}</tbody>
      </table>
      <div class="diff-divider" id="diff-divider"></div>
    </div>
  `;

  applySplit(scroll.querySelector('.diff-table'), state.splitRatio);
  renderMinimap(file);
  updateMinimapThumb();
  wireCopyButton(scroll.querySelector('.file-header .copy-btn'));
}

function renderRepoInfo(meta) {
  const el = document.getElementById('repo-info');
  if (!meta || !meta.root) {
    el.innerHTML = '';
    return;
  }
  const name = meta.root.split('/').filter(Boolean).pop() || meta.root;
  const branch = meta.branch
    ? `<span class="repo-branch">
        <svg class="branch-icon" viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="4" cy="4" r="2"></circle>
          <circle cx="4" cy="12" r="2"></circle>
          <circle cx="12" cy="6" r="2"></circle>
          <path d="M4 6v4M4 6a4 4 0 0 0 4 4h2"></path>
        </svg>${escapeHtml(meta.branch)}
      </span>`
    : '';
  el.innerHTML = `<span class="repo-path" title="${escapeHtml(meta.root)}">${escapeHtml(name)}</span>${branch}`;
}

async function load() {
  const res = await fetch('/api/diff');
  const data = await res.json();
  state.staged = data.staged || [];
  state.unstaged = data.unstaged || [];
  renderRepoInfo(data.meta);

  const first = state.unstaged[0]
    ? { file: state.unstaged[0], section: 'unstaged' }
    : state.staged[0]
      ? { file: state.staged[0], section: 'staged' }
      : null;

  if (first) {
    state.active = first.file;
    state.activeKey = `${first.section}:${first.file.path}`;
  }

  renderSidebar();
  renderDiff();
}

function startThumbDrag(e) {
  const scroll = document.getElementById('diff-scroll');
  const thumb = document.getElementById('diff-minimap-thumb');
  const trackHeight = document.getElementById('diff-minimap').getBoundingClientRect().height;
  const startY = e.clientY;
  const startScrollTop = scroll.scrollTop;

  thumb.classList.add('dragging');

  function onMove(ev) {
    const deltaScroll = ((ev.clientY - startY) / trackHeight) * scroll.scrollHeight;
    scroll.scrollTop = clamp(startScrollTop + deltaScroll, 0, scroll.scrollHeight - scroll.clientHeight);
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    thumb.classList.remove('dragging');
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  e.preventDefault();
  e.stopPropagation();
}

function startSidebarResizeDrag(e) {
  const resizer = document.getElementById('sidebar-resizer');
  const startX = e.clientX;
  const startWidth = state.sidebarWidth;

  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';
  resizer.classList.add('dragging');

  function onMove(ev) {
    state.sidebarWidth = clamp(startWidth + (ev.clientX - startX), 160, 560);
    applySidebarWidth();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    resizer.classList.remove('dragging');
    localStorage.setItem('diff-viewer-sidebar-width', String(state.sidebarWidth));
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  e.preventDefault();
}

document.addEventListener('mousedown', e => {
  if (e.target.closest('.diff-divider')) startResizeDrag(e);
  if (e.target.closest('#sidebar-resizer')) startSidebarResizeDrag(e);
});

document.getElementById('diff-minimap-thumb').addEventListener('mousedown', startThumbDrag);

document.getElementById('diff-minimap').addEventListener('click', e => {
  if (e.target.closest('#diff-minimap-thumb')) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const ratio = clamp((e.clientY - rect.top) / rect.height, 0, 1);
  const scroll = document.getElementById('diff-scroll');
  scroll.scrollTop = ratio * (scroll.scrollHeight - scroll.clientHeight);
});

document.getElementById('diff-scroll').addEventListener('scroll', updateMinimapThumb);
window.addEventListener('resize', updateMinimapThumb);

applySidebarWidth();
initTheme();
load();
