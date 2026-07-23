import fs from 'node:fs/promises';
import path from 'node:path';
import type { DeploymentDescriptor } from './types.ts';
import { resolveCollisions } from './collisionPolicy.ts';

export async function listDeployments(rootDir: string, pluginRoots: string[] = []): Promise<Record<string, DeploymentDescriptor>> {
  const candidateRoots = [path.resolve(rootDir), ...pluginRoots.map((pluginRoot) => path.resolve(pluginRoot))];
  const candidates: Array<{ name: string; descriptor: DeploymentDescriptor; sourceRoot: string }> = [];

  for (const candidateRoot of candidateRoots) {
    const deploymentsDir = path.join(candidateRoot, 'deployments');
    const entries = await listDirectories(deploymentsDir);

    for (const entry of entries) {
      const descriptorPath = path.join(deploymentsDir, entry, 'deployment.json');
      try {
        const content = JSON.parse(await fs.readFile(descriptorPath, 'utf8')) as Omit<DeploymentDescriptor, 'templatesPath'>;
        candidates.push({
          name: entry,
          descriptor: {
            ...content,
            name: entry,
            templatesPath: path.join(deploymentsDir, entry, 'templates'),
          },
          sourceRoot: candidateRoot,
        });
      } catch {
        console.warn(`Skipping malformed deployment: ${entry}`);
      }
    }
  }

  const resolved = resolveCollisions(candidates);
  for (const warning of resolved.warnings) {
    console.warn(`Collision for deployment target "${warning.name}": using ${warning.winningRoot} over ${warning.shadowedRoot}`);
  }
  return resolved.entries;
}

async function listDirectories(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}
