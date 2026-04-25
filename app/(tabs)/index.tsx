import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { endActivity, startActivity, updateActivity } from '@/modules/study-timer-module';
import type { StudyTimerActivityState } from '@/modules/study-timer-module';

const DEFAULT_SESSION_NAME = 'Chapter 5 Review';
const HOUR_MS = 60 * 60 * 1000;
const SESSION_STORAGE_FILE = new File(Paths.document, 'study-timer-session.json');

type RunningTimerSession = {
  sessionName: string;
  sessionId: string;
  status: 'running';
  accumulatedElapsedMs: number;
  runningSinceMs: number;
  pausedAtMs: null;
};

type PausedTimerSession = {
  sessionName: string;
  sessionId: string;
  status: 'paused';
  accumulatedElapsedMs: number;
  runningSinceMs: null;
  pausedAtMs: number;
};

type TimerSession = RunningTimerSession | PausedTimerSession;

type PersistedTimerState = {
  version: 1;
  sessionName: string;
  session: TimerSession | null;
};

function formatElapsedTime(totalMs: number) {
  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

async function callLiveActivity(action: () => Promise<void>) {
  if (Platform.OS !== 'ios') {
    return;
  }

  try {
    await action();
  } catch (error) {
    console.warn('Live Activity bridge call failed', error);
  }
}

function createSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getElapsedMs(session: TimerSession | null, currentTimeMs: number) {
  if (!session) {
    return 0;
  }

  if (session.status === 'paused') {
    return session.accumulatedElapsedMs;
  }

  return session.accumulatedElapsedMs + (currentTimeMs - session.runningSinceMs);
}

function toActivityState(session: TimerSession): StudyTimerActivityState {
  return {
    sessionName: session.sessionName,
    sessionId: session.sessionId,
    status: session.status,
    accumulatedElapsedMs: session.accumulatedElapsedMs,
    runningSinceMs: session.runningSinceMs,
    pausedAtMs: session.pausedAtMs,
  };
}

function isTimerSession(value: unknown): value is TimerSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<TimerSession>;
  const hasBaseFields =
    typeof candidate.sessionName === 'string' &&
    typeof candidate.sessionId === 'string' &&
    typeof candidate.accumulatedElapsedMs === 'number';

  if (!hasBaseFields) {
    return false;
  }

  if (candidate.status === 'running') {
    return typeof candidate.runningSinceMs === 'number' && candidate.pausedAtMs === null;
  }

  return candidate.status === 'paused' && candidate.runningSinceMs === null && typeof candidate.pausedAtMs === 'number';
}

async function loadPersistedTimerState(): Promise<PersistedTimerState | null> {
  try {
    if (!SESSION_STORAGE_FILE.exists) {
      return null;
    }

    const parsed = JSON.parse(await SESSION_STORAGE_FILE.text()) as Partial<PersistedTimerState>;
    if (parsed.version !== 1 || typeof parsed.sessionName !== 'string') {
      return null;
    }

    return {
      version: 1,
      sessionName: parsed.sessionName,
      session: isTimerSession(parsed.session) ? parsed.session : null,
    };
  } catch (error) {
    console.warn('Unable to load study timer session', error);
    return null;
  }
}

async function persistTimerState(state: PersistedTimerState) {
  try {
    if (!SESSION_STORAGE_FILE.exists) {
      SESSION_STORAGE_FILE.create({ intermediates: true, overwrite: true });
    }

    SESSION_STORAGE_FILE.write(JSON.stringify(state));
  } catch (error) {
    console.warn('Unable to persist study timer session', error);
  }
}

export default function HomeScreen() {
  const [sessionName, setSessionName] = useState(DEFAULT_SESSION_NAME);
  const [session, setSession] = useState<TimerSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [hasLoadedPersistedState, setHasLoadedPersistedState] = useState(false);

  const elapsedMs = useMemo(() => getElapsedMs(session, now), [now, session]);

  const progress = Math.min((elapsedMs % HOUR_MS) / HOUR_MS, 1);
  const displayName = session ? session.sessionName : sessionName.trim() || DEFAULT_SESSION_NAME;

  useEffect(() => {
    let isMounted = true;

    void loadPersistedTimerState().then((persistedState) => {
      if (!isMounted) {
        return;
      }

      if (persistedState) {
        setSessionName(persistedState.sessionName);
        setSession(persistedState.session);
      }

      setHasLoadedPersistedState(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedPersistedState) {
      return;
    }

    void persistTimerState({
      version: 1,
      sessionName,
      session,
    });
  }, [hasLoadedPersistedState, session, sessionName]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const beginSession = async () => {
    const name = sessionName.trim() || DEFAULT_SESSION_NAME;
    const runningSinceMs = Date.now();
    const nextSession: TimerSession = {
      sessionName: name,
      sessionId: createSessionId(),
      status: 'running',
      accumulatedElapsedMs: 0,
      runningSinceMs,
      pausedAtMs: null,
    };

    setNow(runningSinceMs);
    setSession(nextSession);

    await callLiveActivity(() => startActivity(toActivityState(nextSession)));
  };

  const pauseSession = async () => {
    if (!session || session.status === 'paused') {
      return;
    }

    const pausedAt = Date.now();
    const nextSession: TimerSession = {
      ...session,
      status: 'paused',
      accumulatedElapsedMs: getElapsedMs(session, pausedAt),
      runningSinceMs: null,
      pausedAtMs: pausedAt,
    };

    setNow(pausedAt);
    setSession(nextSession);

    await callLiveActivity(() => updateActivity(toActivityState(nextSession)));
  };

  const resumeSession = async () => {
    if (!session || session.status === 'running') {
      return;
    }

    const runningSinceMs = Date.now();
    const nextSession: TimerSession = {
      ...session,
      status: 'running',
      runningSinceMs,
      pausedAtMs: null,
    };

    setNow(runningSinceMs);
    setSession(nextSession);

    await callLiveActivity(() => updateActivity(toActivityState(nextSession)));
  };

  const stopSession = async () => {
    setSession(null);
    await callLiveActivity(endActivity);
  };

  const confirmStop = () => {
    if (Platform.OS === 'web') {
      void stopSession();
      return;
    }

    Alert.alert('Stop session?', 'This ends the timer and dismisses the Live Activity.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: () => void stopSession() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
        style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="book" size={22} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.eyebrow}>Study Timer</Text>
            <Text style={styles.headerTitle}>Focus session</Text>
          </View>
        </View>

        <View style={styles.timerPanel}>
          <Text style={styles.sessionName} numberOfLines={2}>
            {displayName}
          </Text>

          <Text style={styles.elapsed}>{formatElapsedTime(elapsedMs)}</Text>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(progress * 100, 2)}%` }]} />
          </View>

          <View style={styles.stateRow}>
            <View style={[styles.statusDot, session?.status === 'running' ? styles.dotRunning : styles.dotIdle]} />
            <Text style={styles.statusText}>
              {session ? (session.status === 'running' ? 'Running' : 'Paused') : 'Ready'}
            </Text>
          </View>

          <View style={styles.controls}>
            <Pressable
              accessibilityRole="button"
              disabled={!session}
              onPress={session?.status === 'running' ? pauseSession : resumeSession}
              style={({ pressed }) => [
                styles.controlButton,
                styles.secondaryButton,
                !session && styles.disabledButton,
                pressed && session && styles.pressed,
              ]}>
              <Ionicons
                name={session?.status === 'running' ? 'pause' : 'play'}
                size={18}
                color={session ? '#14312A' : '#9CA3AF'}
              />
              <Text style={[styles.secondaryButtonText, !session && styles.disabledText]}>
                {session?.status === 'running' ? 'Pause' : 'Resume'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={!session}
              onPress={confirmStop}
              style={({ pressed }) => [
                styles.controlButton,
                styles.stopButton,
                !session && styles.disabledButton,
                pressed && session && styles.pressed,
              ]}>
              <Ionicons name="stop" size={17} color={session ? '#FFFFFF' : '#9CA3AF'} />
              <Text style={[styles.stopButtonText, !session && styles.disabledText]}>Stop</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.newSession}>
          <Text style={styles.sectionLabel}>Start New Session</Text>
          <View style={styles.inputRow}>
            <TextInput
              editable={session?.status !== 'running'}
              onChangeText={setSessionName}
              placeholder="Session name"
              placeholderTextColor="#7C8580"
              returnKeyType="done"
              style={styles.input}
              value={sessionName}
            />
            <Pressable
              accessibilityRole="button"
              disabled={Boolean(session)}
              onPress={beginSession}
              style={({ pressed }) => [
                styles.startButton,
                session && styles.disabledButton,
                pressed && !session && styles.pressed,
              ]}>
              <Ionicons name="add" size={22} color={session ? '#9CA3AF' : '#FFFFFF'} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F0E8',
  },
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 26,
  },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: '#315C4E',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  eyebrow: {
    color: '#68746E',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#16221D',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 34,
  },
  timerPanel: {
    alignItems: 'center',
    backgroundColor: '#FFFCF6',
    borderColor: '#E2D8C8',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 34,
    shadowColor: '#1D2B24',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  sessionName: {
    color: '#1A2922',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 30,
    maxWidth: 280,
    minHeight: 60,
    textAlign: 'center',
  },
  elapsed: {
    color: '#111A16',
    fontVariant: ['tabular-nums'],
    fontSize: 54,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 64,
    marginTop: 14,
  },
  progressTrack: {
    backgroundColor: '#E6DFD2',
    borderRadius: 999,
    height: 8,
    marginTop: 18,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    backgroundColor: '#2E7A63',
    borderRadius: 999,
    height: '100%',
  },
  stateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  statusDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  dotRunning: {
    backgroundColor: '#2E7A63',
  },
  dotIdle: {
    backgroundColor: '#CB6D51',
  },
  statusText: {
    color: '#59645F',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
    width: '100%',
  },
  controlButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 50,
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: '#DCEADF',
  },
  secondaryButtonText: {
    color: '#14312A',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  stopButton: {
    backgroundColor: '#C5543B',
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  disabledButton: {
    backgroundColor: '#E7E1D7',
  },
  disabledText: {
    color: '#9CA3AF',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  newSession: {
    borderTopColor: '#D8CFC0',
    borderTopWidth: 1,
    marginTop: 30,
    paddingTop: 26,
  },
  sectionLabel: {
    color: '#38463F',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 12,
    textAlign: 'center',
  },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    backgroundColor: '#FFFCF6',
    borderColor: '#D8CFC0',
    borderRadius: 8,
    borderWidth: 1,
    color: '#17231E',
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    height: 52,
    letterSpacing: 0,
    paddingHorizontal: 16,
  },
  startButton: {
    alignItems: 'center',
    backgroundColor: '#315C4E',
    borderRadius: 8,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
});
