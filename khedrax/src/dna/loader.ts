import { getDefaultDNA } from './defaults.ts';
import type { AgentDNA, CreateAgentOptions } from './schema.ts';
import type { RegistrySnapshot } from '../registry/types.ts';
import { findDuplicateModuleNames } from '../validation/validateDna.ts';

export async function buildAgentDNA(options: CreateAgentOptions, registry: RegistrySnapshot): Promise<AgentDNA> {
  const modules = options.modules ?? [];
  const duplicateModules = findDuplicateModuleNames(modules);
  if (duplicateModules.length > 0) {
    throw new Error(`Duplicate module(s) in modules list: ${duplicateModules.join(', ')}.`);
  }

  const base = getDefaultDNA(options.name, options.type) as unknown as AgentDNA;
  const mergedModules: string[] = [];
  const seenModules = new Set<string>();
  const persona = { ...base.persona };
  const deployment = { ...(base.deployment ?? {}) } as { target?: string };
  const interfaceConfig = { ...(base.interface ?? {}) } as { type?: string; config?: Record<string, unknown> };

  const addModule = (moduleName: string): void => {
    if (!seenModules.has(moduleName)) {
      seenModules.add(moduleName);
      mergedModules.push(moduleName);
    }
  };

  for (const moduleName of base.modules ?? []) {
    addModule(moduleName);
  }

  if (options.persona) {
    persona.presetName = options.persona;
  }

  if (options.deployment) {
    deployment.target = options.deployment;
  }

  if (options.interface) {
    interfaceConfig.type = options.interface;
  }

  for (const agentType of Object.values(registry.agentTypes)) {
    if (agentType.name === options.type) {
      for (const moduleName of agentType.defaultModules) {
        addModule(moduleName);
      }
      if (agentType.persona?.presetName && !persona.presetName) {
        persona.presetName = agentType.persona.presetName;
      }
    }
  }

  if (modules.length > 0) {
    for (const moduleName of modules) {
      addModule(moduleName);
    }
  }

  const dna: AgentDNA = {
    ...base,
    modules: mergedModules,
    persona,
    memory: base.memory ?? {},
    deployment,
    interface: interfaceConfig,
  };
  return dna;
}

export { validateAgentDNA } from '../validation/validateDna.ts';
