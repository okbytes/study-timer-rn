import type { StyleProp, ViewStyle } from 'react-native';

export type StudyTimerModuleEvents = Record<string, never>;

export type StudyTimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export type StudyTimerActivityState = {
  sessionName: string;
  sessionId: string;
  status: StudyTimerStatus;
  durationMs: number;
  accumulatedElapsedMs: number;
  runningSinceMs: number | null;
  pausedAtMs: number | null;
};

export type StudyTimerNativeModule = {
  startActivity(state: StudyTimerActivityState): Promise<void>;
  updateActivity(state: StudyTimerActivityState): Promise<void>;
  completeActivity(state: StudyTimerActivityState): Promise<void>;
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
