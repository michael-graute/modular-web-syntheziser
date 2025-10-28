/**
 * SequencerDisplay - UI for 16-step sequencer
 */

import type { StepSequencer } from '../../components/utilities/StepSequencer';
import { Button } from '../controls/Button';

/**
 * Display renderer for step sequencer
 */
export class SequencerDisplay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sequencer: StepSequencer;
  private animationFrame: number | null;
  private selectedStep: number = -1;
  private baseX: number;
  private baseY: number;
  private baseWidth: number;
  private baseHeight: number;

  // Transport control buttons
  private playStopButton: Button;
  private resetButton: Button;

  // UI layout constants
  private readonly GRID_MARGIN = 5;
  private readonly STEP_WIDTH = 16;
  private readonly STEP_HEIGHT = 40;
  private readonly STEP_GAP = 2;
  private readonly EDITOR_HEIGHT = 60;
  private readonly BUTTON_HEIGHT = 24;
  private readonly BUTTON_GAP = 5;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    sequencer: StepSequencer
  ) {
    this.sequencer = sequencer;
    this.animationFrame = null;
    this.baseX = x;
    this.baseY = y;
    this.baseWidth = width;
    this.baseHeight = height;

    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = `${x}px`;
    this.canvas.style.top = `${y}px`;
    this.canvas.style.backgroundColor = '#1a1a1a';
    this.canvas.style.border = '1px solid #444';
    this.canvas.style.transformOrigin = '0 0';

    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D context for sequencer display');
    }
    this.ctx = context;

    // Create transport control buttons
    const buttonWidth = 60;
    const buttonY = 0;

    this.playStopButton = new Button(
      this.GRID_MARGIN,
      buttonY,
      buttonWidth,
      this.BUTTON_HEIGHT,
      'Play',
      () => this.togglePlayStop(),
      () => this.sequencer.getIsPlaying()
    );

    this.resetButton = new Button(
      this.GRID_MARGIN + buttonWidth + this.BUTTON_GAP,
      buttonY,
      buttonWidth,
      this.BUTTON_HEIGHT,
      'Reset',
      () => this.sequencer.reset()
    );

    // Add event listeners
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));

    // Start animation loop
    this.startAnimation();
  }

  /**
   * Start animation loop
   */
  private startAnimation(): void {
    const animate = () => {
      this.render();
      this.animationFrame = requestAnimationFrame(animate);
    };
    animate();
  }

  /**
   * Stop animation loop
   */
  private stopAnimation(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Main render method
   */
  private render(): void {
    // Clear canvas
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Render transport control buttons
    this.renderTransportControls();

    // Render step grid
    this.renderStepGrid();

    // Render step editor if step is selected
    if (this.selectedStep >= 0) {
      this.renderStepEditor();
    }
  }

  /**
   * Render transport control buttons
   */
  private renderTransportControls(): void {
    // Update play/stop button label
    const isPlaying = this.sequencer.getIsPlaying();
    this.playStopButton = new Button(
      this.GRID_MARGIN,
      0,
      60,
      this.BUTTON_HEIGHT,
      isPlaying ? 'Stop' : 'Play',
      () => this.togglePlayStop(),
      () => this.sequencer.getIsPlaying()
    );

    this.playStopButton.render(this.ctx);
    this.resetButton.render(this.ctx);
  }

  /**
   * Render 16-step grid
   */
  private renderStepGrid(): void {
    const steps = this.sequencer.getSteps();
    const currentStep = this.sequencer.getCurrentStep();
    const isPlaying = this.sequencer.getIsPlaying();

    const startX = this.GRID_MARGIN;
    const startY = this.BUTTON_HEIGHT + this.BUTTON_GAP + this.GRID_MARGIN;

    for (let i = 0; i < 16; i++) {
      const step = steps[i];
      if (!step) continue;

      const x = startX + i * (this.STEP_WIDTH + this.STEP_GAP);
      const y = startY;

      // Draw step background
      if (isPlaying && i === currentStep) {
        // Current playing step - bright highlight
        this.ctx.fillStyle = '#4a9eff';
      } else if (step.active) {
        // Active step
        this.ctx.fillStyle = '#3a3a3a';
      } else {
        // Inactive step
        this.ctx.fillStyle = '#252525';
      }

      this.ctx.fillRect(x, y, this.STEP_WIDTH, this.STEP_HEIGHT);

      // Draw step border
      if (i === this.selectedStep) {
        this.ctx.strokeStyle = '#ffaa00';
        this.ctx.lineWidth = 2;
      } else {
        this.ctx.strokeStyle = '#555555';
        this.ctx.lineWidth = 1;
      }
      this.ctx.strokeRect(x, y, this.STEP_WIDTH, this.STEP_HEIGHT);

      // Draw velocity bar
      if (step.active) {
        const velHeight = this.STEP_HEIGHT * step.velocity;
        this.ctx.fillStyle = '#00ff88';
        this.ctx.fillRect(
          x + 2,
          y + this.STEP_HEIGHT - velHeight - 2,
          this.STEP_WIDTH - 4,
          velHeight
        );
      }

      // Draw step number
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '8px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(`${i + 1}`, x + this.STEP_WIDTH / 2, y + 2);
    }
  }

  /**
   * Render step editor for selected step
   */
  private renderStepEditor(): void {
    if (this.selectedStep < 0 || this.selectedStep >= 16) return;

    const steps = this.sequencer.getSteps();
    const step = steps[this.selectedStep];
    if (!step) return;

    const editorY = this.BUTTON_HEIGHT + this.BUTTON_GAP + this.GRID_MARGIN + this.STEP_HEIGHT + 10;
    const editorX = this.GRID_MARGIN;
    const editorWidth = this.canvas.width - this.GRID_MARGIN * 2;

    // Background
    this.ctx.fillStyle = '#2a2a2a';
    this.ctx.fillRect(editorX, editorY, editorWidth, this.EDITOR_HEIGHT);

    // Border
    this.ctx.strokeStyle = '#555555';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(editorX, editorY, editorWidth, this.EDITOR_HEIGHT);

    // Title
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '10px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(
      `Step ${this.selectedStep + 1}`,
      editorX + 5,
      editorY + 5
    );

    // Note name with up/down buttons
    const noteName = this.midiToNoteName(step.note);
    this.ctx.fillStyle = '#aaaaaa';
    this.ctx.fillText(
      `Note: ${noteName}`,
      editorX + 5,
      editorY + 20
    );

    // Note up button
    const noteUpX = editorX + 55;
    const noteUpY = editorY + 18;
    const buttonSize = 12;
    this.ctx.fillStyle = '#3a3a3a';
    this.ctx.fillRect(noteUpX, noteUpY, buttonSize, buttonSize);
    this.ctx.strokeStyle = '#606060';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(noteUpX, noteUpY, buttonSize, buttonSize);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '10px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('+', noteUpX + buttonSize / 2, noteUpY + buttonSize / 2);

    // Note down button
    const noteDownX = noteUpX + buttonSize + 2;
    this.ctx.fillStyle = '#3a3a3a';
    this.ctx.fillRect(noteDownX, noteUpY, buttonSize, buttonSize);
    this.ctx.strokeStyle = '#606060';
    this.ctx.strokeRect(noteDownX, noteUpY, buttonSize, buttonSize);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText('-', noteDownX + buttonSize / 2, noteUpY + buttonSize / 2);

    // Octave up button
    const octaveUpX = noteDownX + buttonSize + 8;
    this.ctx.fillStyle = '#3a3a3a';
    this.ctx.fillRect(octaveUpX, noteUpY, buttonSize, buttonSize);
    this.ctx.strokeStyle = '#606060';
    this.ctx.strokeRect(octaveUpX, noteUpY, buttonSize, buttonSize);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText('↑', octaveUpX + buttonSize / 2, noteUpY + buttonSize / 2);

    // Octave down button
    const octaveDownX = octaveUpX + buttonSize + 2;
    this.ctx.fillStyle = '#3a3a3a';
    this.ctx.fillRect(octaveDownX, noteUpY, buttonSize, buttonSize);
    this.ctx.strokeStyle = '#606060';
    this.ctx.strokeRect(octaveDownX, noteUpY, buttonSize, buttonSize);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText('↓', octaveDownX + buttonSize / 2, noteUpY + buttonSize / 2);

    // Velocity
    const velPercent = Math.round(step.velocity * 100);
    this.ctx.fillText(
      `Vel: ${velPercent}%`,
      editorX + 5,
      editorY + 35
    );

    // Gate length with up/down buttons
    const gateNames = ['Tied', '1/1', '1/2', '1/4', '1/8', '1/16'];
    const gateName = gateNames[step.gateLength] || '?';
    this.ctx.fillText(
      `Gate: ${gateName}`,
      editorX + 90,
      editorY + 35
    );

    // Gate up button
    const gateUpX = editorX + 145;
    const gateUpY = editorY + 33;
    this.ctx.fillStyle = '#3a3a3a';
    this.ctx.fillRect(gateUpX, gateUpY, buttonSize, buttonSize);
    this.ctx.strokeStyle = '#606060';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(gateUpX, gateUpY, buttonSize, buttonSize);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '10px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('+', gateUpX + buttonSize / 2, gateUpY + buttonSize / 2);

    // Gate down button
    const gateDownX = gateUpX + buttonSize + 2;
    this.ctx.fillStyle = '#3a3a3a';
    this.ctx.fillRect(gateDownX, gateUpY, buttonSize, buttonSize);
    this.ctx.strokeStyle = '#606060';
    this.ctx.strokeRect(gateDownX, gateUpY, buttonSize, buttonSize);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText('-', gateDownX + buttonSize / 2, gateUpY + buttonSize / 2);

    // Active toggle indicator
    this.ctx.fillStyle = step.active ? '#00ff88' : '#ff4444';
    this.ctx.fillRect(
      editorX + editorWidth - 15,
      editorY + 5,
      10,
      10
    );
  }

  /**
   * Convert MIDI note to note name
   */
  private midiToNoteName(note: number): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(note / 12) - 1;
    const noteName = noteNames[note % 12];
    return `${noteName}${octave}`;
  }

  /**
   * Handle canvas click
   */
  private handleClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if click is on transport buttons
    if (this.playStopButton.handleClick(x, y)) {
      return;
    }
    if (this.resetButton.handleClick(x, y)) {
      return;
    }

    // Check if click is in step editor (if a step is selected)
    if (this.selectedStep >= 0) {
      const editorY = this.BUTTON_HEIGHT + this.BUTTON_GAP + this.GRID_MARGIN + this.STEP_HEIGHT + 10;
      const editorX = this.GRID_MARGIN;

      if (y >= editorY && y <= editorY + this.EDITOR_HEIGHT) {
        // Click is in step editor area
        if (this.handleStepEditorClick(x, y, editorX, editorY)) {
          return;
        }
      }
    }

    // Check if click is in step grid
    const startX = this.GRID_MARGIN;
    const startY = this.BUTTON_HEIGHT + this.BUTTON_GAP + this.GRID_MARGIN;

    for (let i = 0; i < 16; i++) {
      const stepX = startX + i * (this.STEP_WIDTH + this.STEP_GAP);
      const stepY = startY;

      if (
        x >= stepX &&
        x <= stepX + this.STEP_WIDTH &&
        y >= stepY &&
        y <= stepY + this.STEP_HEIGHT
      ) {
        // Clicked on step i
        if (this.selectedStep === i) {
          // Double-click behavior: toggle step active
          const steps = this.sequencer.getSteps();
          const step = steps[i];
          if (step) {
            this.sequencer.updateStep(i, { active: !step.active });
          }
        } else {
          // Select step
          this.selectedStep = i;
        }
        return;
      }
    }
  }

  /**
   * Handle clicks in the step editor area
   */
  private handleStepEditorClick(x: number, y: number, editorX: number, editorY: number): boolean {
    const steps = this.sequencer.getSteps();
    const step = steps[this.selectedStep];
    if (!step) return false;

    const noteUpX = editorX + 55;
    const noteUpY = editorY + 18;
    const buttonSize = 12;

    // Note up button
    if (x >= noteUpX && x <= noteUpX + buttonSize && y >= noteUpY && y <= noteUpY + buttonSize) {
      const newNote = Math.min(127, step.note + 1);
      this.sequencer.updateStep(this.selectedStep, { note: newNote });
      return true;
    }

    // Note down button
    const noteDownX = noteUpX + buttonSize + 2;
    if (x >= noteDownX && x <= noteDownX + buttonSize && y >= noteUpY && y <= noteUpY + buttonSize) {
      const newNote = Math.max(0, step.note - 1);
      this.sequencer.updateStep(this.selectedStep, { note: newNote });
      return true;
    }

    // Octave up button
    const octaveUpX = noteDownX + buttonSize + 8;
    if (x >= octaveUpX && x <= octaveUpX + buttonSize && y >= noteUpY && y <= noteUpY + buttonSize) {
      const newNote = Math.min(127, step.note + 12);
      this.sequencer.updateStep(this.selectedStep, { note: newNote });
      return true;
    }

    // Octave down button
    const octaveDownX = octaveUpX + buttonSize + 2;
    if (x >= octaveDownX && x <= octaveDownX + buttonSize && y >= noteUpY && y <= noteUpY + buttonSize) {
      const newNote = Math.max(0, step.note - 12);
      this.sequencer.updateStep(this.selectedStep, { note: newNote });
      return true;
    }

    // Gate up button
    const gateUpX = editorX + 145;
    const gateUpY = editorY + 33;
    if (x >= gateUpX && x <= gateUpX + buttonSize && y >= gateUpY && y <= gateUpY + buttonSize) {
      // Gate length: 0=Tied, 1=1/1, 2=1/2, 3=1/4, 4=1/8, 5=1/16
      const newGateLength = Math.min(5, step.gateLength + 1);
      this.sequencer.updateStep(this.selectedStep, { gateLength: newGateLength });
      return true;
    }

    // Gate down button
    const gateDownX = gateUpX + buttonSize + 2;
    if (x >= gateDownX && x <= gateDownX + buttonSize && y >= gateUpY && y <= gateUpY + buttonSize) {
      const newGateLength = Math.max(0, step.gateLength - 1);
      this.sequencer.updateStep(this.selectedStep, { gateLength: newGateLength });
      return true;
    }

    return false;
  }

  /**
   * Handle mouse move for button hover states
   */
  private handleMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.playStopButton.handleMouseMove(x, y);
    this.resetButton.handleMouseMove(x, y);
  }

  /**
   * Toggle play/stop state
   */
  private togglePlayStop(): void {
    if (this.sequencer.getIsPlaying()) {
      this.sequencer.stop();
    } else {
      this.sequencer.start();
    }
  }

  /**
   * Update position when component moves
   */
  updatePosition(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
    this.canvas.style.left = `${x}px`;
    this.canvas.style.top = `${y}px`;
  }

  /**
   * Update viewport transform (zoom and pan)
   */
  updateViewportTransform(zoom: number, panX: number, panY: number): void {
    const screenX = this.baseX * zoom + panX;
    const screenY = this.baseY * zoom + panY;

    this.canvas.style.left = `${screenX}px`;
    this.canvas.style.top = `${screenY}px`;
    this.canvas.style.transform = `scale(${zoom})`;
    this.canvas.width = this.baseWidth;
    this.canvas.height = this.baseHeight;
  }

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Get selected step index
   */
  getSelectedStep(): number {
    return this.selectedStep;
  }

  /**
   * Set selected step
   */
  setSelectedStep(step: number): void {
    this.selectedStep = step;
  }

  /**
   * Destroy display and clean up
   */
  destroy(): void {
    this.stopAnimation();
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }
}
