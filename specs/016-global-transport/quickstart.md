# Quickstart: Global Transport Controller (016)

**Branch**: `016-global-transport`
**Dev server**: `npm run dev` → http://localhost:5173

---

## What Was Built

A `GlobalTransportController` singleton with play/stop state machine and lookahead beat-clock scheduler. A `GlobalTransportControl` toolbar widget shows a ▶/■ toggle button and a live bar.beat position display. The Step Sequencer starts/stops with transport; the Looper stops on transport stop and resumes on transport play if a loop is recorded.

---

## File Map

| File | Purpose |
|------|---------|
| `src/core/GlobalTransportController.ts` | Singleton — state machine + beat clock scheduler |
| `src/ui/GlobalTransportControl.ts` | Toolbar widget — ▶/■ toggle + bar.beat display |
| `src/core/types.ts` | Added `TRANSPORT_PLAY`, `TRANSPORT_STOP`, `TRANSPORT_BEAT` EventTypes + payload types |
| `src/components/utilities/StepSequencer.ts` | Subscribes to transport play/stop |
| `src/components/utilities/Looper.ts` | Subscribes to transport play/stop |
| `src/main.ts` | Instantiates `GlobalTransportControl` in the top bar |
| `tests/core/GlobalTransportController.test.ts` | State machine + beat scheduling unit tests |
| `tests/ui/GlobalTransportControl.test.ts` | Widget DOM + event tests |
| `tests/components/StepSequencer.transport.test.ts` | Transport integration tests |
| `tests/components/Looper.transport.test.ts` | Transport integration tests |

---

## Manual Test Steps

### Step 1 — Basic play/stop

1. Open the app. Observe the ▶ button in the top bar to the left of the BPM control.
2. Press ▶. **Expected**: Button changes to ■. Position display shows "1.1" and advances each beat.
3. Press ■. **Expected**: Button returns to ▶. Position display resets to "1.1".

### Step 2 — Step Sequencer integration

1. Add a Step Sequencer module to the canvas. Configure some steps.
2. Press ▶ (transport). **Expected**: Step Sequencer begins playing immediately.
3. Press ■ (transport). **Expected**: Step Sequencer stops.
4. Confirm the Sequencer's own play button still works independently.

### Step 3 — Looper integration (loop recorded)

1. Add a Looper module. Record a 2-bar loop and let it play.
2. Press ■ on the transport. **Expected**: Looper stops playback (ring turns grey).
3. Press ▶ on the transport. **Expected**: Looper resumes playback automatically (ring turns green).

### Step 4 — Looper integration (no loop)

1. Add a Looper module. Do NOT record a loop.
2. Press ▶ on the transport. **Expected**: Looper stays idle — transport Play does not trigger recording.

### Step 5 — BPM change while playing

1. Press ▶. Observe position counter advancing at current BPM.
2. Change BPM while transport is running. **Expected**: Beat interval changes immediately; no transport restart.

### Step 6 — Multiple components

1. Add both a Step Sequencer and a Looper with a recorded loop.
2. Press ▶. **Expected**: Both start simultaneously.
3. Press ■. **Expected**: Both stop simultaneously.

### Step 7 — Idempotent press

1. With transport playing, press ▶ again. **Expected**: Nothing changes — no restart.
2. With transport stopped, press ■ again. **Expected**: Nothing changes.

### Step 8 — Regression check

1. Load an existing patch. Verify all components load correctly.
2. Confirm the transport starts in the STOPPED state regardless of what the patch contained.

---

## Key Constants

| Constant | Value | Location |
|----------|-------|----------|
| Lookahead window | 25 ms | `TRANSPORT_LOOKAHEAD_MS` in contracts/types.ts |
| Beats per bar | 4 | `BEATS_PER_BAR` in contracts/types.ts |
| Initial position | bar 1, beat 1 | `initialPosition()` in contracts/validation.ts |

---

## State Transition Cheat Sheet

```
STOPPED ──(▶ / play())──▶ PLAYING ──(■ / stop())──▶ STOPPED

play() from PLAYING  → no-op
stop() from STOPPED  → no-op
```
