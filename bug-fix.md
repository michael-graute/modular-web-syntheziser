# CV Visualization Bug Fixes

## Issue 1: Frequency Knob Not Animating

### Problem
The frequency knob did not visually animate when an LFO was connected to the oscillator's frequency CV input, while the detune knob worked correctly.

### Root Cause
The issue was **not** that the visualization system was broken - it was actually working correctly! The problem was that the frequency parameter has a very large range (0-20000 Hz) compared to the detune parameter (-100 to +100 cents).

With an LFO outputting ±50 Hz modulation:
- **Detune**: 50 cents out of 200 cent range = 25% movement = **67.5° knob rotation** ✅ Clearly visible
- **Frequency**: 50 Hz out of 20000 Hz range = 0.25% movement = **0.675° knob rotation** ❌ Invisible to human eye

Additionally, when the LFO output was negative (e.g., -32 Hz) and the base frequency was 0 Hz, the modulated value was clamped to 0 Hz (the minimum), resulting in no visible movement.

### Solution
Implemented a **visual zoom enhancement** that amplifies CV modulation for parameters with large ranges (>1000):

```typescript
// For parameters with very large ranges (>1000), apply 20x visual amplification
if (range > 1000 && (tracking as any).cvAnalyser) {
  const baseNormalized = (tracking.parameter.baseValue - tracking.parameter.min) / range;
  const modulationDelta = normalizedValue - baseNormalized;
  const amplifiedDelta = modulationDelta * 20;
  normalizedValue = Math.max(0, Math.min(1, baseNormalized + amplifiedDelta));
}
```

This amplifies the visual movement by 20x while keeping the actual audio behavior unchanged. Now:
- 0.25% movement → 5% visual movement = **13.5° rotation** (clearly visible!)

### Files Modified
- `src/visualization/ModulationVisualizer.ts` - Added visual zoom for large-range parameters

---

## Issue 2: AudioParam.value Doesn't Include Modulation

### Problem
The original implementation tried to read `AudioParam.value` to sample modulated parameter values, but this only returns the **base value**, not the sum of base value + modulation. The Web Audio API doesn't expose the current modulated value of an AudioParam.

### Root Cause
When an OscillatorNode (LFO) is connected to an AudioParam, the oscillation is added to the base value in the audio thread, but `audioParam.value` only returns the value set via `audioParam.value = x` or `setValueAtTime()`.

### Solution
Instead of trying to read the modulated AudioParam value, we:

1. **Create an AnalyserNode** for each CV connection
2. **Connect it to the CV source** (LFO output) in parallel with the AudioParam connection
3. **Sample the CV waveform** directly from the AnalyserNode using `getFloatTimeDomainData()`
4. **Calculate modulated value** as: `modulatedValue = baseValue + cvValue`

```typescript
// Create an AnalyserNode to sample the CV signal
const analyserNode = this.audioContext.createAnalyser();
analyserNode.fftSize = 32; // Minimum size for fast analysis
const dataArray = new Float32Array(analyserNode.fftSize);

// Connect CV source to analyser (in parallel with AudioParam connection)
cvSourceNode.connect(analyserNode);

// Sample CV value
analyser.getFloatTimeDomainData(dataArray);
const cvValue = dataArray[0] || 0;

// Calculate final modulated value
const baseValue = audioParam ? audioParam.value : tracking.parameter.baseValue;
modulatedValue = baseValue + cvValue;
```

### Files Modified
- `src/visualization/ModulationVisualizer.ts` - Implemented AnalyserNode-based CV sampling
- `src/canvas/ConnectionManager.ts` - Pass source/target components in connection events
- `src/visualization/ParameterValueSampler.ts` - Removed AudioWorklet approach

---

## Issue 3: Filter Parameters Not Tracked

### Problem
When connecting an LFO to the Filter's cutoff or resonance CV inputs, the console showed:
```
[ModViz] Parameter "cutoff_cv" not tracked! Cannot visualize.
[ModViz] Parameter "resonance_cv" not tracked! Cannot visualize.
```

The knobs did not animate.

### Root Cause
The Filter component has a naming mismatch between its **CV input port IDs** and **parameter IDs**:

- **Oscillator** (works correctly):
  - Input port: `frequency` → Parameter: `frequency` ✓
  - Input port: `detune` → Parameter: `detune` ✓

- **Filter** (mismatch):
  - Input port: `cutoff_cv` → Parameter: `cutoff` ✗
  - Input port: `resonance_cv` → Parameter: `resonance` ✗

The ModulationVisualizer was looking for parameters named `cutoff_cv` and `resonance_cv`, but the actual parameter IDs were just `cutoff` and `resonance`.

### Solution
Implemented a **flexible parameter ID mapping** that strips the `_cv` suffix when needed:

```typescript
// Try the exact port ID first, then try without "_cv" suffix
let parameterId = connection.targetPortId;
let tracking = this.trackedParameters.get(parameterId);

if (!tracking && parameterId.endsWith('_cv')) {
  // Try without the "_cv" suffix
  const baseParameterId = parameterId.slice(0, -3);
  tracking = this.trackedParameters.get(baseParameterId);
  if (tracking) {
    parameterId = baseParameterId;
  }
}
```

Also added **AudioParam linkage** for the Filter component:

```typescript
// Link AudioParams to Parameters for CV visualization
const cutoffParam = this.getParameter('cutoff');
const resonanceParam = this.getParameter('resonance');
if (cutoffParam) {
  cutoffParam.linkAudioParam(this.filterNode.frequency);
}
if (resonanceParam) {
  resonanceParam.linkAudioParam(this.filterNode.Q);
}
```

### Files Modified
- `src/visualization/ModulationVisualizer.ts` - Added `_cv` suffix stripping in `onConnectionCreated()`
- `src/components/processors/Filter.ts` - Added AudioParam linkage for cutoff and resonance

---

## Issue 4: Filter Parameters Still Modulated After Disconnection

### Problem
After fixing Issue 3, the filter knobs animated correctly, but when the CV connection was deleted, the parameters continued to be modulated. The audio modulation didn't stop.

### Root Cause
The `onConnectionDestroyed()` method was not applying the same `_cv` suffix mapping logic as `onConnectionCreated()`. When looking up the parameter to clean up:

- Connection's `targetPortId` = `cutoff_cv`
- Looking for parameter = `cutoff_cv`
- But tracked parameter ID = `cutoff` (after mapping)
- Result: Parameter not found, AnalyserNode never cleaned up!

Additionally, when checking if there are other connections to the same parameter, the comparison was failing because some connection IDs had the `_cv` suffix and others didn't.

### Solution
Applied the **same mapping logic** in `onConnectionDestroyed()`:

```typescript
// Apply the same mapping logic as in onConnectionCreated
let parameterId = connection.targetPortId;
let tracking = this.trackedParameters.get(parameterId);

if (!tracking && parameterId.endsWith('_cv')) {
  const baseParameterId = parameterId.slice(0, -3);
  tracking = this.trackedParameters.get(baseParameterId);
  if (tracking) {
    parameterId = baseParameterId;
  }
}
```

And fixed the **other connections check** to map each connection consistently:

```typescript
const hasOtherConnections = Array.from(this.connections.values()).some(
  (conn) => {
    if (conn.id === connectionId) return false;

    // Map the connection's target port ID the same way
    let otherParameterId = conn.targetPortId;
    if (!this.trackedParameters.has(otherParameterId) && otherParameterId.endsWith('_cv')) {
      otherParameterId = otherParameterId.slice(0, -3);
    }

    return otherParameterId === parameterId;
  }
);
```

### Files Modified
- `src/visualization/ModulationVisualizer.ts` - Added mapping logic to `onConnectionDestroyed()`

---

## Key Learnings

1. **Visual feedback needs to be scaled appropriately** - Parameters with very large ranges need visual amplification to make CV modulation visible, even when the absolute modulation amount is small.

2. **Web Audio API limitations** - `AudioParam.value` doesn't include modulation; you must sample the modulation source directly using AnalyserNode.

3. **Naming consistency matters** - Components should use consistent naming between port IDs and parameter IDs, or the visualization system needs to handle mapping. The `_cv` suffix pattern is common but requires special handling.

4. **Apply mappings consistently** - If you transform IDs when creating resources (like `cutoff_cv` → `cutoff`), you must apply the same transformation when cleaning up those resources.

5. **Connection lifecycle is critical** - When tracking audio connections, ensure that both creation and destruction paths handle ID mapping, and that checks for "other connections" use the mapped IDs consistently.
