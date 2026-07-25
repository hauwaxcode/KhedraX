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
  network: {
    chainId: string | null;
    rpcUrlEnvVar: string | null;
    exampleRpcEndpoint?: string | null;
  };
  walletIntegration: {
    type: string;
    secretEnvVar?: string;
    supportedTypes?: string[];
  };
  secretsRequired: string[];
  secretsDescriptions?: Record<string, string>;
  environmentTemplate?: Record<string, string | number | boolean | null>;
  monitoring: { healthCheckPath: string; logDestination: string };
  rollback: { strategy: string };
  verificationStrategy?: string;
  configTemplate?: Record<string, unknown>;
  templatesPath: string;
}

export interface InterfaceDescriptor {
  name: string;
  version: string;
  description: string;
  pairsWithModule?: string | null;
  templatesPath: string;
}

export interface RegistrySnapshot {
  agentTypes: Record<string, AgentTypeDescriptor>;
  modules: Record<string, ModuleDescriptor>;
  personas: Record<string, PersonaDescriptor>;
  memoryBackends: Record<string, MemoryBackendDescriptor>;
  deployments: Record<string, DeploymentDescriptor>;
  interfaces?: Record<string, InterfaceDescriptor>;
}
