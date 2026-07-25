import fs from 'node:fs/promises';
import path from 'node:path';
import type { InterfaceDescriptor } from './types.ts';
import { resolveCollisions } from './collisionPolicy.ts';

export async function listInterfaces(rootDir: string, pluginRoots: string[] = []): Promise<Record<string, InterfaceDescriptor>> {
  const candidateRoots = [path.resolve(rootDir), ...pluginRoots.map((pluginRoot) => path.resolve(pluginRoot))];
  const candidates: Array<{ name: string; descriptor: InterfaceDescriptor; sourceRoot: string }> = [];

  for (const candidateRoot of candidateRoots) {
    const interfacesDir = path.join(candidateRoot, 'interfaces');
    const entries = await listDirectories(interfacesDir);

    for (const entry of entries) {
      const descriptorPath = path.join(interfacesDir, entry, 'interface.json');
      try {
        const content = JSON.parse(await fs.readFile(descriptorPath, 'utf8')) as Omit<InterfaceDescriptor, 'templatesPath'>;
        candidates.push({
          name: entry,
          descriptor: {
            ...content,
            name: entry,
            templatesPath: path.join(interfacesDir, entry, 'templates'),
          },
          sourceRoot: candidateRoot,
        });
      } catch {
        console.warn(`Skipping malformed interface: ${entry}`);
      }
    }
  }

  const resolved = resolveCollisions(candidates);
  for (const warning of resolved.warnings) {
    console.warn(`Collision for interface type "${warning.name}": using ${warning.winningRoot} over ${warning.shadowedRoot}`);
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
