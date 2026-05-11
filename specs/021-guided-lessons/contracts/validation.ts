/**
 * Validation helpers for the Guided Lessons feature (021)
 *
 * Used at runtime to validate lesson JSON loaded from public/lessons/.
 * All functions return boolean; they do not throw.
 */

import type { LessonData, LessonManifest, LessonProgress, LessonTask } from './types';

export function isValidLessonTask(task: unknown): task is LessonTask {
  if (!task || typeof task !== 'object') return false;
  const t = task as Record<string, unknown>;

  if (!['connect', 'set-parameter', 'observe', 'free'].includes(t['type'] as string)) return false;
  if (typeof t['instruction'] !== 'string' || t['instruction'].trim() === '') return false;

  if (t['type'] === 'connect') {
    const c = t['connect'];
    if (!c || typeof c !== 'object') return false;
    const cv = c as Record<string, unknown>;
    if (typeof cv['sourceComponentType'] !== 'string') return false;
    if (typeof cv['targetComponentType'] !== 'string') return false;
    if (typeof cv['targetPortId'] !== 'string') return false;
  }

  if (t['type'] === 'set-parameter') {
    const sp = t['setParameter'];
    if (!sp || typeof sp !== 'object') return false;
    const spv = sp as Record<string, unknown>;
    if (typeof spv['componentType'] !== 'string') return false;
    if (typeof spv['parameterId'] !== 'string') return false;
    if (typeof spv['targetValue'] !== 'number') return false;
    if (typeof spv['tolerance'] !== 'number' || (spv['tolerance'] as number) < 0) return false;
  }

  return true;
}

export function isValidLessonData(data: unknown): data is LessonData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;

  if (typeof d['id'] !== 'string' || d['id'].trim() === '') return false;
  if (typeof d['moduleId'] !== 'string' || d['moduleId'].trim() === '') return false;
  if (typeof d['index'] !== 'number' || d['index'] < 1) return false;
  if (typeof d['title'] !== 'string' || d['title'].trim() === '') return false;
  if (typeof d['concept'] !== 'string') return false;
  if (d['patchFile'] !== null && typeof d['patchFile'] !== 'string') return false;
  if (!Array.isArray(d['highlightComponentTypes'])) return false;
  if (!isValidLessonTask(d['task'])) return false;

  return true;
}

export function isValidLessonManifest(data: unknown): data is LessonManifest {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;

  if (!Array.isArray(d['modules'])) return false;
  for (const mod of d['modules'] as unknown[]) {
    if (!mod || typeof mod !== 'object') return false;
    const m = mod as Record<string, unknown>;
    if (typeof m['id'] !== 'string') return false;
    if (typeof m['number'] !== 'number') return false;
    if (typeof m['title'] !== 'string') return false;
    if (!Array.isArray(m['lessons'])) return false;
  }

  return true;
}

export function isValidLessonProgress(data: unknown): data is LessonProgress {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;

  if (!Array.isArray(d['completedLessons'])) return false;
  if (d['currentLessonId'] !== null && typeof d['currentLessonId'] !== 'string') return false;
  if (d['version'] !== 1) return false;

  return true;
}
