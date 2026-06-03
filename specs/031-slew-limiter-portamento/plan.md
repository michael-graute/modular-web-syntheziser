# Implementation Plan: Slew Limiter / Portamento

**Branch**: `031-slew-limiter-portamento` | **Date**: 2026-06-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/031-slew-limiter-portamento/spec.md`

## Summary

Implement a Slew Limiter component that accepts a CV input and emits a time-smoothed CV output, controlled by independent Rise and Fall time knobs (0–5000 ms, exponential scale). The smoothing uses a frame-driven IIR first-order lowpass — the same algorithm used by the Envelope Follower — driven by a `SlewLimiterDisplay` that calls `tick(dt)` each animation frame and renders a vertical bar meter showing the current normalised output value.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode
**Primary Dependencies**: Web Audio API, DOM — zero runtime dependencies
**Storage**: `localStorage` via existing `PatchSerializer` / `PatchStorage` pattern
**Testing**: Vitest (run via `vitest run`)
**Target Platform**: Browser (Vite dev server / static build)
**Project Type**: Single-page modular synthesizer app (`src/` flat structure with `core/`, `components/`, `ui/`, `patch/`, `canvas/`, `timing/` directories)
**Performance Goals**: 60 FPS canvas rendering; audio parameter changes take effect within one Web Audio scheduler tick (~128 samples)
**Constraints**:
- Zero new runtime dependencies — Web Audio API + DOM only
- TypeScript strict mode enforced
- Follows existing singleton export pattern (`audioEngine`, `patchManager`, `eventBus`)
- Patch format changes must be backward-compatible (legacy patches must load without error)

## Constitution Check

**Constitution Version**: 1.0

- [x] **Readability & Maintainability**: SlewLimiter mirrors EnvelopeFollower structure (proven <50 lines per method); SlewLimiterDisplay mirrors EnvelopeFollowerDisplay. All types self-documenting.
- [x] **Code Organization**: Component in `utilities/`, display in `canvas/displays/`, validation in `utilities/SlewLimiterValidation.ts`. Follows existing split.
- [x] **Code Standards**: Named constants for all magic numbers (min/max/defaults in `contracts/types.ts`). Strict mode. No magic numbers in component code.
- [x] **Test Coverage**: `SlewLimiter.test.ts` covers core slew logic; `SlewLimiterValidation.test.ts` covers 100% of validation functions (utility code, 100% required).
- [x] **Test Quality**: Tests are isolated (mock `audioEngine`), AAA pattern, descriptively named.
- [x] **UI Consistency**: Two knobs + vertical bar display matches Envelope Follower widget pattern. No new design tokens.
- [x] **User Feedback**: Knob changes update `cvNode.offset` each frame via `tick()`; visual bar updates synchronously. No >300ms operations.
- [x] **Performance**: Display renders at 60 FPS following EnvelopeFollowerDisplay pattern. `tick()` is O(1).

No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/031-slew-limiter-portamento/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── types.ts         ← TypeScript type contracts
│   └── validation.ts    ← Validation helpers
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (new / modified files)

```text
src/
├── core/
│   └── types.ts                              MODIFY — add SLEW_LIMITER enum value
├── components/
│   └── utilities/
│       ├── SlewLimiter.ts                    CREATE — main component
│       └── SlewLimiterValidation.ts          CREATE — validation + IIR helpers
├── canvas/
│   └── displays/
│       └── SlewLimiterDisplay.ts             CREATE — frame-driven bar display
└── components/
    ├── registerComponents.ts                 MODIFY — register SlewLimiter
    └── (ComponentRegistry auto-discovers via registerComponents)
src/utils/
    └── componentLayout.ts                    MODIFY — add SLEW_LIMITER layout case
src/canvas/
    └── CanvasComponent.ts                    MODIFY — add createControls() case + display field

tests/
└── components/
    └── utilities/
        ├── SlewLimiter.test.ts               CREATE
        └── SlewLimiterValidation.test.ts     CREATE
```

## Implementation Steps

### Step 1 — Types

**File**: `src/core/types.ts`

Add to `ComponentType` enum:
```ts
SLEW_LIMITER = 'slew-limiter',
```

### Step 2 — Validation Helpers

**File**: `src/components/utilities/SlewLimiterValidation.ts`

Export:
- `SlewLimiterParams` interface: `{ rise: number; fall: number }`
- `SLEW_DEFAULTS`, `RISE_MIN/MAX`, `FALL_MIN/MAX` constants (0–5000 ms, default 50 ms each)
- `validateRise(value: unknown): number` — clamp to [0, 5000], round to integer
- `validateFall(value: unknown): number` — clamp to [0, 5000], round to integer
- `validateSlewLimiterParams(params): SlewLimiterParams`
- `clampCv(value: number): number` — clamp to [0, 1]
- `computeSlewCoeff(timeMs: number, dtSec: number): number` — IIR coefficient (`1 − exp(−dt/τ)`)

### Step 3 — SlewLimiter Component

**File**: `src/components/utilities/SlewLimiter.ts`

```
class SlewLimiter extends SynthComponent
  constructor(id, position)
    addInput('input', 'CV In', SignalType.CV)
    addOutput('cv', 'CV Out', SignalType.CV)
    addParameter('rise', 'Rise', 50, 0, 5000, 1, 'ms')   // logarithmic taper via Knob
    addParameter('fall', 'Fall', 50, 0, 5000, 1, 'ms')

  createAudioNodes()
    inputGain = createGain(1.0)
    analyser = createAnalyser(fftSize=256, smoothing=0)
    inputGain.connect(analyser)
    cvNode = createConstantSource(); cvNode.offset.value = 0; cvNode.start()
    registerAudioNode('inputGain', inputGain)
    registerAudioNode('analyser', analyser)
    registerAudioNode('cvNode', cvNode)

  destroyAudioNodes()  — stop/disconnect all, null fields, clear audioNodes

  getInputNode()  → inputGain
  getOutputNode() → cvNode

  updateAudioParameter() — no-op (params read live in tick())

  getOutputValue(): number → outputValue

  tick(dt: number)
    read current CV from analyser (getFloatTimeDomainData, mean of samples)
    clampCv the target
    coeff = rise coeff if target > current, else fall coeff
    outputValue = clampCv(current + coeff * (target - current))
    cvNode.offset.value = outputValue

  serialize() → ComponentData with parameters: { rise, fall }
  deserialize(data) → validate params, set rise/fall
```

**Bypass**: inherited from `SynthComponent` — `enableBypass()` / `disableBypass()` disconnect `inputGain` from `analyser+cvNode` and patch `inputGain` → `cvNode` directly (same pattern as `VCA`).

### Step 4 — SlewLimiterDisplay

**File**: `src/canvas/displays/SlewLimiterDisplay.ts`

Identical structure to `EnvelopeFollowerDisplay`:
- Constructor takes `(x, y, width, height, slewLimiter: SlewLimiter)`
- `render(ctx)`: advance `tick(dt)`, draw background + green vertical bar proportional to `slewLimiter.getOutputValue()`
- `updatePosition()`, `updateSize()`, `setFrozen()`, `destroy()`

### Step 5 — componentLayout.ts

Add to `getControlLayout()` switch:
```ts
case ComponentType.SLEW_LIMITER:
  return { numKnobs: 2, hasDisplayArea: true, displayHeight: 80 };
```

Add to `getPortCounts()` switch:
```ts
case ComponentType.SLEW_LIMITER:
  return { inputs: 1, outputs: 1 };
```

Add width override (after existing VU_METER / ENVELOPE_FOLLOWER blocks):
```ts
if (type === ComponentType.SLEW_LIMITER) {
  width = 140;
}
```

### Step 6 — CanvasComponent.ts

1. Import `SlewLimiterDisplay` at top of file.
2. Add `private slewLimiterDisplay: SlewLimiterDisplay | null = null;` field.
3. In `createControls()`, add a `SLEW_LIMITER` case block (after the `ENVELOPE_FOLLOWER` block) that:
   - Creates two `Knob` controls for `rise` and `fall` parameters
   - Creates / updates `SlewLimiterDisplay`
4. In `renderDisplays()` (or equivalent render method), call `this.slewLimiterDisplay?.render(ctx)`.
5. In `destroy()` / cleanup, call `this.slewLimiterDisplay?.destroy()`.
6. Add `[ComponentType.SLEW_LIMITER]: 'Slew Limiter'` to the display-name map.

### Step 7 — registerComponents.ts

Add import and registration call:
```ts
import { SlewLimiter } from './utilities/SlewLimiter';
// ...
componentRegistry.register(
  ComponentType.SLEW_LIMITER,
  'Slew Limiter',
  'Smooths CV transitions — portamento and glide',
  'Utilities',
  (id, position) => new SlewLimiter(id, position),
  calculateComponentDimensions(ComponentType.SLEW_LIMITER)
);
```

### Step 8 — Tests

**`tests/components/utilities/SlewLimiterValidation.test.ts`** (100% coverage required):
- `validateRise` / `validateFall`: boundary values (0, 5000), out-of-range (negative, >5000), non-finite (NaN, Infinity, string)
- `validateSlewLimiterParams`: complete and partial records
- `clampCv`: below 0, above 1, within range
- `computeSlewCoeff`: timeMs=0 returns 1, positive timeMs returns value in (0,1), large timeMs returns near 0

**`tests/components/utilities/SlewLimiter.test.ts`** (≥80% coverage):
- Constructor: correct ports and parameters registered
- `tick()`: output rises toward target with rise coeff, falls with fall coeff; pass-through at timeMs=0
- `serialize()` / `deserialize()`: round-trip fidelity; missing keys use defaults
- `getOutputValue()`: returns current output value

## Complexity Tracking

> No violations — this feature is a straightforward application of the existing Envelope Follower pattern.
