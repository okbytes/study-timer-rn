import ExpoModulesCore

#if canImport(ActivityKit)
import ActivityKit
#endif

public class StudyTimerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StudyTimerModule")

    AsyncFunction("startActivity") {
      (
        sessionName: String,
        sessionId: String,
        status: String,
        durationMs: Double,
        accumulatedElapsedMs: Double,
        runningSinceMs: Double?,
        pausedAtMs: Double?
      ) async throws in
      #if canImport(ActivityKit)
      guard #available(iOS 16.1, *) else {
        throw LiveActivityUnavailableException()
      }

      try await StudyTimerActivityController.startActivity(
        sessionName: sessionName,
        sessionId: sessionId,
        status: StudyTimerStatus(rawValue: status) ?? .running,
        durationMs: durationMs,
        accumulatedElapsedMs: accumulatedElapsedMs,
        runningSince: Date.studyTimerDate(fromJavaScriptTime: runningSinceMs),
        pausedAt: Date.studyTimerDate(fromJavaScriptTime: pausedAtMs)
      )
      #else
      throw LiveActivityUnavailableException()
      #endif
    }

    AsyncFunction("updateActivity") {
      (
        sessionName: String,
        sessionId: String,
        status: String,
        durationMs: Double,
        accumulatedElapsedMs: Double,
        runningSinceMs: Double?,
        pausedAtMs: Double?
      ) async throws in
      #if canImport(ActivityKit)
      guard #available(iOS 16.1, *) else {
        throw LiveActivityUnavailableException()
      }

      await StudyTimerActivityController.updateActivity(
        sessionName: sessionName,
        sessionId: sessionId,
        status: StudyTimerStatus(rawValue: status) ?? .paused,
        durationMs: durationMs,
        accumulatedElapsedMs: accumulatedElapsedMs,
        runningSince: Date.studyTimerDate(fromJavaScriptTime: runningSinceMs),
        pausedAt: Date.studyTimerDate(fromJavaScriptTime: pausedAtMs)
      )
      #else
      throw LiveActivityUnavailableException()
      #endif
    }

    AsyncFunction("completeActivity") {
      (
        sessionName: String,
        sessionId: String,
        status: String,
        durationMs: Double,
        accumulatedElapsedMs: Double,
        runningSinceMs: Double?,
        pausedAtMs: Double?
      ) async throws in
      #if canImport(ActivityKit)
      guard #available(iOS 16.1, *) else {
        throw LiveActivityUnavailableException()
      }

      await StudyTimerActivityController.completeActivity(
        sessionName: sessionName,
        sessionId: sessionId,
        status: StudyTimerStatus(rawValue: status) ?? .completed,
        durationMs: durationMs,
        accumulatedElapsedMs: accumulatedElapsedMs,
        runningSince: Date.studyTimerDate(fromJavaScriptTime: runningSinceMs),
        pausedAt: Date.studyTimerDate(fromJavaScriptTime: pausedAtMs)
      )
      #else
      throw LiveActivityUnavailableException()
      #endif
    }

    AsyncFunction("endActivity") { () async throws in
      #if canImport(ActivityKit)
      guard #available(iOS 16.1, *) else {
        throw LiveActivityUnavailableException()
      }

      await StudyTimerActivityController.endActivity()
      #else
      throw LiveActivityUnavailableException()
      #endif
    }
  }
}

private extension Date {
  static func studyTimerDate(fromJavaScriptTime value: Double?) -> Date? {
    guard let value else {
      return nil
    }

    guard value.isFinite else {
      return nil
    }

    let seconds = value > 10_000_000_000 ? value / 1_000 : value
    return Date(timeIntervalSince1970: seconds)
  }
}

private enum StudyTimerStatus: String {
  case idle
  case running
  case paused
  case completed
}

private final class LiveActivityUnavailableException: Exception {
  override var reason: String {
    "Live Activities require ActivityKit on iOS 16.1 or newer."
  }
}

#if canImport(ActivityKit)
@available(iOS 16.1, *)
private enum StudyTimerActivityController {
  static func startActivity(
    sessionName: String,
    sessionId: String,
    status: StudyTimerStatus,
    durationMs: Double,
    accumulatedElapsedMs: Double,
    runningSince: Date?,
    pausedAt: Date?
  ) async throws {
    await endActivity()

    let attributes = StudyTimerActivityAttributes(
      initialSessionName: sessionName,
      sessionId: sessionId
    )
    let state = StudyTimerActivityAttributes.ContentState(
      sessionName: sessionName,
      sessionId: sessionId,
      status: status.rawValue,
      durationMs: normalizedDurationMs(durationMs),
      accumulatedElapsedMs: clampedElapsedMs(accumulatedElapsedMs, durationMs: durationMs),
      runningSince: runningSince,
      pausedAt: pausedAt
    )
    let activity = try Activity<StudyTimerActivityAttributes>.request(
      attributes: attributes,
      contentState: state,
      pushType: nil
    )
    print("StudyTimer Live Activity requested: \(activity.id)")
  }

  static func updateActivity(
    sessionName: String,
    sessionId: String,
    status: StudyTimerStatus,
    durationMs: Double,
    accumulatedElapsedMs: Double,
    runningSince: Date?,
    pausedAt: Date?
  ) async {
    for activity in Activity<StudyTimerActivityAttributes>.activities {
      guard activity.attributes.sessionId == sessionId else {
        continue
      }

      let state = StudyTimerActivityAttributes.ContentState(
        sessionName: sessionName,
        sessionId: sessionId,
        status: status.rawValue,
        durationMs: normalizedDurationMs(durationMs),
        accumulatedElapsedMs: clampedElapsedMs(accumulatedElapsedMs, durationMs: durationMs),
        runningSince: runningSince,
        pausedAt: pausedAt
      )

      await activity.update(using: state)
    }
  }

  static func completeActivity(
    sessionName: String,
    sessionId: String,
    status: StudyTimerStatus,
    durationMs: Double,
    accumulatedElapsedMs: Double,
    runningSince: Date?,
    pausedAt: Date?
  ) async {
    for activity in Activity<StudyTimerActivityAttributes>.activities {
      guard activity.attributes.sessionId == sessionId else {
        continue
      }

      let state = StudyTimerActivityAttributes.ContentState(
        sessionName: sessionName,
        sessionId: sessionId,
        status: status.rawValue,
        durationMs: normalizedDurationMs(durationMs),
        accumulatedElapsedMs: clampedElapsedMs(accumulatedElapsedMs, durationMs: durationMs),
        runningSince: runningSince,
        pausedAt: pausedAt
      )

      await activity.end(
        using: state,
        dismissalPolicy: .immediate
      )
    }
  }

  static func endActivity() async {
    for activity in Activity<StudyTimerActivityAttributes>.activities {
      let state = StudyTimerActivityAttributes.ContentState(
        sessionName: activity.contentState.sessionName,
        sessionId: activity.contentState.sessionId,
        status: StudyTimerStatus.idle.rawValue,
        durationMs: activity.contentState.durationMs,
        accumulatedElapsedMs: activity.contentState.resolvedElapsedMs(at: Date()),
        runningSince: nil,
        pausedAt: Date()
      )

      await activity.end(
        using: state,
        dismissalPolicy: .immediate
      )
    }
  }

  private static func normalizedDurationMs(_ durationMs: Double) -> Double {
    guard durationMs.isFinite else {
      return 0
    }

    return max(durationMs, 0)
  }

  private static func clampedElapsedMs(_ elapsedMs: Double, durationMs: Double) -> Double {
    guard elapsedMs.isFinite else {
      return 0
    }

    return min(max(elapsedMs, 0), normalizedDurationMs(durationMs))
  }
}

@available(iOS 16.1, *)
private extension StudyTimerActivityAttributes.ContentState {
  func resolvedElapsedMs(at date: Date) -> Double {
    let safeDurationMs = max(durationMs.isFinite ? durationMs : 0, 0)
    let safeAccumulatedElapsedMs = min(
      max(accumulatedElapsedMs.isFinite ? accumulatedElapsedMs : 0, 0),
      safeDurationMs
    )

    guard status == StudyTimerStatus.running.rawValue, let runningSince else {
      return safeAccumulatedElapsedMs
    }

    let elapsedMs = safeAccumulatedElapsedMs + date.timeIntervalSince(runningSince) * 1_000
    guard elapsedMs.isFinite else {
      return safeAccumulatedElapsedMs
    }

    return min(max(elapsedMs, 0), safeDurationMs)
  }
}
#endif
