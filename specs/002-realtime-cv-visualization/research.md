# Research: Realtime CV Parameter Visualization

**Feature**: 002-realtime-cv-visualization
**Date**: 2025-10-29
**Status**: Complete

## Research Questions

### 1. How to efficiently sample parameter values from Web Audio API thread?

**Decision**: Use AudioWorkletProcessor with SharedArrayBuffer for lock-free communication

**Rationale**:
- Web Audio API runs on separate audio rendering thread (AudioWorkletGlobalScope)
- Parameters are AudioParam objects that exist in audio thread context
- SharedArrayBuffer provides zero-copy data sharing between audio and main threads
- Atomic operations prevent race conditions without locks
- 20 Hz sampling (50ms interval) is much slower than audio rate, minimizing overhead

**Alternatives Considered**:
1. **MessagePort communication** - Rejected: Higher latency (5-15ms), requires serialization overhead
2. **Polling AudioParam.value from main thread** - Rejected: Only returns scheduled values, not actual modulated output
3. **ScriptProcessorNode** - Rejected: Deprecated API, runs on main thread causing jank

**Implementation Notes**:
- Sample at 20 Hz (every 50ms) in AudioWorklet
- Write normalized values [0-1] to SharedArrayBuffer at parameter-specific indices
- Main thread reads via Atomics.load() for consistency
- Maximum 32 parameters per Float32Array (128 bytes) to keep cache-friendly

---

### 2. How to prevent audio glitches while updating UI at 60 FPS?

**Decision**: Decouple sampling (20 Hz) from rendering (60 FPS) using double-buffered state

**Rationale**:
- Audio thread sampling at 20 Hz is independent of main thread rendering at 60 FPS
- requestAnimationFrame provides optimal scheduling for UI updates
- Interpolation between 20 Hz samples creates smooth 60 FPS visuals
- Read from SharedArrayBuffer is fast (<1μs), won't block rendering

**Alternatives Considered**:
1. **Direct audio rate sampling** - Rejected: 48kHz → 60 Hz decimation wasteful, SharedArrayBuffer becomes bottleneck
2. **Throttled updates at 20 Hz only** - Rejected: Visuals appear choppy compared to 60 FPS
3. **Web Workers for interpolation** - Rejected: Over-engineered, main thread has plenty of capacity

**Implementation Notes**:
- Main thread runs requestAnimationFrame loop at ~60 FPS
- Each frame: read all modulated parameter values from SharedArrayBuffer
- Interpolate between previous and current sample for smooth motion
- Update canvas controls via setVisualValue(normalized: number) method
- Use linear interpolation initially; cubic for future enhancement

---

### 3. How to handle parameter base value + CV modulation offset?

**Decision**: Track base value separately, render combined (base + CV) value on controls

**Rationale**:
- Clarification answer: "Show only the current modulated result"
- AudioParam already handles modulation internally via .value property
- UI controls just need to display final computed value
- Parameter class stores base value; visualization layer shows modulated output

**Alternatives Considered**:
1. **Show both base and modulated** - Rejected: User chose "show only result" in clarification
2. **Compute modulation depth manually** - Rejected: AudioParam already does this, redundant

**Implementation Notes**:
- Parameter.value = base value set by user
- AudioParam.value = base + all modulation sources (computed by Web Audio API)
- Sample AudioParam.value in AudioWorklet for display
- User manual adjustments update Parameter.value (base), modulation continues relative to new base

---

### 4. How to handle off-screen parameter controls efficiently?

**Decision**: Visibility tracking with IntersectionObserver, skip rendering for off-screen controls

**Rationale**:
- Clarification answer: "Pause visual updates when off-screen"
- IntersectionObserver provides efficient viewport visibility detection
- Canvas rendering is synchronous and expensive for hidden elements
- Skipping render() calls for off-screen controls saves CPU

**Alternatives Considered**:
1. **Always render everything** - Rejected: Wastes CPU on invisible controls
2. **Manual scroll event tracking** - Rejected: IntersectionObserver is more efficient and handles edge cases
3. **Virtual scrolling** - Rejected: Over-engineered for modular synth UI with few components

**Implementation Notes**:
- Each CanvasComponent (Knob, Slider, Button) registers with IntersectionObserver
- Observer tracks visibility state in isVisible boolean
- render() method checks isVisible before drawing
- Modulation data still sampled at 20 Hz (cheap), only rendering is skipped

---

### 5. How to smooth CV connection creation/destruction?

**Decision**: Fade modulation depth over 100ms using exponential ramp

**Rationale**:
- Clarification answer: "Smoothly transition visually and sonically (fade in/out over short time)"
- AudioParam.exponentialRampToValueAtTime() provides click-free transitions
- 100ms duration (success criterion SC-006) is perceptible but not sluggish
- Applies to both audio and visual rendering for consistency

**Alternatives Considered**:
1. **Linear ramp** - Rejected: Exponential sounds more natural for audio parameters
2. **Instant connection** - Rejected: Causes audio clicks and visual jumps
3. **Longer fade (500ms)** - Rejected: Feels unresponsive in fast workflow

**Implementation Notes**:
- On connection create: exponentialRampToValueAtTime(targetValue, audioContext.currentTime + 0.1)
- On connection destroy: exponentialRampToValueAtTime(baseValue, audioContext.currentTime + 0.1)
- Visual controls interpolate during 100ms transition period
- Queue state changes in StateManager to prevent race conditions

---

## Technology Best Practices

### Web Audio API with AudioWorklet

**Best Practices**:
- Keep AudioWorklet code minimal (sampling only)
- Avoid allocations in audio thread (use preallocated buffers)
- Use Float32Array for parameter values (native audio format)
- Atomic operations (Atomics.store/load) for thread safety
- Process parameters in batches to minimize cache misses

**Pitfalls to Avoid**:
- Don't call AudioParam.setValueAtTime() at audio rate (causes glitches)
- Don't use console.log() in AudioWorklet (kills performance)
- Don't create new objects in audio callback
- Don't block main thread reading from SharedArrayBuffer

**References**:
- MDN Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- AudioWorklet best practices: https://developers.google.com/web/updates/2017/12/audio-worklet

---

### Canvas Rendering Optimization

**Best Practices**:
- Use requestAnimationFrame for all rendering (never setInterval)
- Batch canvas operations (minimize save/restore calls)
- Avoid frequent fillStyle/strokeStyle changes
- Dirty rectangle tracking to redraw only changed regions
- Cache transformed coordinates between frames

**Pitfalls to Avoid**:
- Don't clear entire canvas every frame (redraw dirty regions only)
- Don't call measureText() in render loop (cache text metrics)
- Don't use shadowBlur (extremely slow on canvas)
- Don't create gradients every frame (cache and reuse)

**References**:
- HTML5 Canvas Performance: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas

---

### TypeScript Event-Driven Architecture

**Best Practices**:
- Use typed event payloads (no `any`)
- EventBus pattern for loose coupling between systems
- Unsubscribe from events in cleanup/destroy methods
- Throttle high-frequency events at source, not consumers
- Use WeakMap for component → listener mapping (prevents memory leaks)

**Pitfalls to Avoid**:
- Don't create new listener functions on every emit (bind once)
- Don't forget to remove listeners (causes memory leaks)
- Don't emit events synchronously from deep call stacks
- Don't use EventTarget for high-frequency events (overhead)

**References**:
- Event-Driven TypeScript patterns: https://www.typescriptlang.org/docs/handbook/2/classes.html

---

## Integration Patterns

### Audio Thread → Main Thread Communication

**Pattern**: Producer-Consumer with SharedArrayBuffer

```typescript
// AudioWorklet (producer)
const paramIndex = 0;
const normalizedValue = audioParam.value; // 0-1
Atomics.store(sharedBuffer, paramIndex, normalizedValue);

// Main Thread (consumer)
const normalizedValue = Atomics.load(sharedBuffer, paramIndex);
control.setVisualValue(normalizedValue);
```

**Why**: Lock-free, low-latency, no serialization overhead

---

### UI Control Updates

**Pattern**: Observer pattern with throttled updates

```typescript
// ModulationVisualizer
class ModulationVisualizer {
  private updateLoop() {
    requestAnimationFrame(() => this.updateLoop());

    for (const [paramId, control] of this.trackedControls) {
      const value = this.sampler.getValue(paramId);
      control.setVisualValue(value);
    }
  }
}
```

**Why**: Centralized update logic, automatic 60 FPS scheduling, clean separation

---

### Connection Lifecycle Management

**Pattern**: State machine with transition events

```
States: DISCONNECTED → CONNECTING → CONNECTED → DISCONNECTING → DISCONNECTED

Events:
- connection.create → CONNECTING (start fade-in)
- fade.complete → CONNECTED
- connection.destroy → DISCONNECTING (start fade-out)
- fade.complete → DISCONNECTED
```

**Why**: Prevents race conditions, enforces smooth transitions, testable

---

## Performance Benchmarks

**Target Metrics** (from Success Criteria):
- Parameter update latency: < 50ms (SC-001)
- Simultaneous parameters: ≥ 10 without lag (SC-002)
- Frame drops: < 5% (SC-004)
- Visual accuracy: ± 2% (SC-005)
- Transition time: ≤ 100ms (SC-006)

**Estimated Performance** (based on research):
- SharedArrayBuffer read: ~0.5μs per parameter
- 10 parameters at 60 FPS: ~300μs per frame (negligible)
- Canvas render per knob: ~100μs (well within 16ms frame budget)
- Memory footprint: ~4KB for 32 parameters (SharedArrayBuffer)

**Conclusion**: All performance targets achievable with proposed architecture
