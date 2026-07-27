import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAgentDNA } from '../../src/dna/loader.ts';
import { getRegistrySnapshot } from '../../src/registry/index.ts';
import { InterfaceEngine } from '../../src/engines/interfaceEngine.ts';
import { TemplateEngine } from '../../src/engines/templateEngine.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const khedraxRoot = path.resolve(repoRoot, 'khedrax');

test('interface engine scaffolds discord interface content and skips when unset', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  const dna = await buildAgentDNA({
    name: 'DiscordBot',
    type: 'basic',
    outputDir: '/tmp/out',
    modules: ['discord'],
    force: false,
    verbose: false,
    interface: 'discord',
  }, registry);

  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-interface-discord-'));
  const tempDir = path.join(workspace, 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  await new TemplateEngine().run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });

  const engine = new InterfaceEngine();
  await engine.run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
  const botScript = await fs.readFile(path.join(tempDir, 'interface', 'bot.js'), 'utf8');
  assert.match(botScript, /discord\.js/);
  assert.match(botScript, /client\.login/);

  const noInterfaceDna = await buildAgentDNA({
    name: 'PlainBot',
    type: 'basic',
    outputDir: '/tmp/out',
    modules: [],
    force: false,
    verbose: false,
  }, registry);
  const noInterfaceWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-interface-noop-'));
  const noInterfaceTempDir = path.join(noInterfaceWorkspace, 'temp');
  await fs.mkdir(noInterfaceTempDir, { recursive: true });
  await new TemplateEngine().run({ dna: noInterfaceDna, registry, tempDir: noInterfaceTempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
  const noInterfaceEngine = new InterfaceEngine();
  const result = await noInterfaceEngine.run({ dna: noInterfaceDna, registry, tempDir: noInterfaceTempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
  assert.deepEqual(result.artifacts, { skipped: true });
  await assert.rejects(fs.readFile(path.join(noInterfaceTempDir, 'interface', 'index.html'), 'utf8'));
});

test('validation warns when an interface pairs with a missing module and generation still succeeds', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  const dna = await buildAgentDNA({
    name: 'WarnBot',
    type: 'basic',
    outputDir: '/tmp/out',
    modules: [],
    force: false,
    verbose: false,
    interface: 'discord',
  }, registry);
  const validation = await import('../../src/validation/validateDna.ts').then((mod) => mod.validateAgentDNA(dna, registry));
  assert.ok(validation.warnings.some((warning) => warning.includes("Interface 'discord' pairs with module 'discord'")));
  assert.equal(validation.valid, true);
});

test('interface engine renders none for absent persona and modules', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  const dna = await buildAgentDNA({
    name: 'MinimalAdmin',
    type: 'basic',
    outputDir: '/tmp/out',
    modules: [],
    force: false,
    verbose: false,
    interface: 'admin',
  }, registry);
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-interface-minimal-admin-'));
  const tempDir = path.join(workspace, 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  await new TemplateEngine().run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });

  const engine = new InterfaceEngine();
  await engine.run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
  const dashboardHtml = await fs.readFile(path.join(tempDir, 'interface', 'index.html'), 'utf8');
  assert.match(dashboardHtml, /Persona: none/);
  assert.match(dashboardHtml, /Modules: none/);
});

test('interface engine renders billing and authentication sections only when relevant modules are present', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);

  const renderDashboard = async (modules: string[]) => {
    const dna = await buildAgentDNA({
      name: 'ScenarioBot',
      type: 'basic',
      outputDir: '/tmp/out',
      modules,
      force: false,
      verbose: false,
    }, registry);
    dna.interface = { type: 'admin' };

    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-interface-scenario-'));
    const tempDir = path.join(workspace, 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    await new TemplateEngine().run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });

    const engine = new InterfaceEngine();
    await engine.run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
    return fs.readFile(path.join(tempDir, 'interface', 'index.html'), 'utf8');
  };

  const billingHtml = await renderDashboard(['billing-subscription', 'memory']);
  assert.match(billingHtml, /<h2>Billing<\/h2>/);
  assert.match(billingHtml, /billing-subscription/);
  assert.doesNotMatch(billingHtml, /<h2>Authentication<\/h2>/);

  const authHtml = await renderDashboard(['auth-google', 'auth-siwe']);
  assert.match(authHtml, /<h2>Authentication<\/h2>/);
  assert.match(authHtml, /auth-google/);
  assert.match(authHtml, /auth-siwe/);
  assert.doesNotMatch(authHtml, /<h2>Billing<\/h2>/);

  const bothHtml = await renderDashboard(['billing-subscription', 'auth-google', 'auth-siwe']);
  assert.match(bothHtml, /<h2>Billing<\/h2>/);
  assert.match(bothHtml, /<h2>Authentication<\/h2>/);

  const neitherHtml = await renderDashboard([]);
  assert.doesNotMatch(neitherHtml, /<h2>Billing<\/h2>/);
  assert.doesNotMatch(neitherHtml, /<h2>Authentication<\/h2>/);
});

test('interface engine renders admin dashboard content from actual dna values', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  const dna = await buildAgentDNA({
    name: 'AdminBot',
    type: 'basic',
    outputDir: '/tmp/out',
    modules: ['github', 'memory'],
    force: false,
    verbose: false,
    persona: 'friendly-assistant',
  }, registry);
  dna.interface = { type: 'admin' };
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-interface-admin-'));
  const tempDir = path.join(workspace, 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  await new TemplateEngine().run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });

  const engine = new InterfaceEngine();
  await engine.run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
  const dashboardHtml = await fs.readFile(path.join(tempDir, 'interface', 'index.html'), 'utf8');
  assert.match(dashboardHtml, /AdminBot/);
  assert.match(dashboardHtml, /basic/);
  assert.match(dashboardHtml, /friendly-assistant/);
  assert.match(dashboardHtml, /github, memory/);
});
