# Quickstart: 4-Voice Polyphony

**For**: Implementor. Assumes familiarity with the existing mono synth component pattern.

---

## What we're building

4-voice polyphony via 3 new components (`PolyOscillator`, `PolyADSR`, `PolyVCA`) and an extended `KeyboardInput` with a mono/poly toggle. A new `POLY_CV` signal type bundles all 4 voice slots in a single cable.

---

## Files to touch

### New files
```
src/components/generators/PolyOscillator.ts
src/components/processors/PolyADSR.ts
src/components/processors/PolyVCA.ts
src/components/utilities/VoiceAllocator.ts
tests/unit/VoiceAllocator.test.ts
tests/unit/PolyOscillator.test.ts
tests/unit/PolyADSR.test.ts
tests/integration/poly-chain.test.ts
specs/032-polyphony/contracts/types.ts       ← already created
specs/032-polyphony/contracts/validation.ts  ← already created
```

### Modified files
```
src/core/types.ts                         ← add POLY_CV to SignalType; add 3 ComponentTypes; add polyMode to KeyboardInput handling
src/utils/validators.ts                   ← update areSignalTypesCompatible for POLY_CV
src/utils/constants.ts                    ← add COLORS.POLY_CV
src/components/utilities/KeyboardInput.ts ← add polyMode param, VoiceAllocator, poly-cv output, getVoiceSlots()
src/canvas/Connection.ts                  ← add POLY_CV color to getColor()
src/canvas/ConnectionManager.ts           ← register VoiceSlotsGetter on poly-cv connections
src/canvas/CanvasComponent.ts             ← add POLY_OSCILLATOR/POLY_ADSR/POLY_VCA/updated KEYBOARD_INPUT controls
src/utils/componentLayout.ts             ← add layout entries for new types + update KEYBOARD_INPUT port count
src/components/registerComponents.ts     ← register 3 new component types
CLAUDE.md                                 ← update agent context pointer (done by /speckit-plan)
```

---

## Step-by-step implementation order

### Step 1: Core types (no audio, no tests yet)

In `src/core/types.ts`:
```typescript
export enum SignalType {
  AUDIO   = 'audio',
  CV      = 'cv',
  GATE    = 'gate',
  POLY_CV = 'poly-cv',   // ← add this
}

export enum ComponentType {
  // ... existing ...
  POLY_OSCILLATOR = 'poly-oscillator',
  POLY_ADSR       = 'poly-adsr',
  POLY_VCA        = 'poly-vca',
}
```

In `src/utils/validators.ts`, add POLY_CV isolation:
```typescript
if (sourceType === SignalType.POLY_CV) return targetType === SignalType.POLY_CV;
// also add: if targetType === POLY_CV, return false from other branches
```

In `src/utils/constants.ts`:
```typescript
COLORS.POLY_CV = '#c084fc'  // purple
```

### Step 2: VoiceAllocator

Create `src/components/utilities/VoiceAllocator.ts`. Pure class, no Web Audio.
- Initialize 4 slots: `{ voiceIndex: i, frequency: 0, gate: 0, note: null, timestamp: 0 }`.
- `noteOn`: find retrigger → idle → steal oldest.
- `noteOff`: find slot by note, set gate=0, note=null.
- `releaseAll`: reset all slots.
- `getSlots`: return a frozen shallow copy.

**Write test first**: `tests/unit/VoiceAllocator.test.ts` covering all allocation paths.

### Step 3: KeyboardInput extension

In `KeyboardInput`:
- Add `private voiceAllocator: VoiceAllocator` (created in constructor).
- Add parameter: `polyMode` (0, min:0, max:1, step:1).
- Add output port: `'poly-cv', 'Poly CV', SignalType.POLY_CV`.
- Add `isPolyMode(): boolean` → `this.getParameter('polyMode')?.getValue() === 1`.
- Add `setPolyMode(mode: 0 | 1): void` → updates param, calls `voiceAllocator.releaseAll()`, freezes/unfreezes mono outputs.
- Add `getVoiceSlots(): Readonly<VoiceSlot[]>` → delegates to `voiceAllocator.getSlots()`.
- Override `triggerNoteOn` / `triggerNoteOff`: when poly, call `voiceAllocator.noteOn/Off`; when mono, existing logic.

### Step 4: PolyOscillator

Pattern: identical to `Oscillator` but ×4.

```typescript
export class PolyOscillator extends SynthComponent implements PolyConsumer {
  private oscillators: OscillatorNode[] = [];   // length 4
  private voiceGates: GainNode[] = [];           // length 4, gain 0|1
  private outputMix: GainNode | null = null;
  private voiceSlotsGetter: VoiceSlotsGetter | null = null;
  private rafHandle: number | null = null;
  
  // createAudioNodes: create 4 OscillatorNodes + 4 GainNodes + 1 summing GainNode
  // destroyAudioNodes: stop RAF, stop oscillators, disconnect all
  // setVoiceSlotsGetter / clearVoiceSlotsGetter: standard PolyConsumer impl
  // startPolling (RAF): read slots, update oscillator frequencies and gate gains
}
```

Port: input `poly-cv` (POLY_CV), output `output` (AUDIO).
Parameter: `waveform` (0–3).

### Step 5: PolyADSR

Similar pattern to ADSREnvelope but ×4.

```typescript
export class PolyADSR extends SynthComponent implements PolyConsumer {
  private constantSources: ConstantSourceNode[] = [];  // length 4
  private envGains: GainNode[] = [];                    // length 4
  private outputGains: GainNode[] = [];                 // length 4
  private previousGates: (0 | 1)[] = [0, 0, 0, 0];
  private voiceSlotsGetter: VoiceSlotsGetter | null = null;
  private rafHandle: number | null = null;
}
```

Ports: input `poly-cv` (POLY_CV), outputs `env-0` through `env-3` (CV).
Parameters: `attack`, `decay`, `sustain`, `release`.
RAF loop: edge-detect gate changes, call `triggerGateOn(i)` / `triggerGateOff(i)`.

### Step 6: PolyVCA

```typescript
export class PolyVCA extends SynthComponent {
  private voiceInputs: GainNode[] = [];   // length 4; receives PolyOscillator audio
  private voiceGains: GainNode[] = [];    // length 4; CV-controlled by PolyADSR
  private sumGain: GainNode | null = null;  // gain = 0.25
}
```

Ports: inputs `audio-0..3` (AUDIO), `cv-0..3` (CV); output `output` (AUDIO).
No parameters (gain is CV-driven).
`getAudioParamForInput(id)`: returns `voiceGains[N].gain` for `cv-N` port IDs.
`getInputNode(portId)`: returns `voiceInputs[N]` for `audio-N` port IDs.

### Step 7: ConnectionManager update

In `createConnection()`, after the audio connection, add:
```typescript
// Register voice slot getter for POLY_CV connections
if (sourcePort.type === SignalType.POLY_CV) {
  const src = sourceComponent.synthComponent as any;
  const tgt = targetComponent.synthComponent as any;
  if (src.getVoiceSlots && tgt.setVoiceSlotsGetter) {
    tgt.setVoiceSlotsGetter(() => src.getVoiceSlots());
  }
}
```

In `removeConnection()`, add:
```typescript
if (connection.signalType === SignalType.POLY_CV) {
  const tgt = targetComponent.synthComponent as any;
  if (tgt.clearVoiceSlotsGetter) tgt.clearVoiceSlotsGetter();
}
```

### Step 8: CanvasComponent controls

Add cases for `POLY_OSCILLATOR`, `POLY_ADSR`, `POLY_VCA` to `createControls()`.
Update `KEYBOARD_INPUT` case to add a polyMode toggle Button.

### Step 9: componentLayout.ts

Add port count entries and control layout entries for the 3 new types.
Update `KEYBOARD_INPUT` port counts to 4 outputs.

### Step 10: Register components

In `registerComponents.ts`, add 3 `componentRegistry.register(...)` calls.

---

## Key invariants to maintain

1. **POLY_CV never touches Web Audio nodes** — it's a JS-land getter pattern only. The port exists for visual cable routing; no `AudioNode` is registered for `poly-cv` ports.
2. **Mono keyboard outputs are frozen in poly mode** — `gateNode.offset.value = 0` stays locked when `polyMode === 1`.
3. **RAF loops start in `createAudioNodes` and stop in `destroyAudioNodes`** — no orphaned loops.
4. **PolyVCA summing gain = 0.25** — prevents 4-voice clipping at full amplitude.
5. **`polyMode` parameter default = 0** — existing Keyboard patches load as mono without migration.

---

## Test the golden path manually

```
Add: Keyboard → PolyOscillator → PolyADSR → PolyVCA → Master Out
Connect: Keyboard:poly-cv → PolyOscillator:poly-cv
Connect: Keyboard:poly-cv → PolyADSR:poly-cv
Connect: PolyOscillator:output → PolyVCA:audio-0  (and audio-1, audio-2, audio-3)
Connect: PolyADSR:env-0 → PolyVCA:cv-0  (and cv-1, cv-2, cv-3)
Connect: PolyVCA:output → MasterOut:input
Toggle Keyboard to POLY mode
Hold A+S+D+F → 4 simultaneous notes
Release S → only that note fades
```
