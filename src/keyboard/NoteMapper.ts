/**
 * NoteMapper - Maps QWERTY keys to MIDI notes
 */

import { KEYBOARD_MAPPING, KEYBOARD } from '../utils/constants';

/**
 * Maps QWERTY keyboard to MIDI notes
 */
export class NoteMapper {
  private octave: number;

  constructor(baseOctave: number = KEYBOARD.BASE_OCTAVE) {
    this.octave = baseOctave;
  }

  /**
   * Map a key to a MIDI note number
   */
  keyToNote(key: string): number | null {
    const mapping = KEYBOARD_MAPPING[key.toLowerCase() as keyof typeof KEYBOARD_MAPPING];

    if (typeof mapping === 'number') {
      // Calculate MIDI note number
      // MIDI note 60 is C4 (middle C)
      // Each octave adds 12 semitones
      const baseMidiNote = (this.octave + 1) * 12;
      return baseMidiNote + mapping;
    }

    return null;
  }

  /**
   * Check if key is octave control
   */
  isOctaveControl(key: string): 'up' | 'down' | null {
    const mapping = KEYBOARD_MAPPING[key.toLowerCase() as keyof typeof KEYBOARD_MAPPING];

    if (mapping === 'octave-up') {
      return 'up';
    } else if (mapping === 'octave-down') {
      return 'down';
    }

    return null;
  }

  /**
   * Check if key is sustain pedal
   */
  isSustainPedal(key: string): boolean {
    const mapping = KEYBOARD_MAPPING[key.toLowerCase() as keyof typeof KEYBOARD_MAPPING];
    return mapping === 'sustain';
  }

  /**
   * Get current octave
   */
  getOctave(): number {
    return this.octave;
  }

  /**
   * Set octave
   */
  setOctave(octave: number): void {
    this.octave = Math.max(
      KEYBOARD.MIN_OCTAVE,
      Math.min(KEYBOARD.MAX_OCTAVE, octave)
    );
  }

  /**
   * Shift octave up
   */
  shiftOctaveUp(): void {
    this.setOctave(this.octave + 1);
  }

  /**
   * Shift octave down
   */
  shiftOctaveDown(): void {
    this.setOctave(this.octave - 1);
  }

  /**
   * Get MIDI note name
   */
  static getNoteNameFromMidi(midiNote: number): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const note = noteNames[midiNote % 12];
    return `${note}${octave}`;
  }

  /**
   * Get frequency from MIDI note
   */
  static midiToFrequency(midiNote: number): number {
    // MIDI note 69 = A4 = 440Hz
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }
}
