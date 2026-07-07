# Phase 1 Data Model: X-Y Pad Controller

## XYPad (SynthComponent subclass)

Extends `SynthComponent`, placed in `src/components/utilities/XYPad.ts`, registered as `ComponentType.XY_PAD` (category `Utilities`).

### State

| Field | Type | Notes |
|---|---|---|
| `_state` | `XYPadState` (`IDLE \| RECORDING \| PLAYING`) | State machine; mirrors `LooperState` shape but without `OVERDUBBING` — no overdub concept for a position controller |
| `_x` | `number` (0-1) | Current normalized horizontal position (resting or live-drag) |
| `_y` | `number` (0-1) | Current normalized vertical position |
| `_xDepth` | `number` (0-100, parameter) | Attenuation for X output, addParameter-backed like LFO's `depth` |
| `_yDepth` | `number` (0-100, parameter) | Attenuation for Y output |
| `_recording` | `MovementRecording \| null` | The captured sample buffer, or null if none exists yet |
| `_playbackStartTime` | `number \| null` | `performance.now()` timestamp playback began, for computing loop-relative position during PLAYING |

### Outputs

| Port ID | Signal Type | Description |
|---|---|---|
| `x` | `CV` | Horizontal position output; connects via `getOutputNodeByPort('x')` |
| `y` | `CV` | Vertical position output; connects via `getOutputNodeByPort('y')` |

Each output maintains its own `Map<string, ConnectionScaler>` (keyed `${target.id}:${inputId}`), identical in structure to `LFO.connectionScalers` — one map per axis since X and Y depth are independent (FR-004a).

### Parameters (via `addParameter`)

| ID | Default | Range | Unit | Maps to |
|---|---|---|---|---|
| `xDepth` | 50 | 0-100 | % | `_xDepth` |
| `yDepth` | 50 | 0-100 | % | `_yDepth` |

### Methods (public API, mirrors Looper's press-method style)

- `pressRecord()`: If `PLAYING`, stop playback first (FR: starting Record during playback stops it — matches "starting a new recording discards the previous one" edge case). Discards `_recording` if present. Transitions to `RECORDING`. Begins capture immediately at current `_x`/`_y` (FR-008, clarified: no arm-and-wait).
- `pressStop()`: Ends `RECORDING` (finalizes `_recording`) or ends `PLAYING` (holds last replayed values per FR-006). Returns to `IDLE`.
- `pressPlay()`: No-op if `_recording` is null (Play control disabled per FR-012). Transitions to `PLAYING`, sets `_playbackStartTime`.
- `setPosition(x, y)`: Called by `XYPadDisplay` on drag. Clamps to [0,1] per axis (FR-016). If `PLAYING`, immediately stops playback and hands control to manual position (FR-014). If `RECORDING`, appends a sample to the active buffer.
- `getPosition(): {x, y}`: Current resting/live/playback-derived position, for the display to render the handle.
- `isPlayAvailable(): boolean`: `_recording !== null` — drives the Play control's disabled state (FR-012).

### Recording capture loop

A `requestAnimationFrame`-driven sampler (started on `pressRecord()`, stopped on `pressStop()` or auto-stop at max duration) appends `(t, x, y)` to a pre-allocated `Float32Array` sized for `XY_PAD.MAX_SAMPLES` (≈3600, see Constants). Write index bound-checked each frame; reaching capacity auto-stops recording (FR-017) exactly like the Looper's `_writeHead >= _loopLengthSamples` check.

### Playback loop

While `PLAYING`, a `requestAnimationFrame` loop computes elapsed time since `_playbackStartTime`, wraps it modulo the recording's total duration (FR-011: loop continuously), finds the nearest captured sample (or linearly interpolates between the two nearest), and calls the same position-setting path used for live drag so both output-update and rendering logic stay unified.

### Serialization

`serialize()` extends `SynthComponent.serialize()`:
- `parameters.xDepth`, `parameters.yDepth` — handled automatically by base class via `addParameter`-registered params
- `audioBlob` — set to `_float32ToBase64(packedSamples)` only when `_recording !== null` (mirrors Looper's conditional assignment)

`deserialize(data)`:
- Restores `xDepth`/`yDepth` via base class parameter restore
- If `data.audioBlob` present, unpacks via `_base64ToFloat32` and reconstructs `_recording`
- State always restored as `IDLE` (never `RECORDING`; `PLAYING` also not auto-resumed — matches Looper's conservative reload guard, since there's no reason to assume the user wants immediate playback on load)

## MovementRecording (internal value type, not a SynthComponent)

Plain data structure, not persisted independently — exists only as `XYPad._recording` and its packed/unpacked Base64 form.

| Field | Type | Notes |
|---|---|---|
| `samples` | `Float32Array` | Interleaved `[t0, x0, y0, t1, x1, y1, ...]`, length = `sampleCount * 3` |
| `sampleCount` | `number` | Number of `(t,x,y)` triples actually captured (≤ `XY_PAD.MAX_SAMPLES`) |
| `durationMs` | `number` | `samples[(sampleCount-1)*3]` — timestamp of the last sample, used for loop-wrap math |

### Validation rules

- `sampleCount` MUST be ≥ 1 whenever `_recording !== null` (a zero-length recording is treated as no recording — Play stays disabled).
- `x`/`y` values within samples MUST be within [0, 1] (same clamp invariant as live position, FR-016).
- `durationMs` MUST be ≤ `XY_PAD.MAX_DURATION_MS` (60000ms per Assumptions).

## State Transitions

```
IDLE --pressRecord()--> RECORDING
RECORDING --pressStop()--> IDLE (recording finalized)
RECORDING --auto-stop (max duration/samples reached)--> IDLE (recording finalized)
IDLE --pressPlay() [requires _recording != null]--> PLAYING
PLAYING --pressStop()--> IDLE (holds last position)
PLAYING --setPosition() [user drags]--> IDLE (manual control takes over, per FR-014)
PLAYING --pressRecord()--> RECORDING (stops playback, discards old recording, starts new capture)
PLAYING --loop end reached--> PLAYING (wraps to start, does not transition)
```

No transition exists directly from `RECORDING` to `PLAYING` — the user must press Stop first (matches Looper-style discrete state machine, and there is no spec requirement for auto-play-after-record).
