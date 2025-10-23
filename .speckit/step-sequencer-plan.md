# Step Sequencer Component - Implementation Plan

## Overview
A 16-step sequencer component that can run standalone or act as an arpeggiator when connected to the keyboard input. Each step has adjustable velocity, pitch/note, and gate length parameters, with global BPM and note division controls.

## Architecture Analysis

### Integration Points
Based on the existing codebase:

1. **Similar to KeyboardInput**:
   - Outputs: Frequency CV, Gate, Velocity CV
   - Uses ConstantSourceNode for CV outputs
   - Triggers connected ADSR envelopes via gate

2. **Timing System**:
   - Uses Web Audio API `currentTime` for precise scheduling
   - Implements lookahead scheduling for accurate timing
   - Similar to how ADSR manages time-based events

3. **Component Type**:
   - Category: "Utilities" (like KeyboardInput)
   - No audio input, only CV/Gate outputs
   - Parameters for global settings (BPM, note division)

## Component Structure

### Core Components

#### 1. StepSequencer Component (`src/components/utilities/StepSequencer.ts`)
Main component handling audio nodes and timing.

**Properties:**
```typescript
- frequencyNode: ConstantSourceNode      // CV output for pitch
- gateNode: ConstantSourceNode           // Gate output
- velocityNode: ConstantSourceNode       // Velocity CV output
- clockNode: ConstantSourceNode          // Optional: clock sync output
- steps: SequencerStep[16]               // 16-step array
- currentStep: number                     // Current step index
- isPlaying: boolean                      // Playback state
- nextStepTime: number                    // Next scheduled step time
- lookaheadTime: number = 0.1            // 100ms lookahead
- scheduleInterval: number | null         // Timer ID for scheduling
- connectedGateTargets: Set<SynthComponent>
- keyboardInput: KeyboardInput | null    // For arpeggiator mode
```

**Parameters:**
```typescript
- bpm: Parameter (30-300 BPM, default 120)
- noteValue: Parameter (0-5, default 2)
  // 0 = whole note, 1 = 1/2, 2 = 1/4, 3 = 1/8, 4 = 1/16, 5 = 1/32
- mode: Parameter (0-1)
  // 0 = sequencer mode, 1 = arpeggiator mode
```

**Output Ports:**
```typescript
- frequency: CV output (pitch)
- gate: GATE output (trigger)
- velocity: CV output (velocity)
```

**Input Ports (for arpeggiator mode):**
```typescript
- arpeggiate: GATE input (from keyboard to trigger arpeggio)
```

#### 2. SequencerStep Data Structure
```typescript
interface SequencerStep {
  active: boolean;          // Step on/off
  note: number;             // MIDI note number (0-127)
  velocity: number;         // 0.0 - 1.0
  gateLength: number;       // 0-5 (tied, 1/1, 1/2, 1/4, 1/8, 1/16)
                           // Tied = hold until next active step
}
```

Default values:
- active: true
- note: 60 (C4)
- velocity: 0.8
- gateLength: 2 (1/4 note)

#### 3. SequencerDisplay Component (`src/canvas/displays/SequencerDisplay.ts`)
Custom UI for editing sequencer steps.

**Features:**
- 16-step grid display
- Visual indicators for current step
- Per-step editors (mini piano roll + velocity bars)
- Click to toggle step on/off
- Click and drag to edit notes/velocity
- Gate length indicator per step

**Layout:**
```
┌─────────────────────────────────────────┐
│  Step: [1][2][3][4]...[16]  Playing: ▶  │
├─────────────────────────────────────────┤
│  Step Grid (visual representation)      │
│  ┌──┬──┬──┬──┐ ... ┌──┬──┬──┬──┐        │
│  │█ │  │█ │  │     │  │█ │  │  │        │ ← Active steps
│  └──┴──┴──┴──┘     └──┴──┴──┴──┘        │
├─────────────────────────────────────────┤
│  Selected Step Editor:                  │
│  Note: [C4]  Velocity: [▓▓▓▓▓░░] 80%    │
│  Gate: [1/4 note ▼]                     │
└─────────────────────────────────────────┘
```

## Timing Engine Design

### Clock System
```typescript
class SequencerClock {
  private bpm: number;
  private noteValue: number;  // 0-5 (whole to 1/32)

  // Calculate time between steps in seconds
  getStepInterval(): number {
    const beatsPerMinute = this.bpm;
    const secondsPerBeat = 60 / beatsPerMinute;
    const divisor = Math.pow(2, this.noteValue); // 1, 2, 4, 8, 16, 32
    return (secondsPerBeat * 4) / divisor;
  }

  // Calculate gate length for a step
  getGateLength(step: SequencerStep, stepInterval: number): number {
    if (step.gateLength === 0) return stepInterval; // Tied
    const divisor = Math.pow(2, step.gateLength - 1);
    return stepInterval / divisor;
  }
}
```

### Scheduling Algorithm (Lookahead)
```typescript
private scheduleNextSteps(): void {
  const ctx = audioEngine.getContext();
  const currentTime = ctx.currentTime;
  const stepInterval = this.getStepInterval();

  // Schedule all steps within lookahead window
  while (this.nextStepTime < currentTime + this.lookaheadTime) {
    this.scheduleStep(this.currentStep, this.nextStepTime);

    // Advance to next step
    this.currentStep = (this.currentStep + 1) % 16;
    this.nextStepTime += stepInterval;
  }
}

private scheduleStep(stepIndex: number, time: number): void {
  const step = this.steps[stepIndex];

  if (!step.active) return; // Skip inactive steps

  // Schedule frequency change
  const frequency = this.midiToFrequency(step.note);
  this.frequencyNode.offset.setValueAtTime(frequency, time);

  // Schedule velocity
  this.velocityNode.offset.setValueAtTime(step.velocity, time);

  // Schedule gate on
  this.gateNode.offset.setValueAtTime(1, time);

  // Trigger ADSR envelopes
  this.triggerGateTargets();

  // Schedule gate off
  const gateLength = this.getGateLength(step, this.getStepInterval());
  const gateOffTime = time + gateLength;
  this.gateNode.offset.setValueAtTime(0, gateOffTime);
}
```

## Arpeggiator Mode

### Integration with Keyboard
When in arpeggiator mode:
1. Accept gate input from KeyboardInput
2. Use keyboard notes to populate step notes
3. Cycle through held notes at sequencer tempo
4. Stop when keyboard gate goes low

### Algorithm
```typescript
private updateArpeggiatorNotes(keyboardInput: KeyboardInput): void {
  const activeNotes = keyboardInput.getActiveNotes(); // Array of held notes

  if (activeNotes.length === 0) {
    this.stop();
    return;
  }

  // Distribute notes across active steps
  let noteIndex = 0;
  for (let i = 0; i < 16; i++) {
    if (this.steps[i].active) {
      this.steps[i].note = activeNotes[noteIndex % activeNotes.length];
      noteIndex++;
    }
  }

  if (!this.isPlaying) {
    this.start();
  }
}
```

## UI/UX Design

### Component Layout
- Width: 300px (wider than typical components)
- Height: 250px (includes display area)
- Display area: 280px x 180px for step grid and editor

### Controls
1. **Transport Controls** (top bar):
   - Play/Stop button
   - Reset button (jump to step 1)
   - Mode toggle (Sequencer/Arpeggiator)

2. **Global Parameters** (knobs):
   - BPM (30-300)
   - Note Division (dropdown: whole, 1/2, 1/4, 1/8, 1/16, 1/32)

3. **Step Grid** (main display):
   - 16 step buttons (toggle active/inactive)
   - Current step indicator (highlight)
   - Per-step mini editor when clicked

4. **Step Editor** (appears below grid when step selected):
   - Note selector (piano key visualization or note name dropdown)
   - Velocity slider (0-100%)
   - Gate length dropdown (Tied, 1/1, 1/2, 1/4, 1/8, 1/16)

### Visual Feedback
- Active steps: Filled/highlighted
- Current playing step: Animated pulse or different color
- Inactive steps: Grayed out
- Velocity: Bar graph per step
- Note pitch: Color coding or vertical position

## Implementation Tasks

### Phase 1: Core Sequencer Component
1. Create StepSequencer component class
2. Implement SequencerStep data structure
3. Create CV/Gate output nodes (ConstantSourceNodes)
4. Add input/output ports
5. Implement basic parameters (BPM, note division, mode)
6. Register component in component registry

### Phase 2: Timing Engine
1. Implement clock calculation logic
2. Create lookahead scheduling system
3. Implement step advancement logic
4. Add gate length calculation
5. Implement MIDI to frequency conversion
6. Test timing accuracy

### Phase 3: Sequencer Display UI
1. Create SequencerDisplay class
2. Implement 16-step grid rendering
3. Add current step indicator animation
4. Implement step click/toggle functionality
5. Add visual feedback for active steps
6. Integrate with CanvasComponent

### Phase 4: Step Editor UI
1. Create step editor panel
2. Add note selector (dropdown or mini keyboard)
3. Add velocity slider/editor
4. Add gate length selector
5. Implement step parameter updates
6. Add visual feedback for parameter changes

### Phase 5: Transport Controls
1. Add Play/Stop button
2. Implement start() method
3. Implement stop() method
4. Add reset() method (jump to step 1)
5. Add mode toggle (Sequencer/Arpeggiator)
6. Add visual state indicators

### Phase 6: Arpeggiator Mode
1. Add gate input port
2. Implement keyboard connection detection
3. Create arpeggiator note distribution logic
4. Implement gate input monitoring
5. Add automatic start/stop based on keyboard input
6. Test arpeggiator with KeyboardInput

### Phase 7: Polish & Testing
1. Add pattern save/load (store in component state)
2. Implement pattern randomization button
3. Add step copy/paste functionality
4. Test timing at various BPMs
5. Test with different note divisions
6. Test arpeggiator mode with various note patterns
7. Add tooltips and help text
8. Optimize rendering performance

### Phase 8: Optional Enhancements
1. Add swing/shuffle parameter
2. Add per-step probability (0-100% chance to trigger)
3. Add direction modes (forward, backward, ping-pong, random)
4. Add multiple patterns (A/B/C/D) with pattern selection
5. Add pattern chaining
6. Add MIDI file export
7. Add step repeat/ratcheting
8. Add per-step micro-timing offset

## Data Persistence

### Pattern Storage
```typescript
interface SequencerPattern {
  bpm: number;
  noteValue: number;
  steps: SequencerStep[];
}

// Save pattern to component state
savePattern(): SequencerPattern {
  return {
    bpm: this.getParameter('bpm').getValue(),
    noteValue: this.getParameter('noteValue').getValue(),
    steps: this.steps.map(s => ({...s}))
  };
}

// Load pattern from state
loadPattern(pattern: SequencerPattern): void {
  this.setParameterValue('bpm', pattern.bpm);
  this.setParameterValue('noteValue', pattern.noteValue);
  this.steps = pattern.steps.map(s => ({...s}));
  this.updateDisplay();
}
```

## Technical Considerations

### 1. Timing Precision
- Use Web Audio API's AudioContext.currentTime for scheduling
- Implement lookahead scheduling (100ms window)
- Use setValueAtTime() for precise parameter automation
- Schedule gate on/off separately for accurate gate lengths

### 2. Performance
- Only redraw display when step changes or user interacts
- Use requestAnimationFrame for current step indicator animation
- Batch DOM updates for step editor
- Limit scheduling to lookahead window

### 3. State Management
- Store step data in component state
- Persist patterns when saving patch
- Handle cleanup on component destruction (stop timers)

### 4. Connection Handling
- Similar to KeyboardInput gate connections
- Track connected ADSR components
- Trigger gate on/off events properly
- Handle disconnection gracefully

## File Structure

```
src/
├── components/
│   └── utilities/
│       └── StepSequencer.ts          # Main component
├── canvas/
│   └── displays/
│       └── SequencerDisplay.ts       # UI display
├── core/
│   └── types.ts                      # Add STEP_SEQUENCER type
└── utils/
    ├── componentLayout.ts            # Add sequencer layout
    └── midiUtils.ts                  # MIDI conversion utilities (new)
```

## Estimated Effort

- **Phase 1-2**: Core component + timing (4-6 hours)
- **Phase 3-4**: UI displays (6-8 hours)
- **Phase 5**: Transport controls (2-3 hours)
- **Phase 6**: Arpeggiator mode (3-4 hours)
- **Phase 7**: Polish & testing (3-4 hours)
- **Total Core**: ~20-25 hours

Optional enhancements: Additional 10-15 hours

## Success Criteria

1. ✅ 16 steps with adjustable note, velocity, gate length
2. ✅ Global BPM control (30-300)
3. ✅ Global note division control
4. ✅ Accurate timing at all BPM/division settings
5. ✅ Standalone sequencer mode works
6. ✅ Arpeggiator mode works with keyboard input
7. ✅ Play/stop/reset controls functional
8. ✅ CV/Gate outputs compatible with oscillators and envelopes
9. ✅ Pattern data persists with patch save/load
10. ✅ UI is responsive and intuitive

## Next Steps

1. Review this plan and confirm requirements
2. Create detailed task breakdown in tasks.md
3. Begin implementation with Phase 1 (Core component)
4. Iterate and test each phase before moving forward
