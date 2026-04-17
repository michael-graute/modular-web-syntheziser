/**
 * Collider - Musical Physics Simulation Component
 *
 * Generates CV/Gate signals from 2D physics collisions.
 * Combines bouncing ball physics with musical scale mapping.
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType, EventType } from '../../core/types';
import type { GlobalBpmChangedPayload, TempoAware } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { globalBpmController } from '../../core/GlobalBpmController';
import { eventBus } from '../../core/EventBus';
import type {
  ColliderConfig,
  CollisionBoundary,
  Collider as ColliderState,
  CollisionEvent,
  MusicalScale as IMusicalScale,
} from '../../../specs/006-collider-musical-physics/contracts/types';
import {
  ScaleType,
  Note,
  SpeedPreset,
  GateSize,
} from '../../../specs/006-collider-musical-physics/contracts/types';
import { MusicalScale } from '../../music/MusicalScale';
import { PhysicsEngine } from '../../physics/PhysicsEngine';
import { ColliderRenderer } from '../../canvas/ColliderRenderer';
import { TimingCalculator } from '../../timing/TimingCalculator';
import { Vector2D } from '../../physics/Vector2D';
import { selectWeightedScaleDegree } from '../../music/WeightedRandomSelector';
import { SPEED_PRESET_VELOCITIES } from '../../music/ScaleTypes';
import { validateColliderConfig } from '../../../specs/006-collider-musical-physics/contracts/validation';
import { visualUpdateScheduler } from '../../visualization/scheduler';
import type { SubscriptionHandle } from '../../visualization/types';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: ColliderConfig = {
  scaleType: ScaleType.MAJOR,
  rootNote: Note.C,
  colliderCount: 3,
  speedPreset: SpeedPreset.MEDIUM,
  bpm: 120,
  gateSize: GateSize.QUARTER,
};

/**
 * Rendering constants
 */
const BOUNDARY_PADDING = 10;
const COLLIDER_RADIUS = 15;
const MIN_POSITION_SPACING = 40; // Minimum distance between colliders
const MAX_POSITION_ATTEMPTS = 100; // Maximum attempts to find non-overlapping position

/**
 * Color palette for scale degrees
 */
const DEGREE_COLORS = [
  '#FF6B6B', // Red (tonic)
  '#4ECDC4', // Cyan
  '#45B7D1', // Blue
  '#FFA07A', // Light salmon
  '#98D8C8', // Mint (fifth)
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
];

/**
 * Collider Component
 *
 * Simulates colliding circles that trigger musical notes.
 * Each collision generates CV/Gate output based on the collider's assigned note.
 */
export class Collider extends SynthComponent implements TempoAware {
  // Configuration
  private config: ColliderConfig;

  // Simulation state
  private isRunning: boolean = false;
  private colliders: ColliderState[] = [];
  private boundary: CollisionBoundary | null = null;
  private scale: IMusicalScale | null = null;
  private subscription: SubscriptionHandle | null = null;
  private lastUpdateTime: number = 0;

  // Performance optimization: throttle rendering to 30fps, physics capped at 60fps
  private lastRenderTime: number = 0;
  private renderInterval: number = 1000 / 30;
  private physicsInterval: number = 1000 / 60;

  // Engine instances
  private physicsEngine: PhysicsEngine | null = null;
  private renderer: ColliderRenderer | null = null;
  private timingCalculator: TimingCalculator;

  // Audio nodes (matching KeyboardInput naming)
  private frequencyNode: ConstantSourceNode | null = null;
  private gateNode: ConstantSourceNode | null = null;

  // Gate targets (ADSR envelopes that should be triggered)
  private gateTargets: SynthComponent[] = [];

  // Global BPM subscription
  private _globalBpmUnsubscribe: (() => void) | null = null;

  // Canvas reference
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor(id: string, name: string, position: Position) {
    super(id, ComponentType.COLLIDER, name, position);

    // Initialize with default configuration
    this.config = { ...DEFAULT_CONFIG };

    // Create timing calculator
    this.timingCalculator = new TimingCalculator();

    // Add output ports (matching KeyboardInput)
    this.addOutput('frequency', 'Frequency', SignalType.CV);
    this.addOutput('gate', 'Gate', SignalType.GATE);

    // T040: Add scale type parameter (0=Major, 1=Harmonic Minor, 2=Natural Minor, 3=Lydian, 4=Mixolydian)
    this.addParameter('scaleType', 'Scale', 0, 0, 4, 1, '');

    // T041: Add root note parameter (0-11 for C through B)
    this.addParameter('rootNote', 'Root', 0, 0, 11, 1, '');

    // T046: Add collider count parameter (1-20)
    this.addParameter('colliderCount', 'Count', 3, 1, 20, 1, '');

    // Additional parameters for complete configuration
    this.addParameter('speedPreset', 'Speed', 1, 0, 2, 1, ''); // 0=Slow, 1=Medium, 2=Fast
    this.addParameter('bpm', 'BPM', 120, 30, 300, 1, 'bpm');
    this.addParameter('bpmMode', 'BPM Mode', 0, 0, 1, 1, ''); // 0=global, 1=local
    this.addParameter('gateSize', 'Gate', 2, 0, 4, 1, ''); // 0=Whole, 1=Half, 2=Quarter, 3=Eighth, 4=Sixteenth
  }

  /**
   * T028: Get current configuration (immutable)
   */
  getConfiguration(): Readonly<ColliderConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * T028: Set configuration (only when simulation is stopped)
   */
  setConfiguration(newConfig: Partial<ColliderConfig>): void {
    // FR-018: Configuration changes only allowed when stopped
    if (this.isRunning) {
      throw new Error('Cannot change configuration while simulation is running. Stop simulation first.');
    }

    // Merge with current config
    const updatedConfig: ColliderConfig = {
      ...this.config,
      ...newConfig,
    };

    // Validate configuration
    const validation = validateColliderConfig(updatedConfig);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Update config
    this.config = updatedConfig;

    // Recreate scale if scale-related parameters changed
    if (newConfig.scaleType !== undefined || newConfig.rootNote !== undefined) {
      this.updateScale();
    }
  }

  /**
   * T042: Update musical scale
   */
  private updateScale(): void {
    this.scale = new MusicalScale(this.config.scaleType, this.config.rootNote);
  }

  /**
   * T029: Create audio nodes (Frequency and Gate outputs)
   * Matches KeyboardInput behavior exactly
   */
  createAudioNodes(): void {
    if (!audioEngine.isReady()) {
      throw new Error('AudioEngine not initialized');
    }

    const context = audioEngine.getContext();

    // Create frequency output (ConstantSourceNode outputting Hz)
    this.frequencyNode = context.createConstantSource();
    this.frequencyNode.offset.value = 440; // A4 default
    this.frequencyNode.start();
    this.registerAudioNode('frequency', this.frequencyNode);

    // Create gate output (ConstantSourceNode for 0/1 gate signal)
    this.gateNode = context.createConstantSource();
    this.gateNode.offset.value = 0; // Gate off by default
    this.gateNode.start();
    this.registerAudioNode('gate', this.gateNode);

    // Subscribe to global BPM (covers mid-playback add via activate() → createAudioNodes())
    this.subscribeToGlobalBpm();

    console.log(`Collider ${this.id} audio nodes created`);
  }

  /**
   * Cleanup audio nodes
   */
  destroyAudioNodes(): void {
    // Stop simulation if running
    if (this.isRunning) {
      this.stopSimulation();
    }

    // Stop and disconnect frequency node
    if (this.frequencyNode) {
      this.frequencyNode.stop();
      this.frequencyNode.disconnect();
      this.frequencyNode = null;
    }

    // Stop and disconnect gate node
    if (this.gateNode) {
      this.gateNode.stop();
      this.gateNode.disconnect();
      this.gateNode = null;
    }

    this.audioNodes.clear();
    this.unsubscribeFromGlobalBpm();
    console.log(`Collider ${this.id} audio nodes destroyed`);
  }

  // ---------------------------------------------------------------------------
  // Global BPM integration (TempoAware)
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to global BPM changes. Called from createAudioNodes() so it runs
   * whenever the component is activated — including mid-playback canvas adds.
   */
  subscribeToGlobalBpm(): void {
    // Apply current global BPM immediately if in global mode
    if ((this.getParameter('bpmMode')?.getValue() ?? 0) === 0) {
      this.applyGlobalBpm(globalBpmController.getBpm());
    }

    this._globalBpmUnsubscribe = eventBus.on(
      EventType.GLOBAL_BPM_CHANGED,
      (data) => this.applyGlobalBpm((data as GlobalBpmChangedPayload).bpm)
    );
  }

  /**
   * Unsubscribe from global BPM changes. Called from destroyAudioNodes().
   */
  unsubscribeFromGlobalBpm(): void {
    if (this._globalBpmUnsubscribe) {
      this._globalBpmUnsubscribe();
      this._globalBpmUnsubscribe = null;
    }
  }

  /**
   * Apply a new global BPM. Only acts when in global mode (bpmMode=0).
   * Updates config.bpm directly to allow changes during a running simulation
   * (setConfiguration() blocks while running, but a live BPM update is safe
   * because the physics loop reads config.bpm each collision cycle).
   */
  applyGlobalBpm(bpm: number): void {
    if ((this.getParameter('bpmMode')?.getValue() ?? 0) === 0) {
      this.config.bpm = bpm;
      // Keep the parameter value in sync so serialize() round-trips correctly
      const bpmParam = this.getParameter('bpm');
      if (bpmParam) bpmParam.setValue(bpm);
    }
  }

  /**
   * Update audio parameters - converts parameter values to configuration
   */
  updateAudioParameter(parameterId: string, value: number): void {
    // T043, T045: FR-018: Configuration changes only allowed when stopped
    if (this.isRunning) {
      throw new Error('Cannot change parameters while simulation is running. Stop simulation first.');
    }

    // Map parameter IDs to configuration updates
    const updates: Partial<ColliderConfig> = {};

    switch (parameterId) {
      case 'scaleType':
        // T040: Map numeric value to ScaleType enum
        const scaleTypes = [
          ScaleType.MAJOR,
          ScaleType.HARMONIC_MINOR,
          ScaleType.NATURAL_MINOR,
          ScaleType.LYDIAN,
          ScaleType.MIXOLYDIAN,
        ];
        updates.scaleType = scaleTypes[Math.round(value)] || ScaleType.MAJOR;
        break;

      case 'rootNote':
        // T041: Map numeric value to Note enum
        const notes = [
          Note.C, Note.C_SHARP, Note.D, Note.D_SHARP,
          Note.E, Note.F, Note.F_SHARP, Note.G,
          Note.G_SHARP, Note.A, Note.A_SHARP, Note.B,
        ];
        updates.rootNote = notes[Math.round(value)] || Note.C;
        break;

      case 'colliderCount':
        // T046, T048: Update collider count (will be validated)
        updates.colliderCount = Math.round(value);
        break;

      case 'speedPreset':
        const speeds = [SpeedPreset.SLOW, SpeedPreset.MEDIUM, SpeedPreset.FAST];
        updates.speedPreset = speeds[Math.round(value)] || SpeedPreset.MEDIUM;
        break;

      case 'bpm':
        updates.bpm = value;
        break;

      case 'bpmMode':
        // 0 = follow global BPM; adopt current global value immediately.
        // Guard: only when active (not during construction or deserialize).
        if (value === 0 && this.isActive) {
          this.applyGlobalBpm(globalBpmController.getBpm());
        }
        return; // No ColliderConfig field to update

      case 'gateSize':
        const gateSizes = [
          GateSize.WHOLE,
          GateSize.HALF,
          GateSize.QUARTER,
          GateSize.EIGHTH,
          GateSize.SIXTEENTH,
        ];
        updates.gateSize = gateSizes[Math.round(value)] || GateSize.QUARTER;
        break;

      default:
        console.warn(`Unknown parameter: ${parameterId}`);
        return;
    }

    // Apply configuration updates
    try {
      this.setConfiguration(updates);
    } catch (error) {
      console.error(`Failed to update ${parameterId}:`, error);
      throw error;
    }
  }

  /**
   * Check if simulation is currently running
   */
  isSimulationRunning(): boolean {
    return this.isRunning;
  }

  /**
   * T031: Start simulation
   * T078: Comprehensive error handling with try-catch
   */
  startSimulation(): void {
    if (this.isRunning) {
      console.warn('[Collider] Simulation already running');
      return;
    }

    try {
      console.log('[Collider] Starting simulation...', {
        config: this.config,
        hasCanvas: !!this.canvas,
        hasContext: !!this.ctx,
      });

      // Initialize scale
      if (!this.scale) {
        this.updateScale();
      }

      // Initialize canvas and renderer
      if (!this.canvas || !this.ctx) {
        throw new Error('Canvas not initialized. Call setCanvas() first.');
      }

      this.boundary = this.createBoundaryFromCanvas();
      this.renderer = new ColliderRenderer(this.ctx);

      // Initialize physics engine
      this.physicsEngine = new PhysicsEngine();
      this.physicsEngine.setBoundary(this.boundary);

      // T030: Create colliders
      this.initializeColliders();

      // Add colliders to physics engine
      this.colliders.forEach(collider => {
        this.physicsEngine!.addCollider(collider);
      });

      // Subscribe to centralized scheduler
      this.isRunning = true;
      this.lastUpdateTime = performance.now();
      this.subscription = visualUpdateScheduler.onFrame((_deltaMs) => {
        this.animate();
      }, 'Collider');

      console.log('[Collider] Simulation started successfully', {
        colliderCount: this.colliders.length,
        boundary: this.boundary,
      });
    } catch (error) {
      // T078: Error handling with user-friendly message
      console.error('[Collider] Failed to start simulation:', error);
      this.isRunning = false;

      if (error instanceof Error) {
        throw new Error(`Failed to start collider simulation: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * T030: Initialize colliders with random positions and velocities
   */
  private initializeColliders(): void {
    this.colliders = [];

    if (!this.scale || !this.boundary) {
      throw new Error('Scale and boundary must be initialized');
    }

    const scaleLength = this.scale.cvVoltages.length;
    const velocityMagnitude = SPEED_PRESET_VELOCITIES[this.config.speedPreset];

    for (let i = 0; i < this.config.colliderCount; i++) {
      // Generate non-overlapping position
      const position = this.generateNonOverlappingPosition();

      // Generate random velocity
      const angle = Math.random() * Math.PI * 2;
      const velocity = new Vector2D(
        Math.cos(angle) * velocityMagnitude,
        Math.sin(angle) * velocityMagnitude
      );

      // Assign weighted random scale degree
      const scaleDegree = selectWeightedScaleDegree(scaleLength);
      const cvVoltage = this.scale.cvVoltages[scaleDegree] ?? 0;

      // Assign color based on scale degree
      const color = this.generateColorForDegree(scaleDegree);

      // Create collider (convert Vector2D instances to plain objects)
      const collider: ColliderState = {
        id: `collider-${i}`,
        position: { x: position.x, y: position.y },
        velocity: { x: velocity.x, y: velocity.y },
        radius: COLLIDER_RADIUS,
        scaleDegree,
        cvVoltage,
        color,
        mass: 1, // Equal mass for all colliders
      };

      this.colliders.push(collider);
    }
  }

  /**
   * T049: Generate non-overlapping position
   * T083: Edge case handling for boundary size
   */
  private generateNonOverlappingPosition(): Vector2D {
    if (!this.boundary) {
      throw new Error('Boundary not initialized');
    }

    let attempts = 0;

    while (attempts < MAX_POSITION_ATTEMPTS) {
      // Generate random position within boundary
      const x = this.boundary.left + COLLIDER_RADIUS +
        Math.random() * (this.boundary.width - COLLIDER_RADIUS * 2);
      const y = this.boundary.top + COLLIDER_RADIUS +
        Math.random() * (this.boundary.height - COLLIDER_RADIUS * 2);

      const position = new Vector2D(x, y);

      // Check if position overlaps with existing colliders
      const overlaps = this.colliders.some(collider => {
        const distance = position.distanceTo(Vector2D.from(collider.position));
        return distance < MIN_POSITION_SPACING;
      });

      if (!overlaps) {
        return position;
      }

      attempts++;
    }

    // T083: If we couldn't find a non-overlapping position, the boundary is too small
    const availableArea = this.boundary.width * this.boundary.height;
    const requiredArea = this.config.colliderCount * (MIN_POSITION_SPACING * MIN_POSITION_SPACING);
    throw new Error(
      `Could not generate non-overlapping position after ${MAX_POSITION_ATTEMPTS} attempts. ` +
      `Boundary too small (${availableArea.toFixed(0)}px²) for ${this.config.colliderCount} colliders ` +
      `(requires ~${requiredArea.toFixed(0)}px²). Try reducing collider count or increasing canvas size.`
    );
  }

  /**
   * T059: Generate color for scale degree
   */
  private generateColorForDegree(degree: number): string {
    const colorIndex = degree % DEGREE_COLORS.length;
    return DEGREE_COLORS[colorIndex] as string;
  }

  /**
   * T056: Create boundary from canvas dimensions
   */
  private createBoundaryFromCanvas(): CollisionBoundary {
    if (!this.canvas) {
      throw new Error('Canvas not initialized');
    }

    // Use logical dimensions (CSS size) when context is scaled by device pixel ratio
    // The canvas context is scaled by DPR, so we use CSS dimensions for physics calculations
    const logicalWidth = parseInt(this.canvas.style.width) || this.canvas.width;
    const logicalHeight = parseInt(this.canvas.style.height) || this.canvas.height;

    const width = logicalWidth - BOUNDARY_PADDING * 2;
    const height = logicalHeight - BOUNDARY_PADDING * 2;

    return {
      left: BOUNDARY_PADDING,
      top: BOUNDARY_PADDING,
      right: BOUNDARY_PADDING + width,
      bottom: BOUNDARY_PADDING + height,
      width,
      height,
    };
  }

  /**
   * T032: Animation loop
   * Performance: Physics updates at 60fps, rendering throttled to 30fps
   */
  private animate = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastUpdateTime;

    // Cap physics at 60 Hz — prevents 120 Hz displays from doubling physics compute
    if (deltaTime < this.physicsInterval) return;

    this.lastUpdateTime = currentTime;

    // Update physics
    const collisionEvents = this.physicsEngine!.update(deltaTime / 1000); // Convert to seconds

    // Process collision events
    this.processCollisionEvents(collisionEvents);

    // Throttle rendering to 30fps (Performance optimization)
    // Rendering is expensive but physics accuracy is more important
    if (currentTime - this.lastRenderTime >= this.renderInterval) {
      if (this.renderer && this.boundary) {
        this.renderer.render(this.colliders, this.boundary);
      }
      this.lastRenderTime = currentTime;
    }
  };

  /**
   * T055: Process collision events for audio and visual feedback
   * T079: Logging for debugging
   */
  private processCollisionEvents(events: CollisionEvent[]): void {
    if (events.length === 0) return;

    const currentTime = audioEngine.getContext().currentTime;

    for (const event of events) {
      // Find the collider that triggered the event
      const collider = this.colliders.find(c => c.id === event.colliderId);
      if (!collider) {
        console.warn(`[Collider] Event for unknown collider: ${event.colliderId}`);
        continue;
      }

      // T079: Log collision event (can be commented out in production)
      // Uncomment for detailed collision debugging:
      // console.debug('[Collider] Collision event:', {
      //   type: event.type,
      //   colliderId: event.colliderId,
      //   wallSide: event.wallSide,
      //   otherColliderId: event.otherColliderId,
      //   cvVoltage: collider.cvVoltage,
      // });

      // Trigger audio output (Frequency + Gate)
      this.triggerNote(collider.cvVoltage, currentTime);

      // Trigger connected ADSR envelopes (matches KeyboardInput behavior)
      this.triggerGateTargets();

      // Calculate gate duration
      const gateDurationMs = this.timingCalculator.calculateGateDuration(
        this.config.bpm,
        this.config.gateSize
      );
      const gateDurationSeconds = gateDurationMs / 1000;

      // Schedule gate release
      const releaseTime = currentTime + gateDurationSeconds;
      this.releaseGate(releaseTime);

      // Schedule ADSR release
      setTimeout(() => {
        this.releaseGateTargets();
      }, gateDurationMs);

      // Trigger visual flash
      if (this.renderer) {
        this.renderer.flashCollider(collider.id);
      }
    }
  }

  /**
   * Convert CV voltage (1V/octave) to frequency in Hz
   * Reference: C4 (MIDI 60) = 0V = 261.63 Hz
   * Formula: freq = 261.63 * 2^(cv_voltage)
   */
  private cvToFrequency(cvVoltage: number): number {
    const C4_FREQUENCY = 261.63; // Middle C reference frequency
    return C4_FREQUENCY * Math.pow(2, cvVoltage);
  }

  /**
   * T033: Trigger audio output (Frequency + Gate)
   * Matches KeyboardInput behavior exactly
   */
  private triggerNote(cvVoltage: number, scheduleTime: number): void {
    if (!this.frequencyNode || !this.gateNode) return;

    try {
      // Convert CV voltage to frequency in Hz
      const frequencyHz = this.cvToFrequency(cvVoltage);

      // Update frequency output (matches KeyboardInput behavior)
      this.frequencyNode.offset.setValueAtTime(frequencyHz, scheduleTime);

      // Gate on (0 -> 1, matches KeyboardInput behavior)
      this.gateNode.offset.setValueAtTime(1, scheduleTime);

      console.log(`[Collider] Note triggered: ${frequencyHz.toFixed(2)} Hz (CV: ${cvVoltage.toFixed(3)}V)`);
    } catch (error) {
      console.error('[Collider] Failed to trigger note:', error);
    }
  }

  /**
   * Release gate signal
   */
  private releaseGate(scheduleTime: number): void {
    if (!this.gateNode) return;

    try {
      // Gate off (1 -> 0, matches KeyboardInput behavior)
      this.gateNode.offset.setValueAtTime(0, scheduleTime);

      console.log(`[Collider] Gate released`);
    } catch (error) {
      console.error('[Collider] Failed to release gate:', error);
    }
  }

  /**
   * T037: Stop simulation
   * T079: Logging for debugging
   */
  stopSimulation(): void {
    if (!this.isRunning) {
      console.warn('[Collider] Simulation not running');
      return;
    }

    console.log('[Collider] Stopping simulation...');

    // Stop animation loop
    this.isRunning = false;
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }

    // Reset frequency and gate outputs
    const now = audioEngine.getContext().currentTime;

    if (this.frequencyNode) {
      this.frequencyNode.offset.cancelScheduledValues(now);
      this.frequencyNode.offset.setValueAtTime(440, now); // Reset to A4
    }

    if (this.gateNode) {
      this.gateNode.offset.cancelScheduledValues(now);
      this.gateNode.offset.setValueAtTime(0, now); // Gate off
    }

    // Clear physics engine
    if (this.physicsEngine) {
      this.colliders.forEach(collider => {
        this.physicsEngine!.removeCollider(collider.id);
      });
    }

    // Clear colliders
    this.colliders = [];

    // Clear renderer flashes
    if (this.renderer) {
      this.renderer.clearFlashes();
    }

    console.log('[Collider] Simulation stopped');
  }

  /**
   * Set canvas for rendering
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    if (!this.ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }

    // Don't override canvas dimensions - use whatever dimensions were set by the display
    // The display (ColliderDisplay) is responsible for managing canvas size

    // T058: Add resize handling
    window.addEventListener('resize', this.handleCanvasResize);
  }

  /**
   * T058: Handle canvas resize
   */
  private handleCanvasResize = (): void => {
    if (!this.canvas || !this.isRunning) return;

    // Recalculate boundary
    this.boundary = this.createBoundaryFromCanvas();

    // Update physics engine boundary
    if (this.physicsEngine && this.boundary) {
      this.physicsEngine.setBoundary(this.boundary);
    }

    // Clamp collider positions to new boundary
    if (this.boundary) {
      this.colliders.forEach(collider => {
        collider.position.x = Math.max(
          this.boundary!.left + collider.radius,
          Math.min(this.boundary!.right - collider.radius, collider.position.x)
        );
        collider.position.y = Math.max(
          this.boundary!.top + collider.radius,
          Math.min(this.boundary!.bottom - collider.radius, collider.position.y)
        );
      });
    }
  };

  /**
   * Get output node for connections
   */
  getOutputNode(): AudioNode | null {
    // Default to frequency output (matches KeyboardInput)
    return this.frequencyNode;
  }

  /**
   * Get output node by port (matches KeyboardInput)
   */
  protected override getOutputNodeByPort(portId: string): AudioNode | null {
    switch (portId) {
      case 'frequency':
        return this.frequencyNode;
      case 'gate':
        return this.gateNode;
      default:
        return this.frequencyNode; // Default to frequency
    }
  }

  /**
   * Get input node (Collider has no inputs)
   */
  getInputNode(): AudioNode | null {
    return null;
  }

  /**
   * Register a gate target (ADSR envelope) for triggering
   * Called automatically when connecting gate output to an ADSR envelope
   */
  registerGateTarget(target: SynthComponent): void {
    if (!this.gateTargets.includes(target)) {
      this.gateTargets.push(target);
      console.log(`[Collider] Registered gate target: ${target.name} (${target.id})`);
    }
  }

  /**
   * Unregister a gate target
   */
  unregisterGateTarget(target: SynthComponent): void {
    const index = this.gateTargets.indexOf(target);
    if (index !== -1) {
      this.gateTargets.splice(index, 1);
      console.log(`[Collider] Unregistered gate target: ${target.name} (${target.id})`);
    }
  }

  /**
   * Trigger all registered ADSR envelopes
   */
  private triggerGateTargets(): void {
    for (const target of this.gateTargets) {
      // Check if target has triggerGateOn method (ADSR envelope)
      const triggerMethod = (target as any).triggerGateOn;
      if (triggerMethod && typeof triggerMethod === 'function') {
        triggerMethod.call(target);
      }
    }
  }

  /**
   * Release all registered ADSR envelopes
   */
  private releaseGateTargets(): void {
    for (const target of this.gateTargets) {
      // Check if target has triggerGateOff method (ADSR envelope)
      const releaseMethod = (target as any).triggerGateOff;
      if (releaseMethod && typeof releaseMethod === 'function') {
        releaseMethod.call(target);
      }
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // Remove resize listener
    window.removeEventListener('resize', this.handleCanvasResize);

    // Stop simulation
    if (this.isRunning) {
      this.stopSimulation();
    }

    // Ensure subscription is cleaned up
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }

    // Clear gate targets
    this.gateTargets = [];

    // Destroy audio nodes
    this.destroyAudioNodes();
  }
}
