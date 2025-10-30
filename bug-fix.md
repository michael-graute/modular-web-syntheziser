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

---

## Issue 5: Visualization Stops Working After Moving Components

### Problem
When an oscillator (or any component) was moved on the canvas **before** establishing CV connections, the knob animation would not work after connecting an LFO. If the component was not moved, the visualization worked perfectly.

### Root Cause
When a component is moved, `CanvasComponent.updateControlPositions()` calls `createControls()`, which **recreates all control objects** (Knobs, Sliders, etc.) at their new positions. The old control objects are destroyed.

However, the ModulationVisualizer still held references to the **old control objects**. When it called `setVisualValue()` on the old knob, that knob was no longer being rendered by the canvas - it was orphaned.

**Evidence from logs:**
- ✅ `[ModViz SAMPLE]` logs showed sampling was working
- ✅ `[Knob] setVisualValue(...)` logs showed values were being set
- ❌ `[Knob RENDER]` logs showed render was NOT being called
- After disconnection, `[Knob RENDER CALLED]` appeared again (for the new knob)

### Solution
Implemented a **controls recreated event system**:

1. **Added `CONTROLS_RECREATED` event** to `EventType` enum
2. **Emit event** in `CanvasComponent.updateControlPositions()` after controls are recreated
3. **Listen for event** in `main.ts` and re-track all parameters with new control references
4. **Update control reference** in `ModulationVisualizer.trackParameter()` when re-tracking

```typescript
// In CanvasComponent.ts - emit event after recreating controls
this.createControls();
eventBus.emit(EventType.CONTROLS_RECREATED, {
  componentId: this.id,
  component: this,
});

// In main.ts - listen and re-track
eventBus.on(EventType.CONTROLS_RECREATED, (data: any) => {
  if (modulationVisualizer && data.component) {
    trackComponentParameters(data.component);
  }
});

// In ModulationVisualizer.ts - update control reference if already tracked
if (this.trackedParameters.has(parameterId)) {
  const existingTracking = this.trackedParameters.get(parameterId)!;
  existingTracking.control = control;  // Update to new control
  return {...};
}
```

### Files Modified
- `src/canvas/CanvasComponent.ts` - Emit CONTROLS_RECREATED event
- `src/core/types.ts` - Added CONTROLS_RECREATED to EventType enum
- `src/main.ts` - Listen for event and re-track parameters
- `src/visualization/ModulationVisualizer.ts` - Update control reference when re-tracking

---

## Issue 6: Parameter ID Collision Between Components

### Problem
When multiple components of the same type (e.g., two oscillators) were added to the canvas:
1. First oscillator's CV visualization works correctly when connected to an LFO
2. When a second oscillator is added (even without any connections), the first oscillator's CV visualization stops
3. The second oscillator starts showing CV visualization with the parameters from the first oscillator, despite having no connections

### Root Cause
Parameter IDs were not unique across different components. Each oscillator had parameters with simple IDs like `"frequency"` and `"detune"`, without including the component ID to make them unique.

When `trackComponentParameters()` was called:
- **Oscillator 1** registers parameters: `"frequency"`, `"detune"`
- **Oscillator 2** registers parameters: `"frequency"`, `"detune"` (same IDs!)

The `ModulationVisualizer` stores parameter tracking in a `Map<string, ParameterTracking>` keyed by parameter ID. When the second oscillator's parameters were tracked, they **overwrote** the first oscillator's parameter entries in the map because they had identical IDs.

**Evidence from code:**
```typescript
// main.ts:400 - Uses parameter.id directly
modulationVisualizer!.trackParameter(parameter.id, control);

// ModulationVisualizer.ts:161 - Stores in map by parameter ID
this.trackedParameters.set(parameterId, tracking);
```

When a connection was made to the first oscillator:
- The connection event references the first oscillator's target component ID and port ID
- But the parameter tracking map entry for `"frequency"` now points to the **second oscillator's control**
- Result: The second oscillator's knob animates instead of the first

### Solution
Made parameter IDs globally unique by including the component ID, and updated the connection handling to construct the full parameter ID from connection data:

**Step 1: Make parameter IDs unique**
```typescript
// In SynthComponent.addParameter()
const uniqueParameterId = `${this.id}:${id}`;
const parameter = new Parameter(uniqueParameterId, name, defaultValue, min, max, step, unit);
```

This ensures that each component's parameters have unique IDs:
- **Oscillator 1**: `"abc123-uuid:frequency"`, `"abc123-uuid:detune"`
- **Oscillator 2**: `"def456-uuid:frequency"`, `"def456-uuid:detune"`

**Step 2: Update connection handling to construct full parameter IDs**
```typescript
// In ModulationVisualizer.onConnectionCreated()
// Build the full parameter ID from connection data
let portId = connection.targetPortId;
let parameterId = `${connection.targetComponentId}:${portId}`;
let tracking = this.trackedParameters.get(parameterId);

// Try without "_cv" suffix if needed
if (!tracking && portId.endsWith('_cv')) {
  const basePortId = portId.slice(0, -3);
  parameterId = `${connection.targetComponentId}:${basePortId}`;
  tracking = this.trackedParameters.get(parameterId);
}
```

The same mapping logic is applied in `onConnectionDestroyed()` to ensure proper cleanup.

**Step 3: Handle both simple and full parameter IDs in setParameterValue**

After changing parameter IDs to be unique, external code (like UI controls) now passes full IDs like `"componentId:frequency"` to `setParameterValue()`. However:
- Parameters are stored internally using simple IDs (`"frequency"`)
- `updateAudioParameter()` in subclasses expects simple IDs

Solution: Extract the simple ID from full IDs when needed:

```typescript
// In SynthComponent.setParameterValue()
let simpleId = parameterId;
if (parameterId.includes(':')) {
  const parts = parameterId.split(':');
  simpleId = parts[1] || parameterId;
}

const parameter = this.parameters.get(simpleId);
// ...
this.updateAudioParameter(simpleId, value);
```

This allows the method to accept both formats:
- `"frequency"` - simple ID (for backward compatibility)
- `"componentId:frequency"` - full unique ID (from UI controls)

Now each component's parameters are tracked independently, and CV connections correctly modulate the intended component's parameters.

### Files Modified
- `src/components/base/SynthComponent.ts` - Added component ID prefix to parameter IDs, updated `setParameterValue()` to handle both ID formats
- `src/visualization/ModulationVisualizer.ts` - Updated `onConnectionCreated()` and `onConnectionDestroyed()` to construct full parameter IDs from connection data

---

## Issue 7: CV Visualization Not Working After Patch Load

### Problem
When a saved patch is loaded from internal storage:
- Audio connections work correctly
- CV modulation functions correctly (LFO modulates oscillator parameters)
- But CV visualization does not work (knobs don't animate)

### Root Cause
When components are added via drag-and-drop, `handleComponentAdd()` calls `trackComponentParameters()` to register parameters with the `ModulationVisualizer`. However, when a patch is loaded, `PatchManager.recreateComponent()` creates and adds components but does not track their parameters.

**Evidence:**
```typescript
// In handleComponentAdd() - main.ts:382 (original)
trackComponentParameters(visualComponent);

// In recreateComponent() - PatchManager.ts:297 (original)
this.canvas.addComponent(canvasComponent);
// Missing: No parameter tracking!
```

The ModulationVisualizer needs to know about all parameters to track them for CV visualization. Without this registration:
- Parameters are not in `trackedParameters` Map
- When connections are created, `onConnectionCreated()` can't find the parameter
- No AnalyserNode is created to sample CV signals
- Result: No visualization despite functional modulation

### Solution
Implemented a consistent event-based approach for parameter tracking:

**Step 1: Emit COMPONENT_ADDED event when components are created**

In `handleComponentAdd()`:
```typescript
canvas.addComponent(visualComponent);

// Emit event for parameter tracking
eventBus.emit(EventType.COMPONENT_ADDED, {
  component: visualComponent,
});
```

In `PatchManager.recreateComponent()`:
```typescript
this.canvas.addComponent(canvasComponent);

// Emit event for parameter tracking
eventBus.emit(EventType.COMPONENT_ADDED, {
  component: canvasComponent,
});
```

**Step 2: Listen for COMPONENT_ADDED events and track parameters**

In `main.ts` initialization:
```typescript
// Listen for components being added (e.g., during patch load)
eventBus.on(EventType.COMPONENT_ADDED, (data: any) => {
  if (data.component) {
    trackComponentParameters(data.component);
  }
});
```

This ensures parameter tracking happens consistently for:
- Components added via drag-and-drop
- Components loaded from saved patches
- Any future component creation paths

### Files Modified
- `src/main.ts` - Added COMPONENT_ADDED event listener, emit event in `handleComponentAdd()`
- `src/patch/PatchManager.ts` - Emit COMPONENT_ADDED event in `recreateComponent()`

---

## Issue 8: Noise Generator Amplitude CV Modulation Issues

### Problem
When connecting an LFO to the Noise Generator's amplitude CV input:
1. CV always modulated from 0 upwards regardless of the base amplitude setting (knob position was ignored)
2. CV caused on/off switching instead of smooth volume changes (tremolo sounded like a gate)

### Root Cause
The LFO outputs signals in a large range (typically 0-100 when depth is at 100%). However, the `gain.gain` AudioParam expects values in the range [0, 1]. When the LFO's large values were added directly to the gain parameter via Web Audio API's additive CV behavior:

- **Without CV**: `gain.value = 0.5` (50% amplitude knob setting)
- **With LFO CV**: `gain.value = 0.5 + LFO_output` where LFO outputs ±50
- **Result**: `gain.value` oscillates between -49.5 and +50.5

AudioParam values are clamped to valid ranges, so:
- Negative values → 0 (silence)
- Values > 1 → 1 (maximum volume)
- Result: On/off switching behavior instead of smooth modulation

Additionally, the base amplitude from the knob was effectively ignored because the LFO's large values dominated the parameter.

### Solution
Implemented a **CV scaler node** that sits between the CV input and the main gain parameter to scale CV signals appropriately:

**Architecture:**
```
Audio Signal Path:
  Noise Source → [Pink Filter] → Main Gain → Output

CV Signal Path:
  LFO → CV Scaler (×0.01) → Main Gain.gain AudioParam
```

**Implementation Details:**

```typescript
// Create main gain node for amplitude control
this.gainNode = ctx.createGain();
const amplitude = this.getParameter('amplitude')?.getValue() || 50;
this.gainNode.gain.value = amplitude / 100; // Base value from knob

// Create CV scaler node
// Scales CV signals (0-100 range) down to 0-1 range
this.cvScalerNode = ctx.createGain();
this.cvScalerNode.gain.value = 0.01; // Scale factor: divides by 100

// Connect CV scaler output to the main gain's AudioParam
// LFO → cvScaler (×0.01) → gain.gain (adds scaled CV to base value)
this.cvScalerNode.connect(this.gainNode.gain);
```

**How It Works:**
- Base amplitude knob sets `gain.value = 0.5` (50%)
- LFO outputs ±50 (oscillating between 0-100)
- CV Scaler multiplies by 0.01: ±0.5
- Final gain: `0.5 ± 0.5` = oscillates between 0 and 1.0
- Result: Smooth tremolo effect from silence to full volume!

**Key Methods:**
```typescript
override getInputNodeByPort(portId: string): AudioNode | null {
  if (portId === 'amplitude') {
    // CV connects to scaler node first
    return this.cvScalerNode;
  }
  return null;
}

protected override getAudioParamForInput(inputId: string): AudioParam | null {
  if (inputId === 'amplitude') {
    // Return main gain's param (CV is pre-scaled)
    return this.gainNode ? this.gainNode.gain : null;
  }
  return null;
}
```

### Benefits of This Approach
1. **Base amplitude is respected**: The knob sets the center point of modulation
2. **Smooth modulation**: CV is properly scaled to the 0-1 gain range
3. **Intuitive behavior**: Works like analog modular synths (CV adds/subtracts from base value)
4. **CV visualization works**: The parameter tracking sees the correct AudioParam
5. **No audio path overhead**: Scaler only processes control signals, not audio

### Files Modified
- `src/components/generators/NoiseGenerator.ts` - Added cvScalerNode for CV scaling

---

## Issue 9: Noise Generator Type Change Disconnects All Connections

### Problem
When changing the noise type parameter from white to pink (or vice versa) using the dropdown:
- The noise generator would stop producing sound
- All input and output connections would be lost
- CV modulation connections stopped working
- User had to manually reconnect everything to restore functionality

### Root Cause
The `updateAudioParameter` method for the `type` parameter was calling `destroyAudioNodes()` followed by `createAudioNodes()` to switch between white and pink noise:

```typescript
case 'type':
  // OLD CODE - destroys everything
  this.destroyAudioNodes();
  this.createAudioNodes();
  break;
```

When `destroyAudioNodes()` runs:
1. Buffer source is stopped and disconnected
2. All audio nodes disconnect from each other
3. External connections to/from other components are broken
4. CV connections are severed
5. `createAudioNodes()` rebuilds internal graph, but external connections are gone

**Why external connections break:**
- External components hold references to the old audio nodes
- When `destroyAudioNodes()` sets nodes to `null`, external references become invalid
- New nodes created by `createAudioNodes()` are different objects
- Web Audio API connections are lost permanently

### Solution
Implemented **hot-swapping** by reconnecting only the internal audio path without destroying nodes:

```typescript
case 'type':
  // Switch between white and pink noise by reconnecting the audio path
  // Don't destroy nodes - just change the routing
  if (this.bufferSource && this.gainNode && this.pinkFilter) {
    const noiseType = Math.round(value);

    // Disconnect buffer source from current path
    this.bufferSource.disconnect();

    if (noiseType === 1) {
      // Pink noise: source → pink filter → gain
      this.bufferSource.connect(this.pinkFilter);
      // Reconnect filter to gain (clear old connections first)
      this.pinkFilter.disconnect();
      this.pinkFilter.connect(this.gainNode);
    } else {
      // White noise: source → gain (bypass filter)
      this.bufferSource.connect(this.gainNode);
    }

    console.log(`NoiseGenerator ${this.id} type changed to: ${NOISE_TYPES[noiseType]}`);
  }
  break;
```

### Signal Path Changes

**White Noise (type = 0):**
```
BufferSource → GainNode → [external connections]
```

**Pink Noise (type = 1):**
```
BufferSource → BiquadFilter (lowpass) → GainNode → [external connections]
```

### What's Preserved
- ✅ **Buffer source keeps running**: No audio glitches or restarts
- ✅ **Main gain node unchanged**: External output connections maintained
- ✅ **CV connections intact**: cvScalerNode and all CV routing preserved
- ✅ **External audio connections**: Other components stay connected to gain node
- ✅ **Smooth transition**: Seamless switching between noise types in real-time

### Benefits
1. **User experience**: No need to reconnect cables when changing noise type
2. **Live performance**: Can switch noise colors during playback without interruption
3. **Maintains modulation**: LFO and other CV sources continue working
4. **No audio glitches**: Continuous audio stream without stops or clicks

### Files Modified
- `src/components/generators/NoiseGenerator.ts` - Replaced destroy/create with internal reconnection

---

## Key Learnings

1. **Visual feedback needs to be scaled appropriately** - Parameters with very large ranges need visual amplification to make CV modulation visible, even when the absolute modulation amount is small.

2. **Web Audio API limitations** - `AudioParam.value` doesn't include modulation; you must sample the modulation source directly using AnalyserNode.

3. **Naming consistency matters** - Components should use consistent naming between port IDs and parameter IDs, or the visualization system needs to handle mapping. The `_cv` suffix pattern is common but requires special handling.

4. **Apply mappings consistently** - If you transform IDs when creating resources (like `cutoff_cv` → `cutoff`), you must apply the same transformation when cleaning up those resources.

5. **Connection lifecycle is critical** - When tracking audio connections, ensure that both creation and destruction paths handle ID mapping, and that checks for "other connections" use the mapped IDs consistently.

6. **Unique identifiers are essential** - When tracking resources in a Map or similar data structure, ensure that keys are globally unique. Simple IDs like "frequency" will collide when multiple instances exist. Always include instance identifiers (like component IDs) to make keys unique across the system.

7. **Event-driven initialization is robust** - When a system needs to react to object creation (like tracking parameters), use events rather than direct function calls. This ensures the initialization happens consistently across all creation paths (user interaction, patch loading, undo/redo, etc.) without code duplication.

8. **CV signal scaling is critical** - Different AudioParams expect different value ranges (e.g., frequency: 20-20000 Hz, gain: 0-1). When connecting CV sources with large output ranges (like LFOs outputting 0-100) to parameters with small ranges, insert a scaling gain node to prevent clipping and on/off behavior. The scaler should connect to the AudioParam, not the audio signal path.

9. **Hot-swap internal routing instead of destroying nodes** - When changing component behavior that requires different internal signal paths (like switching noise types or filter modes), reconnect audio nodes internally rather than destroying and recreating them. This preserves external connections and prevents interruptions. Only disconnect/reconnect the internal path that needs to change, leaving interface nodes (inputs/outputs) intact.
