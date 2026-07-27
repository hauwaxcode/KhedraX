import fs from 'node:fs/promises';
import path from 'node:path';
import type { GenerationContext, ProducerEngine, ProducerResult } from '../generation/types.ts';
import type { InterfaceDescriptor } from '../registry/types.ts';

export class InterfaceEngine implements ProducerEngine {
  name = 'interface';

  async run(context: GenerationContext): Promise<ProducerResult> {
    const type = context.dna.interface?.type;
    if (!type) {
      return { artifacts: { skipped: true } };
    }

    const descriptor = context.registry.interfaces?.[type];
    if (!descriptor) {
      return { artifacts: { skipped: true } };
    }
    const interfaceDir = path.join(context.tempDir, 'interface');
    await fs.mkdir(interfaceDir, { recursive: true });

    await fs.cp(descriptor.templatesPath, interfaceDir, { recursive: true });
    await this.renderInterfaceFiles(interfaceDir, descriptor, context.dna);
    return { artifacts: { type, rendered: true } };
  }

  private async renderInterfaceFiles(interfaceDir: string, descriptor: InterfaceDescriptor, dna: GenerationContext['dna']): Promise<void> {
    const adminIndexPath = path.join(interfaceDir, 'index.html');
    if (await this.fileExists(adminIndexPath)) {
      const template = await fs.readFile(adminIndexPath, 'utf8');
      const personaLabel = dna.persona.presetName ?? 'none';
      const modulesLabel = dna.modules.length > 0 ? dna.modules.join(', ') : 'none';
      const billingModules = dna.modules.filter((module) => module.startsWith('billing-'));
      const authModules = dna.modules.filter((module) => module.startsWith('auth-'));
      const featureSections = [
        this.renderModuleSection('Billing', billingModules),
        this.renderModuleSection('Authentication', authModules),
      ].filter(Boolean).join('');
      const rendered = template
        .replace(/\{\{name\}\}/g, dna.name)
        .replace(/\{\{type\}\}/g, dna.agent.type)
        .replace(/\{\{persona\}\}/g, personaLabel)
        .replace(/\{\{modules\}\}/g, modulesLabel)
        .replace(/<\/main>/, `${featureSections}</main>`);
      await fs.writeFile(adminIndexPath, rendered);
    }
  }

  private renderModuleSection(title: string, modules: string[]): string {
    if (modules.length === 0) {
      return '';
    }

    const items = modules.map((module) => `<li>${module}</li>`).join('');
    return `<section><h2>${title}</h2><ul>${items}</ul></section>`;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
