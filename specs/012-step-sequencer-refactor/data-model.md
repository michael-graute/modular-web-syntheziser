# Data Model: Step Sequencer Refactor (012)

**Date**: 2026-04-12
**Branch**: `012-step-sequencer-refactor`

---

## Entities

### SequencerStep

One programmable unit in the pattern.

| Field | Type | Range / Values | Default | Notes |
|---|---|---|---|---|
| `active` | `boolean` | true / false | `true` | Whether this step fires during playback |
| `note` | `number` | 0–127 (MIDI) | `60` (C4) | In standalone mode: absolute MIDI note. In arp mode: stored as `semitoneOffset + 64` (offset −12 → 52, +12 → 76) |
| `velocity` | `number` | 0.0–1.0 | `0.8` | Step velocity; 1.0 = full, 0.0 = silent |
| `gateLength` | `number` (enum) | 0–5 | `3` | 0=tied, 1=1/1, 2=1/2, 3=1/4, 4=1/8, 5=1/16 |

**Invariants**:
- Array length is always 16; `sequenceLength` controls which indices are active during playback.
- `note` is always stored in the 0–127 range regardless of mode; the display layer decodes the arpeggiator offset as `note − 64`.
- `gateLength === 0` (tied) means no gate-off event is emitted for that step; the gate remains high until the next active step's gate-on.

### Pattern (global settings)

The complete state of the sequencer at rest. Serialized as `Parameter` entries.

| Parameter ID | Type | Range | Default | Notes |
|---|---|---|---|---|
| `bpm` | `number` | 30–300 | `120` | Beats per minute |
| `noteValue` | `number` | 0–5 | `2` | Global step division: 0=whole,1=1/2,2=1/4,3=1/8,4=1/16,5=1/32 |
| `sequenceLength` | `number` | 2–16 | `16` | How many steps play before looping |
| `mode` | `number` | 0–1 | `0` | 0=Sequencer (standalone), 1=Arpeggiator |
| `step_N_active` | `number` | 0–1 | `1` | Per-step (N = 0–15); 0=inactive, 1=active |
| `step_N_note` | `number` | 0–127 | `60` | Per-step MIDI note or encoded semitone offset |
| `step_N_velocity` | `number` | 0.0–1.0 | `0.8` | Per-step velocity |
| `step_N_gateLength` | `number` | 0–5 | `3` | Per-step gate length enum |

Total new `Parameter` instances added: 2 global + 64 per-step = **66 new parameters** per component.

### Transport

Ephemeral runtime state — not serialized.

| Field | Type | Notes |
|---|---|---|
| `isPlaying` | `boolean` | Play/Stop state |
| `currentStep` | `number` | Lookahead step pointer (0-indexed) |
| `visualCurrentStep` | `number` | Visual highlight pointer (set via setTimeout at step time) |
| `nextStepTime` | `number` | Web Audio context time of next scheduled step |
| `scheduleInterval` | `number \| null` | `setInterval` handle for 25ms scheduler |

### ArpeggiatorState

Ephemeral runtime state — not serialized.

| Field | Type | Notes |
|---|---|---|
| `arpBaseNote` | `number` | MIDI note of held keyboard key |
| `arpIsKeyHeld` | `boolean` | Whether keyboard gate is currently high |
| `lastArpGateState` | `number` | Previous gate value for edge detection |

---

## State Transitions

### Transport States

```
STOPPED ──[Play pressed]──► PLAYING
PLAYING ──[Stop pressed]──► STOPPED
PLAYING ──[Component deleted]──► STOPPED (cleanup)
STOPPED ──[Reset pressed]──► STOPPED (currentStep = 0)

// Arpeggiator mode only:
STOPPED + mode=ARP ──[keyboard gate high]──► PLAYING
PLAYING + mode=ARP ──[keyboard gate low]──► STOPPED + reset
```

### Note Picker Popup States

```
CLOSED ──[click note label in step cell]──► OPEN (for that step)
OPEN ──[select note name or octave]──► CLOSED (step note updated)
OPEN ──[click outside popup]──► CLOSED (no change)
OPEN + sequencer PLAYING ──► stays OPEN (playback unaffected)
```

### Mode Toggle

```
SEQUENCER ──[mode button click]──► ARPEGGIATOR
ARPEGGIATOR ──[mode button click]──► SEQUENCER
// If playing when toggled: stop and reset first, then switch mode
```

---

## Serialization Shape

The `StepSequencer.serialize()` method inherits from `SynthComponent.serialize()`. Output shape:

```typescript
{
  id: string;
  type: "STEP_SEQUENCER";
  position: { x: number; y: number };
  parameters: {
    // Global
    "bpm": number;          // 30–300
    "noteValue": number;    // 0–5
    "sequenceLength": number; // 2–16
    "mode": number;         // 0 or 1

    // Per-step (N = 0..15)
    "step_0_active": number;
    "step_0_note": number;
    "step_0_velocity": number;
    "step_0_gateLength": number;
    // ... step_1_ through step_15_
  }
}
```

**Deserialization**: `setParameterValue(id, value)` is called for each key. The component must call `syncStepsFromParameters()` after all parameter values are restored to copy `step_N_*` values back into the runtime `this.steps[]` array.

---

## Rendering Data Flow

```
StepSequencer (audio component)
  └── getSteps(): SequencerStep[]      ← called each frame
  └── getCurrentStep(): number         ← visual highlight index
  └── getIsPlaying(): boolean
  └── getParameter('sequenceLength')   ← active length
  └── getParameter('mode')             ← display mode label

StepSequencerDisplay (canvas renderer)
  └── render(ctx, x, y, w, h)
      ├── draws transport bar (Play/Stop/Reset buttons, BPM knob, Division dropdown, Length knob, Mode toggle)
      ├── draws step grid (16 cells, highlights active length)
      │   └── per cell: active indicator, note label, velocity knob, gate dropdown
      └── draws note picker popup (if open) via two Dropdown controls
```

---

## Audio Output Mapping

| Output Port | Audio Node | Value When Step Triggers |
|---|---|---|
| `frequency` | `ConstantSourceNode` | `440 × 2^((midiNote − 69) / 12)` Hz |
| `gate` | `ConstantSourceNode` | 1.0 on gate-on, 0.0 on gate-off (suppressed for tied steps) |
| `velocity` | `ConstantSourceNode` | `step.velocity` (0.0–1.0) |

**Arpeggiator frequency**: `baseHz × 2^(semitoneOffset / 12)` where `semitoneOffset = step.note − 64`.
