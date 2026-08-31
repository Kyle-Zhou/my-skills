#!/usr/bin/env node

import http from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { execFileSync, spawn } from 'child_process';
import { platform } from 'os';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const MAX_DIFF_LINES = 4000;

function isBinary(buf) {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

function readGitObject(repoRoot, ref) {
  try {
    const buf = execFileSync('git', ['show', ref], { cwd: repoRoot, maxBuffer: 1024 * 1024 * 64 });
    if (isBinary(buf)) return { content: '', exists: true, binary: true };
    return { content: buf.toString('utf8'), exists: true, binary: false };
  } catch {
    return { content: '', exists: false, binary: false };
  }
}

const EMPTY_FILE = { content: '', exists: false, binary: false };
const readHeadFile = (repoRoot, relPath) => readGitObject(repoRoot, `HEAD:${relPath}`);
const readIndexFile = (repoRoot, relPath) => readGitObject(repoRoot, `:${relPath}`);

function readWorkingFile(repoRoot, relPath) {
  const full = join(repoRoot, relPath);
  if (!existsSync(full)) return { content: '', exists: false, binary: false };
  const buf = readFileSync(full);
  if (isBinary(buf)) return { content: '', exists: true, binary: true };
  return { content: buf.toString('utf8'), exists: true, binary: false };
}

function getChangedFiles(repoRoot) {
  const raw = execFileSync('git', ['status', '--porcelain=v1', '-z', '-uall'], {
    cwd: repoRoot,
    maxBuffer: 1024 * 1024 * 32,
  }).toString('utf8');
  const tokens = raw.split('\0').filter(t => t.length > 0);
  const entries = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const status = token.slice(0, 2);
    const path = token.slice(3);
    let origPath = null;
    if (status[0] === 'R' || status[0] === 'C') {
      origPath = tokens[++i];
    }
    entries.push({ status, path, origPath });
  }
  return entries;
}

function statusLabel(ch) {
  if (ch === 'A' || ch === 'R' || ch === 'D' || ch === 'C' || ch === 'U') return ch;
  return 'M';
}

function myersDiff(a, b) {
  const n = a.length, m = b.length;
  const max = n + m;
  const v = new Map([[1, 0]]);
  const trace = [];
  for (let d = 0; d <= max; d++) {
    trace.push(new Map(v));
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v.get(k - 1) < v.get(k + 1))) {
        x = v.get(k + 1);
      } else {
        x = v.get(k - 1) + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v.set(k, x);
      if (x >= n && y >= m) return backtrack(trace, a, b, d);
    }
  }
  return [];
}

function backtrack(trace, a, b, d) {
  const ops = [];
  let x = a.length, y = b.length;
  for (let depth = d; depth > 0; depth--) {
    const v = trace[depth];
    const k = x - y;
    const prevK = (k === -depth || (k !== depth && v.get(k - 1) < v.get(k + 1))) ? k + 1 : k - 1;
    const prevX = v.get(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push({ type: 'equal', line: a[x - 1] });
      x--; y--;
    }
    if (x === prevX) {
      ops.push({ type: 'add', line: b[y - 1] });
      y--;
    } else {
      ops.push({ type: 'del', line: a[x - 1] });
      x--;
    }
  }
  while (x > 0 && y > 0) {
    ops.push({ type: 'equal', line: a[x - 1] });
    x--; y--;
  }
  return ops.reverse();
}

function opsToRows(ops) {
  const rows = [];
  let oldNum = 0, newNum = 0;
  let i = 0;
  while (i < ops.length) {
    if (ops[i].type === 'equal') {
      oldNum++; newNum++;
      rows.push({
        left: { num: oldNum, text: ops[i].line, type: 'equal' },
        right: { num: newNum, text: ops[i].line, type: 'equal' },
      });
      i++;
      continue;
    }
    const dels = [];
    while (i < ops.length && ops[i].type === 'del') { dels.push(ops[i].line); i++; }
    const adds = [];
    while (i < ops.length && ops[i].type === 'add') { adds.push(ops[i].line); i++; }
    const count = Math.max(dels.length, adds.length);
    for (let j = 0; j < count; j++) {
      const left = j < dels.length ? { num: ++oldNum, text: dels[j], type: 'del' } : null;
      const right = j < adds.length ? { num: ++newNum, text: adds[j], type: 'add' } : null;
      rows.push({ left, right });
    }
  }
  return rows;
}

function diffToRows(oldLines, newLines) {
  const ops = (oldLines.length + newLines.length > MAX_DIFF_LINES)
    ? [...oldLines.map(line => ({ type: 'del', line })), ...newLines.map(line => ({ type: 'add', line }))]
    : myersDiff(oldLines, newLines);
  return opsToRows(ops);
}

// A file that doesn't exist has zero lines, not one blank line — splitting '' would produce
// ['' ], letting the diff falsely match a real blank line in the other version as "equal".
function linesOf(fileState) {
  return fileState.exists ? fileState.content.split('\n') : [];
}

function buildEntry(path, origPath, statusChar, old, current) {
  if (old.binary || current.binary) {
    return { path, origPath, status: statusLabel(statusChar), binary: true, rows: [] };
  }
  const rows = diffToRows(linesOf(old), linesOf(current));
  return { path, origPath, status: statusLabel(statusChar), binary: false, rows };
}

// Mirrors an IDE's source control panel: "staged" diffs the index against HEAD,
// "unstaged" diffs the working tree against whatever's in the index (or HEAD if nothing is staged).
// A file with changes in both places appears in both sections with independent diffs.
function buildDiffPayload(repoRoot) {
  const staged = [];
  const unstaged = [];

  for (const entry of getChangedFiles(repoRoot)) {
    const { path, origPath, status } = entry;
    const indexStatus = status[0];
    const worktreeStatus = status[1];

    if (status === '??') {
      unstaged.push(buildEntry(path, null, 'U', EMPTY_FILE, readWorkingFile(repoRoot, path)));
      continue;
    }

    if (indexStatus !== ' ') {
      const old = readHeadFile(repoRoot, origPath || path);
      const current = indexStatus === 'D' ? EMPTY_FILE : readIndexFile(repoRoot, path);
      staged.push(buildEntry(path, origPath, indexStatus, old, current));
    }

    if (worktreeStatus !== ' ' && worktreeStatus !== '?') {
      const old = indexStatus !== ' ' ? readIndexFile(repoRoot, path) : readHeadFile(repoRoot, path);
      unstaged.push(buildEntry(path, null, worktreeStatus, old, readWorkingFile(repoRoot, path)));
    }
  }

  return { staged, unstaged };
}

function serveStatic(req, res) {
  const filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const full = join(PUBLIC_DIR, filePath);
  if (!full.startsWith(PUBLIC_DIR) || !existsSync(full) || statSync(full).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(full)] || 'application/octet-stream' });
  res.end(readFileSync(full));
}

function openBrowser(url) {
  const cmd = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform() === 'win32' ? ['/c', 'start', '""', url] : [url];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  } catch {}
}

function main() {
  let repoRoot;
  try {
    repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd() }).toString().trim();
  } catch {
    console.error('Not inside a git repository.');
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    if (req.url === '/api/diff') {
      try {
        const payload = buildDiffPayload(repoRoot);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err.message || err) }));
      }
      return;
    }
    serveStatic(req, res);
  });

  server.listen(process.env.PORT ? Number(process.env.PORT) : 0, () => {
    const { port } = server.address();
    const url = `http://localhost:${port}`;
    console.log(`Diff viewer running at ${url}`);
    console.log('Press Ctrl+C to stop.');
    openBrowser(url);
  });
}

main();
