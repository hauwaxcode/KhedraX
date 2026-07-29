import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { ModuleEngine } from '../engines/moduleEngine.ts';
import { PromptEngine } from '../engines/promptEngine.ts';
import { DocumentationEngine } from '../engines/documentationEngine.ts';
import { getRegistrySnapshot } from '../registry/index.ts';
import { findDuplicateModuleNames } from '../validation/validateDna.ts';
import { detectExclusiveConflicts } from '../prompt/detectExclusiveConflicts.ts';

type AddModuleError = Error & { exitCode?: number };

export async function addModule(projectPath: string, moduleName: string, rootDir: string): Promise<void> {
  const resolvedProjectPath = path.resolve(projectPath);
  const resolvedRootDir = resolveRegistryRoot(rootDir);
  const agentYamlPath = path.join(resolvedProjectPath, 'agent.yaml');

  let existingContent: string;
  try {
    existingContent = await fs.readFile(agentYamlPath, 'utf8');
  } catch {
    throw createAddModuleError(`No agent.yaml found at ${resolvedProjectPath}.`);
  }

  const currentModules = parseModulesFromAgentYaml(existingContent);
  if (currentModules.includes(moduleName)) {
    throw createAddModuleError(`Module '${moduleName}' is already installed in ${resolvedProjectPath}.`);
  }

  const dna = parseAgentDNA(existingContent, currentModules);
  const registry = await getRegistrySnapshot(resolvedRootDir, []);
  const descriptor = registry.modules[moduleName];
  if (!descriptor) {
    throw createAddModuleError(`Unknown module '${moduleName}'.`);
  }

  const duplicateNames = findDuplicateModuleNames([...currentModules, moduleName]);
  if (duplicateNames.length > 0) {
    throw createAddModuleError(`Duplicate module(s) in modules list: ${duplicateNames.join(', ')}.`);
  }

  const nextModules = [...currentModules, moduleName];
  const existingModuleNames = currentModules.filter((name) => Boolean(registry.modules[name]));
  const exclusivityEntries = [
    ...existingModuleNames.map((name) => ({ moduleName: name, section: registry.modules[name].promptSection ?? 'instructions', exclusive: registry.modules[name].promptExclusive ?? false })),
    { moduleName, section: descriptor.promptSection ?? 'instructions', exclusive: descriptor.promptExclusive ?? false },
  ];
  const conflictMessage = detectExclusiveConflicts(exclusivityEntries);
  if (conflictMessage) {
    throw createAddModuleError(conflictMessage);
  }

  const moduleEngine = new ModuleEngine();
  await moduleEngine.renderModulesToDir([moduleName], registry, resolvedProjectPath);

  const behavioralProfile = {
    tone: 'neutral',
    traits: [],
    constraints: [],
    capabilities: nextModules.map((name) => ({ moduleName: name, description: registry.modules[name]?.capabilities?.join('; ') ?? '' })).filter((capability) => capability.description.length > 0),
    escalationPolicy: undefined,
  };

  const promptEngine = new PromptEngine();
  const promptContext = {
    dna,
    registry,
    tempDir: resolvedProjectPath,
    artifacts: {
      module: { resolvedModules: nextModules, resolvedModuleDescriptors: nextModules.map((name) => ({
        name,
        capabilities: registry.modules[name]?.capabilities ?? [],
        constraints: registry.modules[name]?.constraints ?? [],
      })) },
      persona: { behavioralProfile },
    },
  };
  await promptEngine.renderPrompts(resolvedProjectPath, promptContext.artifacts as any);

  const documentationEngine = new DocumentationEngine();
  const docsContext = {
    dna,
    registry,
    tempDir: resolvedProjectPath,
    artifacts: {
      module: { resolvedModules: nextModules, resolvedModuleDescriptors: nextModules.map((name) => ({
        name,
        capabilities: registry.modules[name]?.capabilities ?? [],
        constraints: registry.modules[name]?.constraints ?? [],
      })) },
      persona: { behavioralProfile },
    },
  };
  await documentationEngine.renderDocumentation(resolvedProjectPath, dna as any, docsContext.artifacts as any);

  const nextContent = rewriteAgentYamlModules(existingContent, nextModules);
  await fs.writeFile(agentYamlPath, nextContent);
}

function parseModulesFromAgentYaml(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const modulesIndex = lines.findIndex((line) => line.trimStart().startsWith('modules:'));
  if (modulesIndex === -1) {
    return [];
  }

  const header = lines[modulesIndex].trim();
  if (header === 'modules: []') {
    return [];
  }

  const modules: string[] = [];
  for (let index = modulesIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith('  - ')) {
      break;
    }
    modules.push(line.slice(4).trim());
  }
  return modules;
}

function parseAgentDNA(content: string, modules: string[]): { buildId: string; name: string; description?: string; agent: { type: string; version: string }; persona: Record<string, unknown>; modules: string[]; memory: Record<string, unknown>; tools: Record<string, unknown>; workflows: Record<string, unknown>; deployment: Record<string, unknown>; testing: Record<string, unknown> } {
  const nameMatch = content.match(/^name:\s*(.+)$/m);
  const descriptionMatch = content.match(/^description:\s*(.+)$/m);
  const typeMatch = content.match(/^agent:\s*\n(?:  .+\n)*  type:\s*(.+)$/m);

  return {
    buildId: 'add-module',
    name: nameMatch?.[1]?.trim() ?? 'GeneratedAgent',
    description: descriptionMatch?.[1]?.trim(),
    agent: { type: typeMatch?.[1]?.trim() ?? 'basic', version: '1.0.0' },
    persona: {},
    modules,
    memory: {},
    tools: {},
    workflows: {},
    deployment: {},
    testing: {},
  };
}

function resolveRegistryRoot(rootDir: string): string {
  const resolvedRootDir = path.resolve(rootDir);
  if (fsSync.existsSync(path.join(resolvedRootDir, 'modules'))) {
    return resolvedRootDir;
  }
  const nestedRootDir = path.join(resolvedRootDir, 'khedrax');
  if (fsSync.existsSync(path.join(nestedRootDir, 'modules'))) {
    return nestedRootDir;
  }
  return resolvedRootDir;
}

function rewriteAgentYamlModules(content: string, modules: string[]): string {
  const lines = content.split(/\r?\n/);
  const modulesIndex = lines.findIndex((line) => line.trimStart().startsWith('modules:'));
  if (modulesIndex === -1) {
    return content;
  }

  const replacementLines = modules.length > 0
    ? ['modules:']
    : ['modules: []'];
  for (const moduleName of modules) {
    replacementLines.push(`  - ${moduleName}`);
  }

  const startIndex = modulesIndex;
  let endIndex = modulesIndex + 1;
  if (modules.length > 0) {
    while (endIndex < lines.length && lines[endIndex].startsWith('  - ')) {
      endIndex += 1;
    }
  } else {
    endIndex = modulesIndex + 1;
  }

  const before = lines.slice(0, startIndex);
  const after = lines.slice(endIndex);
  return [...before, ...replacementLines, ...after].join('\n') + (content.endsWith('\n') ? '\n' : '');
}

function createAddModuleError(message: string): AddModuleError {
  const error = new Error(message) as AddModuleError;
  error.exitCode = 1;
  return error;
}
