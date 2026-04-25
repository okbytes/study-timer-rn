import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { StudyTimerActivityState, StudyTimerModuleEvents } from './StudyTimerModule.types';

declare class StudyTimerModule extends NativeModule<StudyTimerModuleEvents> {
  startActivity(
    sessionName: string,
    sessionId: string,
    status: string,
    accumulatedElapsedMs: number,
    runningSinceMs: number | null,
    pausedAtMs: number | null
  ): Promise<void>;
  updateActivity(
    sessionName: string,
    sessionId: string,
    status: string,
    accumulatedElapsedMs: number,
    runningSinceMs: number | null,
    pausedAtMs: number | null
  ): Promise<void>;
  endActivity(): Promise<void>;
}

const nativeModule = requireOptionalNativeModule<StudyTimerModule>('StudyTimerModule');

function toNativeArgs(state: StudyTimerActivityState) {
  return [
    state.sessionName,
    state.sessionId,
    state.status,
    state.accumulatedElapsedMs,
    state.runningSinceMs,
    state.pausedAtMs,
  ] as const;
}

export function startActivity(state: StudyTimerActivityState): Promise<void> {
  return nativeModule?.startActivity(...toNativeArgs(state)) ?? Promise.resolve();
}

export function updateActivity(state: StudyTimerActivityState): Promise<void> {
  return nativeModule?.updateActivity(...toNativeArgs(state)) ?? Promise.resolve();
}

export function endActivity(): Promise<void> {
  return nativeModule?.endActivity() ?? Promise.resolve();
}

export default nativeModule;
