/**
 * Types and interfaces for CV parameter visualization system
 */

import { Parameter } from '../components/base/Parameter';
import { Connection } from '../core/Connection';

// Re-export types
export type { Connection };

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Main coordinator for CV parameter visualization
 */
export interface IModulationVisualizer {
  /**
   * Initialize the visualization system
   */
  initialize(config: VisualizationConfig): Promise<void>;

  /**
   * Register a parameter control for modulation visualization
   */
  trackParameter(parameterId: string, control: IVisualizableControl): VisualizationHandle;

  /**
   * Unregister a parameter control
   */
  untrackParameter(parameterId: string): void;

  /**
   * Notify visualizer of new CV connection
   */
  onConnectionCreated(connection: Connection): void;

  /**
   * Notify visualizer of CV connection removal
   */
  onConnectionDestroyed(connectionId: string): void;

  /**
   * Start the visualization update loop
   */
  start(): void;

  /**
   * Stop the visualization update loop
   */
  stop(): void;

  /**
   * Clean up all resources
   */
  dispose(): void;

  /**
   * Get current modulation state for a parameter
   */
  getModulationState(parameterId: string): ModulationState | null;
}

/**
 * Interface that UI controls must implement to receive modulation updates
 */
export interface IVisualizableControl {
  /**
   * Get unique control identifier
   */
  getControlId(): string;

  /**
   * Update visual state to reflect modulated value
   */
  setVisualValue(normalizedValue: number): void;

  /**
   * Get current visibility state
   */
  isVisible(): boolean;

  /**
   * Set visibility state (called by IntersectionObserver)
   */
  setVisibility(visible: boolean): void;

  /**
   * Get the parameter this control is linked to
   */
  getParameter(): Parameter;
}

/**
 * Samples parameter values from audio thread at fixed rate
 */
export interface IParameterValueSampler {
  /**
   * Initialize sampler with audio context and shared buffer
   */
  initialize(
    audioContext: AudioContext,
    sharedBuffer: SharedArrayBuffer,
    samplingRate: number
  ): Promise<void>;

  /**
   * Register a parameter for sampling
   */
  registerParameter(parameterId: string, audioParam: AudioParam): number;

  /**
   * Unregister a parameter from sampling
   */
  unregisterParameter(parameterId: string): void;

  /**
   * Get current sampled value from shared buffer
   */
  getValue(parameterId: string): number | null;

  /**
   * Start sampling loop in AudioWorklet
   */
  start(): void;

  /**
   * Stop sampling loop
   */
  stop(): void;

  /**
   * Clean up resources
   */
  dispose(): void;
}

/**
 * Schedules UI updates at target frame rate with interpolation
 */
export interface IVisualUpdateScheduler {
  /**
   * Initialize scheduler with target frame rate
   */
  initialize(targetFPS: number, interpolationEnabled: boolean): void;

  /**
   * Register a callback to be called on each frame
   */
  onFrame(callback: (deltaMs: number) => void): SubscriptionHandle;

  /**
   * Start the update loop
   */
  start(): void;

  /**
   * Stop the update loop
   */
  stop(): void;

  /**
   * Get current frame rate (actual, not target)
   */
  getCurrentFPS(): number;
}

// ============================================================================
// Data Types
// ============================================================================

/**
 * Current modulation status of a parameter
 */
export interface ModulationState {
  readonly parameterId: string;
  baseValue: number;
  currentValue: number;
  normalizedValue: number;
  isModulated: boolean;
}

/**
 * Configuration for modulation visualization behavior
 */
export interface VisualizationConfig {
  audioContext: AudioContext;
  samplingRate?: number;          // Default: 20 Hz
  targetFPS?: number;             // Default: 60 FPS
  interpolationEnabled?: boolean;  // Default: true
  fadeDuration?: number;          // Default: 300 ms
  updateThreshold?: number;       // Minimum change to trigger update
  maxParameters?: number;         // Default: 256
}

/**
 * Visualization state for a specific UI control
 */
export interface ParameterVisualization {
  readonly controlId: string;
  readonly parameterId: string;
  readonly controlType: 'knob' | 'slider' | 'button';
  isVisible: boolean;
  lastRenderedValue: number;
  interpolationProgress: number;
  targetValue: number;
}

/**
 * Connection lifecycle states
 */
export type ConnectionLifecycleState = 'connecting' | 'connected' | 'disconnecting' | 'disconnected';

/**
 * CV connection state tracking
 */
export interface CVConnectionState {
  readonly connectionId: string;
  readonly sourceComponentId: string;
  readonly targetParameterId: string;
  state: ConnectionLifecycleState;
  fadeProgress: number;           // 0-1
  modulationDepth: number;        // -1 to 1
  readonly createdAt: number;
  transitionStartTime: number | null;
}

// ============================================================================
// Handle Types
// ============================================================================

/**
 * Handle for tracked parameter visualization
 */
export interface VisualizationHandle {
  readonly parameterId: string;
  untrack: () => void;
}

/**
 * Handle for frame callback subscription
 */
export interface SubscriptionHandle {
  unsubscribe(): void;
}

// ============================================================================
// Events
// ============================================================================

/**
 * Modulation event types
 */
export enum ModulationEventType {
  PARAMETER_VALUE_CHANGED = 'modulation:parameter:changed',
  CONNECTION_CREATED = 'modulation:connection:created',
  CONNECTION_DESTROYED = 'modulation:connection:destroyed',
  FADE_STARTED = 'modulation:fade:started',
  FADE_COMPLETED = 'modulation:fade:completed',
}

/**
 * Parameter value changed event
 */
export interface ParameterValueChangedEvent {
  type: ModulationEventType.PARAMETER_VALUE_CHANGED;
  parameterId: string;
  oldValue: number;
  newValue: number;
  timestamp: number;
}

/**
 * Connection created event
 */
export interface ConnectionCreatedEvent {
  type: ModulationEventType.CONNECTION_CREATED;
  connectionId: string;
  sourceComponentId: string;
  targetParameterId: string;
  timestamp: number;
}

/**
 * Connection destroyed event
 */
export interface ConnectionDestroyedEvent {
  type: ModulationEventType.CONNECTION_DESTROYED;
  connectionId: string;
  targetParameterId: string;
  timestamp: number;
}

/**
 * Fade event
 */
export interface FadeEvent {
  type: ModulationEventType.FADE_STARTED | ModulationEventType.FADE_COMPLETED;
  connectionId: string;
  direction: 'in' | 'out';
  timestamp: number;
}

/**
 * Union type for all modulation events
 */
export type ModulationEvent =
  | ParameterValueChangedEvent
  | ConnectionCreatedEvent
  | ConnectionDestroyedEvent
  | FadeEvent;

// ============================================================================
// Errors
// ============================================================================

/**
 * Error codes for modulation visualizer
 */
export enum ModulationErrorCode {
  INITIALIZATION_FAILED = 'INIT_FAILED',
  SHARED_BUFFER_NOT_SUPPORTED = 'SHARED_BUFFER_UNSUPPORTED',
  AUDIO_CONTEXT_UNAVAILABLE = 'AUDIO_CONTEXT_UNAVAILABLE',
  PARAMETER_NOT_FOUND = 'PARAMETER_NOT_FOUND',
  MAX_PARAMETERS_EXCEEDED = 'MAX_PARAMETERS_EXCEEDED',
  INVALID_CONNECTION_STATE = 'INVALID_CONNECTION_STATE',
}

/**
 * Custom error for modulation visualizer
 */
export class ModulationVisualizerError extends Error {
  constructor(
    public readonly code: ModulationErrorCode,
    message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'ModulationVisualizerError';
  }
}
