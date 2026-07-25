export const DEFAULT_AGENT_VERSION = '1.0.0';

export function getDefaultDNA(name: string, agentType: string): Record<string, unknown> {
  return {
    buildId: `build-${Date.now()}`,
    name,
    description: `Generated agent ${name}`,
    agent: {
      type: agentType,
      version: DEFAULT_AGENT_VERSION,
    },
    persona: {},
    modules: [],
    memory: {},
    tools: {},
    workflows: {},
    deployment: {},
    interface: {},
    testing: {},
  };
}
