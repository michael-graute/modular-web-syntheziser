# Data Model: Collider Musical Physics Component

**Feature**: `006-collider-musical-physics`
**Created**: 2025-11-07
**TypeScript Target**: 5.6+, ES2020
**Status**: Design Phase

---

## Overview

This document defines all TypeScript types, interfaces, and enums for the Collider Musical Physics component. The data model supports:

- 2D physics simulation with elastic collisions
- Musical scale mapping and CV output generation
- User configuration with validation
- State persistence via PatchSerializer
- Real-time collision detection and response

All definitions follow TypeScript 5.6+ conventions and integrate with existing codebase patterns from `/home/mgraute/ai-testing/src/core/types.ts`.

---

## Table of Contents

1. [Core Data Types](#core-data-types)
2. [Enumerations](#enumerations)
3. [Physics Types](#physics-types)
4. [Musical Types](#musical-types)
5. [Configuration Types](#configuration-types)
6. [Audio Output Types](#audio-output-types)
7. [Component State Types](#component-state-types)
8. [Serialization Format](#serialization-format)
9. [Validation Rules](#validation-rules)
10. [State Transitions](#state-transitions)

---

## Core Data Types

### Vector2D

Represents a 2D position or velocity vector.

```typescript
/**
 * 2D vector for position and velocity representation
 * Used for collider position, velocity, and collision calculations
 */
export interface Vector2D {
  /** X component in pixels (position) or pixels/second (velocity) */
  x: number;

  /** Y component in pixels (position) or pixels/second (velocity) */
  y: number;
}
```

**Constraints**:
- Position: `0 <= x <= boundary.width`, `0 <= y <= boundary.height`
- Velocity: `-200 <= x <= 200`, `-200 <= y <= 200` (based on speed presets)

**Relationships**:
- Used by `Collider.position` and `Collider.velocity`
- Used in collision detection calculations

**Usage Example**:
```typescript
const position: Vector2D = { x: 150, y: 200 };
const velocity: Vector2D = { x: 50, y: -75 };
```

---

## Enumerations

### Note

Represents the 12 chromatic notes.

```typescript
/**
 * Chromatic note enumeration
 * Maps to MIDI note numbers when combined with octave
 * Used as root note selection for scales
 */
export enum Note {
  C = 'C',
  C_SHARP = 'C#',
  D = 'D',
  D_SHARP = 'D#',
  E = 'E',
  F = 'F',
  F_SHARP = 'F#',
  G = 'G',
  G_SHARP = 'G#',
  A = 'A',
  A_SHARP = 'A#',
  B = 'B',
}
```

**Constraints**:
- Exhaustive list of all chromatic notes
- String values match standard musical notation
- Case-sensitive (uppercase only)

**Relationships**:
- Used by `ColliderConfig.rootNote`
- Combined with octave to produce MIDI note numbers

**MIDI Conversion**:
```typescript
// Example: C4 (middle C) = MIDI 60
const NOTE_TO_OFFSET: Record<Note, number> = {
  [Note.C]: 0,
  [Note.C_SHARP]: 1,
  [Note.D]: 2,
  [Note.D_SHARP]: 3,
  [Note.E]: 4,
  [Note.F]: 5,
  [Note.F_SHARP]: 6,
  [Note.G]: 7,
  [Note.G_SHARP]: 8,
  [Note.A]: 9,
  [Note.A_SHARP]: 10,
  [Note.B]: 11,
};

// Root note in octave 4: MIDI = 60 + NOTE_TO_OFFSET[note]
```

### ScaleType

Musical scale pattern definitions.

```typescript
/**
 * Musical scale type enumeration
 * Defines interval patterns (semitones from root)
 * Minimum required scales per FR-002
 */
export enum ScaleType {
  MAJOR = 'major',
  HARMONIC_MINOR = 'harmonic-minor',
  NATURAL_MINOR = 'natural-minor',
  LYDIAN = 'lydian',
  MIXOLYDIAN = 'mixolydian',
}
```

**Constraints**:
- Must include minimum scales from FR-002
- String values use kebab-case for consistency
- Extensible for future scale additions

**Relationships**:
- Used by `ColliderConfig.scaleType`
- Maps to `MusicalScale.intervals` via `SCALE_INTERVALS`

**Scale Interval Mappings**:
```typescript
/**
 * Scale interval definitions (semitones from root)
 * Based on research.md section 3 (Musical Scale Systems)
 */
export const SCALE_INTERVALS: Record<ScaleType, readonly number[]> = {
  [ScaleType.MAJOR]: [0, 2, 4, 5, 7, 9, 11],           // W-W-H-W-W-W-H
  [ScaleType.HARMONIC_MINOR]: [0, 2, 3, 5, 7, 8, 11],  // W-H-W-W-H-3H-H
  [ScaleType.NATURAL_MINOR]: [0, 2, 3, 5, 7, 8, 10],   // W-H-W-W-H-W-W
  [ScaleType.LYDIAN]: [0, 2, 4, 6, 7, 9, 11],          // W-W-W-H-W-W-H
  [ScaleType.MIXOLYDIAN]: [0, 2, 4, 5, 7, 9, 10],      // W-W-H-W-W-H-W
} as const;
```

### SpeedPreset

Collider velocity presets.

```typescript
/**
 * Speed preset enumeration for collider velocity
 * Affects collision frequency and musical density
 * Per FR-004a requirement
 */
export enum SpeedPreset {
  SLOW = 'slow',
  MEDIUM = 'medium',
  FAST = 'fast',
}
```

**Constraints**:
- Three fixed options only
- No custom velocity values (simplifies UX)

**Relationships**:
- Used by `ColliderConfig.speedPreset`
- Maps to pixel/second velocities via `SPEED_PRESET_VELOCITIES`

**Velocity Mappings**:
```typescript
/**
 * Speed preset to velocity mapping (pixels/second)
 * Based on research assumptions section
 */
export const SPEED_PRESET_VELOCITIES: Record<SpeedPreset, number> = {
  [SpeedPreset.SLOW]: 40,      // ~30-50 px/s range
  [SpeedPreset.MEDIUM]: 85,    // ~70-100 px/s range
  [SpeedPreset.FAST]: 135,     // ~120-150 px/s range
} as const;
```

### GateSize

Note duration enumeration.

```typescript
/**
 * Musical note duration for gate timing
 * Represents standard rhythmic divisions
 * Per FR-004c requirement
 */
export enum GateSize {
  WHOLE = 1,           // 1 full note
  HALF = 0.5,          // 1/2 note
  QUARTER = 0.25,      // 1/4 note
  EIGHTH = 0.125,      // 1/8 note
  SIXTEENTH = 0.0625,  // 1/16 note
}
```

**Constraints**:
- Numeric values are multipliers for quarter note duration
- Standard musical divisions only
- Must support all values listed in FR-004c

**Relationships**:
- Used by `ColliderConfig.gateSize`
- Combined with `ColliderConfig.bpm` to calculate gate duration in milliseconds

**Duration Calculation**:
```typescript
/**
 * Calculate gate duration in milliseconds
 * @param bpm Beats per minute (quarter note = 1 beat)
 * @param gateSize Note division multiplier
 * @returns Duration in milliseconds
 */
function calculateGateDurationMs(bpm: number, gateSize: GateSize): number {
  const quarterNoteDurationMs = 60000 / bpm;
  return quarterNoteDurationMs * gateSize;
}

// Example: 120 BPM, 1/4 note = 500ms
// Example: 120 BPM, 1/16 note = 125ms
```

---

## Physics Types

### Collider

Moving collision object with musical note assignment.

```typescript
/**
 * Collider entity - moving object in physics simulation
 * Represents a musical note that triggers on collision
 * Per FR-006 (note assignment) and FR-014 (visual representation)
 */
export interface Collider {
  /** Unique identifier for this collider instance */
  id: string;

  /** Current position in simulation space (pixels) */
  position: Vector2D;

  /** Current velocity vector (pixels/second) */
  velocity: Vector2D;

  /** Visual radius (collision detection uses this for circle collision) */
  radius: number;

  /**
   * Scale degree index (0-based) from the active musical scale
   * Example: In C Major [C, D, E, F, G, A, B], degree 0 = C, degree 4 = G
   */
  scaleDegree: number;

  /**
   * CV voltage output for this collider's note (1V/octave standard)
   * Pre-computed from root note + scale degree + scale intervals
   * Range: -5V to +5V (10 octave range)
   */
  cvVoltage: number;

  /**
   * Visual color for rendering (hex format)
   * Can be used to differentiate colliders or indicate note
   */
  color: string;

  /**
   * Mass for collision physics (currently equal for all colliders)
   * Future: Could vary for different collision dynamics
   */
  mass: number;
}
```

**Constraints**:
- `id`: Unique within simulation (e.g., UUID or incremental)
- `position`: Must be within `CollisionBoundary` after collision resolution
- `velocity`: Magnitude should match `SpeedPreset` on initialization
- `radius`: Fixed value (e.g., 10-15 pixels), all colliders same size
- `scaleDegree`: `0 <= scaleDegree < scale.length`
- `cvVoltage`: `-5.0 <= cvVoltage <= 5.0`
- `color`: Valid CSS color string (hex, rgb, or named)
- `mass`: Currently `1.0` for all colliders (simplified physics)

**Relationships**:
- Array of colliders managed by simulation engine
- `scaleDegree` maps to `MusicalScale.intervals[scaleDegree]`
- `cvVoltage` drives `GateOutput.cvValue`

**State Transitions**:
```
Initialization -> Active -> (Collision Detected) -> Rebounding -> Active
```

**Initialization Example**:
```typescript
function createCollider(
  id: string,
  bounds: CollisionBoundary,
  scale: MusicalScale,
  speedPreset: SpeedPreset
): Collider {
  // Random non-overlapping position (FR-005)
  const position = getRandomNonOverlappingPosition(bounds);

  // Random direction, fixed speed based on preset
  const velocity = getRandomVelocity(speedPreset);

  // Weighted random scale degree (2x weight for tonic and fifth per FR-006)
  const scaleDegree = selectWeightedScaleDegree(scale);

  // Compute CV voltage from scale
  const cvVoltage = computeCVVoltage(scale.rootNote, scale.intervals[scaleDegree]);

  return {
    id,
    position,
    velocity,
    radius: 12, // Fixed size
    scaleDegree,
    cvVoltage,
    color: generateColorForDegree(scaleDegree),
    mass: 1.0,
  };
}
```

### CollisionBoundary

Rectangular simulation area boundaries.

```typescript
/**
 * Collision boundary - defines the simulation area
 * Colliders bounce off these walls per FR-015
 * Scales proportionally with component size per FR-019
 */
export interface CollisionBoundary {
  /** Left edge X coordinate (pixels) */
  left: number;

  /** Top edge Y coordinate (pixels) */
  top: number;

  /** Right edge X coordinate (pixels) */
  right: number;

  /** Bottom edge Y coordinate (pixels) */
  bottom: number;

  /** Computed width (right - left) */
  width: number;

  /** Computed height (bottom - top) */
  height: number;
}
```

**Constraints**:
- `left < right`
- `top < bottom`
- `width = right - left > 0`
- `height = bottom - top > 0`
- Minimum size: 200x200 pixels (enough for collider movement)
- Proportional to component canvas size (FR-019)

**Relationships**:
- Used for wall collision detection (FR-008)
- Used for initial collider position generation (FR-005)

**Creation from Canvas**:
```typescript
function createBoundaryFromCanvas(canvas: HTMLCanvasElement, padding: number = 20): CollisionBoundary {
  return {
    left: padding,
    top: padding,
    right: canvas.width - padding,
    bottom: canvas.height - padding,
    width: canvas.width - 2 * padding,
    height: canvas.height - 2 * padding,
  };
}
```

### CollisionEvent

Collision detection result.

```typescript
/**
 * Collision event - result of collision detection
 * Triggers note output and visual feedback per FR-010, FR-011
 */
export interface CollisionEvent {
  /** Type of collision detected */
  type: 'wall' | 'collider';

  /** Timestamp of collision (AudioContext.currentTime) */
  timestamp: number;

  /** Primary collider involved in collision */
  colliderId: string;

  /**
   * Wall side (for wall collisions)
   * Determines reflection axis per FR-012
   */
  wallSide?: 'left' | 'right' | 'top' | 'bottom';

  /**
   * Second collider ID (for collider-collider collisions)
   * Both colliders trigger note output per FR-011
   */
  otherColliderId?: string;
}
```

**Constraints**:
- `type === 'wall'` requires `wallSide` to be defined
- `type === 'collider'` requires `otherColliderId` to be defined
- `timestamp` should be AudioContext.currentTime for audio scheduling
- Each collision triggers exactly one `CollisionEvent` per affected collider

**Relationships**:
- Generated by collision detection algorithm (research.md section 1)
- Consumed by audio engine to trigger `GateOutput`
- Consumed by renderer to trigger visual flash effect (FR-014a)

**Processing**:
```typescript
function handleCollisionEvent(event: CollisionEvent, config: ColliderConfig): void {
  const collider = getColliderById(event.colliderId);

  // Trigger audio output (FR-010, FR-011)
  const gateDurationMs = calculateGateDurationMs(config.bpm, config.gateSize);
  audioEngine.triggerGate(collider.cvVoltage, gateDurationMs, event.timestamp);

  // Trigger visual feedback (FR-014a)
  renderer.flashCollider(event.colliderId, 300); // 300ms flash duration

  // If collider-collider, also process other collider
  if (event.type === 'collider' && event.otherColliderId) {
    const otherCollider = getColliderById(event.otherColliderId);
    audioEngine.triggerGate(otherCollider.cvVoltage, gateDurationMs, event.timestamp);
    renderer.flashCollider(event.otherColliderId, 300);
  }
}
```

---

## Musical Types

### MusicalScale

Scale definition with computed note mappings.

```typescript
/**
 * Musical scale - defines available notes for collider assignment
 * Combines scale type and root note per FR-002, FR-003
 */
export interface MusicalScale {
  /** Scale type (major, minor, lydian, etc.) */
  scaleType: ScaleType;

  /** Root note (tonic) */
  rootNote: Note;

  /**
   * Interval pattern (semitones from root)
   * Derived from SCALE_INTERVALS[scaleType]
   */
  intervals: readonly number[];

  /**
   * Pre-computed CV voltages for each scale degree
   * Index corresponds to scale degree
   * Cached for performance (avoid recomputation on every collision)
   */
  cvVoltages: readonly number[];

  /**
   * Weighted selection probabilities for scale degrees
   * Tonic (index 0) and fifth (index 4) have 2x weight per FR-006
   */
  weights: readonly number[];
}
```

**Constraints**:
- `intervals.length` must match scale pattern (typically 7 for western scales)
- `cvVoltages.length === intervals.length`
- `weights.length === intervals.length`
- Sum of `weights` should equal total weight for probability calculations
- Tonic and fifth (if present) should have 2x weight of other degrees

**Relationships**:
- Created from `ColliderConfig.scaleType` and `ColliderConfig.rootNote`
- Used by collider initialization for note assignment
- `intervals` maps to `Collider.scaleDegree`
- `cvVoltages` provides `Collider.cvVoltage`

**Construction**:
```typescript
function createMusicalScale(scaleType: ScaleType, rootNote: Note): MusicalScale {
  const intervals = SCALE_INTERVALS[scaleType];

  // Compute root note MIDI number (octave 4 = middle octave)
  const rootMidi = 60 + NOTE_TO_OFFSET[rootNote]; // C4 = 60

  // Pre-compute CV voltages for all scale degrees
  const cvVoltages = intervals.map(semitones => {
    const midiNote = rootMidi + semitones;
    return midiToCV(midiNote); // 1V/octave, C4 = 0V
  });

  // Create weighted distribution (2x for tonic and fifth)
  const weights = intervals.map((_, index) => {
    // Tonic = index 0, fifth = index 4 (true for all standard scales)
    return (index === 0 || index === 4) ? 2 : 1;
  });

  return {
    scaleType,
    rootNote,
    intervals,
    cvVoltages,
    weights,
  };
}

/**
 * MIDI note to CV voltage conversion (1V/octave standard)
 * C4 (MIDI 60) = 0V reference
 */
function midiToCV(midiNote: number): number {
  return (midiNote - 60) / 12;
}
```

**Example**:
```typescript
// C Major scale
const cMajor = createMusicalScale(ScaleType.MAJOR, Note.C);
// intervals: [0, 2, 4, 5, 7, 9, 11] (C, D, E, F, G, A, B)
// cvVoltages: [0, 0.167, 0.333, 0.417, 0.583, 0.75, 0.917]
// weights: [2, 1, 1, 1, 2, 1, 1] (C and G emphasized)
```

---

## Configuration Types

### ColliderConfig

Complete user configuration for the Collider component.

```typescript
/**
 * Collider component configuration
 * All user-settable parameters per functional requirements
 * Persisted via PatchSerializer per FR-021
 */
export interface ColliderConfig {
  /**
   * Musical scale type
   * Per FR-002 (min 5 scales)
   */
  scaleType: ScaleType;

  /**
   * Root note for scale
   * Per FR-003 (all 12 chromatic notes)
   */
  rootNote: Note;

  /**
   * Number of active colliders
   * Per FR-004, FR-020 (validation required)
   * Range: 1-20
   */
  colliderCount: number;

  /**
   * Speed preset for collider velocity
   * Per FR-004a
   */
  speedPreset: SpeedPreset;

  /**
   * Beats per minute for gate duration calculation
   * Per FR-004b
   * Range: 30-300
   */
  bpm: number;

  /**
   * Note duration for gate timing
   * Per FR-004c
   */
  gateSize: GateSize;
}
```

**Constraints** (see [Validation Rules](#validation-rules)):
- `scaleType`: Must be valid `ScaleType` enum value
- `rootNote`: Must be valid `Note` enum value
- `colliderCount`: `1 <= colliderCount <= 20` (FR-020)
- `speedPreset`: Must be valid `SpeedPreset` enum value
- `bpm`: `30 <= bpm <= 300` (FR-020a)
- `gateSize`: Must be valid `GateSize` enum value

**Relationships**:
- Serialized to `ComponentData.parameters` via PatchSerializer (FR-021)
- Immutable during simulation (FR-018 prevents changes while running)
- Used to construct `MusicalScale` and initialize colliders

**Default Values**:
```typescript
export const DEFAULT_COLLIDER_CONFIG: ColliderConfig = {
  scaleType: ScaleType.MAJOR,
  rootNote: Note.C,
  colliderCount: 5,
  speedPreset: SpeedPreset.MEDIUM,
  bpm: 120,
  gateSize: GateSize.QUARTER,
};
```

**Serialization Format**:
```typescript
/**
 * Serialize config to ComponentData.parameters
 * Compatible with existing PatchSerializer pattern
 */
function serializeConfig(config: ColliderConfig): Record<string, number> {
  return {
    scaleType: Object.values(ScaleType).indexOf(config.scaleType),
    rootNote: Object.values(Note).indexOf(config.rootNote),
    colliderCount: config.colliderCount,
    speedPreset: Object.values(SpeedPreset).indexOf(config.speedPreset),
    bpm: config.bpm,
    gateSize: config.gateSize, // Numeric value
  };
}

/**
 * Deserialize from ComponentData.parameters
 */
function deserializeConfig(parameters: Record<string, number>): ColliderConfig {
  return {
    scaleType: Object.values(ScaleType)[parameters.scaleType] as ScaleType,
    rootNote: Object.values(Note)[parameters.rootNote] as Note,
    colliderCount: parameters.colliderCount,
    speedPreset: Object.values(SpeedPreset)[parameters.speedPreset] as SpeedPreset,
    bpm: parameters.bpm,
    gateSize: parameters.gateSize as GateSize,
  };
}
```

---

## Audio Output Types

### GateOutput

Audio output specification for CV/Gate signals.

```typescript
/**
 * Gate output specification for triggered notes
 * Represents a timed CV signal with gate envelope
 * Per FR-010, FR-011 (CV output on collision)
 */
export interface GateOutput {
  /**
   * CV voltage value (1V/octave standard)
   * Derived from collider's assigned note
   * Range: -5V to +5V (10 octave range)
   */
  cvValue: number;

  /**
   * Gate duration in milliseconds
   * Calculated from BPM and gate size per FR-004b, FR-004c
   */
  gateDurationMs: number;

  /**
   * Scheduled start time (AudioContext.currentTime)
   * For sample-accurate scheduling per research.md section 5
   */
  scheduleTime: number;
}
```

**Constraints**:
- `cvValue`: `-5.0 <= cvValue <= 5.0` (Eurorack standard)
- `gateDurationMs`: `> 0`, typically 31.25ms to 8000ms (16th note at 300 BPM to whole note at 30 BPM)
- `scheduleTime`: Must be AudioContext.currentTime or future time

**Relationships**:
- Created from `CollisionEvent` + `Collider.cvVoltage` + `ColliderConfig`
- Consumed by Web Audio API CV/Gate generator (ConstantSourceNode)

**Web Audio Implementation**:
```typescript
/**
 * Trigger CV/Gate output using Web Audio API
 * Per research.md section 5 (ConstantSourceNode + exponentialRampToValueAtTime)
 */
class CVGateGenerator {
  private cvNode: ConstantSourceNode;
  private gateNode: ConstantSourceNode;

  constructor(private ctx: AudioContext) {
    this.cvNode = ctx.createConstantSource();
    this.gateNode = ctx.createConstantSource();
    this.cvNode.offset.value = 0;
    this.gateNode.offset.value = 0;
    this.cvNode.start();
    this.gateNode.start();
  }

  triggerGate(output: GateOutput): void {
    const now = output.scheduleTime;
    const gateTimeSec = output.gateDurationMs / 1000;

    // CV change (exponential ramp to avoid clicks)
    this.cvNode.offset.cancelScheduledValues(now);
    this.cvNode.offset.setValueAtTime(this.cvNode.offset.value, now);

    // Clamp to positive for exponential ramp, offset to 0-10V range internally
    const targetCV = Math.max(0.001, output.cvValue + 5.0);
    this.cvNode.offset.exponentialRampToValueAtTime(targetCV, now + 0.001);

    // Gate envelope (0V -> 5V -> 0V)
    this.gateNode.offset.cancelScheduledValues(now);
    this.gateNode.offset.setValueAtTime(0, now);
    this.gateNode.offset.linearRampToValueAtTime(5, now + 0.001); // 1ms attack
    this.gateNode.offset.setValueAtTime(5, now + gateTimeSec - 0.005); // Hold
    this.gateNode.offset.linearRampToValueAtTime(0, now + gateTimeSec); // Release
  }

  getCVOutput(): AudioNode { return this.cvNode; }
  getGateOutput(): AudioNode { return this.gateNode; }

  cleanup(): void {
    this.cvNode.stop();
    this.gateNode.stop();
    this.cvNode.disconnect();
    this.gateNode.disconnect();
  }
}
```

---

## Component State Types

### ColliderSimulationState

Complete runtime state of the physics simulation.

```typescript
/**
 * Runtime state for active collider simulation
 * Manages animation loop and physics update cycle
 * Per research.md section 7 (state management)
 */
export interface ColliderSimulationState {
  /** Whether simulation is currently running (FR-016, FR-017) */
  isRunning: boolean;

  /** Array of active collider entities */
  colliders: Collider[];

  /** Collision boundary for current canvas size */
  boundary: CollisionBoundary;

  /** Musical scale configuration (pre-computed from config) */
  scale: MusicalScale;

  /** Current configuration (immutable while running per FR-018) */
  config: ColliderConfig;

  /** RequestAnimationFrame ID for cleanup (null when stopped) */
  animationFrameId: number | null;

  /** Audio context current time of last update (for delta time calculation) */
  lastUpdateTime: number;

  /** CV/Gate generator instance (null when stopped) */
  audioGenerator: CVGateGenerator | null;
}
```

**Constraints**:
- `isRunning === true` implies `animationFrameId !== null` and `audioGenerator !== null`
- `isRunning === false` implies `animationFrameId === null` and `audioGenerator === null`
- `colliders.length === config.colliderCount` when running
- Configuration changes only allowed when `isRunning === false` (FR-018)

**State Transitions**:
```
Stopped (initial) -> start() -> Running -> stop() -> Stopped
                                    ↓
                              (internal loop)
```

**Lifecycle Methods**:
```typescript
class ColliderSimulation {
  private state: ColliderSimulationState;

  start(ctx: AudioContext): void {
    if (this.state.isRunning) return;

    // Initialize audio generator
    this.state.audioGenerator = new CVGateGenerator(ctx);

    // Initialize colliders with current config
    this.state.colliders = this.initializeColliders(
      this.state.config,
      this.state.boundary,
      this.state.scale
    );

    // Start animation loop
    this.state.lastUpdateTime = ctx.currentTime;
    this.state.isRunning = true;
    this.animate();
  }

  stop(): void {
    if (!this.state.isRunning) return;

    // Cancel animation frame
    if (this.state.animationFrameId !== null) {
      cancelAnimationFrame(this.state.animationFrameId);
      this.state.animationFrameId = null;
    }

    // Cleanup audio
    if (this.state.audioGenerator) {
      this.state.audioGenerator.cleanup();
      this.state.audioGenerator = null;
    }

    // Clear colliders
    this.state.colliders = [];
    this.state.isRunning = false;
  }

  private animate(): void {
    if (!this.state.isRunning) return;

    // Physics update
    this.updatePhysics();

    // Collision detection and response
    this.detectAndResolveCollisions();

    // Render
    this.render();

    // Continue loop
    this.state.animationFrameId = requestAnimationFrame(() => this.animate());
  }
}
```

---

## Serialization Format

### ComponentData Integration

Collider component serializes to existing `ComponentData` interface.

```typescript
/**
 * Example serialized Collider component data
 * Compatible with PatchSerializer and PatchData structure
 */
const serializedCollider: ComponentData = {
  id: 'collider-123e4567',
  type: ComponentType.COLLIDER, // Add to ComponentType enum
  position: { x: 250, y: 180 }, // Canvas position
  parameters: {
    // Enum indices for type-safe serialization
    scaleType: 0,      // ScaleType.MAJOR
    rootNote: 0,       // Note.C
    colliderCount: 5,
    speedPreset: 1,    // SpeedPreset.MEDIUM
    bpm: 120,
    gateSize: 0.25,    // GateSize.QUARTER
  },
  isBypassed: false, // Not used for Collider (no bypass support)
};
```

**Serialization Implementation**:
```typescript
/**
 * Add to SynthComponent subclass for Collider
 * Follows existing pattern from LFO.ts
 */
class ColliderComponent extends SynthComponent {
  private config: ColliderConfig;

  serialize(): ComponentData {
    return {
      id: this.id,
      type: this.componentType,
      position: this.position,
      parameters: serializeConfig(this.config),
      isBypassed: false,
    };
  }

  static deserialize(data: ComponentData): ColliderComponent {
    const config = deserializeConfig(data.parameters);
    const component = new ColliderComponent(data.id, data.position);
    component.config = config;
    return component;
  }
}
```

**Validation on Deserialization**:
```typescript
function deserializeConfig(parameters: Record<string, number>): ColliderConfig {
  const config = {
    scaleType: Object.values(ScaleType)[parameters.scaleType] as ScaleType,
    rootNote: Object.values(Note)[parameters.rootNote] as Note,
    colliderCount: parameters.colliderCount,
    speedPreset: Object.values(SpeedPreset)[parameters.speedPreset] as SpeedPreset,
    bpm: parameters.bpm,
    gateSize: parameters.gateSize as GateSize,
  };

  // Validate deserialized config
  const validation = validateColliderConfig(config);
  if (!validation.isValid) {
    throw new Error(`Invalid collider config: ${validation.errors.join(', ')}`);
  }

  return config;
}
```

---

## Validation Rules

### ColliderConfig Validation

Comprehensive validation per functional requirements.

```typescript
/**
 * Validation result structure
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate ColliderConfig against functional requirements
 * Per FR-020 (collider count), FR-020a (BPM range)
 */
export function validateColliderConfig(config: ColliderConfig): ValidationResult {
  const errors: string[] = [];

  // FR-002: Scale type validation
  if (!Object.values(ScaleType).includes(config.scaleType)) {
    errors.push(`Invalid scale type: ${config.scaleType}`);
  }

  // FR-003: Root note validation
  if (!Object.values(Note).includes(config.rootNote)) {
    errors.push(`Invalid root note: ${config.rootNote}`);
  }

  // FR-020: Collider count validation (1-20)
  if (!Number.isInteger(config.colliderCount)) {
    errors.push('Collider count must be an integer');
  } else if (config.colliderCount < 1) {
    errors.push('Collider count must be at least 1');
  } else if (config.colliderCount > 20) {
    errors.push('Collider count must not exceed 20');
  }

  // FR-004a: Speed preset validation
  if (!Object.values(SpeedPreset).includes(config.speedPreset)) {
    errors.push(`Invalid speed preset: ${config.speedPreset}`);
  }

  // FR-020a: BPM validation (30-300)
  if (typeof config.bpm !== 'number' || !isFinite(config.bpm)) {
    errors.push('BPM must be a finite number');
  } else if (config.bpm < 30) {
    errors.push('BPM must be at least 30');
  } else if (config.bpm > 300) {
    errors.push('BPM must not exceed 300');
  }

  // FR-004c: Gate size validation
  if (!Object.values(GateSize).includes(config.gateSize)) {
    errors.push(`Invalid gate size: ${config.gateSize}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

**Usage Example**:
```typescript
function updateConfig(newConfig: ColliderConfig): void {
  const validation = validateColliderConfig(newConfig);

  if (!validation.isValid) {
    // Display errors to user
    showConfigErrors(validation.errors);
    return;
  }

  // Apply valid configuration
  this.config = newConfig;
}
```

### Position Validation

Non-overlapping collider initialization.

```typescript
/**
 * Validate that collider position doesn't overlap with existing colliders
 * Per FR-005 (random non-overlapping positions)
 */
export function isPositionValid(
  position: Vector2D,
  radius: number,
  existingColliders: Collider[],
  boundary: CollisionBoundary,
  minSeparation: number = 2.0
): boolean {
  // Check boundary constraints
  if (position.x - radius < boundary.left) return false;
  if (position.x + radius > boundary.right) return false;
  if (position.y - radius < boundary.top) return false;
  if (position.y + radius > boundary.bottom) return false;

  // Check overlap with existing colliders
  for (const other of existingColliders) {
    const dx = position.x - other.position.x;
    const dy = position.y - other.position.y;
    const distanceSquared = dx * dx + dy * dy;
    const minDistanceSquared = (radius + other.radius + minSeparation) ** 2;

    if (distanceSquared < minDistanceSquared) {
      return false; // Overlapping
    }
  }

  return true;
}

/**
 * Generate random non-overlapping position
 * Retry up to maxAttempts before throwing error
 */
export function generateNonOverlappingPosition(
  radius: number,
  existingColliders: Collider[],
  boundary: CollisionBoundary,
  maxAttempts: number = 100
): Vector2D {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const position: Vector2D = {
      x: boundary.left + radius + Math.random() * (boundary.width - 2 * radius),
      y: boundary.top + radius + Math.random() * (boundary.height - 2 * radius),
    };

    if (isPositionValid(position, radius, existingColliders, boundary)) {
      return position;
    }
  }

  throw new Error(
    `Failed to generate non-overlapping position after ${maxAttempts} attempts. ` +
    `Boundary may be too small for ${existingColliders.length + 1} colliders.`
  );
}
```

---

## State Transitions

### Simulation Lifecycle

```
┌─────────────┐
│   STOPPED   │ (initial state)
│             │
│ config: set │
│ colliders:[]│
└──────┬──────┘
       │ start()
       │ - Validate config
       │ - Create audio generator
       │ - Initialize colliders
       │ - Start animation loop
       ▼
┌─────────────┐
│   RUNNING   │
│             │
│ animation:  │
│ active      │
└──────┬──────┘
       │ (loop)
       │ - Update physics
       │ - Detect collisions
       │ - Trigger audio
       │ - Render frame
       │
       │ stop()
       │ - Cancel animation
       │ - Cleanup audio
       │ - Clear colliders
       ▼
┌─────────────┐
│   STOPPED   │
│             │
│ config:     │
│ preserved   │
└─────────────┘
```

**State Guards**:
```typescript
// FR-018: Prevent configuration changes during simulation
function updateConfig(newConfig: ColliderConfig): void {
  if (this.state.isRunning) {
    throw new Error('Cannot change configuration while simulation is running. Stop first.');
  }

  const validation = validateColliderConfig(newConfig);
  if (!validation.isValid) {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }

  this.state.config = newConfig;
  this.state.scale = createMusicalScale(newConfig.scaleType, newConfig.rootNote);
}
```

### Collision Event Flow

```
┌──────────────┐
│ Physics Loop │
└──────┬───────┘
       │
       ▼
┌─────────────────────┐
│ Update Positions    │ (velocity * deltaTime)
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Detect Collisions   │ (O(n²) brute force)
└──────┬──────────────┘
       │
       ├──► Wall Collision
       │    - Calculate reflection (FR-012)
       │    - Clamp position to boundary
       │    - Create CollisionEvent
       │    - Trigger audio (FR-010)
       │    - Trigger visual flash (FR-014a)
       │
       └──► Collider Collision
            - Calculate elastic response (FR-013)
            - Separate overlapping positions
            - Create CollisionEvent for both
            - Trigger audio for both (FR-011)
            - Trigger visual flash for both
```

---

## Usage Examples

### Complete Component Initialization

```typescript
/**
 * Full example: Initialize Collider component from user input
 */
async function initializeColliderComponent(
  canvasElement: HTMLCanvasElement,
  userConfig: ColliderConfig
): Promise<ColliderSimulation> {
  // 1. Validate configuration
  const validation = validateColliderConfig(userConfig);
  if (!validation.isValid) {
    throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
  }

  // 2. Create collision boundary from canvas
  const boundary = createBoundaryFromCanvas(canvasElement, 20);

  // 3. Create musical scale
  const scale = createMusicalScale(userConfig.scaleType, userConfig.rootNote);

  // 4. Initialize simulation state
  const state: ColliderSimulationState = {
    isRunning: false,
    colliders: [],
    boundary,
    scale,
    config: userConfig,
    animationFrameId: null,
    lastUpdateTime: 0,
    audioGenerator: null,
  };

  // 5. Create simulation instance
  const simulation = new ColliderSimulation(state, canvasElement);

  return simulation;
}

/**
 * Start simulation
 */
async function startSimulation(simulation: ColliderSimulation): Promise<void> {
  const audioContext = await getAudioContext();
  simulation.start(audioContext);
}

/**
 * Stop simulation
 */
function stopSimulation(simulation: ColliderSimulation): void {
  simulation.stop();
}
```

### Collision Detection and Response

```typescript
/**
 * Full collision detection and response cycle
 */
function detectAndResolveCollisions(
  colliders: Collider[],
  boundary: CollisionBoundary,
  ctx: AudioContext
): CollisionEvent[] {
  const events: CollisionEvent[] = [];

  // 1. Check wall collisions (FR-008)
  for (const collider of colliders) {
    const wallSide = checkWallCollision(collider, boundary);
    if (wallSide) {
      resolveWallCollision(collider, wallSide, boundary);
      events.push({
        type: 'wall',
        timestamp: ctx.currentTime,
        colliderId: collider.id,
        wallSide,
      });
    }
  }

  // 2. Check collider-collider collisions (FR-009)
  for (let i = 0; i < colliders.length - 1; i++) {
    for (let j = i + 1; j < colliders.length; j++) {
      const c1 = colliders[i];
      const c2 = colliders[j];

      if (checkCircleCollision(c1, c2)) {
        resolveCircleCollision(c1, c2);
        events.push({
          type: 'collider',
          timestamp: ctx.currentTime,
          colliderId: c1.id,
          otherColliderId: c2.id,
        });
      }
    }
  }

  return events;
}

/**
 * Wall collision detection
 */
function checkWallCollision(
  collider: Collider,
  boundary: CollisionBoundary
): 'left' | 'right' | 'top' | 'bottom' | null {
  if (collider.position.x - collider.radius < boundary.left) return 'left';
  if (collider.position.x + collider.radius > boundary.right) return 'right';
  if (collider.position.y - collider.radius < boundary.top) return 'top';
  if (collider.position.y + collider.radius > boundary.bottom) return 'bottom';
  return null;
}

/**
 * Wall collision response (FR-012: angle of incidence = angle of reflection)
 */
function resolveWallCollision(
  collider: Collider,
  side: 'left' | 'right' | 'top' | 'bottom',
  boundary: CollisionBoundary
): void {
  switch (side) {
    case 'left':
      collider.position.x = boundary.left + collider.radius;
      collider.velocity.x = Math.abs(collider.velocity.x);
      break;
    case 'right':
      collider.position.x = boundary.right - collider.radius;
      collider.velocity.x = -Math.abs(collider.velocity.x);
      break;
    case 'top':
      collider.position.y = boundary.top + collider.radius;
      collider.velocity.y = Math.abs(collider.velocity.y);
      break;
    case 'bottom':
      collider.position.y = boundary.bottom - collider.radius;
      collider.velocity.y = -Math.abs(collider.velocity.y);
      break;
  }
}

/**
 * Circle-circle collision detection
 */
function checkCircleCollision(c1: Collider, c2: Collider): boolean {
  const dx = c2.position.x - c1.position.x;
  const dy = c2.position.y - c1.position.y;
  const distanceSquared = dx * dx + dy * dy;
  const radiusSum = c1.radius + c2.radius;
  return distanceSquared < (radiusSum * radiusSum);
}

/**
 * Circle-circle collision response (FR-013: elastic collision)
 */
function resolveCircleCollision(c1: Collider, c2: Collider): void {
  // Calculate collision normal
  const dx = c2.position.x - c1.position.x;
  const dy = c2.position.y - c1.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) return; // Avoid division by zero

  const nx = dx / dist;
  const ny = dy / dist;

  // Relative velocity
  const dvx = c1.velocity.x - c2.velocity.x;
  const dvy = c1.velocity.y - c2.velocity.y;
  const dvn = dvx * nx + dvy * ny;

  // Do not resolve if velocities are separating
  if (dvn <= 0) return;

  // Equal mass: exchange velocity components along normal
  c1.velocity.x -= dvn * nx;
  c1.velocity.y -= dvn * ny;
  c2.velocity.x += dvn * nx;
  c2.velocity.y += dvn * ny;

  // Position correction (prevent overlap accumulation)
  const overlap = (c1.radius + c2.radius) - dist;
  const correction = (overlap / 2) + 0.01; // Small epsilon
  c1.position.x -= correction * nx;
  c1.position.y -= correction * ny;
  c2.position.x += correction * nx;
  c2.position.y += correction * ny;
}
```

---

## Summary

This data model provides:

1. **Type Safety**: All entities defined with strict TypeScript interfaces
2. **Validation**: Comprehensive validation rules per functional requirements
3. **Serialization**: Compatible with existing PatchSerializer pattern
4. **Performance**: Optimized structures for O(n²) collision detection
5. **Musical Accuracy**: 1V/octave CV standard, MIDI-based scale calculations
6. **State Management**: Explicit lifecycle with cleanup hooks
7. **Extensibility**: Enums and interfaces designed for future additions

All types align with:
- Functional requirements from `spec.md`
- Technical decisions from `research.md`
- Existing codebase patterns from `src/core/types.ts`
- TypeScript 5.6+ conventions (ES2020 target)

**Key Files to Create**:
1. `src/core/types.ts` - Add `ComponentType.COLLIDER` enum value
2. `src/components/collider/types.ts` - All types from this document
3. `src/components/collider/validation.ts` - Validation functions
4. `src/components/collider/Collider.ts` - Component implementation using these types
