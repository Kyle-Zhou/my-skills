function escapeHtml(s) {
  return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

const EXT_LANG = {
  js: 'js', jsx: 'js', mjs: 'js', cjs: 'js', ts: 'js', tsx: 'js', mts: 'js', cts: 'js',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'clike', c: 'clike', h: 'clike', cpp: 'clike', cc: 'clike', hpp: 'clike',
  cs: 'clike', php: 'clike', kt: 'clike', swift: 'clike',
  json: 'json', jsonc: 'json',
  css: 'css', scss: 'css', less: 'css',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  yml: 'yaml', yaml: 'yaml',
  sql: 'sql',
};

const LANG_RULES = {
  js: {
    lineComment: '//', blockComment: ['/*', '*/'], strings: ['"', "'", '`'],
    keywords: new Set(['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'class', 'extends', 'implements', 'new', 'this', 'super', 'import', 'export', 'from', 'as', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in', 'of', 'yield', 'static', 'get', 'set', 'null', 'undefined', 'true', 'false', 'void', 'delete', 'interface', 'type', 'enum', 'namespace', 'declare', 'readonly', 'public', 'private', 'protected', 'abstract']),
  },
  python: {
    lineComment: '#', blockComment: null, strings: ['"', "'"],
    keywords: new Set(['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'class', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'lambda', 'yield', 'pass', 'None', 'True', 'False', 'and', 'or', 'not', 'in', 'is', 'global', 'nonlocal', 'assert', 'del', 'async', 'await']),
  },
  ruby: {
    lineComment: '#', blockComment: null, strings: ['"', "'"],
    keywords: new Set(['def', 'end', 'return', 'if', 'elsif', 'else', 'unless', 'for', 'while', 'until', 'break', 'next', 'redo', 'retry', 'class', 'module', 'require', 'require_relative', 'begin', 'rescue', 'ensure', 'raise', 'yield', 'nil', 'true', 'false', 'and', 'or', 'not', 'self', 'do', 'then', 'case', 'when', 'in', 'private', 'public', 'protected']),
  },
  go: {
    lineComment: '//', blockComment: ['/*', '*/'], strings: ['"', '`'],
    keywords: new Set(['func', 'return', 'if', 'else', 'for', 'range', 'break', 'continue', 'switch', 'case', 'default', 'fallthrough', 'package', 'import', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'defer', 'select', 'nil', 'true', 'false', 'iota']),
  },
  rust: {
    lineComment: '//', blockComment: ['/*', '*/'], strings: ['"'],
    keywords: new Set(['fn', 'let', 'mut', 'return', 'if', 'else', 'for', 'while', 'loop', 'break', 'continue', 'match', 'struct', 'enum', 'impl', 'trait', 'pub', 'use', 'mod', 'crate', 'self', 'Self', 'true', 'false', 'None', 'Some', 'Ok', 'Err', 'async', 'await', 'move', 'ref', 'dyn', 'where', 'unsafe', 'type', 'const', 'static', 'as', 'in']),
  },
  clike: {
    lineComment: '//', blockComment: ['/*', '*/'], strings: ['"', "'"],
    keywords: new Set(['int', 'long', 'short', 'char', 'float', 'double', 'void', 'bool', 'boolean', 'unsigned', 'signed', 'byte', 'struct', 'class', 'interface', 'enum', 'public', 'private', 'protected', 'static', 'final', 'const', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'new', 'delete', 'this', 'super', 'extends', 'implements', 'import', 'package', 'namespace', 'using', 'include', 'define', 'null', 'nullptr', 'true', 'false', 'virtual', 'override', 'template', 'typename', 'throw', 'try', 'catch', 'finally', 'function', 'var', 'let', 'fn', 'val', 'fun', 'object', 'trait']),
  },
  json: {
    lineComment: null, blockComment: null, strings: ['"'],
    keywords: new Set(['true', 'false', 'null']),
  },
  css: {
    lineComment: null, blockComment: ['/*', '*/'], strings: ['"', "'"],
    keywords: new Set(['important', 'media', 'import', 'keyframes', 'from', 'to', 'var', 'calc', 'root', 'supports', 'font-face']),
  },
  shell: {
    lineComment: '#', blockComment: null, strings: ['"', "'"],
    keywords: new Set(['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done', 'case', 'esac', 'function', 'return', 'echo', 'export', 'local', 'in', 'break', 'continue', 'exit']),
  },
  yaml: {
    lineComment: '#', blockComment: null, strings: ['"', "'"],
    keywords: new Set(['true', 'false', 'null', 'yes', 'no']),
  },
  sql: {
    lineComment: '--', blockComment: ['/*', '*/'], strings: ["'"], caseInsensitiveKeywords: true,
    keywords: new Set(['select', 'from', 'where', 'insert', 'into', 'values', 'update', 'set', 'delete', 'join', 'left', 'right', 'inner', 'outer', 'on', 'group', 'by', 'order', 'having', 'create', 'table', 'drop', 'alter', 'and', 'or', 'not', 'null', 'as', 'distinct', 'limit', 'union', 'all', 'exists', 'between', 'like', 'is', 'primary', 'key', 'foreign', 'references', 'default', 'index', 'view', 'with']),
  },
};

function detectLanguage(path) {
  const match = /\.([A-Za-z0-9]+)$/.exec(path);
  return match ? EXT_LANG[match[1].toLowerCase()] || null : null;
}

// Single-pass, per-line tokenizer — no cross-line state, so a block comment or
// string that spans multiple lines will only be colored correctly on its first line.
function highlightLine(text, lang) {
  const rules = lang && LANG_RULES[lang];
  if (!rules) return escapeHtml(text);

  let out = '';
  let i = 0;
  const n = text.length;

  while (i < n) {
    if (rules.lineComment && text.startsWith(rules.lineComment, i)) {
      out += `<span class="tok-comment">${escapeHtml(text.slice(i))}</span>`;
      break;
    }

    if (rules.blockComment && text.startsWith(rules.blockComment[0], i)) {
      const end = text.indexOf(rules.blockComment[1], i + rules.blockComment[0].length);
      const stop = end === -1 ? n : end + rules.blockComment[1].length;
      out += `<span class="tok-comment">${escapeHtml(text.slice(i, stop))}</span>`;
      i = stop;
      continue;
    }

    if (lang === 'css' && text[i] === '#' && /^[0-9a-fA-F]{3,8}\b/.test(text.slice(i + 1))) {
      const hex = /^#[0-9a-fA-F]{3,8}\b/.exec(text.slice(i))[0];
      out += `<span class="tok-number">${escapeHtml(hex)}</span>`;
      i += hex.length;
      continue;
    }

    if (rules.strings.includes(text[i])) {
      const quote = text[i];
      let j = i + 1;
      while (j < n && text[j] !== quote) {
        j += text[j] === '\\' ? 2 : 1;
      }
      j = Math.min(j + 1, n);
      out += `<span class="tok-string">${escapeHtml(text.slice(i, j))}</span>`;
      i = j;
      continue;
    }

    const numMatch = /^\d[\d_]*(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
    if (numMatch && !/[\w$]/.test(text[i - 1] || '')) {
      out += `<span class="tok-number">${escapeHtml(numMatch[0])}</span>`;
      i += numMatch[0].length;
      continue;
    }

    const idMatch = /^[A-Za-z_$][\w$]*/.exec(text.slice(i));
    if (idMatch) {
      const word = idMatch[0];
      const key = rules.caseInsensitiveKeywords ? word.toLowerCase() : word;
      const rest = text.slice(i + word.length);
      if (rules.keywords.has(key)) {
        out += `<span class="tok-keyword">${escapeHtml(word)}</span>`;
      } else if (/^\s*\(/.test(rest)) {
        out += `<span class="tok-function">${escapeHtml(word)}</span>`;
      } else {
        out += escapeHtml(word);
      }
      i += word.length;
      continue;
    }

    out += escapeHtml(text[i]);
    i++;
  }

  return out;
}
