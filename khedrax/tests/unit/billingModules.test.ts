import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAgent } from '../../src/cli/commands/create.ts';

const billingModules = [
  'billing-free',
  'billing-subscription',
  'billing-usage',
  'billing-credit',
  'billing-token',
  'billing-nft',
  'billing-enterprise',
  'billing-hybrid',
];

test('billing modules generate with their prompt, docs, and implementation scaffolds', async () => {
  for (const moduleName of billingModules) {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), `khedrax-billing-${moduleName}-`));
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

    const agentYaml = await fs.readFile(path.join(outputDir, 'agent.yaml'), 'utf8');
    assert.match(agentYaml, new RegExp(`modules: \\n  - ${moduleName}`));

    const docsReadme = await fs.readFile(path.join(outputDir, 'docs', 'README.md'), 'utf8');
    assert.match(docsReadme, /## Modules/);

    const promptsReadme = await fs.readFile(path.join(outputDir, 'prompts', 'README.md'), 'utf8');
    assert.match(promptsReadme, new RegExp(`#### ${moduleName}`));

    const implementationDir = path.join(outputDir, 'implementation');
    const implementationEntries = await fs.readdir(implementationDir);
    assert.ok(implementationEntries.includes(moduleName));

    const moduleImplementationDir = path.join(implementationDir, moduleName);
    const moduleImplementationEntries = await fs.readdir(moduleImplementationDir);
    assert.ok(moduleImplementationEntries.includes('README.md'));

    if (['billing-subscription', 'billing-usage', 'billing-credit', 'billing-enterprise', 'billing-hybrid'].includes(moduleName)) {
      assert.ok(moduleImplementationEntries.some((entry) => entry.includes('template')));
    }
  }
});

test('billing modules compose with memory without collisions and in alphabetical order', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-billing-composition-'));
  const outputDir = path.join(workspace, 'out');

  const result = await createAgent({
    name: 'BillingCompositionBot',
    type: 'basic',
    outputDir,
    modules: ['billing-usage', 'billing-hybrid', 'memory'],
    force: true,
    verbose: false,
  });

  assert.equal(result.outputPath, outputDir);

  const docsReadme = await fs.readFile(path.join(outputDir, 'docs', 'README.md'), 'utf8');
  assert.match(docsReadme, /## Modules/);
  assert.match(docsReadme, /billing-hybrid/);
  assert.match(docsReadme, /billing-usage/);
  assert.match(docsReadme, /memory/);

  const promptsReadme = await fs.readFile(path.join(outputDir, 'prompts', 'README.md'), 'utf8');
  assert.match(promptsReadme, /#### billing-hybrid/);
  assert.match(promptsReadme, /#### billing-usage/);
  assert.match(promptsReadme, /#### memory/);
});
