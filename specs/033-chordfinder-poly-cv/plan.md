# Implementation Plan: ChordFinder Poly CV Output

**Branch**: `033-chordfinder-poly-cv` | **Date**: 2026-06-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/033-chordfinder-poly-cv/spec.md`

## Summary

Add a `poly-cv` output port to `ChordFinder` so it can drive `PolyOscillator → PolyADSR → PolyVCA` chains. ChordFinder maintains a private 4-slot `VoiceSlot[]` array (reusing the existing type from 032-polyphony): slots 0–2 map to the triad's root/third/fifth; slot 3 is permanently inactive. The component exposes a `getVoiceSlots()` method, which is the exact duck-type contract ConnectionManager already checks for POLY_CV sources. Existing mono outputs (`note1`, `note2`, `note3`, `gate`) are unchanged.

One source file is modified: `src/components/utilities/ChordFinder.ts`. One new test file is added. No changes to any other component, ConnectionManager, CanvasComponent, or serialization pipeline.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode
**Primary Dependencies**: Web Audio API, DOM — zero runtime dependencies
**Storage**: `localStorage` via existing `PatchSerializer` / `PatchStorage` pattern
**Testing**: Vitest (run via `vitest run`)
**Target Platform**: Browser (Vite dev server / static build)
**Project Type**: Single-page modular synthesizer app
**Performance Goals**: 60 FPS canvas rendering; audio parameter changes take effect within one Web Audio scheduler tick
**Constraints**:
- Zero new runtime dependencies
- TypeScript strict mode enforced
- Poly slot type (`VoiceSlot`) is reused from `src/components/utilities/VoiceAllocator.ts` — NOT redefined
- No changes to ConnectionManager, CanvasComponent, or serialization
- Existing mono outputs must remain fully functional

## Constitution Check

- [x] **Readability & Maintainability**: All additions are under 30 lines total. No deep nesting. Field names are self-documenting.
- [x] **Code Organization**: Change is isolated to `src/components/utilities/ChordFinder.ts`. No new files in `src/`.
- [x] **Code Standards**: No magic numbers (slot count = 4 via `VOICE_COUNT` constant from VoiceAllocator, or a local constant). TypeScript strict satisfied — `VoiceSlot` is the canonical type.
- [x] **Test Coverage**: New test file covers all slot invariants, press/release transitions, octave updates, and key changes. Existing tests are not broken.
- [x] **Test Quality**: Tests follow AAA pattern, are isolated, use descriptive names.
- [x] **UI Consistency**: No new UI. The `poly-cv` port gets the existing `COLORS.POLY_CV` color automatically from CanvasComponent's port colour switch.
- [x] **User Feedback**: No new user-facing state; chord button press/release feedback unchanged.
- [x] **Performance**: No new rAF subscription. PolyOscillator/PolyADSR poll via existing getter on their own rAF tick.

## Project Structure

### Documentation (this feature)

```text
specs/033-chordfinder-poly-cv/
├── plan.md              ← this file
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── types.ts         ← slot-index constants + ChordFinderPolyCvSource interface
│   └── validation.ts    ← assertValidChordPolySlots(), areChordSlotsActive(), areChordSlotsReleased()
└── checklists/
    └── requirements.md
```

### Source Code Changes

```text
src/components/utilities/ChordFinder.ts   ← MODIFIED (only file changed in src/)

tests/components/ChordFinder.poly.test.ts ← NEW
```

## Complexity Tracking

No constitution violations. No justifications needed.

---

## Phase 0: Research

**Status**: Complete — see [research.md](research.md)

Key findings:
1. `VoiceSlot.gate` is `0 | 1` (numeric) — NOT boolean. Spec clarification described semantic intent; implementation uses the existing numeric type.
2. ConnectionManager duck-type checks `typeof src.getVoiceSlots === 'function'` — no interface registration needed.
3. `VoiceAllocator` is NOT used — ChordFinder manages a static 4-slot array directly.
4. Gate updates on the VoiceSlot struct are synchronous plain-object writes (no `setValueAtTime` — that applies only to the mono ConstantSourceNode, not the poly data path).
5. `note` and `timestamp` fields are set to `null` / `0` and never read by PolyOscillator or PolyADSR.
6. `getOutputNodeByPort('poly-cv')` must return `null` — matching KeyboardInput's implementation.

---

## Phase 1: Design & Contracts

**Status**: Complete — see [data-model.md](data-model.md), [contracts/](contracts/)

### Implementation Steps (in order)

#### Step 1 — Add VoiceSlot import to ChordFinder.ts

```ts
import type { VoiceSlot } from './VoiceAllocator';
```

(ChordFinder and VoiceAllocator are both in `src/components/utilities/`.)

#### Step 2 — Add polySlots private field

Declare as a class field, initialized in-line or in the constructor before `addOutput` calls:

```ts
private polySlots: VoiceSlot[] = Array.from({ length: 4 }, (_, i) => ({
  voiceIndex: i as 0 | 1 | 2 | 3,
  frequency: 0,
  gate: 0 as 0 | 1,
  note: null,
  timestamp: 0,
}));
```

#### Step 3 — Register poly-cv output port

In the constructor, after the existing `addOutput('gate', ...)` call:

```ts
this.addOutput('poly-cv', 'Poly CV', SignalType.POLY_CV);
```

#### Step 4 — Add getVoiceSlots() method

New public method on the class:

```ts
getVoiceSlots(): Readonly<VoiceSlot[]> {
  return this.polySlots;
}
```

#### Step 5 — Update getOutputNodeByPort

Add a case to the existing switch statement:

```ts
case 'poly-cv': return null;
```

#### Step 6 — Update pressChord()

After the existing mono CV writes (the `note1Output.offset.setValueAtTime(...)` block), add:

```ts
// Update poly voice slots
for (let i = 0; i < 3; i++) {
  this.polySlots[i]!.frequency = midiToHz(chord.notes[i]! + octaveShift);
  this.polySlots[i]!.gate = 1;
}
// polySlots[3] stays gate=0, frequency=0
```

#### Step 7 — Update releaseChord()

After the existing mono gate release (`gateOutput.offset.setValueAtTime(0.0, t)`), add:

```ts
// Release poly voice slots (frequencies retained intentionally)
for (let i = 0; i < 3; i++) {
  this.polySlots[i]!.gate = 0;
}
```

#### Step 8 — Write tests (tests/components/ChordFinder.poly.test.ts)

Test cases to cover:

| Test | Assertion |
|---|---|
| Initial state: all slots gate=0 | `assertValidChordPolySlots` passes; `areChordSlotsReleased` = true |
| pressChord(0): slots 0–2 active | `areChordSlotsActive` = true; slot 3 gate=0 always |
| pressChord(0): slot frequencies match midiToHz of chord notes | Exact Hz values for C major root chord |
| releaseChord(): slots 0–2 gate=0 | `areChordSlotsReleased` = true |
| releaseChord(): frequencies retained | slot[0].frequency > 0 after release |
| pressChord then setOctave: slots update | slot frequencies reflect new octave |
| pressChord then selectKey: slots update | slot frequencies reflect new key after re-press |
| slot 3 invariant: always gate=0, frequency=0 | After press and release, slot[3] unchanged |
| getVoiceSlots returns same object reference | Pointer identity (not a copy) |

---

## Spec Note: Gate Field Type Correction

The spec's clarification session recorded `gate: boolean` as the answer to Q1. Research confirmed the actual `VoiceSlot` interface uses `gate: 0 | 1` (numeric). The implementation uses `0 | 1` to maintain type compatibility with PolyOscillator and PolyADSR. The spec should be updated to reflect this — the semantic intent (active/inactive) is preserved, but the representation is numeric.
