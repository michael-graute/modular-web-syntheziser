# Research: Global Transport Controller (016)

## Beat Clock Scheduling

**Decision**: Use a JS-thread `setTimeout` lookahead scheduler (not `setInterval`, not the Web Audio scheduler directly).

**Rationale**: The Web Audio API's `AudioContext.currentTime` is the gold standard for sample-accurate scheduling, but the transport only needs beat-level precision (~10–500 ms intervals at 60–300 BPM). A lookahead pattern (`setTimeout` firing ~25 ms ahead of the next beat, scheduling the tick at the precise `AudioContext.currentTime` moment) gives sub-millisecond accuracy without blocking the audio thread. This is the same pattern used by the Web Audio API tutorial (Chris Wilson's "A Tale of Two Clocks") and matches what the existing `StepSequencer` uses internally.

**BPM-change handling**: On every BPM change during playback, the scheduler recomputes the next beat time from `AudioContext.currentTime` rather than from the previous beat offset. This avoids drift accumulation and means BPM changes take effect within one beat period at most.

**Alternatives considered**:
- `setInterval`: Rejected — drifts over time; interval does not self-correct for JS thread jank.
- `AudioWorkletProcessor` clock: Rejected — overkill for beat-level transport; adds AudioWorklet complexity the project has deliberately avoided.
- `requestAnimationFrame`: Rejected — tied to 60 FPS render cycle, not tempo; accuracy degrades at high BPM.

---

## Transport State Machine

**Decision**: Two states only — `STOPPED` and `PLAYING`. No `PAUSED` state.

**Rationale**: The spec explicitly calls out that Stop always resets to bar 1, beat 1. A `PAUSED` state (resume from position) is deferred to a future feature. Keeping two states makes the state machine trivially testable and avoids premature complexity.

**Transitions**:
```
STOPPED —(play())→ PLAYING
PLAYING —(stop())→ STOPPED
play() from PLAYING = no-op
stop() from STOPPED = no-op
```

---

## Position Tracking

**Decision**: Bar and beat are tracked as integer counters on the JS thread, incremented on every beat tick. 4/4 time signature fixed.

**Rationale**: Position is display-only in this version (no sample-accurate seek required). Integer counters are trivially serializable and testable. Beat advances 1→2→3→4→1 (wrap), bar increments when beat wraps.

**Reset**: Both bar and beat reset to 1 on `stop()`.

---

## EventBus Event Design

**Decision**: Three new EventType entries:
- `TRANSPORT_PLAY` — emitted once when transport transitions to PLAYING
- `TRANSPORT_STOP` — emitted once when transport transitions to STOPPED
- `TRANSPORT_BEAT` — emitted on every beat tick with `{ bar: number, beat: number }` payload

**Rationale**: Separate events for play/stop vs. beat tick keeps subscribers simple — components that only need start/stop don't have to filter beat ticks. The beat payload carries position so subscribers (future metronome, count-in) never maintain their own counter.

**Alternatives considered**:
- Single `TRANSPORT_STATE_CHANGED` event: Rejected — requires every subscriber to switch on state; more boilerplate.
- Including BPM in beat payload: Deferred — subscribers that need BPM already have `globalBpmController.getBpm()`; adding it to the payload would couple transport to BPM unnecessarily.

---

## StepSequencer Integration

**Decision**: StepSequencer subscribes to `TRANSPORT_PLAY` → calls `start()`, `TRANSPORT_STOP` → calls `stop()`, inside `subscribeToGlobalBpm()` (or a new `subscribeToTransport()` called from `createAudioNodes()`).

**Rationale**: The StepSequencer already has `start()` and `stop()` public methods. No new audio logic needed — only EventBus wiring. The subscription is added alongside the existing BPM subscription to keep audio-node lifecycle consistent.

**Guard**: If transport fires `PLAY` while the Sequencer is already playing (e.g., started manually), `start()` is idempotent — it checks `isPlaying` before scheduling.

---

## Looper Integration

**Decision**: Looper subscribes to `TRANSPORT_STOP` → calls `pressStop()` (halts playback, preserves buffer). Subscribes to `TRANSPORT_PLAY` → calls `_resumePlayback()` only if `filled === true`; no-op otherwise.

**Rationale**: The Looper's `pressStop()` already handles the PLAYING → IDLE transition correctly. For play-resume, we need a new internal `_resumePlayback()` that restarts `_startPlayback()` without changing the `_filled` flag or triggering recording — distinct from `pressRecord()`.

---

## UI Widget Placement

**Decision**: `GlobalTransportControl` widget is inserted into `#global-bpm-control`'s parent container immediately to the left of the BPM widget, using the same DOM construction pattern.

**Rationale**: The transport button logically belongs next to BPM in the controls bar. Inserting before the BPM container keeps reading order left-to-right: ▶ → BPM → Tap → ... → Save/Load.

**Position display**: A small `<span>` showing "1.1" next to the toggle button, updated on every `TRANSPORT_BEAT` event and reset on stop.
