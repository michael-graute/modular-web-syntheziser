/**
 * AudioWorklet processor for sampling CV-modulated parameter values
 * Runs in audio thread, samples at 20 Hz and writes to SharedArrayBuffer
 */

class ParameterSamplerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    // SharedArrayBuffer passed from main thread - Use Int32Array for Atomics
    this.sharedBuffer = new Int32Array(options.processorOptions.sharedBuffer);

    // Sampling rate: 20 Hz
    this.samplingRate = options.processorOptions.samplingRate || 20;

    // Calculate sample interval (e.g., 48000 / 20 = 2400 samples between each update)
    this.sampleInterval = Math.floor(sampleRate / this.samplingRate);
    this.sampleCounter = 0;

    // Map of parameterId → buffer index
    this.parameterMap = new Map();

    // Listen for messages from main thread
    this.port.onmessage = (event) => this.handleMessage(event.data);

    // Scaling factor for float-to-int conversion (10000 = 4 decimal places)
    this.scaleFactor = 10000;

    console.log(`[ParameterSampler] Initialized with ${this.samplingRate}Hz sampling (interval: ${this.sampleInterval} samples)`);
  }

  /**
   * Handle messages from main thread
   */
  handleMessage(data) {
    switch (data.type) {
      case 'register':
        // Register parameter for sampling
        this.parameterMap.set(data.parameterId, data.bufferIndex);
        console.log(`[ParameterSampler] Registered parameter ${data.parameterId} at index ${data.bufferIndex}`);
        break;

      case 'unregister':
        // Unregister parameter
        this.parameterMap.delete(data.parameterId);
        console.log(`[ParameterSampler] Unregistered parameter ${data.parameterId}`);
        break;

      case 'updateParam':
        // Update AudioParam reference (for dynamic connections)
        // Note: AudioParams are not directly transferable, so we handle them via indices
        break;
    }
  }

  /**
   * Audio processing callback
   * Called at audio rate (typically 48kHz)
   */
  process(inputs, outputs, parameters) {
    this.sampleCounter++;

    // Only sample at the target rate (20 Hz)
    if (this.sampleCounter >= this.sampleInterval) {
      this.sampleCounter = 0;

      // Sample all registered parameters
      for (const [parameterId, bufferIndex] of this.parameterMap) {
        // Note: In a real implementation, we'd need to access the actual AudioParam values
        // This would typically require the parameters to be passed as processor parameters
        // For now, we'll read from the parameters object if available
        if (parameters[parameterId] && parameters[parameterId].length > 0) {
          const value = parameters[parameterId][0]; // Get first sample

          // Convert float to scaled integer for Atomics (Int32Array only)
          const scaledValue = Math.round(value * this.scaleFactor);

          // Write to SharedArrayBuffer using Atomics for thread safety
          Atomics.store(this.sharedBuffer, bufferIndex, scaledValue);
        }
      }
    }

    // Keep processor alive
    return true;
  }
}

// Register the processor
registerProcessor('parameter-sampler', ParameterSamplerProcessor);
