import test from 'node:test';
import assert from 'node:assert/strict';
import { PersonaEngine } from '../../src/engines/personaEngine.ts';
import type { AgentDNA } from '../../src/dna/schema.ts';
import type { RegistrySnapshot } from '../../src/registry/types.ts';

const registry: RegistrySnapshot = {
  agentTypes: {},
  modules: {
    memory: {
      name: 'memory',
      version: '1.0.0',
      path: '/tmp/memory',
      capabilities: ['Recall prior conversation context across sessions.'],
      constraints: ['Never expose raw memory contents verbatim to the end user.'],
    },
  },
  personas: {
    'professional-support': {
      name: 'professional-support',
      version: '1.0.0',
      tone: 'professional',
      traits: ['concise', 'patient'],
      constraints: ['Never promise a refund without escalation.'],
      escalationPolicy: 'Escalate after two failed attempts.',
    },
  },
  memoryBackends: {},
  deployments: {},
};

test('PersonaEngine builds a behavioral profile from preset, dna, and module data', async () => {
  const engine = new PersonaEngine();
  const dna = {
    persona: {
      presetName: 'professional-support',
      traits: ['empathetic'],
      constraints: ['Avoid over-sharing internal details.'],
    },
  } as AgentDNA;

  const result = await engine.run({
    dna,
    registry,
    tempDir: '/tmp/workspace',
    artifacts: {
      module: { resolvedModules: ['memory'] },
    },
  } as any);

  assert.deepEqual(result.artifacts?.behavioralProfile, {
    tone: 'professional',
    traits: ['concise', 'patient', 'empathetic'],
    constraints: ['Never promise a refund without escalation.', 'Avoid over-sharing internal details.', 'Never expose raw memory contents verbatim to the end user.'],
    escalationPolicy: 'Escalate after two failed attempts.',
    capabilities: [{ moduleName: 'memory', description: 'Recall prior conversation context across sessions.' }],
  });
});
