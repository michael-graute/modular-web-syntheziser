# Modular Synthesizer - Task List

> Auto-generated from implementation-plan.md
> This is a flat, actionable task list for development tracking

## Phase 1: Project Setup & Core Foundation

### Project Initialization
- [x] Set up Vite project with TypeScript
- [x] Configure tsconfig.json with strict mode
- [x] Create folder structure (src/, styles/, core/, canvas/, components/, ui/, patch/, keyboard/, utils/)
- [x] Set up CSS with variables for theming
- [x] Create package.json with vite and typescript as dev dependencies
- [x] Create index.html with basic structure
- [x] Configure Vite config for development

### Core Systems
- [x] Define TypeScript interfaces and types in core/types.ts
- [x] Implement EventBus class for custom events
- [x] Implement StateManager class for application state
- [x] Create constants file (utils/constants.ts)
- [x] Create utility functions (geometry, audio-utils, validators)

### Canvas System
- [x] Implement Canvas class with rendering loop
- [x] Implement Viewport class for pan and zoom transforms
- [x] Add basic mouse interaction (click, drag)
- [x] Add mousedown, mousemove, mouseup event handlers
- [x] Implement requestAnimationFrame render loop
- [x] Add optional grid rendering
- [x] Components should snap to canvas grid when dragged

### Audio Engine Foundation
- [x] Implement AudioEngine class
- [x] Initialize AudioContext
- [x] Handle audio context state (suspended/running/closed)
- [x] Create basic audio node management (add/remove/connect)
- [x] Implement getUserMedia audio permission flow
- [x] Add audio node cleanup on disconnect

### Basic UI Shell
- [x] Create HTML structure (top bar, sidebar, canvas, keyboard sections)
- [x] Implement TopBar UI component
- [x] Implement Sidebar UI component (empty component list)
- [x] Create main.css with layout styles
- [x] Create variables.css with CSS custom properties
- [x] Create components.css for component styling
- [x] Create canvas.css for canvas area styling
- [x] Wire up main.ts entry point

## Phase 2: First Working Synthesizer

### Component Base Classes
- [x] Implement SynthComponent base class
- [x] Implement Port class for inputs/outputs
- [x] Implement Parameter class for component parameters
- [x] Create ComponentRegistry for registering component types
- [x] Add component factory method to registry

### First Components
- [x] Implement Oscillator component (sine wave only initially)
- [x] Create OscillatorNode in Web Audio API
- [x] Implement VCA component with GainNode
- [x] Implement MasterOutput component connecting to destination
- [x] Implement CanvasComponent base class for visual representation
- [x] Create visual rendering for oscillator
- [x] Create visual rendering for VCA
- [x] Create visual rendering for master output

### Connection System
- [x] Implement Connection class (data model)
- [x] Implement CanvasConnection class (visual rendering)
- [x] Add connection validation logic (type checking)
- [x] Implement audio node wiring (connect Web Audio nodes)
- [x] Add click-to-connect interaction (click output, click input)
- [x] Implement connection deletion
- [x] Render bezier curves for cable connections

### On-Screen Keyboard
- [x] Implement Keyboard UI component (2-octave piano keyboard)
- [x] Implement KeyboardController for input handling
- [x] Implement NoteMapper (QWERTY to MIDI note conversion)
- [x] Add octave shift functionality (Z/X keys)
- [x] Implement VoiceManager for basic polyphony
- [x] Add visual key press feedback
- [x] Wire keyboard to audio engine note triggers

### Component Library
- [x] Implement drag-and-drop from sidebar
- [x] Add dragstart, drag, drop event handlers
- [x] Add component to canvas on drop
- [x] Create visual component on canvas at drop position
- [x] Instantiate audio component when dropped
- [x] Register oscillator, VCA, and master output in sidebar

## Phase 3: Essential Synthesis Components

### Oscillator Enhancement
- [x] Add all waveforms (sine, square, sawtooth, triangle)
- [x] Add frequency control parameter
- [x] Add detune control parameter
- [x] Create UI dropdown for waveform selection
- [x] Create UI knob for frequency
- [x] Create UI knob for detune
- [x] Implement CV inputs (frequency CV, detune CV)

### Filter Component
- [x] Implement Filter component with BiquadFilterNode
- [x] Add filter type selector (lowpass, highpass, bandpass, notch)
- [x] Add cutoff frequency parameter (20Hz - 20kHz)
- [x] Add resonance/Q parameter (0 - 20)
- [x] Create UI dropdown for filter type
- [x] Create UI knob for cutoff frequency
- [x] Create UI knob for resonance
- [x] Implement CV inputs (cutoff CV, resonance CV)

### ADSR Envelope
- [x] Implement ADSREnvelope component
- [x] Add attack parameter (0ms - 5s)
- [x] Add decay parameter (0ms - 5s)
- [x] Add sustain parameter (0 - 100%)
- [x] Add release parameter (0ms - 5s)
- [x] Implement gate input from keyboard
- [x] Implement envelope output using GainNode ramping
- [x] Create visual parameter controls (4 sliders)
- [x] Wire envelope output to VCA gain (via modular patching)

### Keyboard Component (Modular Patching Support)
- [x] Create Keyboard component class
- [x] Add frequency CV output (MIDI note to frequency)
- [x] Add gate output (note on/off)
- [x] Add velocity CV output (note velocity)
- [x] Implement note-on trigger handling
- [x] Implement note-off trigger handling
- [x] Track active notes per Keyboard component
- [x] Modify KeyboardController to trigger all Keyboard components on canvas
- [x] Remove hardwired VCA modulation from main.ts
- [x] Update note trigger system to be fully modular
- [x] Register Keyboard component in ComponentRegistry

### CV/Gate Connection System
- [x] Implement port-specific connection routing
- [x] Add getAudioParamForInput to components (Oscillator, Filter, VCA)
- [x] Add getOutputNodeByPort to components (Keyboard, ADSR)
- [x] Update ConnectionManager to pass port IDs
- [x] Differentiate Audio vs CV/Gate connections in connectTo
- [x] Fix Keyboard → Oscillator frequency CV connection
- [x] Implement gate→ADSR trigger system
- [x] Add connectedGateTargets tracking to KeyboardInput
- [x] Add registerGateTarget/unregisterGateTarget methods
- [x] Connect gate signals to ADSR triggerGateOn/Off methods

**Note on CV Behavior**:
In Web Audio API, CV signals ADD to the parameter's base value. When connecting Keyboard frequency CV to Oscillator:
- Set Oscillator frequency knob to **0 Hz** for direct CV control
- Or use the frequency knob as a transpose/detune offset
- The console will show a helpful tip when making frequency CV connections

**Note on Gate Signal Behavior**:
Gate signals from Keyboard components use a hybrid approach:
- **CV Connection**: The gate output is a ConstantSourceNode that can connect to AudioParams (outputs 0 or 1)
- **ADSR Triggering**: When connecting gate→ADSR, the system also registers the ADSR with the Keyboard
- **Direct Method Calls**: When notes are played, the Keyboard directly calls `triggerGateOn()` and `triggerGateOff()` on connected ADSRs
- This ensures envelopes receive precise timing information beyond what AudioParam ramping provides
- The gate ConstantSourceNode still outputs 0/1 values for visual monitoring or other uses

### Component Layouts
- [x] Set the components width and height automatically according to the controls and in- outputs

### Enhanced Canvas
- [x] Implement component deletion (Delete key)

### Check Oscillator-Keyboard Connection
- [x] The oscillator frequency should be connected to the keyboard frequency CV
- [x] The frequency of teh oscillator should be the same as the frequency of the keyboard

### Oscilloscope Component

#### Core Component Implementation
- [x] Add OSCILLOSCOPE to ComponentType enum in types.ts
- [x] Create src/components/analyzers/ directory
- [x] Create Oscilloscope.ts component class extending SynthComponent
- [x] Add audio input port (Audio In, AUDIO type)
- [x] Add audio output port (Audio Out, AUDIO type)
- [x] Add timeScale parameter (10ms - 1000ms, default 50ms)
- [x] Add fftSize parameter (512 - 8192, default 2048)
- [x] Add displayMode parameter (0=Waveform, 1=Spectrum, 2=Both, default 0)
- [x] Add gain parameter (0.1 - 10.0, default 1.0)
- [x] Implement createAudioNodes() with AnalyserNode
- [x] Implement pass-through routing: inputGain → analyser → output
- [x] Configure FFT size and smoothing on analyser
- [x] Allocate Float32Array for waveform data
- [x] Allocate Uint8Array for spectrum data
- [x] Implement getWaveformData() method
- [x] Implement getSpectrumData() method
- [x] Implement updateAudioParameter() for dynamic changes
- [x] Implement destroyAudioNodes() with proper cleanup

#### Visual Display Implementation
- [x] Create src/canvas/displays/ directory
- [x] Create OscilloscopeDisplay.ts display renderer class
- [x] Create embedded canvas element (200px × 150px)
- [x] Implement startAnimation() with requestAnimationFrame loop
- [x] Implement render() method with mode switching
- [x] Implement renderWaveform() for time-domain display
- [x] Draw waveform as green line graph
- [x] Implement renderSpectrum() for frequency-domain display
- [x] Draw spectrum as blue bar graph
- [x] Implement both mode with split view (waveform top, spectrum bottom)
- [x] Add grid lines to display
- [ ] Add axis markers and labels
- [ ] Implement freeze display functionality
- [x] Implement destroy() method to cancel animation frame
- [x] Apply gain parameter to visual amplitude

#### Canvas Component Integration
- [x] Update componentLayout.ts with Oscilloscope layout
- [x] Add OSCILLOSCOPE case to getControlLayout() (1 dropdown, 2 knobs, display area)
- [x] Calculate component dimensions (220px width, ~280px height)
- [x] Update CanvasComponent.ts createControls() method
- [x] Add OSCILLOSCOPE case for control creation
- [x] Create dropdown for Display Mode (Waveform/Spectrum/Both)
- [x] Create knob for Time Scale parameter
- [x] Create knob for Gain parameter
- [x] Instantiate OscilloscopeDisplay renderer
- [x] Position display canvas below controls
- [x] Update control positions on component move
- [x] Clean up display renderer on component destruction

#### Component Registration
- [x] Import Oscilloscope class in registerComponents.ts
- [x] Register Oscilloscope with ComponentRegistry
- [x] Set category as 'Analyzers'
- [x] Set description as 'Real-time waveform and spectrum analyzer'
- [x] Update Sidebar.ts to include 'Analyzers' category
- [x] Add Oscilloscope to sidebar component list
- [x] Verify drag-and-drop functionality

#### Testing & Validation
- [x] Build project and test basic functionality
- [x] Test oscilloscope in patch: Oscillator → Oscilloscope → VCA → Master Out
- [x] Verify audio passes through unmodified (no latency or coloration)
- [x] Test waveform display mode shows correct waveform shape
- [x] Test spectrum display mode shows frequency peaks
- [x] Test both display mode shows split view correctly
- [x] Test Time Scale parameter changes update display
- [x] Test Gain parameter scales visual amplitude
- [x] Test Display Mode dropdown switches between modes
- [x] Verify 60fps rendering performance
- [x] Test with multiple oscilloscopes in patch
- [x] Verify proper cleanup on component deletion (no memory leaks)

## Phase 4: Patch Management

### Serialization
- [ ] Implement PatchSerializer class
- [ ] Serialize component data to JSON (id, type, position, parameters)
- [ ] Serialize connection data to JSON (source, destination)
- [ ] Serialize metadata (name, version, created, modified)
- [ ] Add serialization methods to all component types

### Storage
- [ ] Implement PatchStorage class with localStorage
- [ ] Implement save patch with custom name
- [ ] Implement load patch by name
- [ ] Implement list all saved patches
- [ ] Implement delete patch
- [ ] Add storage quota management
- [ ] Add error handling for quota exceeded

### Deserialization
- [ ] Parse JSON patch data
- [ ] Recreate components from serialized data
- [ ] Recreate audio nodes for each component
- [ ] Recreate visual components on canvas
- [ ] Recreate connections between components
- [ ] Restore all parameter values

### UI Integration
- [ ] Implement Modal base class
- [ ] Implement save modal UI (input for patch name)
- [ ] Implement load modal UI (list of patches)
- [ ] Implement patch browser with patch list
- [ ] Show current patch name in top bar
- [ ] Add export patch to JSON file
- [ ] Add import patch from JSON file
- [ ] Add file input for import

### State Management
- [ ] Track unsaved changes flag
- [ ] Warn user before losing unsaved changes
- [ ] Implement "New Patch" action (clear canvas)
- [ ] Implement "Save" action (overwrite existing)
- [ ] Implement "Save As" action (save with new name)
- [ ] Update patch modified timestamp on changes

## Phase 5: Modulation & LFO

### LFO Component
- [ ] Implement LFO component with OscillatorNode
- [ ] Add waveform selector (sine, square, sawtooth, triangle, random)
- [ ] Add rate parameter (0.01Hz - 20Hz)
- [ ] Add depth/amplitude parameter (0 - 100%)
- [ ] Create UI controls for LFO
- [ ] Implement modulation output
- [ ] Add tempo sync option (optional)

### Filter Envelope
- [ ] Implement FilterEnvelope component
- [ ] Add ADSR parameters (attack, decay, sustain, release)
- [ ] Add amount parameter for modulation depth
- [ ] Implement gate input
- [ ] Implement envelope output
- [ ] Create UI controls for filter envelope
- [ ] Wire to filter cutoff CV input

### CV Routing
- [ ] Enable LFO to oscillator frequency modulation
- [ ] Enable LFO to filter cutoff modulation
- [ ] Enable envelope to VCA gain modulation
- [ ] Enable envelope to filter cutoff modulation
- [ ] Add visual indication of active modulation
- [ ] Implement modulation depth scaling

### Noise Generator
- [ ] Implement NoiseGenerator component
- [ ] Generate white noise with AudioBufferSourceNode
- [ ] Generate pink noise (white noise + filtering)
- [ ] Add noise type selector
- [ ] Create visual component
- [ ] Add to component library sidebar

### Enhanced Connection System
- [ ] Implement color-coded cables (green=audio, blue=CV, red=gate)
- [ ] Add connection validation by signal type
- [ ] Support multiple connections from one output
- [ ] Enforce single connection per input
- [ ] Add animated cable flow indicator (optional)
- [ ] Improve cable routing algorithm

## Phase 6: Effects

### Delay Effect
- [ ] Implement Delay component with DelayNode
- [ ] Add delay time parameter (0ms - 2s)
- [ ] Add feedback parameter (0 - 95%)
- [ ] Add mix parameter (dry/wet 0 - 100%)
- [ ] Manage feedback loop safely
- [ ] Create UI controls
- [ ] Create visual component

### Reverb Effect
- [ ] Implement Reverb component with ConvolverNode
- [ ] Create or load impulse response files
- [ ] Add room size parameter (or IR selection)
- [ ] Add damping parameter (optional)
- [ ] Add mix parameter (dry/wet 0 - 100%)
- [ ] Create UI controls
- [ ] Create visual component

### Distortion Effect
- [ ] Implement Distortion component with WaveShaperNode
- [ ] Generate distortion curves based on drive
- [ ] Add drive parameter (0 - 100%)
- [ ] Add tone control (low-pass filter)
- [ ] Add mix parameter (dry/wet 0 - 100%)
- [ ] Create UI controls
- [ ] Create visual component

### Chorus Effect
- [ ] Implement Chorus component (DelayNode + LFO)
- [ ] Create internal LFO for modulation
- [ ] Add rate parameter (0.1Hz - 10Hz)
- [ ] Add depth parameter (0 - 100%)
- [ ] Add mix parameter (dry/wet 0 - 100%)
- [ ] Create UI controls
- [ ] Create visual component

### Mixer Component
- [x] Implement Mixer component with multiple inputs
- [x] Support 2-8 input channels
- [x] Add per-channel gain control
- [x] Create single output
- [x] Create visual component with multiple inputs
- [ ] Add optional visual level meters
- [x] Create UI controls for each channel

## Phase 7: Polish & UX

### Advanced Canvas Features
- [ ] Implement multi-select (Ctrl+Click)
- [ ] Implement selection rectangle drag
- [ ] Implement undo/redo system with command pattern
- [ ] Add undo/redo keyboard shortcuts (Ctrl+Z, Ctrl+Y)
- [ ] Implement copy/paste components
- [ ] Add copy/paste keyboard shortcuts (Ctrl+C, Ctrl+V)

### Context Menus
- [ ] Implement ContextMenu class
- [ ] Add right-click event handler on components
- [ ] Add "Duplicate" menu option
- [ ] Add "Delete" menu option
- [ ] Add "Reset to defaults" menu option
- [ ] Add "Rename component" menu option
- [ ] Add "Show/hide parameters" menu option

### Visual Improvements
- [ ] Improve component visual styling
- [ ] Add smooth CSS transitions
- [ ] Add component animations (add/remove)
- [ ] Add loading states for patch operations
- [ ] Implement toast notifications for errors
- [ ] Add user-friendly error messages
- [ ] Improve cable rendering aesthetics

### Keyboard Enhancements
- [ ] Add octave shift display to keyboard UI
- [ ] Improve visual key press feedback
- [ ] Add velocity slider control
- [ ] Implement sustain pedal toggle (spacebar)
- [ ] Add "panic" button (stop all notes)
- [ ] Show currently pressed keys visually

### Help & Onboarding
- [ ] Create welcome modal for first-time users
- [ ] Add quick tutorial overlay
- [ ] Implement tooltips on hover for components
- [ ] Create example patches (basic synth, pad, bass)
- [ ] Add keyboard shortcuts reference modal
- [ ] Create help documentation accessible from menu

## Phase 8: Testing & Optimization

### Performance Optimization
- [ ] Optimize canvas rendering (reduce redraws)
- [ ] Implement dirty rectangle rendering
- [ ] Implement audio node pooling for voices
- [ ] Optimize connection lookup with spatial indexing
- [ ] Run memory leak detection tools
- [ ] Profile performance with browser DevTools
- [ ] Optimize bundle size with tree shaking

### Browser Testing
- [ ] Test application in Chrome
- [ ] Test application in Firefox
- [ ] Test application in Safari
- [ ] Fix browser-specific Web Audio API issues
- [ ] Test on tablets (iPad, Android tablets)
- [ ] Make responsive design adjustments
- [ ] Test touch interactions

### Audio Quality Testing
- [ ] Measure audio latency in Chrome
- [ ] Measure audio latency in Firefox
- [ ] Measure audio latency in Safari
- [ ] Test with complex patches (20+ components)
- [ ] Test polyphony with 8 simultaneous voices
- [ ] Fix audio dropouts and glitches
- [ ] Test different sample rates

### Bug Fixes
- [ ] Fix connection visual/audio sync issues
- [ ] Fix state synchronization bugs
- [ ] Fix patch save/load edge cases
- [ ] Fix UI responsiveness issues
- [ ] Fix memory leaks
- [ ] Fix keyboard input conflicts
- [ ] Fix canvas interaction edge cases

### Documentation
- [ ] Add JSDoc comments to all public methods
- [ ] Write user manual (how to use the synthesizer)
- [ ] Write architecture documentation
- [ ] Document audio signal flow
- [ ] Create deployment guide
- [ ] Write contribution guidelines
- [ ] Create README.md with project overview

## Additional Tasks (Post-MVP)

### Code Quality
- [ ] Add ESLint configuration
- [ ] Add Prettier configuration
- [ ] Set up pre-commit hooks
- [ ] Add unit tests with Vitest
- [ ] Achieve 80%+ test coverage
- [ ] Set up CI/CD pipeline

### Advanced Features (Future)
- [ ] Add MIDI controller support
- [ ] Add audio file import (samples)
- [ ] Implement sequencer component
- [ ] Implement arpeggiator component
- [ ] Add waveform visualizer
- [ ] Add oscilloscope component
- [ ] Add spectrum analyzer
- [ ] Add recording/export to WAV
- [ ] Create PWA manifest
- [ ] Add offline support

## Task Count Summary

- Phase 1: 29 tasks
- Phase 2: 27 tasks
- Phase 3: 29 tasks
- Phase 4: 26 tasks
- Phase 5: 21 tasks
- Phase 6: 23 tasks
- Phase 7: 27 tasks
- Phase 8: 27 tasks

**Total: 209 tasks**
