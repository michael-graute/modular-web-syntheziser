# Data Model: Global Transport Controller (016)

## Entities

### TransportState (enum)

The two possible states of the transport.

| Value | Description |
|-------|-------------|
| `STOPPED` | Transport is not running. Position is reset to bar 1, beat 1. |
| `PLAYING` | Transport is running. Beat ticks are being emitted. |

**Transitions**:
- `STOPPED → PLAYING`: triggered by `play()`
- `PLAYING → STOPPED`: triggered by `stop()`
- All other transitions are no-ops.

---

### TransportPosition

Current playback position. Ephemeral (not persisted to patch).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `bar` | `number` | integer ≥ 1 | Current bar number, starting at 1 |
| `beat` | `number` | integer 1–4 | Current beat within the bar (4/4 time) |

**Reset rule**: Both fields reset to `{ bar: 1, beat: 1 }` on every `stop()` call.

**Increment rule**: On each beat tick, `beat` increments by 1. When `beat` exceeds 4, it wraps to 1 and `bar` increments by 1.

---

### Beat Tick

The event payload emitted on every beat while transport is playing.

| Field | Type | Description |
|-------|------|-------------|
| `bar` | `number` | Bar number at the moment of the tick |
| `beat` | `number` | Beat number within the bar |

---

## EventType Additions

Three new entries added to the existing `EventType` enum in `src/core/types.ts`:

| EventType constant | String value | Payload type | Emitted when |
|-------------------|--------------|--------------|--------------|
| `TRANSPORT_PLAY` | `'transport:play'` | `undefined` | Transport transitions STOPPED → PLAYING |
| `TRANSPORT_STOP` | `'transport:stop'` | `undefined` | Transport transitions PLAYING → STOPPED |
| `TRANSPORT_BEAT` | `'transport:beat'` | `TransportBeatPayload` | Every beat while PLAYING |

---

## State Transitions

```
┌─────────┐   play()    ┌─────────┐
│ STOPPED │ ──────────▶ │ PLAYING │
│         │ ◀────────── │         │
└─────────┘   stop()    └─────────┘

play() from PLAYING  → no-op
stop() from STOPPED  → no-op
```

---

## No Patch Persistence

Transport state is intentionally ephemeral. The patch format (`PatchData`) is not modified. Every session starts with transport in the `STOPPED` state.
