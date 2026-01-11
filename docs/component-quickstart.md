# Component Quickstart Guide

This guide will walk you through creating a new component for the Modular Web Synthesizer. We'll build a simple **Tremolo** effect as an example.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Component Architecture Overview](#component-architecture-overview)
3. [Step-by-Step: Creating a Tremolo Effect](#step-by-step-creating-a-tremolo-effect)
4. [Testing Your Component](#testing-your-component)
5. [Advanced Features](#advanced-features)
6. [Common Patterns](#common-patterns)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before creating a component, make sure you understand:

- **TypeScript** - The codebase uses TypeScript 5.6+
- **Web Audio API** - Basic understanding of AudioNodes and AudioParams
- **Canvas API** - For rendering (handled by CanvasComponent)
- Read the [Audio Engine Architecture](./audio-engine-architecture.md) document

---

## Component Architecture Overview

Components in this synthesizer have a **two-tier architecture**:

### 1. SynthComponent (Audio Processing)
- Extends `SynthComponent` base class
- Manages Web Audio API nodes
- Handles audio processing logic
- Located in: `src/components/[category]/[ComponentName].ts`

### 2. CanvasComponent (Visual Representation)
- Automatically created by the Canvas system
- Manages UI controls (knobs, sliders, buttons)
- Renders component on canvas
- Automatically linked to SynthComponent

**You only need to create the SynthComponent** - the visual layer is handled automatically based on your ports and parameters!

---

## Step-by-Step: Creating a Tremolo Effect

A tremolo effect modulates the amplitude (volume) of an audio signal to create a rhythmic, pulsing sound.

### Step 1: Add Component Type

**File:** `src/core/types.ts`

Add your component type to the `ComponentType` enum:

```typescript
export enum ComponentType {
  // ... existing types ...
  CHORUS = 'chorus',
  TREMOLO = 'tremolo',  // Add this line
  MIXER = 'mixer',
  // ... rest of types ...
}
```

### Step 2: Create the Component Class

**File:** `src/components/effects/Tremolo.ts`

```typescript
/**
 * Tremolo - Amplitude modulation effect
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

/**
 * Tremolo effect component
 * Creates rhythmic amplitude modulation using an LFO
 */
export class Tremolo extends SynthComponent {
  // Audio nodes (private properties)
  private inputGain: GainNode | null;
  private outputGain: GainNode | null;
  private modulationGain: GainNode | null;
  private lfo: OscillatorNode | null;
  private depth: GainNode | null;

  constructor(id: string, position: Position) {
    // Call parent constructor with id, type, display name, and position
    super(id, ComponentType.TREMOLO, 'Tremolo', position);

    // Define input/output ports
    this.addInput('input', 'Audio In', SignalType.AUDIO);
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);

    // Define parameters (id, name, defaultValue, min, max, step, unit)
    this.addParameter('rate', 'Rate', 5, 0.1, 20, 0.1, 'Hz');
    this.addParameter('depth', 'Depth', 0.5, 0, 1, 0.01, '');

    // Initialize audio nodes as null
    this.inputGain = null;
    this.outputGain = null;
    this.modulationGain = null;
    this.lfo = null;
    this.depth = null;
  }

  /**
   * Create and connect Web Audio nodes
   * Called when component is activated
   */
  createAudioNodes(): void {
    // Always check if AudioEngine is ready
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const ctx = audioEngine.getContext();

    // Create input/output gain nodes
    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1.0;

    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1.0;

    // Create modulation gain node (the one being modulated)
    this.modulationGain = ctx.createGain();
    this.modulationGain.gain.value = 1.0;

    // Create LFO (Low Frequency Oscillator)
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine'; // Smooth modulation
    const rate = this.getParameter('rate')?.getValue() || 5;
    this.lfo.frequency.value = rate;

    // Create depth control (scales LFO output)
    this.depth = ctx.createGain();
    const depthValue = this.getParameter('depth')?.getValue() || 0.5;
    this.depth.gain.value = depthValue;

    // Start the LFO
    this.lfo.start();

    // Connect audio graph:
    // Signal path: input -> modulationGain -> output
    this.inputGain.connect(this.modulationGain);
    this.modulationGain.connect(this.outputGain);

    // Modulation path: lfo -> depth -> modulationGain.gain
    // This makes the LFO modulate the gain
    this.lfo.connect(this.depth);
    this.depth.connect(this.modulationGain.gain);

    // Register all nodes with AudioEngine for lifecycle management
    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('outputGain', this.outputGain);
    this.registerAudioNode('modulationGain', this.modulationGain);
    this.registerAudioNode('lfo', this.lfo);
    this.registerAudioNode('depth', this.depth);

    console.log(`Tremolo ${this.id} created with rate: ${rate} Hz`);
  }

  /**
   * Cleanup and disconnect audio nodes
   * Called when component is removed
   */
  destroyAudioNodes(): void {
    // Stop oscillators before disconnecting
    if (this.lfo) {
      try {
        this.lfo.stop();
      } catch (error) {
        // LFO might already be stopped
      }
      this.lfo.disconnect();
      this.lfo = null;
    }

    // Disconnect all other nodes
    if (this.depth) {
      this.depth.disconnect();
      this.depth = null;
    }

    if (this.modulationGain) {
      this.modulationGain.disconnect();
      this.modulationGain = null;
    }

    if (this.inputGain) {
      this.inputGain.disconnect();
      this.inputGain = null;
    }

    if (this.outputGain) {
      this.outputGain.disconnect();
      this.outputGain = null;
    }

    console.log(`Tremolo ${this.id} destroyed`);
  }

  /**
   * Update audio parameters in real-time
   * Called when user adjusts controls
   */
  updateAudioParameter(parameterId: string, value: number): void {
    if (!this.lfo || !this.depth) {
      return;
    }

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    switch (parameterId) {
      case 'rate':
        // Update LFO frequency
        this.lfo.frequency.setValueAtTime(value, now);
        break;
      case 'depth':
        // Update modulation depth
        this.depth.gain.setValueAtTime(value, now);
        break;
    }
  }

  /**
   * Get input node for audio routing
   */
  getInputNode(): AudioNode | null {
    return this.inputGain;
  }

  /**
   * Get output node for audio routing
   */
  getOutputNode(): AudioNode | null {
    return this.outputGain;
  }

  /**
   * Enable bypass - connect input directly to output
   */
  protected override enableBypass(): void {
    if (!this.inputGain || !this.outputGain) {
      return;
    }

    // Disconnect processing chain
    this.inputGain.disconnect();
    this.modulationGain?.disconnect();

    // Connect input directly to output
    this.inputGain.connect(this.outputGain);

    console.log(`Tremolo ${this.id} bypassed`);
  }

  /**
   * Disable bypass - restore processing chain
   */
  protected override disableBypass(): void {
    if (!this.inputGain || !this.outputGain || !this.modulationGain) {
      return;
    }

    // Disconnect bypass
    this.inputGain.disconnect();

    // Restore normal routing
    this.inputGain.connect(this.modulationGain);
    this.modulationGain.connect(this.outputGain);

    console.log(`Tremolo ${this.id} restored`);
  }
}
```

### Step 3: Register the Component

**File:** `src/components/registerComponents.ts`

First, import your component at the top:

```typescript
import { Tremolo } from './effects/Tremolo';
```

Then, add the registration call in the `registerAllComponents()` function:

```typescript
export function registerAllComponents(): void {
  // ... existing registrations ...

  // Effects
  componentRegistry.register(
    ComponentType.TREMOLO,
    'Tremolo',
    'Amplitude modulation effect',
    'Effects',
    (id, position) => new Tremolo(id, position),
    calculateComponentDimensions(ComponentType.TREMOLO)
  );

  // ... rest of registrations ...
}
```

### Step 4: Configure Component Dimensions

**File:** `src/utils/componentLayout.ts`

Add a case for your component in the `calculateComponentDimensions()` function:

```typescript
export function calculateComponentDimensions(type: ComponentType): Dimensions {
  switch (type) {
    // ... existing cases ...

    case ComponentType.TREMOLO:
      return {
        width: 200,
        height: 160,  // Adjust based on number of controls
      };

    // ... rest of cases ...
  }
}
```

**Dimension Guidelines:**
- **Width**: Usually 180-220px
- **Height**: Base height (120px) + (number of controls × 40px)
- Example: 2 parameters = 120 + (2 × 40) = 200px height

---

## Testing Your Component

### 1. Build and Run

```bash
npm run build
npm run dev
```

### 2. Verify Registration

Open the browser console and look for:
```
✅ Registered 16 components  # Number should increase by 1
```

### 3. Find in Sidebar

Your component should appear in the "Effects" section of the sidebar with:
- Icon (automatically assigned)
- Name: "Tremolo"
- Description: "Amplitude modulation effect"

### 4. Test Functionality

1. **Drag component** from sidebar to canvas
2. **Connect audio signal**: Oscillator → Tremolo → Master Output
3. **Adjust parameters**: Turn knobs to hear the effect
4. **Test bypass**: Right-click component to toggle bypass
5. **Save/Load**: Create patch, save, reload to test serialization

---

## Advanced Features

### Adding CV Inputs

To make parameters modulatable via Control Voltage:

```typescript
constructor(id: string, position: Position) {
  super(id, ComponentType.TREMOLO, 'Tremolo', position);

  this.addInput('input', 'Audio In', SignalType.AUDIO);

  // Add CV inputs for modulation
  this.addInput('rateCV', 'Rate CV', SignalType.CV);
  this.addInput('depthCV', 'Depth CV', SignalType.CV);

  this.addOutput('output', 'Audio Out', SignalType.AUDIO);

  // Parameters remain the same
  this.addParameter('rate', 'Rate', 5, 0.1, 20, 0.1, 'Hz');
  this.addParameter('depth', 'Depth', 0.5, 0, 1, 0.01, '');
}

createAudioNodes(): void {
  // ... node creation ...

  // Link AudioParams to parameters for CV modulation
  const rateParam = this.getParameter('rate');
  if (rateParam) {
    rateParam.linkAudioParam(this.lfo.frequency);
  }

  const depthParam = this.getParameter('depth');
  if (depthParam) {
    depthParam.linkAudioParam(this.depth.gain);
  }

  // ... rest of setup ...
}

// Override to expose AudioParams for CV routing
protected override getAudioParamForInput(inputId: string): AudioParam | null {
  switch (inputId) {
    case 'rateCV':
      return this.lfo ? this.lfo.frequency : null;
    case 'depthCV':
      return this.depth ? this.depth.gain : null;
    default:
      return null;
  }
}
```

### Adding Dropdown Controls

For parameters with discrete choices (waveform types, modes, etc.):

```typescript
// In constructor
this.addParameter('waveform', 'Waveform', 0, 0, 3, 1, '');
// 0=sine, 1=square, 2=sawtooth, 3=triangle

// Define waveform types
const WAVEFORM_TYPES: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];

// In updateAudioParameter
case 'waveform':
  const waveformIndex = Math.round(value);
  this.lfo.type = WAVEFORM_TYPES[waveformIndex] || 'sine';
  break;
```

The CanvasComponent will automatically create a dropdown for parameters with step size ≥ 1.

### Adding Visual Displays

For components that need custom visualization (like oscilloscopes or sequencers):

```typescript
import { IEmbeddedDisplay } from '../../canvas/displays/types';

export class MyDisplay implements IEmbeddedDisplay {
  render(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    // Custom rendering code
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x, y, width, height);

    // Draw your visualization
  }

  update(data: any): void {
    // Update display data
  }

  handleClick(x: number, y: number): void {
    // Handle user clicks
  }
}

// In your SynthComponent:
export class MyComponent extends SynthComponent {
  getEmbeddedDisplay(): IEmbeddedDisplay | null {
    return new MyDisplay();
  }
}
```

---

## Common Patterns

### Generator Pattern

For components that generate audio (Oscillators, Noise, LFOs):

```typescript
export class MyGenerator extends SynthComponent {
  private oscillator: OscillatorNode | null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.MY_GENERATOR, 'My Generator', position);

    // Generators typically have NO audio input
    // Only outputs and CV inputs
    this.addOutput('output', 'Audio Out', SignalType.AUDIO);
    this.addInput('frequency', 'Freq CV', SignalType.CV);
  }

  createAudioNodes(): void {
    const ctx = audioEngine.getContext();
    this.oscillator = ctx.createOscillator();
    this.oscillator.start();  // Start immediately!

    this.registerAudioNode('oscillator', this.oscillator);
  }

  destroyAudioNodes(): void {
    if (this.oscillator) {
      this.oscillator.stop();  // Stop before disconnect
      this.oscillator.disconnect();
      this.oscillator = null;
    }
  }

  getInputNode(): AudioNode | null {
    return null;  // Generators don't have audio input
  }

  getOutputNode(): AudioNode | null {
    return this.oscillator;
  }
}
```

### Processor Pattern (Three-Node Chain)

For processors that modify audio (Filters, VCAs, Effects):

```typescript
export class MyProcessor extends SynthComponent {
  private inputGain: GainNode | null;
  private processingNode: BiquadFilterNode | null;  // Or any AudioNode
  private outputGain: GainNode | null;

  createAudioNodes(): void {
    const ctx = audioEngine.getContext();

    // Three-node pattern
    this.inputGain = ctx.createGain();
    this.processingNode = ctx.createBiquadFilter();
    this.outputGain = ctx.createGain();

    // Chain: input -> processing -> output
    this.inputGain.connect(this.processingNode);
    this.processingNode.connect(this.outputGain);

    this.registerAudioNode('inputGain', this.inputGain);
    this.registerAudioNode('processingNode', this.processingNode);
    this.registerAudioNode('outputGain', this.outputGain);
  }

  getInputNode(): AudioNode | null {
    return this.inputGain;
  }

  getOutputNode(): AudioNode | null {
    return this.outputGain;
  }
}
```

**Why Three Nodes?**
1. Consistent routing interface
2. Easy bypass implementation
3. Clean signal flow

### Analyzer Pattern

For components that visualize audio (Oscilloscope, Spectrum):

```typescript
export class MyAnalyzer extends SynthComponent {
  private analyserNode: AnalyserNode | null;
  private dataArray: Uint8Array | null;

  createAudioNodes(): void {
    const ctx = audioEngine.getContext();

    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;

    this.dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    this.registerAudioNode('analyser', this.analyserNode);

    // Start visualization loop
    this.startVisualization();
  }

  private startVisualization(): void {
    const visualize = () => {
      if (!this.analyserNode) return;

      this.analyserNode.getByteTimeDomainData(this.dataArray!);
      // Process data...

      requestAnimationFrame(visualize);
    };
    visualize();
  }

  getInputNode(): AudioNode | null {
    return this.analyserNode;  // Signal passes through
  }

  getOutputNode(): AudioNode | null {
    return this.analyserNode;  // Signal unchanged
  }
}
```

### Utility Pattern (Generative/Control)

For components that generate CV/Gate signals (Sequencers, MIDI Input):

```typescript
export class MyUtility extends SynthComponent {
  private cvOutput: ConstantSourceNode | null;
  private gateOutput: ConstantSourceNode | null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.MY_UTILITY, 'My Utility', position);

    // No audio inputs - generates control signals
    this.addOutput('cv', 'CV Out', SignalType.CV);
    this.addOutput('gate', 'Gate Out', SignalType.GATE);
  }

  createAudioNodes(): void {
    const ctx = audioEngine.getContext();

    // Use ConstantSourceNode for CV signals
    this.cvOutput = ctx.createConstantSource();
    this.cvOutput.offset.value = 0;
    this.cvOutput.start();

    this.gateOutput = ctx.createConstantSource();
    this.gateOutput.offset.value = 0;
    this.gateOutput.start();

    this.registerAudioNode('cvOutput', this.cvOutput);
    this.registerAudioNode('gateOutput', this.gateOutput);
  }

  // Update CV values dynamically
  private updateCV(pitchValue: number): void {
    if (!this.cvOutput) return;

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    this.cvOutput.offset.setValueAtTime(pitchValue, now);
  }

  // Trigger gate on/off
  private triggerGate(on: boolean): void {
    if (!this.gateOutput) return;

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    this.gateOutput.offset.setValueAtTime(on ? 5.0 : 0.0, now);
  }
}
```

---

## Troubleshooting

### Component Doesn't Appear in Sidebar

**Check:**
1. Did you add the ComponentType to `types.ts`?
2. Did you import the component in `registerComponents.ts`?
3. Did you call `componentRegistry.register()` with correct category?
4. Check browser console for registration errors

### No Sound Output

**Check:**
1. Is `createAudioNodes()` being called? Add `console.log()`
2. Are nodes connected properly? Trace the signal chain
3. Is `getInputNode()` / `getOutputNode()` returning correct nodes?
4. Are oscillators started with `.start()`?
5. Check browser console for Web Audio errors

### Parameters Don't Update

**Check:**
1. Is `updateAudioParameter()` being called? Add `console.log()`
2. Are you using `setValueAtTime()` for parameter changes?
3. Are parameter IDs spelled correctly (case-sensitive)?
4. Are nodes initialized before trying to update them?

### Component Crashes When Removed

**Check:**
1. Is `destroyAudioNodes()` disconnecting all nodes?
2. Are oscillators stopped before disconnect?
3. Are you setting node references to `null`?
4. Check for feedback loops that need special disconnect order

### Bypass Not Working

**Check:**
1. Did you override `enableBypass()` and `disableBypass()`?
2. Are you disconnecting the processing chain?
3. Are you reconnecting input directly to output?
4. Make sure inputGain and outputGain are not null

### Memory Leaks

**Common causes:**
1. Not disconnecting nodes in `destroyAudioNodes()`
2. Not stopping oscillators before disconnect
3. Not clearing intervals/timeouts
4. Not unsubscribing from event listeners

**Solution:**
```typescript
destroyAudioNodes(): void {
  // Stop oscillators first
  if (this.oscillator) {
    this.oscillator.stop();
  }

  // Clear intervals
  if (this.intervalId) {
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  // Disconnect all nodes
  if (this.node) {
    this.node.disconnect();
    this.node = null;
  }
}
```

---

## Best Practices

### 1. Always Check AudioEngine Status

```typescript
createAudioNodes(): void {
  if (!audioEngine.isReady()) {
    throw new Error('AudioEngine not initialized');
  }
  // ... rest of code
}
```

### 2. Use Scheduled Parameter Changes

```typescript
// Good - scheduled change
const now = audioEngine.getContext().currentTime;
this.gainNode.gain.setValueAtTime(value, now);

// Bad - direct assignment (can cause clicks)
this.gainNode.gain.value = value;
```

### 3. Clamp Dangerous Values

```typescript
// Prevent runaway feedback
const safeFeedback = Math.min(value, 0.95);
this.feedbackGain.gain.setValueAtTime(safeFeedback, now);

// Prevent negative frequencies
const safeFreq = Math.max(value, 0.1);
this.oscillator.frequency.setValueAtTime(safeFreq, now);
```

### 4. Use Descriptive Console Logs

```typescript
console.log(`Tremolo ${this.id} created with rate: ${rate} Hz, depth: ${depth}`);
console.log(`Tremolo ${this.id} destroyed`);
```

### 5. Document Complex Audio Routing

```typescript
// Connect routing:
// Dry path: input -> dryGain -> output
this.inputGain.connect(this.dryGain);
this.dryGain.connect(this.outputGain);

// Wet path with feedback: input -> delay -> feedbackGain -> delay (loop)
//                                      ↓
//                                   wetGain -> output
this.inputGain.connect(this.delayNode);
this.delayNode.connect(this.feedbackGain);
this.feedbackGain.connect(this.delayNode); // Feedback loop
```

### 6. Handle Edge Cases

```typescript
updateAudioParameter(parameterId: string, value: number): void {
  // Check if nodes exist
  if (!this.processingNode) {
    return;
  }

  // Validate parameter ID
  switch (parameterId) {
    case 'frequency':
      // Handle the update
      break;
    default:
      console.warn(`Unknown parameter: ${parameterId}`);
  }
}
```

---

## Next Steps

1. **Study existing components** in `src/components/` for real-world examples
2. **Read the architecture docs**:
   - [Audio Engine Architecture](./audio-engine-architecture.md)
   - [HTML Rendering Architecture](./html-rendering-architecture.md)
3. **Experiment** with different Web Audio nodes and effects
4. **Test thoroughly** - create patches, save/load, test bypass
5. **Share your components** with the community!

---

## Component Checklist

Before submitting your component:

- [ ] Added ComponentType to `src/core/types.ts`
- [ ] Created component class extending SynthComponent
- [ ] Implemented `createAudioNodes()`
- [ ] Implemented `destroyAudioNodes()`
- [ ] Implemented `updateAudioParameter()`
- [ ] Implemented `getInputNode()` and `getOutputNode()`
- [ ] Registered component in `src/components/registerComponents.ts`
- [ ] Added dimensions in `src/utils/componentLayout.ts`
- [ ] Tested component in browser
- [ ] Tested save/load functionality
- [ ] Tested bypass functionality
- [ ] Verified no console errors
- [ ] Verified no memory leaks
- [ ] Added JSDoc comments

---

## Resources

- [Web Audio API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Web Audio API Specification](https://www.w3.org/TR/webaudio/)
- [Audio Engine Architecture](./audio-engine-architecture.md)
- [HTML Rendering Architecture](./html-rendering-architecture.md)

Happy coding! 🎵
