# Data Model: BPM-Synced Looper (015)

**Date**: 2026-04-18
**Branch**: `015-bpm-looper`

---

## Entities

### LooperState (enum)

```typescript
enum LooperState {
  IDLE        = 'idle',
  RECORDING   = 'recording',
  PLAYING     = 'playing',
  OVERDUBBING = 'overdubbing',
}
```

**State transitions:**

```
idle ──(Record pressed)──► recording ──(loop end, auto)──► playing
                                                              │
                                    ◄──(Stop pressed)─────────┤
                                                              │
                                         overdubbing ◄────────┤ (Overdub pressed)
                                              │
                                         playing ◄────────────┘ (Overdub/Stop pressed)
                                              │
                                         idle ◄──────────────── (Stop pressed from playing)

idle/recording/playing/overdubbing ──(Clear pressed)──► idle (always)
```

---

### LooperConfig

Persisted to `ComponentData.parameters` (numeric fields) and `ComponentData.audioBlob` (binary).

| Field | Type | Range / Values | Default | Notes |
|-------|------|----------------|---------|-------|
| `barCount` | `number` | 1 \| 2 \| 4 \| 8 | `2` | Selected before recording; fixed for lifetime of a recording |
| `state` | `LooperState` | see enum | `IDLE` | Serialized as string; restored on load |
| `bpm` | `number` | 30–300 | `120` | Snapshot of global BPM at record start; not configurable directly |

**Serialized as `parameters`:**

```typescript
parameters: {
  barCount: number;   // 1 | 2 | 4 | 8
  stateIndex: number; // 0=idle, 1=recording, 2=playing, 3=overdubbing
}
```

**Serialized separately as `audioBlob`:**

```typescript
audioBlob?: string; // Base64-encoded raw IEEE 754 Float32 mono PCM; absent when no loop recorded
```

---

### LoopBuffer (runtime only, not directly serialized)

| Field | Type | Notes |
|-------|------|-------|
| `samples` | `Float32Array` | Raw PCM, mono, 44100 Hz sample rate |
| `lengthSamples` | `number` | `Math.round(loopDurationSeconds × sampleRate)` |
| `writeHead` | `number` | Current write position during recording/overdub (0 … lengthSamples-1) |
| `playHead` | `number` | Current read position during playback (0 … lengthSamples-1); drives visual indicator |
| `filled` | `boolean` | True once one complete recording pass has been committed |

---

### LooperDisplayState (passed to LooperDisplay each frame)

| Field | Type | Notes |
|-------|------|-------|
| `state` | `LooperState` | Drives ring colour |
| `playHeadNormalized` | `number` | 0.0–1.0 (playHead / lengthSamples); drives rotating indicator angle |
| `barCount` | `number` | Rendered as label on canvas |
| `filled` | `boolean` | True when a loop is recorded; affects whether playhead is drawn |

---

## Computed Values

| Value | Formula | Notes |
|-------|---------|-------|
| Loop duration (seconds) | `barCount × 4 × 60 / BPM` | Computed once at record start |
| Loop duration (samples) | `Math.round(durationSeconds × sampleRate)` | `sampleRate` from `AudioContext.sampleRate` |
| Playhead angle (radians) | `playHeadNormalized × 2π - π/2` | −π/2 so 0 = top of ring |

---

## State Ring Colours

| LooperState | Ring colour | Hex |
|-------------|-------------|-----|
| `idle` | Grey | `#4a4a4a` |
| `recording` | Red | `#e05555` |
| `playing` | Green | `#4caf50` |
| `overdubbing` | Orange | `#f5a623` |

---

## ComponentData Extension

```typescript
// src/core/types.ts — extend existing interface
export interface ComponentData {
  id: string;
  type: ComponentType;
  position: Position;
  parameters: Record<string, number>;
  isBypassed?: boolean;
  audioBlob?: string;  // NEW — Base64 PCM for Looper; ignored by all other components
}
```

**Backward compatibility**: `audioBlob` is optional. All existing components omit it; all existing load paths are unaffected.

---

## Validation Rules

| Rule | Constraint |
|------|-----------|
| `barCount` | Must be one of: 1, 2, 4, 8 |
| `stateIndex` | Must be 0–3; map back to `LooperState` on deserialize |
| `audioBlob` | If present, must be valid Base64; decoded length must match `barCount` |
| Loop duration | Must be > 0; `barCount` and BPM must both be positive |
| `playHeadNormalized` | Clamped to [0.0, 1.0] before rendering |
