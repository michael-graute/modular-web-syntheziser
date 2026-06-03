# Implementation Plan: Envelope Follower

**Branch**: `030-envelope-follower` | **Date**: 2026-06-03 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/030-envelope-follower/spec.md`

## Summary

Implement an Envelope Follower analyser component that converts incoming audio amplitude to a 0–1 normalised CV signal via periodic RMS analysis (AnalyserNode), with independent Attack/Release time constants applied via a per-frame IIR smoother, a Gain/Sensitivity knob, a vertical bar-meter canvas display, and full patch persistence. The CV output is a `ConstantSourceNode` whose `.offset` is updated each animation frame, following the Quantizer pattern, making it patchable to any CV-accepting input in the synthesizer.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode  
**Primary Dependencies**: Web Audio API (`AnalyserNode`, `GainNode`, `ConstantSourceNode`), Canvas 2D API — zero new runtime dependencies  
**Storage**: `localStorage` via existing `PatchSerializer` / `PatchStorage` pattern  
**Testing**: Vitest (run via `vitest run`)  
**Target Platform**: Browser (Vite dev server / static build)  
**Project Type**: Single-page modular synthesizer app  
**Performance Goals**: 60 FPS canvas rendering; CV update latency ~16 ms (one rAF frame)  
**Constraints**:
- Zero new runtime dependencies — Web Audio API + DOM only
- TypeScript strict mode enforced
- Follows existing `SynthComponent` → `CanvasComponent` → `*Display` pattern
- Patch format changes must be backward-compatible

## Constitution Check

**Constitution Version**: 1.0

- [x] **Readability & Maintainability**: All new functions are <50 lines; IIR smoother logic is one expression; display render is isolated in its own class.
- [x] **Code Organization**: Component in `src/components/analyzers/`; display in `src/canvas/displays/`; validation in `specs/030-envelope-follower/contracts/validation.ts` (copied to `src/` during implementation).
- [x] **Code Standards**: No magic numbers — all constants named (SEGMENT_COUNT, COLOR_*, etc. in display; DEFAULTS in validation). TypeScript strict mode throughout.
- [x] **Test Coverage**: Validation helpers (100%), IIR coefficient computation (100%), EnvelopeFollower core logic (≥80%).
- [x] **Test Quality**: Tests isolated; AAA pattern; descriptive names.
- [x] **UI Consistency**: Vertical bar display matches VuMeterDisplay exactly; knobs use existing Knob control; no new design tokens.
- [x] **User Feedback**: Canvas display updates every rAF frame — immediate visual feedback.
- [x] **Performance**: No blocking operations on audio thread; ConstantSourceNode.offset write is non-blocking; rAF-driven rendering.

## Project Structure

### Documentation (this feature)

```text
specs/030-envelope-follower/
├── plan.md              ← This file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── types.ts         ← TypeScript type contracts
│   └── validation.ts    ← Validation helpers
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (to be created/modified)

```text
src/
├── core/
│   └── types.ts                          MODIFY — add ENVELOPE_FOLLOWER to ComponentType enum
├── components/
│   └── analyzers/
│       └── EnvelopeFollower.ts           CREATE — main component class
├── canvas/
│   └── displays/
│       └── EnvelopeFollowerDisplay.ts    CREATE — canvas bar-meter display
├── canvas/
│   └── CanvasComponent.ts                MODIFY — add createControls() block + display field
└── main.ts                               MODIFY — register component in factory

tests/
└── components/
    └── analyzers/
        └── EnvelopeFollower.test.ts      CREATE — unit tests
```

## Implementation Phases

### Phase 1 — Core Component

**File**: `src/components/analyzers/EnvelopeFollower.ts`

1. Extend `SynthComponent`
2. Constructor:
   - `addInput('input', 'Audio In', SignalType.AUDIO)`
   - `addOutput('cv', 'CV Out', SignalType.CV)`
   - `addParameter('attack', 'Attack', 10, 1, 500, 1, 'ms')`
   - `addParameter('release', 'Release', 100, 5, 2000, 5, 'ms')`
   - `addParameter('gain', 'Gain', 1.0, 0.1, 4.0, 0.05, '×')`
3. `createAudioNodes()`:
   - `inputGain = ctx.createGain()` (gain = 1.0, fixed)
   - `analyser = ctx.createAnalyser()` (fftSize = 256, smoothingTimeConstant = 0)
   - `inputGain.connect(analyser)`
   - `cvNode = ctx.createConstantSource()` (offset = 0, then `.start()`)
   - `dataArray = new Float32Array(256)` (must equal fftSize — `getFloatTimeDomainData` fills fftSize samples, not fftSize/2)
   - Register all nodes via `registerAudioNode()`
4. `getInputNode()` → `inputGain`
5. `getOutputNode()` → `cvNode`
6. `getEnvelopeValue()` → `this.envelopeValue`
7. `tick(dt: number)`:
   - Read `analyser.getFloatTimeDomainData(dataArray)`
   - Compute RMS: `sqrt(mean(sample^2))`
   - Apply gain: `rmsNow = clamp(rms * gainParam, 0, 1)`
   - Compute attack/release coefficients using `computeSmoothingCoeff()`
   - Update `envelopeValue` with IIR
   - Write `cvNode.offset.value = envelopeValue`
8. `serialize()` / `deserialize()` using `validateEnvelopeFollowerParams()`

### Phase 2 — Canvas Display

**File**: `src/canvas/displays/EnvelopeFollowerDisplay.ts`

1. Constructor: `(x, y, width, height, envelopeFollower: EnvelopeFollower)`
2. `render(ctx)`:
   - Record `dt` from `performance.now()` delta
   - Call `this.envelopeFollower.tick(dt)`
   - Draw dark background + border (matches VuMeterDisplay style)
   - Draw green bar: height = `envelopeValue * innerHeight`, aligned to bottom
3. `updatePosition()`, `updateSize()`, `setFrozen()`, `destroy()` — identical to VuMeterDisplay

### Phase 3 — Wire into CanvasComponent

**File**: `src/canvas/CanvasComponent.ts`

1. Add `private envelopeFollowerDisplay: EnvelopeFollowerDisplay | null = null`
2. Import `EnvelopeFollowerDisplay` and `EnvelopeFollower`
3. In `createControls()`, add block:
   ```
   if (this.type === ComponentType.ENVELOPE_FOLLOWER && this.synthComponent)
   ```
   - Calculate port area height (1 input + 1 output)
   - Create three knobs: attack, release, gain (single row)
   - Calculate display area below knobs
   - Create/update `EnvelopeFollowerDisplay`
4. In `render()`, call `envelopeFollowerDisplay?.render(ctx)`
5. In `setFrozen()`, propagate to display
6. In `destroy()`, call `envelopeFollowerDisplay?.destroy()`
7. Add `[ComponentType.ENVELOPE_FOLLOWER]: 'Env Follower'` to display name map

### Phase 4 — Registration

**File**: `src/core/types.ts`
- Add `ENVELOPE_FOLLOWER = 'envelope-follower'` to `ComponentType` enum

**File**: `src/main.ts`
- Import `EnvelopeFollower`
- Register in component factory / switch statement (same pattern as Arpeggiator, VuMeter)

### Phase 5 — Tests

**File**: `tests/components/analyzers/EnvelopeFollower.test.ts`

- Validation helpers: `validateAttack`, `validateRelease`, `validateGain`, `validateEnvelopeFollowerParams` — 100% coverage
- `computeSmoothingCoeff`: boundary values (0 ms, large ms)
- `clampEnvelope`: values above 1, below 0, NaN
- `tick()`: rising signal → envelope rises; falling signal → envelope decays; attack coefficient slows rise; release coefficient slows fall
- `serialize()` / `deserialize()`: round-trip values preserved; missing params use defaults

## Complexity Tracking

No constitution violations. All patterns follow existing codebase conventions exactly.
