# Research: Collider Musical Physics Component

Technical research and design decisions for the Collider Musical Physics component.

**Date**: 2025-11-07
**Target**: TypeScript 5.6+, ES2020, Web Audio API
**Context**: Audio synthesis module with physics-based collision triggering

---

## 1. Collision Detection Algorithms

### Decision: Brute-Force O(n²) with Spatial Awareness

**Rationale**:
- For N=20 objects, brute-force requires only 190 checks per frame (n×(n-1)/2)
- At 60fps, this is ~11,400 checks/second - trivial for modern JavaScript
- Implementation simplicity reduces bugs and maintenance overhead
- Spatial partitioning overhead (grid management, bucket sorting) exceeds savings at this scale
- TypeScript number operations are highly optimized in V8

**Alternatives Considered**:
- **Quadtree/Grid Partitioning**: Adds complexity, only beneficial at N>100
- **Sweep and Prune**: Requires sorted lists, overhead not justified for N=20
- **Broad Phase + Narrow Phase**: Over-engineering for small object count

**Implementation Notes**:

```typescript
// Circle-circle collision detection
function checkCircleCollision(c1: Circle, c2: Circle): boolean {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const distanceSquared = dx * dx + dy * dy;
  const radiusSum = c1.radius + c2.radius;
  return distanceSquared < (radiusSum * radiusSum);
}

// Avoid sqrt by comparing squared distances
// For N=20: nested loop from i=0 to i<N-1, j=i+1 to j<N

// Circle-wall collision (AABB)
function checkWallCollision(circle: Circle, bounds: Rect): CollisionSide | null {
  if (circle.x - circle.radius < bounds.left) return 'left';
  if (circle.x + circle.radius > bounds.right) return 'right';
  if (circle.y - circle.radius < bounds.top) return 'top';
  if (circle.y + circle.radius > bounds.bottom) return 'bottom';
  return null;
}
```

**Performance**:
- Avoid `Math.sqrt()` by comparing squared distances
- Use typed arrays if profiling shows bottleneck (unlikely)
- Single pass per frame after physics update

---

## 2. Elastic Collision Physics

### Decision: 2D Elastic Collision with Equal Mass, Position Correction

**Rationale**:
- Equal mass assumption simplifies formulas (velocities exchange along collision normal)
- Physically accurate for modular synthesis aesthetic
- Position correction prevents tunneling/overlap accumulation
- Deterministic behavior enhances musical predictability

**Alternatives Considered**:
- **Inelastic Collisions**: Energy loss makes system slow down, breaks continuous motion
- **Variable Mass**: Adds complexity without musical benefit
- **Impulse-Based Physics**: Overkill for circular objects with constant velocity

**Implementation Notes**:

```typescript
// 2D elastic collision (equal mass)
function resolveCollision(c1: Circle, c2: Circle): void {
  // Collision normal (normalized)
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const nx = dx / dist;
  const ny = dy / dist;

  // Relative velocity
  const dvx = c1.vx - c2.vx;
  const dvy = c1.vy - c2.vy;

  // Relative velocity along normal
  const dvn = dvx * nx + dvy * ny;

  // Do not resolve if velocities are separating
  if (dvn <= 0) return;

  // Equal mass: exchange velocity components along normal
  c1.vx -= dvn * nx;
  c1.vy -= dvn * ny;
  c2.vx += dvn * nx;
  c2.vy += dvn * ny;

  // Position correction (separate overlapping circles)
  const overlap = (c1.radius + c2.radius) - dist;
  const correction = overlap / 2 + 0.01; // Small epsilon
  c1.x -= correction * nx;
  c1.y -= correction * ny;
  c2.x += correction * nx;
  c2.y += correction * ny;
}

// Wall reflection
function resolveWallCollision(circle: Circle, side: CollisionSide): void {
  switch (side) {
    case 'left':
      circle.x = bounds.left + circle.radius;
      circle.vx = Math.abs(circle.vx);
      break;
    case 'right':
      circle.x = bounds.right - circle.radius;
      circle.vx = -Math.abs(circle.vx);
      break;
    case 'top':
      circle.y = bounds.top + circle.radius;
      circle.vy = Math.abs(circle.vy);
      break;
    case 'bottom':
      circle.y = bounds.bottom - circle.radius;
      circle.vy = -Math.abs(circle.vy);
      break;
  }
}
```

**Handling Simultaneous Collisions**:
- Resolve all collisions in a single pass per frame
- Position correction prevents cascading overlap
- Order-independent resolution (symmetric formulas)
- Rare 3-body collisions: acceptable approximation (resolve pairwise)

**Edge Cases**:
- Zero velocity check prevents division by zero
- Epsilon in position correction prevents floating-point sticking
- Clamp positions to bounds after all collision resolution

---

## 3. Musical Scale Systems

### Decision: Semitone Interval Arrays + MIDI-to-Hz Standard + 1V/octave CV

**Rationale**:
- Semitone intervals are standard music theory representation
- MIDI note numbers provide canonical reference (A4 = 440Hz = MIDI 69)
- 1V/octave is universal modular synthesis standard
- Tonic/fifth weighting integrates naturally with weighted random selection

**Alternatives Considered**:
- **Frequency Ratios**: Less intuitive than semitones, harder to transpose
- **Hz Arrays**: Inflexible for root note changes
- **Custom CV Standard**: Breaking conventions creates user confusion

**Implementation Notes**:

```typescript
// Scale definitions (semitone intervals from root)
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],           // W-W-H-W-W-W-H
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],   // W-H-W-W-H-3H-H
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],    // W-H-W-W-H-W-W
  lydian: [0, 2, 4, 6, 7, 9, 11],          // W-W-W-H-W-W-H
  mixolydian: [0, 2, 4, 5, 7, 9, 10],      // W-W-H-W-W-H-W
} as const;

// MIDI to Hz conversion
function midiToHz(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// Hz to CV (1V/octave, C4 = 0V reference)
function hzToCV(hz: number): number {
  const midiNote = 69 + 12 * Math.log2(hz / 440);
  return (midiNote - 60) / 12; // C4 (MIDI 60) = 0V
}

// Root note + scale degree -> CV
function getCV(rootMidi: number, scaleDegree: number, scale: number[]): number {
  const midiNote = rootMidi + scale[scaleDegree % scale.length];
  return (midiNote - 60) / 12;
}

// Weighted random scale degree (2x weight for tonic and fifth)
function selectScaleDegree(scale: number[]): number {
  // Assumes tonic = index 0, fifth = index 4 (true for all listed scales)
  const weights = scale.map((_, i) => (i === 0 || i === 4) ? 2 : 1);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) return i;
  }
  return 0; // Fallback to tonic
}
```

**CV Output Implementation**:
- Use `ConstantSourceNode` with scheduled `AudioParam` changes
- Linear ramp to new CV value (0.5ms to prevent clicks)
- Range: -5V to +5V (10 octave range, standard Eurorack)

---

## 4. Canvas Rendering Performance

### Decision: RequestAnimationFrame with Dirty Rectangle Optimization

**Rationale**:
- `requestAnimationFrame` syncs with display refresh (60fps)
- Full canvas clear + redraw is ~0.5ms for 20 circles (negligible)
- Dirty rectangles add complexity for minimal gain at this scale
- Flash effect requires full redraw anyway (background change)

**Alternatives Considered**:
- **Dirty Rectangles**: Only beneficial for static backgrounds with sparse updates
- **OffscreenCanvas**: No benefit for simple 2D circles (GPU-accelerated anyway)
- **WebGL**: Massive overkill for 20 circles, harder to debug

**Implementation Notes**:

```typescript
class ColliderRenderer {
  private animationId: number | null = null;

  start(): void {
    const render = (timestamp: number) => {
      this.clear();
      this.drawBounds();
      this.drawCircles();
      this.drawFlash(); // If active
      this.animationId = requestAnimationFrame(render);
    };
    this.animationId = requestAnimationFrame(render);
  }

  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawCircles(): void {
    for (const circle of this.circles) {
      this.ctx.beginPath();
      this.ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = circle.color;
      this.ctx.fill();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
  }

  drawFlash(): void {
    if (this.flashOpacity > 0) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${this.flashOpacity})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.flashOpacity -= 0.05; // Decay over ~20 frames
    }
  }
}
```

**Flash/Pulse Visual Feedback**:
- Set `flashOpacity = 0.3` on collision
- Decay linearly per frame (reaches 0 in ~300ms)
- Use `globalCompositeOperation = 'lighter'` for additive flash

**Optimization**:
- Cache canvas context
- Avoid string concatenation in hot loop (pre-compute colors)
- Use `fill()` without closing path (circles don't need `closePath()`)

---

## 5. Web Audio API Gate/Envelope for Timed CV Signals

### Decision: ConstantSourceNode + exponentialRampToValueAtTime for Gates

**Rationale**:
- `ConstantSourceNode` provides DC offset (perfect for CV signals)
- `exponentialRampToValueAtTime` prevents audio clicks (smooth transitions)
- `AudioParam` automation is sample-accurate (sub-millisecond precision)
- `AudioContext.currentTime` provides BPM-synchronized scheduling

**Alternatives Considered**:
- **GainNode Envelopes**: Requires audio source, not suitable for CV
- **Linear Ramps**: Audible clicks at sharp transitions
- **OscillatorNode at 0Hz**: Non-standard, phase accumulation issues

**Implementation Notes**:

```typescript
class CVGateGenerator {
  private cvNode: ConstantSourceNode;
  private gateNode: ConstantSourceNode;

  constructor(private ctx: AudioContext) {
    this.cvNode = ctx.createConstantSource();
    this.gateNode = ctx.createConstantSource();
    this.cvNode.offset.value = 0;
    this.gateNode.offset.value = 0;
    this.cvNode.start();
    this.gateNode.start();
  }

  triggerNote(cv: number, gateDurationMs: number): void {
    const now = this.ctx.currentTime;
    const gateTime = gateDurationMs / 1000;

    // CV change (exponential to avoid clicks)
    this.cvNode.offset.cancelScheduledValues(now);
    this.cvNode.offset.setValueAtTime(this.cvNode.offset.value, now);
    this.cvNode.offset.exponentialRampToValueAtTime(
      Math.max(0.001, cv), // Clamp to positive for exponential ramp
      now + 0.001 // 1ms ramp
    );

    // Gate envelope (0V -> 5V -> 0V)
    this.gateNode.offset.cancelScheduledValues(now);
    this.gateNode.offset.setValueAtTime(0, now);
    this.gateNode.offset.linearRampToValueAtTime(5, now + 0.001); // Attack
    this.gateNode.offset.setValueAtTime(5, now + gateTime - 0.005); // Hold
    this.gateNode.offset.linearRampToValueAtTime(0, now + gateTime); // Release
  }

  getCVOutput(): AudioNode { return this.cvNode; }
  getGateOutput(): AudioNode { return this.gateNode; }

  cleanup(): void {
    this.cvNode.stop();
    this.gateNode.stop();
    this.cvNode.disconnect();
    this.gateNode.disconnect();
  }
}
```

**BPM-Based Gate Duration**:
```typescript
function bpmToGateDuration(bpm: number, noteDivision: number): number {
  // noteDivision: 1 = quarter note, 0.5 = eighth note, etc.
  const quarterNoteDuration = 60000 / bpm; // ms
  return quarterNoteDuration * noteDivision;
}
```

**Preventing Clicks/Pops**:
- Always use `setValueAtTime` before ramps (defines starting point)
- Use `exponentialRampToValueAtTime` for pitch changes (musical)
- Minimum ramp time: 1ms (below human perception threshold)
- Cancel scheduled values before new automation (prevents conflicts)

**Edge Cases**:
- Exponential ramps require positive values: `Math.max(0.001, cv)`
- Handle negative CV by offsetting: `cv + 5` (range 0-10V internally)

---

## 6. Weighted Random Distribution

### Decision: Linear Scan with Cumulative Weight Threshold

**Rationale**:
- Simple, readable, debuggable
- O(n) complexity negligible for n=7 (scale degrees)
- No external dependencies or complex data structures
- Easily adjustable weights (just modify array)

**Alternatives Considered**:
- **Alias Method**: O(1) selection but O(n) setup, overkill for n=7
- **Binary Search + Cumulative Array**: Added complexity, no performance gain
- **Lookup Table**: Hardcoded, inflexible for dynamic weights

**Implementation Notes**:

```typescript
function weightedRandom<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }

  return items[items.length - 1]; // Fallback (should never reach)
}

// Usage for scale degrees with 2x tonic/fifth weighting
function selectScaleDegree(scale: number[]): number {
  const degrees = scale.map((_, i) => i);
  const weights = scale.map((_, i) => (i === 0 || i === 4) ? 2 : 1);
  return weightedRandom(degrees, weights);
}
```

**Performance**:
- Pre-compute total weight if weights are static
- Use `Float32Array` if profiling shows bottleneck (unlikely)
- Expected comparisons: ~3 for uniform distribution

**Musical Rationale**:
- Tonic (root) provides stability and resolution
- Fifth (dominant) creates harmonic tension
- 2x weighting: ~29% tonic, ~29% fifth, ~42% other degrees (7-note scale)

---

## 7. State Management for Running Simulation

### Decision: Explicit Lifecycle with Cleanup Hooks

**Rationale**:
- TypeScript classes with `start()` / `stop()` methods match existing codebase patterns
- Explicit cleanup prevents memory leaks (critical for audio apps)
- Single animation frame ID and audio node tracking ensures proper disposal
- Matches lifecycle patterns in existing LFO.ts and other components

**Alternatives Considered**:
- **Reactive State (RxJS)**: Over-engineering, adds dependency
- **State Machine Library**: Unnecessary for binary on/off state
- **Implicit Cleanup**: Prone to leaks, harder to debug

**Implementation Notes**:

```typescript
class ColliderPhysics {
  private animationId: number | null = null;
  private cvGenerator: CVGateGenerator | null = null;
  private isRunning: boolean = false;

  start(ctx: AudioContext): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.cvGenerator = new CVGateGenerator(ctx);

    const simulate = (timestamp: number) => {
      this.updatePhysics();
      this.checkCollisions();
      this.render();

      if (this.isRunning) {
        this.animationId = requestAnimationFrame(simulate);
      }
    };

    this.animationId = requestAnimationFrame(simulate);
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    // Cancel animation frame
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Cleanup audio
    if (this.cvGenerator) {
      this.cvGenerator.cleanup();
      this.cvGenerator = null;
    }
  }

  cleanup(): void {
    this.stop();
    // Additional cleanup if needed (canvas detach, event listeners)
  }
}
```

**Memory Leak Prevention**:
- Always cancel `requestAnimationFrame` before nulling ID
- Disconnect and stop all audio nodes
- Remove event listeners (if added)
- Clear circular references (especially with closures)

**Animation Loop Lifecycle**:
1. Start: Create audio nodes, initialize animation loop
2. Running: Loop calls itself via `requestAnimationFrame`
3. Stop: Set flag to break loop, cancel pending frame, cleanup audio
4. Cleanup: Final disposal (called on component destruction)

**Integration with Existing Patterns**:
- Matches `LFO.ts` bypass pattern (enableBypass/disableBypass)
- Compatible with `PatchSerializer.ts` (serialize running state)
- Follows `CanvasComponent.ts` rendering lifecycle

**Edge Cases**:
- Prevent double-start (check `isRunning` flag)
- Handle stop during frame processing (flag check in loop)
- Cleanup called multiple times (idempotent guards)

---

## Summary of Key Technologies

| Area | Technology | Rationale |
|------|-----------|-----------|
| Collision Detection | Brute-force O(n²) | N=20 is trivial, simplicity wins |
| Physics | Elastic collision (equal mass) | Physically accurate, deterministic |
| Scales | Semitone intervals + MIDI | Standard music theory, flexible |
| CV Standard | 1V/octave (Eurorack) | Universal modular synth standard |
| Rendering | requestAnimationFrame | Browser-native, 60fps sync |
| Audio Gates | ConstantSourceNode + AudioParam | Sample-accurate, click-free |
| Randomization | Linear scan weighted random | Simple, readable, fast enough |
| Lifecycle | Explicit start/stop/cleanup | Prevents leaks, matches codebase |

---

## References

- **Collision Detection**: Real-Time Collision Detection by Christer Ericson
- **Elastic Collisions**: https://en.wikipedia.org/wiki/Elastic_collision#Two-dimensional
- **MIDI Standard**: https://www.midi.org/specifications
- **Web Audio API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- **Canvas Optimization**: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- **1V/octave Standard**: https://www.perfectcircuit.com/signal/learning-modular
