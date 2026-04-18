# Quickstart: BPM-Synced Looper (015)

**Branch**: `015-bpm-looper`
**Dev server**: `npm run dev` → http://localhost:5173

---

## What Was Built

A `Looper` SynthComponent with a doughnut ring canvas display. It records audio input to a `Float32Array` buffer in sync with the global BPM, loops it seamlessly, supports overdub, and passes live input through to the output at all times.

---

## File Map

| File | Purpose |
|------|---------|
| `src/components/utilities/Looper.ts` | SynthComponent + TempoAware — state machine, audio nodes, serialization |
| `src/canvas/displays/LooperDisplay.ts` | Doughnut ring canvas — playhead, state colours, bar count label |
| `src/core/types.ts` | Extended `ComponentData.audioBlob?`; new `ComponentType.LOOPER` |
| `src/keyboard/KeyboardController.ts` | Added `RESERVED_KEYS` set to block 1/2/0 from note mapping |
| `tests/components/Looper.test.ts` | State machine, BPM sync, serialization |
| `tests/components/Looper.buffer.test.ts` | Buffer recording, overdub accumulation, clear |
| `tests/canvas/LooperDisplay.test.ts` | Colour mapping, playhead angle, bar count label |
| `tests/keyboard/KeyboardController.reserved.test.ts` | Reserved-key guard |

---

## Manual Test Steps

### Step 1 — Basic record → play

1. Open the app. Set global BPM to 120.
2. Add a **Signal Generator** (or any audio source) and a **Looper** module to the canvas.
3. Connect Signal Generator output → Looper input. Connect Looper output → a speaker / VCA.
4. On the Looper canvas, select **2 bars**.
5. Press the **Record** button (or press **1**).
6. **Expected**: Ring turns red. Signal Generator audio is audible at the Looper output immediately (passthrough).
7. Wait ~4 seconds (2 bars at 120 BPM).
8. **Expected**: Ring turns green. Loop plays back automatically. Playhead indicator rotates clockwise, completing one revolution every 4 seconds.

### Step 2 — Stop and restart

1. With the loop playing, press **Stop** (or press **2**).
2. **Expected**: Ring turns grey. Audio output goes silent. Looper is idle.
3. Press **Record** (or **1**) again.
4. **Expected**: Ring turns red, new recording begins, previous loop is discarded.

### Step 3 — Overdub

1. Record a 2-bar loop (Step 1).
2. With loop playing, press **Overdub** button (or press the Overdub button on canvas).
3. **Expected**: Ring turns orange. New audio input is heard at output alongside the loop.
4. Press Overdub again.
5. **Expected**: Ring returns green. Both layers play back together.

### Step 4 — Stop during overdub

1. Record and enter overdub.
2. Press **Stop** (or **2**).
3. **Expected**: Ring turns green (exits overdub to playing). Loop is preserved.
4. Press **Stop** again.
5. **Expected**: Ring turns grey (idle).

### Step 5 — Clear

1. With a loop playing, press **Clear** (or press **0**).
2. **Expected**: Ring turns grey immediately. Audio output goes silent. Looper is idle and ready for a new recording.

### Step 6 — Keyboard shortcuts don't trigger musical keyboard

1. Add a **Keyboard** module to the canvas alongside the Looper.
2. Press **1**, **2**, **0** in turn.
3. **Expected**: Looper responds (starts recording / stops / clears). No notes fire on the Keyboard module.

### Step 7 — Bar count selection

1. Set global BPM to 60. Select **1 bar** on the Looper.
2. Press Record. Wait 4 seconds (1 bar at 60 BPM).
3. **Expected**: Loop ends automatically after 4 seconds and begins playing.
4. Confirm the bar count label on the canvas shows "1".

### Step 8 — Patch save and reload

1. Record a 2-bar loop and let it play.
2. Save the patch (File → Save or keyboard shortcut).
3. Reload the page and load the patch.
4. **Expected**: Looper is in playing state with the recorded loop intact. Loop plays immediately.

---

## Key Constants

| Constant | Value | Location |
|----------|-------|----------|
| Shortcut: Record | `1` | `LOOPER_SHORTCUT_RECORD` in contracts/types.ts |
| Shortcut: Stop | `2` | `LOOPER_SHORTCUT_STOP` in contracts/types.ts |
| Shortcut: Clear | `0` | `LOOPER_SHORTCUT_CLEAR` in contracts/types.ts |
| Default bar count | `2` | `LooperConfig.barCount` default |
| Ring: idle | `#4a4a4a` | `LOOPER_STATE_COLORS` |
| Ring: recording | `#e05555` | `LOOPER_STATE_COLORS` |
| Ring: playing | `#4caf50` | `LOOPER_STATE_COLORS` |
| Ring: overdubbing | `#f5a623` | `LOOPER_STATE_COLORS` |

---

## State Transition Cheat Sheet

```
idle ──(1 / Record btn)──► recording ──(auto at loop end)──► playing
                                                                │
                                      ◄──(2 / Stop btn)─────────┤
                                                                │
                                          overdubbing ◄─────────┤ (Overdub btn)
                                               │
                               playing ◄───────┘  (Overdub btn or 2)
                                  │
                             idle ◄── (2 / Stop btn)

Any state ──(0 / Clear btn)──► idle
```
