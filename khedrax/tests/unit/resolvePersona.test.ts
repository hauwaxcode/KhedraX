import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePersona } from '../../src/persona/resolvePersona.ts';
import type { AgentDNA } from '../../src/dna/schema.ts';
import type { RegistrySnapshot } from '../../src/registry/types.ts';

const registry: RegistrySnapshot = {
  agentTypes: {},
  modules: {},
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

test('resolvePersona merges preset and dna overrides', () => {
  const dna = {
    persona: {
      presetName: 'professional-support',
      tone: 'friendly',
      traits: ['empathetic'],
      constraints: ['Avoid over-sharing internal details.'],
    },
  } as AgentDNA;

  const result = resolvePersona(dna, registry);
  assert.equal(result.tone, 'friendly');
  assert.deepEqual(result.traits, ['concise', 'patient', 'empathetic']);
  assert.deepEqual(result.constraints, ['Never promise a refund without escalation.', 'Avoid over-sharing internal details.']);
  assert.equal(result.escalationPolicy, 'Escalate after two failed attempts.');
});

test('resolvePersona falls back to neutral defaults when no preset is provided', () => {
  const dna = { persona: {} } as AgentDNA;
  const result = resolvePersona(dna, registry);
  assert.equal(result.tone, 'neutral');
  assert.deepEqual(result.traits, []);
  assert.deepEqual(result.constraints, []);
  assert.equal(result.escalationPolicy, undefined);
});
