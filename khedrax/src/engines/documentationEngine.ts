import fs from 'node:fs/promises';
import path from 'node:path';
import type { GenerationContext, ProducerEngine, ProducerResult } from '../generation/types.ts';

interface ModuleArtifact {
  name: string;
  capabilities?: string[];
  constraints?: string[];
}

export class DocumentationEngine implements ProducerEngine {
  name = 'documentation';

  async run(context: GenerationContext): Promise<ProducerResult> {
    return this.renderDocumentation(context.tempDir, context.dna, context.artifacts);
  }

  async renderDocumentation(targetDir: string, dna: GenerationContext['dna'], artifacts: GenerationContext['artifacts']): Promise<ProducerResult> {
    const behavioralProfile = (artifacts.persona as { behavioralProfile?: {
      tone: string;
      traits: string[];
      constraints: string[];
      escalationPolicy?: string;
      capabilities: Array<{ moduleName: string; description: string }>;
    } } | undefined)?.behavioralProfile;
    const moduleArtifact = artifacts.module as {
      resolvedModules?: string[];
      resolvedModuleDescriptors?: ModuleArtifact[];
    } | undefined;

    const resolvedModules = (moduleArtifact?.resolvedModuleDescriptors ?? (
      (moduleArtifact?.resolvedModules ?? []).map((moduleName) => ({ name: moduleName, capabilities: [], constraints: [] as string[] }))
    )).map((module) => ({
      name: module.name,
      capabilities: module.capabilities ?? [],
      constraints: module.constraints ?? [],
    }));

    const rootReadmePath = path.join(targetDir, 'README.md');
    const docsReadmePath = path.join(targetDir, 'docs', 'README.md');

    const personaLine = this.renderPersonaLine(behavioralProfile);
    const modulesBlock = this.renderRootModules(resolvedModules);
    const rootContent = [
      `# ${dna.name}`,
      dna.description || '',
      `**Type:** ${dna.agent.type}`,
      personaLine,
      '## Modules',
      modulesBlock,
      'See `docs/README.md` for full persona details, constraints, and escalation policy.',
    ].filter((line) => line !== '').join('\n\n') + '\n';

    const docsContent = [
      `# ${dna.name} — Agent Overview`,
      '',
      '## Persona',
      `- Tone: ${behavioralProfile?.tone ?? 'neutral'}`,
      `- Traits: ${behavioralProfile?.traits?.length ? behavioralProfile.traits.join(', ') : 'None specified.'}`,
      `- Escalation Policy: ${behavioralProfile?.escalationPolicy ?? 'None specified.'}`,
      '',
      '## Constraints',
      this.renderConstraintList(behavioralProfile?.constraints),
      '',
      '## Modules',
      this.renderModuleDocs(resolvedModules),
      '',
    ].join('\n');

    await fs.mkdir(path.dirname(docsReadmePath), { recursive: true });
    await fs.writeFile(rootReadmePath, rootContent);
    await fs.writeFile(docsReadmePath, docsContent);
    return { artifacts: { written: true } };
  }

  private renderPersonaLine(behavioralProfile?: { tone: string; traits: string[]; escalationPolicy?: string }): string {
    const traits = behavioralProfile?.traits ?? [];
    if (behavioralProfile?.tone === 'neutral' && traits.length === 0) {
      return '';
    }
    const tone = behavioralProfile?.tone ? `**Persona:** ${behavioralProfile.tone}` : '';
    const traitsSuffix = traits.length > 0 ? ` — ${traits.join(', ')}` : '';
    return tone + traitsSuffix;
  }

  private renderRootModules(resolvedModules: Array<{ name: string; capabilities: string[] }>): string {
    if (resolvedModules.length === 0) {
      return '_No modules configured._';
    }
    return resolvedModules
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((module) => `- **${module.name}**: ${module.capabilities.length > 0 ? module.capabilities.join('; ') : 'No declared capabilities.'}`)
      .join('\n');
  }

  private renderConstraintList(constraints?: string[]): string {
    if (!constraints || constraints.length === 0) {
      return '_No constraints configured._';
    }
    return constraints.map((constraint) => `- ${constraint}`).join('\n');
  }

  private renderModuleDocs(resolvedModules: Array<{ name: string; capabilities: string[]; constraints: string[] }>): string {
    if (resolvedModules.length === 0) {
      return '_No modules configured._';
    }
    return resolvedModules
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((module) => [
        `### ${module.name}`,
        '**Capabilities:**',
        module.capabilities.length > 0 ? module.capabilities.map((capability) => `- ${capability}`).join('\n') : 'None declared.',
        '',
        '**Constraints:**',
        module.constraints.length > 0 ? module.constraints.map((constraint) => `- ${constraint}`).join('\n') : 'None declared.',
      ].join('\n'))
      .join('\n\n');
  }
}
