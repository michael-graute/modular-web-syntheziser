/**
 * Collider - Musical Physics Simulation Component
 *
 * Generates CV/Gate signals from 2D physics collisions.
 * Combines bouncing ball physics with musical scale mapping.
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
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
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 300;
const BOUNDARY_PADDING = 10;
const COLLIDER_RADIUS = 15;
const MIN_POSITION_SPACING = 40; // Minimum distance between colliders

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
export class Collider extends SynthComponent {
  // Configuration
  private config: ColliderConfig;

  // Simulation state
  private isRunning: boolean = false;
  private colliders: ColliderState[] = [];
  private boundary: CollisionBoundary | null = null;
  private scale: IMusicalScale | null = null;
  private animationFrameId: number | null = null;
  private lastUpdateTime: number = 0;

  // Engine instances
  private physicsEngine: PhysicsEngine | null = null;
  private renderer: ColliderRenderer | null = null;
  private timingCalculator: TimingCalculator;

  // Audio nodes
  private cvNode: ConstantSourceNode | null = null;
  private gateNode: ConstantSourceNode | null = null;

  // Canvas reference
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor(id: string, name: string, position: Position) {
    super(id, ComponentType.COLLIDER, name, position);

    // Initialize with default configuration
    this.config = { ...DEFAULT_CONFIG };

    // Create timing calculator
    this.timingCalculator = new TimingCalculator();

    // Add CV output port (1V/octave standard)
    this.addOutput('cv', 'CV Out', SignalType.CV);

    // Add Gate output port (0-5V)
    this.addOutput('gate', 'Gate Out', SignalType.GATE);
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
   * T029: Create audio nodes (CV and Gate outputs)
   */
  createAudioNodes(): void {
    const context = audioEngine.getContext();

    // Create CV output (ConstantSourceNode for 1V/octave)
    this.cvNode = context.createConstantSource();
    this.cvNode.offset.value = 0;
    this.cvNode.start();
    this.registerAudioNode('cv', this.cvNode);

    // Create Gate output (ConstantSourceNode for 0-5V envelope)
    this.gateNode = context.createConstantSource();
    this.gateNode.offset.value = 0;
    this.gateNode.start();
    this.registerAudioNode('gate', this.gateNode);
  }

  /**
   * Cleanup audio nodes
   */
  destroyAudioNodes(): void {
    // Stop simulation if running
    if (this.isRunning) {
      this.stopSimulation();
    }

    // Stop and disconnect CV node
    if (this.cvNode) {
      this.cvNode.stop();
      this.cvNode.disconnect();
      this.cvNode = null;
    }

    // Stop and disconnect Gate node
    if (this.gateNode) {
      this.gateNode.stop();
      this.gateNode.disconnect();
      this.gateNode = null;
    }

    this.audioNodes.clear();
  }

  /**
   * Update audio parameters (not used for Collider - configuration-driven)
   */
  updateAudioParameter(parameterId: string, _value: number): void {
    // FR-018: Configuration changes only allowed when stopped
    if (this.isRunning) {
      throw new Error('Cannot change parameters while simulation is running');
    }

    // Collider uses setConfiguration() instead of individual parameters
    console.warn(`Parameter ${parameterId} should be set via setConfiguration()`);
  }

  /**
   * T031: Start simulation
   */
  startSimulation(): void {
    if (this.isRunning) {
      console.warn('Simulation already running');
      return;
    }

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

    // Start animation loop
    this.isRunning = true;
    this.lastUpdateTime = performance.now();
    this.animate();
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
   */
  private generateNonOverlappingPosition(): Vector2D {
    if (!this.boundary) {
      throw new Error('Boundary not initialized');
    }

    const maxAttempts = 100;
    let attempts = 0;

    while (attempts < maxAttempts) {
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

    // If we couldn't find a non-overlapping position, the boundary is too small
    throw new Error('Could not generate non-overlapping position. Boundary too small for collider count.');
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

    const width = this.canvas.width - BOUNDARY_PADDING * 2;
    const height = this.canvas.height - BOUNDARY_PADDING * 2;

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
   */
  private animate = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;

    // Update physics (returns collision events)
    const collisionEvents = this.physicsEngine!.update(deltaTime / 1000); // Convert to seconds

    // Process collision events
    this.processCollisionEvents(collisionEvents);

    // Render scene
    if (this.renderer && this.boundary) {
      this.renderer.render(this.colliders, this.boundary);
    }

    // Continue animation loop
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  /**
   * T055: Process collision events for audio and visual feedback
   */
  private processCollisionEvents(events: CollisionEvent[]): void {
    const currentTime = audioEngine.getContext().currentTime;

    for (const event of events) {
      // Find the collider that triggered the event
      const collider = this.colliders.find(c => c.id === event.colliderId);
      if (!collider) continue;

      // Trigger audio output
      this.triggerNote(collider.cvVoltage, currentTime);

      // Trigger visual flash
      if (this.renderer) {
        this.renderer.flashCollider(collider.id);
      }
    }
  }

  /**
   * T033: Trigger audio output (CV + Gate)
   */
  private triggerNote(cvVoltage: number, scheduleTime: number): void {
    if (!this.cvNode || !this.gateNode) return;

    const gateDuration = this.timingCalculator.calculateGateDuration(
      this.config.bpm,
      this.config.gateSize
    ) / 1000; // Convert to seconds

    const rampTime = 0.01; // 10ms ramp to prevent clicks

    // Schedule CV change (exponential ramp to prevent clicks)
    this.cvNode.offset.cancelScheduledValues(scheduleTime);
    this.cvNode.offset.setValueAtTime(this.cvNode.offset.value, scheduleTime);
    this.cvNode.offset.exponentialRampToValueAtTime(
      cvVoltage + 0.001, // Add small offset to prevent zero in exponential ramp
      scheduleTime + rampTime
    );

    // Schedule Gate envelope (0V → 5V → 0V)
    this.gateNode.offset.cancelScheduledValues(scheduleTime);
    this.gateNode.offset.setValueAtTime(0, scheduleTime);
    this.gateNode.offset.linearRampToValueAtTime(5, scheduleTime + rampTime);
    this.gateNode.offset.linearRampToValueAtTime(5, scheduleTime + gateDuration - rampTime);
    this.gateNode.offset.linearRampToValueAtTime(0, scheduleTime + gateDuration);
  }

  /**
   * T037: Stop simulation
   */
  stopSimulation(): void {
    if (!this.isRunning) {
      console.warn('Simulation not running');
      return;
    }

    // Stop animation loop
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Reset CV/Gate outputs to 0V
    if (this.cvNode) {
      const now = audioEngine.getContext().currentTime;
      this.cvNode.offset.cancelScheduledValues(now);
      this.cvNode.offset.setValueAtTime(0, now);
    }

    if (this.gateNode) {
      const now = audioEngine.getContext().currentTime;
      this.gateNode.offset.cancelScheduledValues(now);
      this.gateNode.offset.setValueAtTime(0, now);
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

    // Set canvas dimensions
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

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
    // Default to CV output
    return this.cvNode;
  }

  /**
   * Get output node by port
   */
  protected override getOutputNodeByPort(portId: string): AudioNode | null {
    if (portId === 'cv') {
      return this.cvNode;
    } else if (portId === 'gate') {
      return this.gateNode;
    }
    return null;
  }

  /**
   * Get input node (Collider has no inputs)
   */
  getInputNode(): AudioNode | null {
    return null;
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

    // Destroy audio nodes
    this.destroyAudioNodes();
  }
}
