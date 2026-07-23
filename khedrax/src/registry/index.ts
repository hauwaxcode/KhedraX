import path from 'node:path';
import type { RegistrySnapshot } from './types.ts';
import { listAgentTypes } from './agentTypeRegistry.ts';
import { listModules } from './moduleRegistry.ts';
import { listPersonas } from './personaRegistry.ts';
import { listMemoryBackends } from './memoryBackendRegistry.ts';
import { listDeployments } from './deploymentRegistry.ts';

export async function getRegistrySnapshot(rootDir: string, pluginRoots: string[] = []): Promise<RegistrySnapshot> {
  const normalizedPluginRoots = pluginRoots.map((pluginRoot) => path.resolve(pluginRoot));
  const [agentTypes, modules, personas, memoryBackends, deployments] = await Promise.all([
    listAgentTypes(rootDir, normalizedPluginRoots),
    listModules(rootDir, normalizedPluginRoots),
    listPersonas(rootDir, normalizedPluginRoots),
    listMemoryBackends(rootDir, normalizedPluginRoots),
    listDeployments(rootDir, normalizedPluginRoots),
  ]);
  return { agentTypes, modules, personas, memoryBackends, deployments };
}
