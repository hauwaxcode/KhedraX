import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRegistrySnapshot } from '../../src/registry/index.ts';
import { buildAgentDNA } from '../../src/dna/loader.ts';
import { DeploymentEngine } from '../../src/engines/deploymentEngine.ts';
import { TemplateEngine } from '../../src/engines/templateEngine.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const khedraxRoot = path.resolve(repoRoot, 'khedrax');

test('deployment engine is a no-op when no target is set', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  const dna = await buildAgentDNA({
    name: 'LocalBot',
    type: 'basic',
    outputDir: '/tmp/out',
    modules: [],
    force: false,
    verbose: false,
  }, registry);
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-deployment-noop-'));
  const tempDir = path.join(workspace, 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  await new TemplateEngine().run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
  const engine = new DeploymentEngine();
  const result = await engine.run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
  assert.deepEqual(result.artifacts, { skipped: true });
  const deploymentReadme = await fs.readFile(path.join(tempDir, 'deployment', 'README.md'), 'utf8');
  assert.match(deploymentReadme, /Deployment placeholder/);
});

test('deployment engine scaffolds local templates into deployment directory', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  const dna = await buildAgentDNA({
    name: 'LocalBot',
    type: 'basic',
    outputDir: '/tmp/out',
    modules: [],
    force: false,
    verbose: false,
  }, registry);
  dna.deployment = { target: 'local' };
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-deployment-local-'));
  const tempDir = path.join(workspace, 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  await new TemplateEngine().run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
  const engine = new DeploymentEngine();
  await engine.run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
  const deployScript = await fs.readFile(path.join(tempDir, 'deployment', 'deploy.sh'), 'utf8');
  assert.match(deployScript, /Local deployment scaffold ready/);
  assert.match(deployScript, /secretsRequired/);
  const envExample = await fs.readFile(path.join(tempDir, 'deployment', '.env.example'), 'utf8');
  assert.equal(envExample.trim(), '# Local deployment does not require additional secrets.');
});

test('deployment engine scaffolds pharos templates with required secrets', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  const dna = await buildAgentDNA({
    name: 'PharosBot',
    type: 'basic',
    outputDir: '/tmp/out',
    modules: [],
    force: false,
    verbose: false,
  }, registry);
  dna.deployment = { target: 'pharos' };
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-deployment-pharos-'));
  const tempDir = path.join(workspace, 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  await new TemplateEngine().run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
  const engine = new DeploymentEngine();
  await engine.run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
  const deployScript = await fs.readFile(path.join(tempDir, 'deployment', 'deploy.sh'), 'utf8');
  assert.match(deployScript, /PHAROS_RPC_URL/);
  assert.match(deployScript, /PHAROS_DEPLOYER_PRIVATE_KEY/);
  const envExample = await fs.readFile(path.join(tempDir, 'deployment', '.env.example'), 'utf8');
  assert.match(envExample, /PHAROS_RPC_URL/);
  assert.match(envExample, /PHAROS_DEPLOYER_PRIVATE_KEY/);
});
