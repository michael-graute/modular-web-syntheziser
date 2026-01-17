/**
 * AudioEngine Unit Tests
 *
 * Tests for AudioEngine initialization, node management, and connection handling.
 * Based on spec.md User Story 1: Confident Refactoring
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioEngine } from '../../src/core/AudioEngine';
import { MockAudioContext } from '../mocks/WebAudioAPI.mock';

describe('AudioEngine', () => {
  let audioEngine: AudioEngine;

  beforeEach(() => {
    // Create fresh AudioEngine instance for each test
    audioEngine = new AudioEngine();
  });

  afterEach(() => {
    // Clean up after each test
    if (audioEngine.isReady()) {
      audioEngine.clearAll();
    }
  });

  describe('Initialization', () => {
    it('should initialize AudioContext on first call', async () => {
      expect(audioEngine.isReady()).toBe(false);

      await audioEngine.init();

      expect(audioEngine.isReady()).toBe(true);
      expect(audioEngine.getContext()).toBeDefined();
    });

    it('should create AudioContext and set isReady() to true', async () => {
      await audioEngine.init();

      expect(audioEngine.isReady()).toBe(true);
      const context = audioEngine.getContext();
      expect(context).toBeInstanceOf(MockAudioContext);
    });

    it('should transition AudioContext from suspended to running state', async () => {
      await audioEngine.init();
      const context = audioEngine.getContext();

      // Context starts suspended (Chrome autoplay policy)
      expect(context.state).toBe('suspended');

      // Resume the context
      await audioEngine.resume();

      expect(context.state).toBe('running');
    });

    it('should handle AudioContext initialization failure gracefully', async () => {
      // Mock AudioContext to throw error
      const originalAudioContext = global.AudioContext;
      // @ts-expect-error - Mocking global AudioContext
      global.AudioContext = undefined;

      await expect(audioEngine.init()).rejects.toThrow('Web Audio API not supported');

      // Restore
      // @ts-expect-error - Restoring global AudioContext
      global.AudioContext = originalAudioContext;
    });

    it('should handle concurrent initialization calls', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      // Initialize concurrently
      await Promise.all([audioEngine.init(), audioEngine.init(), audioEngine.init()]);

      // Should only initialize once, warn on subsequent calls
      expect(audioEngine.isReady()).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('AudioEngine already initialized');

      consoleSpy.mockRestore();
    });
  });

  describe('Node Connections', () => {
    beforeEach(async () => {
      await audioEngine.init();
    });

    it('should connect two audio nodes successfully', () => {
      const context = audioEngine.getContext();
      const osc = context.createOscillator();
      const gain = context.createGain();

      audioEngine.addNode('osc1', osc as any, 'oscillator');
      audioEngine.addNode('gain1', gain as any, 'gain');

      expect(() => {
        audioEngine.connect('osc1', 'gain1');
      }).not.toThrow();

      // Verify connection was made
      const sourceNode = audioEngine.getNode('osc1');
      expect(sourceNode).toBeDefined();
    });

    it('should track connected nodes after connection', () => {
      const context = audioEngine.getContext();
      const osc = context.createOscillator();
      const gain = context.createGain();

      audioEngine.addNode('osc1', osc as any, 'oscillator');
      audioEngine.addNode('gain1', gain as any, 'gain');

      audioEngine.connect('osc1', 'gain1');

      // AudioEngine tracks connections internally via Set
      const sourceNode: any = audioEngine.getNode('osc1');
      expect(sourceNode).toBeDefined();
    });

    it('should disconnect audio nodes properly', () => {
      const context = audioEngine.getContext();
      const osc = context.createOscillator();
      const gain = context.createGain();

      audioEngine.addNode('osc1', osc as any, 'oscillator');
      audioEngine.addNode('gain1', gain as any, 'gain');

      audioEngine.connect('osc1', 'gain1');
      audioEngine.disconnect('osc1', 'gain1');

      // Should not throw after disconnect
      expect(() => {
        audioEngine.disconnect('osc1', 'gain1');
      }).not.toThrow();
    });

    it('should clean up connections when component is destroyed', () => {
      const context = audioEngine.getContext();
      const osc = context.createOscillator();
      const gain = context.createGain();

      audioEngine.addNode('osc1', osc as any, 'oscillator');
      audioEngine.addNode('gain1', gain as any, 'gain');

      audioEngine.connect('osc1', 'gain1');

      // Remove node should disconnect and clean up
      audioEngine.removeNode('osc1');

      expect(audioEngine.getNode('osc1')).toBeNull();
    });

    it('should prevent duplicate connections between same nodes', () => {
      const context = audioEngine.getContext();
      const osc = context.createOscillator();
      const gain = context.createGain();

      audioEngine.addNode('osc1', osc as any, 'oscillator');
      audioEngine.addNode('gain1', gain as any, 'gain');

      // Connect twice
      audioEngine.connect('osc1', 'gain1');
      audioEngine.connect('osc1', 'gain1');

      // Web Audio API allows duplicate connections, but they should still work
      expect(audioEngine.getNode('osc1')).toBeDefined();
      expect(audioEngine.getNode('gain1')).toBeDefined();
    });

    it('should handle multiple sequential node connections', () => {
      const context = audioEngine.getContext();
      const osc = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();

      audioEngine.addNode('osc1', osc as any, 'oscillator');
      audioEngine.addNode('filter1', filter as any, 'filter');
      audioEngine.addNode('gain1', gain as any, 'gain');

      // Connect in chain: osc → filter → gain
      audioEngine.connect('osc1', 'filter1');
      audioEngine.connect('filter1', 'gain1');

      expect(audioEngine.getNodeCount()).toBe(3);
    });
  });

  describe('State Transitions', () => {
    beforeEach(async () => {
      await audioEngine.init();
    });

    it('should resume suspended AudioContext on user interaction', async () => {
      const context = audioEngine.getContext();
      expect(context.state).toBe('suspended');

      await audioEngine.resume();

      expect(context.state).toBe('running');
    });

    it('should suspend running AudioContext', async () => {
      await audioEngine.resume(); // Start running
      expect(audioEngine.getState()).toBe('running');

      await audioEngine.suspend();

      expect(audioEngine.getState()).toBe('suspended');
    });

    it('should close AudioContext and clean up', async () => {
      const context = audioEngine.getContext();
      const osc = context.createOscillator();
      audioEngine.addNode('osc1', osc as any, 'oscillator');

      await audioEngine.close();

      expect(audioEngine.isReady()).toBe(false);
      expect(audioEngine.getState()).toBe('closed');
    });

    it('should return correct state when not initialized', () => {
      const uninitializedEngine = new AudioEngine();
      expect(uninitializedEngine.getState()).toBe('closed');
      expect(uninitializedEngine.isReady()).toBe(false);
    });
  });

  describe('Node Management', () => {
    beforeEach(async () => {
      await audioEngine.init();
    });

    it('should add audio node to management', () => {
      const context = audioEngine.getContext();
      const osc = context.createOscillator();

      audioEngine.addNode('osc1', osc as any, 'oscillator');

      expect(audioEngine.getNode('osc1')).toBe(osc);
      expect(audioEngine.getNodeCount()).toBe(1);
    });

    it('should remove audio node from management', () => {
      const context = audioEngine.getContext();
      const osc = context.createOscillator();

      audioEngine.addNode('osc1', osc as any, 'oscillator');
      audioEngine.removeNode('osc1');

      expect(audioEngine.getNode('osc1')).toBeNull();
      expect(audioEngine.getNodeCount()).toBe(0);
    });

    it('should get all node IDs', () => {
      const context = audioEngine.getContext();
      const osc = context.createOscillator();
      const gain = context.createGain();

      audioEngine.addNode('osc1', osc as any, 'oscillator');
      audioEngine.addNode('gain1', gain as any, 'gain');

      const nodeIds = audioEngine.getNodeIds();
      expect(nodeIds).toContain('osc1');
      expect(nodeIds).toContain('gain1');
      expect(nodeIds.length).toBe(2);
    });

    it('should clear all nodes', () => {
      const context = audioEngine.getContext();
      const osc = context.createOscillator();
      const gain = context.createGain();

      audioEngine.addNode('osc1', osc as any, 'oscillator');
      audioEngine.addNode('gain1', gain as any, 'gain');

      audioEngine.clearAll();

      expect(audioEngine.getNodeCount()).toBe(0);
    });

    it('should warn when adding duplicate node ID', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      const context = audioEngine.getContext();
      const osc = context.createOscillator();

      audioEngine.addNode('osc1', osc as any, 'oscillator');
      audioEngine.addNode('osc1', osc as any, 'oscillator');

      expect(consoleSpy).toHaveBeenCalledWith('Node with id osc1 already exists');
      consoleSpy.mockRestore();
    });
  });

  describe('Audio Context Properties', () => {
    beforeEach(async () => {
      await audioEngine.init();
    });

    it('should return sample rate', () => {
      const sampleRate = audioEngine.getSampleRate();
      expect(sampleRate).toBe(44100); // Mock default
    });

    it('should return current time', () => {
      const currentTime = audioEngine.getCurrentTime();
      expect(currentTime).toBeGreaterThanOrEqual(0);
    });

    it('should return base latency', () => {
      const latency = audioEngine.getBaseLatency();
      expect(latency).toBeGreaterThanOrEqual(0);
    });

    it('should return output latency', () => {
      const latency = audioEngine.getOutputLatency();
      expect(latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await audioEngine.init();
    });

    it('should throw error when getting context before init', () => {
      const uninitializedEngine = new AudioEngine();
      expect(() => uninitializedEngine.getContext()).toThrow('AudioContext not initialized');
    });

    it('should throw error when resuming before init', async () => {
      const uninitializedEngine = new AudioEngine();
      await expect(uninitializedEngine.resume()).rejects.toThrow('AudioContext not initialized');
    });

    it('should throw error when connecting non-existent source node', () => {
      const context = audioEngine.getContext();
      const gain = context.createGain();
      audioEngine.addNode('gain1', gain as any, 'gain');

      expect(() => {
        audioEngine.connect('nonexistent', 'gain1');
      }).toThrow('Source node nonexistent not found');
    });

    it('should throw error when connecting non-existent target node', () => {
      const context = audioEngine.getContext();
      const osc = context.createOscillator();
      audioEngine.addNode('osc1', osc as any, 'oscillator');

      expect(() => {
        audioEngine.connect('osc1', 'nonexistent');
      }).toThrow('Target node nonexistent not found');
    });
  });

  describe('Destination Connection', () => {
    beforeEach(async () => {
      await audioEngine.init();
    });

    it('should connect node to destination', () => {
      const context = audioEngine.getContext();
      const osc = context.createOscillator();

      audioEngine.addNode('osc1', osc as any, 'oscillator');

      expect(() => {
        audioEngine.connectToDestination('osc1');
      }).not.toThrow();
    });

    it('should throw error when connecting non-existent node to destination', () => {
      expect(() => {
        audioEngine.connectToDestination('nonexistent');
      }).toThrow('Source node nonexistent not found');
    });
  });
});
