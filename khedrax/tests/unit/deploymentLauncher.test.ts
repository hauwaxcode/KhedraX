import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runDeploymentScript } from '../../src/cli/deploymentLauncher.ts';

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
