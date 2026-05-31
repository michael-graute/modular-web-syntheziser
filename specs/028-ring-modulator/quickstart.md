# Quickstart: Ring Modulator Implementation

**Feature**: 028-ring-modulator  
**Date**: 2026-05-31

This is a concise guide for implementing the Ring Modulator. All design decisions are in [research.md](./research.md); all data shapes in [data-model.md](./data-model.md).

---

## Files to create

| File | Action |
|---|---|
| `src/components/effects/RingModulator.ts` | Create — core audio component |
| `tests/components/RingModulator.test.ts` | Create — unit tests |

## Files to modify

| File | Change |
|---|---|
| `src/core/types.ts` | Add `RING_MODULATOR = 'ring-modulator'` to `ComponentType` enum |
| `src/components/base/SynthComponent.ts` | Add `ComponentType.RING_MODULATOR` to `isBypassable()` allowlist |
| `src/components/registerComponents.ts` | Import `RingModulator` and register it in the `Effects` category |
| `src/canvas/CanvasComponent.ts` | Add `'⊗'` icon to the `getDisplayName()` / icon map for `RING_MODULATOR` |
| `src/ui/Sidebar.ts` | Add `[ComponentType.RING_MODULATOR]: '⊗'` to the icon map |
| `src/utils/componentLayout.ts` | Add `RING_MODULATOR` port counts (2 inputs, 1 output) and control layout (empty) |

---

## Audio graph (summary)

```
Audio In  → carrierBypassGain (1.0) → multiplierGain [signal]
Modulator → modulatorEntry    (1.0) → multiplierGain.gain (base=0.0)
                                       ↓
                                   outputGain → Audio Out
```

Bypass: `carrierBypassGain` → `outputGain` (direct; skips `multiplierGain`).

---

## Key implementation details

1. **`getInputNode(portId?)`** must return `multiplierGain` for `'audio-in'` and `modulatorEntry` for `'modulator'`.
2. **`multiplierGain.gain.value = 0.0`** initially — ensures silence when modulator absent.
3. **`updateAudioParameter()`** is a required abstract method — implement as a no-op.
4. **`enableBypass()`**: disconnect `carrierBypassGain` → `multiplierGain`; connect `carrierBypassGain` → `outputGain`.
5. **`disableBypass()`**: restore connections from `_bypassConnections`.
6. **No controls** — the `CanvasComponent.createControls()` switch needs no case for `RING_MODULATOR`; the default (no controls) is correct.

---

## Run tests

```sh
vitest run tests/components/RingModulator.test.ts
```

Full test suite:

```sh
npm run lint && vitest run
```
