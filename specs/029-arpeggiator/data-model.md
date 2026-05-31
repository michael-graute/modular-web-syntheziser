# Data Model: Arpeggiator

**Branch**: `029-arpeggiator` | **Date**: 2026-05-31

---

## Entities

### Arpeggiator (SynthComponent subclass)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique component ID (from SynthComponent) |
| `type` | `ComponentType.ARPEGGIATOR` | Fixed enum value |
| `position` | `Position` | Canvas position {x, y} |
| `noteSequence` | `number[]` | Currently latched CV pitch values (max 8, ordered by arrival time) |
| `stepIndex` | `number` | Current position in the expanded step cycle |
| `stepCycle` | `number[]` | Computed step cycle (noteSequence × octave range, direction-ordered) |
| `currentBpm` | `number` | Local copy of global BPM, updated on GLOBAL_BPM_CHANGED |
| `_stepTimer` | `number \| null` | JS interval handle for the step clock |

**Parameters** (stored via `addParameter`, persisted via `PatchSerializer`):

| Parameter ID | Display Name | Default | Min | Max | Step | Unit |
|---|---|---|---|---|---|---|
| `direction` | Direction | 0 | 0 | 3 | 1 | '' |
| `octaves` | Octaves | 1 | 1 | 4 | 1 | '' |
| `subdivision` | Rate | 2 | 0 | 3 | 1 | '' |
| `gateLength` | Gate | 1 | 0 | 2 | 1 | '' |

**Parameter encoding:**

| Parameter | Value | Meaning |
|---|---|---|
| `direction` | 0 | Up |
| `direction` | 1 | Down |
| `direction` | 2 | Up-Down |
| `direction` | 3 | Random |
| `octaves` | 1–4 | Number of octaves to span above source notes |
| `subdivision` | 0 | 1/4 note (fraction 1.0) |
| `subdivision` | 1 | 1/8 note (fraction 0.5) |
| `subdivision` | 2 | 1/16 note (fraction 0.25) |
| `subdivision` | 3 | 1/32 note (fraction 0.125) |
| `gateLength` | 0 | Short (25% of step interval) |
| `gateLength` | 1 | Medium (50% of step interval) |
| `gateLength` | 2 | Long (75% of step interval) |

---

### Audio Nodes (created in `createAudioNodes()`)

| Node | Type | Role |
|------|------|------|
| `cvOutputNode` | `ConstantSourceNode` | Emits current step's CV pitch to connected Oscillators |
| `gateOutputNode` | `ConstantSourceNode` | Emits gate high (1.0) / gate low (0.0) |

Both nodes use `offset.setValueAtTime()` for sample-accurate scheduling.

**Input nodes** (for receiving CV and Gate from upstream):

| Port | Node | Notes |
|------|------|-------|
| `cv-in` | `GainNode` (passthrough) | Input to receive CV pitch; value read via JS getter |
| `gate-in` | `GainNode` (passthrough) | Input to receive gate signal; value read via JS getter |

---

### Step Cycle (derived, not persisted)

| Field | Type | Description |
|-------|------|-------------|
| Base notes | `number[]` | `noteSequence` sorted ascending |
| Expanded | `number[]` | Base notes repeated for each octave (each repetition adds `octave * (12/12V)` semitones in CV) |
| Directed | `number[]` | Expanded notes ordered per direction (reversed for Down; alternating for Up-Down; shuffled for Random) |

**CV pitch convention**: The app uses `1V/octave` standard. One octave = 1.0 in CV units. Semitone = 1/12 ≈ 0.0833. Octave transposition: add `octaveIndex * 1.0` to each CV value.

---

### Persistence (ComponentData)

The Arpeggiator persists via the standard `ComponentData` shape (no new PatchData fields needed):

```
ComponentData {
  id: string
  type: 'arpeggiator'
  position: { x, y }
  parameters: {
    direction: 0 | 1 | 2 | 3
    octaves: 1 | 2 | 3 | 4
    subdivision: 0 | 1 | 2 | 3
    gateLength: 0 | 1 | 2
  }
  isBypassed: undefined   // no bypass on this component
}
```

---

## State Transitions

```
INACTIVE → ACTIVE   : activate() creates audio nodes, starts step clock, subscribes to BPM
ACTIVE → INACTIVE   : deactivate() stops clock, disconnects nodes, unsubscribes from BPM

ACTIVE, gate-high   : latch current CV to noteSequence (max 8, evict oldest); recompute stepCycle
ACTIVE, gate-low    : remove pitch from noteSequence; recompute stepCycle
stepCycle empty     : gateOutputNode.offset = 0; stepIndex = 0; no advance
stepCycle non-empty : each tick advances stepIndex, sets cvOutputNode and gateOutputNode
BPM_CHANGED event   : update currentBpm; restart step clock with new interval
parameter changed   : recompute stepCycle; stepIndex clamped to new cycle length
```
