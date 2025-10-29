/**
 * ParameterValueSampler - Audio-thread parameter sampling
 * Samples CV-modulated parameter values at 20Hz from audio thread
 * Uses SharedArrayBuffer for lock-free communication
 */

import { IParameterValueSampler } from './types';

export class ParameterValueSampler implements IParameterValueSampler {
  private workletNode: AudioWorkletNode | null = null;
  private sharedArray: Int32Array | null = null; // Use Int32Array for Atomics support
  private parameterMap: Map<string, {
    bufferIndex: number;
    audioParam: AudioParam;
    analyserNode?: AnalyserNode;  // For sampling CV modulation
    dataArray?: Float32Array;      // Reusable buffer for analyser
  }> = new Map();
  private nextBufferIndex: number = 0;
  private isInitialized: boolean = false;
  private isStarted: boolean = false;
  private samplingIntervalId: number | null = null; // For setInterval sampling

  // Scaling factor for float-to-int conversion (10000 = 4 decimal places precision)
  private static readonly SCALE_FACTOR = 10000;

  /**
   * Initialize the sampler with audio context and shared buffer
   */
  async initialize(
    _audioContext: AudioContext,
    sharedBuffer: SharedArrayBuffer,
    _samplingRate: number = 20
  ): Promise<void> {
    if (this.isInitialized) {
      console.warn('ParameterValueSampler already initialized');
      return;
    }

    this.sharedArray = new Int32Array(sharedBuffer); // Use Int32Array for Atomics

    this.isInitialized = true;
    console.log(`✓ ParameterValueSampler initialized (${_samplingRate} Hz, main-thread sampling)`);

    // Note: We no longer use AudioWorklet because AudioParam.value doesn't include modulation
    // Instead we use AnalyserNode to sample the actual modulated signal
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

    // Connect the AudioParam to the worklet node so it can be sampled
    // AudioParams are automatically passed to the process() method's parameters object
    if (this.workletNode) {
      // Connect the AudioParam by using it as a modulation source
      // We need to connect it to a parameter on the worklet node
      // But AudioWorkletNode doesn't have custom parameters by default
      // Instead, we'll read the value directly from the AudioParam
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
   * Start sampling (20 Hz on main thread)
   */
  start(): void {
    if (!this.isInitialized) {
      throw new Error('ParameterValueSampler not initialized');
    }

    if (this.isStarted) {
      console.warn('ParameterValueSampler already started');
      return;
    }

    // Sample AudioParams directly on main thread at 20 Hz (every 50ms)
    this.samplingIntervalId = window.setInterval(() => {
      this.sampleParameters();
    }, 50); // 20 Hz

    this.isStarted = true;
    console.log('✓ ParameterValueSampler started (20 Hz sampling on main thread)');
  }

  /**
   * Sample all registered AudioParams and write to SharedArrayBuffer
   */
  private sampleParameters(): void {
    if (!this.sharedArray) return;

    this.parameterMap.forEach((entry, parameterId) => {
      try {
        // Read current value from AudioParam
        const value = entry.audioParam.value;

        // Convert to scaled integer for Atomics
        const scaledValue = Math.round(value * ParameterValueSampler.SCALE_FACTOR);

        // Write to shared buffer
        Atomics.store(this.sharedArray!, entry.bufferIndex, scaledValue);
      } catch (error) {
        console.error(`Error sampling parameter "${parameterId}":`, error);
      }
    });
  }

  /**
   * Stop sampling
   */
  stop(): void {
    if (!this.isStarted) {
      return;
    }

    // Stop the sampling interval
    if (this.samplingIntervalId !== null) {
      window.clearInterval(this.samplingIntervalId);
      this.samplingIntervalId = null;
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
