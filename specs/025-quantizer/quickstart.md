# Quickstart: Implementing the Quantizer

**Branch**: `025-quantizer` | **Date**: 2026-05-30  
**For**: Developer picking up this feature cold

## TL;DR

Add a `Quantizer` utility component that snaps CV → nearest in-scale pitch. CV-in + optional gate-in → CV-out. Control-rate processing via visual update scheduler. No new dependencies.

## Files to Create

| File | What it is |
|------|-----------|
| `src/components/utilities/Quantizer.ts` | The component — extends `SynthComponent` |
| `tests/components/utilities/Quantizer.test.ts` | Unit tests |

## Files to Modify

| File | What to change |
|------|---------------|
| `src/core/types.ts` | Add `QUANTIZER = 'quantizer'` to `ComponentType` enum |
| `src/components/registerComponents.ts` | Import and register `Quantizer` in `'Utilities'` group |
| `src/canvas/CanvasComponent.ts` | Add `if (this.type === ComponentType.QUANTIZER)` block in `createControls()` |
| `src/utils/componentLayout.ts` | Add dimensions case for `ComponentType.QUANTIZER` |

## Existing Code to Reuse

- `specs/025-quantizer/contracts/types.ts` — enums, constants, config interface (already written)
- `specs/025-quantizer/contracts/validation.ts` — `buildPitchTable()`, `quantizeCv()`, `midiToNoteLabel()`, `midiToCv()`, `serializeQuantizerConfig()`, `deserializeQuantizerConfig()` (already written)
- `src/components/utilities/ChordFinder.ts` — closest structural analog; follow its constructor, port setup, serialize/deserialize, and parameter update patterns
- `src/components/utilities/Collider.ts` — reference for `visualUpdateScheduler` subscription pattern

## Component Structure Outline

```typescript
// src/components/utilities/Quantizer.ts
export class Quantizer extends SynthComponent {
  private config: QuantizerConfig;
  private pitchTable: readonly number[];
  private heldCv: number;
  private lastGateValue: number;
  private currentNoteLabel: string;

  // Web Audio nodes
  private cvOutputNode: ConstantSourceNode | null;

  // Visual update subscription
  private schedulerHandle: SubscriptionHandle | null;

  constructor(id: string, position: Position) { ... }

  // SynthComponent overrides
  createAudioNodes(): void { ... }    // create cvOutputNode
  destroyAudioNodes(): void { ... }   // stop + disconnect nodes
  serialize(): ComponentData { ... }  // use serializeQuantizerConfig()
  deserialize(data: ComponentData): void { ... } // use deserializeQuantizerConfig()

  // CV input port
  getInputNode(portId: string): AudioNode | null { ... }

  // Gate input port (read value polled in update loop)
  private gateInputNode: ConstantSourceNode | null;

  // Called each visual scheduler tick
  private update(): void {
    // 1. Read CV input value
    // 2. Read gate value + detect rising edge
    // 3. In trigger-free mode OR on rising edge: quantize CV, update heldCv + label
    // 4. Write heldCv to cvOutputNode.offset
  }

  // Called when root or scale changes
  private rebuildPitchTable(): void { ... }

  // Parameter updates (from CanvasComponent controls)
  updateParameter(id: string, value: number): void { ... }
}
```

## CanvasComponent Controls to Add

In `CanvasComponent.createControls()`, add a block for `ComponentType.QUANTIZER`:

```typescript
if (this.type === ComponentType.QUANTIZER) {
  // Dropdown: Root note (0–11)
  // Dropdown: Scale type (0–7)
  // Text label: current note (e.g. "A4") — read-only display
}
```

Follow the existing dropdown pattern used for Collider's scale/root dropdowns (lines 1057–1230 of `CanvasComponent.ts`).

## Ports

```
Inputs:
  cv-in    (CV,   green)  — incoming pitch CV
  gate-in  (Gate, red)    — optional trigger (omit connection = continuous mode)

Outputs:
  cv-out   (CV,   green)  — quantized pitch CV
```

## Key Invariants

1. `pitchTable` is always non-empty (MAJOR scale over C0–C8 = 57 entries minimum).
2. Output CV is always within `[CV_MIN, CV_MAX]` = `[-4.0, 4.0]`.
3. `currentNoteLabel` always reflects the current `heldCv` value.
4. No audio-rate processing — all logic runs in the visual update scheduler callback.
5. Gate detection state (`lastGateValue`) resets to 0.0 on `destroyAudioNodes()`.

## Running Tests

```bash
vitest run tests/components/utilities/Quantizer.test.ts
```

Full suite:
```bash
vitest run
```
