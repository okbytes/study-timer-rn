import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { StudyTimerActivityState, StudyTimerModuleEvents } from './StudyTimerModule.types';

declare class StudyTimerModule extends NativeModule<StudyTimerModuleEvents> {
  startActivity(
    sessionName: string,
    sessionId: string,
    status: string,
    durationMs: number,
    accumulatedElapsedMs: number,
    runningSinceMs: number | null,
    pausedAtMs: number | null
  ): Promise<void>;
  updateActivity(
    sessionName: string,
    sessionId: string,
    status: string,
    durationMs: number,
    accumulatedElapsedMs: number,
    runningSinceMs: number | null,
    pausedAtMs: number | null
  ): Promise<void>;
  completeActivity(
    sessionName: string,
    sessionId: string,
    status: string,
    durationMs: number,
    accumulatedElapsedMs: number,
    runningSinceMs: number | null,
    pausedAtMs: number | null
  ): Promise<void>;
  endActivity(): Promise<void>;
}

const nativeModule = requireOptionalNativeModule<StudyTimerModule>('StudyTimerModule');

function getNativeModule() {
  if (!nativeModule) {
    throw new Error(
      'StudyTimerModule is not linked into this iOS build. Rebuild/reinstall the app with `bun run ios:rebuild`.'
    );
  }

  return nativeModule;
}

function toNativeArgs(state: StudyTimerActivityState) {
  return [
    state.sessionName,
    state.sessionId,
    state.status,
    state.durationMs,
    state.accumulatedElapsedMs,
    state.runningSinceMs,
    state.pausedAtMs,
  ] as const;
}

export function startActivity(state: StudyTimerActivityState): Promise<void> {
  return getNativeModule().startActivity(...toNativeArgs(state));
}

export function updateActivity(state: StudyTimerActivityState): Promise<void> {
  return getNativeModule().updateActivity(...toNativeArgs(state));
}

export function completeActivity(state: StudyTimerActivityState): Promise<void> {
  return getNativeModule().completeActivity(...toNativeArgs(state));
}

export function endActivity(): Promise<void> {
  return getNativeModule().endActivity();
}

export default nativeModule;
