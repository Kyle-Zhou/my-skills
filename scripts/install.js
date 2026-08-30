#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, '..', 'skills');

const TARGETS = {
  claude:    { ext: '.md',  dir: (scope) => scope === 'project' ? ['.claude', 'commands'] : [homedir(), '.claude', 'commands'] },
  conductor: { ext: '.md',  dir: (scope) => scope === 'project' ? ['.claude', 'commands'] : [homedir(), '.claude', 'commands'] },
  cursor:    { ext: '.mdc', dir: (scope) => scope === 'project' ? ['.cursor', 'rules']    : [homedir(), '.cursor', 'rules'] },
};

function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) meta[key.trim()] = rest.join(':').trim();
  }
  return { meta, body: match[2].trim() };
}

function transformContent(content, target) {
  const { meta, body } = parseFrontmatter(content);

  if (target === 'cursor') {
    // Cursor uses .mdc rules: no allowed-tools, uses alwaysApply + description
    return `---\ndescription: ${meta.description || ''}\nalwaysApply: false\n---\n\n${body}`;
  }

  // Claude Code and Conductor: use as-is
  return content;
}

function usageHint(target, skills) {
  const names = skills.join(', ');
  switch (target) {
    case 'claude':
    case 'conductor':
      return `Run /${skills.join(' or /')} in a Claude Code session.`;
    case 'cursor':
      return `Reference @${skills.join(' or @')} in Cursor chat, or enable "Always apply" in Cursor settings.`;
  }
}

function installSkill(skillName, destDir, ext, target) {
  const src = join(SKILLS_DIR, skillName, 'SKILL.md');
  if (!existsSync(src)) {
    console.error(`  ✗ ${skillName}: SKILL.md not found`);
    return false;
  }

  const raw = readFileSync(src, 'utf8');
  const content = transformContent(raw, target);
  const dest = join(destDir, `${skillName}${ext}`);

  mkdirSync(destDir, { recursive: true });

  if (existsSync(dest)) {
    const existing = readFileSync(dest, 'utf8');
    if (hash(existing) === hash(content)) {
      console.log(`  — ${skillName}: already up to date`);
      return true;
    }
    writeFileSync(dest, content, 'utf8');
    console.log(`  ↑ ${skillName}: updated`);
  } else {
    writeFileSync(dest, content, 'utf8');
    console.log(`  ✓ ${skillName}: installed`);
  }
  return true;
}

function availableSkills() {
  return readdirSync(SKILLS_DIR).filter(name =>
    statSync(join(SKILLS_DIR, name)).isDirectory() &&
    existsSync(join(SKILLS_DIR, name, 'SKILL.md'))
  );
}

function parseArgs(args) {
  const targetIdx = args.indexOf('--target');
  const target = targetIdx !== -1 ? args[targetIdx + 1] : 'claude';
  const scope = args.includes('--project') ? 'project' : 'user';
  const skill = args.find(a => !a.startsWith('--') && a !== args[targetIdx + 1]);
  return { target, scope, skill };
}

function main() {
  const { target, scope, skill } = parseArgs(process.argv.slice(2));

  if (!TARGETS[target]) {
    console.error(`Unknown target "${target}". Valid targets: ${Object.keys(TARGETS).join(', ')}`);
    process.exit(1);
  }

  const { ext, dir } = TARGETS[target];
  const destDir = join(...dir(scope));
  const skills = skill ? [skill] : availableSkills();
  const scopeLabel = scope === 'project' ? 'project' : 'user';

  console.log(`Target: ${target} | Scope: ${scopeLabel} | Destination: ${destDir}\n`);

  let ok = 0;
  for (const s of skills) {
    if (installSkill(s, destDir, ext, target)) ok++;
  }

  console.log(`\n${usageHint(target, skills)}`);
  if (ok !== skills.length) process.exit(1);
}

main();
