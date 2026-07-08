import { describe, it, expect } from 'vitest';
import { NOTES } from '../../../specs/036-notes-component/contracts/types';
import { clampText, shouldSerializeText } from '../../../specs/036-notes-component/contracts/validation';
import { RESIZE } from '../../../specs/037-notes-resizable/contracts/types';
import {
  clampSize,
  applyBottomLeftResize,
  applyBottomRightResize,
} from '../../../specs/037-notes-resizable/contracts/validation';
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
// clampSize — 100% coverage (FR-004)
// ---------------------------------------------------------------------------

describe('clampSize', () => {
  it('passes through a size at the minimum unchanged', () => {
    expect(clampSize({ width: RESIZE.MIN_WIDTH, height: RESIZE.MIN_HEIGHT })).toEqual({
      width: RESIZE.MIN_WIDTH,
      height: RESIZE.MIN_HEIGHT,
    });
  });

  it('passes through a size above the minimum unchanged', () => {
    expect(clampSize({ width: 300, height: 400 })).toEqual({ width: 300, height: 400 });
  });

  it('clamps a width below the minimum up to the minimum', () => {
    expect(clampSize({ width: 10, height: RESIZE.MIN_HEIGHT })).toEqual({
      width: RESIZE.MIN_WIDTH,
      height: RESIZE.MIN_HEIGHT,
    });
  });

  it('clamps a height below the minimum up to the minimum', () => {
    expect(clampSize({ width: RESIZE.MIN_WIDTH, height: 10 })).toEqual({
      width: RESIZE.MIN_WIDTH,
      height: RESIZE.MIN_HEIGHT,
    });
  });
});

// ---------------------------------------------------------------------------
// applyBottomLeftResize — 100% coverage (FR-002, FR-003, FR-004)
// ---------------------------------------------------------------------------

describe('applyBottomLeftResize', () => {
  const position = { x: 100, y: 100 };
  const size = { width: 240, height: 180 };

  it('a purely negative dx (drag left) grows width and shifts x left by the same amount, leaving y/height untouched', () => {
    const result = applyBottomLeftResize(position, size, -20, 0);
    expect(result.size.width).toBe(260);
    expect(result.position.x).toBe(80);
    expect(result.size.height).toBe(180);
    expect(result.position.y).toBe(100);
  });

  it('a purely positive dy (drag down) grows height, leaving x/y/width untouched', () => {
    const result = applyBottomLeftResize(position, size, 0, 30);
    expect(result.size.height).toBe(210);
    expect(result.position.x).toBe(100);
    expect(result.position.y).toBe(100);
    expect(result.size.width).toBe(240);
  });

  it('combined dx/dy updates both axes independently in one call', () => {
    const result = applyBottomLeftResize(position, size, -20, 30);
    expect(result.size).toEqual({ width: 260, height: 210 });
    expect(result.position).toEqual({ x: 80, y: 100 });
  });

  it('shrinking below the minimum clamps width/height and clamps the position.x shift accordingly', () => {
    // Try to shrink width from 240 to well below RESIZE.MIN_WIDTH (120) via a large positive dx,
    // and height from 180 to well below RESIZE.MIN_HEIGHT (80) via a large negative dy.
    const result = applyBottomLeftResize(position, size, 500, -500);
    expect(result.size.width).toBe(RESIZE.MIN_WIDTH);
    expect(result.size.height).toBe(RESIZE.MIN_HEIGHT);
    // width only shrank from 240 to 120 (a delta of 120), not the full requested 500,
    // so position.x should only shift by that clamped amount.
    expect(result.position.x).toBe(position.x + (size.width - RESIZE.MIN_WIDTH));
    expect(result.position.y).toBe(position.y);
  });
});

// ---------------------------------------------------------------------------
// applyBottomRightResize — 100% coverage (top-left corner stays fixed)
// ---------------------------------------------------------------------------

describe('applyBottomRightResize', () => {
  const size = { width: 240, height: 180 };

  it('a purely positive dx (drag right) grows width, leaving height untouched', () => {
    const result = applyBottomRightResize(size, 20, 0);
    expect(result.size).toEqual({ width: 260, height: 180 });
  });

  it('a purely positive dy (drag down) grows height, leaving width untouched', () => {
    const result = applyBottomRightResize(size, 0, 30);
    expect(result.size).toEqual({ width: 240, height: 210 });
  });

  it('combined dx/dy updates both axes independently in one call', () => {
    const result = applyBottomRightResize(size, 20, 30);
    expect(result.size).toEqual({ width: 260, height: 210 });
  });

  it('shrinking below the minimum clamps width/height to the minimum', () => {
    const result = applyBottomRightResize(size, -500, -500);
    expect(result.size).toEqual({ width: RESIZE.MIN_WIDTH, height: RESIZE.MIN_HEIGHT });
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

  // -------------------------------------------------------------------------
  // Size (feature 037)
  // -------------------------------------------------------------------------

  it('getSize returns null before setSize has ever been called', () => {
    const notes = new Notes('n1', { x: 0, y: 0 });
    expect(notes.getSize()).toBeNull();
  });

  it('round-trips a size via setSize/getSize', () => {
    const notes = new Notes('n1', { x: 0, y: 0 });
    notes.setSize(300, 400);
    expect(notes.getSize()).toEqual({ width: 300, height: 400 });
  });

  it('serializes without width/height fields when no size has ever been set', () => {
    const notes = new Notes('n1', { x: 0, y: 0 });
    const data = notes.serialize();
    expect(data.width).toBeUndefined();
    expect(data.height).toBeUndefined();
  });

  it('round-trips a set size exactly through serialize/deserialize', () => {
    const original = new Notes('n1', { x: 0, y: 0 });
    original.setSize(320, 260);

    const data = original.serialize();
    const restored = new Notes('n2', { x: 0, y: 0 });
    restored.deserialize(data);

    expect(restored.getSize()).toEqual({ width: 320, height: 260 });
  });

  it('deserializing data with no width/height fields leaves getSize returning null (legacy-patch compatibility)', () => {
    const notes = new Notes('n1', { x: 0, y: 0 });
    const producer = new Notes('n2', { x: 0, y: 0 });
    const data = producer.serialize();
    delete data.width;
    delete data.height;
    notes.deserialize(data);
    expect(notes.getSize()).toBeNull();
  });
});
