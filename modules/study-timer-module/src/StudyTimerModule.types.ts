import type { StyleProp, ViewStyle } from 'react-native';

export type StudyTimerModuleEvents = Record<string, never>;

export type StudyTimerStatus = 'running' | 'paused' | 'completed';

export type StudyTimerDraft = {
  sessionName: string;
  durationMs: number;
};

export type StudyTimerCheckpoint = {
  sessionName: string;
  sessionId: string;
  status: StudyTimerStatus;
  durationMs: number;
  accumulatedElapsedMs: number;
  runningSinceMs: number | null;
  pausedAtMs: number | null;
};

export type StudyTimerSnapshot = {
  draft: StudyTimerDraft;
  session: StudyTimerCheckpoint | null;
  nowMs: number;
  elapsedMs: number;
  remainingMs: number;
  progress: number;
  isDraftLocked: boolean;
};

export type LiveActivityPort = {
  sync(checkpoint: StudyTimerCheckpoint): Promise<void>;
  clear(): Promise<void>;
};

export type StudyTimerController = {
  getSnapshot(): StudyTimerSnapshot;
  subscribe(listener: () => void): () => void;
  setDraftName(name: string): void;
  setDraftDuration(durationMs: number): void;
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  appBecameActive(): Promise<void>;
  tick(nowMs?: number): void;
};

export type StudyTimerNativeModule = {
  startActivity(state: StudyTimerCheckpoint): Promise<void>;
  updateActivity(state: StudyTimerCheckpoint): Promise<void>;
  completeActivity(state: StudyTimerCheckpoint): Promise<void>;
  endActivity(): Promise<void>;
};

export type OnLoadEventPayload = {
  url: string;
};

export type StudyTimerModuleViewProps = {
  url: string;
  onLoad: (event: { nativeEvent: OnLoadEventPayload }) => void;
  style?: StyleProp<ViewStyle>;
};
