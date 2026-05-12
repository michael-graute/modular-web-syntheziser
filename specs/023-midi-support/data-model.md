# Data Model: MIDI Support (023)

## Entities

### MidiMapping

A persistent association between one MIDI CC message and one component parameter.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `componentId` | `string` | Required, non-empty | Matches `ComponentData.id` |
| `parameterName` | `string` | Required, non-empty | Key in `SynthComponent.parameters` |
| `channel` | `number` | 0–15 (0 = any channel / omni) | MIDI channel; 0 means accept on all channels |
| `cc` | `number` | 0–127 | MIDI Control Change number |
| `minValue` | `number` | Required | Parameter's minimum value (for scaling) |
| `maxValue` | `number` | Required, > `minValue` | Parameter's maximum value (for scaling) |

**Identity**: A mapping is uniquely identified by `(componentId, parameterName)` — one control can have at most one CC assignment.
**Conflict rule**: A single CC+channel combination MAY be assigned to multiple controls (fan-out). Reassigning a control replaces its existing mapping.

---

### MidiDeviceState (runtime-only, not persisted)

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Web MIDI `MIDIInput.id` |
| `name` | `string` | Display name from `MIDIInput.name` |
| `connected` | `boolean` | Live connection state |

---

### MidiLearnSession (transient, never persisted)

| Field | Type | Notes |
|---|---|---|
| `componentId` | `string` | Target component awaiting assignment |
| `parameterName` | `string` | Target parameter awaiting assignment |

State: `null` = idle; non-null = waiting for CC input.

---

## PatchData Extension

`MidiMapping[]` is added as an optional top-level field on `PatchData`:

```
PatchData {
  name, version, created, modified, description?,
  globalBpm?,
  components: ComponentData[],
  connections: Connection[],
  midiMappings?: MidiMapping[]   ← NEW (optional for backward compat)
}
```

Absence of `midiMappings` (legacy patches) is treated as `[]`.

---

## State Transitions

### MidiEngine lifecycle

```
App load
  └─► requestMIDIAccess()
        ├─ rejected / unsupported → MIDI_UNAVAILABLE state (permanent)
        └─ resolved → MIDI_READY state
              └─► onstatechange listener active (hot-plug)
                    ├─ device connected → emit MIDI_DEVICE_CONNECTED
                    └─ device disconnected → emit MIDI_DEVICE_DISCONNECTED
```

### MIDI Learn state machine

```
idle
  └─► user clicks assignable control
        └─► MidiLearnSession created → waiting
              ├─ CC message received
              │     └─► mapping saved → MidiLearnSession = null → idle
              │           emit MIDI_LEARN_COMPLETED, MIDI_MAPPINGS_CHANGED
              └─ Escape / Cancel button
                    └─► MidiLearnSession = null → idle
                          emit MIDI_LEARN_CANCELLED
```

### Patch load/save

```
save():  midiEngine.saveToPatch(patch) → writes patch.midiMappings
load():  midiEngine.loadFromPatch(patch) → replaces all mappings with patch.midiMappings ?? []
new():   patch has no midiMappings field → all mappings cleared
```

---

## Value Scaling

CC value (0–127) → parameter value:

```
paramValue = minValue + (ccValue / 127) * (maxValue - minValue)
```

This is stored as a pure function in `MidiEngine` with no side effects, making it trivially unit-testable.

---

## Registry Structure (in-memory)

```
MidiEngine {
  midiAccess: MIDIAccess | null
  activeInputId: string | null
  mappings: Map<`${componentId}:${parameterName}`, MidiMapping>
  learnSession: MidiLearnSession | null
}
```

Map key is `componentId:parameterName` — O(1) lookup per CC dispatch cycle.
