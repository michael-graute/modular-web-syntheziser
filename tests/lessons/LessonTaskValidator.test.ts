import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LessonTaskValidator } from '../../src/lessons/LessonTaskValidator';
import { EventType } from '../../src/core/types';

type Listener = (data?: unknown) => void;

function makeMockEventBus() {
  const listeners = new Map<string, Listener[]>();

  return {
    on: vi.fn((event: string, cb: Listener) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(cb);
      return () => {
        const arr = listeners.get(event) ?? [];
        const idx = arr.indexOf(cb);
        if (idx !== -1) arr.splice(idx, 1);
      };
    }),
    emit(event: string, data?: unknown) {
      (listeners.get(event) ?? []).forEach((cb) => cb(data));
    },
  };
}

const connectPayload = (
  sourceType: string,
  targetType: string,
  targetPortId: string
) => ({
  connection: { targetPortId },
  sourceComponent: { type: sourceType },
  targetComponent: { type: targetType },
});

const paramPayload = (componentType: string, parameterId: string, value: number) => ({
  componentType,
  parameterId,
  value,
});

describe('LessonTaskValidator', () => {
  let bus: ReturnType<typeof makeMockEventBus>;
  let validator: LessonTaskValidator;

  beforeEach(() => {
    bus = makeMockEventBus();
    validator = new LessonTaskValidator(bus as any);
  });

  // ── connect tasks ────────────────────────────────────────────────────────

  it('connect task completes when matching CONNECTION_ADDED fires', () => {
    const cb = vi.fn();
    validator.setTask({
      type: 'connect',
      instruction: 'Connect it.',
      connect: { sourceComponentType: 'keyboard-input', targetComponentType: 'oscillator', targetPortId: 'frequency' },
    });
    validator.onComplete(cb);

    bus.emit(EventType.CONNECTION_ADDED, connectPayload('keyboard-input', 'oscillator', 'frequency'));
    expect(cb).toHaveBeenCalledOnce();
  });

  it('connect task does NOT complete when wrong source component type', () => {
    const cb = vi.fn();
    validator.setTask({
      type: 'connect',
      instruction: 'Connect it.',
      connect: { sourceComponentType: 'keyboard-input', targetComponentType: 'oscillator', targetPortId: 'frequency' },
    });
    validator.onComplete(cb);

    bus.emit(EventType.CONNECTION_ADDED, connectPayload('lfo', 'oscillator', 'frequency'));
    expect(cb).not.toHaveBeenCalled();
  });

  it('connect task does NOT complete when wrong target component type', () => {
    const cb = vi.fn();
    validator.setTask({
      type: 'connect',
      instruction: 'Connect it.',
      connect: { sourceComponentType: 'keyboard-input', targetComponentType: 'oscillator', targetPortId: 'frequency' },
    });
    validator.onComplete(cb);

    bus.emit(EventType.CONNECTION_ADDED, connectPayload('keyboard-input', 'filter', 'frequency'));
    expect(cb).not.toHaveBeenCalled();
  });

  it('connect task does NOT complete when wrong port', () => {
    const cb = vi.fn();
    validator.setTask({
      type: 'connect',
      instruction: 'Connect it.',
      connect: { sourceComponentType: 'keyboard-input', targetComponentType: 'oscillator', targetPortId: 'frequency' },
    });
    validator.onComplete(cb);

    bus.emit(EventType.CONNECTION_ADDED, connectPayload('keyboard-input', 'oscillator', 'detune'));
    expect(cb).not.toHaveBeenCalled();
  });

  it('connect task completes even when unrelated CONNECTION_ADDED events fire first', () => {
    const cb = vi.fn();
    validator.setTask({
      type: 'connect',
      instruction: 'Connect it.',
      connect: { sourceComponentType: 'keyboard-input', targetComponentType: 'oscillator', targetPortId: 'frequency' },
    });
    validator.onComplete(cb);

    // Extra unrelated connections
    bus.emit(EventType.CONNECTION_ADDED, connectPayload('lfo', 'filter', 'cutoff'));
    bus.emit(EventType.CONNECTION_ADDED, connectPayload('oscillator', 'vca', 'input'));
    expect(cb).not.toHaveBeenCalled();

    // Now the required connection
    bus.emit(EventType.CONNECTION_ADDED, connectPayload('keyboard-input', 'oscillator', 'frequency'));
    expect(cb).toHaveBeenCalledOnce();
  });

  // ── set-parameter tasks ──────────────────────────────────────────────────

  it('set-parameter task completes when value is within tolerance', () => {
    const cb = vi.fn();
    validator.setTask({
      type: 'set-parameter',
      instruction: 'Set waveform.',
      setParameter: { componentType: 'oscillator', parameterId: 'waveform', targetValue: 1, tolerance: 0 },
    });
    validator.onComplete(cb);

    bus.emit(EventType.PARAMETER_CHANGED, paramPayload('oscillator', 'waveform', 1));
    expect(cb).toHaveBeenCalledOnce();
  });

  it('set-parameter task completes when value is at edge of tolerance', () => {
    const cb = vi.fn();
    validator.setTask({
      type: 'set-parameter',
      instruction: 'Set frequency.',
      setParameter: { componentType: 'oscillator', parameterId: 'frequency', targetValue: 440, tolerance: 10 },
    });
    validator.onComplete(cb);

    bus.emit(EventType.PARAMETER_CHANGED, paramPayload('oscillator', 'frequency', 450));
    expect(cb).toHaveBeenCalledOnce();
  });

  it('set-parameter task does NOT complete when value is outside tolerance', () => {
    const cb = vi.fn();
    validator.setTask({
      type: 'set-parameter',
      instruction: 'Set frequency.',
      setParameter: { componentType: 'oscillator', parameterId: 'frequency', targetValue: 440, tolerance: 5 },
    });
    validator.onComplete(cb);

    bus.emit(EventType.PARAMETER_CHANGED, paramPayload('oscillator', 'frequency', 500));
    expect(cb).not.toHaveBeenCalled();
  });

  it('set-parameter task completes on first reach; subsequent events do not re-fire callback', () => {
    const cb = vi.fn();
    validator.setTask({
      type: 'set-parameter',
      instruction: 'Set waveform.',
      setParameter: { componentType: 'oscillator', parameterId: 'waveform', targetValue: 1, tolerance: 0 },
    });
    validator.onComplete(cb);

    bus.emit(EventType.PARAMETER_CHANGED, paramPayload('oscillator', 'waveform', 1));
    bus.emit(EventType.PARAMETER_CHANGED, paramPayload('oscillator', 'waveform', 1));
    bus.emit(EventType.PARAMETER_CHANGED, paramPayload('oscillator', 'waveform', 1));
    expect(cb).toHaveBeenCalledOnce();
  });

  // ── observe / free tasks ─────────────────────────────────────────────────

  it('observe task never fires callback regardless of events', () => {
    const cb = vi.fn();
    validator.setTask({ type: 'observe', instruction: 'Listen.' });
    validator.onComplete(cb);

    bus.emit(EventType.CONNECTION_ADDED, connectPayload('keyboard-input', 'oscillator', 'frequency'));
    bus.emit(EventType.PARAMETER_CHANGED, paramPayload('oscillator', 'waveform', 1));
    expect(cb).not.toHaveBeenCalled();
  });

  it('free task never fires callback', () => {
    const cb = vi.fn();
    validator.setTask({ type: 'free', instruction: 'Experiment.' });
    validator.onComplete(cb);

    bus.emit(EventType.PARAMETER_CHANGED, paramPayload('oscillator', 'waveform', 2));
    expect(cb).not.toHaveBeenCalled();
  });

  // ── setTask(null) ────────────────────────────────────────────────────────

  it('setTask(null) unsubscribes — events after null do not fire callback', () => {
    const cb = vi.fn();
    validator.setTask({
      type: 'connect',
      instruction: 'Connect it.',
      connect: { sourceComponentType: 'keyboard-input', targetComponentType: 'oscillator', targetPortId: 'frequency' },
    });
    validator.onComplete(cb);

    validator.setTask(null);
    bus.emit(EventType.CONNECTION_ADDED, connectPayload('keyboard-input', 'oscillator', 'frequency'));
    expect(cb).not.toHaveBeenCalled();
  });
});
