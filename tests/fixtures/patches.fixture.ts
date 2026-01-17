/**
 * Patch Test Fixtures
 *
 * Factory functions for creating test patch data.
 * Based on data-model.md fixture schemas
 */

import { PatchData } from '../../src/core/types';
import { createTestOscillator, createTestFilter, createTestEnvelope, createTestVCA, createTestOutput } from './components.fixture';
import { createTestConnection } from './connections.fixture';

/**
 * Create empty patch
 */
export function createEmptyPatch(overrides?: Partial<PatchData>): PatchData {
  return {
    name: 'Empty Test Patch',
    version: '1.0.0',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    components: [],
    connections: [],
    ...overrides,
  };
}

/**
 * Create simple patch (oscillator → filter)
 */
export function createSimplePatch(overrides?: Partial<PatchData>): PatchData {
  const oscillator = createTestOscillator({ id: 'osc1' });
  const filter = createTestFilter({ id: 'filter1', position: { x: 300, y: 100 } });

  return {
    name: 'Simple Test Patch',
    version: '1.0.0',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    components: [oscillator, filter],
    connections: [
      createTestConnection('osc1', 'filter1'),
    ],
    ...overrides,
  };
}

/**
 * Create complex patch (multiple oscillators and routing)
 */
export function createComplexPatch(): PatchData {
  const osc1 = createTestOscillator({ id: 'osc1', position: { x: 100, y: 100 } });
  const osc2 = createTestOscillator({ id: 'osc2', position: { x: 100, y: 200 } });
  const filter1 = createTestFilter({ id: 'filter1', position: { x: 300, y: 100 } });
  const filter2 = createTestFilter({ id: 'filter2', position: { x: 300, y: 200 } });
  const output = createTestOutput({ id: 'output', position: { x: 500, y: 150 } });

  return {
    name: 'Complex Test Patch',
    version: '1.0.0',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    components: [osc1, osc2, filter1, filter2, output],
    connections: [
      createTestConnection('osc1', 'filter1'),
      createTestConnection('osc2', 'filter2'),
      createTestConnection('filter1', 'output'),
      createTestConnection('filter2', 'output'),
      // Additional modulation connections
      createTestConnection('osc1', 'filter2', 'output-0', 'input-1'),
      createTestConnection('osc2', 'filter1', 'output-0', 'input-1'),
      createTestConnection('filter1', 'filter2', 'output-0', 'input-2'),
      createTestConnection('filter2', 'filter1', 'output-0', 'input-2'),
    ],
  };
}

/**
 * Create subtractive synthesis patch (classic architecture)
 */
export function createSubtractivePatch(): PatchData {
  const osc = createTestOscillator({ id: 'osc', position: { x: 100, y: 100 } });
  const filter = createTestFilter({ id: 'filter', position: { x: 300, y: 100 } });
  const env = createTestEnvelope({ id: 'env', position: { x: 200, y: 200 } });
  const vca = createTestVCA({ id: 'vca', position: { x: 500, y: 100 } });
  const output = createTestOutput({ id: 'output', position: { x: 700, y: 100 } });

  return {
    name: 'Subtractive Test Patch',
    version: '1.0.0',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    components: [osc, filter, env, vca, output],
    connections: [
      createTestConnection('osc', 'filter'),
      createTestConnection('filter', 'vca'),
      createTestConnection('env', 'filter', 'output-0', 'input-1'), // Envelope modulates filter
      createTestConnection('env', 'vca', 'output-0', 'input-1'), // Envelope modulates VCA
      createTestConnection('vca', 'output'),
    ],
  };
}

/**
 * Create AM synthesis patch (amplitude modulation - currently supported)
 * Note: FM synthesis is not yet implemented (see docs/research/adding-fm-synthesis.md)
 */
export function createAMPatch(): PatchData {
  const carrier = createTestOscillator({ id: 'carrier', position: { x: 200, y: 100 } });
  const modulator = createTestOscillator({ id: 'modulator', position: { x: 100, y: 200 }, parameters: { frequency: 220, detune: 0, waveform: 0 } });
  const vca = createTestVCA({ id: 'vca', position: { x: 400, y: 100 } });
  const output = createTestOutput({ id: 'output', position: { x: 600, y: 100 } });

  return {
    name: 'AM Test Patch',
    version: '1.0.0',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    components: [carrier, modulator, vca, output],
    connections: [
      createTestConnection('carrier', 'vca', 'output-0', 'input-0'), // Carrier audio to VCA
      createTestConnection('modulator', 'vca', 'output-0', 'input-1'), // Modulator to VCA CV (AM!)
      createTestConnection('vca', 'output'),
    ],
  };
}
