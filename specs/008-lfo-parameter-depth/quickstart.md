# Developer Quickstart: Parameter-Aware LFO Depth

**Feature**: 008-lfo-parameter-depth | **Date**: 2025-11-10
**Status**: Design Phase 1

---

## Overview

This guide helps developers work with the parameter-aware depth system. You'll learn how to:
- Calculate parameter-aware modulation ranges
- Integrate depth calculation into connection management
- Handle edge cases and validation errors
- Test the depth calculation system

---

## Quick Start

### Basic Usage: Calculating Depth

```typescript
import {
  calculateParameterAwareDepth,
  validateDepthCalculationInput
} from './depth-calculator';
import type { DepthCalculationInput } from './contracts/types';

// Define your input parameters
const input: DepthCalculationInput = {
  parameterMin: 1000,
  parameterMax: 15000,
  baseValue: 7000,
  depthPercent: 50,
};

// Validate input before calculation
const validation = validateDepthCalculationInput(input);
if (!validation.valid) {
  console.error('Validation failed:', validation.error.message);
  return;
}

// Calculate depth
const result = calculateParameterAwareDepth(input);

// Apply to GainNode
scalingGainNode.gain.setValueAtTime(
  result.gain,
  audioContext.currentTime
);

// Display range to user (optional)
console.log(`Modulation range: ${result.effectiveMin} - ${result.effectiveMax}`);
```

**Expected Result**:
```typescript
{
  upwardRange: 3500,    // (15000 - 7000) * 0.5
  downwardRange: 3500,  // (7000 - 1000) * 0.5
  gain: 3500,           // (3500 + 3500) / 2
  effectiveMin: 3500,   // 7000 - 3500
  effectiveMax: 10500,  // 7000 + 3500
  inputs: { ... }
}
```

---

## Core Concepts

### 1. Asymmetric Range Calculation

When the base value is near a parameter boundary, modulation range is calculated asymmetrically:

```typescript
// Asymmetric example: base near maximum
const input = {
  parameterMin: 1000,
  parameterMax: 15000,
  baseValue: 14000,  // Near max
  depthPercent: 50,
};

const result = calculateParameterAwareDepth(input);
// upwardRange: (15000 - 14000) * 0.5 = 500
// downwardRange: (14000 - 1000) * 0.5 = 6500
// gain: (500 + 6500) / 2 = 3500
// effectiveMin: 14000 - 6500 = 7500
// effectiveMax: 14000 + 500 = 14500
```

**Key Point**: Each direction (upward/downward) is calculated independently based on available range in that direction.

### 2. Averaged Gain Approach

The current implementation uses averaged gain for simplicity:

```typescript
gain = (upwardRange + downwardRange) / 2
```

**Accuracy**:
- ✅ 100% accurate for symmetric cases (base at center)
- ✅ ~95% accurate for moderate asymmetry (base 25% from boundary)
- ⚠️ ~50% accurate for extreme asymmetry (base at boundary)

**Tradeoff**: Simpler implementation (single GainNode) with acceptable accuracy for most use cases.

### 3. Modulation Metadata

Each CV connection stores metadata for efficient recalculation:

```typescript
import type { ModulationConnection } from './contracts/types';

const connection: ModulationConnection = {
  // Base Connection fields
  id: 'conn-123',
  sourceComponentId: 'lfo-1',
  targetComponentId: 'filter-1',
  signalType: SignalType.CV,

  // Modulation metadata (NEW)
  modulationMetadata: {
    targetParameterMin: 20,
    targetParameterMax: 20000,
    lastCalculatedDepth: 50,
    lastCalculatedBaseValue: 5000,
    lastCalculatedGain: 4990,
    lastCalculatedAt: Date.now(),
  },
};
```

**Benefits**:
- Fast change detection (compare current vs. last calculated values)
- Cached parameter bounds (avoid repeated lookups)
- Debugging support (timestamp, input tracking)

---

## Integration Points

### 1. ConnectionManager Integration

Intercept CV connection creation to insert scaling GainNode:

```typescript
// In ConnectionManager.createConnection()
if (connection.signalType === SignalType.CV) {
  // Get target parameter
  const targetParam = targetComponent.getParameter(targetPortId);
  if (!targetParam) {
    throw new Error('Target parameter not found');
  }

  // Validate parameter can be modulated
  const boundsValidation = validateParameterBounds({
    min: targetParam.min,
    max: targetParam.max,
    baseValue: targetParam.baseValue,
    range: targetParam.max - targetParam.min,
  });

  if (!boundsValidation.valid) {
    throw new Error(boundsValidation.error.message);
  }

  // Get LFO depth
  const lfo = sourceComponent as LFO;
  const depthPercent = lfo.getParameter('depth')?.getValue() || 50;

  // Calculate initial depth
  const result = calculateParameterAwareDepth({
    parameterMin: targetParam.min,
    parameterMax: targetParam.max,
    baseValue: targetParam.baseValue,
    depthPercent,
  });

  // Create scaling GainNode
  const scalingGainNode = audioContext.createGain();
  scalingGainNode.gain.value = result.gain;

  // Store in map
  this.modulationScalingNodes.set(connection.id, {
    connectionId: connection.id,
    scalingGainNode,
    sourceNode: lfo.getOutputNode(),
    targetParam: targetParam.getAudioParam()!,
    isConnected: false,
  });

  // Connect audio graph: LFO → scaling → param
  lfo.getOutputNode().connect(scalingGainNode);
  scalingGainNode.connect(targetParam.getAudioParam()!);

  // Add metadata to connection
  connection.modulationMetadata = {
    targetParameterMin: targetParam.min,
    targetParameterMax: targetParam.max,
    lastCalculatedDepth: depthPercent,
    lastCalculatedBaseValue: targetParam.baseValue,
    lastCalculatedGain: result.gain,
    lastCalculatedAt: Date.now(),
  };
}
```

### 2. Parameter Change Handling

Recalculate when depth or base value changes:

```typescript
// Listen for parameter changes
eventBus.on(EventType.PARAMETER_CHANGED, (event: ParameterEvent) => {
  // Check if change affects modulation
  const affectedConnections = findConnectionsAffectedBy(
    event.componentId,
    event.parameterId
  );

  for (const connection of affectedConnections) {
    recalculateModulationDepth(connection);
  }
});

function recalculateModulationDepth(connection: ModulationConnection): void {
  // Get current values
  const targetParam = getParameter(
    connection.targetComponentId,
    connection.targetPortId
  );
  const lfoDepth = getLFODepth(connection.sourceComponentId);

  // Check if recalculation needed
  const metadata = connection.modulationMetadata!;
  if (
    metadata.lastCalculatedDepth === lfoDepth &&
    metadata.lastCalculatedBaseValue === targetParam.baseValue
  ) {
    return; // No change, skip recalculation
  }

  // Recalculate
  const result = calculateParameterAwareDepth({
    parameterMin: metadata.targetParameterMin,
    parameterMax: metadata.targetParameterMax,
    baseValue: targetParam.baseValue,
    depthPercent: lfoDepth,
  });

  // Update GainNode
  const scalingNode = this.modulationScalingNodes.get(connection.id);
  if (scalingNode) {
    scalingNode.scalingGainNode.gain.setValueAtTime(
      result.gain,
      audioContext.currentTime
    );
  }

  // Update metadata
  metadata.lastCalculatedDepth = lfoDepth;
  metadata.lastCalculatedBaseValue = targetParam.baseValue;
  metadata.lastCalculatedGain = result.gain;
  metadata.lastCalculatedAt = Date.now();
}
```

### 3. Parameter Class Enhancements

Add helper methods to Parameter class:

```typescript
// In src/components/base/Parameter.ts

/**
 * Get available modulation range in upward direction
 */
getUpwardRange(): number {
  return this.max - this.baseValue;
}

/**
 * Get available modulation range in downward direction
 */
getDownwardRange(): number {
  return this.baseValue - this.min;
}

/**
 * Check if parameter can be modulated
 */
canBeModulated(): boolean {
  return Math.abs(this.max - this.min) > 1e-10;
}

/**
 * Get parameter bounds for depth calculation
 */
getModulationBounds(): ParameterBounds {
  return {
    min: this.min,
    max: this.max,
    baseValue: this.baseValue,
    range: this.max - this.min,
  };
}
```

---

## Edge Cases & Validation

### 1. Zero Range Parameter

```typescript
const input = {
  parameterMin: 100,
  parameterMax: 100,  // min === max
  baseValue: 100,
  depthPercent: 50,
};

const validation = validateDepthCalculationInput(input);
// validation.valid === false
// validation.error.code === DepthValidationError.ZERO_RANGE
```

**Handling**: Block connection creation with user-friendly error message.

### 2. Base Value at Boundary

```typescript
const input = {
  parameterMin: 1000,
  parameterMax: 15000,
  baseValue: 15000,  // At maximum
  depthPercent: 50,
};

const result = calculateParameterAwareDepth(input);
// upwardRange: 0 (no room above)
// downwardRange: 7000 (full range below)
// gain: 3500 (averaged, but modulation is unidirectional)
```

**Handling**: Calculation succeeds, modulation works only in one direction.

### 3. Base Value Outside Range

```typescript
const input = {
  parameterMin: 1000,
  parameterMax: 15000,
  baseValue: 20000,  // Outside range (should never happen)
  depthPercent: 50,
};

const validation = validateDepthCalculationInput(input);
// validation.valid === false
// validation.error.code === DepthValidationError.BASE_OUT_OF_BOUNDS
```

**Handling**: Use `clampBaseValue()` to recover, log warning.

```typescript
import { clampBaseValue } from './contracts/validation';

const { clamped, wasClamped } = clampBaseValue(
  input.baseValue,
  input.parameterMin,
  input.parameterMax
);

if (wasClamped) {
  console.warn('Base value was clamped to valid range');
  input.baseValue = clamped;
}
```

### 4. Negative Parameter Range

```typescript
const input = {
  parameterMin: -10,
  parameterMax: 10,
  baseValue: 0,
  depthPercent: 50,
};

const result = calculateParameterAwareDepth(input);
// upwardRange: 5
// downwardRange: 5
// Works correctly! Math is sign-agnostic.
```

**Handling**: No special handling needed, calculation works correctly.

---

## Testing Guidelines

### Unit Tests

Test the core calculation function with various scenarios:

```typescript
import { calculateParameterAwareDepth } from './depth-calculator';
import { validateDepthCalculationInput } from './contracts/validation';

describe('calculateParameterAwareDepth', () => {
  it('calculates symmetric range correctly', () => {
    const result = calculateParameterAwareDepth({
      parameterMin: 1000,
      parameterMax: 15000,
      baseValue: 7000,
      depthPercent: 50,
    });

    expect(result.upwardRange).toBe(3500);
    expect(result.downwardRange).toBe(3500);
    expect(result.gain).toBe(3500);
    expect(result.effectiveMin).toBe(3500);
    expect(result.effectiveMax).toBe(10500);
  });

  it('calculates asymmetric range correctly', () => {
    const result = calculateParameterAwareDepth({
      parameterMin: 1000,
      parameterMax: 15000,
      baseValue: 14000,
      depthPercent: 50,
    });

    expect(result.upwardRange).toBe(500);
    expect(result.downwardRange).toBe(6500);
    expect(result.gain).toBe(3500); // Averaged
    expect(result.effectiveMin).toBe(7500);
    expect(result.effectiveMax).toBe(14500);
  });

  it('handles base at minimum', () => {
    const result = calculateParameterAwareDepth({
      parameterMin: 1000,
      parameterMax: 15000,
      baseValue: 1000,
      depthPercent: 50,
    });

    expect(result.upwardRange).toBe(7000);
    expect(result.downwardRange).toBe(0);
    expect(result.gain).toBe(3500); // Averaged
  });

  it('rejects zero range parameter', () => {
    const validation = validateDepthCalculationInput({
      parameterMin: 100,
      parameterMax: 100,
      baseValue: 100,
      depthPercent: 50,
    });

    expect(validation.valid).toBe(false);
    expect(validation.error?.code).toBe(DepthValidationError.ZERO_RANGE);
  });

  it('handles negative ranges', () => {
    const result = calculateParameterAwareDepth({
      parameterMin: -100,
      parameterMax: 100,
      baseValue: 0,
      depthPercent: 50,
    });

    expect(result.upwardRange).toBe(50);
    expect(result.downwardRange).toBe(50);
    expect(result.effectiveMin).toBe(-50);
    expect(result.effectiveMax).toBe(50);
  });
});
```

### Integration Tests

Test connection lifecycle with depth calculation:

```typescript
describe('ModulationConnection lifecycle', () => {
  it('creates scaling GainNode on connection', () => {
    // Setup: Create LFO and target component
    const lfo = createLFO();
    const filter = createFilter();

    // Set parameters
    lfo.setParameterValue('depth', 50);
    filter.setParameterValue('cutoff', 5000); // Sets baseValue

    // Create connection
    const connection = connectionManager.createConnection(
      lfo.id,
      'output',
      filter.id,
      'cutoff_cv'
    );

    // Verify scaling node created
    const scalingNode = connectionManager.getModulationScalingNode(connection.id);
    expect(scalingNode).toBeDefined();
    expect(scalingNode.isConnected).toBe(true);

    // Verify metadata
    expect(connection.modulationMetadata).toBeDefined();
    expect(connection.modulationMetadata?.lastCalculatedDepth).toBe(50);
  });

  it('recalculates on depth change', () => {
    // Setup: Create connected LFO and filter
    const { lfo, filter, connection } = setupModulatedFilter();

    // Change LFO depth
    lfo.setParameterValue('depth', 75);

    // Wait for recalculation
    await waitForRecalculation();

    // Verify gain updated
    const scalingNode = connectionManager.getModulationScalingNode(connection.id);
    const expectedGain = calculateExpectedGain(75, filter);
    expect(scalingNode.scalingGainNode.gain.value).toBeCloseTo(expectedGain);

    // Verify metadata updated
    expect(connection.modulationMetadata?.lastCalculatedDepth).toBe(75);
  });

  it('cleans up on disconnection', () => {
    // Setup: Create connected LFO and filter
    const { connection } = setupModulatedFilter();

    // Remove connection
    connectionManager.removeConnection(connection.id);

    // Verify cleanup
    const scalingNode = connectionManager.getModulationScalingNode(connection.id);
    expect(scalingNode).toBeUndefined();
  });
});
```

### Acceptance Tests

Test against specification scenarios:

```typescript
describe('Acceptance Scenario 1: Basic Parameter-Aware Modulation', () => {
  it('modulates frequency parameter with 50% depth', () => {
    // Given: LFO connected to frequency parameter
    const lfo = createLFO();
    const oscillator = createOscillator();

    // Set frequency bounds: min=1000, max=15000
    // Set base value: 7000
    oscillator.setParameterValue('frequency', 7000);

    // Set LFO depth: 50%
    lfo.setParameterValue('depth', 50);

    // Create connection
    connectionManager.createConnection(
      lfo.id,
      'output',
      oscillator.id,
      'frequency_cv'
    );

    // When: LFO oscillates
    lfo.setParameterValue('frequency', 1); // 1 Hz

    // Then: Parameter alternates between 3500 and 10500
    // (Test by sampling modulated values over time)
    const samples = sampleModulatedParameter(oscillator, 'frequency', 2000);

    expect(Math.min(...samples)).toBeCloseTo(3500, 0);
    expect(Math.max(...samples)).toBeCloseTo(10500, 0);
  });
});

describe('Acceptance Scenario 2: Asymmetric Range Handling', () => {
  it('handles base value near boundary', () => {
    // Given: Parameter with base=14000 on range 1000-15000
    const oscillator = createOscillator();
    oscillator.setParameterValue('frequency', 14000);

    const lfo = createLFO();
    lfo.setParameterValue('depth', 50);

    connectionManager.createConnection(
      lfo.id,
      'output',
      oscillator.id,
      'frequency_cv'
    );

    // When: LFO oscillates
    lfo.setParameterValue('frequency', 1);

    // Then: Parameter ranges from 7500 to 14500
    const samples = sampleModulatedParameter(oscillator, 'frequency', 2000);

    expect(Math.min(...samples)).toBeCloseTo(7500, 0);
    expect(Math.max(...samples)).toBeCloseTo(14500, 0);
  });
});
```

---

## Key Files Reference

### Core Implementation
- **DepthCalculator**: `/src/modulation/DepthCalculator.ts`
  - `calculateParameterAwareDepth()` - Main calculation function
  - Pure functions, no side effects

- **ConnectionManager**: `/src/canvas/ConnectionManager.ts`
  - Intercepts CV connections
  - Manages ModulationScalingNode lifecycle
  - Triggers recalculation on changes

- **Parameter**: `/src/components/base/Parameter.ts`
  - Enhanced with modulation helper methods
  - Provides bounds for depth calculation

### Type Definitions
- **Types**: `/specs/008-lfo-parameter-depth/contracts/types.ts`
  - `ModulationConnection`, `ModulationMetadata`
  - `DepthCalculationInput`, `DepthCalculationResult`
  - Type guards and utility types

- **Validation**: `/specs/008-lfo-parameter-depth/contracts/validation.ts`
  - Input validation functions
  - Edge case handlers
  - Error formatting utilities

### Documentation
- **Data Model**: `/specs/008-lfo-parameter-depth/data-model.md`
  - Entity relationships
  - State diagrams
  - Performance characteristics

- **Research**: `/specs/008-lfo-parameter-depth/research.md`
  - Codebase analysis findings
  - Architecture decisions
  - Implementation approach

---

## Performance Considerations

### Calculation Performance
- **Event-driven**: Calculation only on depth/base value changes
- **Cost**: ~0.05ms per calculation (5 arithmetic operations)
- **Frequency**: Typically 1-5 changes/second (user interaction)
- **Impact**: Negligible CPU overhead

### Memory Overhead
- **Per Connection**: ~1KB GainNode + ~200 bytes metadata
- **Typical Use**: 10-20 CV connections = ~12KB-24KB
- **Impact**: Negligible memory overhead

### Audio Processing
- **Zero JavaScript overhead**: GainNode scaling is native audio-rate processing
- **No per-sample callbacks**: All modulation handled in Web Audio graph
- **Meets SC-003**: Calculation <1ms, audio processing continuous

---

## Common Pitfalls

### 1. Forgetting to Validate Input
**Problem**: Passing invalid input causes calculation errors.

**Solution**: Always validate before calculation:
```typescript
const validation = validateDepthCalculationInput(input);
if (!validation.valid) {
  handleError(validation.error);
  return;
}
```

### 2. Not Updating Metadata
**Problem**: Stale metadata causes incorrect change detection.

**Solution**: Always update after recalculation:
```typescript
connection.modulationMetadata = {
  ...metadata,
  lastCalculatedDepth: newDepth,
  lastCalculatedBaseValue: newBaseValue,
  lastCalculatedGain: result.gain,
  lastCalculatedAt: Date.now(),
};
```

### 3. Missing Audio Graph Cleanup
**Problem**: Disconnected connections leave hanging GainNodes.

**Solution**: Always clean up on disconnect:
```typescript
scalingGainNode.disconnect();
sourceNode.disconnect(scalingGainNode);
modulationScalingNodes.delete(connectionId);
```

### 4. Assuming Symmetric Range
**Problem**: UI displays incorrect range for asymmetric cases.

**Solution**: Use `effectiveMin` and `effectiveMax` from result:
```typescript
displayRange(result.effectiveMin, result.effectiveMax);
// NOT: displayRange(base - gain, base + gain)
```

---

## Next Steps

1. **Implement DepthCalculator**: Pure calculation functions
2. **Extend ConnectionManager**: Add scaling node management
3. **Enhance Parameter class**: Add modulation helper methods
4. **Write tests**: Unit, integration, and acceptance tests
5. **Add UI feedback**: Display modulation range (User Story 3)

For task sequence, run: `/speckit.tasks`

---

## Getting Help

- **Data Model**: See `data-model.md` for entity relationships
- **Type Definitions**: See `contracts/types.ts` for all interfaces
- **Validation**: See `contracts/validation.ts` for edge case handling
- **Research**: See `research.md` for architecture decisions
- **Spec**: See `spec.md` for requirements and acceptance criteria
