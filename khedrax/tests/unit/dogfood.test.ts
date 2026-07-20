import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { createAgent } from '../../src/cli/commands/create.ts';

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

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function assertGeneratedAgent(agentType: string, modules: string[], expectedPersona: string, expectedToolName: string): Promise<{ agentYaml: Record<string, any>; outputDir: string }> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), `khedrax-dogfood-${agentType}-`));
  const fixtureRoot = path.join(workspace, 'fixture');
  const outputDir = path.join(workspace, 'out');
  await copyFixture(fixtureRoot);

  await createAgent({
    name: `${expectedToolName}Tool`,
    type: agentType,
    outputDir,
    modules: [],
    force: true,
    verbose: false,
    rootDir: fixtureRoot,
  } as any);

  const agentYaml = load(await fs.readFile(path.join(outputDir, 'agent.yaml'), 'utf8')) as Record<string, any>;
  assert.equal(agentYaml.agent?.type, agentType);
  assert.equal(agentYaml.persona?.presetName, expectedPersona);
  assert.deepEqual(agentYaml.modules, modules);

  const docsReadme = await fs.readFile(path.join(outputDir, 'docs', 'README.md'), 'utf8');
  const promptReadme = await fs.readFile(path.join(outputDir, 'prompts', 'README.md'), 'utf8');

  const personaJson = JSON.parse(await fs.readFile(path.join(fixtureRoot, 'personas', expectedPersona, 'persona.json'), 'utf8'));
  assert.match(docsReadme, new RegExp(personaJson.tone, 'i'));

  for (const moduleName of modules) {
    const moduleDir = path.join(fixtureRoot, 'modules', moduleName);
    const moduleJson = JSON.parse(await fs.readFile(path.join(moduleDir, 'module.json'), 'utf8'));
    for (const capability of moduleJson.capabilities ?? []) {
      assert.match(docsReadme, new RegExp(capability.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    }
    for (const constraint of moduleJson.constraints ?? []) {
      assert.match(docsReadme, new RegExp(constraint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    }
    const promptFragment = await fs.readFile(path.join(moduleDir, 'prompts', 'fragment.md'), 'utf8');
    assert.match(promptReadme, new RegExp(promptFragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }

  return { agentYaml, outputDir };
}

test('Documentation Updater generates with only existing registry data', async () => {
  const result = await assertGeneratedAgent('documentation-assistant', ['rag', 'github'], 'clear-communicator', 'DocumentationUpdater');
  assert.equal(result.agentYaml.agent.type, 'documentation-assistant');
  assert.equal(result.agentYaml.persona?.presetName, 'clear-communicator');
});

test('Release Note Writer generates correctly', async () => {
  await assertGeneratedAgent('release-note-writer', ['github'], 'audience-focused-narrator', 'ReleaseNoteWriter');
});

test('GitHub Triage Assistant generates correctly', async () => {
  await assertGeneratedAgent('github-triage-assistant', ['github', 'memory'], 'efficient-triager', 'GitHubTriageAssistant');
});

test('Changelog Generator generates correctly', async () => {
  await assertGeneratedAgent('changelog-generator', ['github'], 'terse-technical-logger', 'ChangelogGenerator');
});

test('Test Report Analyzer generates correctly and includes new module capabilities', async () => {
  const { agentYaml } = await assertGeneratedAgent('test-report-analyzer', ['test-analysis', 'memory'], 'diagnostic-analyst', 'TestReportAnalyzer');
  assert.equal(agentYaml.agent.type, 'test-report-analyzer');
  assert.equal(agentYaml.persona?.presetName, 'diagnostic-analyst');
});
