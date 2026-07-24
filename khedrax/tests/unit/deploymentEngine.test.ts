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
  assert.match(envExample, /PHAROS_NETWORK_MODE=mainnet/);
  const configYaml = await fs.readFile(path.join(tempDir, 'deployment', 'config.yaml'), 'utf8');
  assert.match(configYaml, /network: pharos/);
  assert.match(configYaml, /logLevel: info/);
  const readme = await fs.readFile(path.join(tempDir, 'deployment', 'README.md'), 'utf8');
  assert.match(readme, /Verification/);
  assert.match(readme, /RPC endpoint used to submit transactions/);
  assert.match(readme, /Private key for the wallet/);
  assert.match(readme, /Supported types: keystore, hardware/);
});

test('deployment engine renders target-specific ethereum and base descriptors', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  const targets = ['ethereum', 'base'] as const;

  for (const target of targets) {
    const dna = await buildAgentDNA({
      name: `${target}Bot`,
      type: 'basic',
      outputDir: '/tmp/out',
      modules: [],
      force: false,
      verbose: false,
    }, registry);
    dna.deployment = { target };
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), `khedrax-deployment-${target}-`));
    const tempDir = path.join(workspace, 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    await new TemplateEngine().run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
    const engine = new DeploymentEngine();
    await engine.run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
    const deployScript = await fs.readFile(path.join(tempDir, 'deployment', 'deploy.sh'), 'utf8');
    const statusScript = await fs.readFile(path.join(tempDir, 'deployment', 'status.sh'), 'utf8');
    const logsScript = await fs.readFile(path.join(tempDir, 'deployment', 'logs.sh'), 'utf8');
    const rollbackScript = await fs.readFile(path.join(tempDir, 'deployment', 'rollback.sh'), 'utf8');
    const destroyScript = await fs.readFile(path.join(tempDir, 'deployment', 'destroy.sh'), 'utf8');
    const updateScript = await fs.readFile(path.join(tempDir, 'deployment', 'update.sh'), 'utf8');
    const envExample = await fs.readFile(path.join(tempDir, 'deployment', '.env.example'), 'utf8');
    const readme = await fs.readFile(path.join(tempDir, 'deployment', 'README.md'), 'utf8');

    assert.match(deployScript, new RegExp(`echo "${target.charAt(0).toUpperCase() + target.slice(1)} deployment scaffold ready."`));
    assert.match(statusScript, /status scaffold ready/);
    assert.match(logsScript, /logs scaffold ready/);
    assert.match(rollbackScript, /rollback scaffold ready/);
    assert.match(destroyScript, /destroy scaffold ready/);
    assert.match(updateScript, /update scaffold ready/);
    assert.match(envExample, new RegExp(`${target.toUpperCase()}_RPC_URL`));
    assert.match(readme, /Verification/);
    assert.match(readme, /Secrets/);
    assert.match(readme, /Supported types: keystore, hardware, walletconnect/);
  }
});

test('deployment engine skips missing action templates and only renders deploy.sh when others are absent', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  const customTarget = 'minimal';
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-deployment-minimal-'));
  const customTemplates = path.join(workspace, 'templates');
  await fs.mkdir(customTemplates, { recursive: true });
  await fs.writeFile(path.join(customTemplates, 'deploy.sh'), '#!/usr/bin/env bash\necho "Minimal deploy scaffold ready."\n');

  const minimalDescriptor = {
    name: 'minimal',
    version: '1.0.0',
    runtime: 'node18',
    network: { chainId: null, rpcUrlEnvVar: null },
    walletIntegration: { type: 'none' },
    secretsRequired: [] as string[],
    monitoring: { healthCheckPath: '/health', logDestination: 'stdout' },
    rollback: { strategy: 'restart-process' },
    templatesPath: customTemplates,
  };

  const customRegistry = {
    ...registry,
    deployments: {
      ...registry.deployments,
      [customTarget]: minimalDescriptor,
    },
  };

  const dna = await buildAgentDNA({
    name: 'MinimalBot',
    type: 'basic',
    outputDir: '/tmp/out',
    modules: [],
    force: false,
    verbose: false,
  }, customRegistry);
  dna.deployment = { target: customTarget };

  const tempDir = path.join(workspace, 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  await new TemplateEngine().run({ dna, registry: customRegistry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
  const engine = new DeploymentEngine();
  await engine.run({ dna, registry: customRegistry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });

  const deployScript = await fs.readFile(path.join(tempDir, 'deployment', 'deploy.sh'), 'utf8');
  assert.match(deployScript, /Minimal deploy scaffold ready/);
  await assert.rejects(fs.readFile(path.join(tempDir, 'deployment', 'status.sh'), 'utf8'));
  await assert.rejects(fs.readFile(path.join(tempDir, 'deployment', 'logs.sh'), 'utf8'));
  await assert.rejects(fs.readFile(path.join(tempDir, 'deployment', 'rollback.sh'), 'utf8'));
  await assert.rejects(fs.readFile(path.join(tempDir, 'deployment', 'destroy.sh'), 'utf8'));
  await assert.rejects(fs.readFile(path.join(tempDir, 'deployment', 'update.sh'), 'utf8'));
});

test('deployment engine omits config.yaml when configTemplate is absent', async () => {
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
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-deployment-config-absent-'));
  const tempDir = path.join(workspace, 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  await new TemplateEngine().run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
  const engine = new DeploymentEngine();
  await engine.run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
  await assert.rejects(fs.readFile(path.join(tempDir, 'deployment', 'config.yaml'), 'utf8'));
});
