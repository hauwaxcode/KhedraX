export interface AgentDNA {
  buildId: string;
  name: string;
  description?: string;
  agent: {
    type: string;
    version: string;
  };
  persona: {
    presetName?: string;
    traits?: string[];
    tone?: string;
    constraints?: string[];
  };
  modules: string[];
  memory: {
    backend?: string;
    config?: Record<string, unknown>;
  };
  tools: Record<string, unknown>;
  workflows: Record<string, unknown>;
  deployment: {
    target?: string;
  };
  testing: Record<string, unknown>;
}

export interface CreateAgentOptions {
  name: string;
  type: string;
  outputDir: string;
  modules: string[];
  force: boolean;
  verbose: boolean;
  resume?: string;
  persona?: string;
  deployment?: string;
}
