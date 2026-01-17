/**
 * AudioEngine Integration Tests
 *
 * Tests for complex multi-component audio routing scenarios.
 * Based on spec.md User Story 1: Confident Refactoring
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioEngine } from '../../src/core/AudioEngine';
import { expectAudioConnection, expectAudioConnectionCount } from '../fixtures/assertion-helpers';
import type { MockAudioNode } from '../mocks/WebAudioAPI.mock';

describe('AudioEngine Integration', () => {
  let audioEngine: AudioEngine;

  beforeEach(async () => {
    audioEngine = new AudioEngine();
    await audioEngine.init();
    await audioEngine.resume(); // Ensure running state
  });

  afterEach(() => {
    if (audioEngine.isReady()) {
      audioEngine.clearAll();
    }
  });

  describe('Multi-Component Audio Routing', () => {
    it('should route audio through oscillator → filter chain', () => {
      const context = audioEngine.getContext();

      // Create audio chain: oscillator → filter → destination
      const osc = context.createOscillator();
      const filter = context.createBiquadFilter();

      audioEngine.addNode('osc1', osc as any, 'oscillator');
      audioEngine.addNode('filter1', filter as any, 'filter');

      // Connect chain
      audioEngine.connect('osc1', 'filter1');
      audioEngine.connectToDestination('filter1');

      // Verify connections
      expect(audioEngine.getNodeCount()).toBe(2);
      expectAudioConnection(osc as any as MockAudioNode, filter as any as MockAudioNode);
    });

    it('should handle complex multi-component audio graph', () => {
      const context = audioEngine.getContext();

      // Create complex patch:
      // osc1 → filter1 ↘
      //                  → mixer → destination
      // osc2 → filter2 ↗
      const osc1 = context.createOscillator();
      const osc2 = context.createOscillator();
      const filter1 = context.createBiquadFilter();
      const filter2 = context.createBiquadFilter();
      const mixer = context.createGain();

      audioEngine.addNode('osc1', osc1 as any, 'oscillator');
      audioEngine.addNode('osc2', osc2 as any, 'oscillator');
      audioEngine.addNode('filter1', filter1 as any, 'filter');
      audioEngine.addNode('filter2', filter2 as any, 'filter');
      audioEngine.addNode('mixer', mixer as any, 'gain');

      // Connect audio graph
      audioEngine.connect('osc1', 'filter1');
      audioEngine.connect('osc2', 'filter2');
      audioEngine.connect('filter1', 'mixer');
      audioEngine.connect('filter2', 'mixer');
      audioEngine.connectToDestination('mixer');

      // Verify all nodes are registered
      expect(audioEngine.getNodeCount()).toBe(5);
      expect(audioEngine.getNodeIds()).toContain('osc1');
      expect(audioEngine.getNodeIds()).toContain('osc2');
      expect(audioEngine.getNodeIds()).toContain('filter1');
      expect(audioEngine.getNodeIds()).toContain('filter2');
      expect(audioEngine.getNodeIds()).toContain('mixer');

      // Verify connections
      expectAudioConnection(osc1 as any as MockAudioNode, filter1 as any as MockAudioNode);
      expectAudioConnection(osc2 as any as MockAudioNode, filter2 as any as MockAudioNode);
      expectAudioConnection(filter1 as any as MockAudioNode, mixer as any as MockAudioNode);
      expectAudioConnection(filter2 as any as MockAudioNode, mixer as any as MockAudioNode);
    });

    it('should disconnect component from complex audio graph', () => {
      const context = audioEngine.getContext();

      // Create chain: osc → filter → gain → destination
      const osc = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();

      audioEngine.addNode('osc1', osc as any, 'oscillator');
      audioEngine.addNode('filter1', filter as any, 'filter');
      audioEngine.addNode('gain1', gain as any, 'gain');

      audioEngine.connect('osc1', 'filter1');
      audioEngine.connect('filter1', 'gain1');
      audioEngine.connectToDestination('gain1');

      // Disconnect filter from chain
      audioEngine.disconnect('filter1', 'gain1');

      // Filter should still exist but not be connected to gain
      expect(audioEngine.getNode('filter1')).toBeDefined();
      expect(audioEngine.getNodeCount()).toBe(3);

      // Reconnect with new routing: osc → gain (bypass filter)
      audioEngine.connect('osc1', 'gain1');

      expectAudioConnection(osc as any as MockAudioNode, gain as any as MockAudioNode);
    });

    it('should register and unregister components correctly', () => {
      const context = audioEngine.getContext();

      // Register multiple components
      const osc = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();

      audioEngine.addNode('osc1', osc as any, 'oscillator');
      audioEngine.addNode('filter1', filter as any, 'filter');
      audioEngine.addNode('gain1', gain as any, 'gain');

      expect(audioEngine.getNodeCount()).toBe(3);

      // Unregister components
      audioEngine.removeNode('filter1');
      expect(audioEngine.getNodeCount()).toBe(2);
      expect(audioEngine.getNode('filter1')).toBeNull();

      audioEngine.removeNode('osc1');
      expect(audioEngine.getNodeCount()).toBe(1);
      expect(audioEngine.getNode('osc1')).toBeNull();

      // Only gain remains
      expect(audioEngine.getNode('gain1')).toBeDefined();
    });
  });

  describe('Subtractive Synthesis Patch', () => {
    it('should create classic subtractive synthesis routing', () => {
      const context = audioEngine.getContext();

      // Classic subtractive patch:
      // oscillator → filter → VCA → destination
      // envelope → filter cutoff (CV modulation - not tested here, audio connections only)
      // envelope → VCA gain (CV modulation - not tested here, audio connections only)
      const osc = context.createOscillator();
      const filter = context.createBiquadFilter();
      const vca = context.createGain();
      const env = context.createGain(); // Envelope generator

      audioEngine.addNode('osc', osc as any, 'oscillator');
      audioEngine.addNode('filter', filter as any, 'filter');
      audioEngine.addNode('vca', vca as any, 'vca');
      audioEngine.addNode('env', env as any, 'envelope');

      // Audio signal chain
      audioEngine.connect('osc', 'filter');
      audioEngine.connect('filter', 'vca');
      audioEngine.connectToDestination('vca');

      // Verify audio chain
      expect(audioEngine.getNodeCount()).toBe(4);
      expectAudioConnection(osc as any as MockAudioNode, filter as any as MockAudioNode);
      expectAudioConnection(filter as any as MockAudioNode, vca as any as MockAudioNode);
    });
  });

  describe('Parallel Oscillator Mixing', () => {
    it('should mix multiple oscillators into single output', () => {
      const context = audioEngine.getContext();

      // Multiple oscillators → mixer → destination
      const osc1 = context.createOscillator();
      const osc2 = context.createOscillator();
      const osc3 = context.createOscillator();
      const mixer = context.createGain();

      audioEngine.addNode('osc1', osc1 as any, 'oscillator');
      audioEngine.addNode('osc2', osc2 as any, 'oscillator');
      audioEngine.addNode('osc3', osc3 as any, 'oscillator');
      audioEngine.addNode('mixer', mixer as any, 'gain');

      audioEngine.connect('osc1', 'mixer');
      audioEngine.connect('osc2', 'mixer');
      audioEngine.connect('osc3', 'mixer');
      audioEngine.connectToDestination('mixer');

      // Verify all oscillators connected to mixer
      expectAudioConnection(osc1 as any as MockAudioNode, mixer as any as MockAudioNode);
      expectAudioConnection(osc2 as any as MockAudioNode, mixer as any as MockAudioNode);
      expectAudioConnection(osc3 as any as MockAudioNode, mixer as any as MockAudioNode);
      expectAudioConnectionCount(mixer as any as MockAudioNode, 1); // Mixer connected to destination
    });
  });

  describe('Series Effect Chain', () => {
    it('should create effect chain with multiple filters', () => {
      const context = audioEngine.getContext();

      // Effect chain: osc → filter1 → filter2 → filter3 → destination
      const osc = context.createOscillator();
      const filter1 = context.createBiquadFilter();
      const filter2 = context.createBiquadFilter();
      const filter3 = context.createBiquadFilter();

      audioEngine.addNode('osc', osc as any, 'oscillator');
      audioEngine.addNode('filter1', filter1 as any, 'filter');
      audioEngine.addNode('filter2', filter2 as any, 'filter');
      audioEngine.addNode('filter3', filter3 as any, 'filter');

      audioEngine.connect('osc', 'filter1');
      audioEngine.connect('filter1', 'filter2');
      audioEngine.connect('filter2', 'filter3');
      audioEngine.connectToDestination('filter3');

      // Verify chain connections
      expectAudioConnection(osc as any as MockAudioNode, filter1 as any as MockAudioNode);
      expectAudioConnection(filter1 as any as MockAudioNode, filter2 as any as MockAudioNode);
      expectAudioConnection(filter2 as any as MockAudioNode, filter3 as any as MockAudioNode);
    });
  });

  describe('Patch Loading Simulation', () => {
    it('should clear all nodes when loading new patch', () => {
      const context = audioEngine.getContext();

      // Create initial patch
      const osc1 = context.createOscillator();
      const filter1 = context.createBiquadFilter();
      audioEngine.addNode('osc1', osc1 as any, 'oscillator');
      audioEngine.addNode('filter1', filter1 as any, 'filter');
      audioEngine.connect('osc1', 'filter1');

      expect(audioEngine.getNodeCount()).toBe(2);

      // Clear all (simulates loading new patch)
      audioEngine.clearAll();
      expect(audioEngine.getNodeCount()).toBe(0);

      // Create new patch
      const osc2 = context.createOscillator();
      const gain2 = context.createGain();
      audioEngine.addNode('osc2', osc2 as any, 'oscillator');
      audioEngine.addNode('gain2', gain2 as any, 'gain');
      audioEngine.connect('osc2', 'gain2');

      expect(audioEngine.getNodeCount()).toBe(2);
      expect(audioEngine.getNodeIds()).toContain('osc2');
      expect(audioEngine.getNodeIds()).toContain('gain2');
      expect(audioEngine.getNodeIds()).not.toContain('osc1');
      expect(audioEngine.getNodeIds()).not.toContain('filter1');
    });
  });

  describe('Error Recovery in Complex Graphs', () => {
    it('should handle partial graph cleanup after error', () => {
      const context = audioEngine.getContext();

      const osc = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();

      audioEngine.addNode('osc', osc as any, 'oscillator');
      audioEngine.addNode('filter', filter as any, 'filter');
      audioEngine.addNode('gain', gain as any, 'gain');

      audioEngine.connect('osc', 'filter');
      audioEngine.connect('filter', 'gain');

      // Remove middle component
      audioEngine.removeNode('filter');

      // Graph should still be valid with remaining nodes
      expect(audioEngine.getNodeCount()).toBe(2);
      expect(audioEngine.getNode('osc')).toBeDefined();
      expect(audioEngine.getNode('gain')).toBeDefined();
      expect(audioEngine.getNode('filter')).toBeNull();
    });
  });
});
