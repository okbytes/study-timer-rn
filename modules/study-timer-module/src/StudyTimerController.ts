import type {
  LiveActivityPort,
  StudyTimerCheckpoint,
  StudyTimerController,
  StudyTimerDraft,
  StudyTimerSnapshot,
} from './StudyTimerModule.types';

export const DEFAULT_SESSION_NAME = 'Study Timer';
export const MINUTE_MS = 60 * 1000;
export const FINE_DURATION_STEP_MINUTES = 1;
export const DURATION_STEP_MINUTES = 5;
export const FINE_DURATION_STEP_MS = FINE_DURATION_STEP_MINUTES * MINUTE_MS;
export const DURATION_STEP_MS = DURATION_STEP_MINUTES * MINUTE_MS;
export const DEFAULT_DURATION_MS = 60 * 1000;
export const MIN_DURATION_MS = FINE_DURATION_STEP_MS;
export const MAX_DURATION_MS = (24 * 60 - DURATION_STEP_MINUTES) * MINUTE_MS;

type CreateStudyTimerControllerOptions = {
  liveActivity: LiveActivityPort;
  now?: () => number;
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

export function getStudyTimerDurationStepMs(durationMs: number) {
  return durationMs <= DURATION_STEP_MS ? FINE_DURATION_STEP_MS : DURATION_STEP_MS;
}

export function normalizeStudyTimerDurationMs(durationMs: number) {
  if (!Number.isFinite(durationMs)) {
    return DEFAULT_DURATION_MS;
  }

  const clampedDurationMs = clamp(durationMs, MIN_DURATION_MS, MAX_DURATION_MS);
  const stepMs = getStudyTimerDurationStepMs(clampedDurationMs);
  const roundedDurationMs = Math.round(clampedDurationMs / stepMs) * stepMs;

  return clamp(roundedDurationMs, MIN_DURATION_MS, MAX_DURATION_MS);
}

export function normalizeStudyTimerDraftName(name: string) {
  return name.trim() || DEFAULT_SESSION_NAME;
}

function createSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getElapsedMs(session: StudyTimerCheckpoint | null, nowMs: number) {
  if (!session) {
    return 0;
  }

  if (session.status !== 'running') {
    return clamp(session.accumulatedElapsedMs, 0, session.durationMs);
  }

  const runningSinceMs = session.runningSinceMs ?? nowMs;

  return clamp(
    session.accumulatedElapsedMs + (nowMs - runningSinceMs),
    0,
    session.durationMs
  );
}

function createCompletedCheckpoint(
  session: StudyTimerCheckpoint,
  completedAtMs: number
): StudyTimerCheckpoint {
  return {
    ...session,
    status: 'completed',
    accumulatedElapsedMs: session.durationMs,
    runningSinceMs: null,
    pausedAtMs: completedAtMs,
  };
}

export function createStudyTimerController({
  liveActivity,
  now = Date.now,
}: CreateStudyTimerControllerOptions): StudyTimerController {
  const listeners = new Set<() => void>();

  let draft: StudyTimerDraft = {
    sessionName: DEFAULT_SESSION_NAME,
    durationMs: DEFAULT_DURATION_MS,
  };
  let session: StudyTimerCheckpoint | null = null;
  let nowMs = now();

  function buildSnapshot(): StudyTimerSnapshot {
    const elapsedMs = getElapsedMs(session, nowMs);
    const remainingMs = session ? Math.max(session.durationMs - elapsedMs, 0) : draft.durationMs;
    const progress = session && session.durationMs > 0 ? clamp(elapsedMs / session.durationMs, 0, 1) : 0;

    return {
      draft: { ...draft },
      session: session ? { ...session } : null,
      nowMs,
      elapsedMs,
      remainingMs,
      progress,
      isDraftLocked: session !== null,
    };
  }

  let snapshot = buildSnapshot();

  function refreshSnapshot() {
    snapshot = buildSnapshot();
  }

  function emit() {
    refreshSnapshot();
    listeners.forEach((listener) => listener());
  }

  function setNow(nextNowMs: number) {
    nowMs = nextNowMs;
  }

  function getSnapshot(): StudyTimerSnapshot {
    return snapshot;
  }

  async function syncCompletion(completedAtMs: number) {
    if (!session || session.status !== 'running') {
      return;
    }

    session = createCompletedCheckpoint(session, completedAtMs);
    setNow(completedAtMs);
    emit();
    await liveActivity.sync(session);
  }

  function reconcileCompletion(currentTimeMs: number) {
    if (!session || session.status !== 'running') {
      return false;
    }

    if (getElapsedMs(session, currentTimeMs) < session.durationMs) {
      return false;
    }

    void syncCompletion(currentTimeMs);
    return true;
  }

  return {
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    setDraftName(name) {
      if (session) {
        return;
      }

      draft = {
        ...draft,
        sessionName: name,
      };
      emit();
    },
    setDraftDuration(durationMs) {
      if (session) {
        return;
      }

      draft = {
        ...draft,
        durationMs: normalizeStudyTimerDurationMs(durationMs),
      };
      emit();
    },
    async start() {
      if (session) {
        return;
      }

      const startedAtMs = now();
      draft = {
        sessionName: normalizeStudyTimerDraftName(draft.sessionName),
        durationMs: normalizeStudyTimerDurationMs(draft.durationMs),
      };
      session = {
        sessionName: draft.sessionName,
        sessionId: createSessionId(),
        status: 'running',
        durationMs: draft.durationMs,
        accumulatedElapsedMs: 0,
        runningSinceMs: startedAtMs,
        pausedAtMs: null,
      };
      setNow(startedAtMs);
      emit();
      await liveActivity.sync(session);
    },
    async pause() {
      if (!session || session.status !== 'running') {
        return;
      }

      const pausedAtMs = now();
      const accumulatedElapsedMs = getElapsedMs(session, pausedAtMs);

      if (accumulatedElapsedMs >= session.durationMs) {
        await syncCompletion(pausedAtMs);
        return;
      }

      session = {
        ...session,
        status: 'paused',
        accumulatedElapsedMs,
        runningSinceMs: null,
        pausedAtMs,
      };
      setNow(pausedAtMs);
      emit();
      await liveActivity.sync(session);
    },
    async resume() {
      if (!session || session.status !== 'paused') {
        return;
      }

      const resumedAtMs = now();
      if (session.accumulatedElapsedMs >= session.durationMs) {
        session = createCompletedCheckpoint(session, resumedAtMs);
        setNow(resumedAtMs);
        emit();
        await liveActivity.sync(session);
        return;
      }

      session = {
        ...session,
        status: 'running',
        runningSinceMs: resumedAtMs,
        pausedAtMs: null,
      };
      setNow(resumedAtMs);
      emit();
      await liveActivity.sync(session);
    },
    async stop() {
      if (!session) {
        return;
      }

      session = null;
      setNow(now());
      emit();
      await liveActivity.clear();
    },
    async appBecameActive() {
      const activeNowMs = now();
      setNow(activeNowMs);

      if (reconcileCompletion(activeNowMs)) {
        return;
      }

      emit();
    },
    tick(nextNowMs = now()) {
      setNow(nextNowMs);

      if (reconcileCompletion(nextNowMs)) {
        return;
      }

      emit();
    },
  };
}
