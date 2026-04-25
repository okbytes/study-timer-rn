import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { DimensionValue } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { StudyTimerActivityState } from "@/modules/study-timer-module";
import {
  completeActivity,
  endActivity,
  startActivity,
  updateActivity,
} from "@/modules/study-timer-module";

const DEFAULT_SESSION_NAME = "Study Timer";
const DEFAULT_DURATION_MINUTES = "25";
const MIN_DURATION_MS = 60 * 1000;
const MINUTE_MS = 60 * 1000;

type TimerStatus = "idle" | "running" | "paused" | "completed";

type TimerSessionBase = {
  sessionName: string;
  sessionId: string;
  durationMs: number;
  accumulatedElapsedMs: number;
};

type RunningTimerSession = TimerSessionBase & {
  status: "running";
  runningSinceMs: number;
  pausedAtMs: null;
};

type PausedTimerSession = TimerSessionBase & {
  status: "paused";
  runningSinceMs: null;
  pausedAtMs: number;
};

type CompletedTimerSession = TimerSessionBase & {
  status: "completed";
  runningSinceMs: null;
  pausedAtMs: number;
};

type TimerSession =
  | RunningTimerSession
  | PausedTimerSession
  | CompletedTimerSession;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatRemainingTime(totalMs: number) {
  const totalSeconds = Math.max(Math.ceil(totalMs / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatDurationMinutes(totalMs: number) {
  return String(Math.max(Math.round(totalMs / MINUTE_MS), 1));
}

function parseDurationMs(value: string) {
  const parsedMinutes = Number.parseFloat(value.replace(",", "."));

  if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
    return Number.parseInt(DEFAULT_DURATION_MINUTES, 10) * MINUTE_MS;
  }

  return Math.max(Math.round(parsedMinutes * MINUTE_MS), MIN_DURATION_MS);
}

async function callLiveActivity(action: () => Promise<void>) {
  if (Platform.OS !== "ios") {
    return;
  }

  try {
    await action();
  } catch (error) {
    console.warn("Live Activity bridge call failed", error);
  }
}

function createSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getElapsedMs(session: TimerSession | null, currentTimeMs: number) {
  if (!session) {
    return 0;
  }

  if (session.status !== "running") {
    return clamp(session.accumulatedElapsedMs, 0, session.durationMs);
  }

  return clamp(
    session.accumulatedElapsedMs + (currentTimeMs - session.runningSinceMs),
    0,
    session.durationMs,
  );
}

function getRemainingMs(session: TimerSession | null, currentTimeMs: number) {
  if (!session) {
    return 0;
  }

  return Math.max(session.durationMs - getElapsedMs(session, currentTimeMs), 0);
}

function toActivityState(session: TimerSession): StudyTimerActivityState {
  return {
    sessionName: session.sessionName,
    sessionId: session.sessionId,
    status: session.status,
    durationMs: session.durationMs,
    accumulatedElapsedMs: session.accumulatedElapsedMs,
    runningSinceMs: session.runningSinceMs,
    pausedAtMs: session.pausedAtMs,
  };
}

function normalizeSessionName(name: string) {
  return name.trim() || DEFAULT_SESSION_NAME;
}

function statusLabel(status: TimerStatus) {
  switch (status) {
    case "running":
      return "Running";
    case "paused":
      return "Paused";
    case "completed":
      return "Completed";
    case "idle":
      return "Ready";
  }
}

export default function HomeScreen() {
  const [sessionName, setSessionName] = useState(DEFAULT_SESSION_NAME);
  const [durationMinutes, setDurationMinutes] = useState(
    DEFAULT_DURATION_MINUTES,
  );
  const [session, setSession] = useState<TimerSession | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const plannedDurationMs = useMemo(
    () => parseDurationMs(durationMinutes),
    [durationMinutes],
  );
  const displayDurationMs = session?.durationMs ?? plannedDurationMs;
  const elapsedMs = useMemo(() => getElapsedMs(session, now), [now, session]);
  const remainingMs = useMemo(() => {
    if (!session) {
      return plannedDurationMs;
    }

    return getRemainingMs(session, now);
  }, [now, plannedDurationMs, session]);
  const progress = displayDurationMs > 0 ? elapsedMs / displayDurationMs : 0;
  const status: TimerStatus = session?.status ?? "idle";

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!session || session.status !== "running" || remainingMs > 0) {
      return;
    }

    const completedAt = Date.now();
    const nextSession: TimerSession = {
      ...session,
      status: "completed",
      accumulatedElapsedMs: session.durationMs,
      runningSinceMs: null,
      pausedAtMs: completedAt,
    };

    setNow(completedAt);
    setSession(nextSession);
    void callLiveActivity(() => completeActivity(toActivityState(nextSession)));
  }, [remainingMs, session]);

  const completeSession = async (nextSession: CompletedTimerSession) => {
    setNow(nextSession.pausedAtMs);
    setSession(nextSession);

    await callLiveActivity(() => completeActivity(toActivityState(nextSession)));
  };

  const beginSession = async () => {
    const name = normalizeSessionName(sessionName);
    const durationMs = parseDurationMs(durationMinutes);
    const runningSinceMs = Date.now();
    const nextSession: TimerSession = {
      sessionName: name,
      sessionId: createSessionId(),
      status: "running",
      durationMs,
      accumulatedElapsedMs: 0,
      runningSinceMs,
      pausedAtMs: null,
    };

    setNow(runningSinceMs);
    setSessionName(name);
    setDurationMinutes(formatDurationMinutes(durationMs));
    setSession(nextSession);

    await callLiveActivity(() => startActivity(toActivityState(nextSession)));
  };

  const updateSessionName = (nextName: string) => {
    setSessionName(nextName);

    if (!session) {
      return;
    }

    setSession({
      ...session,
      sessionName: normalizeSessionName(nextName),
    });
  };

  const normalizeEditableSessionName = () => {
    const normalizedName = normalizeSessionName(sessionName);

    if (normalizedName !== sessionName) {
      setSessionName(normalizedName);
    }

    if (session && normalizedName !== session.sessionName) {
      setSession({
        ...session,
        sessionName: normalizedName,
      });
    }

    return normalizedName;
  };

  const syncSessionNameToLiveActivity = async () => {
    if (!session) {
      normalizeEditableSessionName();
      return;
    }

    const normalizedName = normalizeEditableSessionName();
    const nextSession = {
      ...session,
      sessionName: normalizedName,
    };

    await callLiveActivity(() => updateActivity(toActivityState(nextSession)));
  };

  const pauseSession = async () => {
    if (!session || session.status !== "running") {
      return;
    }

    const pausedAt = Date.now();
    const accumulatedElapsedMs = getElapsedMs(session, pausedAt);

    if (accumulatedElapsedMs >= session.durationMs) {
      await completeSession({
        ...session,
        status: "completed",
        accumulatedElapsedMs: session.durationMs,
        runningSinceMs: null,
        pausedAtMs: pausedAt,
      });
      return;
    }

    const nextSession: TimerSession = {
      ...session,
      status: "paused",
      accumulatedElapsedMs,
      runningSinceMs: null,
      pausedAtMs: pausedAt,
    };

    setNow(pausedAt);
    setSession(nextSession);

    await callLiveActivity(() => updateActivity(toActivityState(nextSession)));
  };

  const resumeSession = async () => {
    if (!session || session.status !== "paused") {
      return;
    }

    if (session.accumulatedElapsedMs >= session.durationMs) {
      await completeSession({
        ...session,
        status: "completed",
        accumulatedElapsedMs: session.durationMs,
        pausedAtMs: Date.now(),
      });
      return;
    }

    const runningSinceMs = Date.now();
    const nextSession: TimerSession = {
      ...session,
      status: "running",
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

  const progressWidth = `${clamp(progress, 0, 1) * 100}%` as DimensionValue;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", default: undefined })}
        style={styles.screen}
      >
        <View style={styles.timerPanel}>
          <TextInput
            accessibilityLabel="Session name"
            onBlur={() => void syncSessionNameToLiveActivity()}
            onChangeText={updateSessionName}
            onSubmitEditing={() => void syncSessionNameToLiveActivity()}
            placeholder={DEFAULT_SESSION_NAME}
            placeholderTextColor="#7C8580"
            returnKeyType="done"
            style={styles.sessionNameInput}
            value={sessionName}
          />

          <View style={styles.durationRow}>
            <TextInput
              accessibilityLabel="Duration in minutes"
              editable={!session}
              inputMode="decimal"
              keyboardType="decimal-pad"
              onBlur={() =>
                setDurationMinutes(formatDurationMinutes(plannedDurationMs))
              }
              onChangeText={setDurationMinutes}
              placeholder={DEFAULT_DURATION_MINUTES}
              placeholderTextColor="#7C8580"
              returnKeyType="done"
              style={[
                styles.durationInput,
                session && styles.durationInputDisabled,
              ]}
              value={durationMinutes}
            />
            <Text style={styles.durationUnit}>min</Text>
          </View>

          <Text style={styles.remaining}>{formatRemainingTime(remainingMs)}</Text>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressWidth }]} />
          </View>

          <View style={styles.stateRow}>
            <View
              style={[
                styles.statusDot,
                status === "running" && styles.dotRunning,
                status === "paused" && styles.dotPaused,
                status === "completed" && styles.dotCompleted,
                status === "idle" && styles.dotIdle,
              ]}
            />
            <Text style={styles.statusText}>{statusLabel(status)}</Text>
          </View>

          {session && session.status !== "completed" ? (
            <View style={styles.controls}>
              <Pressable
                accessibilityRole="button"
                onPress={
                  session.status === "running" ? pauseSession : resumeSession
                }
                style={({ pressed }) => [
                  styles.controlButton,
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={session.status === "running" ? "pause" : "play"}
                  size={18}
                  color="#14312A"
                />
                <Text style={styles.secondaryButtonText}>
                  {session.status === "running" ? "Pause" : "Resume"}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => void stopSession()}
                style={({ pressed }) => [
                  styles.controlButton,
                  styles.stopButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="stop" size={17} color="#FFFFFF" />
                <Text style={styles.stopButtonText}>Stop</Text>
              </Pressable>
            </View>
          ) : session ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void stopSession()}
              style={({ pressed }) => [
                styles.startSessionButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text style={styles.startSessionButtonText}>Done</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={beginSession}
              style={({ pressed }) => [
                styles.startSessionButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="play" size={18} color="#FFFFFF" />
              <Text style={styles.startSessionButtonText}>
                Start Study Session
              </Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F0E8",
  },
  screen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  timerPanel: {
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 34,
  },
  sessionNameInput: {
    color: "#1A2922",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 30,
    maxWidth: 280,
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlign: "center",
    width: "100%",
  },
  durationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    height: 38,
    justifyContent: "center",
    marginTop: 8,
  },
  durationInput: {
    backgroundColor: "#EAE4D9",
    borderRadius: 8,
    color: "#1A2922",
    fontSize: 16,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    height: 38,
    letterSpacing: 0,
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 0,
    textAlign: "center",
  },
  durationInputDisabled: {
    color: "#59645F",
  },
  durationUnit: {
    color: "#59645F",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0,
  },
  remaining: {
    color: "#111A16",
    fontVariant: ["tabular-nums"],
    fontSize: 54,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 64,
    marginTop: 12,
  },
  progressTrack: {
    backgroundColor: "#E6DFD2",
    borderRadius: 999,
    height: 8,
    marginTop: 18,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: {
    backgroundColor: "#2E7A63",
    borderRadius: 999,
    height: "100%",
  },
  stateRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  statusDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  dotRunning: {
    backgroundColor: "#2E7A63",
  },
  dotPaused: {
    backgroundColor: "#D8953D",
  },
  dotCompleted: {
    backgroundColor: "#315C4E",
  },
  dotIdle: {
    backgroundColor: "#CB6D51",
  },
  statusText: {
    color: "#59645F",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0,
  },
  controls: {
    flexDirection: "row",
    gap: 12,
    marginTop: 28,
    width: "100%",
  },
  controlButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    height: 50,
    justifyContent: "center",
  },
  secondaryButton: {
    backgroundColor: "#DCEADF",
  },
  secondaryButtonText: {
    color: "#14312A",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0,
  },
  stopButton: {
    backgroundColor: "#C5543B",
  },
  stopButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  startSessionButton: {
    alignItems: "center",
    backgroundColor: "#315C4E",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    height: 50,
    justifyContent: "center",
    marginTop: 28,
    width: "100%",
  },
  startSessionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0,
  },
});
