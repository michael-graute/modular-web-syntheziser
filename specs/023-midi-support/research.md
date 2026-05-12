# Research: MIDI Support (023)

## Web MIDI API — Browser Access Pattern

**Decision**: Use the native Web MIDI API (`navigator.requestMIDIAccess()`) with no polyfill or library.

**Rationale**: The project has a hard constraint of zero runtime dependencies. The Web MIDI API is available in Chrome and Edge (the primary target browsers) and provides all required capabilities: device enumeration, note-on/off, CC messages, and hot-plug events. Safari and Firefox lack native support — the spec's fallback message covers this case.

**Alternatives considered**:
- `WebMidi.js` library: Feature-rich but adds a runtime dependency — rejected.
- `JZZ.js`: More portable but also a dependency — rejected.
- MIDI.js: Outdated — rejected.

**Permission flow**: `navigator.requestMIDIAccess({ sysex: false })` is called on app load. The `sysex: false` option avoids the more intrusive SysEx permission prompt in some browsers. If the returned Promise rejects or the API is absent, the app enters MIDI-unavailable state.

---

## MIDI Event Processing Architecture

**Decision**: Introduce a singleton `MidiEngine` class in `src/midi/MidiEngine.ts` that owns all MIDI access, device state, CC mapping dispatch, and note routing.

**Rationale**: Centralising MIDI logic in one singleton mirrors the existing `audioEngine` and `patchManager` pattern. It keeps `main.ts` wiring minimal and makes the MIDI layer testable in isolation.

**Key responsibilities**:
- Hold the `MIDIAccess` object and listen for `onstatechange` (hot-plug).
- Maintain the active input device selection.
- Dispatch incoming MIDI messages: note-on/off → `eventBus`; CC → mapped `SynthComponent` parameter.
- Own the CC mapping registry (`Map<string, MidiMapping>`).
- Provide serialise/deserialise helpers called by `PatchSerializer`.

---

## Note Routing to Keyboard Component

**Decision**: Reuse the existing `NOTE_ON` / `NOTE_OFF` EventType events. `MidiEngine` emits them on the `eventBus` when a MIDI note message arrives; the existing Keyboard/audio wiring in `main.ts` already consumes these events without modification.

**Rationale**: The Keyboard component already uses a callback pattern wired in `main.ts` (lines 362–364). Rather than coupling `MidiEngine` directly to the Keyboard, emitting `NOTE_ON` / `NOTE_OFF` on the event bus keeps the layers decoupled. Polyphony is handled automatically because the existing audio engine accepts simultaneous note-on events.

**Velocity**: MIDI velocity (0–127) is normalised to 0.0–1.0 and included in the `NOTE_ON` event payload, matching the existing payload shape.

---

## CC-to-Parameter Mapping

**Decision**: Map CC messages to `SynthComponent` parameters using the existing `setParameterValue()` method and emit `PARAMETER_CHANGED` on the event bus for visualisation sync.

**Rationale**: `SynthComponent.setParameterValue()` is the canonical parameter mutation path — it updates the audio node, the stored `parameters` map, and triggers any registered change listeners. Calling it from `MidiEngine` reuses the full existing chain without duplication. `CanvasComponent` reacts to `PARAMETER_CHANGED` events to redraw knobs, so visual sync is automatic.

**CC value scaling**: Incoming CC value (0–127) is mapped linearly to the parameter's `[min, max]` range stored in `SynthComponent`. The mapping record stores the component ID and parameter name; the scaling is computed at dispatch time.

---

## MIDI Learn State Machine

**Decision**: `MidiEngine` owns a lightweight MIDI Learn state machine with three states: `idle` → `waiting` → `idle`.

- `idle`: Normal CC dispatch.
- `waiting`: A control has been clicked; the engine holds a `pendingTarget` (componentId + parameterName). The next incoming CC message is used to create a mapping, then state returns to `idle`.
- Escape / cancel: Clears `pendingTarget`, returns to `idle` without creating a mapping.
- Page reload: `pendingTarget` is never persisted — only confirmed mappings are saved.

**Rationale**: A two-state machine is the minimal model that satisfies all acceptance scenarios. No additional complexity is needed.

---

## Patch Serialisation Integration

**Decision**: Add `midiMappings?: MidiMapping[]` to the top-level `PatchData` interface. `PatchSerializer` calls `midiEngine.saveToPatch(patch)` during serialise and `midiEngine.loadFromPatch(patch)` during deserialise — mirroring the existing `globalBpmController.saveToPatch(patch)` pattern (PatchSerializer.ts line 43).

**Rationale**: Keeping MIDI mappings at the top level of `PatchData` (not inside `ComponentData`) is correct because a mapping spans two entities: a MIDI CC number and a component parameter. The optional `?` ensures backward compatibility — legacy patches without `midiMappings` load cleanly (treated as empty array).

**Load behaviour**: When a patch is loaded, all current CC mappings are replaced by the patch's `midiMappings`. When a new empty patch is created, `midiMappings` is omitted (equivalent to clearing all mappings).

---

## UI: MIDI Toolbar

**Decision**: Add a `MidiToolbar` widget (`src/ui/MidiToolbar.ts`) rendered into a new `<div id="midi-toolbar">` element placed between the keyboard section and the canvas area in `index.html`. The toolbar contains:
- MIDI status indicator (connected / unavailable)
- Device picker `<select>` (populated dynamically)
- "MIDI Learn" toggle button
- "Mappings" button that opens the mapping overview panel

**Rationale**: The spec requires the device picker and MIDI Learn toggle to be always visible. Placing the toolbar below the canvas and above the keyboard section keeps it co-located with the performance area without cluttering the existing top-bar. It follows the same DOM-building pattern as `GlobalBpmControl` and `GlobalTransportControl`.

---

## MIDI Mapping Overview Panel

**Decision**: Implement as a modal (`src/ui/MidiMappingsModal.ts`) triggered by the "Mappings" button in the toolbar. Lists all current mappings in a table (component name, parameter, CC, channel) with per-row delete buttons and a "Clear All" button.

**Rationale**: A modal is the lightest addition that satisfies the P3 user story. It follows the existing modal pattern used by the Welcome Dialog and Help overlay. No new route or page is needed.

---

## EventType Additions

New events to add to `EventType` enum in `src/core/types.ts`:

| Event | Payload | Purpose |
|---|---|---|
| `MIDI_DEVICE_CONNECTED` | `{ deviceName: string }` | Toolbar status update |
| `MIDI_DEVICE_DISCONNECTED` | `{ deviceName: string }` | Toolbar status update |
| `MIDI_LEARN_STARTED` | `{ componentId, paramName }` | Highlight waiting control |
| `MIDI_LEARN_COMPLETED` | `{ mapping: MidiMapping }` | Clear highlight, show assignment |
| `MIDI_LEARN_CANCELLED` | `{}` | Clear highlight |
| `MIDI_MAPPINGS_CHANGED` | `{}` | Refresh mapping overview panel |

---

## Latency Considerations

The spec requires end-to-end latency under 10ms. Web MIDI API delivers messages via browser callbacks; forwarding them to `AudioContext.currentTime`-based scheduling keeps audio latency minimal. The CC dispatch path (MIDI callback → `setParameterValue()` → `AudioParam.setValueAtTime()`) is synchronous and runs on the main thread — well within the 10ms target for parameter changes. Note triggering uses the same `triggerNoteOn()` path already used by the on-screen keyboard, which is already tuned to the audio scheduler tick.

---

## Testing Strategy

- `MidiEngine` is unit-testable by passing a mock `MIDIAccess` object (no real hardware needed).
- CC dispatch logic (value scaling, mapping lookup) reaches 100% coverage via unit tests.
- `PatchSerializer` round-trip tests extended to include `midiMappings`.
- `MidiToolbar` and `MidiMappingsModal` tested via DOM assertions (jsdom in Vitest).
- Integration tests simulate full note-on flow: mock MIDI message → eventBus → audio engine mock.
