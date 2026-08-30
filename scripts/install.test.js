import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  hash,
  parseFrontmatter,
  transformContent,
  installSkill,
  availableSkills,
  parseArgs,
} from './install.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'skills-test-'));
}

function makeSkill(skillsDir, name, content) {
  const dir = join(skillsDir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), content, 'utf8');
}

const SAMPLE = `---
description: Do the thing
allowed-tools: Read, Bash(find:*)
---

Body content here.`;

// ── hash ─────────────────────────────────────────────────────────────────────

test('hash: same content produces same hash', () => {
  assert.equal(hash('hello'), hash('hello'));
});

test('hash: different content produces different hash', () => {
  assert.notEqual(hash('hello'), hash('world'));
});

// ── parseFrontmatter ─────────────────────────────────────────────────────────

test('parseFrontmatter: extracts meta and body', () => {
  const { meta, body } = parseFrontmatter(SAMPLE);
  assert.equal(meta.description, 'Do the thing');
  assert.equal(meta['allowed-tools'], 'Read, Bash(find:*)');
  assert.equal(body, 'Body content here.');
});

test('parseFrontmatter: returns empty meta when no frontmatter', () => {
  const content = 'Just a plain body.';
  const { meta, body } = parseFrontmatter(content);
  assert.deepEqual(meta, {});
  assert.equal(body, content);
});

// ── transformContent ─────────────────────────────────────────────────────────

test('transformContent: claude target passes content through unchanged', () => {
  assert.equal(transformContent(SAMPLE, 'claude'), SAMPLE);
});

test('transformContent: conductor target passes content through unchanged', () => {
  assert.equal(transformContent(SAMPLE, 'conductor'), SAMPLE);
});

test('transformContent: cursor target rewrites frontmatter to mdc format', () => {
  const result = transformContent(SAMPLE, 'cursor');
  assert.ok(result.includes('alwaysApply: false'));
  assert.ok(result.includes('description: Do the thing'));
  assert.ok(!result.includes('allowed-tools'));
  assert.ok(result.includes('Body content here.'));
});

test('transformContent: cursor target handles missing description gracefully', () => {
  const content = `---\nallowed-tools: Read\n---\n\nBody.`;
  const result = transformContent(content, 'cursor');
  assert.ok(result.includes('description: '));
  assert.ok(result.includes('alwaysApply: false'));
});

// ── installSkill ─────────────────────────────────────────────────────────────

test('installSkill: fresh install creates the file and returns true', () => {
  const skillsDir = tmpDir();
  const destDir = tmpDir();
  try {
    makeSkill(skillsDir, 'my-skill', SAMPLE);
    const result = installSkill('my-skill', destDir, '.md', 'claude', skillsDir);
    assert.equal(result, true);
    const written = readFileSync(join(destDir, 'my-skill.md'), 'utf8');
    assert.equal(written, SAMPLE);
  } finally {
    rmSync(skillsDir, { recursive: true });
    rmSync(destDir, { recursive: true });
  }
});

test('installSkill: already up to date skips write and returns true', () => {
  const skillsDir = tmpDir();
  const destDir = tmpDir();
  try {
    makeSkill(skillsDir, 'my-skill', SAMPLE);
    // Install once
    installSkill('my-skill', destDir, '.md', 'claude', skillsDir);
    // Capture mtime before second install
    const { mtimeMs } = statSync(join(destDir, 'my-skill.md'));
    // Install again — hash matches, should not rewrite
    const result = installSkill('my-skill', destDir, '.md', 'claude', skillsDir);
    assert.equal(result, true);
    const { mtimeMs: mtimeAfter } = statSync(join(destDir, 'my-skill.md'));
    assert.equal(mtimeMs, mtimeAfter, 'file should not be rewritten when content is unchanged');
  } finally {
    rmSync(skillsDir, { recursive: true });
    rmSync(destDir, { recursive: true });
  }
});

test('installSkill: changed content overwrites and returns true', () => {
  const skillsDir = tmpDir();
  const destDir = tmpDir();
  try {
    makeSkill(skillsDir, 'my-skill', SAMPLE);
    installSkill('my-skill', destDir, '.md', 'claude', skillsDir);

    // Update the source skill
    const updated = SAMPLE + '\n\nExtra line.';
    writeFileSync(join(skillsDir, 'my-skill', 'SKILL.md'), updated, 'utf8');

    const result = installSkill('my-skill', destDir, '.md', 'claude', skillsDir);
    assert.equal(result, true);
    const written = readFileSync(join(destDir, 'my-skill.md'), 'utf8');
    assert.equal(written, updated);
  } finally {
    rmSync(skillsDir, { recursive: true });
    rmSync(destDir, { recursive: true });
  }
});

test('installSkill: missing SKILL.md returns false', () => {
  const skillsDir = tmpDir();
  const destDir = tmpDir();
  try {
    // No skill created
    const result = installSkill('ghost', destDir, '.md', 'claude', skillsDir);
    assert.equal(result, false);
  } finally {
    rmSync(skillsDir, { recursive: true });
    rmSync(destDir, { recursive: true });
  }
});

test('installSkill: cursor target writes .mdc with transformed frontmatter', () => {
  const skillsDir = tmpDir();
  const destDir = tmpDir();
  try {
    makeSkill(skillsDir, 'my-skill', SAMPLE);
    installSkill('my-skill', destDir, '.mdc', 'cursor', skillsDir);
    const written = readFileSync(join(destDir, 'my-skill.mdc'), 'utf8');
    assert.ok(written.includes('alwaysApply: false'));
    assert.ok(!written.includes('allowed-tools'));
  } finally {
    rmSync(skillsDir, { recursive: true });
    rmSync(destDir, { recursive: true });
  }
});

// ── availableSkills ───────────────────────────────────────────────────────────

test('availableSkills: returns directories that contain SKILL.md', () => {
  const skillsDir = tmpDir();
  try {
    makeSkill(skillsDir, 'skill-a', SAMPLE);
    makeSkill(skillsDir, 'skill-b', SAMPLE);
    const result = availableSkills(skillsDir);
    assert.deepEqual(result.sort(), ['skill-a', 'skill-b']);
  } finally {
    rmSync(skillsDir, { recursive: true });
  }
});

test('availableSkills: ignores directories without SKILL.md', () => {
  const skillsDir = tmpDir();
  try {
    makeSkill(skillsDir, 'skill-a', SAMPLE);
    mkdirSync(join(skillsDir, 'empty-dir'));
    const result = availableSkills(skillsDir);
    assert.deepEqual(result, ['skill-a']);
  } finally {
    rmSync(skillsDir, { recursive: true });
  }
});

// ── parseArgs ─────────────────────────────────────────────────────────────────

test('parseArgs: defaults to claude target and user scope', () => {
  const { target, scope, skill } = parseArgs([]);
  assert.equal(target, 'claude');
  assert.equal(scope, 'user');
  assert.equal(skill, undefined);
});

test('parseArgs: parses --target flag', () => {
  const { target } = parseArgs(['--target', 'cursor']);
  assert.equal(target, 'cursor');
});

test('parseArgs: parses --project flag', () => {
  const { scope } = parseArgs(['--project']);
  assert.equal(scope, 'project');
});

test('parseArgs: parses skill name without --target', () => {
  const { skill, target } = parseArgs(['my-skill']);
  assert.equal(skill, 'my-skill');
  assert.equal(target, 'claude');
});

test('parseArgs: parses skill name alongside --target', () => {
  const { skill, target } = parseArgs(['--target', 'cursor', 'my-skill']);
  assert.equal(skill, 'my-skill');
  assert.equal(target, 'cursor');
});

test('parseArgs: skill name is not confused with --target value', () => {
  // cursor should not be picked up as the skill name
  const { skill, target } = parseArgs(['--target', 'cursor']);
  assert.equal(target, 'cursor');
  assert.equal(skill, undefined);
});
