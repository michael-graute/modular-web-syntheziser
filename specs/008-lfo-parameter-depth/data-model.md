# Data Model: Parameter-Aware LFO Depth

**Feature**: 008-lfo-parameter-depth | **Date**: 2025-11-10
**Status**: Design Phase 1

---

## Overview

This document describes the data structures and entities required to implement parameter-aware LFO depth calculation. The feature extends the existing modulation system to calculate depth based on target parameter characteristics (min/max bounds, base value) rather than using fixed gain values.

---

## Core Entities

### 1. ModulationConnection (Extension of Connection)

The existing `Connection` interface is extended to include modulation-specific metadata.

**Purpose**: Represents a CV connection from an LFO to a parameter, including metadata for parameter-aware depth calculation.

**Attributes**:
- `id: string` - Unique connection identifier (existing)
- `sourceComponentId: string` - LFO component ID (existing)
- `sourcePortId: string` - LFO output port ID (existing)
- `targetComponentId: string` - Target component ID (existing)
- `targetPortId: string` - Target parameter port ID (existing)
- `signalType: SignalType.CV` - Always CV for modulation (existing)
- `modulationMetadata?: ModulationMetadata` - NEW: Optional modulation-specific data

**ModulationMetadata Structure**:
```typescript
{
  // Cached parameter bounds for calculation
  targetParameterMin: number;
  targetParameterMax: number;

  // Current calculation state
  lastCalculatedDepth: number;        // LFO depth percentage used in last calculation
  lastCalculatedBaseValue: number;    // Parameter base value used in last calculation
  lastCalculatedGain: number;         // Resulting gain node value

  // Calculation timestamp for debugging
  lastCalculatedAt: number;           // Timestamp (Date.now())
}
```

**Rationale**:
- Extends existing Connection interface without breaking changes
- Metadata is optional (backward compatible with non-modulation connections)
- Caches parameter bounds to avoid repeated lookups
- Stores calculation inputs/outputs for debugging and change detection

**Lifecycle**:
1. Created when LFO connects to a parameter (CV signal type)
2. Updated when depth or base value changes
3. Removed when connection is disconnected

---

### 2. Parameter Class Enhancement

The existing `Parameter` class already has modulation support. This feature enhances it with additional methods for depth calculation.

**Existing Relevant Attributes**:
- `min: number` - Parameter minimum bound
- `max: number` - Parameter maximum bound
- `baseValue: number` - User-set center value (modulation offset)
- `isModulated: boolean` - Tracks if parameter receives modulation
- `audioParam: AudioParam | null` - Linked Web Audio API AudioParam

**New Methods** (no new attributes needed):
```typescript
class Parameter {
  // ... existing methods ...

  /**
   * Get available modulation range in upward direction
   * Range from base value to maximum
   */
  getUpwardRange(): number;

  /**
   * Get available modulation range in downward direction
   * Range from minimum to base value
   */
  getDownwardRange(): number;

  /**
   * Check if parameter can be modulated
   * Returns false if min === max (zero range)
   */
  canBeModulated(): boolean;

  /**
   * Get parameter bounds for depth calculation
   * Returns {min, max, baseValue, range}
   */
  getModulationBounds(): ParameterBounds;
}
```

**Rationale**:
- Leverages existing `baseValue` tracking (line 21 in Parameter.ts)
- No schema changes required
- Methods encapsulate range calculation logic
- Type-safe access to bounds for depth calculator

---

### 3. DepthCalculationResult

**Purpose**: Represents the output of parameter-aware depth calculation.

**Attributes**:
```typescript
{
  // Calculated modulation ranges
  upwardRange: number;      // Maximum modulation above base value
  downwardRange: number;    // Maximum modulation below base value

  // Effective gain value to apply to scaling GainNode
  gain: number;             // Averaged gain: (upwardRange + downwardRange) / 2

  // Calculated modulation bounds for UI feedback
  effectiveMin: number;     // base - downwardRange
  effectiveMax: number;     // base + upwardRange

  // Input parameters used (for debugging/validation)
  inputs: {
    parameterMin: number;
    parameterMax: number;
    baseValue: number;
    depthPercent: number;
  };
}
```

**Rationale**:
- Separates upward/downward ranges for asymmetric calculation
- Includes averaged gain for simplified implementation (single GainNode)
- Provides effective bounds for UI display (User Story 3)
- Stores inputs for validation and debugging

**Usage Example**:
```typescript
const result = calculateParameterAwareDepth({
  parameterMin: 1000,
  parameterMax: 15000,
  baseValue: 7000,
  depthPercent: 50
});

// result = {
//   upwardRange: 3500,    // (15000 - 7000) * 0.5
//   downwardRange: 3500,  // (7000 - 1000) * 0.5
//   gain: 3500,           // (3500 + 3500) / 2 (symmetric case)
//   effectiveMin: 3500,   // 7000 - 3500
//   effectiveMax: 10500,  // 7000 + 3500
//   inputs: { ... }
// }
```

---

### 4. ModulationScalingNode

**Purpose**: Tracks the Web Audio API GainNode used for per-connection depth scaling.

**Structure**:
```typescript
{
  connectionId: string;           // Links to Connection.id
  scalingGainNode: GainNode;      // Web Audio API GainNode instance
  sourceNode: AudioNode;          // LFO output node (for cleanup)
  targetParam: AudioParam;        // Target parameter's AudioParam (for cleanup)
  isConnected: boolean;           // Track connection state
}
```

**Storage**: Managed by `ConnectionManager` in a Map:
```typescript
private modulationScalingNodes: Map<string, ModulationScalingNode>
```

**Rationale**:
- One scaling GainNode per CV connection
- ConnectionManager owns lifecycle (create on connect, cleanup on disconnect)
- Stores references needed for audio graph manipulation
- Map keyed by connection ID for O(1) lookup

**Audio Graph Structure**:
```
Before (current):
LFO.gainNode → targetParam

After (with parameter-aware depth):
LFO.gainNode → scalingGainNode → targetParam
                     ↑
              (gain value = calculated depth-aware gain)
```

---

## Data Flow

### Connection Creation Flow

```
1. User connects LFO to parameter via ConnectionManager
   ↓
2. ConnectionManager creates Connection data model
   ↓
3. System detects signalType === SignalType.CV
   ↓
4. Retrieve target Parameter instance
   ↓
5. Calculate initial DepthCalculationResult
   - parameterMin/Max from Parameter.min/max
   - baseValue from Parameter.baseValue
   - depthPercent from LFO depth parameter
   ↓
6. Create ModulationScalingNode
   - Instantiate GainNode from AudioContext
   - Set gain.value = result.gain
   ↓
7. Insert into audio graph
   - Connect: LFO.gainNode → scalingGainNode → targetParam
   ↓
8. Store ModulationScalingNode in ConnectionManager map
   ↓
9. Add ModulationMetadata to Connection
   ↓
10. Emit CONNECTION_ADDED event
```

### Depth/Base Value Change Flow

```
1. User adjusts LFO depth or parameter base value
   ↓
2. Event emitted (PARAMETER_CHANGED)
   ↓
3. ModulationUpdateHandler receives event
   ↓
4. Lookup affected connections (by source or target component)
   ↓
5. For each affected connection:
   a. Retrieve current Parameter bounds
   b. Retrieve current LFO depth
   c. Recalculate DepthCalculationResult
   d. Update scalingGainNode.gain.value
   e. Update Connection.modulationMetadata
   ↓
6. No audio graph reconnection needed (just gain value update)
```

### Connection Removal Flow

```
1. User deletes connection via ConnectionManager
   ↓
2. ConnectionManager.removeConnection(connectionId)
   ↓
3. Lookup ModulationScalingNode by connectionId
   ↓
4. Disconnect audio graph
   - scalingGainNode.disconnect(targetParam)
   - sourceNode.disconnect(scalingGainNode)
   ↓
5. Remove ModulationScalingNode from map
   ↓
6. Remove Connection from connections map
   ↓
7. Update target Parameter.isModulated = false
   ↓
8. Emit CONNECTION_REMOVED event
```

---

## State Diagrams

### ModulationConnection State Transitions

```
                    [User connects LFO to parameter]
                                ↓
                          INITIALIZING
                                ↓
                    [Calculate initial depth]
                                ↓
                     [Create scaling GainNode]
                                ↓
                              ACTIVE ←──────────┐
                                ↓               │
                    [Depth or base value changes]
                                ↓               │
                           RECALCULATING        │
                                ↓               │
                    [Update GainNode value]     │
                                ↓───────────────┘
                                ↓
                    [User disconnects]
                                ↓
                           DISCONNECTING
                                ↓
                    [Cleanup audio graph]
                                ↓
                             REMOVED
```

### Parameter Modulation State

```
                      [Parameter created]
                                ↓
                          UNMODULATED
                  (isModulated = false)
                                ↓
                    [LFO connected]
                                ↓
                           MODULATED
                  (isModulated = true)
                                ↓
                    [Base value changes]
                                ↓
                    [Trigger recalculation]
                                ↓
                           MODULATED
                  (updated gain value)
                                ↓
                    [LFO disconnected]
                                ↓
                          UNMODULATED
```

---

## Relationship Diagrams

### Entity Relationships

```
┌─────────────────┐
│      LFO        │
│  Component      │
│                 │
│ - depth: 0-100% │
└────────┬────────┘
         │ 1
         │ outputs
         │ N
         ↓
┌─────────────────────┐         ┌──────────────────┐
│  ModulationConnection│ 1:1    │ ModulationScaling│
│                     │◄────────┤      Node        │
│ - id                │         │                  │
│ - sourceComponentId │         │ - scalingGainNode│
│ - targetComponentId │         │ - connectionId   │
│ - modulationMetadata│         └──────────────────┘
└────────┬────────────┘
         │ 1
         │ targets
         │ 0..1 (exclusive)
         ↓
┌─────────────────┐
│   Parameter     │
│                 │
│ - min           │
│ - max           │
│ - baseValue     │
│ - isModulated   │
└─────────────────┘
```

**Key Constraints**:
- One LFO can modulate N parameters (1:N)
- One parameter can be modulated by at most one LFO (0..1:1)
- Each ModulationConnection has exactly one ModulationScalingNode (1:1)
- All connections share the same LFO depth value

---

## Data Validation Rules

### Connection Creation Validation

1. **Signal Type Check**: `connection.signalType === SignalType.CV`
2. **Source Component Type**: Source must be LFO component
3. **Target Parameter Exists**: Target component must have specified parameter
4. **Exclusive Modulation**: Target parameter must not be already modulated
5. **Valid Parameter Range**: `parameter.max > parameter.min` (non-zero range)

### Depth Calculation Validation

1. **Depth Range**: `0 <= depthPercent <= 100`
2. **Base Value Bounds**: `parameter.min <= baseValue <= parameter.max`
3. **Parameter Range**: `parameter.max > parameter.min`
4. **Numerical Stability**: All values must be finite numbers (not NaN, not Infinity)

### Runtime State Validation

1. **GainNode Existence**: scalingGainNode must exist for each active CV connection
2. **Audio Graph Integrity**: scalingGainNode must be connected in audio graph
3. **Metadata Consistency**: Connection.modulationMetadata must match current state
4. **Parameter Modulation Flag**: Parameter.isModulated must be true when connections exist

---

## Edge Cases

### Zero Range Parameter
**Condition**: `parameter.min === parameter.max`
**Behavior**:
- `canBeModulated()` returns false
- Connection creation is blocked with validation error
- If parameter bounds change to zero range while modulated, gain is set to 0

### Base Value at Boundary
**Condition**: `baseValue === parameter.min` or `baseValue === parameter.max`
**Behavior**:
- Unidirectional modulation (only up or down)
- Calculated gain still uses averaged formula
- Example: base=max, depth=50%
  - upwardRange = 0 (no room above)
  - downwardRange = (max - min) * 0.5
  - gain = downwardRange / 2 (averaged, but will only modulate downward)

### Base Value Outside Range
**Condition**: `baseValue < parameter.min` or `baseValue > parameter.max` (should never happen)
**Behavior**:
- Validation error logged to console
- Clamp baseValue to [min, max] before calculation
- Trigger parameter update to correct state

### Negative Parameter Range
**Condition**: `parameter.min < 0` (e.g., min=-10, max=10)
**Behavior**:
- Calculation works identically (arithmetic is sign-agnostic)
- Example: base=0, depth=50%, range=-10 to 10
  - upwardRange = (10 - 0) * 0.5 = 5
  - downwardRange = (0 - (-10)) * 0.5 = 5
  - effectiveRange: -5 to 5

### Very Small Ranges
**Condition**: `(parameter.max - parameter.min) < 0.001`
**Behavior**:
- Calculation proceeds normally (no special handling)
- Gain values will be very small but proportional
- UI display may need rounding for readability

---

## Performance Characteristics

### Memory Overhead
- **Per Connection**: ~1KB for GainNode + ~200 bytes for ModulationMetadata
- **100 Connections**: ~120KB total overhead
- **Negligible Impact**: Modern systems handle this easily

### Computation Overhead
- **Initial Calculation**: ~0.05ms (5 arithmetic operations)
- **Recalculation on Change**: ~0.05ms (event-driven, not continuous)
- **Audio Processing**: Zero JavaScript overhead (native GainNode scaling)
- **Meets SC-003**: Well under 1ms requirement

### Event Load
- **Typical Use**: 1-5 depth/base value changes per second (user interaction)
- **Worst Case**: 60 changes/second (parameter automation at 60 FPS)
- **Impact**: Negligible (5 arithmetic ops at 60 Hz = 3000 ops/sec, trivial load)

---

## Backward Compatibility

### Existing Patches
**Challenge**: Old patches don't have ModulationMetadata in connections.

**Migration Strategy**:
1. Detect connections with `signalType === CV` and no `modulationMetadata`
2. On patch load, add default ModulationMetadata with:
   - `lastCalculatedDepth = 50` (default LFO depth)
   - `lastCalculatedBaseValue` from parameter current value
   - Trigger initial calculation
3. Mark patch as dirty to prompt save with updated format

**User Impact**: Existing patches may sound slightly different if LFO depth was not at 50%. Provide migration dialog explaining parameter-aware depth calculation.

### API Compatibility
- `Connection` interface extended (optional field = backward compatible)
- `Parameter` class methods added (non-breaking addition)
- `ConnectionManager` enhanced internally (no public API change)

---

## Future Enhancements

### Precise Asymmetric Scaling
**Goal**: Handle extreme asymmetry cases with higher accuracy.

**Approach**:
1. Split LFO signal into positive/negative components using WaveShaperNode
2. Scale each component independently (two GainNodes)
3. Recombine scaled signals before target AudioParam

**Complexity**: 3x audio nodes per connection, more complex audio graph.

**Decision**: Deferred until user feedback indicates need.

### Visual Modulation Range Display
**Goal**: Show real-time modulation range on parameter controls (User Story 3).

**Approach**:
1. Subscribe to depth/base value change events
2. Retrieve `DepthCalculationResult.effectiveMin/Max`
3. Render range indicator on parameter slider/knob
4. Update at UI frame rate (60 FPS)

**Data Flow**: Uses `effectiveMin` and `effectiveMax` from DepthCalculationResult.

**Decision**: Priority P3, implemented after core functionality (P1-P2).

### Multi-LFO Modulation Matrix
**Goal**: Allow multiple LFOs to modulate a single parameter with blending.

**Approach**:
1. Change constraint from 0..1 to 0..N LFOs per parameter
2. Add blending modes (add, multiply, replace)
3. Manage multiple ModulationScalingNodes per parameter

**Complexity**: Significant - requires rethinking connection exclusivity.

**Decision**: Out of scope (FR-013 explicitly enforces single LFO per parameter).

---

## Summary

This data model extends the existing modulation system with:
1. **ModulationConnection**: Extended Connection with optional modulation metadata
2. **Parameter Enhancements**: Methods for range calculation and modulation bounds
3. **DepthCalculationResult**: Structured output with asymmetric range support
4. **ModulationScalingNode**: Per-connection GainNode for audio graph scaling

The design is:
- **Backward compatible**: Optional metadata, non-breaking API changes
- **Performant**: Event-driven calculation, native audio-rate processing
- **Extensible**: Supports future enhancements (precise asymmetry, visual feedback)
- **Type-safe**: Full TypeScript contracts for compile-time validation

All entities and relationships follow existing codebase patterns (Parameter class, Connection interface, ConnectionManager ownership).
