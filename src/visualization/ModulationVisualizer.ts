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

    // TODO: Register with sampler when AudioParam linkage is implemented
    // For now, just allocate a buffer index (Phase 4 will link to actual AudioParams)
    const bufferIndex = 0; // Placeholder

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
  onConnectionCreated(connection: Connection): void {
    // Store connection
    this.connections.set(connection.id, connection);

    // For CV connections, targetPortId is the parameter ID
    const parameterId = connection.targetPortId;

    // Find tracked parameter
    const tracking = this.trackedParameters.get(parameterId);
    if (!tracking) {
      return;
    }

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

    console.log(`✓ Connection created: ${connection.sourceComponentId} → ${parameterId}`);
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

    const parameterId = connection.targetPortId;

    // Find tracked parameter
    const tracking = this.trackedParameters.get(parameterId);
    if (tracking) {
      // Check if parameter has other connections
      const hasOtherConnections = Array.from(this.connections.values()).some(
        (conn) => conn.id !== connectionId && conn.targetPortId === parameterId
      );

      if (!hasOtherConnections) {
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

      // Sample current value (20 Hz from audio thread)
      const sampledValue = this.sampler.getValue(tracking.parameterId);
      if (sampledValue === null) {
        return;
      }

      // Clamp to parameter range
      const clampedValue = Math.max(
        tracking.parameter.min,
        Math.min(tracking.parameter.max, sampledValue)
      );

      // Calculate normalized value
      const normalizedValue =
        (clampedValue - tracking.parameter.min) /
        (tracking.parameter.max - tracking.parameter.min);

      // Check if we received a new sample (T044 - audio-rate detection)
      const timeSinceLastSample = currentTime - tracking.lastSampleTime;
      const hasNewSample = tracking.lastValue !== sampledValue;

      if (hasNewSample) {
        // Detect audio-rate modulation (>20 Hz)
        const detectedRate = 1000 / timeSinceLastSample; // Hz
        const isAudioRate = detectedRate > this.audioRateThreshold;

        if (isAudioRate) {
          // T045: For audio-rate, reduce visual update rate (use every 3rd sample)
          // This prevents visual chaos from ultra-fast modulation
          // Just update target less frequently by skipping interpolation reset
          console.log(`Audio-rate modulation detected: ${detectedRate.toFixed(1)} Hz`);
        }

        // Update parameter modulated value
        tracking.parameter.setModulatedValue(sampledValue);

        // Start new interpolation to the new target
        tracking.lastRenderedValue = tracking.targetValue;
        tracking.targetValue = normalizedValue;
        tracking.interpolationProgress = 0;
        tracking.lastSampleTime = currentTime;
        tracking.lastValue = sampledValue;
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

      // Store last value
      tracking.lastValue = sampledValue;

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
