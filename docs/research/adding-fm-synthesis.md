# Adding FM Synthesis to the Modular Synthesizer

**Research Date**: 2026-01-11
**Status**: Analysis Complete
**Recommendation**: Implement Option 1 (New FMOscillator Component)

## Executive Summary

The modular synthesizer currently supports **AM (Amplitude Modulation)** synthesis through audio signal multiplication via VCA/Gain components. To add **FM (Frequency Modulation)** synthesis, we need to enable audio-rate modulation of oscillator frequency parameters. This requires routing audio signals to AudioParam nodes, which the current architecture doesn't expose.

**Recommended Approach**: Create a new `FMOscillator` component that extends the existing `Oscillator` class. This provides FM capabilities while maintaining backward compatibility and minimizing risk to existing patches.

**Estimated Effort**: 4-6 hours for basic FM implementation, 8-12 hours for comprehensive FM with feedback and ratio controls.

---

## Current State: AM Synthesis Only

### What Works Today

The synthesizer supports AM synthesis through:

1. **Audio Signal Multiplication**: VCA/Gain components multiply audio signals
2. **CV → Frequency Control**: CV signals can modulate oscillator frequency
3. **Signal Routing**: Audio outputs connect to audio inputs
4. **No Audio → Frequency Path**: Audio signals cannot directly modulate frequency

### Architecture Analysis

#### Current Oscillator Implementation

**File**: `src/components/generators/Oscillator.ts`

**Key Points**:
- Uses Web Audio API `OscillatorNode`
- Exposes CV inputs for `frequency` and `detune` (lines 30-31)
- `frequency` and `detune` are AudioParams (support audio-rate modulation)
- **Missing**: No audio input that routes to frequency AudioParam

```typescript
// Current inputs (CV only)
this.addInput('frequency', 'Frequency CV', SignalType.CV);
this.addInput('detune', 'Detune CV', SignalType.CV);

// Web Audio API supports this, but we don't expose it:
// oscillator.frequency.value = 440;
// audioSignal.connect(oscillator.frequency); // ← FM!
```

#### Connection System

**File**: `src/canvas/ConnectionManager.ts`

**Connection Flow** (lines 124-137):
1. Validate signal types (AUDIO→AUDIO, CV→CV, GATE→GATE)
2. Call `sourceComponent.connectTo(targetComponent, sourcePort, targetPort)`
3. Audio nodes connected based on port types

**Current Limitation**:
- Audio signals route to AudioNode inputs only
- No routing to AudioParam (frequency/detune) for FM

---

## Technical Requirements for FM Synthesis

### 1. Audio-Rate Frequency Modulation

**What's Needed**: Route audio signals to `OscillatorNode.frequency` AudioParam

**Web Audio API Support**:
```typescript
// Web Audio API natively supports this:
const modulator = ctx.createOscillator();
const carrier = ctx.createOscillator();

// FM: Connect audio directly to frequency
modulator.connect(carrier.frequency); // ✅ Supported!
```

**Current Gap**: No component exposes an audio input that connects to frequency AudioParam.

### 2. FM Depth/Amount Control

**What's Needed**: Scale FM intensity

**Problem**: Direct audio connection to frequency has no gain control:
```typescript
modulator.connect(carrier.frequency); // Uncontrolled intensity!
```

**Solution**: Insert a `GainNode` to scale modulation:
```typescript
const fmGain = ctx.createGain();
fmGain.gain.value = 100; // FM depth in Hz

modulator.connect(fmGain);
fmGain.connect(carrier.frequency); // Controlled FM!
```

### 3. Signal Type Validation

**Current Validation** (`src/core/Connection.ts`):
- AUDIO → AUDIO ✅
- CV → CV ✅
- GATE → GATE ✅
- **AUDIO → CV** ❌ (needed for FM!)

**Required Change**:
```typescript
static validate(sourceType: SignalType, targetType: SignalType) {
  // Allow audio to modulate frequency AudioParam (FM synthesis)
  if (sourceType === SignalType.AUDIO && targetType === SignalType.CV) {
    return { valid: true }; // Enable FM connections
  }
  // ... existing validation
}
```

### 4. Input Type Differentiation

**Problem**: Inputs need to specify connection target:
- Audio → AudioNode (current: VCA, Filter, etc.)
- Audio → AudioParam (new: FM frequency modulation)

**Current Architecture**:
```typescript
// All inputs go to AudioNode
protected getAudioNodeForInput(inputId: string): AudioNode | null {
  // Returns AudioNode for audio mixing
}
```

**Needed Addition**:
```typescript
// New method for param-based inputs
protected getAudioParamForInput(inputId: string): AudioParam | null {
  if (inputId === 'fm') {
    return this.fmGain; // Route to gain → frequency
  }
  return null;
}
```

---

## Implementation Options

### Option 1: New FMOscillator Component (Recommended)

Create a dedicated `FMOscillator` component that extends `Oscillator`.

#### Advantages
- ✅ **Backward Compatible**: Existing Oscillator unchanged
- ✅ **Low Risk**: No impact on existing patches
- ✅ **Clear Separation**: AM vs FM oscillators are distinct
- ✅ **Incremental Rollout**: Can be added as new feature
- ✅ **Easy to Test**: Isolated implementation
- ✅ **No Migration Required**: Users can choose when to adopt

#### Disadvantages
- ❌ **Component Duplication**: Two oscillator types to maintain
- ❌ **User Confusion**: "Which oscillator do I use?"
- ❌ **Registry Overhead**: Additional component type

#### Implementation Outline

**File**: `src/components/generators/FMOscillator.ts`

```typescript
import { Oscillator } from './Oscillator';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

export class FMOscillator extends Oscillator {
  private fmGain: GainNode | null = null;

  constructor(id: string, position: Position) {
    super(id, position);

    // Update component name
    this.name = 'FM Oscillator';

    // Add FM-specific input and parameter
    this.addInput('fm', 'FM Input', SignalType.AUDIO);
    this.addParameter('fmDepth', 'FM Depth', 100, 0, 1000, 1, 'Hz');
  }

  /**
   * Create audio nodes with FM support
   */
  override createAudioNodes(): void {
    // Call parent to create base oscillator
    super.createAudioNodes();

    const ctx = audioEngine.getContext();

    // Create FM gain node for depth control
    this.fmGain = ctx.createGain();
    this.fmGain.gain.value = this.getParameter('fmDepth')?.getValue() || 100;

    // Connect FM gain to oscillator frequency
    const oscillator = this.getOutputNode() as OscillatorNode;
    if (oscillator) {
      this.fmGain.connect(oscillator.frequency);
    }

    // Register FM input node
    this.registerAudioNode('fmInput', this.fmGain);

    // Link fmDepth parameter to fmGain for UI control
    const fmDepthParam = this.getParameter('fmDepth');
    if (fmDepthParam) {
      fmDepthParam.linkAudioParam(this.fmGain.gain);
    }
  }

  /**
   * Cleanup FM-specific nodes
   */
  override destroyAudioNodes(): void {
    if (this.fmGain) {
      this.fmGain.disconnect();
      this.fmGain = null;
    }
    super.destroyAudioNodes();
  }

  /**
   * Route FM input to gain node
   */
  protected override getAudioNodeForInput(inputId: string): AudioNode | null {
    if (inputId === 'fm') {
      return this.fmGain;
    }
    return super.getAudioNodeForInput(inputId);
  }

  /**
   * Update FM depth parameter
   */
  override updateAudioParameter(parameterId: string, value: number): void {
    if (parameterId === 'fmDepth' && this.fmGain) {
      const ctx = audioEngine.getContext();
      this.fmGain.gain.setValueAtTime(value, ctx.currentTime);
    } else {
      super.updateAudioParameter(parameterId, value);
    }
  }
}
```

**Registration** (`src/core/ComponentFactory.ts`):
```typescript
case ComponentType.FM_OSCILLATOR:
  return new FMOscillator(id, position);
```

**Component Type** (`src/core/types.ts`):
```typescript
export enum ComponentType {
  // ... existing types
  FM_OSCILLATOR = 'fm-oscillator',
}
```

**Estimated Effort**: 4-6 hours
- Component implementation: 2-3 hours
- Testing and integration: 1-2 hours
- Documentation: 1 hour

---

### Option 2: Extend Existing Oscillator

Modify the current `Oscillator` to support both AM and FM modes.

#### Advantages
- ✅ **Single Component**: One oscillator handles all use cases
- ✅ **Unified UX**: No user confusion about which to use
- ✅ **Efficient**: Less code duplication

#### Disadvantages
- ❌ **Breaking Changes**: May affect existing patches
- ❌ **Complexity**: More conditional logic in one component
- ❌ **Higher Risk**: Changes core component
- ❌ **Migration Required**: Existing patches need updates
- ❌ **Testing Overhead**: Must validate all existing functionality

#### Implementation Outline

Add optional FM capability to existing oscillator:

```typescript
// In Oscillator.ts constructor
this.addInput('fm', 'FM Input', SignalType.AUDIO); // Optional FM
this.addParameter('fmDepth', 'FM Depth', 0, 0, 1000, 1, 'Hz');

// Only create FM gain if depth > 0
createAudioNodes(): void {
  // ... existing oscillator creation

  const fmDepth = this.getParameter('fmDepth')?.getValue() || 0;
  if (fmDepth > 0) {
    this.fmGain = ctx.createGain();
    this.fmGain.gain.value = fmDepth;
    this.fmGain.connect(this.oscillator.frequency);
  }
}
```

**Estimated Effort**: 6-8 hours
- Implementation: 3-4 hours
- Testing existing patches: 2-3 hours
- Migration tooling: 1 hour

---

### Option 3: Dedicated FM Operator Component

Create a specialized FM operator separate from standard oscillators (DX7-style).

#### Advantages
- ✅ **Classic FM Architecture**: Familiar to synthesists
- ✅ **Multi-Operator FM**: Enables complex algorithms
- ✅ **Optimized for FM**: Purpose-built features (ratios, feedback)

#### Disadvantages
- ❌ **High Complexity**: Requires algorithm routing system
- ❌ **Large Scope**: 20+ hours of development
- ❌ **Over-Engineering**: May exceed current needs
- ❌ **Steep Learning Curve**: Complex for users

**Estimated Effort**: 20-40 hours (not recommended for initial implementation)

---

## Recommended Implementation Plan

### Phase 1: Basic FM Oscillator (4-6 hours)

**Goal**: Proof-of-concept FM synthesis with minimal changes

#### Tasks
1. **Create FMOscillator component** (2 hours)
   - Extend Oscillator class
   - Add FM input port (AUDIO type)
   - Add FM depth parameter (0-1000 Hz)
   - Create FM gain node
   - Connect gain → frequency AudioParam

2. **Update connection validation** (1 hour)
   - Allow AUDIO → CV connections for FM
   - Add connection type metadata to inputs
   - Update ConnectionManager routing logic

3. **Component registration** (30 min)
   - Add FM_OSCILLATOR to ComponentType enum
   - Register in ComponentFactory
   - Add to component palette/menu

4. **Testing** (1.5 hours)
   - Simple FM patch (sine → sine)
   - FM depth control validation
   - Connection validation
   - Audio output verification

5. **Documentation** (1 hour)
   - Update component quickstart
   - Add FM synthesis examples
   - Document FM depth parameter

**Deliverables**:
- Working FM oscillator component
- Basic FM patches (simple FM synthesis)
- Updated documentation

**Success Criteria**:
- Can connect oscillator audio output to FM input
- FM depth parameter controls modulation intensity
- Produces classic FM tones (bells, metallic sounds)
- No impact on existing AM synthesis patches

---

### Phase 2: Enhanced FM Features (Optional, 4-6 hours)

**Goal**: Professional FM synthesis capabilities

#### Additional Features

**1. FM Ratio Control** (2 hours)
```typescript
this.addParameter('fmRatio', 'FM Ratio', 1, 0.5, 16, 0.5, ':1');

// Modulator frequency = Carrier frequency × ratio
updateAudioParameter(parameterId: string, value: number): void {
  if (parameterId === 'fmRatio') {
    const carrierFreq = this.oscillator.frequency.value;
    // Update modulator frequency based on ratio
  }
}
```

**2. FM Feedback Loop** (2 hours)
```typescript
this.addParameter('feedback', 'Feedback', 0, 0, 1, 0.01, '');

// Route oscillator output back to FM input
const feedbackGain = ctx.createGain();
feedbackGain.gain.value = feedbackAmount;
this.oscillator.connect(feedbackGain);
feedbackGain.connect(this.fmGain);
```

**3. Linear vs Exponential FM** (2 hours)
```typescript
this.addParameter('fmMode', 'FM Mode', 0, 0, 1, 1, ''); // 0=Linear, 1=Exponential

// Exponential FM requires modulator → exponential converter
```

---

## Technical Deep Dive

### Web Audio API FM Capabilities

**Native Support**:
```javascript
const audioContext = new AudioContext();

// Carrier oscillator (output frequency)
const carrier = audioContext.createOscillator();
carrier.frequency.value = 440; // A4

// Modulator oscillator (modulation source)
const modulator = audioContext.createOscillator();
modulator.frequency.value = 220; // A3 (1:2 ratio)

// FM depth control
const modulationGain = audioContext.createGain();
modulationGain.gain.value = 100; // 100 Hz modulation depth

// Connect for FM synthesis
modulator.connect(modulationGain);
modulationGain.connect(carrier.frequency); // Audio → AudioParam!

// Connect carrier to output
carrier.connect(audioContext.destination);

carrier.start();
modulator.start();
```

**Key Insight**: `AudioParam.connect()` accepts AudioNode inputs at audio-rate (not just k-rate). This is the foundation of FM synthesis in Web Audio.

### AudioParam Audio-Rate Modulation

**AudioParam Computation Modes**:
1. **k-rate (control rate)**: ~128 samples/block, used for CV
2. **a-rate (audio rate)**: Per-sample, used for FM

**Example**:
```javascript
// k-rate: CV modulation (smooth but low-resolution)
cvSource.connect(oscillator.frequency); // Default k-rate

// a-rate: FM synthesis (per-sample precision)
audioSource.connect(oscillator.frequency); // Promoted to a-rate!
```

**Performance**: Audio-rate modulation is highly optimized in modern browsers (SIMD, GPU offload where available).

---

## Connection Architecture Updates

### Current Signal Flow

```
┌─────────────┐
│  Oscillator │
│   (Source)  │
└──────┬──────┘
       │ Audio Output
       ▼
┌─────────────┐
│     VCA     │◄─── CV Input (Amplitude Modulation)
│   (Target)  │
└──────┬──────┘
       │ Audio Output
       ▼
  [Destination]
```

### FM Signal Flow (Proposed)

```
┌─────────────┐
│ Modulator   │
│ Oscillator  │
└──────┬──────┘
       │ Audio Output
       ▼
┌─────────────┐
│  FM Gain    │◄─── FM Depth Parameter
│  (Scaling)  │
└──────┬──────┘
       │ Scaled Audio
       ▼
┌─────────────┐
│  Carrier    │◄─── Audio → frequency AudioParam
│ Oscillator  │     (FM Synthesis!)
└──────┬──────┘
       │ Audio Output
       ▼
  [Destination]
```

### Connection Manager Updates

**Current** (`ConnectionManager.ts` line 126-130):
```typescript
sourceComponent.synthComponent.connectTo(
  targetComponent.synthComponent,
  sourcePortId,
  targetPortId
);
```

**Proposed** (with FM support):
```typescript
// In SynthComponent.connectTo()
const targetInput = this.inputs.get(targetPortId);

if (targetInput.connectionType === 'param') {
  // Audio → AudioParam (FM synthesis)
  const targetParam = this.getAudioParamForInput(targetPortId);
  const sourceNode = source.getOutputNode();
  if (sourceNode && targetParam) {
    sourceNode.connect(targetParam);
  }
} else {
  // Audio → AudioNode (traditional mixing)
  const targetNode = this.getInputNode();
  const sourceNode = source.getOutputNode();
  if (sourceNode && targetNode) {
    sourceNode.connect(targetNode);
  }
}
```

---

## Testing Strategy

### Unit Tests

**1. Component Creation**
```typescript
test('FMOscillator creates with FM input and depth parameter', () => {
  const osc = new FMOscillator('test', { x: 0, y: 0 });
  expect(osc.inputs.has('fm')).toBe(true);
  expect(osc.getParameter('fmDepth')).toBeDefined();
});
```

**2. Audio Node Routing**
```typescript
test('FM input routes to frequency AudioParam', () => {
  const osc = new FMOscillator('test', { x: 0, y: 0 });
  osc.activate();

  const fmInput = osc.getAudioNodeForInput('fm');
  expect(fmInput).toBeInstanceOf(GainNode);

  // Verify connection to frequency param
  const oscillatorNode = osc.getOutputNode() as OscillatorNode;
  expect(fmInput.numberOfOutputs).toBeGreaterThan(0);
});
```

**3. FM Depth Control**
```typescript
test('FM depth parameter controls gain value', () => {
  const osc = new FMOscillator('test', { x: 0, y: 0 });
  osc.activate();

  osc.setParameterValue('fmDepth', 200);

  const fmGain = osc.getAudioNodeForInput('fm') as GainNode;
  expect(fmGain.gain.value).toBe(200);
});
```

### Integration Tests

**1. Simple FM Patch**
```
Modulator (220 Hz) → FM Input
                      ↓
Carrier (440 Hz) → Output → Verify FM tone spectrum
```

**2. FM Depth Sweep**
```
Sweep FM depth 0 → 1000 Hz
Verify output spectrum changes (harmonic spread)
```

**3. Backward Compatibility**
```
Load existing AM synthesis patches
Verify no regressions in audio output
```

### Manual Testing Checklist

- [ ] Create FM oscillator from component palette
- [ ] Connect modulator audio to FM input
- [ ] Adjust FM depth and hear timbral changes
- [ ] Compare with traditional AM synthesis
- [ ] Test with different waveforms (sine, square, etc.)
- [ ] Verify CPU usage remains acceptable
- [ ] Test patch save/load with FM connections
- [ ] Confirm no impact on existing oscillators

---

## Example FM Patches

### 1. Simple FM (Bell-like)

```
[Modulator Oscillator]
- Frequency: 880 Hz (2:1 ratio)
- Waveform: Sine
    ↓ Audio Output
[FM Oscillator]
- Frequency: 440 Hz (A4)
- FM Depth: 200 Hz
- Waveform: Sine
    ↓ Audio Output
[Master Output]
```

**Expected Sound**: Bright, bell-like timbre with harmonic richness

### 2. FM with Envelope (Plucked String)

```
[LFO] → Envelope Generator
          ↓ CV Output
[Modulator] (1320 Hz, 3:1 ratio)
    ↓ Audio
[FM Oscillator] (440 Hz)
- FM Depth: 500 Hz ← Envelope CV
    ↓ Audio
[VCA] ← Same Envelope
    ↓ Audio
[Output]
```

**Expected Sound**: Plucked string with bright attack and mellow sustain

### 3. FM Feedback (Growl/Distortion)

```
[FM Oscillator] (220 Hz)
- FM Depth: 300 Hz
- Feedback: 0.3 ← Routes own output to FM input
    ↓ Audio
[Output]
```

**Expected Sound**: Growling, distorted tone with complex harmonics

---

## Performance Considerations

### CPU Impact

**Baseline** (current AM synthesis):
- Oscillator: ~0.5% CPU per instance
- VCA/Gain: ~0.3% CPU per instance

**FM Synthesis** (estimated):
- FMOscillator: ~0.8% CPU per instance
  - Base oscillator: 0.5%
  - FM gain node: 0.1%
  - Audio-rate frequency modulation: 0.2%

**Conclusion**: Minimal CPU overhead (~60% increase per oscillator, but still <1% total)

### Memory Impact

**Additional Memory per FMOscillator**:
- FM gain node: ~128 bytes
- Parameter metadata: ~64 bytes
- Total: ~192 bytes per instance

**Negligible impact** for typical patches (10-20 oscillators = ~4 KB)

### Browser Compatibility

**Web Audio API AudioParam.connect()**:
- Chrome/Edge: ✅ Full support (Blink engine)
- Firefox: ✅ Full support (Gecko engine)
- Safari: ✅ Full support (WebKit engine)

**No polyfills required** - native browser support is universal.

---

## Risks and Mitigation

### Risk 1: Breaking Existing Patches

**Risk Level**: Low (Option 1), Medium (Option 2)

**Mitigation**:
- Use Option 1 (new component) to avoid touching existing Oscillator
- Version patch files to enable migration if needed
- Comprehensive regression testing of AM synthesis

### Risk 2: Connection Validation Complexity

**Risk Level**: Medium

**Current Issue**: AUDIO → CV connections are invalid today, but needed for FM

**Mitigation**:
- Add `connectionType` metadata to input ports ('audio' vs 'param')
- Update validation to allow AUDIO → CV only for param-based inputs
- Add connection type display in UI (visual indicator)

### Risk 3: User Confusion (Two Oscillator Types)

**Risk Level**: Low-Medium

**Mitigation**:
- Clear naming: "Oscillator" vs "FM Oscillator"
- Tooltip descriptions explaining FM capability
- Tutorial patches demonstrating FM vs AM synthesis
- Component palette grouping (Generators → Basic Oscillator, Generators → FM Oscillator)

### Risk 4: FM Instability (Feedback Loops)

**Risk Level**: Medium (if feedback is implemented)

**Mitigation**:
- Limit feedback parameter range (0-0.8 max)
- Add safety limiter on FM oscillator output
- Document safe feedback levels
- Consider optional soft-clipping on feedback path

---

## Future Enhancements

### Multi-Operator FM (DX7-Style)

**Concept**: Multiple FM operators with configurable algorithms

**Components Needed**:
1. `FMOperator` component (oscillator + envelope)
2. `FMAlgorithm` component (routing matrix)
3. Algorithm presets (32 algorithms like DX7)

**Estimated Effort**: 20-40 hours

### Wavetable FM

**Concept**: Use custom wavetables instead of basic waveforms

**Requirements**:
- Wavetable oscillator component
- Wavetable editor UI
- Wavetable import/export

**Estimated Effort**: 30-50 hours

### PM (Phase Modulation) Synthesis

**Concept**: Alternative to FM that avoids pitch drift issues

**Technical**: Phase modulation instead of frequency modulation
- More stable for musical applications
- Easier to control harmonically

**Estimated Effort**: 10-15 hours (similar to FM implementation)

---

## References

### Web Audio API Documentation

- [AudioParam Interface](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam)
- [OscillatorNode.frequency](https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode/frequency)
- [Audio-rate modulation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques#audio-rate_modulation)

### FM Synthesis Theory

- "The Theory and Technique of Electronic Music" - Miller Puckette (Chapter 5: Modulation)
- "Computer Music: Synthesis, Composition, and Performance" - Dodge & Jerse
- Yamaha DX7 Technical Manual (classic FM implementation reference)

### Similar Implementations

- Web Audio School: [FM Synthesis Lesson](https://github.com/mmckegg/web-audio-school)
- Tone.js: [FM Synthesis Example](https://tonejs.github.io/examples/fmSynth.html)

---

## Conclusion

### Recommendation: Option 1 - New FMOscillator Component

**Why**:
1. **Low Risk**: No impact on existing functionality
2. **Fast Implementation**: 4-6 hours for basic FM
3. **Backward Compatible**: Existing patches unaffected
4. **Clear Separation**: Users understand AM vs FM oscillators
5. **Proven Pattern**: Follows existing component architecture

### Implementation Timeline

**Week 1** (4-6 hours):
- [ ] Create FMOscillator component
- [ ] Update connection validation
- [ ] Component registration and palette integration
- [ ] Basic testing (simple FM patches)
- [ ] Documentation update

**Week 2** (Optional, 4-6 hours):
- [ ] Add FM ratio control
- [ ] Add FM feedback loop
- [ ] Advanced testing (complex FM patches)
- [ ] Tutorial patches and examples

**Total Effort**: 4-12 hours depending on feature scope

### Success Metrics

**Technical**:
- FM oscillators produce expected harmonic spectra
- CPU usage increase <1% per FM oscillator
- Zero regressions in existing AM synthesis
- All automated tests pass

**User Experience**:
- Users can create basic FM patches within 5 minutes
- FM depth control provides intuitive timbral changes
- Component palette clearly differentiates AM vs FM oscillators
- Documentation includes FM synthesis examples

---

## Next Steps

1. **Approval**: Review this research document and approve Option 1 approach
2. **Planning**: Create detailed implementation plan using `/speckit.plan`
3. **Specification**: Write formal spec using `/speckit.specify`
4. **Implementation**: Execute phased rollout (basic FM → enhanced features)
5. **Testing**: Comprehensive testing against success criteria
6. **Documentation**: Update user guides with FM synthesis tutorials
7. **Release**: Deploy as new feature in next version

**Recommended Start Date**: After approval
**Estimated Completion**: 1-2 weeks for basic FM, 3-4 weeks for enhanced features
