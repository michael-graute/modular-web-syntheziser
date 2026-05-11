import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LessonProgressStorage } from '../../src/lessons/LessonProgressStorage';
import { LESSON_PROGRESS_DEFAULT, LESSON_PROGRESS_STORAGE_KEY } from '../../src/lessons/types';

describe('LessonProgressStorage', () => {
  let storage: LessonProgressStorage;

  beforeEach(() => {
    storage = new LessonProgressStorage();
  });

  it('returns default when key is absent', () => {
    const progress = storage.loadProgress();
    expect(progress).toEqual(LESSON_PROGRESS_DEFAULT);
  });

  it('saveProgress writes and loadProgress reads back', () => {
    const data = { completedLessons: ['lesson-01'], currentLessonId: 'lesson-02', version: 1 as const };
    storage.saveProgress(data);
    expect(storage.loadProgress()).toEqual(data);
  });

  it('clearProgress removes key and returns default on next read', () => {
    storage.saveProgress({ completedLessons: ['lesson-01'], currentLessonId: 'lesson-02', version: 1 });
    storage.clearProgress();
    expect(storage.loadProgress()).toEqual(LESSON_PROGRESS_DEFAULT);
  });

  it('returns default when stored JSON is invalid shape', () => {
    localStorage.setItem(LESSON_PROGRESS_STORAGE_KEY, JSON.stringify({ invalid: true }));
    expect(storage.loadProgress()).toEqual(LESSON_PROGRESS_DEFAULT);
  });

  it('falls back to in-memory when localStorage.setItem throws', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    const data = { completedLessons: ['lesson-01'], currentLessonId: null, version: 1 as const };
    storage.saveProgress(data);

    expect(storage.isUsingFallback).toBe(true);
    expect(storage.loadProgress()).toEqual(data);
  });

  it('in-memory fallback: clearProgress resets to default', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    storage.saveProgress({ completedLessons: ['lesson-01'], currentLessonId: 'lesson-02', version: 1 });
    storage.clearProgress();
    expect(storage.loadProgress()).toEqual(LESSON_PROGRESS_DEFAULT);
  });
});
