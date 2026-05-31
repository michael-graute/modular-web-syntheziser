import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MockGainNode, MockOscillatorNode, MockDelayNode,
  MockBiquadFilterNode, MockConstantSourceNode, MockScriptProcessorNode,
} from '../mocks/WebAudioAPI.mock';

// ---------------------------------------------------------------------------
// Mock AudioEngine — covers all four effect types
// ---------------------------------------------------------------------------

const mockGain = () => new MockGainNode() as unknown as GainNode;
const mockOscillator = () => new MockOscillatorNode() as unknown as OscillatorNode;
const mockDelay = () => new MockDelayNode() as unknown as DelayNode;
const mockBiquad = () => new MockBiquadFilterNode() as unknown as BiquadFilterNode;
const mockConstantSource = () => new MockConstantSourceNode() as unknown as ConstantSourceNode;
const mockScriptProcessor = () => new MockScriptProcessorNode() as unknown as ScriptProcessorNode;

const mockCtx = {
  currentTime: 0,
  createGain: vi.fn(mockGain),
  createOscillator: vi.fn(mockOscillator),
  createDelay: vi.fn(mockDelay),
  createBiquadFilter: vi.fn(mockBiquad),
  createConstantSource: vi.fn(mockConstantSource),
  createScriptProcessor: vi.fn(mockScriptProcessor),
};

vi.mock('../../src/core/AudioEngine', () => ({
  audioEngine: {
    isReady: () => true,
    getContext: () => mockCtx,
    addNode: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports after mock is registered
// ---------------------------------------------------------------------------

import { Bitcrusher } from '../../src/components/effects/Bitcrusher';
import { Flanger } from '../../src/components/effects/Flanger';
import { Phaser } from '../../src/components/effects/Phaser';
import { Tremolo } from '../../src/components/effects/Tremolo';
import { RingModulator } from '../../src/components/effects/RingModulator';
import { SynthComponent } from '../../src/components/base/SynthComponent';

type EffectFactory = () => SynthComponent;

const effects: Array<{ name: string; factory: EffectFactory }> = [
  { name: 'Bitcrusher',    factory: () => new Bitcrusher('bc-bypass',  { x: 0, y: 0 }) },
  { name: 'Flanger',       factory: () => new Flanger('fl-bypass',     { x: 0, y: 0 }) },
  { name: 'Phaser',        factory: () => new Phaser('ph-bypass',      { x: 0, y: 0 }) },
  { name: 'Tremolo',       factory: () => new Tremolo('tr-bypass',     { x: 0, y: 0 }) },
  { name: 'RingModulator', factory: () => new RingModulator('rm-bypass', { x: 0, y: 0 }) },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockCtx.createGain.mockImplementation(mockGain);
  mockCtx.createOscillator.mockImplementation(mockOscillator);
  mockCtx.createDelay.mockImplementation(mockDelay);
  mockCtx.createBiquadFilter.mockImplementation(mockBiquad);
  mockCtx.createConstantSource.mockImplementation(mockConstantSource);
  mockCtx.createScriptProcessor.mockImplementation(mockScriptProcessor);
});

// ---------------------------------------------------------------------------
// Cross-cutting bypass tests for all four effects
// ---------------------------------------------------------------------------

for (const { name, factory } of effects) {
  describe(`${name} bypass`, () => {
    let effect: SynthComponent;

    beforeEach(() => {
      effect = factory();
      effect.activate();
    });

    it('is bypassable', () => {
      expect(effect.isBypassable()).toBe(true);
    });

    it('setBypass(true) sets isBypassed to true', () => {
      effect.setBypass(true);
      expect(effect.isBypassed).toBe(true);
    });

    it('setBypass(false) sets isBypassed to false', () => {
      effect.setBypass(true);
      effect.setBypass(false);
      expect(effect.isBypassed).toBe(false);
    });

    it('double-toggle (true→false→true) leaves state consistent', () => {
      effect.setBypass(true);
      effect.setBypass(false);
      effect.setBypass(true);
      expect(effect.isBypassed).toBe(true);
    });

    it('calling setBypass with the same value is a no-op', () => {
      effect.setBypass(false);
      effect.setBypass(false);
      expect(effect.isBypassed).toBe(false);
    });

    it('serialize includes isBypassed:true when bypassed', () => {
      effect.setBypass(true);
      expect(effect.serialize().isBypassed).toBe(true);
    });

    it('serialize omits isBypassed when not bypassed', () => {
      expect(effect.serialize().isBypassed).toBeUndefined();
    });

    it('deserialize restores bypass state flag', () => {
      const serialized = effect.serialize();
      serialized.isBypassed = true;

      const restored = factory();
      restored.deserialize(serialized);
      // Flag is stored but only applied after activate()
      restored.activate();
      expect(restored.isBypassed).toBe(true);
    });

    it('enableBypass wires inputGain directly to outputGain', () => {
      effect.setBypass(true);
      const inputGain = effect.getAudioNode('inputGain') as any;
      const outputGain = effect.getAudioNode('outputGain');
      expect(inputGain.isConnectedTo(outputGain)).toBe(true);
    });
  });
}
