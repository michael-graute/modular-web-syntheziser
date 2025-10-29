/**
 * ModulationVisualizer - Main orchestrator for realtime CV visualization
 * Coordinates sampling, scheduling, and visual updates for modulated parameters
 */

import { Parameter } from '../components/base/Parameter';
import { eventBus } from '../core/EventBus';
import {
  IModulationVisualizer,
  IVisualizableControl,
  VisualizationConfig,
  VisualizationHandle,
  ModulationState,
  ModulationEventType,
  Connection,
} from './types';
import { ParameterValueSampler } from './ParameterValueSampler';
import { VisualUpdateScheduler } from './VisualUpdateScheduler';

interface ParameterTracking {
  parameterId: string;
  parameter: Parameter;
  control: IVisualizableControl;
  bufferIndex: number;
  lastValue: number | null;
  isConnected: boolean;
  fadeProgress: number; // 0-1 for fade in/out
  fadeDirection: 'in' | 'out' | null;
  // Interpolation state (T038)
  lastRenderedValue: number;
  targetValue: number;
  interpolationProgress: number; // 0-1
  lastSampleTime: number; // timestamp of last sample
}

export class ModulationVisualizer implements IModulationVisualizer {
  private sampler: ParameterValueSampler;
  private scheduler: VisualUpdateScheduler;
  private trackedParameters: Map<string, ParameterTracking> = new Map();
  private connections: Map<string, Connection> = new Map();
  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  private schedulerHandle: { unsubscribe: () => void } | null = null;

  // Configuration
  private fadeDuration: number = 300; // ms
  private sharedBuffer: SharedArrayBuffer | null = null;
  private interpolationEnabled: boolean = true; // Enable interpolation for smooth 60 FPS
  private samplingInterval: number = 50; // 20 Hz = 50ms between samples
  private audioRateThreshold: number = 20; // Hz - detect audio-rate modulation
  private audioContext: AudioContext | null = null;

  constructor() {
    this.sampler = new ParameterValueSampler();
    this.scheduler = new VisualUpdateScheduler();
  }

  /**
   * Linear interpolation helper (T037)
   * @param start - Start value
   * @param end - End value
   * @param progress - Progress from 0 to 1
   * @returns Interpolated value
   */
  private lerp(start: number, end: number, progress: number): number {
    return start + (end - start) * progress;
  }

  /**
   * Initialize the visualizer
   */
  async initialize(config: VisualizationConfig): Promise<void> {
    if (this.isInitialized) {
      console.warn('ModulationVisualizer already initialized');
      return;
    }

    try {
      // Store audio context
      this.audioContext = config.audioContext;

      // Create shared buffer (allocate space for max parameters)
      // Use Int32Array for Atomics support
      const maxParameters = config.maxParameters || 256;
      this.sharedBuffer = new SharedArrayBuffer(maxParameters * Int32Array.BYTES_PER_ELEMENT);

      // Initialize sampler
      await this.sampler.initialize(
        config.audioContext,
        this.sharedBuffer,
        config.samplingRate || 20
      );

      // Initialize scheduler
      this.scheduler.initialize(config.targetFPS || 60, config.interpolationEnabled !== false);

      this.fadeDuration = config.fadeDuration || 300;

      this.isInitialized = true;
      console.log('✓ ModulationVisualizer initialized');
    } catch (error) {
      console.error('Failed to initialize ModulationVisualizer:', error);
      throw error;
    }
  }

  /**
   * Track a parameter for visualization
   */
  trackParameter(parameterId: string, control: IVisualizableControl): VisualizationHandle {
    if (!this.isInitialized) {
      throw new Error('ModulationVisualizer not initialized');
    }

    // Check if already tracked
    if (this.trackedParameters.has(parameterId)) {
      console.warn(`Parameter "${parameterId}" already tracked`);
      return {
        parameterId,
        untrack: () => this.untrackParameter(parameterId),
      };
    }

    // Get parameter from control
    const parameter = control.getParameter();

    // Get AudioParam for sampling
    const audioParam = parameter.getAudioParam();
    if (!audioParam) {
      console.warn(
        `Parameter "${parameterId}" has no linked AudioParam - visualization will not work`
      );
      // Still track it, but it won't update
    }

    // Register with sampler
    const bufferIndex = audioParam
      ? this.sampler.registerParameter(parameterId, audioParam)
      : 0;

    // Create tracking entry with interpolation state
    const initialValue = parameter.getNormalizedValue();
    const tracking: ParameterTracking = {
      parameterId,
      parameter,
      control,
      bufferIndex,
      lastValue: null,
      isConnected: false,
      fadeProgress: 0,
      fadeDirection: null,
      // Interpolation state (T038)
      lastRenderedValue: initialValue,
      targetValue: initialValue,
      interpolationProgress: 1.0, // Start fully interpolated
      lastSampleTime: performance.now(),
    };

    this.trackedParameters.set(parameterId, tracking);

    console.log(`✓ Tracking parameter "${parameterId}"`);

    return {
      parameterId,
      untrack: () => this.untrackParameter(parameterId),
    };
  }

  /**
   * Stop tracking a parameter
   */
  untrackParameter(parameterId: string): void {
    const tracking = this.trackedParameters.get(parameterId);
    if (!tracking) {
      console.warn(`Parameter "${parameterId}" not tracked`);
      return;
    }

    // Unregister from sampler
    this.sampler.unregisterParameter(parameterId);

    // Remove tracking
    this.trackedParameters.delete(parameterId);

    console.log(`✓ Untracked parameter "${parameterId}"`);
  }

  /**
   * Handle connection created event
   */
  onConnectionCreated(data: any): void {
    const connection = data.connection;
    const sourceComponent = data.sourceComponent;

    // Store connection
    this.connections.set(connection.id, connection);

    // For CV connections, targetPortId is the parameter ID
    // Some components use a "_cv" suffix for CV input ports (e.g., "cutoff_cv")
    // Try the exact port ID first, then try without "_cv" suffix
    let parameterId = connection.targetPortId;
    let tracking = this.trackedParameters.get(parameterId);

    if (!tracking && parameterId.endsWith('_cv')) {
      // Try without the "_cv" suffix
      const baseParameterId = parameterId.slice(0, -3);
      tracking = this.trackedParameters.get(baseParameterId);
      if (tracking) {
        parameterId = baseParameterId;
      }
    }

    if (!tracking) {
      console.warn(`[ModViz] Parameter "${connection.targetPortId}" not tracked! Cannot visualize.`);
      return;
    }

    // Get the CV source output node
    const cvSourceNode = sourceComponent.getOutputNodeByPort(connection.sourcePortId);
    if (!cvSourceNode) {
      console.error(`[ModViz] Could not get CV source node for ${connection.sourceComponentId}:${connection.sourcePortId}`);
      return;
    }

    // Create an AnalyserNode to sample the CV signal
    if (!this.audioContext) {
      console.error(`[ModViz] Audio context not available`);
      return;
    }
    const analyserNode = this.audioContext.createAnalyser();
    analyserNode.fftSize = 32; // Minimum size for fast analysis
    const dataArray = new Float32Array(analyserNode.fftSize);

    // Connect CV source to analyser (in parallel with AudioParam connection)
    cvSourceNode.connect(analyserNode);

    // Store analyser info with tracking
    (tracking as any).cvAnalyser = analyserNode;
    (tracking as any).cvDataArray = dataArray;
    (tracking as any).cvConnectionId = connection.id;

    // Mark as connected and start fade-in
    tracking.isConnected = true;
    tracking.fadeDirection = 'in';
    tracking.fadeProgress = 0;

    // Update parameter state
    tracking.parameter.isModulated = true;

    // Emit event
    eventBus.emit(ModulationEventType.CONNECTION_CREATED, {
      connectionId: connection.id,
      parameterId: parameterId,
    });

    eventBus.emit(ModulationEventType.FADE_STARTED, {
      parameterId: parameterId,
      direction: 'in',
    });

    console.log(`✓ Connection created with CV analyser: ${connection.sourceComponentId} → ${parameterId}`);
  }

  /**
   * Handle connection destroyed event
   */
  onConnectionDestroyed(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.warn(`Connection "${connectionId}" not found`);
      return;
    }

    // Apply the same mapping logic as in onConnectionCreated
    // Try the exact port ID first, then try without "_cv" suffix
    let parameterId = connection.targetPortId;
    let tracking = this.trackedParameters.get(parameterId);

    if (!tracking && parameterId.endsWith('_cv')) {
      // Try without the "_cv" suffix
      const baseParameterId = parameterId.slice(0, -3);
      tracking = this.trackedParameters.get(baseParameterId);
      if (tracking) {
        parameterId = baseParameterId;
      }
    }

    if (tracking) {
      // Check if parameter has other connections
      // Need to check both the mapped parameter ID and the original port ID
      const hasOtherConnections = Array.from(this.connections.values()).some(
        (conn) => {
          if (conn.id === connectionId) return false;

          // Map the connection's target port ID the same way
          let otherParameterId = conn.targetPortId;
          if (!this.trackedParameters.has(otherParameterId) && otherParameterId.endsWith('_cv')) {
            otherParameterId = otherParameterId.slice(0, -3);
          }

          return otherParameterId === parameterId;
        }
      );

      if (!hasOtherConnections) {
        // Disconnect and cleanup analyser
        if ((tracking as any).cvAnalyser) {
          try {
            ((tracking as any).cvAnalyser as AnalyserNode).disconnect();
          } catch (e) {
            // Already disconnected
          }
          delete (tracking as any).cvAnalyser;
          delete (tracking as any).cvDataArray;
          delete (tracking as any).cvConnectionId;
        }

        // Start fade-out
        tracking.fadeDirection = 'out';
        tracking.fadeProgress = 1;

        eventBus.emit(ModulationEventType.FADE_STARTED, {
          parameterId: parameterId,
          direction: 'out',
        });

        console.log(`✓ Starting fade-out for parameter "${parameterId}"`);
      }
    }

    // Remove connection
    this.connections.delete(connectionId);

    // Emit event
    eventBus.emit(ModulationEventType.CONNECTION_DESTROYED, {
      connectionId: connectionId,
      parameterId: parameterId,
    });

    console.log(`✓ Connection destroyed: ${connectionId}`);
  }

  /**
   * Start visualization
   */
  start(): void {
    if (!this.isInitialized) {
      throw new Error('ModulationVisualizer not initialized');
    }

    if (this.isRunning) {
      console.warn('ModulationVisualizer already running');
      return;
    }

    // Start sampler
    this.sampler.start();

    // Subscribe to scheduler frames
    this.schedulerHandle = this.scheduler.onFrame((deltaMs) => {
      this.onFrame(deltaMs);
    });

    // Start scheduler
    this.scheduler.start();

    this.isRunning = true;
    console.log('✓ ModulationVisualizer started');
  }

  /**
   * Stop visualization
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    // Stop sampler
    this.sampler.stop();

    // Unsubscribe from scheduler
    if (this.schedulerHandle) {
      this.schedulerHandle.unsubscribe();
      this.schedulerHandle = null;
    }

    // Stop scheduler
    this.scheduler.stop();

    this.isRunning = false;
    console.log('✓ ModulationVisualizer stopped');
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.stop();

    // Clear all tracked parameters
    this.trackedParameters.clear();

    // Clear connections
    this.connections.clear();

    // Dispose components
    this.sampler.dispose();

    this.isInitialized = false;
    console.log('✓ ModulationVisualizer disposed');
  }

  /**
   * Get modulation state for a parameter
   */
  getModulationState(parameterId: string): ModulationState | null {
    const tracking = this.trackedParameters.get(parameterId);
    if (!tracking) {
      return null;
    }

    return {
      parameterId,
      isModulated: tracking.isConnected && tracking.fadeProgress > 0,
      currentValue: tracking.lastValue || tracking.parameter.getValue(),
      baseValue: tracking.parameter.baseValue,
      normalizedValue: tracking.lastValue
        ? (tracking.lastValue - tracking.parameter.min) /
          (tracking.parameter.max - tracking.parameter.min)
        : tracking.parameter.getNormalizedValue(),
    };
  }

  /**
   * Frame update callback with interpolation (T039, T040, T044)
   */
  private onFrame(deltaMs: number): void {
    const currentTime = performance.now();

    // Update all tracked parameters
    this.trackedParameters.forEach((tracking) => {
      // Update fade progress
      if (tracking.fadeDirection) {
        const fadeStep = deltaMs / this.fadeDuration;

        if (tracking.fadeDirection === 'in') {
          tracking.fadeProgress = Math.min(1, tracking.fadeProgress + fadeStep);
          if (tracking.fadeProgress >= 1) {
            tracking.fadeDirection = null;
            eventBus.emit(ModulationEventType.FADE_COMPLETED, {
              parameterId: tracking.parameterId,
              direction: 'in',
            });
          }
        } else {
          tracking.fadeProgress = Math.max(0, tracking.fadeProgress - fadeStep);
          if (tracking.fadeProgress <= 0) {
            tracking.fadeDirection = null;
            tracking.isConnected = false;
            tracking.parameter.isModulated = false;
            eventBus.emit(ModulationEventType.FADE_COMPLETED, {
              parameterId: tracking.parameterId,
              direction: 'out',
            });
          }
        }
      }

      // Skip if not visible (FR-011)
      if (!tracking.control.isVisible()) {
        return;
      }

      // Skip if not connected and fade complete
      if (!tracking.isConnected && tracking.fadeProgress === 0) {
        return;
      }

      // Sample CV modulation value if available
      let modulatedValue: number;

      if ((tracking as any).cvAnalyser && (tracking as any).cvDataArray) {
        // Sample from CV AnalyserNode
        const analyser = (tracking as any).cvAnalyser as AnalyserNode;
        const dataArray = (tracking as any).cvDataArray as Float32Array;

        // Get time domain data (actual waveform values)
        analyser.getFloatTimeDomainData(dataArray as Float32Array<ArrayBuffer>);

        // Take the first sample (all samples in a small buffer are roughly the same at 20Hz)
        const cvValue = dataArray[0] || 0;


        // Get base value from AudioParam (not Parameter object) for accurate modulation display
        const audioParam = tracking.parameter.getAudioParam();
        const baseValue = audioParam ? audioParam.value : tracking.parameter.baseValue;
        modulatedValue = baseValue + cvValue;

      } else {
        // No CV connection, use base parameter value
        modulatedValue = tracking.parameter.getValue();
      }

      // Clamp to parameter range FIRST
      const clampedValue = Math.max(
        tracking.parameter.min,
        Math.min(tracking.parameter.max, modulatedValue)
      );

      // Calculate normalized value (0 to 1)
      // Handle case where min === max to avoid division by zero
      const range = tracking.parameter.max - tracking.parameter.min;
      let normalizedValue = range > 0
        ? (clampedValue - tracking.parameter.min) / range
        : 0.5;

      // VISUAL ENHANCEMENT: For parameters with very large ranges (>1000),
      // apply a "zoom" factor to make CV modulation more visible
      // This is purely for visual feedback - it doesn't affect the actual audio
      if (range > 1000 && (tracking as any).cvAnalyser) {
        // Get the base parameter value (where the knob was manually set)
        const baseNormalized = (tracking.parameter.baseValue - tracking.parameter.min) / range;

        // Calculate the modulation delta from base
        const modulationDelta = normalizedValue - baseNormalized;

        // Amplify the visual modulation by 20x for better visibility
        const amplifiedDelta = modulationDelta * 20;

        // Apply amplified modulation, clamped to 0-1 range
        normalizedValue = Math.max(0, Math.min(1, baseNormalized + amplifiedDelta));

      }

      // Check if we received a new sample (T044 - audio-rate detection)
      const timeSinceLastSample = currentTime - tracking.lastSampleTime;
      const hasNewSample = tracking.lastValue !== modulatedValue;

      if (hasNewSample) {
        // Detect audio-rate modulation (>20 Hz)
        const detectedRate = 1000 / timeSinceLastSample; // Hz
        const isAudioRate = detectedRate > this.audioRateThreshold;

        if (isAudioRate) {
          // T045: For audio-rate, reduce visual update rate (use every 3rd sample)
          // This prevents visual chaos from ultra-fast modulation
        }

        // Update parameter modulated value
        tracking.parameter.setModulatedValue(modulatedValue);

        // Start new interpolation to the new target
        tracking.lastRenderedValue = tracking.targetValue;
        tracking.targetValue = normalizedValue;
        tracking.interpolationProgress = 0;
        tracking.lastSampleTime = currentTime;
        tracking.lastValue = modulatedValue;
      }

      // T040: Update interpolation progress based on frame delta time
      // Interpolate from lastRenderedValue to targetValue
      if (this.interpolationEnabled && tracking.interpolationProgress < 1.0) {
        // Progress based on time elapsed since last sample
        const progressStep = deltaMs / this.samplingInterval;
        tracking.interpolationProgress = Math.min(
          1.0,
          tracking.interpolationProgress + progressStep
        );
      } else if (!this.interpolationEnabled) {
        // Skip interpolation if disabled
        tracking.interpolationProgress = 1.0;
      }

      // Calculate interpolated value using lerp (T037)
      const interpolatedValue = this.lerp(
        tracking.lastRenderedValue,
        tracking.targetValue,
        tracking.interpolationProgress
      );

      // Apply fade for connection transitions
      let visualValue: number;
      if (tracking.fadeProgress < 1) {
        // Blend between base value and modulated value during fade
        const baseNormalized = tracking.parameter.getNormalizedValue();
        visualValue =
          baseNormalized + (interpolatedValue - baseNormalized) * tracking.fadeProgress;
      } else {
        visualValue = interpolatedValue;
      }

      // Update control visual with smooth interpolated value
      tracking.control.setVisualValue(visualValue);

      // Emit change event
      eventBus.emit(ModulationEventType.PARAMETER_VALUE_CHANGED, {
        parameterId: tracking.parameterId,
        value: clampedValue,
        normalizedValue: visualValue,
      });
    });
  }

  /**
   * Get current FPS
   */
  getCurrentFPS(): number {
    return this.scheduler.getCurrentFPS();
  }

  /**
   * Get number of tracked parameters
   */
  getTrackedParameterCount(): number {
    return this.trackedParameters.size;
  }

  /**
   * Check if a parameter is tracked
   */
  isParameterTracked(parameterId: string): boolean {
    return this.trackedParameters.has(parameterId);
  }
}
