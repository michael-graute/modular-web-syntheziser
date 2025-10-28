# Modular Synthesizer - Implementation Plan

## Technology Stack (Minimal Libraries)

### Core Technologies
- **Build Tool**: Vite 6.x
- **Language**: TypeScript 5.x
- **Framework**: Vanilla TypeScript (no React/Vue framework)
- **Audio**: Web Audio API (native browser API)
- **Canvas**: HTML5 Canvas API (native)
- **Storage**: localStorage (native browser API)

### Minimal Dependencies
```json
{
  "dependencies": {},
  "devDependencies": {
    "vite": "^6.0.0",
    "typescript": "^5.6.0"
  }
}
```

### Rationale for No Additional Libraries
- **No UI Framework**: Vanilla TypeScript with web components for better performance and smaller bundle size
- **No Canvas Library**: Native Canvas API is sufficient for drawing components and connections
- **No State Management**: Simple class-based state management pattern
- **No Styling Library**: Pure CSS with CSS variables for theming
- **No UUID Library**: Use crypto.randomUUID() (native)
- **No Date Library**: Use native Date object
- **No Testing Library Initially**: Can add Vitest later if needed

## Project Structure

```
modular-synth/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── src/
│   ├── main.ts                      # Application entry point
│   ├── styles/
│   │   ├── main.css                 # Global styles
│   │   ├── variables.css            # CSS variables for theming
│   │   ├── components.css           # Component-specific styles
│   │   └── canvas.css               # Canvas area styles
│   ├── core/
│   │   ├── AudioEngine.ts           # Web Audio API management
│   │   ├── StateManager.ts          # Application state management
│   │   ├── EventBus.ts              # Custom event system
│   │   └── types.ts                 # TypeScript types and interfaces
│   ├── canvas/
│   │   ├── Canvas.ts                # Canvas rendering and interaction
│   │   ├── CanvasComponent.ts       # Visual representation of components
│   │   ├── Connection.ts            # Visual cable connections
│   │   ├── Viewport.ts              # Pan, zoom, transform management
│   │   └── SelectionManager.ts      # Component selection handling
│   ├── components/
│   │   ├── base/
│   │   │   ├── SynthComponent.ts    # Base class for all synth components
│   │   │   ├── AudioComponent.ts    # Audio processing base
│   │   │   └── Port.ts              # Input/Output port definitions
│   │   ├── generators/
│   │   │   ├── Oscillator.ts        # Oscillator component
│   │   │   ├── LFO.ts               # Low frequency oscillator
│   │   │   └── NoiseGenerator.ts    # Noise generator
│   │   ├── processors/
│   │   │   ├── Filter.ts            # Filter component
│   │   │   ├── VCA.ts               # Voltage controlled amplifier
│   │   │   ├── ADSREnvelope.ts      # ADSR envelope
│   │   │   └── FilterEnvelope.ts    # Filter envelope
│   │   ├── effects/
│   │   │   ├── Delay.ts             # Delay effect
│   │   │   ├── Reverb.ts            # Reverb effect (ConvolverNode)
│   │   │   ├── Distortion.ts        # Distortion effect
│   │   │   └── Chorus.ts            # Chorus effect
│   │   ├── utilities/
│   │   │   ├── Mixer.ts             # Audio mixer
│   │   │   └── MasterOutput.ts      # Master output
│   │   └── ComponentRegistry.ts     # Register and create components
│   ├── ui/
│   │   ├── TopBar.ts                # Top bar UI
│   │   ├── Sidebar.ts               # Component library sidebar
│   │   ├── Keyboard.ts              # On-screen keyboard
│   │   ├── Modal.ts                 # Generic modal component
│   │   ├── ContextMenu.ts           # Right-click context menu
│   │   └── Controls.ts              # Knobs, sliders, dropdowns
│   ├── patch/
│   │   ├── PatchManager.ts          # Save/load/export patches
│   │   ├── PatchSerializer.ts       # Serialize patch to JSON
│   │   └── PatchStorage.ts          # localStorage interface
│   ├── keyboard/
│   │   ├── KeyboardController.ts    # Keyboard input handling
│   │   ├── NoteMapper.ts            # QWERTY to MIDI note mapping
│   │   └── VoiceManager.ts          # Polyphony management
│   └── utils/
│       ├── geometry.ts              # Canvas geometry helpers
│       ├── audio-utils.ts           # Audio calculation helpers
│       ├── validators.ts            # Input validation
│       └── constants.ts             # Application constants
└── public/
    └── impulse-responses/           # IR files for reverb (optional)
```

## Architecture Overview

### Core Architecture Patterns

#### 1. Component System
```typescript
// Base component class
abstract class SynthComponent {
  id: string;
  type: string;
  position: {x: number, y: number};
  inputs: Port[];
  outputs: Port[];
  audioNode: AudioNode | null;
  parameters: Map<string, Parameter>;

  abstract createAudioNode(context: AudioContext): void;
  abstract connect(target: SynthComponent, outputIndex: number, inputIndex: number): void;
  abstract disconnect(): void;
  abstract serialize(): ComponentData;
}
```

#### 2. State Management
```typescript
class StateManager {
  private state: AppState;
  private listeners: Map<string, Function[]>;

  getState(): AppState;
  setState(updates: Partial<AppState>): void;
  subscribe(event: string, callback: Function): void;
  notify(event: string, data?: any): void;
}
```

#### 3. Audio Engine
```typescript
class AudioEngine {
  private context: AudioContext;
  private components: Map<string, SynthComponent>;
  private connections: Connection[];

  init(): void;
  addComponent(component: SynthComponent): void;
  removeComponent(id: string): void;
  connect(sourceId: string, targetId: string, ...): void;
  disconnect(connectionId: string): void;
  playNote(frequency: number, velocity: number): void;
  stopNote(frequency: number): void;
}
```

#### 4. Canvas System
```typescript
class Canvas {
  private ctx: CanvasRenderingContext2D;
  private viewport: Viewport;
  private components: CanvasComponent[];
  private connections: CanvasConnection[];

  render(): void;
  handleMouseDown(e: MouseEvent): void;
  handleMouseMove(e: MouseEvent): void;
  handleMouseUp(e: MouseEvent): void;
  addComponent(component: CanvasComponent): void;
  removeComponent(id: string): void;
}
```

### Data Flow

```
User Input (Mouse/Keyboard)
         ↓
    UI Controllers
         ↓
    StateManager (central state)
         ↓
    ┌────┴────┐
    ↓         ↓
Canvas     Audio Engine
System     (Web Audio API)
    ↓         ↓
Render     Sound Output
```

### Key Design Decisions

1. **No Virtual DOM**: Direct DOM manipulation with TypeScript classes
2. **Event-Driven**: Custom EventBus for component communication
3. **Separation of Concerns**:
   - Canvas layer: Visual representation only
   - Audio layer: Sound generation and processing only
   - State layer: Synchronization between visual and audio
4. **Lazy Initialization**: Create audio nodes only when needed
5. **Memory Management**: Explicit cleanup of audio nodes and event listeners

## Development Phases

### Phase 1: Project Setup & Core Foundation (Week 1)
**Goal**: Basic project structure with canvas and audio working

#### Tasks:
1. **Project Initialization**
   - Set up Vite project with TypeScript
   - Configure tsconfig.json with strict mode
   - Create folder structure
   - Set up CSS with variables for theming

2. **Core Systems**
   - Implement StateManager class
   - Implement EventBus for custom events
   - Define TypeScript interfaces and types
   - Create constants and utility functions

3. **Canvas System**
   - Implement Canvas class with rendering loop
   - Implement Viewport class (pan, zoom)
   - Basic mouse interaction (click, drag)
   - Grid rendering (optional)

4. **Audio Engine Foundation**
   - Implement AudioEngine class
   - Initialize AudioContext
   - Handle audio context state (suspended/running)
   - Create basic audio node management

5. **Basic UI Shell**
   - Create HTML structure
   - Implement TopBar UI
   - Implement Sidebar UI (empty component list)
   - Style with CSS

**Deliverable**: Application shell with working canvas and audio context

### Phase 2: First Working Synthesizer (Week 2)
**Goal**: Simple oscillator → VCA → output with keyboard control

#### Tasks:
1. **Component Base Classes**
   - Implement SynthComponent base class
   - Implement Port class (inputs/outputs)
   - Implement Parameter class
   - Create ComponentRegistry

2. **First Components**
   - Implement Oscillator component (sine wave only)
   - Implement VCA component
   - Implement MasterOutput component
   - Visual representation (CanvasComponent)

3. **Connection System**
   - Implement Connection class (data model)
   - Implement CanvasConnection (visual)
   - Connection validation logic
   - Wire audio nodes together

4. **On-Screen Keyboard**
   - Implement Keyboard UI component
   - Implement KeyboardController
   - Implement NoteMapper (QWERTY to MIDI)
   - Basic polyphony (VoiceManager)

5. **Component Library**
   - Implement drag-and-drop from sidebar
   - Add component to canvas on drop
   - Create visual component on canvas
   - Instantiate audio component

**Deliverable**: Working monophonic synth (Osc → VCA → Out) playable with keyboard

### Phase 3: Essential Synthesis Components (Week 3)
**Goal**: Complete basic subtractive synthesis chain

#### Tasks:
1. **Oscillator Enhancement**
   - Add all waveforms (square, saw, triangle)
   - Add frequency and detune controls
   - Create UI controls (dropdowns, sliders)
   - Implement CV inputs

2. **Filter Component**
   - Implement Filter with BiquadFilterNode
   - Add filter types (lowpass, highpass, bandpass)
   - Cutoff and resonance controls
   - CV inputs for modulation

3. **ADSR Envelope**
   - Implement ADSR with ramping
   - Gate input from keyboard
   - Envelope output to VCA
   - Visual parameter controls

4. **Component Controls**
   - Implement Knob control (rotary)
   - Implement Slider control
   - Implement Dropdown control
   - Parameter change handling

5. **Enhanced Canvas**
   - Component selection (single)
   - Component deletion (Delete key)
   - Connection deletion (click cable)
   - Better visual feedback

**Deliverable**: Full subtractive synth (Osc → Filter → VCA → Out) with envelope

6. **Oscilloscope Component (Analysis)**
   - Implement Oscilloscope with AnalyserNode
   - Pass-through audio routing (input → analyser → output)
   - Real-time waveform visualization (time-domain)
   - Real-time spectrum visualization (frequency-domain FFT)
   - Display modes: Waveform, Spectrum, Both
   - Parameters: timeScale, fftSize, displayMode, gain
   - Embedded canvas display for visualization
   - Animation loop with requestAnimationFrame (60fps)

**Enhanced Deliverable**: Full subtractive synth with real-time audio analysis capability

### Phase 4: Patch Management (Week 4)
**Goal**: Save and load synthesizer patches

#### Tasks:
1. **Serialization**
   - Implement PatchSerializer
   - Serialize components to JSON
   - Serialize connections to JSON
   - Serialize parameters to JSON

2. **Storage**
   - Implement PatchStorage with localStorage
   - Save patch with name
   - Load patch by name
   - List all saved patches
   - Delete patch

3. **Deserialization**
   - Parse JSON to component data
   - Recreate components from data
   - Recreate connections from data
   - Restore parameter values

4. **UI Integration**
   - Implement save modal
   - Implement load modal
   - Implement patch browser
   - Show current patch name
   - Export/import JSON files

5. **State Management**
   - Track unsaved changes
   - Warn before losing changes
   - New patch action
   - Save/Save As actions

**Deliverable**: Full patch save/load system with UI

### Phase 5: Modulation & LFO (Week 5)
**Goal**: Add modulation capabilities

#### Tasks:
1. **LFO Component**
   - Implement LFO with OscillatorNode
   - Multiple waveforms
   - Rate control (0.01Hz - 20Hz)
   - Depth control

2. **Filter Envelope**
   - Implement Filter Envelope
   - ADSR controls
   - Amount parameter
   - Route to filter cutoff

3. **CV Routing**
   - Connect LFO to oscillator frequency
   - Connect LFO to filter cutoff
   - Connect envelopes to parameters
   - Visual indication of modulation

4. **Noise Generator**
   - Implement white noise
   - Implement pink noise (with filtering)
   - Add to component library

5. **Enhanced Connection System**
   - Color-coded cables (audio/CV/gate)
   - Connection validation by type
   - Multiple connections from one output
   - Visual cable animation (optional)

**Deliverable**: Fully modular synth with CV routing

### Phase 6: Effects (Week 6)
**Goal**: Add audio effects processors

#### Tasks:
1. **Delay Effect**
   - Implement with DelayNode
   - Delay time, feedback, mix controls
   - Feedback loop management
   - Visual component

2. **Reverb Effect**
   - Implement with ConvolverNode
   - Create or load impulse response
   - Room size simulation (or IR selection)
   - Mix control

3. **Distortion Effect**
   - Implement with WaveShaperNode
   - Drive control (curve generation)
   - Tone control (filter)
   - Mix control

4. **Chorus Effect**
   - Implement with DelayNode + LFO
   - Rate and depth controls
   - Mix control

5. **Mixer Component**
   - Multiple input channels (2-8)
   - Per-channel gain
   - Single output
   - Visual level meters (optional)

**Deliverable**: Complete effects suite

### Phase 7: Polish & UX (Week 7)
**Goal**: Improve user experience and fix bugs

#### Tasks:
1. **Advanced Canvas Features**
   - Multi-select (Ctrl+Click)
   - Selection rectangle drag
   - Undo/redo system
   - Copy/paste components

2. **Context Menus**
   - Right-click on component
   - Duplicate, delete, reset
   - Rename component
   - Show/hide parameters

3. **Visual Improvements**
   - Better component styling
   - Smooth animations
   - Loading states
   - Error messages

4. **Keyboard Enhancements**
   - Octave shift display
   - Visual key press feedback
   - Velocity control
   - Sustain pedal (spacebar)

5. **Help & Onboarding**
   - Welcome modal
   - Tooltips on hover
   - Example patches
   - Keyboard shortcuts reference

**Deliverable**: Polished, production-ready application

### Phase 8: Testing & Optimization (Week 8)
**Goal**: Ensure quality and performance

#### Tasks:
1. **Performance Optimization**
   - Canvas rendering optimization
   - Audio node pooling
   - Connection lookup optimization
   - Memory leak detection

2. **Browser Testing**
   - Test in Chrome, Firefox, Safari
   - Fix browser-specific issues
   - Test on tablets
   - Responsive design adjustments

3. **Audio Quality Testing**
   - Test latency across browsers
   - Test with complex patches (20+ components)
   - Test polyphony (8 voices)
   - Fix audio dropouts

4. **Bug Fixes**
   - Fix connection issues
   - Fix state synchronization bugs
   - Fix save/load edge cases
   - Fix UI responsiveness

5. **Documentation**
   - Code documentation (JSDoc comments)
   - User manual
   - Architecture documentation
   - Deployment guide

**Deliverable**: Tested, optimized, documented application

## Implementation Guidelines

### Coding Standards
- Follow TypeScript strict mode
- Use ESLint for code quality
- Max function length: 50 lines
- Clear, descriptive variable names
- JSDoc comments for public methods
- Single responsibility per class

### Performance Targets
- 60fps canvas rendering
- < 10ms audio latency
- < 3s initial load time
- Support 20+ components
- < 500KB bundle size

### Testing Strategy
- Manual testing each phase
- Audio quality verification
- Cross-browser testing
- Performance profiling
- User testing for UX feedback

### Git Workflow
- Main branch: stable releases
- Develop branch: integration
- Feature branches: phase-* or feature-*
- Commit messages: type(scope): description
- Tag releases: v1.0.0, v1.1.0, etc.

## Next Steps

1. **Review this plan** - Ensure alignment with requirements
2. **Set up development environment** - Install Node.js, code editor
3. **Initialize project** - Run Vite scaffolding
4. **Begin Phase 1** - Create project structure and core systems

## Risk Mitigation

### Technical Risks
- **Web Audio API compatibility**: Test early across browsers
- **Canvas performance**: Optimize rendering, use requestAnimationFrame
- **Audio latency**: Use AudioContext.baseLatency, minimize node chains
- **State synchronization**: Thorough testing of audio-visual sync

### Project Risks
- **Scope creep**: Stick to phases, defer enhancements
- **Complexity**: Start simple, add complexity gradually
- **Time estimates**: Buffer for debugging and polish
- **Browser bugs**: Have fallback implementations ready

## Success Criteria

- ✅ All Phase 1-7 deliverables completed
- ✅ Audio latency < 10ms measured
- ✅ 60fps canvas performance maintained
- ✅ Save/load works 100% reliably
- ✅ Cross-browser compatibility verified
- ✅ Basic patches creatable in < 5 minutes
- ✅ Code follows constitution principles
- ✅ Zero console errors in production
