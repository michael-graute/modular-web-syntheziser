import { describe, it, expect } from 'vitest';
import { NOTES } from '../../../specs/036-notes-component/contracts/types';
import { clampText, shouldSerializeText } from '../../../specs/036-notes-component/contracts/validation';
import { Notes } from '../../../src/components/utilities/Notes';

// ---------------------------------------------------------------------------
// clampText — 100% coverage
// ---------------------------------------------------------------------------

describe('clampText', () => {
  it('passes through text at the max length unchanged', () => {
    const text = 'a'.repeat(NOTES.MAX_TEXT_LENGTH);
    expect(clampText(text)).toBe(text);
    expect(clampText(text).length).toBe(NOTES.MAX_TEXT_LENGTH);
  });

  it('passes through text below the max length unchanged', () => {
    const text = 'hello world';
    expect(clampText(text)).toBe(text);
  });

  it('truncates text above the max length to exactly MAX_TEXT_LENGTH characters', () => {
    const text = 'a'.repeat(NOTES.MAX_TEXT_LENGTH + 500);
    const result = clampText(text);
    expect(result.length).toBe(NOTES.MAX_TEXT_LENGTH);
    expect(result).toBe('a'.repeat(NOTES.MAX_TEXT_LENGTH));
  });

  it('passes through an empty string unchanged', () => {
    expect(clampText('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// shouldSerializeText
// ---------------------------------------------------------------------------

describe('shouldSerializeText', () => {
  it('returns false for an empty string', () => {
    expect(shouldSerializeText('')).toBe(false);
  });

  it('returns true for any non-empty string', () => {
    expect(shouldSerializeText('a')).toBe(true);
    expect(shouldSerializeText('a paragraph of notes')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Notes component — setText/getText, no-throw activation, independence
// ---------------------------------------------------------------------------

describe('Notes', () => {
  it('round-trips plain text via setText/getText', () => {
    const notes = new Notes('n1', { x: 0, y: 0 });
    notes.setText('Hello, patch documentation!');
    expect(notes.getText()).toBe('Hello, patch documentation!');
  });

  it('defaults to empty text', () => {
    const notes = new Notes('n1', { x: 0, y: 0 });
    expect(notes.getText()).toBe('');
  });

  it('clamps text set via setText beyond MAX_TEXT_LENGTH', () => {
    const notes = new Notes('n1', { x: 0, y: 0 });
    notes.setText('a'.repeat(NOTES.MAX_TEXT_LENGTH + 100));
    expect(notes.getText().length).toBe(NOTES.MAX_TEXT_LENGTH);
  });

  it('activates without throwing when no audio engine mock is configured', () => {
    const notes = new Notes('n1', { x: 0, y: 0 });
    expect(() => notes.activate()).not.toThrow();
    expect(notes.isActive).toBe(true);
    expect(notes.getInputNode()).toBeNull();
    expect(notes.getOutputNode()).toBeNull();
  });

  it('deactivates without throwing', () => {
    const notes = new Notes('n1', { x: 0, y: 0 });
    notes.activate();
    expect(() => notes.deactivate()).not.toThrow();
    expect(notes.isActive).toBe(false);
  });

  it('holds independent text across two instances', () => {
    const a = new Notes('n1', { x: 0, y: 0 });
    const b = new Notes('n2', { x: 10, y: 10 });
    a.setText('Note A');
    b.setText('Note B');
    expect(a.getText()).toBe('Note A');
    expect(b.getText()).toBe('Note B');
  });

  // -------------------------------------------------------------------------
  // Serialization (US2)
  // -------------------------------------------------------------------------

  it('round-trips text exactly through serialize/deserialize, including special characters', () => {
    const original = new Notes('n1', { x: 0, y: 0 });
    const specialText = 'Quotes "like this", newlines\nand emoji 🎛️🎹 & symbols <>&';
    original.setText(specialText);

    const data = original.serialize();
    const restored = new Notes('n2', { x: 0, y: 0 });
    restored.deserialize(data);

    expect(restored.getText()).toBe(specialText);
  });

  it('serializes empty text WITHOUT a text field on ComponentData', () => {
    const notes = new Notes('n1', { x: 0, y: 0 });
    const data = notes.serialize();
    expect(data.text).toBeUndefined();
  });

  it('deserializes data with no text field to an empty string', () => {
    const notes = new Notes('n1', { x: 0, y: 0 });
    const producer = new Notes('n2', { x: 0, y: 0 });
    const data = producer.serialize();
    delete data.text;
    notes.deserialize(data);
    expect(notes.getText()).toBe('');
  });

  // -------------------------------------------------------------------------
  // Position (US3)
  // -------------------------------------------------------------------------

  it('includes and restores position via serialize/deserialize', () => {
    const original = new Notes('n1', { x: 42, y: 99 });
    const data = original.serialize();
    expect(data.position).toEqual({ x: 42, y: 99 });

    const restored = new Notes('n2', { x: 0, y: 0 });
    restored.deserialize(data);
    expect(restored.position).toEqual({ x: 42, y: 99 });
  });
});
