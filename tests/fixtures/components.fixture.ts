/**
 * Component Test Fixtures
 *
 * Factory functions for creating test component data.
 * Based on data-model.md fixture schemas and research.md RT-004 decision: Use factory functions
 */

import { ComponentData, ComponentType, Position } from '../../src/core/types';

/**
 * Create test oscillator component
 */
export function createTestOscillator(
  overrides?: Partial<ComponentData>
): ComponentData {
  return {
    id: `osc-${Math.random().toString(36).slice(2, 11)}`,
    type: ComponentType.OSCILLATOR,
    position: { x: 100, y: 100 },
    parameters: {
      waveform: 0, // 0=sine, 1=square, 2=saw, 3=triangle
      frequency: 440,
      detune: 0,
    },
    isBypassed: false,
    ...overrides,
  };
}

/**
 * Create test filter component
 */
export function createTestFilter(
  overrides?: Partial<ComponentData>
): ComponentData {
  return {
    id: `filter-${Math.random().toString(36).slice(2, 11)}`,
    type: ComponentType.FILTER,
    position: { x: 300, y: 100 },
    parameters: {
      type: 0, // 0=lowpass, 1=highpass, 2=bandpass, 3=notch
      frequency: 1000,
      resonance: 1,
    },
    isBypassed: false,
    ...overrides,
  };
}

/**
 * Create test envelope component
 */
export function createTestEnvelope(
  overrides?: Partial<ComponentData>
): ComponentData {
  return {
    id: `env-${Math.random().toString(36).slice(2, 11)}`,
    type: ComponentType.ADSR_ENVELOPE,
    position: { x: 200, y: 200 },
    parameters: {
      attack: 0.01,
      decay: 0.1,
      sustain: 0.7,
      release: 0.3,
    },
    isBypassed: false,
    ...overrides,
  };
}

/**
 * Create test LFO component
 */
export function createTestLFO(
  overrides?: Partial<ComponentData>
): ComponentData {
  return {
    id: `lfo-${Math.random().toString(36).slice(2, 11)}`,
    type: ComponentType.LFO,
    position: { x: 150, y: 300 },
    parameters: {
      waveform: 0, // 0=sine, 1=square, 2=saw, 3=triangle
      frequency: 1,
      depth: 0.5,
    },
    isBypassed: false,
    ...overrides,
  };
}

/**
 * Create test VCA (Voltage Controlled Amplifier) component
 */
export function createTestVCA(
  overrides?: Partial<ComponentData>
): ComponentData {
  return {
    id: `vca-${Math.random().toString(36).slice(2, 11)}`,
    type: ComponentType.VCA,
    position: { x: 400, y: 100 },
    parameters: {
      gain: 0.5,
    },
    isBypassed: false,
    ...overrides,
  };
}

/**
 * Create test output component
 */
export function createTestOutput(
  overrides?: Partial<ComponentData>
): ComponentData {
  return {
    id: `output-${Math.random().toString(36).slice(2, 11)}`,
    type: ComponentType.MASTER_OUTPUT,
    position: { x: 600, y: 100 },
    parameters: {
      gain: 1.0,
    },
    isBypassed: false,
    ...overrides,
  };
}

/**
 * Create test keyboard input component
 */
export function createTestKeyboard(
  overrides?: Partial<ComponentData>
): ComponentData {
  return {
    id: `keyboard-${Math.random().toString(36).slice(2, 11)}`,
    type: ComponentType.KEYBOARD_INPUT,
    position: { x: 50, y: 400 },
    parameters: {
      octave: 4,
    },
    isBypassed: false,
    ...overrides,
  };
}

/**
 * Create test sequencer component
 */
export function createTestSequencer(
  overrides?: Partial<ComponentData>
): ComponentData {
  return {
    id: `seq-${Math.random().toString(36).slice(2, 11)}`,
    type: ComponentType.STEP_SEQUENCER,
    position: { x: 50, y: 500 },
    parameters: {
      steps: 16,
      bpm: 120,
    },
    isBypassed: false,
    ...overrides,
  };
}
