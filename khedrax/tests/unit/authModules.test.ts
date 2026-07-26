import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAgent } from '../../src/cli/commands/create.ts';

const authModules = [
  'auth-email',
  'auth-google',
  'auth-github',
  'auth-discord',
  'auth-telegram',
  'auth-siwe',
  'auth-sso',
];

async function createAuthModuleProject(moduleName: string) {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), `khedrax-auth-${moduleName}-`));
  const outputDir = path.join(workspace, 'out');

  const displayName = moduleName
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');

  const result = await createAgent({
    name: `${displayName}Bot`,
    type: 'basic',
    outputDir,
    modules: [moduleName],
    force: true,
    verbose: false,
  });

  assert.equal(result.outputPath, outputDir);
  return { outputDir, workspace };
}

test('auth modules generate with their prompt, docs, and implementation scaffolds', async () => {
  for (const moduleName of authModules) {
    const { outputDir } = await createAuthModuleProject(moduleName);

    const agentYaml = await fs.readFile(path.join(outputDir, 'agent.yaml'), 'utf8');
    assert.match(agentYaml, new RegExp(`modules: \\n  - ${moduleName}`));

    const docsReadme = await fs.readFile(path.join(outputDir, 'docs', 'README.md'), 'utf8');
    assert.match(docsReadme, /## Modules/);
    assert.match(docsReadme, new RegExp(moduleName));

    const promptsReadme = await fs.readFile(path.join(outputDir, 'prompts', 'README.md'), 'utf8');
    assert.match(promptsReadme, new RegExp(`#### ${moduleName}`));

    const implementationDir = path.join(outputDir, 'implementation');
    const implementationEntries = await fs.readdir(implementationDir);
    assert.ok(implementationEntries.includes(moduleName));

    const moduleImplementationDir = path.join(implementationDir, moduleName);
    const moduleImplementationEntries = await fs.readdir(moduleImplementationDir);
    assert.ok(moduleImplementationEntries.includes('README.md'));

    const moduleReadme = await fs.readFile(path.join(outputDir, 'implementation', moduleName, 'README.md'), 'utf8');
    assert.match(moduleReadme, /v1 scaffold/i);
  }
});

test('auth modules compose without collisions and in alphabetical order', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-auth-composition-'));
  const outputDir = path.join(workspace, 'out');

  const result = await createAgent({
    name: 'AuthCompositionBot',
    type: 'basic',
    outputDir,
    modules: ['auth-google', 'auth-github', 'auth-siwe'],
    force: true,
    verbose: false,
  });

  assert.equal(result.outputPath, outputDir);

  const docsReadme = await fs.readFile(path.join(outputDir, 'docs', 'README.md'), 'utf8');
  assert.match(docsReadme, /## Modules/);
  assert.match(docsReadme, /auth-github/);
  assert.match(docsReadme, /auth-google/);
  assert.match(docsReadme, /auth-siwe/);

  const promptsReadme = await fs.readFile(path.join(outputDir, 'prompts', 'README.md'), 'utf8');
  assert.match(promptsReadme, /#### auth-github/);
  assert.match(promptsReadme, /#### auth-google/);
  assert.match(promptsReadme, /#### auth-siwe/);
});

test('auth modules compose with billing and memory without collisions', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-auth-mixed-composition-'));
  const outputDir = path.join(workspace, 'out');

  const result = await createAgent({
    name: 'AuthMixedCompositionBot',
    type: 'basic',
    outputDir,
    modules: ['auth-google', 'billing-subscription', 'memory'],
    force: true,
    verbose: false,
  });

  assert.equal(result.outputPath, outputDir);

  const docsReadme = await fs.readFile(path.join(outputDir, 'docs', 'README.md'), 'utf8');
  assert.match(docsReadme, /## Modules/);
  assert.match(docsReadme, /auth-google/);
  assert.match(docsReadme, /billing-subscription/);
  assert.match(docsReadme, /memory/);

  const promptsReadme = await fs.readFile(path.join(outputDir, 'prompts', 'README.md'), 'utf8');
  assert.match(promptsReadme, /#### auth-google/);
  assert.match(promptsReadme, /#### billing-subscription/);
  assert.match(promptsReadme, /#### memory/);
});
