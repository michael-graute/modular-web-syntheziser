# Modular Synthesizer Application Specification

## Overview
A browser-based modular synthesizer application that allows users to create custom synthesizers by dragging and connecting audio processing components on a visual canvas. The application leverages the Web Audio API for sound generation and processing.

## Core Features

### 1. Visual Canvas System
**Purpose**: Provide an interactive workspace for building synthesizer patches

**Requirements**:
- Infinite or large scrollable/pannable canvas
- Grid or snap-to-grid option for precise component placement
- Zoom in/out functionality (50% to 200%)
- Component selection (single and multiple)
- Drag-and-drop component positioning
- Undo/redo support for all canvas operations
- Clear visual feedback for selected components
- Connection cables rendered as bezier curves or straight lines

**User Interactions**:
- Click and drag to pan canvas
- Scroll/pinch to zoom
- Click component to select
- Drag component to move
- Ctrl+Click for multi-select
- Delete key to remove selected components
- Ctrl+Z/Ctrl+Y for undo/redo

### 2. Component Library
**Purpose**: Provide building blocks for synthesizer creation

#### Oscillator Components
- **Types**: Sine, Square, Sawtooth, Triangle, White Noise, Pink Noise
- **Parameters**:
  - Frequency (20Hz - 20kHz)
  - Detune (-100 to +100 cents)
  - Waveform selector
- **Inputs**:
  - Frequency CV (control voltage)
  - Detune CV
- **Outputs**:
  - Audio Out

#### LFO (Low Frequency Oscillator)
- **Types**: Sine, Square, Sawtooth, Triangle, Random (sample & hold)
- **Parameters**:
  - Rate (0.01Hz - 20Hz)
  - Depth/Amplitude (0 - 100%)
  - Waveform selector
  - Sync (free-running or tempo-synced)
- **Outputs**:
  - Modulation Out

#### Filters
- **Types**: Low-pass, High-pass, Band-pass, Notch, All-pass
- **Parameters**:
  - Cutoff frequency (20Hz - 20kHz)
  - Resonance/Q (0 - 20)
  - Filter type selector
- **Inputs**:
  - Audio In
  - Cutoff CV
  - Resonance CV
- **Outputs**:
  - Audio Out

#### ADSR Envelope
- **Parameters**:
  - Attack time (0ms - 5s)
  - Decay time (0ms - 5s)
  - Sustain level (0 - 100%)
  - Release time (0ms - 5s)
- **Inputs**:
  - Gate (trigger on note on/off)
- **Outputs**:
  - Envelope Out

#### Filter Envelope
- **Parameters**:
  - Attack time (0ms - 5s)
  - Decay time (0ms - 5s)
  - Sustain level (0 - 100%)
  - Release time (0ms - 5s)
  - Amount (depth of modulation)
- **Inputs**:
  - Gate (trigger on note on/off)
- **Outputs**:
  - Envelope Out

#### VCA (Voltage Controlled Amplifier)
- **Parameters**:
  - Gain (0 - 200%)
- **Inputs**:
  - Audio In
  - CV In (for amplitude modulation)
- **Outputs**:
  - Audio Out

#### Effects

##### Delay
- **Parameters**:
  - Delay time (0ms - 2s)
  - Feedback (0 - 95%)
  - Mix (dry/wet 0 - 100%)
- **Inputs**: Audio In
- **Outputs**: Audio Out

##### Reverb
- **Parameters**:
  - Room size (0 - 100%)
  - Damping (0 - 100%)
  - Mix (dry/wet 0 - 100%)
- **Inputs**: Audio In
- **Outputs**: Audio Out

##### Distortion
- **Parameters**:
  - Drive (0 - 100%)
  - Tone (low-pass filter)
  - Mix (dry/wet 0 - 100%)
- **Inputs**: Audio In
- **Outputs**: Audio Out

##### Chorus
- **Parameters**:
  - Rate (0.1Hz - 10Hz)
  - Depth (0 - 100%)
  - Mix (dry/wet 0 - 100%)
- **Inputs**: Audio In
- **Outputs**: Audio Out

#### Mixer
- **Parameters**:
  - Per-channel gain (0 - 200%)
  - Number of channels (2-8)
- **Inputs**:
  - Multiple Audio Ins
- **Outputs**:
  - Audio Out

#### Master Output
- **Parameters**:
  - Master volume (0 - 100%)
  - Limiter on/off
- **Inputs**:
  - Audio In (stereo)
- **Outputs**:
  - System audio output
- **Special**: Only one master output allowed per patch

### 3. Connection System
**Purpose**: Route audio and control signals between components

**Requirements**:
- Visual cable connections between component inputs/outputs
- Click source output, click destination input to create connection
- Different colors for different signal types:
  - Audio signals: Green
  - CV/Modulation signals: Blue
  - Gate/Trigger signals: Red
- Hover over connection to highlight and show delete option
- Prevent invalid connections (e.g., audio out to gate in)
- Support multiple connections from one output
- Only one connection per input
- Animated flow indicator on cables (optional)

**Validation**:
- Prevent circular dependencies that would cause feedback loops (warn user)
- Ensure signal types match (audio to audio, CV to CV compatible inputs)

### 4. Component UI
**Purpose**: Provide intuitive controls for each component

**Requirements**:
- Each component displayed as a visual module/box
- Component header with name and type
- Input ports on left side
- Output ports on right side
- Parameters displayed as knobs, sliders, or dropdowns
- Real-time parameter updates
- Right-click menu for:
  - Duplicate component
  - Delete component
  - Reset to defaults
  - Rename component
- Visual indicators for active signals
- Compact and expanded view modes

**Design**:
- Skeuomorphic or flat design (consistent across all components)
- Clear labeling of all inputs, outputs, and parameters
- Color-coded port types
- Visual feedback when adjusting parameters

### 5. On-Screen Keyboard
**Purpose**: Test synthesizer output with musical input

**Requirements**:
- 2-octave piano keyboard (24 keys)
- Octave shift buttons (up/down)
- Current octave display
- Visual feedback when keys pressed
- Velocity support (fixed or mouse-velocity based)
- Polyphony support (up to 8 simultaneous notes)

**QWERTY Keyboard Mapping**:
```
Row 1 (white keys): A S D F G H J K L ; '
Row 2 (black keys): W E   T Y U   O P
```
- Z: Octave down
- X: Octave up
- Current octave range: C3 to B4 (default)
- Hold multiple keys for chords
- Key release triggers note-off

**Additional Controls**:
- Velocity slider (if not using mouse velocity)
- Sustain pedal toggle (Space bar)
- Panic button (stop all notes)

### 6. Patch Management
**Purpose**: Save and load synthesizer configurations

**Requirements**:
- Save current patch with custom name
- Load previously saved patch
- Delete saved patches
- Export patch as JSON file
- Import patch from JSON file
- Auto-save feature (optional, with recovery)
- Patch browser/library view

**Patch Data Structure**:
```json
{
  "name": "My Patch",
  "version": "1.0",
  "created": "2025-10-22T12:00:00Z",
  "modified": "2025-10-22T12:30:00Z",
  "components": [
    {
      "id": "uuid",
      "type": "oscillator",
      "position": {"x": 100, "y": 100},
      "parameters": {
        "frequency": 440,
        "waveform": "sawtooth",
        "detune": 0
      }
    }
  ],
  "connections": [
    {
      "source": {"componentId": "uuid1", "output": "audioOut"},
      "destination": {"componentId": "uuid2", "input": "audioIn"}
    }
  ]
}
```

**Storage**:
- Use browser localStorage for patch storage
- Implement storage quota management
- Warn user when approaching storage limits

### 7. Application Layout
**Purpose**: Organize UI elements efficiently

**Layout Structure**:
```
┌─────────────────────────────────────────────────┐
│ Top Bar: App Name | Patch Name | Actions        │
├───────────┬─────────────────────────────────────┤
│           │                                     │
│ Component │                                     │
│ Library   │         Canvas Area                 │
│ (Sidebar) │                                     │
│           │                                     │
│           │                                     │
├───────────┴─────────────────────────────────────┤
│ On-Screen Keyboard                              │
└─────────────────────────────────────────────────┘
```

**Top Bar Elements**:
- Application title
- Current patch name (editable)
- New Patch button
- Save button
- Save As button
- Load button
- Export/Import buttons
- Settings button

**Component Library Sidebar**:
- Categorized component list:
  - Generators (Oscillators, LFOs, Noise)
  - Processors (Filters, VCAs, Envelopes)
  - Effects (Delay, Reverb, Distortion, Chorus)
  - Utilities (Mixer, Output)
- Drag components onto canvas
- Search/filter components
- Collapsible categories

**Keyboard Section**:
- Fixed at bottom or toggleable
- Compact mode option
- Show/hide toggle

## Technical Requirements

### Browser Compatibility
- Modern browsers with Web Audio API support:
  - Chrome/Edge 89+
  - Firefox 88+
  - Safari 14+
- Progressive Web App (PWA) capability
- Responsive design for tablets (1024px+ width)

### Performance
- Smooth 60fps canvas rendering
- Low-latency audio processing (< 10ms)
- Support for at least 20 components simultaneously
- Efficient audio graph management
- Web Workers for heavy computations (if needed)

### Technology Stack
- **Framework**: React, Vue, or vanilla TypeScript
- **Audio**: Web Audio API
- **Canvas**: HTML5 Canvas or SVG with canvas library (e.g., Konva.js, Fabric.js)
- **State Management**: Redux, Vuex, or Context API
- **Storage**: localStorage/IndexedDB
- **Build Tool**: Vite, Webpack, or Parcel
- **Styling**: CSS Modules, Styled Components, or Tailwind CSS

### Audio Architecture
- Use Web Audio API AudioContext
- Create AudioNode for each component
- Connect nodes based on patch connections
- Implement proper cleanup and disconnection
- Use AudioWorklet for custom processors (optional)
- Handle audio context suspension/resumption

## User Experience

### First-Time User Experience
- Welcome modal with quick tutorial
- Example patches to load and explore
- Tooltips on hover for component parameters
- Help documentation accessible from menu

### Visual Design Principles
- Clean, modern interface
- Consistent color scheme
- Clear typography
- Adequate spacing between components
- Dark theme (with light theme option)
- Accessibility considerations (WCAG 2.1 AA)

### Error Handling
- Graceful handling of Web Audio API errors
- User-friendly error messages
- Recovery options for failed operations
- Validation before saving patches
- Warning for unsaved changes

## Testing Requirements

### Unit Tests
- Component rendering
- Parameter validation
- Connection logic
- Patch save/load functionality
- Keyboard input handling

### Integration Tests
- Audio signal flow
- Component interaction
- Canvas operations
- Storage operations

### Manual Testing
- Audio quality verification
- Cross-browser compatibility
- Performance with complex patches
- Keyboard responsiveness
- Touch interaction (tablets)

## Future Enhancements
- MIDI controller support
- Audio file import (samples)
- Sequencer/arpeggiator
- Preset browser with categories
- Waveform visualizers
- Oscilloscope component
- Spectrum analyzer
- Additional filter types (comb, formant)
- Granular synthesis
- Recording/export to WAV
- Collaborative patching (multiplayer)
- Patch sharing/community library

## Success Metrics
- Users can create a basic patch within 5 minutes
- Audio latency remains below 10ms
- Application loads in under 3 seconds
- 80%+ test coverage
- Zero audio dropouts during normal operation
- Patches save/load successfully 100% of time

## Development Phases

### Phase 1: Core Foundation
- Canvas system with drag-and-drop
- Basic oscillator component
- Master output component
- Simple connection system
- On-screen keyboard

### Phase 2: Essential Components
- All oscillator types
- VCA and ADSR envelope
- Basic filter
- Patch save/load

### Phase 3: Modulation & Effects
- LFO
- Filter envelope
- Delay and reverb effects
- Mixer component

### Phase 4: Polish & Enhancement
- Additional effects (distortion, chorus)
- UI/UX improvements
- Performance optimization
- Advanced patch management
- Documentation and tutorials

### Phase 5: Advanced Features
- MIDI support
- Additional synthesis methods
- Sequencer
- Community features
