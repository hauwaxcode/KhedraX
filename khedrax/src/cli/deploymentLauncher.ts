import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const ACTION_TO_SCRIPT: Record<string, string> = {
  deploy: 'deploy.sh',
  status: 'status.sh',
  logs: 'logs.sh',
  rollback: 'rollback.sh',
  destroy: 'destroy.sh',
  update: 'update.sh',
};

export async function runDeploymentScript(action: string, projectPath: string): Promise<number> {
  const scriptName = ACTION_TO_SCRIPT[action];
  if (!scriptName) {
    console.error(`Unknown deployment action: ${action}`);
    return 1;
  }

  const scriptPath = path.join(projectPath, 'deployment', scriptName);
  try {
    await fs.access(scriptPath);
  } catch {
    console.error(
      `No deployment/${action}.sh found in ${projectPath}. ` +
      `This project may not have been generated with a --deployment target, ` +
      `or its target does not provide a script for '${action}'.`
    );
    return 1;
  }

  return new Promise((resolve) => {
    const child = spawn('bash', [scriptPath], {
      cwd: projectPath,
      stdio: 'inherit',
    });

    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', (err) => {
      console.error(`Failed to run ${scriptPath}: ${err.message}`);
      resolve(1);
    });
  });
}
