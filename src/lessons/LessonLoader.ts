import type { PatchData } from '../core/types';
import type { LessonData, LessonManifest } from './types';
import { isValidLessonData, isValidLessonManifest } from './validation';

export class LessonLoader {
  async loadManifest(): Promise<LessonManifest> {
    const res = await fetch('/lessons/manifest.json');
    if (!res.ok) {
      throw new Error(`Failed to fetch lesson manifest: ${res.status} ${res.statusText}`);
    }
    const data: unknown = await res.json();
    if (!isValidLessonManifest(data)) {
      throw new Error('Lesson manifest has invalid shape');
    }
    return data;
  }

  async loadLesson(filename: string): Promise<LessonData> {
    const res = await fetch(`/lessons/${filename}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch lesson "${filename}": ${res.status} ${res.statusText}`);
    }
    const data: unknown = await res.json();
    if (!isValidLessonData(data)) {
      throw new Error(`Lesson file "${filename}" has invalid shape`);
    }
    return data;
  }

  async loadLessonPatch(patchFile: string): Promise<PatchData> {
    const res = await fetch(patchFile);
    if (!res.ok) {
      throw new Error(`Failed to fetch lesson patch "${patchFile}": ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as PatchData;
  }
}

export const lessonLoader = new LessonLoader();
