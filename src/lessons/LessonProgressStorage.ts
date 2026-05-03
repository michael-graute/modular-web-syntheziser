import {
  type LessonProgress,
  LESSON_PROGRESS_DEFAULT,
  LESSON_PROGRESS_STORAGE_KEY,
} from './types';
import { isValidLessonProgress } from './validation';

class LessonProgressStorage {
  private inMemoryFallback: LessonProgress | null = null;
  private usingFallback = false;

  get isUsingFallback(): boolean {
    return this.usingFallback;
  }

  loadProgress(): LessonProgress {
    if (this.usingFallback) {
      return this.inMemoryFallback ?? { ...LESSON_PROGRESS_DEFAULT };
    }

    try {
      const raw = localStorage.getItem(LESSON_PROGRESS_STORAGE_KEY);
      if (raw === null) return { ...LESSON_PROGRESS_DEFAULT };

      const parsed: unknown = JSON.parse(raw);
      if (isValidLessonProgress(parsed)) return parsed;
      return { ...LESSON_PROGRESS_DEFAULT };
    } catch {
      return { ...LESSON_PROGRESS_DEFAULT };
    }
  }

  saveProgress(progress: LessonProgress): void {
    if (this.usingFallback) {
      this.inMemoryFallback = progress;
      return;
    }

    try {
      localStorage.setItem(LESSON_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    } catch {
      this.usingFallback = true;
      this.inMemoryFallback = progress;
    }
  }

  clearProgress(): void {
    if (this.usingFallback) {
      this.inMemoryFallback = { ...LESSON_PROGRESS_DEFAULT };
      return;
    }

    try {
      localStorage.removeItem(LESSON_PROGRESS_STORAGE_KEY);
    } catch {
      this.usingFallback = true;
      this.inMemoryFallback = { ...LESSON_PROGRESS_DEFAULT };
    }
  }
}

export const lessonProgressStorage = new LessonProgressStorage();
export { LessonProgressStorage };
