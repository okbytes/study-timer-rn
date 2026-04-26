import { Alert, Platform } from 'react-native';

import {
  completeActivity,
  endActivity,
  startActivity,
  updateActivity,
} from './StudyTimerModule';
import type { LiveActivityPort, StudyTimerCheckpoint } from './StudyTimerModule.types';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown Live Activity error.';
  }
}

async function callLiveActivity(action: () => Promise<void>) {
  if (Platform.OS !== 'ios') {
    return;
  }

  try {
    await action();
  } catch (error) {
    console.warn('Live Activity bridge call failed', error);
    Alert.alert('Live Activity failed', getErrorMessage(error));
  }
}

export function createIosLiveActivityAdapter(): LiveActivityPort {
  let activeSessionId: string | null = null;

  return {
    async sync(checkpoint: StudyTimerCheckpoint) {
      if (activeSessionId !== checkpoint.sessionId) {
        activeSessionId = checkpoint.sessionId;
        await callLiveActivity(() => startActivity(checkpoint));
        return;
      }

      if (checkpoint.status === 'completed') {
        await callLiveActivity(() => completeActivity(checkpoint));
        return;
      }

      await callLiveActivity(() => updateActivity(checkpoint));
    },
    async clear() {
      activeSessionId = null;
      await callLiveActivity(endActivity);
    },
  };
}
