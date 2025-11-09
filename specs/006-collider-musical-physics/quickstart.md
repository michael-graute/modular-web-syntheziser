# Quickstart Guide: Collider Musical Physics Component

**Feature**: `006-collider-musical-physics`
**Created**: 2025-11-07
**Target Audience**: Developers implementing or extending the Collider component
**Prerequisites**: Familiarity with TypeScript 5.6+, Web Audio API, Canvas API

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Setup](#component-setup)
3. [Module Integration](#module-integration)
4. [Configuration & Parameters](#configuration--parameters)
5. [Simulation Lifecycle](#simulation-lifecycle)
6. [Persistence](#persistence)
7. [Testing Strategy](#testing-strategy)
8. [Common Pitfalls & Debugging](#common-pitfalls--debugging)

---

## Architecture Overview

### Component Structure

The Collider component extends the `SynthComponent` base class, following the same pattern as `LFO`, `Oscillator`, and other components in the codebase.

```typescript
import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';

export class Collider extends SynthComponent {
  // Extends SynthComponent lifecycle methods:
  // - createAudioNodes()
  // - destroyAudioNodes()
  // - updateAudioParameter()
  // - serialize() / deserialize()
}
```

**Key inheritance points**:
- **SynthComponent**: Provides parameter management, port management, serialization
- **ComponentType.COLLIDER**: Add this enum value to `/home/mgraute/ai-testing/src/core/types.ts`
- **Audio nodes**: Managed via `registerAudioNode()` for proper cleanup

### Module Organization

The Collider feature is organized into separate, testable modules:

```
src/
├── components/
│   └── utilities/
│       └── Collider.ts              # Main component (extends SynthComponent)
├── physics/
│   ├── PhysicsEngine.ts             # Collision detection & response
│   ├── Vector2D.ts                  # Vector math utilities
│   └── CollisionResolver.ts         # Elastic collision calculations
├── music/
│   ├── MusicalScale.ts              # Scale generation (intervals, CV voltages)
│   ├── ScaleTypes.ts                # Scale type constants & formulas
│   └── WeightedRandomSelector.ts    # Weighted note assignment (2x tonic/fifth)
├── timing/
│   └── TimingCalculator.ts          # BPM to duration calculations
└── canvas/
    └── ColliderRenderer.ts          # Visual rendering & flash effects
```

**Design rationale**:
- **Physics module**: Isolated for unit testing collision math
- **Music module**: Reusable for other musical components
- **Timing module**: BPM calculations separate from physics
- **Canvas module**: Rendering logic separate from simulation logic

### Integration with Existing Systems

#### CanvasComponent Integration

The Collider uses the existing `CanvasComponent` pattern for visualization:

```typescript
import { CanvasComponent } from '../../canvas/CanvasComponent';

// In Canvas.ts, register Collider visualization
canvasComponent.on('render', (ctx: CanvasRenderingContext2D) => {
  const colliderComp = component as Collider;
  const state = colliderComp.getSimulationState();

  if (state.isRunning) {
    colliderRenderer.render(ctx, state.colliders, state.boundary);
  }
});
```

**Visual feedback**: Collision flash effects handled by ColliderRenderer (FR-014a)

#### PatchSerializer Integration

Configuration persists using the existing PatchSerializer pattern (see LFO.ts lines 439-470):

```typescript
import { ComponentData } from '../../core/types';
import { PatchSerializer } from '../../patch/PatchSerializer';

serialize(): ComponentData {
  return {
    id: this.id,
    type: this.type,
    position: this.position,
    parameters: {
      scaleType: Object.values(ScaleType).indexOf(this.config.scaleType),
      rootNote: Object.values(Note).indexOf(this.config.rootNote),
      colliderCount: this.config.colliderCount,
      speedPreset: Object.values(SpeedPreset).indexOf(this.config.speedPreset),
      bpm: this.config.bpm,
      gateSize: this.config.gateSize,
    },
    isBypassed: false, // Collider doesn't support bypass
  };
}
```

#### AudioEngine Integration

CV/Gate output connects to AudioEngine (see LFO.ts lines 76-77 for pattern):

```typescript
import { audioEngine } from '../../core/AudioEngine';

createAudioNodes(): void {
  if (!audioEngine.isReady()) {
    throw new Error('AudioEngine not initialized');
  }

  const ctx = audioEngine.getContext();

  // Create CV output (ConstantSourceNode for CV voltage)
  this.cvNode = ctx.createConstantSource();
  this.cvNode.offset.value = 0;
  this.cvNode.start();

  // Create Gate output (ConstantSourceNode for gate envelope)
  this.gateNode = ctx.createConstantSource();
  this.gateNode.offset.value = 0;
  this.gateNode.start();

  // Register with audio engine (like LFO.ts line 76)
  this.registerAudioNode('cv', this.cvNode);
  this.registerAudioNode('gate', this.gateNode);
}
```

---

## Component Setup

### Step 1: Add to Component Registry

Add Collider to `/home/mgraute/ai-testing/src/components/registerComponents.ts`:

```typescript
import { Collider } from './utilities/Collider';
import { ComponentRegistry } from './ComponentRegistry';
import { ComponentType } from '../core/types';

export function registerComponents(registry: ComponentRegistry): void {
  // ... existing registrations ...

  // Register Collider utility
  registry.register(
    ComponentType.COLLIDER,
    'Collider',
    'Musical Physics Simulator',
    (id: string, position: Position) => new Collider(id, position)
  );
}
```

### Step 2: Add ComponentType Enum

Add to `/home/mgraute/ai-testing/src/core/types.ts`:

```typescript
export enum ComponentType {
  // ... existing types ...
  COLLIDER = 'collider',
}
```

### Step 3: Create Component Instance

Create instance from component registry:

```typescript
import { ComponentRegistry } from './components/ComponentRegistry';

const registry = ComponentRegistry.getInstance();
const collider = registry.createComponent(
  ComponentType.COLLIDER,
  'collider-001',
  { x: 200, y: 150 }
);
```

### Step 4: Add to Canvas

Add to canvas using existing Canvas system:

```typescript
import { Canvas } from './canvas/Canvas';

const canvas = new Canvas(canvasElement);
canvas.addComponent(collider);

// Activate component to create audio nodes
collider.activate();
```

### Step 5: Initial Configuration

Configure with default or user-provided settings:

```typescript
import { ScaleType, Note, SpeedPreset, GateSize } from './contracts';

// Use defaults
const defaultConfig: ColliderConfig = {
  scaleType: ScaleType.MAJOR,
  rootNote: Note.C,
  colliderCount: 5,
  speedPreset: SpeedPreset.MEDIUM,
  bpm: 120,
  gateSize: GateSize.QUARTER,
};

collider.setConfiguration(defaultConfig);
```

---

## Module Integration

### PhysicsEngine Initialization

The PhysicsEngine handles collision detection and response:

```typescript
import { PhysicsEngine } from '../physics/PhysicsEngine';
import { CollisionBoundary } from './contracts/types';

// Initialize physics engine
class Collider extends SynthComponent {
  private physicsEngine: PhysicsEngine;

  constructor(id: string, position: Position) {
    super(id, ComponentType.COLLIDER, 'Collider', position);

    // Create physics engine instance
    this.physicsEngine = new PhysicsEngine();

    // Add outputs (CV and Gate)
    this.addOutput('cv', 'CV Out', SignalType.CV);
    this.addOutput('gate', 'Gate Out', SignalType.GATE);
  }
}
```

**PhysicsEngine Lifecycle**:

```typescript
// Start simulation - initialize colliders in physics engine
startSimulation(): void {
  const boundary = this.createBoundaryFromCanvas();

  // Clear existing colliders
  this.physicsEngine.reset();

  // Add new colliders based on configuration
  const colliders = this.initializeColliders(
    this.config.colliderCount,
    boundary,
    this.scale
  );

  colliders.forEach(c => this.physicsEngine.addCollider(c));
}

// Update loop - called every animation frame
private animate(): void {
  const deltaTime = this.calculateDeltaTime();

  // Update physics and get collision events
  const collisionEvents = this.physicsEngine.update(deltaTime);

  // Process collision events (trigger audio, visual feedback)
  collisionEvents.forEach(event => this.handleCollisionEvent(event));

  // Continue loop
  if (this.isRunning) {
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }
}

// Stop simulation - cleanup physics state
stopSimulation(): void {
  this.physicsEngine.reset();
}
```

### MusicalScaleSystem Setup

The MusicalScaleSystem generates scale notes and CV voltages:

```typescript
import { MusicalScaleSystem } from '../music/MusicalScaleSystem';
import { MusicalScale, ScaleType, Note } from './contracts';

class Collider extends SynthComponent {
  private scaleSystem: MusicalScaleSystem;
  private currentScale: MusicalScale | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.COLLIDER, 'Collider', position);
    this.scaleSystem = new MusicalScaleSystem();
  }

  // Update scale when configuration changes
  private updateScale(): void {
    this.currentScale = this.scaleSystem.createScale(
      this.config.scaleType,
      this.config.rootNote
    );
  }

  // Assign notes to colliders using weighted random
  private initializeColliders(
    count: number,
    boundary: CollisionBoundary,
    scale: MusicalScale
  ): Collider[] {
    const colliders: Collider[] = [];

    // Assign weighted random scale degrees (2x weight for tonic and fifth)
    const scaleDegrees = this.scaleSystem.assignNotes(
      count,
      scale.intervals,
      true // weighted = true
    );

    for (let i = 0; i < count; i++) {
      const collider = this.createCollider(
        `${this.id}-collider-${i}`,
        boundary,
        scale,
        scaleDegrees[i],
        this.config.speedPreset
      );
      colliders.push(collider);
    }

    return colliders;
  }
}
```

**Scale generation example**:

```typescript
// MusicalScaleSystem.ts
class MusicalScaleSystem implements IMusicalScaleSystem {
  createScale(scaleType: ScaleType, rootNote: Note): MusicalScale {
    const intervals = SCALE_INTERVALS[scaleType];
    const rootMidi = 60 + NOTE_TO_OFFSET[rootNote]; // C4 = 60

    // Pre-compute CV voltages (1V/octave, C4 = 0V)
    const cvVoltages = intervals.map(semitones => {
      const midiNote = rootMidi + semitones;
      return (midiNote - 60) / 12; // 1V/octave
    });

    // Create weights (2x for tonic and fifth)
    const weights = intervals.map((_, i) => (i === 0 || i === 4) ? 2 : 1);

    return { scaleType, rootNote, intervals, cvVoltages, weights };
  }
}
```

### TimingCalculator Usage

The TimingCalculator converts BPM and gate size to millisecond durations:

```typescript
import { TimingCalculator } from '../timing/TimingCalculator';
import { GateSize } from './contracts';

class Collider extends SynthComponent {
  private timingCalculator: TimingCalculator;

  constructor(id: string, position: Position) {
    super(id, ComponentType.COLLIDER, 'Collider', position);
    this.timingCalculator = new TimingCalculator();
  }

  // Calculate gate duration for current config
  private getGateDurationMs(): number {
    return this.timingCalculator.calculateGateDuration(
      this.config.bpm,
      this.config.gateSize
    );
  }

  // Handle collision event - trigger audio with calculated duration
  private handleCollisionEvent(event: CollisionEvent): void {
    const collider = this.getColliderById(event.colliderId);
    const gateDurationMs = this.getGateDurationMs();

    // Trigger CV/Gate output
    this.triggerNote(collider.cvVoltage, gateDurationMs, event.timestamp);
  }
}
```

**TimingCalculator implementation**:

```typescript
// TimingCalculator.ts
class TimingCalculator implements ITimingCalculator {
  calculateGateDuration(bpm: number, gateSize: GateSize): number {
    // Quarter note duration in milliseconds
    const quarterNoteDurationMs = 60000 / bpm;

    // Multiply by gate size (0.0625 to 1.0)
    return quarterNoteDurationMs * gateSize;
  }

  bpmToMs(bpm: number): number {
    return 60000 / bpm; // Quarter note duration
  }
}

// Example calculations:
// 120 BPM, 1/4 note = 500ms
// 120 BPM, 1/16 note = 125ms
// 60 BPM, 1/2 note = 2000ms
```

### CVOutput Audio Connection

Connect CV and Gate outputs to audio nodes:

```typescript
class Collider extends SynthComponent {
  private cvNode: ConstantSourceNode | null = null;
  private gateNode: ConstantSourceNode | null = null;

  // Create audio nodes (called by activate())
  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    // CV output node (1V/octave standard)
    this.cvNode = ctx.createConstantSource();
    this.cvNode.offset.value = 0;
    this.cvNode.start();

    // Gate output node (0V to 5V envelope)
    this.gateNode = ctx.createConstantSource();
    this.gateNode.offset.value = 0;
    this.gateNode.start();

    // Register nodes for cleanup
    this.registerAudioNode('cv', this.cvNode);
    this.registerAudioNode('gate', this.gateNode);

    console.log(`Collider ${this.id} audio nodes created`);
  }

  // Get output nodes for connections
  getOutputNode(): AudioNode | null {
    return this.cvNode;
  }

  protected getOutputNodeByPort(portId: string): AudioNode | null {
    if (portId === 'cv') return this.cvNode;
    if (portId === 'gate') return this.gateNode;
    return null;
  }

  // Trigger note on collision
  private triggerNote(cvVoltage: number, durationMs: number, timestamp: number): void {
    if (!this.cvNode || !this.gateNode) return;

    const ctx = audioEngine.getContext();
    const now = timestamp;
    const durationSec = durationMs / 1000;

    // Schedule CV voltage change (exponential ramp to avoid clicks)
    this.cvNode.offset.cancelScheduledValues(now);
    this.cvNode.offset.setValueAtTime(this.cvNode.offset.value, now);
    const targetCV = Math.max(0.001, cvVoltage + 5.0); // Shift to 0-10V range
    this.cvNode.offset.exponentialRampToValueAtTime(targetCV, now + 0.001);

    // Schedule gate envelope (0V -> 5V -> 0V)
    this.gateNode.offset.cancelScheduledValues(now);
    this.gateNode.offset.setValueAtTime(0, now);
    this.gateNode.offset.linearRampToValueAtTime(5, now + 0.001); // 1ms attack
    this.gateNode.offset.setValueAtTime(5, now + durationSec - 0.005); // Hold
    this.gateNode.offset.linearRampToValueAtTime(0, now + durationSec); // 5ms release
  }
}
```

---

## Configuration & Parameters

### Setting Scale, Root Note, Collider Count

Configuration must be set before starting simulation (FR-018):

```typescript
import { validateColliderConfig } from './validation';

class Collider extends SynthComponent {
  private config: ColliderConfig;
  private isRunning: boolean = false;

  // Set configuration (validation required)
  setConfiguration(newConfig: ColliderConfig): void {
    // Prevent changes during simulation (FR-018)
    if (this.isRunning) {
      throw new Error('Cannot change configuration while simulation is running. Stop first.');
    }

    // Validate configuration (FR-020, FR-020a)
    const validation = validateColliderConfig(newConfig);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Apply configuration
    this.config = newConfig;

    // Update musical scale
    this.currentScale = this.scaleSystem.createScale(
      newConfig.scaleType,
      newConfig.rootNote
    );

    console.log(`Collider ${this.id} configuration updated:`, newConfig);
  }

  // Get current configuration (read-only)
  getConfiguration(): Readonly<ColliderConfig> {
    return { ...this.config };
  }
}
```

### BPM and Gate Size Configuration

BPM and gate size affect timing only:

```typescript
// Update BPM (must stop simulation first)
collider.setConfiguration({
  ...collider.getConfiguration(),
  bpm: 140, // Range: 30-300 (FR-020a)
});

// Update gate size
collider.setConfiguration({
  ...collider.getConfiguration(),
  gateSize: GateSize.EIGHTH, // 1/8 note
});
```

**BPM Validation**:

```typescript
// validation.ts
function validateColliderConfig(config: ColliderConfig): ValidationResult {
  const errors: string[] = [];

  // FR-020a: BPM range validation
  if (typeof config.bpm !== 'number' || !isFinite(config.bpm)) {
    errors.push('BPM must be a finite number');
  } else if (config.bpm < 30) {
    errors.push('BPM must be at least 30');
  } else if (config.bpm > 300) {
    errors.push('BPM must not exceed 300');
  }

  return { isValid: errors.length === 0, errors };
}
```

### Speed Presets

Speed presets control collider velocity:

```typescript
// Speed preset constants
const SPEED_PRESET_VELOCITIES: Record<SpeedPreset, number> = {
  [SpeedPreset.SLOW]: 40,      // ~30-50 px/s
  [SpeedPreset.MEDIUM]: 85,    // ~70-100 px/s
  [SpeedPreset.FAST]: 135,     // ~120-150 px/s
};

// Set speed preset
collider.setConfiguration({
  ...collider.getConfiguration(),
  speedPreset: SpeedPreset.FAST,
});
```

### Parameter Validation

Use validation functions before applying configuration:

```typescript
import { validateColliderConfig, ValidationResult } from './validation';

function updateConfigFromUI(userInput: ColliderConfig): void {
  // Validate before applying
  const validation = validateColliderConfig(userInput);

  if (!validation.isValid) {
    // Show errors to user
    displayErrors(validation.errors);
    return;
  }

  // Apply valid configuration
  try {
    collider.setConfiguration(userInput);
  } catch (error) {
    // Handle runtime errors (e.g., simulation running)
    displayError(error.message);
  }
}
```

---

## Simulation Lifecycle

### Starting Simulation

Start simulation creates audio nodes and begins animation loop:

```typescript
class Collider extends SynthComponent {
  private animationFrameId: number | null = null;
  private lastUpdateTime: number = 0;

  startSimulation(): void {
    // Guard: already running
    if (this.isRunning) {
      console.warn(`Collider ${this.id} simulation already running`);
      return;
    }

    // Ensure audio nodes exist
    if (!this.isActive) {
      this.activate(); // Calls createAudioNodes()
    }

    const ctx = audioEngine.getContext();

    // Initialize boundary from canvas
    const boundary = this.createBoundaryFromCanvas();

    // Initialize colliders
    const colliders = this.initializeColliders(
      this.config.colliderCount,
      boundary,
      this.currentScale!
    );

    // Setup physics engine
    this.physicsEngine.reset();
    colliders.forEach(c => this.physicsEngine.addCollider(c));

    // Start animation loop
    this.lastUpdateTime = ctx.currentTime;
    this.isRunning = true;
    this.animate();

    console.log(`Collider ${this.id} simulation started with ${colliders.length} colliders`);
  }

  // Animation loop
  private animate(): void {
    if (!this.isRunning) return;

    const ctx = audioEngine.getContext();
    const currentTime = ctx.currentTime;
    const deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;

    // Update physics (returns collision events)
    const collisionEvents = this.physicsEngine.update(deltaTime);

    // Handle collisions (trigger audio, visual feedback)
    collisionEvents.forEach(event => this.handleCollisionEvent(event));

    // Render colliders (via CanvasComponent)
    this.requestRender();

    // Continue loop
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }
}
```

### Running Simulation

During simulation, physics updates continuously:

```typescript
// Physics update cycle (inside animate())
private updateSimulation(deltaTime: number): void {
  // 1. Update positions (velocity integration)
  this.physicsEngine.updatePositions(deltaTime);

  // 2. Detect collisions (wall and collider-collider)
  const collisions = this.physicsEngine.detectCollisions();

  // 3. Resolve collisions (reflection, elastic response)
  this.physicsEngine.resolveCollisions(collisions);

  // 4. Return collision events for audio/visual feedback
  return collisions;
}

// Handle collision events
private handleCollisionEvent(event: CollisionEvent): void {
  const collider = this.getColliderById(event.colliderId);
  const gateDurationMs = this.getGateDurationMs();

  // Trigger audio output (FR-010, FR-011)
  this.triggerNote(collider.cvVoltage, gateDurationMs, event.timestamp);

  // Trigger visual feedback (FR-014a)
  this.flashCollider(event.colliderId, 300); // 300ms flash

  // If collider-collider collision, process other collider
  if (event.type === 'collider' && event.otherColliderId) {
    const other = this.getColliderById(event.otherColliderId);
    this.triggerNote(other.cvVoltage, gateDurationMs, event.timestamp);
    this.flashCollider(event.otherColliderId, 300);
  }
}
```

### Stopping Simulation

Stop simulation cleans up animation and audio:

```typescript
class Collider extends SynthComponent {
  stopSimulation(): void {
    // Guard: not running
    if (!this.isRunning) {
      console.warn(`Collider ${this.id} simulation not running`);
      return;
    }

    // Cancel animation frame (prevent memory leak)
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Clear colliders from physics engine
    this.physicsEngine.reset();

    // Reset CV/Gate outputs to 0
    if (this.cvNode) {
      const ctx = audioEngine.getContext();
      this.cvNode.offset.cancelScheduledValues(ctx.currentTime);
      this.cvNode.offset.setValueAtTime(0, ctx.currentTime);
    }
    if (this.gateNode) {
      const ctx = audioEngine.getContext();
      this.gateNode.offset.cancelScheduledValues(ctx.currentTime);
      this.gateNode.offset.setValueAtTime(0, ctx.currentTime);
    }

    this.isRunning = false;

    console.log(`Collider ${this.id} simulation stopped`);
  }

  // Cleanup on component destroy (called by deactivate())
  destroyAudioNodes(): void {
    // Stop simulation if running
    if (this.isRunning) {
      this.stopSimulation();
    }

    // Cleanup audio nodes
    if (this.cvNode) {
      this.cvNode.stop();
      this.cvNode.disconnect();
      this.cvNode = null;
    }
    if (this.gateNode) {
      this.gateNode.stop();
      this.gateNode.disconnect();
      this.gateNode = null;
    }

    console.log(`Collider ${this.id} destroyed`);
  }
}
```

### Configuration Changes

Configuration changes require stopping first (FR-018):

```typescript
class Collider extends SynthComponent {
  // Update parameter (enforces stop-before-change)
  updateAudioParameter(parameterId: string, value: number): void {
    if (this.isRunning) {
      throw new Error(
        `Cannot update ${parameterId} while simulation is running. Stop first.`
      );
    }

    // Update configuration
    switch (parameterId) {
      case 'scaleType':
        this.config.scaleType = Object.values(ScaleType)[value] as ScaleType;
        this.updateScale();
        break;
      case 'rootNote':
        this.config.rootNote = Object.values(Note)[value] as Note;
        this.updateScale();
        break;
      case 'colliderCount':
        this.config.colliderCount = value;
        break;
      // ... other parameters
    }
  }
}
```

---

## Persistence

### Serialization with PatchSerializer

Collider configuration serializes to ComponentData (like LFO.ts):

```typescript
class Collider extends SynthComponent {
  // Serialize component state
  serialize(): ComponentData {
    return {
      id: this.id,
      type: this.type,
      position: { ...this.position },
      parameters: {
        // Enum indices for type-safe serialization
        scaleType: Object.values(ScaleType).indexOf(this.config.scaleType),
        rootNote: Object.values(Note).indexOf(this.config.rootNote),
        colliderCount: this.config.colliderCount,
        speedPreset: Object.values(SpeedPreset).indexOf(this.config.speedPreset),
        bpm: this.config.bpm,
        gateSize: this.config.gateSize, // Numeric value already
      },
      isBypassed: false, // Collider doesn't support bypass
    };
  }
}
```

### Deserialization and State Restoration

Restore configuration from saved patch:

```typescript
class Collider extends SynthComponent {
  // Deserialize component state
  deserialize(data: ComponentData): void {
    // Restore position
    this.position = { ...data.position };

    // Restore configuration from parameters
    const config: ColliderConfig = {
      scaleType: Object.values(ScaleType)[data.parameters.scaleType] as ScaleType,
      rootNote: Object.values(Note)[data.parameters.rootNote] as Note,
      colliderCount: data.parameters.colliderCount,
      speedPreset: Object.values(SpeedPreset)[data.parameters.speedPreset] as SpeedPreset,
      bpm: data.parameters.bpm,
      gateSize: data.parameters.gateSize as GateSize,
    };

    // Validate deserialized config (safety check)
    const validation = validateColliderConfig(config);
    if (!validation.isValid) {
      console.error(`Invalid deserialized config: ${validation.errors.join(', ')}`);
      // Fall back to defaults
      this.config = { ...DEFAULT_COLLIDER_CONFIG };
    } else {
      this.config = config;
    }

    // Update scale
    this.updateScale();

    console.log(`Collider ${this.id} deserialized:`, this.config);
  }
}
```

### Default Values

Define default configuration (FR-021):

```typescript
// defaults.ts
export const DEFAULT_COLLIDER_CONFIG: ColliderConfig = {
  scaleType: ScaleType.MAJOR,
  rootNote: Note.C,
  colliderCount: 5,
  speedPreset: SpeedPreset.MEDIUM,
  bpm: 120,
  gateSize: GateSize.QUARTER,
};

// Use in constructor
class Collider extends SynthComponent {
  private config: ColliderConfig;

  constructor(id: string, position: Position) {
    super(id, ComponentType.COLLIDER, 'Collider', position);

    // Initialize with defaults
    this.config = { ...DEFAULT_COLLIDER_CONFIG };

    // ... initialize modules ...
  }
}
```

---

## Testing Strategy

### Unit Testing Physics Calculations

Test collision detection and response in isolation:

```typescript
// tests/unit/physics/CollisionDetection.test.ts
import { PhysicsEngine } from '../../../physics/PhysicsEngine';
import { Collider, CollisionBoundary } from '../../../contracts';

describe('PhysicsEngine - Wall Collision', () => {
  it('should detect left wall collision', () => {
    const boundary: CollisionBoundary = {
      left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300,
    };

    const collider: Collider = {
      id: 'test-1',
      position: { x: 5, y: 150 }, // Near left wall
      velocity: { x: -50, y: 0 }, // Moving left
      radius: 10,
      // ... other fields
    };

    const engine = new PhysicsEngine();
    engine.addCollider(collider);

    const events = engine.update(0.1); // 100ms

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('wall');
    expect(events[0].wallSide).toBe('left');
    expect(collider.velocity.x).toBeGreaterThan(0); // Velocity reversed
  });

  it('should calculate elastic collision correctly', () => {
    const c1: Collider = {
      id: 'c1',
      position: { x: 100, y: 100 },
      velocity: { x: 50, y: 0 },
      radius: 10,
      mass: 1,
      // ...
    };

    const c2: Collider = {
      id: 'c2',
      position: { x: 120, y: 100 }, // Overlapping
      velocity: { x: -50, y: 0 },
      radius: 10,
      mass: 1,
      // ...
    };

    const engine = new PhysicsEngine();
    engine.addCollider(c1);
    engine.addCollider(c2);

    const events = engine.update(0.016); // 1 frame

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('collider');

    // Equal mass: velocities should exchange
    expect(c1.velocity.x).toBeCloseTo(-50, 1);
    expect(c2.velocity.x).toBeCloseTo(50, 1);
  });
});
```

### Unit Testing Musical Scale Generation

Test scale intervals and CV voltage calculations:

```typescript
// tests/unit/music/MusicalScale.test.ts
import { MusicalScaleSystem } from '../../../music/MusicalScaleSystem';
import { ScaleType, Note } from '../../../contracts';

describe('MusicalScaleSystem', () => {
  const scaleSystem = new MusicalScaleSystem();

  it('should generate C Major scale correctly', () => {
    const scale = scaleSystem.createScale(ScaleType.MAJOR, Note.C);

    expect(scale.intervals).toEqual([0, 2, 4, 5, 7, 9, 11]); // C D E F G A B
    expect(scale.cvVoltages).toHaveLength(7);

    // C4 (MIDI 60) = 0V
    expect(scale.cvVoltages[0]).toBeCloseTo(0, 3);

    // G4 (MIDI 67) = 0.583V
    expect(scale.cvVoltages[4]).toBeCloseTo(0.583, 3);
  });

  it('should assign weighted random notes correctly', () => {
    const scale = scaleSystem.createScale(ScaleType.MAJOR, Note.C);
    const assignments = scaleSystem.assignNotes(1000, scale.intervals, true);

    // Count occurrences of tonic (0) and fifth (4)
    const tonicCount = assignments.filter(d => d === 0).length;
    const fifthCount = assignments.filter(d => d === 4).length;
    const otherAvg = assignments.filter(d => d !== 0 && d !== 4).length / 5;

    // Tonic and fifth should appear ~2x more frequently
    expect(tonicCount).toBeGreaterThan(otherAvg * 1.5);
    expect(fifthCount).toBeGreaterThan(otherAvg * 1.5);
  });
});
```

### Unit Testing Timing Calculations

Test BPM to duration conversions:

```typescript
// tests/unit/timing/TimingCalculator.test.ts
import { TimingCalculator } from '../../../timing/TimingCalculator';
import { GateSize } from '../../../contracts';

describe('TimingCalculator', () => {
  const calculator = new TimingCalculator();

  it('should calculate quarter note at 120 BPM as 500ms', () => {
    const duration = calculator.calculateGateDuration(120, GateSize.QUARTER);
    expect(duration).toBe(500);
  });

  it('should calculate sixteenth note at 120 BPM as 125ms', () => {
    const duration = calculator.calculateGateDuration(120, GateSize.SIXTEENTH);
    expect(duration).toBe(125);
  });

  it('should calculate whole note at 60 BPM as 4000ms', () => {
    const duration = calculator.calculateGateDuration(60, GateSize.WHOLE);
    expect(duration).toBe(4000);
  });

  it('should handle BPM range boundaries', () => {
    expect(calculator.calculateGateDuration(30, GateSize.QUARTER)).toBe(2000);
    expect(calculator.calculateGateDuration(300, GateSize.QUARTER)).toBe(200);
  });
});
```

### Integration Testing Collision Detection

Test full collision cycle with audio:

```typescript
// tests/integration/collider-component.test.ts
import { Collider } from '../../components/utilities/Collider';
import { audioEngine } from '../../core/AudioEngine';
import { ScaleType, Note, SpeedPreset, GateSize } from '../../contracts';

describe('Collider Component Integration', () => {
  let collider: Collider;

  beforeEach(() => {
    collider = new Collider('test-collider', { x: 200, y: 150 });
    collider.activate();
  });

  afterEach(() => {
    collider.stopSimulation();
    collider.deactivate();
  });

  it('should start and stop simulation without errors', () => {
    expect(() => collider.startSimulation()).not.toThrow();
    expect(collider.isRunning).toBe(true);

    expect(() => collider.stopSimulation()).not.toThrow();
    expect(collider.isRunning).toBe(false);
  });

  it('should trigger audio on collision', (done) => {
    const config = {
      scaleType: ScaleType.MAJOR,
      rootNote: Note.C,
      colliderCount: 2,
      speedPreset: SpeedPreset.FAST,
      bpm: 120,
      gateSize: GateSize.QUARTER,
    };

    collider.setConfiguration(config);
    collider.startSimulation();

    // Listen for collision events
    let collisionDetected = false;
    collider.on('collision', (event) => {
      collisionDetected = true;
      expect(event.type).toMatch(/wall|collider/);
    });

    // Wait for collision (fast speed should collide quickly)
    setTimeout(() => {
      expect(collisionDetected).toBe(true);
      collider.stopSimulation();
      done();
    }, 1000);
  });

  it('should prevent configuration changes while running', () => {
    collider.startSimulation();

    expect(() => {
      collider.setConfiguration({
        ...collider.getConfiguration(),
        colliderCount: 10,
      });
    }).toThrow(/cannot change configuration/i);

    collider.stopSimulation();
  });
});
```

### Integration Testing Audio Output

Test CV/Gate signal generation:

```typescript
// tests/integration/audio-output.test.ts
import { Collider } from '../../components/utilities/Collider';
import { audioEngine } from '../../core/AudioEngine';

describe('Collider Audio Output', () => {
  it('should connect CV output to audio node', () => {
    const collider = new Collider('test', { x: 100, y: 100 });
    collider.activate();

    const cvNode = collider.getOutputNodeByPort('cv');
    expect(cvNode).not.toBeNull();
    expect(cvNode).toBeInstanceOf(ConstantSourceNode);
  });

  it('should schedule gate envelope correctly', async () => {
    const collider = new Collider('test', { x: 100, y: 100 });
    collider.activate();

    const ctx = audioEngine.getContext();
    const gateNode = collider.getOutputNodeByPort('gate') as ConstantSourceNode;

    // Trigger note (1V, 500ms)
    collider.triggerNote(1.0, 500, ctx.currentTime);

    // Check gate envelope scheduling
    const offset = gateNode.offset;
    expect(offset.value).toBeGreaterThan(0); // Gate triggered

    // Wait for gate to complete
    await new Promise(resolve => setTimeout(resolve, 600));
    expect(offset.value).toBeCloseTo(0, 1); // Gate released
  });
});
```

---

## Common Pitfalls & Debugging

### Memory Leaks

**Problem**: Animation frames not cancelled, audio nodes not disconnected

**Solution**: Always cleanup in `stopSimulation()` and `destroyAudioNodes()`:

```typescript
// WRONG: Missing cleanup
stopSimulation(): void {
  this.isRunning = false;
  // Animation frame still running!
  // Audio nodes still connected!
}

// CORRECT: Proper cleanup
stopSimulation(): void {
  // Cancel animation frame
  if (this.animationFrameId !== null) {
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }

  // Clear physics state
  this.physicsEngine.reset();

  // Reset audio outputs
  if (this.cvNode) {
    const ctx = audioEngine.getContext();
    this.cvNode.offset.cancelScheduledValues(ctx.currentTime);
    this.cvNode.offset.setValueAtTime(0, ctx.currentTime);
  }

  this.isRunning = false;
}
```

**Debugging**: Use Chrome DevTools Performance profiler to detect memory leaks

### Collision Detection Edge Cases

**Problem**: Colliders get stuck overlapping or pass through walls

**Solution**: Add position correction after collision response:

```typescript
// WRONG: Only velocity update
function resolveWallCollision(collider: Collider, side: string): void {
  if (side === 'left') {
    collider.velocity.x = Math.abs(collider.velocity.x); // Reverse velocity
    // But collider might still be inside wall!
  }
}

// CORRECT: Velocity + position correction
function resolveWallCollision(
  collider: Collider,
  side: string,
  boundary: CollisionBoundary
): void {
  if (side === 'left') {
    collider.position.x = boundary.left + collider.radius; // Clamp position
    collider.velocity.x = Math.abs(collider.velocity.x);  // Reverse velocity
  }
}
```

**Debugging**: Add visual debugging mode to render collision boundaries and overlap zones

### Audio Clicks/Pops

**Problem**: Sudden CV voltage changes cause clicks

**Solution**: Use exponential ramps for smooth transitions:

```typescript
// WRONG: Instant CV change
this.cvNode.offset.value = cvVoltage; // Click!

// CORRECT: Smooth ramp
this.cvNode.offset.cancelScheduledValues(now);
this.cvNode.offset.setValueAtTime(this.cvNode.offset.value, now);
this.cvNode.offset.exponentialRampToValueAtTime(targetCV, now + 0.001); // 1ms ramp
```

**Debugging**: Use Oscilloscope component to visualize CV/Gate waveforms

### Performance Issues with Many Colliders

**Problem**: Frame drops with 20+ colliders due to O(n²) collision detection

**Solution**: Optimize collision detection with spatial partitioning (if needed):

```typescript
// Simple optimization: Only check collisions for nearby colliders
function optimizedCollisionDetection(colliders: Collider[]): CollisionEvent[] {
  const events: CollisionEvent[] = [];

  // Use spatial grid for broad-phase collision detection
  const grid = new SpatialGrid(cellSize: 50);
  colliders.forEach(c => grid.insert(c));

  // Only check collisions within same grid cell
  for (const cell of grid.cells) {
    const candidates = cell.colliders;
    for (let i = 0; i < candidates.length - 1; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        if (checkCircleCollision(candidates[i], candidates[j])) {
          events.push(/* ... */);
        }
      }
    }
  }

  return events;
}
```

**Debugging**: Use Chrome DevTools Performance profiler to identify bottlenecks

### Configuration Validation Errors

**Problem**: Invalid configuration crashes simulation

**Solution**: Always validate before applying configuration:

```typescript
// WRONG: No validation
setConfiguration(config: ColliderConfig): void {
  this.config = config; // Might be invalid!
  this.startSimulation(); // Crash!
}

// CORRECT: Validate first
setConfiguration(config: ColliderConfig): void {
  const validation = validateColliderConfig(config);
  if (!validation.isValid) {
    throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
  }

  this.config = config;
}
```

**Debugging**: Add comprehensive error messages in validation functions

---

## Quick Reference

### Essential Imports

```typescript
import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { PhysicsEngine } from '../../physics/PhysicsEngine';
import { MusicalScaleSystem } from '../../music/MusicalScaleSystem';
import { TimingCalculator } from '../../timing/TimingCalculator';
import { validateColliderConfig } from './validation';
import {
  ColliderConfig,
  ScaleType,
  Note,
  SpeedPreset,
  GateSize,
  Collider as ColliderEntity,
  CollisionBoundary,
  CollisionEvent,
} from './contracts';
```

### Common Patterns

**Creating collider instance**:
```typescript
const collider = new Collider('collider-001', { x: 200, y: 150 });
collider.activate(); // Creates audio nodes
```

**Setting configuration**:
```typescript
const config: ColliderConfig = {
  scaleType: ScaleType.MAJOR,
  rootNote: Note.C,
  colliderCount: 5,
  speedPreset: SpeedPreset.MEDIUM,
  bpm: 120,
  gateSize: GateSize.QUARTER,
};
collider.setConfiguration(config);
```

**Starting/stopping simulation**:
```typescript
collider.startSimulation();
// ... simulation runs ...
collider.stopSimulation();
```

**Cleanup**:
```typescript
collider.deactivate(); // Destroys audio nodes
```

---

## Next Steps

1. **Implement contracts**: Create TypeScript interfaces in `/home/mgraute/ai-testing/specs/006-collider-musical-physics/contracts/`
2. **Implement modules**: Create PhysicsEngine, MusicalScaleSystem, TimingCalculator
3. **Implement component**: Create Collider.ts extending SynthComponent
4. **Write tests**: Follow testing strategy above
5. **Register component**: Add to ComponentRegistry and ComponentType enum
6. **Test integration**: Verify with existing components (LFO, Oscillator, etc.)

**See also**:
- `/home/mgraute/ai-testing/specs/006-collider-musical-physics/spec.md` - Functional requirements
- `/home/mgraute/ai-testing/specs/006-collider-musical-physics/plan.md` - Implementation plan
- `/home/mgraute/ai-testing/specs/006-collider-musical-physics/data-model.md` - Complete data model
- `/home/mgraute/ai-testing/src/components/generators/LFO.ts` - Reference component implementation
