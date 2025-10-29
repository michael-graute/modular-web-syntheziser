# Data Model: Realtime CV Parameter Visualization

**Feature**: 002-realtime-cv-visualization
**Date**: 2025-10-29

## Entities

### ModulationState

Represents the current modulation status of a parameter, including base value and CV-modulated value.

**Fields**:
- `parameterId: string` - Unique identifier for the parameter (format: `{componentId}:{parameterName}`)
- `baseValue: number` - User-set base value (range: parameter's min-max)
- `modulatedValue: number` - Current value including CV modulation (range: parameter's min-max)
- `normalizedValue: number` - Normalized modulated value for UI (range: 0-1)
- `isModulated: boolean` - Whether parameter currently has active CV connections
- `modulationSources: string[]` - Array of CV source IDs affecting this parameter
- `lastUpdateTimestamp: number` - Timestamp of last value update (milliseconds)

**Relationships**:
- One-to-one with Parameter entity
- Many-to-many with CV Source entities (via modulationSources array)

**Validation Rules**:
- `modulatedValue` must be clamped to [parameter.min, parameter.max]
- `normalizedValue` must be in range [0, 1]
- `parameterId` must match pattern `/^[a-zA-Z0-9-]+:[a-zA-Z0-9-]+$/`
- `modulationSources` array must not contain duplicates

**State Transitions**:
```
IDLE (isModulated=false)
  → CV_CONNECTING (connection being established, fade-in starting)
  → MODULATED (isModulated=true, modulationSources.length > 0)
  → CV_DISCONNECTING (connection being removed, fade-out starting)
  → IDLE (isModulated=false)
```

---

### VisualizationConfig

Configuration for modulation visualization behavior, controlling update rates and visual smoothness.

**Fields**:
- `samplingRate: number` - Rate at which parameter values are sampled from audio thread (Hz, default: 20)
- `renderRate: number` - Target frame rate for UI updates (FPS, default: 60)
- `interpolationEnabled: boolean` - Whether to interpolate between samples (default: true)
- `offscreenPauseEnabled: boolean` - Whether to pause updates for off-screen controls (default: true)
- `transitionDuration: number` - Duration of connection fade in/out (milliseconds, default: 100)
- `maxTrackedParameters: number` - Maximum number of simultaneously visualized parameters (default: 32)

**Relationships**:
- Singleton configuration shared across ModulationVisualizer

**Validation Rules**:
- `samplingRate` must be in range [1, 60] Hz
- `renderRate` must be in range [20, 120] FPS
- `transitionDuration` must be in range [0, 1000] milliseconds
- `maxTrackedParameters` must be in range [1, 128]

**State Transitions**:
- Immutable after initialization (changes require restart)

---

### ParameterVisualization

Tracks visualization state for a specific UI control linked to a modulated parameter.

**Fields**:
- `controlId: string` - Unique identifier for the UI control (Knob/Slider/Button)
- `parameterId: string` - Foreign key to ModulationState.parameterId
- `controlType: 'knob' | 'slider' | 'button'` - Type of UI control
- `isVisible: boolean` - Whether control is currently in viewport
- `lastRenderedValue: number` - Last normalized value rendered (for interpolation)
- `interpolationProgress: number` - Progress through current interpolation (0-1)
- `targetValue: number` - Target normalized value for interpolation

**Relationships**:
- Many-to-one with ModulationState (multiple controls can visualize same parameter)
- One-to-one with UI Control (Knob/Slider/Button instance)

**Validation Rules**:
- `controlId` must be unique across all ParameterVisualization instances
- `lastRenderedValue`, `targetValue` must be in range [0, 1]
- `interpolationProgress` must be in range [0, 1]

**State Transitions**:
```
HIDDEN (isVisible=false)
  → VISIBLE (isVisible=true, start rendering)
  → HIDDEN (isVisible=false, pause rendering)

IDLE (no modulation)
  → INTERPOLATING (new target value, interpolationProgress 0→1)
  → IDLE (interpolationProgress = 1)
```

---

### CVConnectionState

Tracks the lifecycle state of a CV connection affecting parameter visualization.

**Fields**:
- `connectionId: string` - Unique identifier for the connection
- `sourceComponentId: string` - ID of CV source component (LFO, Envelope, etc.)
- `targetParameterId: string` - Foreign key to ModulationState.parameterId
- `state: 'connecting' | 'connected' | 'disconnecting' | 'disconnected'` - Connection lifecycle state
- `fadeProgress: number` - Progress through fade-in/fade-out (0-1)
- `modulationDepth: number` - Depth/amount of modulation (range: -1 to 1, default: 1)
- `createdAt: number` - Timestamp when connection was created
- `transitionStartTime: number | null` - Timestamp when fade transition began

**Relationships**:
- Many-to-one with ModulationState (parameter can have multiple CV sources)
- One-to-one with Connection entity (audio routing model)

**Validation Rules**:
- `state` must follow valid state machine transitions (see below)
- `fadeProgress` must be in range [0, 1]
- `modulationDepth` must be in range [-1, 1]
- `transitionStartTime` must be null when state is 'connected' or 'disconnected'

**State Transitions**:
```
disconnected
  → connecting (fadeProgress 0→1 over transitionDuration ms)
  → connected (fadeProgress = 1, transitionStartTime = null)
  → disconnecting (fadeProgress 1→0 over transitionDuration ms)
  → disconnected (fadeProgress = 0, transitionStartTime = null)
```

**Lifecycle**:
1. User creates CV connection in UI
2. CVConnectionState created with state='connecting', fadeProgress=0
3. Audio fade-in ramps over 100ms
4. Visual fade-in interpolates over same period
5. State transitions to 'connected' when complete
6. User destroys connection → state='disconnecting', fade-out begins
7. State returns to 'disconnected', entity can be garbage collected

---

## Relationships Diagram

```
┌─────────────────────┐
│   Parameter         │ (existing)
│  - id: string       │
│  - value: number    │
│  - min/max: number  │
└──────────┬──────────┘
           │ 1:1
           ↓
┌─────────────────────────────┐
│   ModulationState           │
│  - parameterId: string      │
│  - baseValue: number        │
│  - modulatedValue: number   │
│  - isModulated: boolean     │
│  - modulationSources: []    │
└──────────┬──────────────────┘
           │ 1:N
           ↓
┌─────────────────────────────┐          ┌──────────────────────┐
│  ParameterVisualization     │ N:1      │   UI Control         │ (existing)
│  - controlId: string        │◄─────────┤  - Knob              │
│  - parameterId: string      │          │  - Slider            │
│  - isVisible: boolean       │          │  - Button            │
│  - lastRenderedValue: num   │          └──────────────────────┘
└─────────────────────────────┘

┌─────────────────────┐
│   Connection        │ (existing)
│  - id: string       │
│  - sourceId: string │
│  - targetId: string │
└──────────┬──────────┘
           │ 1:1
           ↓
┌─────────────────────────────┐
│   CVConnectionState         │
│  - connectionId: string     │
│  - targetParameterId: str   │
│  - state: enum              │
│  - fadeProgress: number     │
└─────────────────────────────┘
           │ N:1
           ↓
┌─────────────────────────────┐
│   ModulationState           │
└─────────────────────────────┘
```

---

## Data Flow

### 1. Parameter Modulation Update Flow

```
[Audio Thread: AudioWorklet]
  Parameter value changes (CV modulation applied)
    ↓
  Sample parameter.value every 50ms (20 Hz)
    ↓
  Write normalized value to SharedArrayBuffer[paramIndex]
    ↓
[Main Thread: ModulationVisualizer]
  requestAnimationFrame @ 60 FPS
    ↓
  Read all parameter values from SharedArrayBuffer
    ↓
  Update ModulationState.modulatedValue
    ↓
  For each ParameterVisualization:
    - Calculate interpolated value
    - Check isVisible
    - Call control.setVisualValue(interpolated)
    ↓
[UI Control: Knob/Slider/Button]
  Update visual position
  Redraw on canvas
```

### 2. CV Connection Creation Flow

```
[User Action]
  Create CV connection in UI
    ↓
[ConnectionManager]
  Validate connection
  Create Connection entity
    ↓
[ModulationVisualizer]
  Create CVConnectionState (state='connecting')
  Set transitionStartTime = now
    ↓
[Audio Thread]
  Apply exponentialRampToValueAtTime (100ms fade-in)
    ↓
[Main Thread: Update Loop]
  Check CVConnectionState.fadeProgress
  Update from transitionStartTime/duration
  When fadeProgress >= 1:
    - Set state='connected'
    - Add sourceId to ModulationState.modulationSources
    - Set ModulationState.isModulated=true
```

### 3. Off-screen Visibility Flow

```
[Browser]
  IntersectionObserver triggers
    ↓
[ParameterVisualization]
  Update isVisible boolean
    ↓
[Update Loop]
  if isVisible:
    call control.render()
  else:
    skip rendering (still update state)
```

---

## Storage Considerations

**In-Memory Only**: All ModulationState and ParameterVisualization data is ephemeral (runtime only).

**Persistence Not Required**:
- Modulation states reset when patch is loaded
- CV connections are persisted via Connection entity (already serialized)
- Visualization state rebuilt from active connections on load

**Memory Footprint**:
- ModulationState: ~120 bytes per parameter
- ParameterVisualization: ~80 bytes per control
- CVConnectionState: ~100 bytes per connection
- SharedArrayBuffer: 4 bytes × maxTrackedParameters (128 bytes for 32 params)
- **Total for 32 params**: ~10KB

---

## Validation & Constraints Summary

### Global Constraints
- Maximum 32 simultaneously visualized parameters (SharedArrayBuffer size limit)
- Sampling rate fixed at 20 Hz (performance vs smoothness tradeoff)
- Render rate targets 60 FPS (browser vsync dependent)

### Parameter-Level Constraints
- Modulated values always clamped to [min, max] (FR-006)
- Normalized values always in [0, 1] (for UI consistency)
- Fade transitions exactly 100ms (SC-006)

### Edge Case Handling
- Out-of-range CV values → clamp to parameter bounds
- Audio-rate modulation (>20 Hz) → reduce visual update rate to perceptible
- Off-screen controls → pause rendering, continue state tracking
- Manual adjustment during modulation → update base value, CV continues relative
- Multiple CV sources → sum modulationDepth values, clamp final result
