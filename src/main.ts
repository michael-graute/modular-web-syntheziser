/**
 * Main entry point for Modular Synthesizer Application
 */

import { isWebAudioSupported, isLocalStorageAvailable } from './utils/validators';
import { Canvas } from './canvas/Canvas';
import { CanvasComponent } from './canvas/CanvasComponent';
import { ComponentType, EventType } from './core/types';
import { audioEngine } from './core/AudioEngine';
import { registerAllComponents } from './components/registerComponents';
import { componentRegistry } from './components/ComponentRegistry';
import { KeyboardController } from './keyboard/KeyboardController';
import { NoteMapper } from './keyboard/NoteMapper';
import { Sidebar } from './ui/Sidebar';
import { eventBus } from './core/EventBus';
import { patchManager } from './patch/PatchManager';
import { SaveModal } from './ui/SaveModal';
import { LoadModal } from './ui/LoadModal';
import { HelpSidebar } from './ui/HelpSidebar';
import { ModulationVisualizer } from './visualization';

console.log('🎹 Modular Synth - Initializing...');

let canvas: Canvas | null = null;
let keyboardController: KeyboardController | null = null;
let saveModal: SaveModal | null = null;
let loadModal: LoadModal | null = null;
let helpSidebar: HelpSidebar | null = null;
let modulationVisualizer: ModulationVisualizer | null = null;

/**
 * Setup patch management UI and event handlers
 */
function setupPatchManagement(): void {
  // Create modals
  saveModal = new SaveModal();
  loadModal = new LoadModal();
  helpSidebar = new HelpSidebar();

  // Get UI elements
  const patchNameInput = document.getElementById('patch-name') as HTMLInputElement;
  const btnNew = document.getElementById('btn-new');
  const btnSave = document.getElementById('btn-save');
  const btnLoad = document.getElementById('btn-load');
  const btnExport = document.getElementById('btn-export');
  const btnImport = document.getElementById('btn-import');
  const btnHelp = document.getElementById('btn-help');

  // Hidden file input for import
  const importFileInput = document.createElement('input');
  importFileInput.type = 'file';
  importFileInput.accept = '.json';
  importFileInput.style.display = 'none';
  document.body.appendChild(importFileInput);

  // Update patch name display
  const updatePatchName = () => {
    const currentPatch = patchManager.getCurrentPatch();
    if (patchNameInput) {
      patchNameInput.value = currentPatch?.name || 'Untitled';
      // Show unsaved indicator
      if (patchManager.hasUnsavedChanges()) {
        patchNameInput.value += ' *';
      }
    }
  };

  // Listen for patch events
  eventBus.on(EventType.PATCH_SAVED, updatePatchName);
  eventBus.on(EventType.PATCH_LOADED, updatePatchName);
  eventBus.on(EventType.PATCH_CLEARED, updatePatchName);

  // New button
  if (btnNew) {
    btnNew.addEventListener('click', () => {
      patchManager.newPatch('Untitled');
      updatePatchName();
    });
  }

  // Save button
  if (btnSave) {
    btnSave.addEventListener('click', () => {
      const currentPatch = patchManager.getCurrentPatch();
      if (currentPatch) {
        // Already has a name, just save
        patchManager.save();
        updatePatchName();
      } else {
        // No name yet, show save modal
        saveModal?.openWithName('Untitled');
      }
    });
  }

  // Save modal callback
  saveModal?.onSave((name: string) => {
    patchManager.save(name);
    updatePatchName();
  });

  // Load button
  if (btnLoad) {
    btnLoad.addEventListener('click', () => {
      loadModal?.open();
    });
  }

  // Load modal callback
  loadModal?.onLoad(async (name: string) => {
    await patchManager.load(name);
    updatePatchName();
  });

  // Load modal delete callback
  loadModal?.onDelete((name: string) => {
    patchManager.deletePatch(name);
  });

  // Export button
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      patchManager.exportToFile();
    });
  }

  // Import button
  if (btnImport) {
    btnImport.addEventListener('click', () => {
      importFileInput.click();
    });
  }

  // Import file handler
  importFileInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      await patchManager.importFromFile(file);
      updatePatchName();
      // Reset input so same file can be selected again
      importFileInput.value = '';
    }
  });

  // Help button
  if (btnHelp) {
    btnHelp.addEventListener('click', () => {
      helpSidebar?.toggle();
    });
  }

  // Update patch name on input change
  if (patchNameInput) {
    patchNameInput.addEventListener('change', () => {
      const name = patchNameInput.value.trim();
      if (name && name !== 'Untitled' && name !== 'Untitled *') {
        // Save with new name
        patchManager.save(name);
        updatePatchName();
      }
    });
  }

  console.log('✅ Phase 4 Tasks 3-4 complete: Patch management UI integrated');
}

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  // Check for required browser features
  if (!isWebAudioSupported()) {
    showError('Web Audio API is not supported in this browser.');
    return;
  }

  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available. Patches cannot be saved.');
  }

  console.log('✅ Browser compatibility check passed');
  console.log('✅ Phase 1 Task 1 & 2 complete: Project initialization and core systems');

  // Register all component types
  registerAllComponents();
  console.log('✅ Phase 2 Task 1 complete: Component base classes and registry');

  // Initialize sidebar component library
  const sidebar = new Sidebar();
  sidebar.populate();
  console.log('✅ Phase 2 Task 5 complete: Component library with drag-and-drop');

  // Initialize audio engine
  try {
    await audioEngine.init();
    console.log('✅ Phase 1 Task 4 complete: Audio engine initialized');

    // Initialize modulation visualizer
    await initializeModulationVisualizer();

    // Setup click handler to resume audio context (Chrome autoplay policy)
    setupAudioResume();
  } catch (error) {
    console.error('Failed to initialize audio engine:', error);
    showError('Failed to initialize audio engine. Please refresh the page.');
    return;
  }

  // Initialize canvas system
  const canvasElement = document.getElementById('synth-canvas') as HTMLCanvasElement;
  if (canvasElement) {
    canvas = new Canvas(canvasElement);
    canvas.start();
    console.log('✅ Phase 1 Task 3 complete: Canvas system initialized');

    // Set canvas for patch manager
    patchManager.setCanvas(canvas);

    // Listen for component add requests from drag-and-drop
    eventBus.on(EventType.COMPONENT_ADD_REQUESTED, (data: any) => {
      handleComponentAdd(data.componentType, data.position);
    });

    // Listen for components being added (e.g., during patch load)
    eventBus.on(EventType.COMPONENT_ADDED, (data: any) => {
      if (data.component) {
        trackComponentParameters(data.component);
      }
    });

    // Setup patch management UI
    setupPatchManagement();

    // Test components removed - canvas starts empty
    // Users can now drag components from the sidebar
    console.log('💡 Drag components from the sidebar to get started!');
  }

  // Initialize keyboard controller
  const keyboardElement = document.getElementById('keyboard-canvas') as HTMLCanvasElement;
  if (keyboardElement) {
    keyboardController = new KeyboardController(keyboardElement);
    console.log('✅ Phase 2 Task 4 complete: Keyboard system initialized');

    // Wire keyboard to audio test function
    keyboardController.setNoteOnCallback((note, velocity) => {
      triggerNoteOn(note, velocity);
    });

    keyboardController.setNoteOffCallback((note) => {
      triggerNoteOff(note);
    });

    // Wire up octave buttons
    const octaveDownBtn = document.getElementById('btn-octave-down');
    const octaveUpBtn = document.getElementById('btn-octave-up');
    const octaveDisplay = document.getElementById('octave-display');
    const panicBtn = document.getElementById('btn-panic');

    if (octaveDownBtn) {
      octaveDownBtn.addEventListener('click', () => {
        keyboardController?.shiftOctaveDown();
        if (octaveDisplay) {
          const octave = keyboardController?.getNoteMapper().getOctave() || 3;
          octaveDisplay.textContent = `Octave: C${octave}`;
        }
      });
    }

    if (octaveUpBtn) {
      octaveUpBtn.addEventListener('click', () => {
        keyboardController?.shiftOctaveUp();
        if (octaveDisplay) {
          const octave = keyboardController?.getNoteMapper().getOctave() || 3;
          octaveDisplay.textContent = `Octave: C${octave}`;
        }
      });
    }

    if (panicBtn) {
      panicBtn.addEventListener('click', () => {
        keyboardController?.releaseAll();

        // Release all Keyboard components
        if (canvas) {
          const components = canvas.getComponents();

          components.forEach((visualComponent: any) => {
            const audioComponent = visualComponent.getSynthComponent();
            if (!audioComponent) return;

            if (audioComponent.type === ComponentType.KEYBOARD_INPUT) {
              const keyboardComponent = audioComponent as any;
              if (keyboardComponent.releaseAll) {
                keyboardComponent.releaseAll();
              }
            }
          });
        }

        console.log('🛑 Panic! All notes stopped');
      });
    }
  }

  // Update UI to show initialization is complete
  updateStatus('Ready - Phase 2 (Tasks 1-4) Complete - Click to enable audio');
}

/**
 * Initialize modulation visualizer
 */
async function initializeModulationVisualizer(): Promise<void> {
  try {
    modulationVisualizer = new ModulationVisualizer();

    await modulationVisualizer.initialize({
      audioContext: audioEngine.getContext(),
      samplingRate: 20, // 20 Hz sampling
      targetFPS: 60, // 60 FPS rendering
      interpolationEnabled: true,
      fadeDuration: 300, // 300ms fade
      updateThreshold: 0.001, // Minimum change threshold
      maxParameters: 256, // Max tracked parameters (Int32Array)
    });

    // Start the visualizer
    modulationVisualizer.start();

    // Listen for connection lifecycle events
    eventBus.on(EventType.CONNECTION_ADDED, (data: any) => {
      if (modulationVisualizer) {
        modulationVisualizer.onConnectionCreated(data);
      }
    });

    eventBus.on(EventType.CONNECTION_REMOVED, (data: any) => {
      if (modulationVisualizer) {
        modulationVisualizer.onConnectionDestroyed(data);
      }
    });

    // Listen for controls recreated event (when components are moved)
    eventBus.on(EventType.CONTROLS_RECREATED, (data: any) => {
      if (modulationVisualizer && data.component) {
        // Re-track all parameters with their new control references
        trackComponentParameters(data.component);
      }
    });

    console.log('✅ ModulationVisualizer initialized and started');
  } catch (error) {
    console.error('Failed to initialize ModulationVisualizer:', error);
    throw error;
  }
}

/**
 * Handle component addition from drag-and-drop
 */
function handleComponentAdd(componentType: string, position: { x: number; y: number}): void {
  if (!canvas) return;

  // Create unique ID
  const id = crypto.randomUUID();

  // Get component-specific dimensions from registry
  const dimensions = componentRegistry.getDimensions(componentType as ComponentType);

  // Create visual component with component-specific dimensions
  const visualComponent = new CanvasComponent(
    id,
    componentType as ComponentType,
    position,
    dimensions.width,
    dimensions.height
  );

  // Create audio component
  const audioComponent = componentRegistry.create(
    componentType as ComponentType,
    id,
    position
  );

  if (audioComponent) {
    // Activate to create audio nodes
    audioComponent.activate();
    visualComponent.setSynthComponent(audioComponent);
    console.log(`✨ Created ${audioComponent.name} at (${Math.round(position.x)}, ${Math.round(position.y)})`);
  }

  // Add to canvas
  canvas.addComponent(visualComponent);

  // Emit component added event for ModulationVisualizer tracking
  eventBus.emit(EventType.COMPONENT_ADDED, {
    component: visualComponent,
  });
}

/**
 * Track all parameters of a component with modulation visualizer
 */
function trackComponentParameters(visualComponent: CanvasComponent): void {
  if (!modulationVisualizer) return;

  const audioComponent = visualComponent.getSynthComponent();
  if (!audioComponent) return;

  // Get all controls from the visual component
  const controls = visualComponent.getControls();
  if (!controls) return;

  // Track each control that has a parameter
  controls.forEach((control: any) => {
    try {
      const parameter = control.getParameter();
      if (parameter && parameter.id) {
        modulationVisualizer!.trackParameter(parameter.id, control);
        console.log(`✓ Tracking parameter "${parameter.name}" (${parameter.id})`);
      }
    } catch (error) {
      // Control doesn't have a parameter (e.g., buttons without parameters)
      // This is expected and not an error
    }
  });
}

/**
 * Setup audio resume on user interaction (Chrome autoplay policy)
 */
function setupAudioResume(): void {
  const resumeAudio = async () => {
    try {
      await audioEngine.resume();
      if (audioEngine.getState() === 'running') {
        updateStatus('Ready - Audio enabled');
        document.removeEventListener('click', resumeAudio);
        document.removeEventListener('keydown', resumeAudio);
        console.log('✅ Audio context resumed');
      }
    } catch (error) {
      console.error('Failed to resume audio:', error);
    }
  };

  // Resume on first user interaction
  document.addEventListener('click', resumeAudio, { once: true });
  document.addEventListener('keydown', resumeAudio, { once: true });
}

/**
 * Add test components to visualize the canvas system
 * (Currently disabled - canvas starts empty)
 */
// @ts-expect-error - Keeping for future testing
function addTestComponents(): void {
  if (!canvas) return;

  // Create visual and audio components for oscillator
  const oscId = crypto.randomUUID();
  const oscVisual = new CanvasComponent(
    oscId,
    ComponentType.OSCILLATOR,
    { x: 100, y: 100 },
    150,
    140
  );
  const oscAudio = componentRegistry.create(ComponentType.OSCILLATOR, oscId, { x: 100, y: 100 });
  if (oscAudio) {
    // Activate to create audio nodes so ports are visible
    oscAudio.activate();
    oscVisual.setSynthComponent(oscAudio);
  }
  canvas.addComponent(oscVisual);

  // Create visual and audio components for VCA
  const vcaId = crypto.randomUUID();
  const vcaVisual = new CanvasComponent(
    vcaId,
    ComponentType.VCA,
    { x: 300, y: 100 },
    150,
    120
  );
  const vcaAudio = componentRegistry.create(ComponentType.VCA, vcaId, { x: 300, y: 100 });
  if (vcaAudio) {
    // Activate to create audio nodes so ports are visible
    vcaAudio.activate();
    // Set VCA gain to 0.5 for moderate volume
    vcaAudio.setParameterValue('gain', 0.5);
    vcaVisual.setSynthComponent(vcaAudio);
  }
  canvas.addComponent(vcaVisual);

  // Create visual and audio components for master output
  const masterOutId = crypto.randomUUID();
  const masterOutVisual = new CanvasComponent(
    masterOutId,
    ComponentType.MASTER_OUTPUT,
    { x: 500, y: 100 },
    150,
    120
  );
  const masterOutAudio = componentRegistry.create(ComponentType.MASTER_OUTPUT, masterOutId, { x: 500, y: 100 });
  if (masterOutAudio) {
    // Activate to create audio nodes so ports are visible
    masterOutAudio.activate();
    masterOutVisual.setSynthComponent(masterOutAudio);
  }
  canvas.addComponent(masterOutVisual);

  console.log('📦 Added test components to canvas with active audio nodes');
  console.log('💡 Tip: Press T to test audio engine with a tone');
  console.log('💡 Tip: Press O to test oscillator component');
  console.log('💡 Visual components show ports and parameters!');
  console.log('💡 Try connecting: Oscillator → VCA → Master Output');
  console.log('');
  console.log('🔌 Connection System Ready:');
  console.log('  • Click an output port (right side) to start a connection');
  console.log('  • Click an input port (left side) to complete the connection');
  console.log('  • Shift+Click a cable to delete it');
  console.log('  • Cables are color-coded: Green=Audio, Blue=CV, Red=Gate');
  console.log('');
  console.log('🎹 Keyboard Ready:');
  console.log('  • Play notes: A S D F G H J K L ; \' (white keys)');
  console.log('  • Play sharps: W E T Y U O P (black keys)');
  console.log('  • Octave down: Z | Octave up: X');
  console.log('  • Sustain pedal: Spacebar');
  console.log('  • Click piano keys or use QWERTY keys to play!');
  console.log('');
  console.log('⚙️  Canvas Controls:');
  console.log('  • Toggle snap-to-grid: ` (backtick)');
  console.log('  • Toggle grid visibility: Shift+` (~)');
  console.log('  • Delete selected component: Delete/Backspace');

  // Add keyboard shortcuts for testing
  window.addEventListener('keydown', (e) => {
    if (e.key === 't' || e.key === 'T') {
      testAudio();
    } else if (e.key === 'o' || e.key === 'O') {
      testOscillatorComponent();
    }
  });
}

/**
 * Test oscillator component (Phase 2 Task 2)
 */
function testOscillatorComponent(): void {
  if (!audioEngine.isReady() || audioEngine.getState() !== 'running') {
    console.log('Audio context not running. Click first to enable audio.');
    return;
  }

  try {
    // Create oscillator component
    const osc = componentRegistry.create(
      ComponentType.OSCILLATOR,
      crypto.randomUUID(),
      { x: 0, y: 0 }
    );

    if (!osc) {
      console.error('Failed to create oscillator component');
      return;
    }

    // Create VCA component
    const vca = componentRegistry.create(
      ComponentType.VCA,
      crypto.randomUUID(),
      { x: 0, y: 0 }
    );

    if (!vca) {
      console.error('Failed to create VCA component');
      return;
    }

    // Create master output
    const masterOut = componentRegistry.create(
      ComponentType.MASTER_OUTPUT,
      crypto.randomUUID(),
      { x: 0, y: 0 }
    );

    if (!masterOut) {
      console.error('Failed to create master output component');
      return;
    }

    // Activate all components
    osc.activate();
    vca.activate();
    masterOut.activate();

    // Set VCA gain for envelope
    vca.setParameterValue('gain', 0);

    // Connect: Oscillator -> VCA -> Master Output
    osc.connectTo(vca);
    vca.connectTo(masterOut);

    console.log('🔊 Testing component chain: Oscillator -> VCA -> Master Out');

    // Create envelope manually for now
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const vcaComponent = vca as any;
    const gainParam = vcaComponent.getGainParam();

    if (gainParam) {
      // Attack
      gainParam.setValueAtTime(0, now);
      gainParam.linearRampToValueAtTime(0.3, now + 0.01);
      // Decay/Release
      gainParam.exponentialRampToValueAtTime(0.001, now + 1.0);
    }

    // Clean up after note
    setTimeout(() => {
      osc.deactivate();
      vca.deactivate();
      masterOut.deactivate();
      console.log('✅ Component test complete');
    }, 1100);

    console.log('✅ Phase 2 Task 2 complete: First working synth components!');
  } catch (error) {
    console.error('Failed to test oscillator component:', error);
  }
}

/**
 * Trigger note on (for keyboard)
 * Triggers all Keyboard components on the canvas with modular routing
 */
function triggerNoteOn(note: number, velocity: number): void {
  if (!audioEngine.isReady() || audioEngine.getState() !== 'running') {
    console.log('Audio context not running. Click first to enable audio.');
    return;
  }

  try {
    const frequency = NoteMapper.midiToFrequency(note);

    // Find all Keyboard components on canvas and trigger them
    if (!canvas) return;
    const components = canvas.getComponents();

    let keyboardCount = 0;
    components.forEach((visualComponent: any) => {
      const audioComponent = visualComponent.getSynthComponent();
      if (!audioComponent) return;

      if (audioComponent.type === ComponentType.KEYBOARD_INPUT) {
        // Trigger the Keyboard component
        const keyboardComponent = audioComponent as any;
        if (keyboardComponent.triggerNoteOn) {
          keyboardComponent.triggerNoteOn(note, frequency, velocity);
          keyboardCount++;
        }
      }
    });

    if (keyboardCount === 0) {
      console.log('💡 No Keyboard components on canvas. Add a Keyboard component to trigger notes!');
    }
  } catch (error) {
    console.error('Failed to trigger note on:', error);
  }
}

/**
 * Trigger note off (for keyboard)
 * Triggers note off on all Keyboard components on the canvas
 */
function triggerNoteOff(note: number): void {
  try {
    // Find all Keyboard components on canvas and trigger note off
    if (!canvas) return;
    const components = canvas.getComponents();

    components.forEach((visualComponent: any) => {
      const audioComponent = visualComponent.getSynthComponent();
      if (!audioComponent) return;

      if (audioComponent.type === ComponentType.KEYBOARD_INPUT) {
        // Trigger note off on the Keyboard component
        const keyboardComponent = audioComponent as any;
        if (keyboardComponent.triggerNoteOff) {
          keyboardComponent.triggerNoteOff(note);
        }
      }
    });
  } catch (error) {
    console.error('Failed to trigger note off:', error);
  }
}

/**
 * Test audio engine with a simple tone
 */
function testAudio(): void {
  if (!audioEngine.isReady()) {
    console.error('Audio engine not ready');
    return;
  }

  if (audioEngine.getState() !== 'running') {
    console.log('Audio context not running. Click first to enable audio.');
    return;
  }

  try {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    // Create test oscillator
    const osc = ctx.createOscillator();
    osc.frequency.value = 440; // A4
    osc.type = 'sine';

    // Create gain node for volume control
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    // Connect nodes
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Start and stop
    osc.start(now);
    osc.stop(now + 0.5);

    console.log('🔊 Playing test tone (440 Hz)');
  } catch (error) {
    console.error('Failed to play test tone:', error);
  }
}

/**
 * Show error message to user
 */
function showError(message: string): void {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; gap: 16px;">
        <h1 style="color: var(--color-error);">Error</h1>
        <p style="color: var(--color-text-secondary);">${message}</p>
        <p style="color: var(--color-text-tertiary); font-size: 12px;">
          Please use a modern browser like Chrome, Firefox, or Safari.
        </p>
      </div>
    `;
  }
}

/**
 * Update status display
 */
function updateStatus(message: string): void {
  const canvasInfo = document.getElementById('canvas-info');
  if (canvasInfo) {
    canvasInfo.textContent = message;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
