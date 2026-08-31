const state = {
  staged: [],
  unstaged: [],
  active: null,
  activeKey: null,
  collapsedFolders: new Set(),
};

function escapeHtml(s) {
  return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('diff-viewer-theme', theme);
  document.getElementById('theme-toggle').textContent = theme === 'dark' ? '☀️' : '🌙';
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
    row.innerHTML = `<span class="status-badge status-${file.status}">${file.status}</span><span class="file-name">${escapeHtml(name)}</span>`;
    row.addEventListener('click', () => {
      state.activeKey = activeKey;
      state.active = file;
      renderSidebar();
      renderDiff();
    });
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

function renderDiff() {
  const panel = document.getElementById('diff-panel');
  const file = state.active;

  if (!file) {
    panel.innerHTML = '<div class="empty">No changes to display.</div>';
    return;
  }

  if (file.binary) {
    panel.innerHTML = `<div class="file-header">${escapeHtml(file.path)}</div><div class="binary-note">Binary file not shown.</div>`;
    return;
  }

  const rows = file.rows.map(row => {
    const left = row.left, right = row.right;
    const leftClass = left ? left.type : 'blank';
    const rightClass = right ? right.type : 'blank';
    return `<tr>
      <td class="line-num ${leftClass}">${left ? left.num : ''}</td>
      <td class="code ${leftClass}">${left ? escapeHtml(left.text) : ''}</td>
      <td class="divider"></td>
      <td class="line-num ${rightClass}">${right ? right.num : ''}</td>
      <td class="code ${rightClass}">${right ? escapeHtml(right.text) : ''}</td>
    </tr>`;
  }).join('');

  const heading = file.origPath ? `${file.origPath} → ${file.path}` : file.path;

  panel.innerHTML = `
    <div class="file-header">${escapeHtml(heading)}</div>
    <table class="diff-table">
      <colgroup>
        <col class="col-num"><col><col class="col-divider"><col class="col-num"><col>
      </colgroup>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function load() {
  const res = await fetch('/api/diff');
  const data = await res.json();
  state.staged = data.staged || [];
  state.unstaged = data.unstaged || [];

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

initTheme();
load();
