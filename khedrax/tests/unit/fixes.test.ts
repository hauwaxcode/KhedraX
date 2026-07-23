import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { createAgent } from '../../src/cli/commands/create.ts';
import { loadCheckpoint, saveCheckpoint } from '../../src/workflow/checkpoint.ts';
import { checkNodeVersion } from '../../src/cli/utils/nodeVersion.ts';
import { buildAgentDNA } from '../../src/dna/loader.ts';
import { getRegistrySnapshot } from '../../src/registry/index.ts';
import { runWorkflow } from '../../src/workflow/runner.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const khedraxRoot = path.resolve(repoRoot, 'khedrax');

async function copyFixture(rootDir: string): Promise<void> {
  await fs.mkdir(rootDir, { recursive: true });
  await fs.cp(path.join(khedraxRoot, 'agentTypes'), path.join(rootDir, 'agentTypes'), { recursive: true });
  await fs.cp(path.join(khedraxRoot, 'modules'), path.join(rootDir, 'modules'), { recursive: true });
  await fs.cp(path.join(khedraxRoot, 'templates'), path.join(rootDir, 'templates'), { recursive: true });
  await fs.cp(path.join(khedraxRoot, 'personas'), path.join(rootDir, 'personas'), { recursive: true });
}

async function hashDirectory(dir: string): Promise<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const hashes: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(dir, entry.name);
    const stat = await fs.stat(fullPath);
    if (entry.isDirectory()) {
      hashes.push(`D:${entry.name}:${await hashDirectory(fullPath)}`);
    } else {
      hashes.push(`F:${entry.name}:${(await fs.readFile(fullPath, 'utf8')).trim()}`);
    }
  }
  return hashes.join('|');
}

test('resume workflow preserves output across checkpoints', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-resume-'));
  const buildId = 'resume-test';
  const checkpoint = { buildId, completed: [], artifacts: {} };
  await saveCheckpoint(buildId, checkpoint);

  const stepOne = {
    name: 'module',
    async fn() {
      await fs.writeFile(path.join(workspace, 'module.txt'), 'module');
      return { artifacts: {} };
    },
  };
  const stepTwo = {
    name: 'documentation',
    async fn() {
      await fs.writeFile(path.join(workspace, 'documentation.txt'), 'documentation');
      return { artifacts: {} };
    },
  };

  const interrupted = await runWorkflow([stepOne], checkpoint as any);
  await saveCheckpoint(buildId, interrupted);
  const resumed = await runWorkflow([stepOne, stepTwo], await loadCheckpoint(buildId) as any);

  assert.equal(resumed.completed.includes('module'), true);
  assert.equal(resumed.completed.includes('documentation'), true);
  assert.equal(await fs.readFile(path.join(workspace, 'documentation.txt'), 'utf8'), 'documentation');
});

test('double-run without force leaves the first output intact', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-no-force-'));
  const fixtureRoot = path.join(workspace, 'fixture');
  await copyFixture(fixtureRoot);
  const outputDir = path.join(workspace, 'out');

  await createAgent({
    name: 'SupportBot',
    type: 'customer-support',
    outputDir,
    modules: [],
    force: true,
    verbose: false,
    rootDir: fixtureRoot,
  } as any);

  const before = await hashDirectory(outputDir);
  await assert.rejects(() => createAgent({
    name: 'SupportBot',
    type: 'customer-support',
    outputDir,
    modules: [],
    force: false,
    verbose: false,
    rootDir: fixtureRoot,
  } as any), /already exists/i);
  const after = await hashDirectory(outputDir);
  assert.equal(after, before);
});

test('double-run with force replaces the first output', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-force-'));
  const fixtureRoot = path.join(workspace, 'fixture');
  await copyFixture(fixtureRoot);
  const outputDir = path.join(workspace, 'out');

  await createAgent({
    name: 'SupportBot',
    type: 'customer-support',
    outputDir,
    modules: [],
    force: true,
    verbose: false,
    rootDir: fixtureRoot,
  } as any);

  await createAgent({
    name: 'SupportBot',
    type: 'customer-support',
    outputDir,
    modules: [],
    force: true,
    verbose: false,
    rootDir: fixtureRoot,
  } as any);

  const entries = await fs.readdir(outputDir, { withFileTypes: true });
  assert.ok(entries.some((entry) => entry.name === 'README.md'));
});

test('new agent type entries are discovered without source changes', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-registry-'));
  const fixtureRoot = path.join(workspace, 'fixture');
  await copyFixture(fixtureRoot);
  await fs.mkdir(path.join(fixtureRoot, 'agentTypes', 'support-plus'), { recursive: true });
  await fs.writeFile(path.join(fixtureRoot, 'agentTypes', 'support-plus', 'agentType.json'), JSON.stringify({ name: 'support-plus', version: '1.0.0', defaultModules: ['memory'] }, null, 2));

  const registry = await getRegistrySnapshot(fixtureRoot);
  assert.ok(registry.agentTypes['support-plus']);
  const dna = await buildAgentDNA({
    name: 'SupportBot',
    type: 'support-plus',
    outputDir: path.join(workspace, 'out'),
    modules: [],
    force: true,
    verbose: false,
    rootDir: fixtureRoot,
  } as any, registry);
  assert.equal(dna.agent.type, 'support-plus');
});

test('buildAgentDNA tolerates an unsafe caller that omits modules', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-unsafe-modules-'));
  const fixtureRoot = path.join(workspace, 'fixture');
  await copyFixture(fixtureRoot);
  const registry = await getRegistrySnapshot(fixtureRoot);

  await assert.doesNotReject(() => buildAgentDNA({
    name: 'SupportBot',
    type: 'customer-support',
    outputDir: path.join(workspace, 'out'),
    force: true,
    verbose: false,
    rootDir: fixtureRoot,
  } as any, registry));
});

test('module prompt fragments are assembled into prompts readme', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-prompts-'));
  const fixtureRoot = path.join(workspace, 'fixture');
  await copyFixture(fixtureRoot);
  const outputDir = path.join(workspace, 'out');

  await createAgent({
    name: 'SupportBot',
    type: 'customer-support',
    outputDir,
    modules: ['memory'],
    force: true,
    verbose: false,
    rootDir: fixtureRoot,
  } as any);

  const promptReadme = await fs.readFile(path.join(outputDir, 'prompts', 'README.md'), 'utf8');
  assert.match(promptReadme, /memory/i);
  assert.match(promptReadme, /memory scaffolding/i);
});

test('agent.yaml is fully rendered and reflects dna modules', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-agentyaml-'));
  const fixtureRoot = path.join(workspace, 'fixture');
  await copyFixture(fixtureRoot);
  const outputDir = path.join(workspace, 'out');

  await createAgent({
    name: 'SupportBot',
    type: 'customer-support',
    outputDir,
    modules: ['memory'],
    force: true,
    verbose: false,
    rootDir: fixtureRoot,
  } as any);

  const agentYaml = await fs.readFile(path.join(outputDir, 'agent.yaml'), 'utf8');
  assert.equal(agentYaml.includes('{{'), false);
  assert.match(agentYaml, /modules: /);
  assert.match(agentYaml, /- memory/);
});

test('generated agent.yaml parses as YAML for zero-module and persona-backed projects', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-yaml-'));
  const fixtureRoot = path.join(workspace, 'fixture');
  await copyFixture(fixtureRoot);

  const basicOutputDir = path.join(workspace, 'basic-out');
  await createAgent({
    name: 'MinimalBot',
    type: 'basic',
    outputDir: basicOutputDir,
    modules: [],
    force: true,
    verbose: false,
    rootDir: fixtureRoot,
  } as any);

  const basicYaml = await fs.readFile(path.join(basicOutputDir, 'agent.yaml'), 'utf8');
  const basicParsed = load(basicYaml) as Record<string, unknown>;
  assert.deepEqual(basicParsed.modules, []);

  const supportOutputDir = path.join(workspace, 'support-out');
  await createAgent({
    name: 'SupportBot',
    type: 'customer-support',
    outputDir: supportOutputDir,
    modules: ['memory'],
    force: true,
    verbose: false,
    rootDir: fixtureRoot,
  } as any);

  const supportYaml = await fs.readFile(path.join(supportOutputDir, 'agent.yaml'), 'utf8');
  const supportParsed = load(supportYaml) as Record<string, any>;
  assert.deepEqual(supportParsed.modules, ['memory']);
  assert.equal(supportParsed.persona?.presetName, 'professional-support');
});

test('node version guard reports supported versions', () => {
  const result = checkNodeVersion(process.versions.node);
  assert.equal(result.ok, true);
});
