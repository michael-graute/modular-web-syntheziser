# Quickstart: MIDI Support (023)

## What this feature adds

- A `MidiEngine` singleton (`src/midi/MidiEngine.ts`) that owns Web MIDI access, device state, CC dispatch, and note routing.
- A `MidiToolbar` UI widget (`src/ui/MidiToolbar.ts`) always visible below the canvas with device picker and MIDI Learn toggle.
- A `MidiMappingsModal` (`src/ui/MidiMappingsModal.ts`) listing all active CC mappings with delete controls.
- Extensions to `PatchData` and `PatchSerializer` to persist MIDI mappings inside patch files.
- New `EventType` values for MIDI device and learn lifecycle events.

## New files

| File | Purpose |
|---|---|
| `src/midi/MidiEngine.ts` | Singleton — Web MIDI access, CC dispatch, learn state machine |
| `src/ui/MidiToolbar.ts` | Always-visible MIDI toolbar widget |
| `src/ui/MidiMappingsModal.ts` | Modal to view / delete CC mappings |
| `tests/midi/MidiEngine.test.ts` | Unit tests for MidiEngine |
| `tests/ui/MidiToolbar.test.ts` | DOM tests for MidiToolbar |

## Modified files

| File | Change |
|---|---|
| `src/core/types.ts` | Add `MidiMapping`, `MidiLearnSession`, `MidiDeviceInfo` interfaces; add 6 MIDI `EventType` values; add `midiMappings?: MidiMapping[]` to `PatchData` |
| `src/patch/PatchSerializer.ts` | Call `midiEngine.saveToPatch()` / `midiEngine.loadFromPatch()` |
| `src/main.ts` | Instantiate `MidiEngine`, `MidiToolbar`, `MidiMappingsModal`; wire `MidiEngine` to Keyboard note callbacks |
| `index.html` | Add `<div id="midi-toolbar">` below `.canvas-container` |
| `src/styles/components.css` | Styles for MIDI toolbar, learn highlight, mapping modal |

## Key integration points

### 1. Note routing
`MidiEngine` emits existing `NOTE_ON` / `NOTE_OFF` EventType events on `eventBus`. No changes to the Keyboard component or existing `triggerNoteOn()` / `triggerNoteOff()` functions in `main.ts`.

### 2. CC parameter control
`MidiEngine.dispatchCc(channel, cc, value)` looks up mappings, calls `synthComponent.setParameterValue(paramName, scaledValue)`, then emits `PARAMETER_CHANGED` so `CanvasComponent` redraws the knob.

### 3. MIDI Learn
`MidiEngine.startLearn(componentId, paramName)` sets `learnSession`. Each `CanvasComponent` listens for `MIDI_LEARN_STARTED` to highlight the target control. On the next incoming CC, the mapping is saved and `MIDI_LEARN_COMPLETED` is emitted to clear the highlight.

### 4. Patch persistence
`PatchSerializer.serializePatch()` calls `midiEngine.saveToPatch(patch)` — same pattern as `globalBpmController.saveToPatch(patch)`. On load, `midiEngine.loadFromPatch(patch)` replaces all current mappings.

## Running tests

```bash
vitest run
```

## Checking types

```bash
npx tsc --noEmit
```
