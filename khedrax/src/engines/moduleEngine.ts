import fs from 'node:fs/promises';
import path from 'node:path';
import type { GenerationContext, ProducerEngine, ProducerResult } from '../generation/types.ts';

export class ModuleEngine implements ProducerEngine {
  name = 'module';

  async run(context: GenerationContext): Promise<ProducerResult> {
    const resolvedModules = context.dna.modules.filter((moduleName) => context.registry.modules[moduleName]);
    const targetDir = context.tempDir;
    return this.renderModulesToDir(resolvedModules, context.registry, targetDir);
  }

  async renderModulesToDir(resolvedModules: string[], registry: GenerationContext['registry'], targetDir: string): Promise<ProducerResult> {

    for (const moduleName of resolvedModules) {
      const moduleDescriptor = registry.modules[moduleName];
      if (!moduleDescriptor) {
        continue;
      }
      const sourceDir = moduleDescriptor.path;
      const entries = ['implementation', 'configuration', 'prompts', 'tests'];
      for (const entry of entries) {
        const sourceEntry = path.join(sourceDir, entry);
        const targetEntry = path.join(targetDir, entry, moduleName);
        try {
          const stats = await fs.stat(sourceEntry);
          if (stats.isDirectory()) {
            await copyDirectory(sourceEntry, targetEntry);
          }
        } catch {
          // ignore missing entry
        }
      }
    }

    return { artifacts: { resolvedModules, resolvedModuleDescriptors: resolvedModules.map((moduleName) => registry.modules[moduleName]).filter(Boolean) } };
  }
}

async function copyDirectory(source: string, target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
