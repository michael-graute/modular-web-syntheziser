/**
 * StepSequencerDisplay - Draws the step sequencer UI directly onto the main canvas context.
 *
 * Follows the OscilloscopeDisplay / ChordFinderDisplay pattern: no overlay DOM element,
 * draws at world coordinates in the main CanvasRenderingContext2D render pass.
 *
 * Feature: 012-step-sequencer-refactor
 */

import type { StepSequencer } from '../../components/utilities/StepSequencer';
import type { NotePickerState, StepSequencerDisplayState } from '../../../specs/012-step-sequencer-refactor/contracts/types';
import {
  NOTE_NAMES,
  encodeMidiNote,
  decodeArpOffset,
  encodeArpOffset,
  SEQUENCER_MODE,
} from '../../../specs/012-step-sequencer-refactor/contracts/types';
import { Parameter } from '../../components/base/Parameter';
import { Knob } from '../controls/Knob';
import { Dropdown, type DropdownOption } from '../controls/Dropdown';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const TRANSPORT_BAR_HEIGHT = 52;
const STEP_CELL_HEIGHT = 148;
export const SEQUENCER_DISPLAY_HEIGHT = TRANSPORT_BAR_HEIGHT + STEP_CELL_HEIGHT;

const TRANSPORT_BUTTON_WIDTH = 48;
const TRANSPORT_BUTTON_HEIGHT = 22;
const TRANSPORT_BUTTON_MARGIN = 4;
const RESET_BUTTON_WIDTH = 44;
const MODE_BUTTON_WIDTH = 36;
const TRANSPORT_KNOB_SIZE = 22;
const TRANSPORT_DIV_DROPDOWN_WIDTH = 40;
const TRANSPORT_DIV_DROPDOWN_HEIGHT = 14;
const TRANSPORT_CTRL_GAP = 4;
const MODE_BUTTON_GAP = 6;
const LOCAL_BPM_BUTTON_WIDTH = 44;
const LOCAL_BPM_BUTTON_GAP = 6;

// Sub-region vertical offsets within a step cell (relative to cell top)
// Total cell height = 148px: padding(6) + indicator(10) + note(28) + velocity(76) + gate(24) + bottom padding(4)
const CELL_TOP_PADDING = 6;          // gap between cell border and first element
const ACTIVE_INDICATOR_BOTTOM = 10;  // 0–10px: active indicator dot (relative to content start)
const NOTE_LABEL_BOTTOM = 38;        // 10–38px: note label (more breathing room)
const VELOCITY_KNOB_BOTTOM = 114;    // 38–114px: velocity bar (tall zone)
const GATE_DROPDOWN_BOTTOM = 138;    // 114–138px: gate dropdown
const VELOCITY_KNOB_SIZE = 20;       // small knob diameter
const ACTIVE_INDICATOR_RADIUS = 3;   // radius of the active-step circle
const NOTE_PICKER_PANEL_HEIGHT = 26; // height of the floating note-picker panel

// Gate length label map (for inline cell rendering)
const GATE_LABELS: Record<number, string> = {
  0: 'Tied', 1: '1/1', 2: '1/2', 3: '1/4', 4: '1/8', 5: '1/16',
};

// Gate length options shared across all gate dropdowns
const GATE_OPTIONS: DropdownOption[] = [
  { value: 0, label: 'Tied' },
  { value: 1, label: '1/1' },
  { value: 2, label: '1/2' },
  { value: 3, label: '1/4' },
  { value: 4, label: '1/8' },
  { value: 5, label: '1/16' },
];

// Note division options for the transport dropdown
const NOTE_DIV_OPTIONS: DropdownOption[] = [
  { value: 0, label: '1/1' },
  { value: 1, label: '1/2' },
  { value: 2, label: '1/4' },
  { value: 3, label: '1/8' },
  { value: 4, label: '1/16' },
  { value: 5, label: '1/32' },
];

// ---------------------------------------------------------------------------
// StepSequencerDisplay
// ---------------------------------------------------------------------------

/**
 * Display renderer for the step sequencer.
 * Draws directly on the main canvas — no HTML element owned.
 */
export class StepSequencerDisplay {
  protected sequencer: StepSequencer;
  private baseX: number;
  private baseY: number;
  private baseWidth: number;

  // Note picker state (-1 stepIndex = closed)
  protected notePickerState: NotePickerState = { stepIndex: -1, noteNameIndex: 0, octave: 4 };

  // Per-step controls: 16 velocity knobs + 16 gate dropdowns
  private velocityParams: Parameter[];
  private velocityKnobs: Knob[];
  private gateLengthParams: Parameter[];
  private gateDropdowns: Dropdown[];

  // Transport controls
  private bpmParam: Parameter;
  private bpmKnob: Knob;
  private noteDivParam: Parameter;
  private noteDivDropdown: Dropdown;
  private seqLenParam: Parameter;
  private seqLenKnob: Knob;

  // Note picker dropdowns (created on-demand)
  private noteNameDropdown: Dropdown | null = null;
  private noteOctaveDropdown: Dropdown | null = null;
  private noteNameParam: Parameter | null = null;
  private noteOctaveParam: Parameter | null = null;

  // Active knob drag tracking
  private activeKnobIndex: number = -1;
  // Transport knob drag tracking (-1 = none, 0 = bpm, 1 = seqLen)
  private activeTransportKnob: number = -1;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    sequencer: StepSequencer
  ) {
    this.sequencer = sequencer;
    this.baseX = x;
    this.baseY = y;
    this.baseWidth = width;
    void height; // height fixed by SEQUENCER_DISPLAY_HEIGHT constant

    // Build per-step parameter + control arrays
    this.velocityParams = [];
    this.velocityKnobs = [];
    this.gateLengthParams = [];
    this.gateDropdowns = [];

    for (let i = 0; i < 16; i++) {
      // Velocity parameter (0–1, default 0.8)
      const velParam = new Parameter(`vel_${i}`, 'Vel', 0.8, 0, 1, 0.01, '');
      this.velocityParams.push(velParam);
      this.velocityKnobs.push(new Knob(x, y, VELOCITY_KNOB_SIZE, velParam));

      // Gate length parameter (0–5, default 3)
      const gateParam = new Parameter(`gate_${i}`, 'Gate', 3, 0, 5, 1, '');
      this.gateLengthParams.push(gateParam);
      this.gateDropdowns.push(
        new Dropdown(x, y, 30, 14, gateParam, GATE_OPTIONS, '')
      );
    }

    this.syncParamsFromSteps();

    // Build transport controls — mirror the sequencer's actual parameter ranges
    this.bpmParam = new Parameter('transport_bpm', 'BPM', 120, 30, 300, 1, '');
    this.bpmKnob = new Knob(x, y, TRANSPORT_KNOB_SIZE, this.bpmParam);
    this.bpmKnob.setShowLabel(false); // label drawn manually to match Div style

    this.noteDivParam = new Parameter('transport_noteDiv', 'Div', 2, 0, 5, 1, '');
    this.noteDivDropdown = new Dropdown(x, y, TRANSPORT_DIV_DROPDOWN_WIDTH, TRANSPORT_DIV_DROPDOWN_HEIGHT, this.noteDivParam, NOTE_DIV_OPTIONS, '');

    this.seqLenParam = new Parameter('transport_seqLen', 'Len', 16, 2, 16, 1, '');
    this.seqLenKnob = new Knob(x, y, TRANSPORT_KNOB_SIZE, this.seqLenParam);
    this.seqLenKnob.setShowLabel(false); // label drawn manually to match Div style
  }

  // ---------------------------------------------------------------------------
  // Parameter ↔ step/transport synchronisation
  // ---------------------------------------------------------------------------

  /**
   * Sync transport Parameter instances from the sequencer's live parameter values.
   * Called before rendering so knobs/dropdowns reflect current state.
   */
  private syncTransportParams(state: StepSequencerDisplayState): void {
    this.bpmParam.setValue(state.pattern.bpm);
    this.noteDivParam.setValue(state.pattern.noteValue);
    this.seqLenParam.setValue(state.pattern.sequenceLength);
  }

  /**
   * Position transport controls (BPM knob, Div dropdown, Len knob) within the transport bar.
   * Must be called each frame after syncTransportParams so positions track component moves.
   */
  private positionTransportControls(): void {
    const x = this.baseX;
    const y = this.baseY;
    const btnY = y + (TRANSPORT_BAR_HEIGHT - TRANSPORT_BUTTON_HEIGHT) / 2;

    // After Play and Reset buttons
    let ctrlX = x + TRANSPORT_BUTTON_MARGIN
      + TRANSPORT_BUTTON_WIDTH + TRANSPORT_BUTTON_MARGIN
      + 44 + TRANSPORT_BUTTON_MARGIN * 2;

    // BPM knob, centred vertically in transport bar
    const knobY = y + Math.floor((TRANSPORT_BAR_HEIGHT - TRANSPORT_KNOB_SIZE) / 2);
    this.bpmKnob.setPosition(ctrlX, knobY);
    ctrlX += TRANSPORT_KNOB_SIZE + TRANSPORT_CTRL_GAP;

    // Division dropdown, centred vertically
    const ddY = y + Math.floor((TRANSPORT_BAR_HEIGHT - TRANSPORT_DIV_DROPDOWN_HEIGHT) / 2);
    this.noteDivDropdown.setPosition(ctrlX, ddY);
    ctrlX += TRANSPORT_DIV_DROPDOWN_WIDTH + TRANSPORT_CTRL_GAP;

    // Sequence length knob
    this.seqLenKnob.setPosition(ctrlX, knobY);
    void btnY; // btnY referenced implicitly through the layout above
  }

  /**
   * Sync velocity and gate parameter instances from current step state.
   * Called before rendering each frame to keep controls in sync.
   */
  private syncParamsFromSteps(): void {
    const steps = this.sequencer.getSteps();
    for (let i = 0; i < 16; i++) {
      const step = steps[i];
      if (!step) continue;
      this.velocityParams[i]!.setValue(step.velocity);
      this.gateLengthParams[i]!.setValue(step.gateLength);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  /**
   * Draw the step sequencer UI onto the main canvas context.
   * Called every frame by CanvasComponent.render().
   */
  render(ctx: CanvasRenderingContext2D): void {
    const state = this.sequencer.getDisplayState();
    this.syncParamsFromSteps();
    this.syncTransportParams(state);
    this.positionTransportControls();
    this.positionStepControls(state);

    ctx.save();

    // Background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(this.baseX, this.baseY, this.baseWidth, SEQUENCER_DISPLAY_HEIGHT);

    // Border
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.baseX, this.baseY, this.baseWidth, SEQUENCER_DISPLAY_HEIGHT);

    this.renderTransportBar(ctx, state);
    this.renderStepGrid(ctx, state);

    ctx.restore();
  }

  /**
   * Render the transport control row (Play/Stop, Reset, BPM knob, Div dropdown, Len knob, Mode toggle).
   */
  private renderTransportBar(ctx: CanvasRenderingContext2D, state: StepSequencerDisplayState): void {
    const x = this.baseX;
    const y = this.baseY;

    // Transport bar background
    ctx.fillStyle = '#252525';
    ctx.fillRect(x, y, this.baseWidth, TRANSPORT_BAR_HEIGHT);

    // Separator line
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + TRANSPORT_BAR_HEIGHT);
    ctx.lineTo(x + this.baseWidth, y + TRANSPORT_BAR_HEIGHT);
    ctx.stroke();

    const btnY = y + (TRANSPORT_BAR_HEIGHT - TRANSPORT_BUTTON_HEIGHT) / 2;
    let btnX = x + TRANSPORT_BUTTON_MARGIN;

    // Play/Stop button
    const isPlaying = state.transport.isPlaying;
    this.drawTransportButton(ctx, btnX, btnY, TRANSPORT_BUTTON_WIDTH, TRANSPORT_BUTTON_HEIGHT,
      isPlaying ? 'Stop' : 'Play', isPlaying ? '#c0392b' : '#27ae60');
    btnX += TRANSPORT_BUTTON_WIDTH + TRANSPORT_BUTTON_MARGIN;

    // Reset button
    this.drawTransportButton(ctx, btnX, btnY, RESET_BUTTON_WIDTH, TRANSPORT_BUTTON_HEIGHT, 'Reset', '#555555');
    btnX += RESET_BUTTON_WIDTH + TRANSPORT_BUTTON_MARGIN * 2;

    // BPM knob + small label (greyed out when following global BPM)
    const knobY = y + Math.floor((TRANSPORT_BAR_HEIGHT - TRANSPORT_KNOB_SIZE) / 2);
    const isLocalBpmMode = (this.sequencer.getParameter('bpmMode')?.getValue() ?? 0) === 1;
    this.renderTransportLabel(ctx, btnX, knobY - 1, isLocalBpmMode ? 'BPM' : 'BPM↑');
    this.bpmKnob.render(ctx);
    if (!isLocalBpmMode) {
      // Overlay a semi-transparent mask to indicate the knob is driven by global BPM
      ctx.fillStyle = 'rgba(37, 37, 37, 0.6)';
      ctx.beginPath();
      ctx.arc(btnX + TRANSPORT_KNOB_SIZE / 2, knobY + TRANSPORT_KNOB_SIZE / 2, TRANSPORT_KNOB_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    btnX += TRANSPORT_KNOB_SIZE + TRANSPORT_CTRL_GAP;

    // Division dropdown + label
    const ddY = y + Math.floor((TRANSPORT_BAR_HEIGHT - TRANSPORT_DIV_DROPDOWN_HEIGHT) / 2);
    this.renderTransportLabel(ctx, btnX, ddY - 1, 'Div');
    this.noteDivDropdown.render(ctx);
    btnX += TRANSPORT_DIV_DROPDOWN_WIDTH + TRANSPORT_CTRL_GAP;

    // Sequence length knob + small label
    this.renderTransportLabel(ctx, btnX, knobY - 1, 'Len');
    this.seqLenKnob.render(ctx);
    btnX += TRANSPORT_KNOB_SIZE + MODE_BUTTON_GAP;

    // Mode toggle button
    const isArp = state.pattern.mode === SEQUENCER_MODE.ARPEGGIATOR;
    const modeColor = isArp ? '#8b5cf6' : '#374151';
    this.drawTransportButton(ctx, btnX, btnY, MODE_BUTTON_WIDTH, TRANSPORT_BUTTON_HEIGHT,
      isArp ? 'ARP' : 'SEQ', modeColor);
    btnX += MODE_BUTTON_WIDTH + LOCAL_BPM_BUTTON_GAP;

    // BPM Mode toggle: "Global" (blue) or "Local" (amber)
    const isLocalBpm = (this.sequencer.getParameter('bpmMode')?.getValue() ?? 0) === 1;
    const bpmModeColor = isLocalBpm ? '#d97706' : '#1d4ed8';
    this.drawTransportButton(ctx, btnX, btnY, LOCAL_BPM_BUTTON_WIDTH, TRANSPORT_BUTTON_HEIGHT,
      isLocalBpm ? 'Local' : 'Global', bpmModeColor);
  }

  /**
   * Draw a small label above a transport control.
   */
  private renderTransportLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
    ctx.fillStyle = '#777777';
    ctx.font = '7px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, x, y);
  }

  /**
   * Draw a simple transport button.
   */
  private drawTransportButton(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    label: string, color: string
  ): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 3);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  /**
   * Calculate step cell layout values.
   */
  private cellLayout(): { cellWidth: number; gridStartX: number } {
    const cellWidth = Math.floor(this.baseWidth / 16);
    const totalGridWidth = cellWidth * 16;
    const gridStartX = this.baseX + Math.floor((this.baseWidth - totalGridWidth) / 2);
    return { cellWidth, gridStartX };
  }

  /**
   * Position per-step controls (velocity knobs and gate dropdowns) based on current layout.
   * Called each frame before rendering.
   */
  private positionStepControls(_state: StepSequencerDisplayState): void {
    const { cellWidth, gridStartX } = this.cellLayout();
    const gridY = this.baseY + TRANSPORT_BAR_HEIGHT;

    for (let i = 0; i < 16; i++) {
      const cellX = gridStartX + i * cellWidth;
      const cellCenterX = cellX + Math.floor(cellWidth / 2);

      // Velocity knob centred in velocity zone
      const knobX = cellCenterX - VELOCITY_KNOB_SIZE / 2;
      const knobY = gridY + CELL_TOP_PADDING + NOTE_LABEL_BOTTOM + 4;
      this.velocityKnobs[i]!.setPosition(knobX, knobY);

      const dropX = cellX + 2;
      const dropY = gridY + CELL_TOP_PADDING + VELOCITY_KNOB_BOTTOM + 2;
      this.gateDropdowns[i]!.setPosition(dropX, dropY);
    }

    // Note picker hit-test positions are set inside renderNotePicker() each frame.
  }

  /**
   * Render the 16-step grid.
   */
  private renderStepGrid(ctx: CanvasRenderingContext2D, state: StepSequencerDisplayState): void {
    const gridY = this.baseY + TRANSPORT_BAR_HEIGHT;
    const { cellWidth, gridStartX } = this.cellLayout();
    const seqLen = state.pattern.sequenceLength;
    const isArpMode = state.pattern.mode === SEQUENCER_MODE.ARPEGGIATOR;

    state.pattern.steps.forEach((step, i) => {
      const cellX = gridStartX + i * cellWidth;
      const isCurrent = state.transport.isPlaying && i === state.transport.visualCurrentStep;
      const isInactive = i >= seqLen;
      this.renderStepCell(ctx, step, cellX, gridY, cellWidth, isCurrent, isInactive, isArpMode);
    });

    if (isArpMode && !this.sequencer.isArpeggiatorConnected()) {
      this.renderArpHint(ctx);
    }

    if (this.notePickerState.stepIndex >= 0) {
      this.renderNotePicker(ctx);
    }
  }

  /**
   * Render a single step cell (background, indicator, note, velocity bar, gate label).
   */
  private renderStepCell(
    ctx: CanvasRenderingContext2D,
    step: StepSequencerDisplayState['pattern']['steps'][number],
    cellX: number, gridY: number, cellWidth: number,
    isCurrent: boolean, isInactive: boolean, isArpMode: boolean
  ): void {
    // Background
    ctx.fillStyle = isInactive ? '#181818' : isCurrent ? '#2a3a2a' : '#222222';
    ctx.fillRect(cellX, gridY, cellWidth - 1, STEP_CELL_HEIGHT);
    ctx.strokeStyle = isCurrent ? '#4ade80' : '#383838';
    ctx.lineWidth = isCurrent ? 1.5 : 0.5;
    ctx.strokeRect(cellX, gridY, cellWidth - 1, STEP_CELL_HEIGHT);

    if (isInactive) return;

    const cellCenterX = cellX + Math.floor(cellWidth / 2);

    // Active indicator
    const circleY = gridY + CELL_TOP_PADDING + ACTIVE_INDICATOR_RADIUS;
    ctx.beginPath();
    ctx.arc(cellCenterX, circleY, ACTIVE_INDICATOR_RADIUS, 0, Math.PI * 2);
    if (step.active) {
      ctx.fillStyle = isCurrent ? '#4ade80' : '#22c55e';
      ctx.fill();
    } else {
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    this.renderCellNoteLabel(ctx, step, cellCenterX, gridY, isArpMode);
    this.renderCellVelocityBar(ctx, step, cellX, gridY, cellWidth, isCurrent);
    this.renderCellGateLabel(ctx, step, cellX, gridY, cellWidth, cellCenterX);
  }

  /** Render the note/offset label in the note zone of a step cell. */
  private renderCellNoteLabel(
    ctx: CanvasRenderingContext2D,
    step: StepSequencerDisplayState['pattern']['steps'][number],
    cellCenterX: number, gridY: number, isArpMode: boolean
  ): void {
    ctx.fillStyle = step.active ? '#eeeeee' : '#555555';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const noteLabelY = gridY + CELL_TOP_PADDING + ACTIVE_INDICATOR_BOTTOM + Math.floor((NOTE_LABEL_BOTTOM - ACTIVE_INDICATOR_BOTTOM) / 2);
    if (isArpMode) {
      const offset = decodeArpOffset(step.note);
      ctx.fillText(offset >= 0 ? `+${offset}` : String(offset), cellCenterX, noteLabelY);
    } else {
      const noteName = NOTE_NAMES[step.note % 12] ?? 'C';
      const octave = Math.floor(step.note / 12) - 1;
      ctx.fillText(`${noteName}${octave}`, cellCenterX, noteLabelY);
    }
  }

  /** Render the velocity bar in the velocity zone of a step cell. */
  private renderCellVelocityBar(
    ctx: CanvasRenderingContext2D,
    step: StepSequencerDisplayState['pattern']['steps'][number],
    cellX: number, gridY: number, cellWidth: number, isCurrent: boolean
  ): void {
    const velZoneTop = gridY + CELL_TOP_PADDING + NOTE_LABEL_BOTTOM + 2;
    const velZoneH = VELOCITY_KNOB_BOTTOM - NOTE_LABEL_BOTTOM - 4;
    const velBarH = Math.round(step.velocity * velZoneH);
    const velBarW = Math.max(2, Math.floor(cellWidth * 0.35));
    const velBarX = cellX + Math.floor((cellWidth - velBarW) / 2);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(velBarX, velZoneTop, velBarW, velZoneH);
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(velBarX, velZoneTop, velBarW, velZoneH);
    ctx.fillStyle = step.active ? (isCurrent ? '#4ade80' : '#22c55e') : '#3a3a3a';
    ctx.fillRect(velBarX, velZoneTop + velZoneH - velBarH, velBarW, velBarH);
  }

  /** Render the gate label in the gate zone of a step cell (sequencer mode only). */
  private renderCellGateLabel(
    ctx: CanvasRenderingContext2D,
    step: StepSequencerDisplayState['pattern']['steps'][number],
    cellX: number, gridY: number, cellWidth: number, cellCenterX: number
  ): void {
    const gateLabel = GATE_LABELS[step.gateLength] ?? '1/4';
    const gateZoneY = gridY + CELL_TOP_PADDING + VELOCITY_KNOB_BOTTOM + 1;
    const gateZoneH = GATE_DROPDOWN_BOTTOM - VELOCITY_KNOB_BOTTOM - 2;
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(cellX + 1, gateZoneY, cellWidth - 3, gateZoneH);
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(cellX + 1, gateZoneY, cellWidth - 3, gateZoneH);
    ctx.fillStyle = step.active ? '#aaaaaa' : '#555555';
    ctx.font = '6px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gateLabel, cellCenterX, gateZoneY + gateZoneH / 2);
  }

  /** Render the arpeggiator "connect keyboard" hint overlay. */
  private renderArpHint(ctx: CanvasRenderingContext2D): void {
    const hintY = this.baseY + TRANSPORT_BAR_HEIGHT + STEP_CELL_HEIGHT / 2;
    ctx.fillStyle = 'rgba(139, 92, 246, 0.7)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Connect a Keyboard to Arp inputs to start', this.baseX + this.baseWidth / 2, hintY);
  }

  /**
   * Render the open note picker as a floating panel above the step grid.
   * The Dropdown objects are used only for menu hit-testing; we draw the
   * closed-state boxes ourselves to avoid the built-in label overhead.
   */
  private renderNotePicker(ctx: CanvasRenderingContext2D): void {
    if (!this.noteNameDropdown || !this.noteNameParam) return;

    const si = this.notePickerState.stepIndex;
    const { cellWidth, gridStartX } = this.cellLayout();
    const panelW = Math.max(cellWidth * 3, 80);
    let panelX = gridStartX + si * cellWidth - Math.floor(panelW / 2 - cellWidth / 2);
    panelX = Math.max(this.baseX, Math.min(this.baseX + this.baseWidth - panelW, panelX));
    const panelY = this.baseY + TRANSPORT_BAR_HEIGHT + 2;
    const panelH = NOTE_PICKER_PANEL_HEIGHT;

    ctx.save();
    ctx.fillStyle = '#1a1a1a';
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 3);
    ctx.fill();
    ctx.stroke();

    if (this.sequencer.isArpeggiatorMode()) {
      this.renderNotePickerArpContent(ctx, panelX, panelY, panelH);
    } else if (this.noteOctaveParam) {
      this.renderNotePickerSeqContent(ctx, panelX, panelY, panelW, panelH);
    }

    ctx.restore();
    this.positionNotePickerDropdowns(panelX, panelY, panelW, panelH);
  }

  /** Render arp-mode offset label inside the note picker panel. */
  private renderNotePickerArpContent(
    ctx: CanvasRenderingContext2D,
    panelX: number, panelY: number, panelH: number
  ): void {
    const offset = decodeArpOffset(Math.round(this.noteNameParam!.getValue()));
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Offset:', panelX + 4, panelY + panelH / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(offset >= 0 ? `+${offset}` : String(offset), panelX + 40, panelY + panelH / 2);
  }

  /** Render sequencer-mode note+octave boxes inside the note picker panel. */
  private renderNotePickerSeqContent(
    ctx: CanvasRenderingContext2D,
    panelX: number, panelY: number, panelW: number, panelH: number
  ): void {
    const nameIdx = Math.round(this.noteNameParam!.getValue());
    const oct = Math.round(this.noteOctaveParam!.getValue());
    const half = Math.floor(panelW / 2);

    const drawBox = (bx: number, label: string): void => {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(bx + 2, panelY + 3, half - 4, panelH - 6);
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(bx + 2, panelY + 3, half - 4, panelH - 6);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + half / 2, panelY + panelH / 2);
    };

    drawBox(panelX, NOTE_NAMES[nameIdx] ?? 'C');
    drawBox(panelX + half, String(oct));
  }

  /** Position the hit-test dropdowns over the rendered note picker boxes. */
  private positionNotePickerDropdowns(
    panelX: number, panelY: number, panelW: number, _panelH: number
  ): void {
    if (!this.noteNameDropdown) return;
    if (!this.sequencer.isArpeggiatorMode() && this.noteOctaveDropdown) {
      const half = Math.floor(panelW / 2);
      this.noteNameDropdown.setPosition(panelX + 2, panelY + 3);
      this.noteOctaveDropdown.setPosition(panelX + half + 2, panelY + 3);
    } else {
      this.noteNameDropdown.setPosition(panelX + 2, panelY + 3);
    }
  }

  /**
   * Draw any open dropdown menus (separate post-component pass for z-order).
   */
  renderDropdownMenus(ctx: CanvasRenderingContext2D): void {
    // Transport division dropdown
    this.noteDivDropdown.renderMenu(ctx);
    // Gate dropdowns
    for (const dd of this.gateDropdowns) {
      dd.renderMenu(ctx);
    }
    // Note picker
    this.noteNameDropdown?.renderMenu(ctx);
    this.noteOctaveDropdown?.renderMenu(ctx);
  }

  // ---------------------------------------------------------------------------
  // Note picker
  // ---------------------------------------------------------------------------

  /**
   * Open the note picker for the given step.
   */
  private openNotePicker(stepIndex: number): void {
    const steps = this.sequencer.getSteps();
    const step = steps[stepIndex];
    if (!step) return;

    const isArpMode = this.sequencer.isArpeggiatorMode();

    if (isArpMode) {
      // Single offset dropdown (-12 to +12)
      const offsetOptions: DropdownOption[] = [];
      for (let o = -12; o <= 12; o++) {
        offsetOptions.push({ value: encodeArpOffset(o), label: o >= 0 ? `+${o}` : String(o) });
      }
      const noteNameIndex = step.note % 12;
      this.noteNameParam = new Parameter(`notePicker_note_${stepIndex}`, 'Offset', step.note, 52, 76, 1, '');
      this.noteNameParam.setValue(step.note);
      this.noteNameDropdown = new Dropdown(0, 0, 60, 18, this.noteNameParam, offsetOptions, 'Offset');
      this.noteOctaveParam = null;
      this.noteOctaveDropdown = null;
      void noteNameIndex;
    } else {
      // Two dropdowns: note name (0–11) and octave (0–8)
      const noteIndex = step.note % 12;
      const octave = Math.max(0, Math.min(8, Math.floor(step.note / 12) - 1));

      const noteNameOptions: DropdownOption[] = NOTE_NAMES.map((n, idx) => ({ value: idx, label: n }));
      const octaveOptions: DropdownOption[] = Array.from({ length: 9 }, (_, o) => ({ value: o, label: String(o) }));

      this.noteNameParam = new Parameter(`notePicker_name_${stepIndex}`, 'Note', noteIndex, 0, 11, 1, '');
      this.noteNameParam.setValue(noteIndex);
      this.noteNameDropdown = new Dropdown(0, 0, 30, 18, this.noteNameParam, noteNameOptions, 'Note');

      this.noteOctaveParam = new Parameter(`notePicker_oct_${stepIndex}`, 'Oct', octave, 0, 8, 1, '');
      this.noteOctaveParam.setValue(octave);
      this.noteOctaveDropdown = new Dropdown(0, 0, 30, 18, this.noteOctaveParam, octaveOptions, 'Oct');
    }

    this.notePickerState = {
      stepIndex,
      noteNameIndex: step.note % 12,
      octave: Math.max(0, Math.min(8, Math.floor(step.note / 12) - 1)),
    };
  }

  /**
   * Close the note picker and write the selected note back to the step.
   */
  private closeNotePicker(commitChange: boolean): void {
    const si = this.notePickerState.stepIndex;
    if (si < 0) return;

    if (commitChange && this.noteNameParam) {
      const isArpMode = this.sequencer.isArpeggiatorMode();
      if (isArpMode) {
        // noteNameParam holds the encoded offset directly
        const encoded = Math.round(this.noteNameParam.getValue());
        this.sequencer.updateStep(si, { note: encoded });
      } else if (this.noteOctaveParam) {
        const nameIdx = Math.round(this.noteNameParam.getValue());
        const oct = Math.round(this.noteOctaveParam.getValue());
        const midi = encodeMidiNote(nameIdx, oct);
        this.sequencer.updateStep(si, { note: midi });
      }
    }

    this.notePickerState = { stepIndex: -1, noteNameIndex: 0, octave: 4 };
    this.noteNameDropdown = null;
    this.noteOctaveDropdown = null;
    this.noteNameParam = null;
    this.noteOctaveParam = null;
  }

  // ---------------------------------------------------------------------------
  // Mouse events
  // ---------------------------------------------------------------------------

  /**
   * Handle mouse-down events forwarded from CanvasComponent.
   */
  onMouseDown(worldX: number, worldY: number): boolean {
    // Open dropdown menus extend beyond the display bounds — check them first
    // before applying the containsPoint guard.
    if (this.notePickerState.stepIndex >= 0) {
      if (this.handleNotePickerMouseDown(worldX, worldY)) return true;
      // Clicked outside the note picker — close it
      this.closeNotePicker(false);
      // Fall through only if the click is inside the display
      if (!this.containsPoint(worldX, worldY)) return false;
      return this.handleStepGridMouseDown(worldX, worldY);
    }

    // Check open division dropdown menu (it can expand below the transport bar)
    if (this.noteDivDropdown.isDropdownOpen()) {
      if (this.noteDivDropdown.onMouseDown(worldX, worldY)) {
        if (!this.noteDivDropdown.isDropdownOpen()) {
          const newDiv = Math.round(this.noteDivParam.getValue());
          this.sequencer.setParameterValue('noteValue', newDiv);
        }
        return true;
      }
      this.noteDivDropdown.close();
    }

    // Check open gate dropdown menus (they also expand below the display)
    for (let i = 0; i < 16; i++) {
      if (this.gateDropdowns[i]!.isDropdownOpen()) {
        if (this.gateDropdowns[i]!.onMouseDown(worldX, worldY)) {
          if (!this.gateDropdowns[i]!.isDropdownOpen()) {
            const newGate = Math.round(this.gateLengthParams[i]!.getValue());
            this.sequencer.updateStep(i, { gateLength: newGate as 0|1|2|3|4|5 });
          }
          return true;
        }
        // Clicked outside — close this dropdown
        this.gateDropdowns[i]!.close();
        break;
      }
    }

    if (!this.containsPoint(worldX, worldY)) return false;

    const y = this.baseY;

    if (worldY < y + TRANSPORT_BAR_HEIGHT) {
      return this.handleTransportMouseDown(worldX, worldY);
    }

    return this.handleStepGridMouseDown(worldX, worldY);
  }

  /**
   * Forward mouse-down to note picker dropdowns.
   */
  private handleNotePickerMouseDown(worldX: number, worldY: number): boolean {
    if (this.noteNameDropdown?.onMouseDown(worldX, worldY)) {
      // After selection write back and close
      if (!this.noteNameDropdown.isDropdownOpen()) {
        this.closeNotePicker(true);
      }
      return true;
    }
    if (this.noteOctaveDropdown?.onMouseDown(worldX, worldY)) {
      if (!this.noteOctaveDropdown.isDropdownOpen()) {
        this.closeNotePicker(true);
      }
      return true;
    }
    return false;
  }

  /**
   * Handle clicks in the transport bar.
   */
  private handleTransportMouseDown(worldX: number, worldY: number): boolean {
    const x = this.baseX;
    const y = this.baseY;
    let btnX = x + TRANSPORT_BUTTON_MARGIN;
    const btnY = y + (TRANSPORT_BAR_HEIGHT - TRANSPORT_BUTTON_HEIGHT) / 2;

    // Play/Stop
    if (worldX >= btnX && worldX <= btnX + TRANSPORT_BUTTON_WIDTH) {
      if (this.sequencer.getIsPlaying()) { this.sequencer.stop(); } else { this.sequencer.start(); }
      return true;
    }
    btnX += TRANSPORT_BUTTON_WIDTH + TRANSPORT_BUTTON_MARGIN;

    // Reset
    if (worldX >= btnX && worldX <= btnX + RESET_BUTTON_WIDTH) {
      this.sequencer.reset();
      return true;
    }
    btnX += RESET_BUTTON_WIDTH + TRANSPORT_BUTTON_MARGIN * 2;

    // BPM knob — only interactive in local BPM mode
    const bpmModeActive = (this.sequencer.getParameter('bpmMode')?.getValue() ?? 0) === 1;
    if (bpmModeActive && this.bpmKnob.onMouseDown(worldX, worldY)) { this.activeTransportKnob = 0; return true; }
    btnX += TRANSPORT_KNOB_SIZE + TRANSPORT_CTRL_GAP;

    // Division dropdown (closed state only — open menu handled in onMouseDown before guard)
    if (this.noteDivDropdown.containsPoint(worldX, worldY)) {
      this.noteDivDropdown.onMouseDown(worldX, worldY);
      return true;
    }
    btnX += TRANSPORT_DIV_DROPDOWN_WIDTH + TRANSPORT_CTRL_GAP;

    // Sequence length knob
    if (this.seqLenKnob.onMouseDown(worldX, worldY)) { this.activeTransportKnob = 1; return true; }
    btnX += TRANSPORT_KNOB_SIZE + MODE_BUTTON_GAP;

    // Mode toggle button
    if (worldX >= btnX && worldX <= btnX + MODE_BUTTON_WIDTH &&
        worldY >= btnY && worldY <= btnY + TRANSPORT_BUTTON_HEIGHT) {
      return this.handleModeToggle();
    }
    btnX += MODE_BUTTON_WIDTH + LOCAL_BPM_BUTTON_GAP;

    // Local BPM toggle button
    if (worldX >= btnX && worldX <= btnX + LOCAL_BPM_BUTTON_WIDTH &&
        worldY >= btnY && worldY <= btnY + TRANSPORT_BUTTON_HEIGHT) {
      return this.handleBpmModeToggle();
    }

    return false;
  }

  /** Toggle BPM mode between global (0) and local (1). */
  private handleBpmModeToggle(): boolean {
    const current = this.sequencer.getParameter('bpmMode')?.getValue() ?? 0;
    this.sequencer.setParameterValue('bpmMode', current === 0 ? 1 : 0);
    return true;
  }

  /** Toggle sequencer/arpeggiator mode, stopping playback first if needed. */
  private handleModeToggle(): boolean {
    const currentMode = this.sequencer.getMode();
    const newMode = currentMode === SEQUENCER_MODE.ARPEGGIATOR
      ? SEQUENCER_MODE.SEQUENCER
      : SEQUENCER_MODE.ARPEGGIATOR;
    if (this.sequencer.getIsPlaying()) {
      this.sequencer.stop();
      this.sequencer.reset();
    }
    this.sequencer.setParameterValue('mode', newMode);
    return true;
  }

  /**
   * Handle clicks in the step grid — dispatches to named controls or step toggle.
   */
  private handleStepGridMouseDown(worldX: number, worldY: number): boolean {
    const gridY = this.baseY + TRANSPORT_BAR_HEIGHT;
    const { cellWidth, gridStartX } = this.cellLayout();

    if (worldX < gridStartX || worldX > gridStartX + cellWidth * 16) return false;

    const stepIndex = Math.floor((worldX - gridStartX) / cellWidth);
    if (stepIndex < 0 || stepIndex >= 16) return false;

    const cellRelY = worldY - gridY;

    // Priority order per T035:
    // 1. Note-label zone (6–22px)
    if (cellRelY >= ACTIVE_INDICATOR_BOTTOM && cellRelY < NOTE_LABEL_BOTTOM) {
      this.openNotePicker(stepIndex);
      return true;
    }

    // 2. Velocity-knob zone (22–52px)
    if (cellRelY >= NOTE_LABEL_BOTTOM && cellRelY < VELOCITY_KNOB_BOTTOM) {
      if (this.velocityKnobs[stepIndex]!.onMouseDown(worldX, worldY)) {
        this.activeKnobIndex = stepIndex;
        return true;
      }
    }

    // 3. Gate-dropdown zone
    if (cellRelY >= VELOCITY_KNOB_BOTTOM && cellRelY < GATE_DROPDOWN_BOTTOM) {
      if (this.gateDropdowns[stepIndex]!.onMouseDown(worldX, worldY)) {
        // If dropdown just closed (selection made), write back immediately
        if (!this.gateDropdowns[stepIndex]!.isDropdownOpen()) {
          const newGate = Math.round(this.gateLengthParams[stepIndex]!.getValue());
          this.sequencer.updateStep(stepIndex, { gateLength: newGate as 0|1|2|3|4|5 });
        }
        return true;
      }
    }

    // 4. Active-indicator (0–6px) OR below controls (>72px) → toggle
    if (cellRelY <= ACTIVE_INDICATOR_BOTTOM || cellRelY > GATE_DROPDOWN_BOTTOM) {
      const steps = this.sequencer.getSteps();
      const step = steps[stepIndex];
      if (step !== undefined) {
        this.sequencer.updateStep(stepIndex, { active: !step.active });
        return true;
      }
    }

    return false;
  }

  /**
   * Forward mouse-move to active velocity knob or transport knob drag.
   */
  onMouseMove(worldX: number, worldY: number): boolean {
    if (this.activeKnobIndex >= 0) {
      if (this.velocityKnobs[this.activeKnobIndex]!.onMouseMove(worldX, worldY)) {
        const newVel = this.velocityParams[this.activeKnobIndex]!.getValue();
        this.sequencer.updateStep(this.activeKnobIndex, { velocity: newVel });
        return true;
      }
    }
    if (this.activeTransportKnob === 0) {
      if (this.bpmKnob.onMouseMove(worldX, worldY)) {
        const newBpm = Math.round(this.bpmParam.getValue());
        this.sequencer.setParameterValue('bpm', newBpm);
        return true;
      }
    }
    if (this.activeTransportKnob === 1) {
      if (this.seqLenKnob.onMouseMove(worldX, worldY)) {
        const newLen = Math.round(this.seqLenParam.getValue());
        this.sequencer.setParameterValue('sequenceLength', newLen);
        return true;
      }
    }
    return false;
  }

  /**
   * End knob drag on mouse-up.
   */
  onMouseUp(): void {
    if (this.activeKnobIndex >= 0) {
      this.velocityKnobs[this.activeKnobIndex]!.onMouseUp();
      this.activeKnobIndex = -1;
    }
    if (this.activeTransportKnob === 0) {
      this.bpmKnob.onMouseUp();
      this.activeTransportKnob = -1;
    }
    if (this.activeTransportKnob === 1) {
      this.seqLenKnob.onMouseUp();
      this.activeTransportKnob = -1;
    }
  }

  // ---------------------------------------------------------------------------
  // Position & bounds
  // ---------------------------------------------------------------------------

  /**
   * Update world-coordinate position (called when component is moved).
   */
  updatePosition(x: number, y: number, width: number, height: number): void {
    this.baseX = x;
    this.baseY = y;
    this.baseWidth = width;
    void height; // height fixed by SEQUENCER_DISPLAY_HEIGHT constant
  }

  /**
   * Returns whether the given world coordinate falls within the display bounds.
   */
  containsPoint(worldX: number, worldY: number): boolean {
    return (
      worldX >= this.baseX &&
      worldX <= this.baseX + this.baseWidth &&
      worldY >= this.baseY &&
      worldY <= this.baseY + SEQUENCER_DISPLAY_HEIGHT
    );
  }

  /**
   * Returns true if any open dropdown menu (gate or note picker) covers this point.
   * Used by CanvasComponent.containsPoint to extend the hit-test area downward.
   */
  hasOpenMenuAt(worldX: number, worldY: number): boolean {
    for (const dd of this.gateDropdowns) {
      if (dd.isDropdownOpen() && dd.containsMenuPoint(worldX, worldY)) return true;
    }
    if (this.noteNameDropdown?.isDropdownOpen() && this.noteNameDropdown.containsMenuPoint(worldX, worldY)) return true;
    if (this.noteOctaveDropdown?.isDropdownOpen() && this.noteOctaveDropdown.containsMenuPoint(worldX, worldY)) return true;
    return false;
  }
}
