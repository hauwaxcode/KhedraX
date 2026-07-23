import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRegistrySnapshot } from '../../src/registry/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const khedraxRoot = path.resolve(repoRoot, 'khedrax');

test('deployment registry discovers built-in targets and skips malformed entries', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  assert.ok(registry.deployments['pharos']);
  assert.ok(registry.deployments['local']);
  assert.ok(!registry.deployments['bad-entry']);
});

test('deployment registry skips malformed deployment descriptors', async () => {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-deployment-registry-'));
  await fs.mkdir(path.join(fixtureRoot, 'deployments', 'local'), { recursive: true });
  await fs.writeFile(path.join(fixtureRoot, 'deployments', 'local', 'deployment.json'), JSON.stringify({
    name: 'local',
    version: '1.0.0',
    runtime: 'node18',
    network: { chainId: null, rpcUrlEnvVar: null },
    walletIntegration: { type: 'none' },
    secretsRequired: [],
    monitoring: { healthCheckPath: '/health', logDestination: 'stdout' },
    rollback: { strategy: 'restart-process' },
  }, null, 2));
  await fs.mkdir(path.join(fixtureRoot, 'deployments', 'bad-entry'), { recursive: true });
  await fs.writeFile(path.join(fixtureRoot, 'deployments', 'bad-entry', 'deployment.json'), '{bad json');

  const registry = await getRegistrySnapshot(fixtureRoot);
  assert.ok(registry.deployments['local']);
  assert.ok(!registry.deployments['bad-entry']);
});
