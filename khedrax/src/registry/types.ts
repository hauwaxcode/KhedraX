export interface AgentTypeDescriptor {
  name: string;
  version: string;
  defaultModules: string[];
  description?: string;
  persona?: {
    presetName?: string;
    traits?: string[];
    tone?: string;
    constraints?: string[];
  };
}

export interface ModuleDescriptor {
  name: string;
  version: string;
  path: string;
  requiresMemory?: boolean;
  capabilities?: string[];
  constraints?: string[];
  promptSection?: string;
  promptExclusive?: boolean;
}

export interface PersonaDescriptor {
  name: string;
  version: string;
  tone: string;
  traits: string[];
  constraints: string[];
  escalationPolicy?: string;
}

export interface MemoryBackendDescriptor {
  name: string;
  version: string;
  description: string;
  configDefaults: Record<string, unknown>;
}

export interface DeploymentDescriptor {
  name: string;
  version: string;
  runtime: string;
  network: { chainId: string | null; rpcUrlEnvVar: string | null };
  walletIntegration: { type: string; secretEnvVar?: string };
  secretsRequired: string[];
  monitoring: { healthCheckPath: string; logDestination: string };
  rollback: { strategy: string };
  templatesPath: string;
}

export interface RegistrySnapshot {
  agentTypes: Record<string, AgentTypeDescriptor>;
  modules: Record<string, ModuleDescriptor>;
  personas: Record<string, PersonaDescriptor>;
  memoryBackends: Record<string, MemoryBackendDescriptor>;
  deployments: Record<string, DeploymentDescriptor>;
}
