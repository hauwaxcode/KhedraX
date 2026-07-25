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

test('interface registry discovers built-in interfaces and skips malformed entries', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  const interfaces = registry.interfaces ?? {};
  assert.ok(interfaces['web']);
  assert.ok(interfaces['discord']);
  assert.ok(interfaces['telegram']);
  assert.ok(interfaces['admin']);
  assert.ok(!interfaces['bad-entry']);
});

test('interface registry skips malformed interface descriptors', async () => {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-interface-registry-'));
  await fs.mkdir(path.join(fixtureRoot, 'interfaces', 'web'), { recursive: true });
  await fs.writeFile(path.join(fixtureRoot, 'interfaces', 'web', 'interface.json'), JSON.stringify({
    name: 'web',
    version: '1.0.0',
    description: 'Web interface',
    pairsWithModule: null,
  }, null, 2));
  await fs.mkdir(path.join(fixtureRoot, 'interfaces', 'bad-entry'), { recursive: true });
  await fs.writeFile(path.join(fixtureRoot, 'interfaces', 'bad-entry', 'interface.json'), '{bad json');

  const registry = await getRegistrySnapshot(fixtureRoot);
  const interfaces = registry.interfaces ?? {};
  assert.ok(interfaces['web']);
  assert.ok(!interfaces['bad-entry']);
});
