# API Contract: Modulation Visualization

**Feature**: 002-realtime-cv-visualization
**Date**: 2025-10-29
**Type**: Internal TypeScript API (not REST/HTTP)

This document defines the TypeScript interfaces and method signatures for the modulation visualization system.

---

## Core Interfaces

### IModulationVisualizer

Main coordinator for CV parameter visualization.

```typescript
interface IModulationVisualizer {
  /**
   * Initialize the visualization system
   * @param config - Configuration for visualization behavior
   * @throws Error if AudioContext not available or SharedArrayBuffer not supported
   */
  initialize(config: VisualizationConfig): Promise<void>;

  /**
   * Register a parameter control for modulation visualization
   * @param parameterId - Unique parameter identifier (format: componentId:parameterName)
   * @param control - UI control instance (Knob/Slider/Button)
   * @returns Visualization handle for cleanup
   */
  trackParameter(parameterId: string, control: IVisualizableControl): VisualizationHandle;

  /**
   * Unregister a parameter control
   * @param parameterId - Parameter identifier to stop tracking
   */
  untrackParameter(parameterId: string): void;

  /**
   * Notify visualizer of new CV connection
   * @param connection - CV connection being created
   */
  onConnectionCreated(connection: Connection): void;

  /**
   * Notify visualizer of CV connection removal
   * @param connectionId - Connection identifier being destroyed
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
   * @param parameterId - Parameter identifier
   * @returns Current modulation state or null if not tracked
   */
  getModulationState(parameterId: string): ModulationState | null;
}
```

---

### IVisualizableControl

Interface that UI controls must implement to receive modulation updates.

```typescript
interface IVisualizableControl {
  /**
   * Get unique control identifier
   */
  getControlId(): string;

  /**
   * Update visual state to reflect modulated value
   * @param normalizedValue - Value in range [0, 1]
   */
  setVisualValue(normalizedValue: number): void;

  /**
   * Get current visibility state
   * @returns true if control is in viewport and should be rendered
   */
  isVisible(): boolean;

  /**
   * Set visibility state (called by IntersectionObserver)
   * @param visible - Whether control is currently visible
   */
  setVisibility(visible: boolean): void;

  /**
   * Get the parameter this control is linked to
   */
  getParameter(): Parameter;
}
```

**Implementation Note**: Existing Knob, Slider, Button classes will be modified to implement this interface.

---

### IParameterValueSampler

Samples parameter values from audio thread at fixed rate.

```typescript
interface IParameterValueSampler {
  /**
   * Initialize sampler with audio context and shared buffer
   * @param audioContext - Web Audio API context
   * @param sharedBuffer - SharedArrayBuffer for communication
   * @param samplingRate - Rate at which to sample parameters (Hz)
   */
  initialize(
    audioContext: AudioContext,
    sharedBuffer: SharedArrayBuffer,
    samplingRate: number
  ): Promise<void>;

  /**
   * Register a parameter for sampling
   * @param parameterId - Unique parameter identifier
   * @param audioParam - Web Audio API AudioParam to sample
   * @returns Index in shared buffer where values are written
   */
  registerParameter(parameterId: string, audioParam: AudioParam): number;

  /**
   * Unregister a parameter from sampling
   * @param parameterId - Parameter identifier to stop sampling
   */
  unregisterParameter(parameterId: string): void;

  /**
   * Get current sampled value from shared buffer
   * @param parameterId - Parameter identifier
   * @returns Normalized value [0-1] or null if not registered
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
```

---

### IVisualUpdateScheduler

Schedules UI updates at target frame rate with interpolation.

```typescript
interface IVisualUpdateScheduler {
  /**
   * Initialize scheduler with target frame rate
   * @param targetFPS - Desired frames per second (typically 60)
   * @param interpolationEnabled - Whether to interpolate between samples
   */
  initialize(targetFPS: number, interpolationEnabled: boolean): void;

  /**
   * Register a callback to be called on each frame
   * @param callback - Function to call with elapsed time delta
   * @returns Subscription handle for unsubscribing
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
```

---

## Data Types

### ModulationState

```typescript
interface ModulationState {
  readonly parameterId: string;
  baseValue: number;
  modulatedValue: number;
  normalizedValue: number;
  isModulated: boolean;
  modulationSources: string[];
  lastUpdateTimestamp: number;
}
```

### VisualizationConfig

```typescript
interface VisualizationConfig {
  samplingRate: number;          // Default: 20 Hz
  renderRate: number;             // Default: 60 FPS
  interpolationEnabled: boolean;  // Default: true
  offscreenPauseEnabled: boolean; // Default: true
  transitionDuration: number;     // Default: 100 ms
  maxTrackedParameters: number;   // Default: 32
}
```

### ParameterVisualization

```typescript
interface ParameterVisualization {
  readonly controlId: string;
  readonly parameterId: string;
  readonly controlType: 'knob' | 'slider' | 'button';
  isVisible: boolean;
  lastRenderedValue: number;
  interpolationProgress: number;
  targetValue: number;
}
```

### CVConnectionState

```typescript
type ConnectionLifecycleState = 'connecting' | 'connected' | 'disconnecting' | 'disconnected';

interface CVConnectionState {
  readonly connectionId: string;
  readonly sourceComponentId: string;
  readonly targetParameterId: string;
  state: ConnectionLifecycleState;
  fadeProgress: number;           // 0-1
  modulationDepth: number;        // -1 to 1
  readonly createdAt: number;
  transitionStartTime: number | null;
}
```

### Handle Types

```typescript
/**
 * Handle for tracked parameter visualization
 * Call dispose() to stop tracking
 */
interface VisualizationHandle {
  readonly parameterId: string;
  dispose(): void;
}

/**
 * Handle for frame callback subscription
 * Call unsubscribe() to stop receiving callbacks
 */
interface SubscriptionHandle {
  unsubscribe(): void;
}
```

---

## Events

### ModulationEvents

Events emitted via EventBus for modulation state changes.

```typescript
enum ModulationEventType {
  PARAMETER_VALUE_CHANGED = 'modulation:parameter:changed',
  CONNECTION_CREATED = 'modulation:connection:created',
  CONNECTION_DESTROYED = 'modulation:connection:destroyed',
  FADE_STARTED = 'modulation:fade:started',
  FADE_COMPLETED = 'modulation:fade:completed',
}

interface ParameterValueChangedEvent {
  type: ModulationEventType.PARAMETER_VALUE_CHANGED;
  parameterId: string;
  oldValue: number;
  newValue: number;
  timestamp: number;
}

interface ConnectionCreatedEvent {
  type: ModulationEventType.CONNECTION_CREATED;
  connectionId: string;
  sourceComponentId: string;
  targetParameterId: string;
  timestamp: number;
}

interface ConnectionDestroyedEvent {
  type: ModulationEventType.CONNECTION_DESTROYED;
  connectionId: string;
  targetParameterId: string;
  timestamp: number;
}

interface FadeEvent {
  type: ModulationEventType.FADE_STARTED | ModulationEventType.FADE_COMPLETED;
  connectionId: string;
  direction: 'in' | 'out';
  timestamp: number;
}
```

**Usage**:
```typescript
eventBus.on(ModulationEventType.PARAMETER_VALUE_CHANGED, (event: ParameterValueChangedEvent) => {
  console.log(`Parameter ${event.parameterId} changed: ${event.oldValue} → ${event.newValue}`);
});
```

---

## Error Handling

### ModulationVisualizerError

```typescript
enum ModulationErrorCode {
  INITIALIZATION_FAILED = 'INIT_FAILED',
  SHARED_BUFFER_NOT_SUPPORTED = 'SHARED_BUFFER_UNSUPPORTED',
  AUDIO_CONTEXT_UNAVAILABLE = 'AUDIO_CONTEXT_UNAVAILABLE',
  PARAMETER_NOT_FOUND = 'PARAMETER_NOT_FOUND',
  MAX_PARAMETERS_EXCEEDED = 'MAX_PARAMETERS_EXCEEDED',
  INVALID_CONNECTION_STATE = 'INVALID_CONNECTION_STATE',
}

class ModulationVisualizerError extends Error {
  constructor(
    public readonly code: ModulationErrorCode,
    message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'ModulationVisualizerError';
  }
}
```

**Error Handling Contract**:
- All async methods may throw `ModulationVisualizerError`
- Initialization errors must be caught and handled gracefully (disable feature)
- Runtime errors (e.g., parameter not found) should be logged but not crash app
- Invalid state transitions log warnings but attempt recovery

---

## Performance Contracts

### Guaranteed Performance Characteristics

1. **Sampling Rate**: 20 Hz (50ms between samples) ± 5ms
   - Enforced by AudioWorklet scheduling
   - Measured via `lastUpdateTimestamp` deltas

2. **Render Rate**: Target 60 FPS (16.67ms per frame)
   - Actual rate may vary based on browser/hardware
   - Measured via `getCurrentFPS()` method

3. **Update Latency**: < 50ms from CV change to visual update
   - Sampling: 0-50ms (worst case: just missed sample)
   - Propagation: < 1ms (SharedArrayBuffer read)
   - Render: 0-16ms (worst case: just missed frame)
   - Total: typically 25-30ms, max 67ms

4. **Memory Footprint**: ~10KB for 32 parameters
   - SharedArrayBuffer: 128 bytes (32 floats)
   - State objects: ~300 bytes per parameter
   - Handles/subscriptions: ~50 bytes per control

### Non-Blocking Guarantees

- **Audio Thread**: Sampling takes < 10μs per parameter (negligible overhead)
- **Main Thread**: Reading 32 parameters takes < 50μs total
- **Rendering**: Skipped for off-screen controls (zero cost when hidden)

---

## Usage Examples

### Example 1: Tracking a Knob

```typescript
// Initialize system
const visualizer = new ModulationVisualizer();
await visualizer.initialize({
  samplingRate: 20,
  renderRate: 60,
  interpolationEnabled: true,
  offscreenPauseEnabled: true,
  transitionDuration: 100,
  maxTrackedParameters: 32,
});

// Create knob and track it
const knob = new Knob(x, y, size, parameter);
const handle = visualizer.trackParameter(
  `oscillator-1:detune`,
  knob
);

// Knob will now automatically update when CV modulates detune

// Later: stop tracking
handle.dispose();
```

### Example 2: Creating CV Connection with Fade

```typescript
// User creates connection in UI
const connection = connectionManager.createConnection(
  lfo.id,
  'output',
  oscillator.id,
  'detune'
);

// Notify visualizer
visualizer.onConnectionCreated(connection);

// Visualizer handles:
// 1. Creating CVConnectionState (state='connecting')
// 2. Starting 100ms fade-in
// 3. Transitioning to 'connected' when complete
// 4. Visual updates happen automatically
```

### Example 3: Listening for Modulation Events

```typescript
eventBus.on(
  ModulationEventType.PARAMETER_VALUE_CHANGED,
  (event: ParameterValueChangedEvent) => {
    if (Math.abs(event.newValue - event.oldValue) > 0.1) {
      console.log(`Significant change in ${event.parameterId}`);
    }
  }
);
```

---

## Testing Contracts

**Note**: Testing infrastructure does not currently exist, but these contracts define expected behavior:

### Unit Test Contracts

1. `ModulationState.modulatedValue` must always be clamped to [min, max]
2. `ParameterVisualization.interpolationProgress` must increment from 0 to 1 over time
3. `CVConnectionState` state transitions must follow defined state machine
4. `VisualizationConfig` validation must reject out-of-range values

### Integration Test Contracts

1. Creating CV connection must result in `CONNECTION_CREATED` event
2. Parameter value changes must propagate to UI within 50ms
3. Destroying connection must fade out over exactly 100ms (±10ms)
4. Off-screen controls must not call `render()` when `isVisible=false`

### Performance Test Contracts

1. 32 parameters must update at 20 Hz without frame drops
2. Main thread time per frame must be < 5ms for 32 parameters
3. Memory usage must not increase over 10-minute test (no leaks)
4. Audio glitching must not occur during visualization (measure via AnalyserNode)
