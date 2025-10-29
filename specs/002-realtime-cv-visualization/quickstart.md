# Quickstart: Realtime CV Parameter Visualization

**Feature**: 002-realtime-cv-visualization
**Date**: 2025-10-29
**Estimated Implementation Time**: 8-12 hours

This guide provides a practical roadmap for implementing the realtime CV parameter visualization feature.

---

## Prerequisites

Before starting implementation, ensure:

- [x] TypeScript 5.6+ installed
- [x] Vite development environment working
- [x] Existing codebase runs without errors (`npm run dev`)
- [x] Browser supports SharedArrayBuffer (requires secure context/HTTPS or localhost)
- [x] Familiarity with Web Audio API and Canvas rendering

**Check SharedArrayBuffer Support**:
```typescript
if (typeof SharedArrayBuffer === 'undefined') {
  console.error('SharedArrayBuffer not supported - feature cannot be implemented');
}
```

---

## Implementation Phases

### Phase 1: Core Data Structures (2 hours)

**Goal**: Create type definitions and data models

**Tasks**:
1. Create `src/visualization/types.ts`
   - Define `ModulationState`, `VisualizationConfig`, `ParameterVisualization`, `CVConnectionState`
   - Define `IVisualizableControl`, `IModulationVisualizer` interfaces
   - Define `ModulationEventType` enum and event types

2. Extend existing `Parameter.ts`
   - Add `isModulated: boolean` property
   - Add `modulatedValue: number` property
   - Add `getModulatedValue(): number` method

3. Extend existing UI controls
   - Modify `Knob.ts` to implement `IVisualizableControl`
   - Modify `Slider.ts` to implement `IVisualizableControl`
   - Modify `Button.ts` to implement `IVisualizableControl`
   - Add `setVisualValue(normalized: number)` method to each
   - Add `isVisible: boolean` property to each

**Validation**:
- TypeScript compiles without errors
- Existing code still works with new properties/methods

---

### Phase 2: Parameter Value Sampling (3 hours)

**Goal**: Sample CV-modulated parameter values from audio thread

**Tasks**:
1. Create `src/visualization/ParameterValueSampler.ts`
   - Implement `IParameterValueSampler` interface
   - Initialize SharedArrayBuffer (128 bytes for 32 parameters)
   - Create AudioWorkletProcessor for sampling
   - Implement 20 Hz sampling timer in AudioWorklet

2. Create AudioWorklet file `public/worklets/parameter-sampler.js`
   ```javascript
   class ParameterSamplerProcessor extends AudioWorkletProcessor {
     constructor(options) {
       super();
       this.sharedBuffer = new Float32Array(options.processorOptions.sharedBuffer);
       this.sampleInterval = Math.floor(sampleRate / 20); // 20 Hz
       this.sampleCounter = 0;
       this.parameterMap = new Map(); // parameterId → bufferIndex
     }

     process(inputs, outputs, parameters) {
       this.sampleCounter++;
       if (this.sampleCounter >= this.sampleInterval) {
         this.sampleCounter = 0;
         // Sample all registered parameters
         for (const [paramId, bufferIndex] of this.parameterMap) {
           const value = parameters[paramId][0]; // Normalized 0-1
           Atomics.store(this.sharedBuffer, bufferIndex, value);
         }
       }
       return true; // Keep processor alive
     }
   }
   registerProcessor('parameter-sampler', ParameterSamplerProcessor);
   ```

3. Integrate with AudioContext in `src/core/AudioEngine.ts`
   - Load AudioWorklet module
   - Pass SharedArrayBuffer to worklet

**Validation**:
- SharedArrayBuffer values update at ~20 Hz
- Console log sampled values to verify correctness
- No audio glitches during sampling

---

### Phase 3: Visual Update Scheduler (2 hours)

**Goal**: Schedule UI updates at 60 FPS with interpolation

**Tasks**:
1. Create `src/visualization/VisualUpdateScheduler.ts`
   - Implement `IVisualUpdateScheduler` interface
   - Use `requestAnimationFrame` for update loop
   - Track frame delta times
   - Calculate and expose current FPS

2. Implement linear interpolation
   ```typescript
   class VisualUpdateScheduler {
     private interpolate(from: number, to: number, progress: number): number {
       return from + (to - from) * Math.min(progress, 1);
     }

     private updateLoop(timestamp: number): void {
       const deltaMs = timestamp - this.lastTimestamp;
       this.lastTimestamp = timestamp;

       // Call all registered frame callbacks
       for (const callback of this.callbacks) {
         callback(deltaMs);
       }

       // Continue loop
       this.rafId = requestAnimationFrame((t) => this.updateLoop(t));
     }
   }
   ```

**Validation**:
- requestAnimationFrame calls happen at ~60 FPS
- Frame delta times are consistent (~16.67ms)
- Interpolation produces smooth values between samples

---

### Phase 4: Modulation Visualizer Coordinator (3 hours)

**Goal**: Tie everything together and coordinate updates

**Tasks**:
1. Create `src/visualization/ModulationVisualizer.ts`
   - Implement `IModulationVisualizer` interface
   - Initialize ParameterValueSampler and VisualUpdateScheduler
   - Maintain Map of tracked parameters
   - Maintain Map of active CV connections

2. Implement parameter tracking
   ```typescript
   trackParameter(parameterId: string, control: IVisualizableControl): VisualizationHandle {
     // Register with sampler
     const bufferIndex = this.sampler.registerParameter(parameterId, audioParam);

     // Create visualization state
     const viz: ParameterVisualization = {
       controlId: control.getControlId(),
       parameterId,
       controlType: 'knob', // Detect from control instance
       isVisible: true,
       lastRenderedValue: control.getParameter().getNormalizedValue(),
       interpolationProgress: 0,
       targetValue: 0,
     };

     this.trackedControls.set(parameterId, { control, viz });

     return {
       parameterId,
       dispose: () => this.untrackParameter(parameterId),
     };
   }
   ```

3. Implement update loop
   ```typescript
   private onFrame(deltaMs: number): void {
     for (const [parameterId, { control, viz }] of this.trackedControls) {
       // Read latest value from sampler
       const sampledValue = this.sampler.getValue(parameterId);
       if (sampledValue === null) continue;

       // Update target value
       if (sampledValue !== viz.targetValue) {
         viz.lastRenderedValue = viz.targetValue;
         viz.targetValue = sampledValue;
         viz.interpolationProgress = 0;
       }

       // Interpolate
       viz.interpolationProgress += deltaMs / (1000 / this.config.samplingRate);
       const interpolated = this.interpolate(
         viz.lastRenderedValue,
         viz.targetValue,
         viz.interpolationProgress
       );

       // Update control if visible
       if (control.isVisible()) {
         control.setVisualValue(interpolated);
       }
     }
   }
   ```

4. Implement CV connection lifecycle
   ```typescript
   onConnectionCreated(connection: Connection): void {
     const state: CVConnectionState = {
       connectionId: connection.id,
       sourceComponentId: connection.sourceComponentId,
       targetParameterId: `${connection.targetComponentId}:${connection.targetPortId}`,
       state: 'connecting',
       fadeProgress: 0,
       modulationDepth: 1,
       createdAt: performance.now(),
       transitionStartTime: performance.now(),
     };

     this.connectionStates.set(connection.id, state);

     // Apply audio fade-in
     this.applyFadeTransition(state, 'in');
   }
   ```

**Validation**:
- Parameter controls update smoothly when CV modulation is active
- Interpolation creates smooth 60 FPS visuals from 20 Hz samples
- Multiple parameters update independently

---

### Phase 5: Connection Lifecycle & Fades (2 hours)

**Goal**: Smooth transitions for CV connection creation/destruction

**Tasks**:
1. Implement fade-in/fade-out
   ```typescript
   private applyFadeTransition(state: CVConnectionState, direction: 'in' | 'out'): void {
     const audioContext = this.audioEngine.getContext();
     const targetParam = this.getAudioParam(state.targetParameterId);

     const now = audioContext.currentTime;
     const duration = this.config.transitionDuration / 1000; // Convert ms to seconds

     if (direction === 'in') {
       targetParam.exponentialRampToValueAtTime(
         state.modulationDepth,
         now + duration
       );
     } else {
       targetParam.exponentialRampToValueAtTime(
         0,
         now + duration
       );
     }

     // Update visual fade in parallel
     this.animateFadeProgress(state, direction, duration * 1000);
   }
   ```

2. Implement fade progress tracking
   ```typescript
   private animateFadeProgress(state: CVConnectionState, direction: 'in' | 'out', durationMs: number): void {
     const startTime = performance.now();
     const startProgress = state.fadeProgress;
     const targetProgress = direction === 'in' ? 1 : 0;

     const updateProgress = () => {
       const elapsed = performance.now() - startTime;
       const progress = Math.min(elapsed / durationMs, 1);

       state.fadeProgress = startProgress + (targetProgress - startProgress) * progress;

       if (progress < 1) {
         requestAnimationFrame(updateProgress);
       } else {
         // Transition complete
         state.state = direction === 'in' ? 'connected' : 'disconnected';
         state.transitionStartTime = null;

         if (state.state === 'connected') {
           this.eventBus.emit(ModulationEventType.FADE_COMPLETED, {
             type: ModulationEventType.FADE_COMPLETED,
             connectionId: state.connectionId,
             direction,
             timestamp: performance.now(),
           });
         }
       }
     };

     updateProgress();
   }
   ```

**Validation**:
- CV connections fade in over exactly 100ms (±10ms)
- Disconnections fade out over 100ms
- No audio clicks or pops during transitions
- Visual controls smoothly reflect fade progress

---

### Phase 6: Visibility Optimization (1 hour)

**Goal**: Pause updates for off-screen controls

**Tasks**:
1. Implement IntersectionObserver in `Canvas.ts`
   ```typescript
   private setupVisibilityObserver(): void {
     const observer = new IntersectionObserver(
       (entries) => {
         for (const entry of entries) {
           const control = this.findControlByElement(entry.target);
           if (control && 'setVisibility' in control) {
             control.setVisibility(entry.isIntersecting);
           }
         }
       },
       {
         root: this.canvasElement,
         threshold: 0, // Trigger as soon as any pixel is visible
       }
     );

     // Observe all controls
     for (const control of this.controls) {
       if ('setVisibility' in control) {
         observer.observe(control.getElement());
       }
     }
   }
   ```

2. Update control rendering logic
   ```typescript
   // In Knob.ts, Slider.ts, Button.ts
   render(ctx: CanvasRenderingContext2D): void {
     if (!this.isVisible()) {
       return; // Skip rendering for off-screen controls
     }

     // ... existing render code ...
   }
   ```

**Validation**:
- Off-screen controls stop rendering
- Controls resume rendering when scrolled into view
- No performance issues with many off-screen controls

---

### Phase 7: Integration & Initialization (1 hour)

**Goal**: Wire everything together in main application

**Tasks**:
1. Initialize in `src/main.ts`
   ```typescript
   import { ModulationVisualizer } from './visualization/ModulationVisualizer';

   // After AudioEngine and Canvas are initialized
   const visualizer = new ModulationVisualizer(audioEngine, eventBus);
   await visualizer.initialize({
     samplingRate: 20,
     renderRate: 60,
     interpolationEnabled: true,
     offscreenPauseEnabled: true,
     transitionDuration: 100,
     maxTrackedParameters: 32,
   });

   visualizer.start();

   // Track all parameter controls
   for (const component of canvas.getComponents()) {
     for (const control of component.getControls()) {
       if ('getParameter' in control) {
         const param = control.getParameter();
         visualizer.trackParameter(
           `${component.id}:${param.id}`,
           control
         );
       }
     }
   }
   ```

2. Hook into connection events
   ```typescript
   // In ConnectionManager.ts
   createConnection(/*...*/): Connection {
     const connection = new Connection(/*...*/);
     this.connections.set(connection.id, connection);

     // Notify visualizer
     this.visualizer.onConnectionCreated(connection);

     return connection;
   }

   destroyConnection(connectionId: string): void {
     const connection = this.connections.get(connectionId);
     if (!connection) return;

     // Notify visualizer
     this.visualizer.onConnectionDestroyed(connectionId);

     this.connections.delete(connectionId);
   }
   ```

**Validation**:
- Application starts without errors
- All parameter controls automatically visualize modulation
- Creating/destroying CV connections works correctly

---

## Testing Checklist

### Manual Testing

- [ ] Create CV connection from LFO to oscillator detune → knob rotates at LFO rate
- [ ] Connect slow LFO (0.5 Hz) → smooth visual motion without stuttering
- [ ] Connect fast LFO (10 Hz) → rapid but smooth updates
- [ ] Connect 10 different CV sources to 10 parameters → all update smoothly
- [ ] Manually adjust parameter while modulated → modulation continues relative to new value
- [ ] Set CV modulation beyond parameter range → values clamped at min/max
- [ ] Scroll parameter control off-screen → rendering stops (check perf monitor)
- [ ] Scroll back on-screen → rendering resumes correctly
- [ ] Create CV connection → 100ms fade-in, no audio clicks
- [ ] Destroy CV connection → 100ms fade-out, no audio clicks

### Performance Testing

- [ ] Open browser DevTools Performance tab
- [ ] Run system with 10 modulated parameters for 30 seconds
- [ ] Verify no frame drops below 55 FPS
- [ ] Verify main thread usage < 10% per frame
- [ ] Check Memory tab for leaks (heap should stabilize after 1 minute)
- [ ] Verify audio thread usage remains low (< 5% CPU)

---

## Common Pitfalls & Solutions

### Pitfall 1: Audio Glitches During UI Updates

**Symptom**: Crackling or popping sounds when parameters update

**Solution**:
- Ensure SharedArrayBuffer reads happen on main thread, not audio thread
- Use Atomics.load() for thread-safe reads
- Never call canvas render() from audio context callbacks

### Pitfall 2: Choppy Visual Updates

**Symptom**: Parameters appear to jump instead of smooth motion

**Solution**:
- Enable interpolation in VisualizationConfig
- Verify requestAnimationFrame is being called at 60 FPS
- Check that interpolationProgress is calculated correctly

### Pitfall 3: Memory Leaks

**Symptom**: Memory usage grows over time

**Solution**:
- Always call `dispose()` on VisualizationHandle when untracking parameters
- Unsubscribe from all EventBus events in `dispose()` methods
- Clear IntersectionObserver when destroying controls

### Pitfall 4: SharedArrayBuffer Not Supported

**Symptom**: `SharedArrayBuffer is not defined` error

**Solution**:
- Requires secure context (HTTPS or localhost)
- Requires Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers
- Add to Vite config:
  ```typescript
  // vite.config.ts
  export default {
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
  };
  ```

---

## Next Steps After Implementation

1. **Run `/speckit.tasks`** to generate detailed task breakdown from this plan
2. **Create feature branch** if not already on `002-realtime-cv-visualization`
3. **Implement phases sequentially**, validating each before moving to next
4. **Test thoroughly** using manual testing checklist above
5. **Commit incrementally** after each completed phase
6. **Create pull request** when all phases complete and tests pass

---

## Reference Links

- [Feature Spec](./spec.md)
- [Data Model](./data-model.md)
- [API Contracts](./contracts/ModulationVisualizationAPI.md)
- [Research Findings](./research.md)
- [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MDN SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)
- [HTML5 Canvas Performance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
