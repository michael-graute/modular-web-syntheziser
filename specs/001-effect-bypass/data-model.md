# Data Model: Effect Bypass Toggle

**Feature**: 001-effect-bypass
**Date**: 2025-10-29

## Overview

This document defines the data structures and state management for the effect bypass feature. The bypass functionality adds a boolean state property to components and extends the patch serialization format.

## Core Entities

### Component Bypass State

**Entity**: Bypass State
**Scope**: Per-component instance
**Lifecycle**: Created with component, persisted in patches, destroyed with component

**Properties**:
| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `isBypassed` | boolean | Yes | false | Whether the component is currently bypassed |

**Business Rules**:
- Only applicable to effect and processor components (Filter, VCA, Envelopes, Delay, Reverb, Mixer)
- NOT applicable to generators (Oscillator, LFO, Noise)
- NOT applicable to inputs/outputs (Keyboard Input, Master Output)
- Analyzer components (Oscilloscope) may have bypass but handle it differently
- Default state is always `false` (not bypassed) for new components
- State persists across patch save/load operations

**State Transitions**:
```
[Not Bypassed] ←→ [Bypassed]
      ↑              ↑
      │              │
   default      user toggle
```

**Validation Rules**:
- Must be a boolean value (true/false)
- Cannot be undefined for applicable components
- Should be excluded from serialization for non-applicable components

---

### Extended ComponentData Interface

**Entity**: ComponentData (Extended)
**Purpose**: Patch serialization format
**Location**: `src/core/types.ts`

**Current Structure** (Existing):
```typescript
export interface ComponentData {
  id: string;
  type: ComponentType;
  position: Position;
  parameters: Record<string, number>;
}
```

**Extended Structure** (New):
```typescript
export interface ComponentData {
  id: string;
  type: ComponentType;
  position: Position;
  parameters: Record<string, number>;
  isBypassed?: boolean; // NEW: Optional for backward compatibility
}
```

**Field Specifications**:
- `isBypassed`: Optional boolean
  - Present and `true`: Component is bypassed
  - Present and `false`: Component is not bypassed
  - Absent (undefined): Treated as `false` (backward compatibility)
  - Should only be present for applicable component types

**Backward Compatibility**:
- Optional field ensures old patches can be loaded without errors
- Missing field defaults to `false` (not bypassed)
- No migration required for existing patches
- New patches will include field for all applicable components

---

### SynthComponent Extension

**Entity**: SynthComponent (Base Class)
**File**: `src/components/base/SynthComponent.ts`

**New Properties**:
```typescript
export abstract class SynthComponent {
  // ... existing properties ...

  // NEW: Bypass state
  private _isBypassed: boolean = false;
  private _bypassConnections: Array<{
    from: AudioNode;
    to: AudioNode;
  }> = [];

  // Accessor methods
  get isBypassed(): boolean {
    return this._isBypassed;
  }
}
```

**New Methods**:
```typescript
// Set bypass state and reconfigure audio graph
setBypass(bypassed: boolean): void;

// Helper methods for subclasses
protected setupBypass(): void;
protected teardownBypass(): void;
```

**Internal State**:
- `_isBypassed`: Current bypass state (private)
- `_bypassConnections`: Stores original connections for restoration (private)
- Exposed via public getter for read access
- Modified only via `setBypass()` method

---

## Data Flow

### User Action Flow

```
User clicks bypass button
          ↓
Canvas detects click event
          ↓
CanvasComponent.toggleBypass() called
          ↓
SynthComponent.setBypass(newState) called
          ↓
Audio graph reconfigured
          ↓
Visual state updated (re-render)
          ↓
Event emitted (optional)
```

### Audio Graph Reconfiguration

**Not Bypassed** (Normal operation):
```
Input Port → Processing AudioNode(s) → Output Port
```

**Bypassed** (Direct connection):
```
Input Port ─────────────────────────→ Output Port
            (Processing nodes disconnected)
```

**State Tracking**:
```typescript
// Store connections before bypass
_bypassConnections = [
  { from: inputNode, to: processingNode },
  { from: processingNode, to: outputNode }
];

// Bypass: Direct connection
inputNode.disconnect();
processingNode.disconnect();
inputNode.connect(outputNode);

// Restore: Rebuild from stored connections
inputNode.disconnect();
_bypassConnections.forEach(conn => {
  conn.from.connect(conn.to);
});
```

### Patch Serialization Flow

**Save Patch**:
```
Component instances
      ↓
Extract ComponentData
      ↓
Include isBypassed field (if applicable)
      ↓
JSON.stringify()
      ↓
localStorage.setItem()
```

**Load Patch**:
```
localStorage.getItem()
      ↓
JSON.parse()
      ↓
Create component instances
      ↓
Restore parameters
      ↓
Apply isBypassed state (if present)
      ↓
Rebuild audio graph
```

---

## Storage Schema

### LocalStorage Format

**Key**: `modular-synth-patches` (existing)

**Value Structure**:
```json
{
  "patchName": {
    "name": "My Patch",
    "timestamp": 1698765432000,
    "components": [
      {
        "id": "comp-1",
        "type": "DELAY",
        "position": { "x": 100, "y": 200 },
        "parameters": {
          "time": 0.5,
          "feedback": 0.3,
          "mix": 0.5
        },
        "isBypassed": true  // NEW FIELD
      },
      {
        "id": "comp-2",
        "type": "OSCILLATOR",
        "position": { "x": 50, "y": 100 },
        "parameters": {
          "frequency": 440,
          "detune": 0
        }
        // No isBypassed field for generators
      }
    ],
    "connections": [ /* ... */ ]
  }
}
```

**Size Impact**:
- Adds ~20 bytes per bypassable component when true
- Minimal impact on storage quota (patches typically < 100KB)
- No compression needed at this scale

---

## Component Type Classification

### Bypassable Components
These components MUST support bypass functionality:

**Processors**:
- Filter
- VCA
- ADSR Envelope
- Filter Envelope

**Effects**:
- Delay
- Reverb
- Distortion (if exists)
- Chorus (if exists)

**Utilities**:
- Mixer

### Non-Bypassable Components
These components MUST NOT have bypass functionality:

**Generators** (signal sources):
- Oscillator
- LFO
- Noise

**I/O**:
- Keyboard Input
- Master Output

**Analyzers** (special case):
- Oscilloscope: Can disable visualization but not audio passthrough

---

## Validation Rules

### Runtime Validation

**On Bypass Toggle**:
1. Verify component type is bypassable
2. Check audio context state is "running"
3. Validate all input/output nodes exist
4. Ensure no circular dependencies in graph

**On Patch Load**:
1. Validate `isBypassed` is boolean if present
2. Ignore field for non-bypassable components
3. Default to `false` if field is missing
4. Apply bypass state after audio graph is fully constructed

### Error Handling

**Invalid Bypass Attempt**:
```typescript
if (!this.isBypassable()) {
  console.warn(`Component type ${this.type} does not support bypass`);
  return;
}
```

**Audio Context Issues**:
```typescript
if (audioContext.state !== 'running') {
  console.warn('Cannot change bypass state while audio context is suspended');
  return;
}
```

---

## Performance Considerations

### Memory Impact
- Adds 1 byte (boolean) per component instance
- Adds variable storage for connection tracking (typically 2-10 connections)
- Total per-component overhead: < 100 bytes

### CPU Impact
- Bypass toggle: O(N) where N = number of connections (typically < 10)
- No ongoing processing overhead when bypassed (zero CPU for processing)
- Canvas render: Minimal (alpha blending check)

### Audio Latency
- No additional latency when bypassed (direct connection)
- Potential for single-sample click on toggle (mitigated by scheduling)

---

## Example Scenarios

### Example 1: Simple Effect Bypass

**Initial State**:
```typescript
Component: Delay
isBypassed: false
Connections: Input → DelayNode → Output
```

**After Bypass Toggle**:
```typescript
Component: Delay
isBypassed: true
Connections: Input → Output (direct)
DelayNode: disconnected but parameters preserved
```

**After Re-Enable**:
```typescript
Component: Delay
isBypassed: false
Connections: Input → DelayNode → Output (restored)
DelayNode: reconnected with same parameters
```

### Example 2: Chained Effects

**Setup**:
```
Oscillator → Filter (bypassed) → Delay → Output
```

**Audio Flow**:
```
Oscillator → [Filter bypassed] → Delay → Output
           ↓
         Filter processing skipped, audio passes through
```

**All Parameters Maintained**:
- Filter cutoff: 1000 Hz (preserved but not applied)
- Filter resonance: 0.5 (preserved but not applied)
- Delay time: 0.5s (active and processing)

### Example 3: Patch Save/Load

**Patch Data**:
```json
{
  "components": [
    {
      "id": "filter-1",
      "type": "FILTER",
      "isBypassed": true,
      "parameters": {
        "type": 0,
        "cutoff": 1000,
        "resonance": 0.5
      }
    }
  ]
}
```

**On Load**:
1. Create Filter component
2. Set parameters (cutoff, resonance)
3. Apply bypass state: `filter.setBypass(true)`
4. Component renders dimmed
5. Audio passes through unfiltered
6. Parameters are ready for when bypass is disabled

---

## Testing Checklist

### Data Integrity
- [ ] Bypass state persists across save/load
- [ ] Parameters preserved during bypass
- [ ] Connections maintained in graph
- [ ] Backward compatibility with old patches

### Audio Correctness
- [ ] Bypassed component passes audio unprocessed
- [ ] No clicks/pops on bypass toggle
- [ ] CV/Gate connections remain active
- [ ] Chained effects work correctly

### Visual Feedback
- [ ] Button shows correct state
- [ ] Component appears dimmed when bypassed
- [ ] State visible at normal viewing distance

### Edge Cases
- [ ] Bypass during active audio processing
- [ ] Rapid toggle (stress test)
- [ ] Bypass before audio context starts
- [ ] Multiple components bypassed simultaneously
- [ ] Bypass in feedback loops
