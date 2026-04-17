# Data Model: Global BPM Control

**Feature**: 013-global-bpm  
**Date**: 2026-04-17

## Entities

### GlobalBpmController (singleton, runtime)

Holds the authoritative BPM value. Lives in `src/core/GlobalBpmController.ts`.

| Field | Type | Default | Constraints |
|-------|------|---------|-------------|
| `bpm` | `number` | `120` | 30–300, integer |

**Methods**:
- `getBpm(): number` — returns current global BPM
- `setBpm(value: number): void` — clamps to 30–300, emits `EventType.GLOBAL_BPM_CHANGED`
- `loadFromPatch(patch: PatchData): void` — reads `patch.globalBpm ?? 120`
- `saveToPatch(patch: PatchData): PatchData` — returns patch with `globalBpm` set

---

### PatchData (extended)

Existing type in `src/core/types.ts`. Add one optional field:

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `globalBpm?` | `number` | `120` | Omitted in legacy patches; treated as 120 on load |

---

### ComponentData — BPM mode fields

Each tempo-aware component (`StepSequencer`, `Collider`) stores two extra parameters in its existing `parameters: Record<string, number>` map:

| Parameter key | Type | Default | Values |
|---|---|---|---|
| `bpmMode` | `number` | `0` | `0` = follow global, `1` = local override |
| `bpm` | `number` | `120` | Active only when `bpmMode === 1`; still serialized always |

No changes to `ComponentData` type definition — parameters are already a free `Record<string, number>`.

---

### GlobalBpmControl (UI widget)

Lives in `src/ui/GlobalBpmControl.ts`. Stateless beyond delegating to `GlobalBpmController`.

**DOM elements produced**:
- Container div injected into `.top-bar`
- `<label>` "BPM"
- `<input type="number">` bound to `GlobalBpmController.getBpm()` / `setBpm()`
- `<button>` "Tap" for tap tempo

**Tap tempo state** (internal to widget, not persisted):
- `tapTimes: number[]` — timestamps of recent taps
- Taps older than 3 seconds are discarded before averaging

---

## State Transitions: BPM Mode per Component

```
[global mode] ──── user enables local override ──→ [local mode]
     ↑                                                    │
     └──────── user disables local override ─────────────┘

On global BPM change:
  [global mode] → receives BPM_CHANGED event → updates internal timing immediately at next step boundary
  [local mode]  → ignores BPM_CHANGED event

On component added to canvas:
  → defaults to [global mode] → reads GlobalBpmController.getBpm() immediately
```

---

## Event Schema

New event type added to `EventType` enum in `src/core/types.ts`:

```typescript
GLOBAL_BPM_CHANGED = 'global:bpm-changed'
```

Payload: `{ bpm: number }` — the new BPM value (already clamped 30–300).

---

## Serialization / Deserialization Flow

**Save**:
1. `PatchSerializer.serializePatch()` calls `globalBpmController.saveToPatch()` to inject `globalBpm` into the patch object before returning it.

**Load**:
1. After `PatchManager` instantiates components, it calls `globalBpmController.loadFromPatch(patch)`.
2. `GlobalBpmController.setBpm()` emits `GLOBAL_BPM_CHANGED`.
3. Components that were serialized with `bpmMode=0` pick up the global value from the event; components with `bpmMode=1` ignore it and use their own serialized `bpm`.

**Legacy patch**:
- `patch.globalBpm` is `undefined` → `globalBpmController.loadFromPatch()` defaults to `120`.
- Components have no `bpmMode` parameter → defaults to `0` (global mode) because `getParameter('bpmMode')?.getValue() ?? 0`.
