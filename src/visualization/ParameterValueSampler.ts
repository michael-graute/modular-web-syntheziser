/**
 * ParameterValueSampler - Audio-thread parameter sampling
 * Samples CV-modulated parameter values at 20Hz from audio thread
 * Uses SharedArrayBuffer for lock-free communication
 */

import { IParameterValueSampler } from './types';

export class ParameterValueSampler implements IParameterValueSampler {
  private workletNode: AudioWorkletNode | null = null;
  private sharedArray: Int32Array | null = null; // Use Int32Array for Atomics support
  private parameterMap: Map<string, { bufferIndex: number; audioParam: AudioParam }> = new Map();
  private nextBufferIndex: number = 0;
  private isInitialized: boolean = false;
  private isStarted: boolean = false;

  // Scaling factor for float-to-int conversion (10000 = 4 decimal places precision)
  private static readonly SCALE_FACTOR = 10000;

  /**
   * Initialize the sampler with audio context and shared buffer
   */
  async initialize(
    audioContext: AudioContext,
    sharedBuffer: SharedArrayBuffer,
    samplingRate: number = 20
  ): Promise<void> {
    if (this.isInitialized) {
      console.warn('ParameterValueSampler already initialized');
      return;
    }

    this.sharedArray = new Int32Array(sharedBuffer); // Use Int32Array for Atomics

    try {
      // Load the AudioWorklet processor
      await audioContext.audioWorklet.addModule('/worklets/parameter-sampler.js');

      // Create the AudioWorklet node
      this.workletNode = new AudioWorkletNode(audioContext, 'parameter-sampler', {
        processorOptions: {
          sharedBuffer: sharedBuffer,
          samplingRate: samplingRate,
        },
      });

      // Connect to destination (required for AudioWorklet to process)
      // Note: This doesn't produce audio output, just keeps the node alive
      this.workletNode.connect(audioContext.destination);

      this.isInitialized = true;
      console.log(`✓ ParameterValueSampler initialized (${samplingRate} Hz)`);
    } catch (error) {
      console.error('Failed to initialize ParameterValueSampler:', error);
      throw error;
    }
  }

  /**
   * Register a parameter for sampling
   * @returns Buffer index where values will be written
   */
  registerParameter(parameterId: string, audioParam: AudioParam): number {
    if (!this.isInitialized) {
      throw new Error('ParameterValueSampler not initialized');
    }

    // Check if parameter is already registered
    if (this.parameterMap.has(parameterId)) {
      console.warn(`Parameter "${parameterId}" already registered`);
      return this.parameterMap.get(parameterId)!.bufferIndex;
    }

    // Allocate buffer index
    const bufferIndex = this.nextBufferIndex++;

    // Check buffer capacity
    if (bufferIndex >= this.sharedArray!.length) {
      throw new Error(
        `SharedArrayBuffer capacity exceeded (max ${this.sharedArray!.length} parameters)`
      );
    }

    // Store mapping
    this.parameterMap.set(parameterId, { bufferIndex, audioParam });

    // Notify worklet to register parameter
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'register',
        parameterId,
        bufferIndex,
      });
    }

    console.log(`✓ Registered parameter "${parameterId}" at buffer index ${bufferIndex}`);
    return bufferIndex;
  }

  /**
   * Unregister a parameter from sampling
   */
  unregisterParameter(parameterId: string): void {
    if (!this.isInitialized) {
      throw new Error('ParameterValueSampler not initialized');
    }

    const entry = this.parameterMap.get(parameterId);
    if (!entry) {
      console.warn(`Parameter "${parameterId}" not registered`);
      return;
    }

    // Notify worklet to unregister parameter
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'unregister',
        parameterId,
      });
    }

    // Clear buffer slot
    if (this.sharedArray) {
      Atomics.store(this.sharedArray, entry.bufferIndex, 0);
    }

    // Remove from map
    this.parameterMap.delete(parameterId);

    console.log(`✓ Unregistered parameter "${parameterId}"`);
  }

  /**
   * Get the latest sampled value for a parameter
   * @returns Sampled value or null if not registered
   */
  getValue(parameterId: string): number | null {
    if (!this.isInitialized || !this.sharedArray) {
      return null;
    }

    const entry = this.parameterMap.get(parameterId);
    if (!entry) {
      return null;
    }

    // Read from shared buffer using Atomics for thread safety
    // Convert from scaled integer back to float
    const scaledValue = Atomics.load(this.sharedArray, entry.bufferIndex);
    return scaledValue / ParameterValueSampler.SCALE_FACTOR;
  }

  /**
   * Start sampling
   */
  start(): void {
    if (!this.isInitialized) {
      throw new Error('ParameterValueSampler not initialized');
    }

    if (this.isStarted) {
      console.warn('ParameterValueSampler already started');
      return;
    }

    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'start' });
    }

    this.isStarted = true;
    console.log('✓ ParameterValueSampler started');
  }

  /**
   * Stop sampling
   */
  stop(): void {
    if (!this.isStarted) {
      return;
    }

    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'stop' });
    }

    this.isStarted = false;
    console.log('✓ ParameterValueSampler stopped');
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.stop();

    // Disconnect worklet
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    // Clear all mappings
    this.parameterMap.clear();

    // Clear references
    this.sharedArray = null;

    this.isInitialized = false;
    console.log('✓ ParameterValueSampler disposed');
  }

  /**
   * Get the number of registered parameters
   */
  getParameterCount(): number {
    return this.parameterMap.size;
  }

  /**
   * Check if a parameter is registered
   */
  isParameterRegistered(parameterId: string): boolean {
    return this.parameterMap.has(parameterId);
  }
}
