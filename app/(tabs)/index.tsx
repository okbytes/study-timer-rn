import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DimensionValue } from "react-native";
import {
  Animated,
  Alert,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { StudyTimerActivityState } from "@/modules/study-timer-module";
import {
  completeActivity,
  endActivity,
  startActivity,
  updateActivity,
} from "@/modules/study-timer-module";

const DEFAULT_SESSION_NAME = "Study Timer";
const DEFAULT_DURATION_MS = 25 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DURATION_STEP_MINUTES = 5;
const DURATION_STEP_MS = DURATION_STEP_MINUTES * MINUTE_MS;
const MIN_DURATION_MS = DURATION_STEP_MS;
const MAX_DURATION_MS = (24 * 60 - DURATION_STEP_MINUTES) * MINUTE_MS;

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
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function normalizeDurationMs(durationMs: number) {
  if (!Number.isFinite(durationMs)) {
    return DEFAULT_DURATION_MS;
  }

  const roundedDurationMs =
    Math.round(durationMs / DURATION_STEP_MS) * DURATION_STEP_MS;

  return clamp(roundedDurationMs, MIN_DURATION_MS, MAX_DURATION_MS);
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

function formatDurationDisplay(durationMs: number) {
  const totalMinutes = Math.floor(normalizeDurationMs(durationMs) / MINUTE_MS);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}

async function callLiveActivity(action: () => Promise<void>) {
  if (Platform.OS !== "ios") {
    return;
  }

  try {
    await action();
  } catch (error) {
    console.warn("Live Activity bridge call failed", error);
    Alert.alert("Live Activity failed", getErrorMessage(error));
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown Live Activity error.";
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

export default function HomeScreen() {
  const [sessionName, setSessionName] = useState(DEFAULT_SESSION_NAME);
  const [plannedDurationMs, setPlannedDurationMs] =
    useState(DEFAULT_DURATION_MS);
  const [showPicker, setShowPicker] = useState(false);
  const [tempPickerDurationMs, setTempPickerDurationMs] =
    useState(DEFAULT_DURATION_MS);
  const [session, setSession] = useState<TimerSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pickerAnimation = useRef(new Animated.Value(0)).current;

  const displayDurationMs = session?.durationMs ?? plannedDurationMs;
  const elapsedMs = useMemo(() => getElapsedMs(session, now), [now, session]);
  const remainingMs = useMemo(() => {
    if (!session) {
      return plannedDurationMs;
    }

    return getRemainingMs(session, now);
  }, [now, plannedDurationMs, session]);
  const progress = displayDurationMs > 0 ? elapsedMs / displayDurationMs : 0;
  const backdropOpacity = pickerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const sheetTranslateY = pickerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [420, 0],
  });

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

  useEffect(() => {
    if (!session || !showPicker) {
      return;
    }

    setTempPickerDurationMs(plannedDurationMs);
    setShowPicker(false);
  }, [plannedDurationMs, session, showPicker]);

  useEffect(() => {
    if (!showPicker) {
      return;
    }

    pickerAnimation.setValue(0);
    Animated.timing(pickerAnimation, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [pickerAnimation, showPicker]);

  const completeSession = async (nextSession: CompletedTimerSession) => {
    setNow(nextSession.pausedAtMs);
    setSession(nextSession);

    await callLiveActivity(() =>
      completeActivity(toActivityState(nextSession)),
    );
  };

  const openDurationPicker = () => {
    if (session) {
      return;
    }

    setTempPickerDurationMs(plannedDurationMs);
    setShowPicker(true);
  };

  const closeDurationPicker = (onClosed?: () => void) => {
    Animated.timing(pickerAnimation, {
      duration: 190,
      easing: Easing.in(Easing.cubic),
      toValue: 0,
      useNativeDriver: true,
    }).start(() => {
      onClosed?.();
      setShowPicker(false);
    });
  };

  const cancelDurationPicker = () => {
    closeDurationPicker(() => setTempPickerDurationMs(plannedDurationMs));
  };

  const commitDurationPicker = () => {
    if (session) {
      closeDurationPicker();
      return;
    }

    setPlannedDurationMs(normalizeDurationMs(tempPickerDurationMs));
    closeDurationPicker();
  };

  const beginSession = async () => {
    const name = normalizeSessionName(sessionName);
    const durationMs = normalizeDurationMs(plannedDurationMs);
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
    setPlannedDurationMs(durationMs);
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

          {session ? (
            <>
              <View style={styles.timerTextContainer}>
                <Text style={styles.remaining}>
                  {formatRemainingTime(remainingMs)}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: progressWidth }]} />
              </View>
            </>
          ) : (
            <View style={styles.timerTextContainer}>
              <Pressable
                accessibilityHint="Opens the duration picker"
                accessibilityLabel="Study duration"
                accessibilityRole="button"
                onPress={openDurationPicker}
                style={({ pressed }) => [
                  styles.timerTextPressable,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.remaining}>
                  {formatRemainingTime(remainingMs)}
                </Text>
              </Pressable>
            </View>
          )}

          <Modal
            animationType="none"
            transparent
            visible={showPicker}
            onRequestClose={cancelDurationPicker}
          >
            <View style={styles.modalContainer}>
              <Animated.View
                pointerEvents="none"
                style={[styles.modalScrim, { opacity: backdropOpacity }]}
              />
              <Pressable
                accessibilityLabel="Cancel duration change"
                accessibilityRole="button"
                onPress={cancelDurationPicker}
                style={styles.modalDismissArea}
              />
              <Animated.View
                style={[
                  styles.pickerSheet,
                  { transform: [{ translateY: sheetTranslateY }] },
                ]}
              >
                <Text style={styles.pickerTitle}>Set Duration</Text>

                <View style={styles.fineTuneRow}>
                  <Pressable
                    accessibilityLabel="Decrease duration by 5 minutes"
                    accessibilityRole="button"
                    onPress={() =>
                      setTempPickerDurationMs((prev) =>
                        normalizeDurationMs(prev - DURATION_STEP_MS),
                      )
                    }
                    style={({ pressed }) => [
                      styles.fineTuneButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name="remove" size={22} color="#14312A" />
                  </Pressable>
                  <Text style={styles.selectedDurationText}>
                    {formatDurationDisplay(tempPickerDurationMs)}
                  </Text>
                  <Pressable
                    accessibilityLabel="Increase duration by 5 minutes"
                    accessibilityRole="button"
                    onPress={() =>
                      setTempPickerDurationMs((prev) =>
                        normalizeDurationMs(prev + DURATION_STEP_MS),
                      )
                    }
                    style={({ pressed }) => [
                      styles.fineTuneButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name="add" size={22} color="#14312A" />
                  </Pressable>
                </View>

                <View style={styles.pickerButtons}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={cancelDurationPicker}
                    style={({ pressed }) => [
                      styles.pickerButton,
                      styles.pickerCancelButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.pickerCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={commitDurationPicker}
                    style={({ pressed }) => [
                      styles.pickerButton,
                      styles.pickerDoneButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </View>
          </Modal>

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
  timerTextContainer: {
    alignItems: "center",
    marginTop: 12,
  },
  timerTextPressable: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tapAffordanceText: {
    color: "#7C8580",
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0,
    marginTop: 6,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 0,
  },
  modalDismissArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  pickerSheet: {
    backgroundColor: "#F4F0E8",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingHorizontal: 16,
    paddingTop: 20,
    zIndex: 2,
  },
  pickerTitle: {
    color: "#1A2922",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0,
    textAlign: "center",
  },
  pickerSubtitle: {
    color: "#59645F",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0,
    marginTop: 6,
    textAlign: "center",
  },
  fineTuneRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 18,
    justifyContent: "center",
    marginTop: 28,
  },
  fineTuneButton: {
    alignItems: "center",
    backgroundColor: "#EAE4D9",
    borderRadius: 26,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  selectedDurationText: {
    color: "#1A2922",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0,
    minWidth: 148,
    textAlign: "center",
  },
  pickerButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 32,
    width: "100%",
  },
  pickerButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    height: 44,
    justifyContent: "center",
  },
  pickerCancelButton: {
    backgroundColor: "#EAE4D9",
  },
  pickerCancelText: {
    color: "#59645F",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0,
  },
  pickerDoneButton: {
    backgroundColor: "#315C4E",
  },
  pickerDoneText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0,
  },
});
