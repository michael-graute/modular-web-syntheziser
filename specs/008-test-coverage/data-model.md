# Data Model: Test Coverage Infrastructure

**Feature**: 008-test-coverage
**Date**: 2026-01-12
**Status**: Complete

## Overview

This document defines the structure of test fixtures, mock objects, and coverage thresholds for the comprehensive test suite. All schemas are based on decisions from [research.md](./research.md).

---

## Test Fixtures

Test fixtures provide reusable test data for patches, components, and connections. Implemented as factory functions with optional overrides (see research.md RT-004).

### Component Fixture Schema

**Purpose**: Create sample SynthComponent instances for testing

**Factory Function Signature**:
```typescript
createTest[ComponentType](overrides?: Partial<SynthComponent>): SynthComponent
```

**Base Component Structure**:
```typescript
interface SynthComponent {
  id: string;              // Unique identifier (e.g., "osc-abc123")
  type: ComponentType;     // OSCILLATOR, FILTER, ENVELOPE, etc.
  position: Position;      // { x: number, y: number }
  parameters: Record<string, any>;  // Component-specific parameters
  inputs: string[];        // Input port types (e.g., ["audio", "cv"])
  outputs: string[];       // Output port types (e.g., ["audio"])
}
```

**Available Fixture Functions**:

| Function | Component Type | Default Parameters |
|----------|----------------|-------------------|
| `createTestOscillator()` | OSCILLATOR | waveform: 'sine', frequency: 440, detune: 0 |
| `createTestFilter()` | FILTER | type: 'lowpass', frequency: 1000, resonance: 0 |
| `createTestEnvelope()` | ENVELOPE | attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 |
| `createTestLFO()` | LFO | waveform: 'sine', frequency: 1, depth: 0.5 |
| `createTestVCA()` | VCA | gain: 0.5 |
| `createTestOutput()` | OUTPUT | gain: 1.0 |
| `createTestKeyboard()` | KEYBOARD | octave: 4 |
| `createTestSequencer()` | SEQUENCER | steps: 16, bpm: 120 |

**Example Usage**:
```typescript
// Default oscillator
const osc = createTestOscillator();
// { id: "osc-xyz", type: OSCILLATOR, position: {x: 100, y: 100}, ... }

// Custom parameters
const osc440 = createTestOscillator({
  parameters: { frequency: 880 },
  position: { x: 200, y: 150 }
});
```

### Connection Fixture Schema

**Purpose**: Create sample Connection objects linking components

**Structure**:
```typescript
interface Connection {
  from: {
    componentId: string;
    portIndex: number;
  };
  to: {
    componentId: string;
    portIndex: number;
  };
}
```

**Factory Function**:
```typescript
createTestConnection(
  fromId: string,
  toId: string,
  fromPort: number = 0,
  toPort: number = 0
): Connection
```

**Example**:
```typescript
const conn = createTestConnection('osc1', 'filter1');
// { from: { componentId: 'osc1', portIndex: 0 }, to: { componentId: 'filter1', portIndex: 0 } }
```

### Patch Fixture Schema

**Purpose**: Create complete Patch objects with multiple components and connections

**Structure**:
```typescript
interface Patch {
  name: string;
  components: SynthComponent[];
  connections: Connection[];
}
```

**Available Fixture Functions**:

| Function | Description | Components | Connections |
|----------|-------------|------------|-------------|
| `createEmptyPatch()` | Empty patch | 0 | 0 |
| `createSimplePatch()` | Basic oscillator → filter | 2 | 1 |
| `createComplexPatch()` | Multi-oscillator routing | 5 | 8 |
| `createSubtractivePatch()` | Classic subtractive synthesis | 6 | 7 |
| `createFMPatch()` | Frequency modulation setup | 4 | 4 |

**Simple Patch Structure**:
```typescript
createSimplePatch() returns:
{
  name: "Test Patch",
  components: [
    Oscillator (id: "osc1", freq: 440Hz, sine wave),
    Filter (id: "filter1", lowpass 1kHz)
  ],
  connections: [
    osc1:output[0] → filter1:input[0]
  ]
}
```

**Complex Patch Structure**:
```typescript
createComplexPatch() returns:
{
  name: "Complex Test Patch",
  components: [
    Oscillator (id: "osc1"),
    Oscillator (id: "osc2"),
    Filter (id: "filter1"),
    Filter (id: "filter2"),
    Output (id: "output")
  ],
  connections: [
    osc1 → filter1,
    osc2 → filter2,
    filter1 → output,
    filter2 → output,
    // + 4 more modulation connections
  ]
}
```

---

## Mock Objects

Mock objects simulate Web Audio API, localStorage, and DOM APIs for isolated testing.

### Web Audio API Mocks

**MockAudioContext**

**Purpose**: Simulate BaseAudioContext without actual audio processing

**Interface**:
```typescript
class MockAudioContext implements Partial<BaseAudioContext> {
  // State tracking
  state: AudioContextState;        // 'suspended' | 'running' | 'closed'
  sampleRate: number;              // 44100
  currentTime: number;             // 0.0
  destination: AudioDestinationNode;

  // Node creation
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
  createBiquadFilter(): BiquadFilterNode;
  createAnalyser(): AnalyserNode;

  // State methods
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;

  // Test utilities
  getConnectedNodes(): AudioNode[];
  reset(): void;
}
```

**MockAudioNode**

**Purpose**: Base class for all audio node mocks

**Interface**:
```typescript
class MockAudioNode implements Partial<AudioNode> {
  id: string;                      // Unique identifier for testing
  context: AudioContext;
  connections: AudioNode[];        // Track outgoing connections
  numberOfInputs: number;
  numberOfOutputs: number;

  connect(destination: AudioNode, outputIndex?: number, inputIndex?: number): AudioNode;
  disconnect(): void;

  // Test utilities
  getConnections(): AudioNode[];
  isConnectedTo(node: AudioNode): boolean;
}
```

**MockOscillatorNode**

**Purpose**: Mock oscillator with frequency/detune parameters

**Interface**:
```typescript
class MockOscillatorNode extends MockAudioNode implements Partial<OscillatorNode> {
  type: OscillatorType;            // 'sine' | 'square' | 'sawtooth' | 'triangle'
  frequency: MockAudioParam;       // Default: 440 Hz
  detune: MockAudioParam;          // Default: 0

  start(when?: number): void;
  stop(when?: number): void;

  // Test utilities
  isStarted: boolean;
  isStopped: boolean;
}
```

**MockGainNode**

**Purpose**: Mock gain with volume parameter

**Interface**:
```typescript
class MockGainNode extends MockAudioNode implements Partial<GainNode> {
  gain: MockAudioParam;            // Default: 1.0
}
```

**MockAudioParam**

**Purpose**: Mock AudioParam for parameter automation

**Interface**:
```typescript
class MockAudioParam implements Partial<AudioParam> {
  private _value: number;

  get value(): number;
  set value(val: number);

  defaultValue: number;
  minValue: number;
  maxValue: number;

  setValueAtTime(value: number, startTime: number): this;
  linearRampToValueAtTime(value: number, endTime: number): this;
  exponentialRampToValueAtTime(value: number, endTime: number): this;

  // Test utilities
  getScheduledValues(): Array<{value: number, time: number}>;
}
```

### LocalStorage Mock

**MockLocalStorage**

**Purpose**: In-memory localStorage for testing without browser persistence

**Interface**:
```typescript
class MockLocalStorage implements Storage {
  private data: Map<string, string>;

  get length(): number;

  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(index: number): string | null;

  // Test utilities
  getAllKeys(): string[];
  getAllValues(): Record<string, string>;
}
```

**Behavior**:
- Stores data in `Map<string, string>` (mimics browser localStorage)
- `setItem` throws if quota exceeded (optional, configurable)
- Resets to empty state between tests (via `afterEach` hook)

### DOM Event Mocks

**Purpose**: Simulate mouse/touch events for canvas interaction testing

**Mouse Event Factory**:
```typescript
function createMouseEvent(
  type: 'mousedown' | 'mousemove' | 'mouseup' | 'click',
  options: {
    clientX: number;
    clientY: number;
    button?: number;       // 0=left, 1=middle, 2=right
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  }
): MouseEvent
```

**Touch Event Factory**:
```typescript
function createTouchEvent(
  type: 'touchstart' | 'touchmove' | 'touchend',
  touches: Array<{
    identifier: number;
    clientX: number;
    clientY: number;
  }>
): TouchEvent
```

**Example Usage**:
```typescript
const mouseDown = createMouseEvent('mousedown', {
  clientX: 100,
  clientY: 50,
  button: 0, // Left click
});

const touch = createTouchEvent('touchstart', [
  { identifier: 1, clientX: 100, clientY: 50 }
]);
```

---

## Coverage Thresholds

Coverage requirements per module as defined in spec.md FR-009.

### Global Thresholds

**Minimum coverage for entire codebase**:

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Lines | 60% | Baseline for critical path coverage |
| Functions | 60% | Most functions should be tested |
| Branches | 60% | Edge cases covered |
| Statements | 60% | Overall code execution |

### Module-Specific Thresholds

**AudioEngine module** (src/audio/AudioEngine.ts):

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Lines | 70% | Critical audio routing logic |
| Functions | 75% | All public methods tested |
| Branches | 65% | State transitions covered |
| Statements | 70% | Initialization + connection logic |

**PatchSerializer module** (src/persistence/PatchSerializer.ts):

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Lines | 80% | Data integrity critical |
| Functions | 85% | All serialization paths tested |
| Branches | 75% | Handle all data types |
| Statements | 80% | JSON parsing + validation |

**PatchStorage module** (src/persistence/PatchStorage.ts):

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Lines | 75% | Save/load critical for user data |
| Functions | 80% | All CRUD operations tested |
| Branches | 70% | Error handling covered |
| Statements | 75% | localStorage interaction logic |

**Canvas module** (src/canvas/Canvas.ts):

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Lines | 50% | UI code harder to test |
| Functions | 55% | Focus on interaction handlers |
| Branches | 45% | Many conditional rendering paths |
| Statements | 50% | Drag-drop + viewport tested |

### Excluded from Coverage

Files excluded from coverage requirements:

- **src/main.ts**: Entry point, no business logic
- **src/**/*.d.ts**: TypeScript declaration files
- **src/**/*.test.ts**: Test files themselves
- **src/types/**: Type definitions only

---

## Test Data Volumes

Expected test data sizes for performance validation (must complete in < 10s total).

### Unit Tests

| Module | Test Files | Test Cases | Avg Duration |
|--------|-----------|------------|--------------|
| AudioEngine | 1 | 12-15 | ~500ms |
| PatchSerializer | 1 | 10-12 | ~300ms |
| PatchStorage | 1 | 8-10 | ~400ms |
| Canvas (drag) | 1 | 6-8 | ~600ms |
| Canvas (connection) | 1 | 6-8 | ~600ms |
| Canvas (viewport) | 1 | 5-7 | ~500ms |
| Utilities (existing) | 3 | 20-25 | ~1000ms |

**Total Unit Tests**: ~70 test cases, ~4 seconds

### Integration Tests

| Module | Test Files | Test Cases | Avg Duration |
|--------|-----------|------------|--------------|
| AudioEngine | 1 | 5-7 | ~1000ms |
| Full patch save/load | 1 | 3-5 | ~500ms |

**Total Integration Tests**: ~10 test cases, ~1.5 seconds

**Overall Test Suite**: ~80 test cases, ~5.5 seconds (well under 10s requirement)

---

## Mock Object Relationships

**Dependency graph**:

```
MockAudioContext
├── creates → MockOscillatorNode
├── creates → MockGainNode
├── creates → MockBiquadFilterNode
└── creates → MockAnalyserNode

MockAudioNode (base class)
├── extended by → MockOscillatorNode
├── extended by → MockGainNode
├── extended by → MockBiquadFilterNode
└── extended by → MockAnalyserNode

MockAudioParam
├── used by → MockOscillatorNode.frequency
├── used by → MockOscillatorNode.detune
├── used by → MockGainNode.gain
└── used by → MockBiquadFilterNode.frequency/Q/gain

MockLocalStorage
└── used by → PatchStorage tests
```

---

## Fixture Composition

**How fixtures build on each other**:

```
createTestOscillator()
  └── used by → createSimplePatch()
                  └── used by → PatchSerializer tests

createTestFilter()
  └── used by → createSimplePatch()
                  └── used by → PatchSerializer tests

createSimplePatch()
  └── used by → PatchStorage.test.ts
  └── used by → AudioEngine.integration.test.ts

createComplexPatch()
  └── used by → PatchSerializer.test.ts (edge case testing)
  └── used by → PatchStorage.test.ts (performance testing)
```

---

## Assertion Helpers

Reusable assertion functions for common test scenarios (implemented in contracts/assertion-helpers.ts).

### Component Assertions

```typescript
/**
 * Assert two components are deeply equal
 */
function expectComponentsEqual(
  actual: SynthComponent,
  expected: SynthComponent
): void

/**
 * Assert component has valid structure
 */
function expectValidComponent(component: SynthComponent): void

/**
 * Assert component has specific parameter value
 */
function expectParameter(
  component: SynthComponent,
  paramName: string,
  expectedValue: any
): void
```

### Connection Assertions

```typescript
/**
 * Assert connection exists between two components
 */
function expectConnection(
  connections: Connection[],
  fromId: string,
  toId: string
): void

/**
 * Assert connection count matches expected
 */
function expectConnectionCount(
  connections: Connection[],
  expected: number
): void
```

### Patch Assertions

```typescript
/**
 * Assert patch serialization preserves all data
 */
function expectPatchIntegrity(
  original: Patch,
  restored: Patch
): void

/**
 * Assert patch JSON is valid
 */
function expectValidPatchJSON(json: string): void
```

### Audio Assertions

```typescript
/**
 * Assert audio node is connected to another
 */
function expectAudioConnection(
  from: MockAudioNode,
  to: MockAudioNode
): void

/**
 * Assert AudioContext state matches expected
 */
function expectContextState(
  context: MockAudioContext,
  state: AudioContextState
): void
```

---

## Summary

**Test Fixtures**: 8 component factories, 5 patch factories, connection factory
**Mock Objects**: MockAudioContext + 5 node types, MockLocalStorage, event factories
**Coverage Thresholds**: Global 60%, AudioEngine 70%, PatchSerializer 80%, Canvas 50%
**Test Data Volume**: ~80 test cases, ~5.5 seconds total runtime

All schemas align with decisions in research.md and functional requirements in spec.md. Ready for contract implementation in Phase 1.
