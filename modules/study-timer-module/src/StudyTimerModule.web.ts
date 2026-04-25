import { NativeModule, registerWebModule } from 'expo';

import type { StudyTimerActivityState, StudyTimerModuleEvents } from './StudyTimerModule.types';

class StudyTimerModule extends NativeModule<StudyTimerModuleEvents> {
  async startActivity(
    _sessionName: string,
    _sessionId: string,
    _status: string,
    _durationMs: number,
    _accumulatedElapsedMs: number,
    _runningSinceMs: number | null,
    _pausedAtMs: number | null
  ): Promise<void> {
    throw new Error('Live Activities are only available on iOS.');
  }

  async updateActivity(
    _sessionName: string,
    _sessionId: string,
    _status: string,
    _durationMs: number,
    _accumulatedElapsedMs: number,
    _runningSinceMs: number | null,
    _pausedAtMs: number | null
  ): Promise<void> {
    throw new Error('Live Activities are only available on iOS.');
  }

  async completeActivity(
    _sessionName: string,
    _sessionId: string,
    _status: string,
    _durationMs: number,
    _accumulatedElapsedMs: number,
    _runningSinceMs: number | null,
    _pausedAtMs: number | null
  ): Promise<void> {
    throw new Error('Live Activities are only available on iOS.');
  }

  async endActivity(): Promise<void> {
    throw new Error('Live Activities are only available on iOS.');
  }
}

const webModule = registerWebModule(
  StudyTimerModule,
  'StudyTimerModule'
) as unknown as StudyTimerModule;

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
  return webModule.startActivity(...toNativeArgs(state));
}

export function updateActivity(state: StudyTimerActivityState): Promise<void> {
  return webModule.updateActivity(...toNativeArgs(state));
}

export function completeActivity(state: StudyTimerActivityState): Promise<void> {
  return webModule.completeActivity(...toNativeArgs(state));
}

export function endActivity(): Promise<void> {
  return webModule.endActivity();
}

export default webModule;
