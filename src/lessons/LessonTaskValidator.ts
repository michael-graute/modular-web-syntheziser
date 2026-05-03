import type { EventBus } from '../core/EventBus';
import { EventType } from '../core/types';
import type { LessonTask } from './types';

export class LessonTaskValidator {
  private eventBus: EventBus;
  private activeTask: LessonTask | null = null;
  private completeCallback: (() => void) | null = null;
  private unsubscribeConnection: (() => void) | null = null;
  private unsubscribeParameter: (() => void) | null = null;
  private alreadyCompleted = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  setTask(task: LessonTask | null): void {
    this.unsubscribeAll();
    this.activeTask = task;
    this.alreadyCompleted = false;
    this.completeCallback = null;

    if (!task) return;

    if (task.type === 'connect') {
      this.unsubscribeConnection = this.eventBus.on(
        EventType.CONNECTION_ADDED,
        (data: unknown) => this.handleConnectionAdded(data)
      );
    } else if (task.type === 'set-parameter') {
      this.unsubscribeParameter = this.eventBus.on(
        EventType.PARAMETER_CHANGED,
        (data: unknown) => this.handleParameterChanged(data)
      );
    }
    // 'observe' and 'free' tasks never fire the validator
  }

  onComplete(cb: () => void): void {
    this.completeCallback = cb;
  }

  private handleConnectionAdded(data: unknown): void {
    if (this.alreadyCompleted) return;
    if (!this.activeTask?.connect) return;

    const payload = data as {
      connection?: { targetPortId?: string };
      sourceComponent?: { type?: string };
      targetComponent?: { type?: string };
    };

    const { sourceComponentType, targetComponentType, targetPortId } = this.activeTask.connect;

    const sourceMatches = payload.sourceComponent?.type === sourceComponentType;
    const targetMatches = payload.targetComponent?.type === targetComponentType;
    const portMatches = payload.connection?.targetPortId === targetPortId;

    if (sourceMatches && targetMatches && portMatches) {
      this.markComplete();
    }
  }

  private handleParameterChanged(data: unknown): void {
    if (this.alreadyCompleted) return;
    if (!this.activeTask?.setParameter) return;

    const payload = data as {
      componentType?: string;
      parameterId?: string;
      value?: number;
    };

    const { componentType, parameterId, targetValue, tolerance } = this.activeTask.setParameter;

    const typeMatches = payload.componentType === componentType;
    const paramMatches = payload.parameterId === parameterId;
    const valueInRange =
      typeof payload.value === 'number' &&
      Math.abs(payload.value - targetValue) <= tolerance;

    if (typeMatches && paramMatches && valueInRange) {
      this.markComplete();
    }
  }

  private markComplete(): void {
    this.alreadyCompleted = true;
    this.unsubscribeAll();
    this.completeCallback?.();
  }

  private unsubscribeAll(): void {
    this.unsubscribeConnection?.();
    this.unsubscribeParameter?.();
    this.unsubscribeConnection = null;
    this.unsubscribeParameter = null;
  }
}

import { eventBus } from '../core/EventBus';
export const lessonTaskValidator = new LessonTaskValidator(eventBus);
