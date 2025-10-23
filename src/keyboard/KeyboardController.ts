/**
 * KeyboardController - Handles QWERTY keyboard input and maps to synthesizer notes
 */

import { Keyboard } from './Keyboard';
import { NoteMapper } from './NoteMapper';
import { VoiceManager } from './VoiceManager';
import { KEYBOARD } from '../utils/constants';

/**
 * Manages keyboard input and note triggering
 */
export class KeyboardController {
  private keyboard: Keyboard;
  private noteMapper: NoteMapper;
  private voiceManager: VoiceManager;
  private pressedKeys: Set<string>;

  constructor(
    keyboardCanvas: HTMLCanvasElement,
    baseOctave: number = KEYBOARD.BASE_OCTAVE
  ) {
    this.keyboard = new Keyboard(keyboardCanvas, baseOctave);
    this.noteMapper = new NoteMapper(baseOctave);
    this.voiceManager = new VoiceManager(KEYBOARD.MAX_POLYPHONY);
    this.pressedKeys = new Set();

    this.setupKeyboard();
    this.setupQwertyInput();
  }

  /**
   * Setup visual keyboard callbacks
   */
  private setupKeyboard(): void {
    // Connect keyboard to voice manager
    this.keyboard.setNoteOnCallback((note, velocity) => {
      this.voiceManager.noteOn(note, velocity);
    });

    this.keyboard.setNoteOffCallback((note) => {
      this.voiceManager.noteOff(note);
    });
  }

  /**
   * Setup QWERTY keyboard input
   */
  private setupQwertyInput(): void {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  /**
   * Handle key down
   */
  private handleKeyDown(e: KeyboardEvent): void {
    // Ignore repeat events
    if (e.repeat) {
      return;
    }

    // Ignore if typing in an input field
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    const key = e.key.toLowerCase();

    // Check if already pressed
    if (this.pressedKeys.has(key)) {
      return;
    }

    this.pressedKeys.add(key);

    // Check for octave controls
    const octaveControl = this.noteMapper.isOctaveControl(key);
    if (octaveControl === 'up') {
      this.shiftOctaveUp();
      return;
    } else if (octaveControl === 'down') {
      this.shiftOctaveDown();
      return;
    }

    // Check for sustain pedal
    if (this.noteMapper.isSustainPedal(key)) {
      this.voiceManager.setSustainPedal(true);
      console.log('Sustain pedal: ON');
      return;
    }

    // Map key to note
    const note = this.noteMapper.keyToNote(key);
    if (note !== null) {
      // Trigger note on
      this.voiceManager.noteOn(note, 0.7);

      // Update visual keyboard
      this.keyboard.pressKey(note, 0.7);

      console.log(`Note ON: ${NoteMapper.getNoteNameFromMidi(note)} (${note})`);
    }
  }

  /**
   * Handle key up
   */
  private handleKeyUp(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();

    // Remove from pressed keys
    this.pressedKeys.delete(key);

    // Check for sustain pedal
    if (this.noteMapper.isSustainPedal(key)) {
      this.voiceManager.setSustainPedal(false);
      console.log('Sustain pedal: OFF');
      return;
    }

    // Map key to note
    const note = this.noteMapper.keyToNote(key);
    if (note !== null) {
      // Trigger note off
      this.voiceManager.noteOff(note);

      // Update visual keyboard
      this.keyboard.releaseKey(note);

      console.log(`Note OFF: ${NoteMapper.getNoteNameFromMidi(note)} (${note})`);
    }
  }

  /**
   * Shift octave up
   */
  shiftOctaveUp(): void {
    this.noteMapper.shiftOctaveUp();
    this.keyboard.shiftOctaveUp();
    console.log(`Octave: ${this.noteMapper.getOctave()}`);
  }

  /**
   * Shift octave down
   */
  shiftOctaveDown(): void {
    this.noteMapper.shiftOctaveDown();
    this.keyboard.shiftOctaveDown();
    console.log(`Octave: ${this.noteMapper.getOctave()}`);
  }

  /**
   * Release all notes (panic button)
   */
  releaseAll(): void {
    this.voiceManager.releaseAll();
    this.pressedKeys.clear();
    console.log('All notes released (panic)');
  }

  /**
   * Set note on callback
   */
  setNoteOnCallback(callback: (note: number, velocity: number) => void): void {
    this.voiceManager.setNoteOnCallback(callback);
  }

  /**
   * Set note off callback
   */
  setNoteOffCallback(callback: (note: number) => void): void {
    this.voiceManager.setNoteOffCallback(callback);
  }

  /**
   * Get voice manager
   */
  getVoiceManager(): VoiceManager {
    return this.voiceManager;
  }

  /**
   * Get visual keyboard
   */
  getKeyboard(): Keyboard {
    return this.keyboard;
  }

  /**
   * Get note mapper
   */
  getNoteMapper(): NoteMapper {
    return this.noteMapper;
  }
}
