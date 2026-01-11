# Audio Engine Architecture

This document explains the audio engine architecture of the Modular Web Synthesizer application.

## Overview

This modular synthesizer uses a **layered architecture** that cleanly separates Web Audio API management, audio processing logic, and visual representation. The design enables complex synthesizer patches to be built modularly while maintaining precise audio scheduling and real-time parameter control.

---

## Core Architecture

### AudioEngine - Central Web Audio API Hub

**Location:** `src/core/AudioEngine.ts`

The `AudioEngine` is a singleton class that serves as the central hub for all Web Audio API operations:

**Primary Responsibilities:**

1. **AudioContext Management**
   - Initializes and manages a single `AudioContext`
   - Handles `init()`, `resume()`, `suspend()`, and `close()` operations
   - Manages autoplay policy compliance (Chrome requires user interaction)

2. **Node Registry**
   - Maintains a `Map<string, ManagedAudioNode>` of all audio nodes
   - Tracks node lifecycle and connections
   - Provides centralized cleanup and resource management

3. **Connection Management**
   - Provides routing primitives: `connect()`, `disconnect()`, `connectToDestination()`
   - Tracks connections via a `Set<string>` per node
   - Ensures proper cleanup when nodes are removed

4. **Lifecycle Methods**
   - `clearAll()` - Resets all nodes (used during patch loading)
   - `getContext()` - Returns the active AudioContext
   - `getCurrentTime()` - Provides precise timing via `audioEngine.getContext().currentTime`
   - `getSampleRate()` - Reports sample rate for timing calculations

**Key Interface:**

```typescript
interface ManagedAudioNode {
  id: string;              // Unique identifier
  node: AudioNode;         // Web Audio API node
  type: string;            // Component type
  connections: Set<string>; // Connected node IDs
}
```

---

## Component Architecture

### Two-Tier Design

The architecture separates audio processing from visual representation:

#### 1. SynthComponent - Audio Processing Layer

**Location:** `src/components/base/SynthComponent.ts`

Abstract base class that all audio components extend:

**Required Methods:**

- `createAudioNodes()` - Instantiate and register Web Audio nodes with AudioEngine
- `destroyAudioNodes()` - Cleanup and disconnect all audio nodes
- `updateAudioParameter(parameterId, value)` - Real-time parameter updates
- `getInputNode(portId?)` - Returns the audio node for routing input signals
- `getOutputNode()` - Returns the audio node that outputs the processed signal

**Core Responsibilities:**

- Manage Web Audio API nodes (OscillatorNode, GainNode, BiquadFilterNode, etc.)
- Handle audio processing logic
- Maintain parameters with value constraints and ranges
- Register with AudioEngine for lifecycle management
- Provide port-based routing interface

#### 2. CanvasComponent - Visual Representation Layer

**Location:** `src/canvas/CanvasComponent.ts`

Manages the visual aspects of components:

**Responsibilities:**

- Render component UI on canvas (background, border, header, name)
- Manage UI controls (Knobs, Sliders, Buttons, Dropdowns)
- Handle mouse interactions (drag, click, hover)
- Manage embedded displays (Oscilloscope, Sequencer, Collider)
- Render connection ports for audio routing
- Provide visual feedback for component state (selected, bypassed)

**Linking Pattern:**

```typescript
canvasComponent.setSynthComponent(audioComponent)
// Creates bidirectional connection:
// User adjusts knob → CanvasComponent.handleControlMouseMove()
//   → synthComponent.setParameterValue()
//   → synthComponent.updateAudioParameter()
//   → Web Audio AudioParam.setValueAtTime()
```

---

## Port and Routing System

### Port Architecture

**Location:** `src/components/base/Port.ts`

```typescript
class Port {
  id: string;
  name: string;
  type: SignalType;        // AUDIO | CV | GATE
  isInput: boolean;
  connectedTo: string | null;
}
```

### Signal Types

**AUDIO**: Raw audio waveforms
- Frequency domain: 20Hz-20kHz
- Used for: Oscillator output, filter output, final mix

**CV (Control Voltage)**: Modulation signals
- Normalized range: typically -1 to 1, or 0-5V standard
- Used for: LFO output, envelope output, modulation sources
- Connected directly to AudioParam for parameter modulation

**GATE**: Trigger signals
- Binary on/off signals
- Used for: Envelope triggering, sequencer output
- Triggers discrete events rather than continuous modulation

### Multi-Level Routing

The routing system operates at three levels:

**Level 1 - Web Audio Graph:**
```typescript
// Direct AudioNode connections
sourceNode.connect(targetNode, outputIndex, inputIndex);
```

**Level 2 - Component Abstraction:**
```typescript
// High-level component connections
synthComponent.connectTo(target, outputId, inputId);
// Automatically routes to correct internal nodes
```

**Level 3 - Port System:**
```typescript
// Type-safe connections with signal type validation
port.type === 'cv'  // Ensures CV output connects to CV input
port.type === 'audio'  // Ensures audio routing compatibility
```

---

## Signal Flow Architecture

### Example Signal Chain

**Oscillator → Filter → VCA → Master Output**

```
Oscillator (Generator)
  └─ OscillatorNode (Web Audio API)
     └─ audio output → Filter input

Filter (Processor)
  ├─ InputGain (for bypass handling)
  ├─ BiquadFilterNode (cutoff/Q controllable via CV)
  └─ OutputGain
     └─ audio output → VCA input

VCA (Voltage Controlled Amplifier / Processor)
  ├─ InputGain
  ├─ GainNode (amplitude control with CV input)
  └─ OutputGain
     └─ audio output → Master input

Master Output (Terminal)
  ├─ InputGain (master volume control)
  ├─ DynamicsCompressor (optional limiter)
  └─ AudioContext.destination (system speakers)
```

### Common Component Pattern

Most processors use a **three-node bypass pattern** for clean signal routing:

```typescript
// Filter component example
this.inputGain = ctx.createGain();
this.filterNode = ctx.createBiquadFilter();
this.outputGain = ctx.createGain();

// Normal signal path: input → processing → output
this.inputGain.connect(this.filterNode);
this.filterNode.connect(this.outputGain);

// Bypass implementation: input → output (direct connection)
// Implemented via enableBypass()/disableBypass() methods
```

**Why Three Nodes?**

1. **InputGain**: Provides consistent input interface for routing
2. **ProcessingNode**: Performs the actual audio processing
3. **OutputGain**: Provides consistent output interface and enables bypass

This pattern allows components to be bypassed while maintaining signal flow through the patch.

---

## CV (Control Voltage) System

### Three-Part Architecture

#### Part 1 - Parameter Linking

Components link their parameters to Web Audio AudioParams:

```typescript
// In component.createAudioNodes():
const cutoffParam = this.getParameter('cutoff');
cutoffParam.linkAudioParam(this.filterNode.frequency);
// Parameter object now holds reference to Web Audio AudioParam
```

#### Part 2 - CV Signal Routing

CV outputs connect directly to AudioParams for modulation:

```typescript
// In SynthComponent.connectTo():
if (outputPort.type === 'cv') {
  const targetParam = target.getAudioParamForInput(inputId);
  if (targetParam) {
    outputNode.connect(targetParam);  // CV source → AudioParam
  }
}
```

#### Part 3 - Parameter Implementation

**Location:** `src/components/base/Parameter.ts`

```typescript
class Parameter {
  value: number;                    // Current value
  audioParam: AudioParam | null;    // Link to Web Audio API
  isModulated: boolean;             // Whether CV is connected
  baseValue: number;                // Original value before modulation
  modulatedValue: number;           // Current modulated value

  linkAudioParam(param: AudioParam) // Connect to Web Audio
  getAudioParam()                   // Access for CV connections
}
```

### Special Case - Gate Signals

Gate signals work differently from CV:

```typescript
// Gates trigger discrete events, not continuous modulation
if (outputPort.type === 'gate' && target.type === 'adsr-envelope') {
  const registerMethod = (this as any).registerGateTarget;
  registerMethod.call(this, target);
  // Component directly calls triggerGateOn()/triggerGateOff()
  // Does NOT use AudioParam
}
```

---

## Audio Scheduling and Timing

### Web Audio Precise Timing

The Web Audio API provides sample-accurate scheduling:

```typescript
const ctx = audioEngine.getContext();
const now = ctx.currentTime;

// Immediate parameter change
audioParam.setValueAtTime(value, now);

// Ramped change over time
audioParam.linearRampToValueAtTime(targetValue, now + duration);

// Exponential ramp (for frequency/filter sweeps)
audioParam.exponentialRampToValueAtTime(targetValue, now + duration);
```

### BPM-Based Timing

**Location:** `src/timing/TimingCalculator.ts`

```typescript
calculateGateDuration(bpm: number, gateSize: GateSize): number {
  const quarterNoteDurationMs = 60000 / bpm;
  return quarterNoteDurationMs * gateSize;
}
```

**Gate Size Values:**
- Whole note: 1.0
- Half note: 0.5
- Quarter note: 0.25
- Eighth note: 0.125
- Sixteenth note: 0.0625

### ADSR Envelope Scheduling

Example of precise Web Audio scheduling:

```typescript
// On gate trigger (note on)
const now = ctx.currentTime;
const currentValue = gainParam.value;

gainParam.cancelScheduledValues(now);
gainParam.setValueAtTime(currentValue, now);

// Attack phase
gainParam.linearRampToValueAtTime(1.0, now + attackTime);

// Decay phase
gainParam.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);

// On gate off (note off)
// Release phase starts from current value
gainParam.cancelScheduledValues(now);
gainParam.setValueAtTime(currentValue, now);
gainParam.linearRampToValueAtTime(0, now + releaseTime);
```

---

## Component Registration and Lifecycle

### ComponentRegistry

**Location:** `src/components/ComponentRegistry.ts`

Manages component type registration and factory pattern:

```typescript
class ComponentRegistry {
  register(type, name, description, category, factory, dimensions)
  create(type, id, position) // Factory method for creating instances
  getMetadata(type)          // Returns ComponentMetadata
  getByCategory(category)    // Query components by category
  getAllRegistrations()      // Get all registered types
}
```

### Lifecycle Flow

**1. Registration Phase (Application Startup):**
```typescript
// In main.ts or component definition files
componentRegistry.register(
  'oscillator',                    // type
  'Oscillator',                    // name
  'Audio waveform generator',      // description
  'generators',                    // category
  (id, pos) => new Oscillator(id, pos), // factory function
  { width: 200, height: 180 }      // dimensions
);
```

**2. Creation Phase (User Adds Component):**
```typescript
const component = componentRegistry.create(type, id, position);
// Factory function instantiates both SynthComponent and CanvasComponent
```

**3. Activation Phase:**
```typescript
component.activate();
// → Calls createAudioNodes()
// → Registers nodes with AudioEngine
// → Initializes parameters and ports
```

**4. Connection Phase:**
```typescript
sourceComponent.connectTo(targetComponent, outputId, inputId);
// → Validates port types
// → Connects Web Audio nodes
// → Updates port connection state
```

**5. Destruction Phase:**
```typescript
component.deactivate();
// → Calls destroyAudioNodes()
// → Disconnects all audio connections
// → Removes nodes from AudioEngine registry
// → Prevents memory leaks
```

---

## Component-Specific Patterns

### Generator Pattern

**Examples:** Oscillator, LFO, Noise

**Characteristics:**
- No audio input nodes
- Self-starting: `oscillatorNode.start()` called in `createAudioNodes()`
- Output node returns the generator directly
- CV inputs modulate frequency, detune, or amplitude
- Continuous signal generation

```typescript
createAudioNodes(): void {
  const ctx = audioEngine.getContext();
  this.oscillatorNode = ctx.createOscillator();
  this.oscillatorNode.type = 'sine';
  this.oscillatorNode.frequency.value = 440;
  this.oscillatorNode.start();  // Start immediately

  audioEngine.addNode(this.id, this.oscillatorNode, 'oscillator');
}

getOutputNode(): AudioNode {
  return this.oscillatorNode;  // Direct output
}
```

### Processor Pattern

**Examples:** Filter, VCA, Delay, Reverb

**Characteristics:**
- Input and output gain nodes for bypass handling
- Processing node in the middle
- CV inputs modulate processing parameters
- Clean signal routing with bypass support

```typescript
createAudioNodes(): void {
  const ctx = audioEngine.getContext();

  // Three-node chain
  this.inputGain = ctx.createGain();
  this.filterNode = ctx.createBiquadFilter();
  this.outputGain = ctx.createGain();

  // Connect chain
  this.inputGain.connect(this.filterNode);
  this.filterNode.connect(this.outputGain);

  // Register all nodes
  audioEngine.addNode(`${this.id}-input`, this.inputGain, 'gain');
  audioEngine.addNode(`${this.id}-filter`, this.filterNode, 'filter');
  audioEngine.addNode(`${this.id}-output`, this.outputGain, 'gain');

  // Link parameters to AudioParams for CV control
  const cutoffParam = this.getParameter('cutoff');
  cutoffParam.linkAudioParam(this.filterNode.frequency);
}

getInputNode(): AudioNode {
  return this.inputGain;
}

getOutputNode(): AudioNode {
  return this.outputGain;
}
```

### Analyzer Pattern

**Examples:** Oscilloscope, Spectrum Analyzer

**Characteristics:**
- Creates `AnalyserNode` for FFT/waveform data extraction
- Circular buffer for real-time visualization
- Audio passes through unchanged (analysis is non-destructive)
- Embedded canvas display updates via `requestAnimationFrame`

```typescript
createAudioNodes(): void {
  const ctx = audioEngine.getContext();

  this.analyserNode = ctx.createAnalyser();
  this.analyserNode.fftSize = 2048;
  this.analyserNode.smoothingTimeConstant = 0.8;

  this.dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

  audioEngine.addNode(this.id, this.analyserNode, 'analyser');

  // Start visualization loop
  this.startVisualization();
}

private startVisualization(): void {
  const visualize = () => {
    if (!this.isActive) return;

    this.analyserNode.getByteTimeDomainData(this.dataArray);
    this.renderWaveform(this.dataArray);

    requestAnimationFrame(visualize);
  };
  visualize();
}
```

### Utility Pattern

**Examples:** Collider, MIDI Input, Step Sequencer

**Characteristics:**
- May have no audio input (generative sources)
- Complex logic drives signal generation
- CV/Gate outputs for musical control
- Often includes visual feedback and user interaction

```typescript
// Collider example: Physics simulation drives note generation
createAudioNodes(): void {
  const ctx = audioEngine.getContext();

  // CV output for pitch
  this.cvOutput = ctx.createConstantSource();
  this.cvOutput.offset.value = 0;
  this.cvOutput.start();

  // Gate output for triggers
  this.gateOutput = ctx.createConstantSource();
  this.gateOutput.offset.value = 0;
  this.gateOutput.start();

  audioEngine.addNode(`${this.id}-cv`, this.cvOutput, 'cv');
  audioEngine.addNode(`${this.id}-gate`, this.gateOutput, 'gate');

  // Physics engine runs independently, updates CV/Gate values
}
```

---

## Key Architectural Benefits

### 1. Separation of Concerns

- **Audio logic** completely separate from **rendering logic**
- `SynthComponent` has no knowledge of canvas or UI
- `CanvasComponent` has no knowledge of Web Audio API
- Clean interfaces enable independent testing and development

### 2. Type Safety

- TypeScript interfaces for components, ports, parameters
- Compile-time checking for signal type compatibility
- Strong typing prevents common routing errors

### 3. Modular Design

- Components are self-contained and reusable
- Factory pattern enables dynamic component instantiation
- Component registry provides centralized type management

### 4. Precise Timing

- Web Audio API scheduling provides sample-accurate control
- `audioContext.currentTime` for synchronized parameter changes
- ADSR envelopes use scheduled value automation

### 5. CV Flexibility

- Any output can modulate any compatible parameter
- AudioParam connections enable direct hardware-style patching
- Real-time modulation with no performance overhead

### 6. Clean Lifecycle

- Proper node cleanup prevents memory leaks
- AudioEngine tracks all nodes and connections
- Systematic disconnect on component removal

### 7. Centralized Management

- Single AudioEngine instance manages Web Audio context
- Consistent API for all audio operations
- Easy debugging and monitoring of audio graph

---

## Advanced Features

### Bypass Implementation

Many components support runtime bypass while maintaining signal flow:

```typescript
enableBypass(): void {
  if (this.isBypassed) return;

  // Disconnect processing chain
  this.inputGain.disconnect();
  this.filterNode.disconnect();

  // Create direct bypass connection
  this.inputGain.connect(this.outputGain);

  this.isBypassed = true;
}

disableBypass(): void {
  if (!this.isBypassed) return;

  // Disconnect bypass
  this.inputGain.disconnect();

  // Restore processing chain
  this.inputGain.connect(this.filterNode);
  this.filterNode.connect(this.outputGain);

  this.isBypassed = false;
}
```

### Parameter Automation

Parameters support both manual control and CV modulation:

```typescript
setParameterValue(parameterId: string, value: number): void {
  const param = this.getParameter(parameterId);
  if (!param) return;

  param.value = value;

  // Update linked AudioParam with smooth transition
  if (param.audioParam) {
    const now = audioEngine.getCurrentTime();
    param.audioParam.setValueAtTime(value, now);
  }

  // Trigger any dependent updates
  this.updateAudioParameter(parameterId, value);
}
```

### Connection Validation

The system validates connections before establishing them:

```typescript
canConnect(source: Port, target: Port): boolean {
  // Can't connect input to input or output to output
  if (source.isInput === target.isInput) return false;

  // Signal types must be compatible
  if (source.type !== target.type) return false;

  // Target input must not already have a connection
  if (target.connectedTo !== null) return false;

  return true;
}
```

---

## Summary

This audio engine architecture provides:

- **Clean separation** between audio processing and visual representation
- **Type-safe routing** through the port and signal type system
- **Precise timing** via Web Audio API scheduling
- **Flexible modulation** through CV connections to AudioParams
- **Robust lifecycle management** preventing memory leaks
- **Modular design** enabling complex synthesizer patches
- **Sample-accurate** audio processing for professional results

The architecture successfully combines the power of the Web Audio API with a clean, maintainable component system that makes building complex modular synthesizer patches both possible and enjoyable.
