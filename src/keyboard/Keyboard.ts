/**
 * Keyboard - Visual piano keyboard component
 */

import { KEYBOARD } from '../utils/constants';

/**
 * Key visual representation
 */
interface Key {
  note: number; // MIDI note number
  name: string; // Note name (C4, C#4, etc.)
  isBlack: boolean;
  x: number;
  width: number;
  isPressed: boolean;
  pressedByChordFinder: boolean; // ChordFinder-sourced highlight (independent of manual press)
}

/**
 * Visual piano keyboard component (2 octaves)
 */
export class Keyboard {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private keys: Key[];
  private startOctave: number;

  // Callbacks
  private onNoteOn: ((note: number, velocity: number) => void) | null;
  private onNoteOff: ((note: number) => void) | null;

  constructor(canvas: HTMLCanvasElement, startOctave: number = 4) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D context from keyboard canvas');
    }
    this.ctx = context;
    this.startOctave = startOctave;
    this.keys = [];
    this.onNoteOn = null;
    this.onNoteOff = null;

    this.setupCanvas();
    this.createKeys();
    this.setupEventListeners();
    this.render();
  }

  /**
   * Setup canvas size
   */
  private setupCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    this.ctx.scale(dpr, dpr);

    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  /**
   * Create keyboard keys (2 octaves = 24 white keys + 10 black keys per octave)
   */
  private createKeys(): void {
    this.keys = [];

    const whiteKeyCount = KEYBOARD.OCTAVE_COUNT * 7; // 7 white keys per octave
    const whiteKeyWidth = this.canvas.clientWidth / whiteKeyCount;

    let whiteKeyIndex = 0;

    // Pattern of black keys in an octave: W B W B W W B W B W B W
    // Where W = white key, B = black key
    const octavePattern = [
      { hasBlack: true, name: 'C' },
      { hasBlack: true, name: 'D' },
      { hasBlack: false, name: 'E' },
      { hasBlack: true, name: 'F' },
      { hasBlack: true, name: 'G' },
      { hasBlack: true, name: 'A' },
      { hasBlack: false, name: 'B' },
    ];

    // Generate keys for each octave
    for (let octave = 0; octave < KEYBOARD.OCTAVE_COUNT; octave++) {
      const octaveNumber = this.startOctave + octave;
      const baseMidiNote = (octaveNumber + 1) * 12; // MIDI note number for C

      octavePattern.forEach((key, index) => {
        const midiNote = baseMidiNote + index * 2 + (index > 2 ? -1 : 0);
        const noteName = `${key.name}${octaveNumber}`;

        // Create white key
        const whiteKey: Key = {
          note: midiNote,
          name: noteName,
          isBlack: false,
          x: whiteKeyIndex * whiteKeyWidth,
          width: whiteKeyWidth,
          isPressed: false,
          pressedByChordFinder: false,
        };
        this.keys.push(whiteKey);
        whiteKeyIndex++;

        // Create black key if needed
        if (key.hasBlack) {
          const blackNoteName = `${key.name}#${octaveNumber}`;
          const blackMidiNote = midiNote + 1;

          const blackKey: Key = {
            note: blackMidiNote,
            name: blackNoteName,
            isBlack: true,
            x: whiteKey.x + whiteKeyWidth - KEYBOARD.BLACK_KEY_WIDTH / 2,
            width: KEYBOARD.BLACK_KEY_WIDTH,
            isPressed: false,
            pressedByChordFinder: false,
          };
          this.keys.push(blackKey);
        }
      });
    }
  }

  /**
   * Setup mouse event listeners
   */
  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
  }

  /**
   * Handle mouse down
   */
  private handleMouseDown(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const key = this.findKeyAt(x, y);
    if (key && !key.isPressed) {
      this.pressKey(key.note);
    }
  }

  /**
   * Handle mouse up
   */
  private handleMouseUp(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const key = this.findKeyAt(x, y);
    if (key && key.isPressed) {
      this.releaseKey(key.note);
    }
  }

  /**
   * Handle mouse move (for drag-to-play)
   */
  private handleMouseMove(e: MouseEvent): void {
    if (e.buttons === 1) {
      // Left mouse button is pressed
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const key = this.findKeyAt(x, y);
      if (key && !key.isPressed) {
        // Release all other keys and press this one
        this.releaseAllKeys();
        this.pressKey(key.note);
      }
    }
  }

  /**
   * Handle mouse leave
   */
  private handleMouseLeave(): void {
    this.releaseAllKeys();
  }

  /**
   * Find key at position (check black keys first, then white keys)
   */
  private findKeyAt(x: number, y: number): Key | null {
    // Check black keys first (they're on top)
    for (const key of this.keys) {
      if (key.isBlack && this.isPointInKey(x, y, key)) {
        return key;
      }
    }

    // Check white keys
    for (const key of this.keys) {
      if (!key.isBlack && this.isPointInKey(x, y, key)) {
        return key;
      }
    }

    return null;
  }

  /**
   * Check if point is inside key
   */
  private isPointInKey(x: number, y: number, key: Key): boolean {
    const height = key.isBlack
      ? KEYBOARD.BLACK_KEY_HEIGHT
      : this.canvas.clientHeight;

    return (
      x >= key.x &&
      x <= key.x + key.width &&
      y >= 0 &&
      y <= height
    );
  }

  /**
   * Press a key
   */
  pressKey(note: number, velocity: number = 0.7): void {
    const key = this.keys.find((k) => k.note === note);
    if (key) {
      key.isPressed = true;
      this.render();

      if (this.onNoteOn) {
        this.onNoteOn(note, velocity);
      }
    }
  }

  /**
   * Release a key
   */
  releaseKey(note: number): void {
    const key = this.keys.find((k) => k.note === note);
    if (key) {
      key.isPressed = false;
      this.render();

      if (this.onNoteOff) {
        this.onNoteOff(note);
      }
    }
  }

  /**
   * Release all keys
   */
  private releaseAllKeys(): void {
    this.keys.forEach((key) => {
      if (key.isPressed) {
        this.releaseKey(key.note);
      }
    });
  }

  /**
   * Highlight a key from a ChordFinder chord press (does not trigger audio callbacks).
   * No-op if the note is outside the visible range.
   */
  pressKeyFromChordFinder(note: number): void {
    const key = this.keys.find((k) => k.note === note);
    if (key) {
      key.pressedByChordFinder = true;
      this.render();
    }
  }

  /**
   * Remove ChordFinder highlight from a key (does not trigger audio callbacks).
   * The key remains highlighted if isPressed is still true (manual press active).
   */
  releaseKeyFromChordFinder(note: number): void {
    const key = this.keys.find((k) => k.note === note);
    if (key) {
      key.pressedByChordFinder = false;
      this.render();
    }
  }

  /**
   * Remove all ChordFinder highlights in a single render call.
   * Used for atomic chord swap and chord release.
   */
  releaseAllChordFinderKeys(): void {
    this.keys.forEach((key) => {
      key.pressedByChordFinder = false;
    });
    this.render();
  }

  /**
   * Set octave (shifts all keys)
   */
  setOctave(octave: number): void {
    this.startOctave = octave;
    this.createKeys();
    this.render();
  }

  /**
   * Get current octave
   */
  getOctave(): number {
    return this.startOctave;
  }

  /**
   * Shift octave up
   */
  shiftOctaveUp(): void {
    if (this.startOctave < 7) {
      this.setOctave(this.startOctave + 1);
    }
  }

  /**
   * Shift octave down
   */
  shiftOctaveDown(): void {
    if (this.startOctave > 0) {
      this.setOctave(this.startOctave - 1);
    }
  }

  /**
   * Set note on callback
   */
  setNoteOnCallback(callback: (note: number, velocity: number) => void): void {
    this.onNoteOn = callback;
  }

  /**
   * Set note off callback
   */
  setNoteOffCallback(callback: (note: number) => void): void {
    this.onNoteOff = callback;
  }

  /**
   * Render the keyboard
   */
  private render(): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render white keys first
    this.keys
      .filter((key) => !key.isBlack)
      .forEach((key) => this.renderKey(key));

    // Render black keys on top
    this.keys
      .filter((key) => key.isBlack)
      .forEach((key) => this.renderKey(key));
  }

  /**
   * Render a single key
   */
  private renderKey(key: Key): void {
    const height = key.isBlack
      ? KEYBOARD.BLACK_KEY_HEIGHT
      : this.canvas.clientHeight;

    // Fill key — highlighted when pressed manually OR by ChordFinder
    const highlighted = key.isPressed || key.pressedByChordFinder;
    if (key.isBlack) {
      this.ctx.fillStyle = highlighted ? '#4a9eff' : '#2a2a2a';
    } else {
      this.ctx.fillStyle = highlighted ? '#60a5fa' : '#ffffff';
    }
    this.ctx.fillRect(key.x, 0, key.width, height);

    // Draw border
    this.ctx.strokeStyle = key.isBlack ? '#1a1a1a' : '#505050';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(key.x, 0, key.width, height);

    // Draw note name on white keys
    if (!key.isBlack) {
      this.ctx.fillStyle = highlighted ? '#ffffff' : '#808080';
      this.ctx.font = '10px -apple-system, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'bottom';
      this.ctx.fillText(
        key.name,
        key.x + key.width / 2,
        this.canvas.clientHeight - 5
      );
    }
  }
}
