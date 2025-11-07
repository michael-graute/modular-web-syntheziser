# Quickstart: LFO Runtime Toggle Implementation

**Feature**: 005-lfo-runtime-toggle
**Date**: 2025-11-07
**Estimated Time**: 2-3 hours

## Overview

This guide provides a step-by-step implementation plan for adding runtime on/off toggle to LFO components. The feature reuses existing bypass infrastructure from effects (feature 001-effect-bypass).

**Key Files to Modify**:
1. `/src/components/generators/LFO.ts` - Add bypass support to LFO
2. `/src/canvas/CanvasComponent.ts` - Enable bypass button for LFO

**Total Changes**: ~20 lines of code across 2 files

---

## Prerequisites

- [ ] Feature 001-effect-bypass must be implemented (✅ already complete)
- [ ] Codebase uses TypeScript 5.6+ with Web Audio API
- [ ] Familiarity with `SynthComponent` base class bypass pattern

---

## Implementation Steps

### Step 1: Enable Bypass Support in LFO Class

**File**: `/src/components/generators/LFO.ts`

**Current State**: LFO returns `false` from `isBypassable()` (generators excluded per 001 spec)

**Changes Required**:

#### 1.1 Override `isBypassable()` to return `true`

Find the current implementation (around line 50-60):

```typescript
public override isBypassable(): boolean {
  return false;  // Currently false (generators not bypassable)
}
```

**Change to**:

```typescript
public override isBypassable(): boolean {
  return true;  // ✅ Enable bypass for LFO
}
```

**Rationale**: This makes the LFO eligible for bypass button rendering in CanvasComponent.

---

#### 1.2 Implement `enableBypass()` method

Add this method to the LFO class:

```typescript
protected override enableBypass(): void {
  // Disconnect oscillator output to stop modulation
  // Keep oscillator running for phase continuity
  if (!this.oscillator) {
    throw new Error('Cannot bypass LFO: audio nodes not initialized');
  }

  this.oscillator.disconnect();
}
```

**Explanation**:
- Called automatically when `setBypass(true)` is invoked
- Disconnects oscillator from gainNode, stopping modulation output
- Oscillator continues running internally (phase continuity requirement)
- Target AudioParams automatically hold their last value

---

#### 1.3 Implement `disableBypass()` method

Add this method to the LFO class:

```typescript
protected override disableBypass(): void {
  // Reconnect oscillator to resume modulation
  if (!this.oscillator || !this.gainNode) {
    throw new Error('Cannot enable LFO: audio nodes not initialized');
  }

  this.oscillator.connect(this.gainNode);
}
```

**Explanation**:
- Called automatically when `setBypass(false)` is invoked
- Reconnects oscillator to gainNode, resuming modulation
- Modulation continues from current phase position

---

#### 1.4 Update `createAudioNodes()` for initial state

Verify the oscillator starts connected (default enabled state):

```typescript
protected override createAudioNodes(audioContext: AudioContext): void {
  // Create oscillator
  this.oscillator = audioContext.createOscillator();
  this.oscillator.type = this.getWaveformType(this.parameters.waveform);
  this.oscillator.frequency.value = this.parameters.rate;

  // Create gain node for depth control
  this.gainNode = audioContext.createGain();
  this.gainNode.gain.value = this.parameters.depth / 100;

  // Connect: oscillator → gainNode → output
  this.oscillator.connect(this.gainNode);  // ✅ Initial connection (enabled state)

  // Start oscillator
  this.oscillator.start();
}
```

**Note**: This should already be correct, just verify the connection exists.

---

### Step 2: Verify Serialization (No Changes Needed)

**File**: `/src/core/types.ts` (no changes)

The `ComponentData` interface already has the `isBypassed` field:

```typescript
interface ComponentData {
  id: string;
  type: ComponentType;
  position: { x: number; y: number };
  parameters: Record<string, number>;
  isBypassed?: boolean;  // ✅ Already exists
}
```

**File**: `/src/patch/PatchSerializer.ts` (no changes)

Serialization/deserialization already handles `isBypassed`:

```typescript
// Serialization (line ~85)
isBypassed: component.isBypassed()

// Deserialization (line ~180)
component.setBypass(data.isBypassed ?? false)
```

**Action**: None required - existing code handles LFO automatically.

---

### Step 3: Enable Bypass Button in CanvasComponent

**File**: `/src/canvas/CanvasComponent.ts`

**Current State**: Bypass button is only created for components where `isBypassable() === true`

**Changes Required**: None! The bypass button rendering is already generic:

```typescript
// Line ~450-470
if (component.isBypassable()) {
  const bypassButton = new Button(
    this.width - 35,
    10,
    25,
    20,
    '⚡',
    () => component.setBypass(!component.isBypassed())
  );
  this.controls.set('bypass', bypassButton);
}
```

Since we changed `LFO.isBypassable()` to return `true` in Step 1.1, the button will automatically appear.

**Action**: No code changes needed.

---

### Step 4: Verify Component Dimming

**File**: `/src/canvas/CanvasComponent.ts`

**Current State**: Components are dimmed when bypassed:

```typescript
// Line ~125
public render(ctx: CanvasRenderingContext2D): void {
  if (this.component.isBypassed()) {
    ctx.globalAlpha = 0.4;
  }

  // ... render component

  ctx.globalAlpha = 1.0;  // Reset
}
```

**Action**: No changes needed - LFO will dim automatically when bypassed.

---

## Testing Checklist

### Manual Testing

#### Test 1: Basic Toggle

1. [ ] Open the modular synth application
2. [ ] Add an LFO component to the canvas
3. [ ] Verify bypass button (⚡) appears in top-right corner of LFO header
4. [ ] Click bypass button → LFO should dim to 0.4 opacity, button darkens
5. [ ] Click bypass button again → LFO should return to full opacity, button brightens

**Expected**: Button toggles state, component dims/undims accordingly.

---

#### Test 2: Modulation Control

1. [ ] Create patch: Oscillator → Filter → Output
2. [ ] Create LFO, connect to Filter cutoff frequency
3. [ ] Set LFO rate to 2 Hz, depth to 50%
4. [ ] Play a note → hear filter sweep
5. [ ] Toggle LFO off → filter sweep stops, cutoff holds at current value
6. [ ] Toggle LFO on → filter sweep resumes

**Expected**: Modulation starts/stops without changing filter's current value on toggle off.

---

#### Test 3: Phase Continuity

1. [ ] Set up LFO modulating filter cutoff (slow rate: 0.5 Hz)
2. [ ] Toggle LFO off mid-cycle
3. [ ] Wait 2 seconds
4. [ ] Toggle LFO on
5. [ ] Observe modulation pattern

**Expected**: Modulation resumes from where it would have been if never toggled off (not from start of cycle).

---

#### Test 4: Parameter Editing While Bypassed

1. [ ] Toggle LFO off
2. [ ] Change LFO rate to 10 Hz
3. [ ] Change LFO depth to 100%
4. [ ] Change waveform to Square
5. [ ] Toggle LFO on

**Expected**: New parameters take effect immediately when re-enabled.

---

#### Test 5: State Persistence

1. [ ] Create patch with LFO in enabled state
2. [ ] Save patch as "test-enabled"
3. [ ] Toggle LFO off
4. [ ] Save patch as "test-disabled"
5. [ ] Load "test-enabled" → LFO should be enabled
6. [ ] Load "test-disabled" → LFO should be disabled

**Expected**: Bypass state persists across save/load.

---

#### Test 6: Backward Compatibility

1. [ ] Load an old patch (created before this feature)
2. [ ] Verify LFOs start in enabled state
3. [ ] Verify bypass button appears
4. [ ] Toggle works normally

**Expected**: Old patches load with LFOs enabled by default.

---

#### Test 7: Multiple LFOs

1. [ ] Create 3 LFOs modulating different parameters
2. [ ] Toggle LFO #1 off, leave #2 and #3 on
3. [ ] Verify only LFO #1 is dimmed
4. [ ] Verify only parameters modulated by #2 and #3 are affected

**Expected**: Each LFO's state is independent.

---

#### Test 8: Rapid Toggling

1. [ ] Click bypass button rapidly 10 times
2. [ ] Final state should match last click (odd = off, even = on)
3. [ ] No audio glitches or visual artifacts

**Expected**: All toggles processed, no crashes or glitches.

---

### Audio Quality Testing

#### Test 9: No Clicks/Pops

1. [ ] Set up LFO (10 Hz) modulating VCA gain
2. [ ] Play continuous tone
3. [ ] Toggle LFO on/off repeatedly while listening

**Expected**: No audible clicks, pops, or discontinuities.

---

#### Test 10: Parameter Hold Accuracy

1. [ ] Set up LFO modulating filter cutoff
2. [ ] Use oscilloscope to monitor filter output
3. [ ] Toggle LFO off mid-cycle
4. [ ] Measure filter cutoff value before and after toggle

**Expected**: Filter cutoff remains exactly the same (±0.01 Hz).

---

## Debugging Tips

### Issue: Bypass button doesn't appear

**Check**:
- `LFO.isBypassable()` returns `true`
- Canvas component is re-rendering after LFO creation
- No JavaScript errors in console

**Fix**: Verify Step 1.1 was applied correctly.

---

### Issue: Toggle doesn't stop modulation

**Check**:
- `enableBypass()` is being called (add console.log)
- `oscillator.disconnect()` is executing
- No errors in console

**Fix**: Verify Step 1.2 implementation, check for audio node existence.

---

### Issue: Modulation doesn't resume

**Check**:
- `disableBypass()` is being called
- `oscillator.connect(gainNode)` is executing
- GainNode still exists

**Fix**: Verify Step 1.3 implementation, ensure gainNode wasn't destroyed.

---

### Issue: Phase resets on toggle

**Check**:
- Oscillator is NOT being stopped/recreated
- Only disconnect/connect is happening

**Fix**: Ensure oscillator continues running, don't call `oscillator.stop()`.

---

### Issue: State doesn't persist

**Check**:
- `isBypassed` field present in serialized JSON
- `component.setBypass()` being called during deserialization

**Fix**: Verify PatchSerializer is calling `setBypass()` (should already be there from 001-effect-bypass).

---

## Performance Validation

### Response Time Test

```typescript
// Add to LFO.ts for testing
public setBypass(bypassed: boolean): void {
  const start = performance.now();

  super.setBypass(bypassed);

  const elapsed = performance.now() - start;
  console.log(`Toggle time: ${elapsed.toFixed(2)}ms`);  // Should be < 10ms
}
```

**Expected**: < 1 ms typical, < 10 ms worst case.

---

## Rollback Plan

If issues arise, revert these changes:

1. Change `LFO.isBypassable()` back to `return false;`
2. Remove `enableBypass()` and `disableBypass()` methods from LFO class

**Impact**: LFO bypass button will disappear, existing patches with `isBypassed: true` will load as enabled.

---

## Next Steps

After implementation and testing:

1. [ ] Run `/speckit.tasks` to generate task breakdown
2. [ ] Implement according to generated tasks
3. [ ] Complete all manual tests above
4. [ ] Update CLAUDE.md with new feature info (run agent context script)
5. [ ] Create git commit with feature implementation
6. [ ] Merge feature branch to main

**Estimated Total Time**: 2-3 hours (implementation + testing)

---

## Summary

This feature is intentionally minimal:

- **2 files modified**: LFO.ts, (CanvasComponent.ts no changes needed)
- **3 methods added**: `isBypassable()`, `enableBypass()`, `disableBypass()`
- **~20 lines of code total**
- **Zero new dependencies**
- **Leverages existing bypass infrastructure**

The implementation is straightforward because it reuses the battle-tested bypass pattern from effects. Most complexity is already solved by the base `SynthComponent` class.
