import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { TemplateEngine } from '../engines/templateEngine.ts';
import { ModuleEngine } from '../engines/moduleEngine.ts';
import { PersonaEngine } from '../engines/personaEngine.ts';
import { PromptEngine } from '../engines/promptEngine.ts';
import { MemoryEngine } from '../engines/memoryEngine.ts';
import { DocumentationEngine } from '../engines/documentationEngine.ts';
import { DeploymentEngine } from '../engines/deploymentEngine.ts';
import { PackagingEngine } from '../engines/packagingEngine.ts';
import type { GenerationContext, ProducerEngine, ProducerResult } from './types.ts';

export class GenerationEngine {
  private readonly producers: ProducerEngine[];

  constructor() {
    this.producers = [
      new TemplateEngine(),
      new ModuleEngine(),
      new PersonaEngine(),
      new PromptEngine(),
      new MemoryEngine(),
      new DocumentationEngine(),
    ];
  }

  getProducerOrder(): string[] {
    return this.producers.map((producer) => producer.name);
  }

  async run(context: GenerationContext): Promise<{ outputPath: string; tempDir: string }> {
    const tempDir = context.tempDir || await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-gen-'));
    const fallbackOutputPath = path.join(path.dirname(tempDir), context.dna.name);
    const resolvedOutputPath = context.outputDir || fallbackOutputPath;
    const effectiveForce = context.force ?? false;
    await fs.mkdir(tempDir, { recursive: true });
    const artifacts: Record<string, unknown> = {};

    for (const producer of this.producers) {
      const result: ProducerResult = await producer.run({ ...context, tempDir, artifacts });
      if (result.artifacts) {
        artifacts[producer.name] = result.artifacts;
      }
    }

    const deploymentEngine = new DeploymentEngine();
    const deploymentResult = await deploymentEngine.run({ ...context, tempDir, artifacts });
    if (deploymentResult.artifacts) {
      artifacts[deploymentEngine.name] = deploymentResult.artifacts;
    }

    if (!context.khedraxRootDir) {
      throw new Error('Generation context must include khedraxRootDir');
    }
    const packagingEngine = new PackagingEngine();
    const packageResult = await packagingEngine.run({
      tempDir,
      outputDir: resolvedOutputPath,
      name: context.dna.name,
      force: effectiveForce,
      dna: context.dna,
      resolvedModuleDescriptors: (artifacts.module as { resolvedModuleDescriptors?: Array<{ name: string; version?: string }> } | undefined)?.resolvedModuleDescriptors ?? [],
      khedraxRootDir: context.khedraxRootDir,
    });
    return { outputPath: packageResult.outputPath, tempDir };
  }
}
