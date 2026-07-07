# Quickstart Guide: X-Y Pad Controller

**Feature**: `035-xy-pad-controller`
**Created**: 2026-07-07
**Target Audience**: Developers implementing this feature
**Prerequisites**: Familiarity with TypeScript 5.6+, Web Audio API, this project's `SynthComponent`/`CanvasComponent` architecture (see LFO and Looper as the two closest precedents)

---

## Architecture Overview

The X-Y Pad is a `SynthComponent` subclass (`src/components/utilities/XYPad.ts`) combining two existing patterns already proven elsewhere in this codebase:

- **CV output + depth scaling**: identical mechanics to `LFO.ts` — a per-connection `GainNode` scaler sized from the target's declared parameter range and a 0-100% depth parameter, but doubled (one scaler map per axis, X and Y independently).
- **Record/Stop/Play state machine + overlay canvas UI**: identical mechanics to `Looper.ts` / `LooperDisplay.ts` — press-methods gate on current state, a dedicated sibling `<canvas>` handles pointer interaction and renders the pad, and captured data is packed into a `Float32Array` and Base64-encoded into the existing generic `ComponentData.audioBlob` field.

No new patch-format fields, no new serializer logic, no new base-class methods — this feature is a recombination of two existing, already-reviewed patterns.

```typescript
import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, SignalType } from '../../core/types';

export class XYPad extends SynthComponent {
  constructor(id: string, position: { x: number; y: number }) {
    super(id, ComponentType.XY_PAD, 'X-Y Pad', position);
    this.addOutput('x', 'X', SignalType.CV);
    this.addOutput('y', 'Y', SignalType.CV);
    this.addParameter('xDepth', 'X Depth', 50, 0, 100, 1, '%');
    this.addParameter('yDepth', 'Y Depth', 50, 0, 100, 1, '%');
  }
  // ...
}
```

## Component Setup

1. Add `XY_PAD` to `ComponentType` in `src/core/types.ts`.
2. Create `src/components/utilities/XYPadConstants.ts` (mirrors `LooperConstants.ts`):
   ```typescript
   export const XY_PAD = {
     SAMPLE_RATE_HZ: 60,
     MAX_DURATION_MS: 60_000,
     MAX_SAMPLES: 3_600, // SAMPLE_RATE_HZ * (MAX_DURATION_MS / 1000)
   } as const;

   export enum XYPadState {
     IDLE = 'idle',
     RECORDING = 'recording',
     PLAYING = 'playing',
   }
   ```
3. Create `src/components/utilities/XYPad.ts` implementing the state machine and CV outputs per `data-model.md`.
4. Create `src/canvas/displays/XYPadDisplay.ts` implementing the overlay canvas, pointer handlers, and Record/Stop/Play button hit-testing, following `LooperDisplay.ts` structurally.

## Module Integration

Wire the new type into the existing registration points (no factory/switch to keep separately in sync beyond these):

1. **`src/components/registerComponents.ts`**:
   ```typescript
   componentRegistry.register(
     ComponentType.XY_PAD,
     'X-Y Pad',
     'Two-axis controller with recordable movement, outputs X and Y as CV',
     'Utilities',
     (id, position) => new XYPad(id, position),
     calculateComponentDimensions(ComponentType.XY_PAD)
   );
   ```
2. **`src/utils/componentLayout.ts`**: add a `case ComponentType.XY_PAD` in `getControlLayout` (return `{ numKnobs: 2, hasDropdown: false, hasDisplayArea: true, displayHeight: <pad height> }`) and in `getPortCounts` (return `{ inputs: 0, outputs: 2 }`). `calculateComponentDimensions` needs no direct edit — it derives `{width, height}` from these two.
3. **`src/canvas/CanvasComponent.ts`**: add an `if (this.type === ComponentType.XY_PAD)` block in `createControls()` that instantiates `XYPadDisplay` as a sibling overlay canvas (`pointerEvents: 'auto'`) and wires its click/drag handlers to `xyPad.pressRecord()` / `pressStop()` / `pressPlay()` / `setPosition()`, following the Looper block as the direct template.
4. **`src/ui/Sidebar.ts`**: add an icon glyph for `ComponentType.XY_PAD` in `getComponentIcon` (no other sidebar change needed — the palette is driven entirely by the registry).

Patch save/load, validation, and the sidebar palette all work automatically once the above is done — `PatchSerializer`/`PatchManager` are polymorphic over the registry and `ComponentData.audioBlob` is already generic.

## Configuration & Parameters

| Parameter | Range | Default | Effect |
|---|---|---|---|
| `xDepth` | 0-100% | 50% | Scales how much of the connected target's parameter range the X output can reach |
| `yDepth` | 0-100% | 50% | Same, for Y output |

## Interaction Lifecycle

```
IDLE --drag on pad--> IDLE (live CV output updates, no recording)
IDLE --pressRecord()--> RECORDING (capture starts immediately, ~60 samples/sec)
RECORDING --pressStop() or max duration reached--> IDLE (recording finalized)
IDLE --pressPlay() [disabled if no recording]--> PLAYING (loops until Stop or manual drag)
PLAYING --pressStop()--> IDLE
PLAYING --drag on pad--> IDLE (manual control preempts playback)
```

## Persistence

- `serialize()`: base class handles `xDepth`/`yDepth` automatically via `addParameter`; override to additionally set `audioBlob` (Base64 of the interleaved `Float32Array`) only when a recording exists.
- `deserialize()`: base class restores parameters automatically; override to decode `audioBlob` back into `_recording` if present. State always restores to `IDLE` — never resume `RECORDING`, matching the Looper's own reload guard.

## Testing Strategy

Per the Constitution's coverage requirements, prioritize pure-logic unit tests that don't require a real `AudioContext`:

- `contracts/validation.ts` helpers (`clampAxis`, `clampPosition`, `isPlayableRecording`, `hasReachedRecordingLimit`, `wrapPlaybackTime`) — 100% coverage target, no mocking needed.
- State machine transitions (`pressRecord`/`pressStop`/`pressPlay`/`setPosition`) — verify each transition in the data-model.md diagram, including the two "interrupt" edges (Record during Playback, drag during Playback).
- Base64 pack/unpack round-trip for the sample buffer — verify a recorded-then-serialized-then-deserialized pad reproduces the same samples (SC-004).
- Depth scaling math — verify a given depth% and target range produce the expected `GainNode.gain.value`, mirroring however `LFO.test.ts` (if present) tests `computeScaleGain`.

## Common Pitfalls & Debugging

- Don't sample recording data on the audio thread — this is UI/pointer state, not an audio signal; use `requestAnimationFrame`, not a `ScriptProcessorNode` (see research.md).
- Remember both axes need independent scaler maps — a single shared map keyed only by target would silently let X and Y depth interfere with each other if the same target parameter were (unusually) connected to both.
- The Play control must check `isPlayableRecording()` before enabling, not just `_recording !== null` — a zero-sample recording (Stop pressed instantly after Record) must not be playable.
