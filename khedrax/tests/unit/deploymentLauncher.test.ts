import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runDeploymentScript } from '../../src/cli/deploymentLauncher.ts';
import { getRegistrySnapshot } from '../../src/registry/index.ts';
import { buildAgentDNA } from '../../src/dna/loader.ts';
import { DeploymentEngine } from '../../src/engines/deploymentEngine.ts';
import { TemplateEngine } from '../../src/engines/templateEngine.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const khedraxRoot = path.resolve(__dirname, '..', '..', '..', 'khedrax');

async function runScriptWithEnv(projectPath: string, action: string, env: Record<string, string>): Promise<{ code: number; stderr: string }> {
  const scriptPath = path.join(projectPath, 'deployment', `${action}.sh`);
  const result = await new Promise<{ code: number; stderr: string }>((resolve) => {
    const child = spawn('bash', [scriptPath], {
      cwd: projectPath,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('exit', (code: number | null) => resolve({ code: code ?? 1, stderr }));
    child.on('error', () => resolve({ code: 1, stderr: 'spawn error' }));
  });
  return result;
}

test('runDeploymentScript resolves 0 when the script exits successfully', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-launcher-success-'));
  const projectPath = path.join(workspace, 'project');
  await fs.mkdir(path.join(projectPath, 'deployment'), { recursive: true });
  await fs.writeFile(path.join(projectPath, 'deployment', 'deploy.sh'), '#!/usr/bin/env bash\nexit 0\n');
  const exitCode = await runDeploymentScript('deploy', projectPath);
  assert.equal(exitCode, 0);
});

test('runDeploymentScript resolves 1 when the script exits unsuccessfully', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-launcher-failure-'));
  const projectPath = path.join(workspace, 'project');
  await fs.mkdir(path.join(projectPath, 'deployment'), { recursive: true });
  await fs.writeFile(path.join(projectPath, 'deployment', 'deploy.sh'), '#!/usr/bin/env bash\nexit 1\n');
  const exitCode = await runDeploymentScript('deploy', projectPath);
  assert.equal(exitCode, 1);
});

test('runDeploymentScript returns 1 and a clear error when the script does not exist', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-launcher-missing-'));
  const projectPath = path.join(workspace, 'project');
  await fs.mkdir(projectPath, { recursive: true });

  let errorOutput = '';
  const originalError = console.error;
  console.error = (message: unknown) => {
    errorOutput += String(message);
  };

  const exitCode = await runDeploymentScript('status', projectPath);
  console.error = originalError;

  assert.equal(exitCode, 1);
  assert.match(errorOutput, /No deployment\/status\.sh found in .*project/);
});

test('runDeploymentScript uses the provided project path as cwd', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-launcher-cwd-'));
  const projectPath = path.join(workspace, 'project');
  await fs.mkdir(path.join(projectPath, 'deployment'), { recursive: true });
  await fs.writeFile(path.join(projectPath, 'deployment', 'deploy.sh'), '#!/usr/bin/env bash\npwd > pwd.txt\n');
  const exitCode = await runDeploymentScript('deploy', projectPath);
  assert.equal(exitCode, 0);
  const cwdOutput = await fs.readFile(path.join(projectPath, 'pwd.txt'), 'utf8');
  assert.equal(cwdOutput.trim(), projectPath);
});

test('generated destroy.sh exits 1 with a clean missing env var message when required secrets are unset', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  const dna = await buildAgentDNA({
    name: 'PharosDestroyBot',
    type: 'basic',
    outputDir: '/tmp/out',
    modules: [],
    force: false,
    verbose: false,
  }, registry);
  dna.deployment = { target: 'pharos' };
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-launcher-destroy-'));
  const tempDir = path.join(workspace, 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  await new TemplateEngine().run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });
  const engine = new DeploymentEngine();
  await engine.run({ dna, registry, tempDir, artifacts: {}, khedraxRootDir: khedraxRoot });

  const projectPath = tempDir;
  const result = await runScriptWithEnv(projectPath, 'destroy', {});
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Missing required environment variables: PHAROS_RPC_URL PHAROS_DEPLOYER_PRIVATE_KEY/);
});
