/**
 * VoiceManager - Manages polyphonic voice allocation
 */

import { KEYBOARD } from '../utils/constants';

/**
 * Voice state
 */
interface Voice {
  note: number;
  active: boolean;
  timestamp: number;
}

/**
 * Manages polyphonic voice allocation and note tracking
 */
export class VoiceManager {
  private voices: Voice[];
  private sustainPedal: boolean;
  private sustainedNotes: Set<number>;

  // Callbacks
  private onNoteOn: ((note: number, velocity: number) => void) | null;
  private onNoteOff: ((note: number) => void) | null;

  constructor(maxPolyphony: number = KEYBOARD.MAX_POLYPHONY) {
    this.voices = [];
    this.sustainPedal = false;
    this.sustainedNotes = new Set();
    this.onNoteOn = null;
    this.onNoteOff = null;

    // Initialize voices
    for (let i = 0; i < maxPolyphony; i++) {
      this.voices.push({
        note: -1,
        active: false,
        timestamp: 0,
      });
    }
  }

  /**
   * Trigger a note on
   */
  noteOn(note: number, velocity: number = 0.7): void {
    // Check if note is already playing
    const existingVoice = this.voices.find(
      (v) => v.active && v.note === note
    );

    if (existingVoice) {
      // Retrigger existing voice
      if (this.onNoteOn) {
        this.onNoteOn(note, velocity);
      }
      existingVoice.timestamp = Date.now();
      return;
    }

    // Find free voice
    let voice = this.voices.find((v) => !v.active);

    if (!voice) {
      // All voices active, steal oldest voice
      voice = this.voices.reduce((oldest, current) =>
        current.timestamp < oldest.timestamp ? current : oldest
      );

      // Release stolen voice
      if (voice.active && this.onNoteOff) {
        this.onNoteOff(voice.note);
      }
    }

    // Activate voice
    voice.note = note;
    voice.active = true;
    voice.timestamp = Date.now();

    // Trigger note on callback
    if (this.onNoteOn) {
      this.onNoteOn(note, velocity);
    }
  }

  /**
   * Trigger a note off
   */
  noteOff(note: number): void {
    const voice = this.voices.find((v) => v.active && v.note === note);

    if (!voice) {
      return;
    }

    // If sustain pedal is down, mark note as sustained
    if (this.sustainPedal) {
      this.sustainedNotes.add(note);
      return;
    }

    // Release voice
    voice.active = false;
    voice.note = -1;

    // Trigger note off callback
    if (this.onNoteOff) {
      this.onNoteOff(note);
    }
  }

  /**
   * Set sustain pedal state
   */
  setSustainPedal(enabled: boolean): void {
    this.sustainPedal = enabled;

    // If sustain released, turn off all sustained notes
    if (!enabled && this.sustainedNotes.size > 0) {
      this.sustainedNotes.forEach((note) => {
        const voice = this.voices.find((v) => v.active && v.note === note);
        if (voice) {
          voice.active = false;
          voice.note = -1;

          if (this.onNoteOff) {
            this.onNoteOff(note);
          }
        }
      });
      this.sustainedNotes.clear();
    }
  }

  /**
   * Release all voices (panic button)
   */
  releaseAll(): void {
    this.voices.forEach((voice) => {
      if (voice.active) {
        if (this.onNoteOff) {
          this.onNoteOff(voice.note);
        }
        voice.active = false;
        voice.note = -1;
      }
    });
    this.sustainedNotes.clear();
  }

  /**
   * Check if a note is active
   */
  isNoteActive(note: number): boolean {
    return this.voices.some((v) => v.active && v.note === note);
  }

  /**
   * Get number of active voices
   */
  getActiveVoiceCount(): number {
    return this.voices.filter((v) => v.active).length;
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
}
