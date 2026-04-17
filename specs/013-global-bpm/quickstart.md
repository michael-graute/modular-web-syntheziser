# Quickstart: Global BPM Control (013-global-bpm)

## What this feature does

Introduces a single global BPM control in the application toolbar. All tempo-aware components (Step Sequencer, Collider) follow it by default. Individual components can optionally override with a local BPM.

## Key files to create / modify

| Action | File | Notes |
|--------|------|-------|
| **Create** | `src/core/GlobalBpmController.ts` | Singleton; holds BPM; emits `GLOBAL_BPM_CHANGED` |
| **Create** | `src/ui/GlobalBpmControl.ts` | Toolbar widget; numeric input + tap tempo button |
| **Modify** | `src/core/types.ts` | Add `GLOBAL_BPM_CHANGED` to `EventType`; add `globalBpm?` to `PatchData` |
| **Modify** | `src/components/utilities/StepSequencer.ts` | Add `bpmMode` parameter; subscribe/unsubscribe pattern |
| **Modify** | `src/components/utilities/Collider.ts` | Add `bpmMode` parameter; subscribe/unsubscribe pattern |
| **Modify** | `src/patch/PatchSerializer.ts` | Inject/read `globalBpm` field |
| **Modify** | `src/patch/PatchManager.ts` | Call `globalBpmController.loadFromPatch()` after load |
| **Modify** | `index.html` | Add BPM widget placeholder in `.top-bar` |
| **Modify** | `src/main.ts` | Instantiate `GlobalBpmControl` |

## Architecture in one paragraph

`GlobalBpmController` is a singleton (exported from `src/core/GlobalBpmController.ts`) that holds the current BPM and broadcasts changes via `eventBus.emit(EventType.GLOBAL_BPM_CHANGED, { bpm })`. Tempo-aware components subscribe to this event during `activate()` and unsubscribe during `deactivate()`. Each such component carries a `bpmMode` parameter (0 = global, 1 = local); when `bpmMode === 0` and the event fires, the component schedules the new BPM at its next step boundary. The `GlobalBpmControl` toolbar widget is a thin UI shell that calls `globalBpmController.setBpm()`. `PatchSerializer` reads/writes the top-level `globalBpm` field to keep the value round-tripping through save/load/export/import.

## Testing the feature manually

1. Open the app — BPM control appears in the top bar showing `120`.
2. Add a Step Sequencer and start playback.
3. Change global BPM — the sequencer speeds up/slows down on the next step.
4. Add a Collider — it immediately plays at the global BPM.
5. Enable local BPM on the Step Sequencer, set it to `60` — sequencer now runs at half time while Collider stays on global BPM.
6. Save the patch, reload — both global BPM and local override are restored.
7. Load a legacy patch (without `globalBpm` field) — no error; all components default to `120`.

## Running tests

```bash
vitest run
```
