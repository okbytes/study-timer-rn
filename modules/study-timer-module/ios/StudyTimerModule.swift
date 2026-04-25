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

    let seconds = value > 10_000_000_000 ? value / 1_000 : value
    return Date(timeIntervalSince1970: seconds)
  }
}

private enum StudyTimerStatus: String {
  case running
  case paused
}

private final class LiveActivityUnavailableException: Exception {
  override var reason: String {
    "Live Activities require ActivityKit on iOS 16.1 or newer."
  }
}

private final class LiveActivityAuthorizationException: Exception {
  override var reason: String {
    "Live Activities are disabled for this app or device."
  }
}

#if canImport(ActivityKit)
@available(iOS 16.1, *)
private enum StudyTimerActivityController {
  static func startActivity(
    sessionName: String,
    sessionId: String,
    status: StudyTimerStatus,
    accumulatedElapsedMs: Double,
    runningSince: Date?,
    pausedAt: Date?
  ) async throws {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      throw LiveActivityAuthorizationException()
    }

    await endActivity()

    let attributes = StudyTimerActivityAttributes(
      initialSessionName: sessionName,
      sessionId: sessionId
    )
    let state = StudyTimerActivityAttributes.ContentState(
      sessionName: sessionName,
      sessionId: sessionId,
      status: status.rawValue,
      accumulatedElapsedMs: max(accumulatedElapsedMs, 0),
      runningSince: runningSince,
      pausedAt: pausedAt
    )
    _ = try Activity<StudyTimerActivityAttributes>.request(
      attributes: attributes,
      contentState: state,
      pushType: nil
    )
  }

  static func updateActivity(
    sessionName: String,
    sessionId: String,
    status: StudyTimerStatus,
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
        accumulatedElapsedMs: max(accumulatedElapsedMs, 0),
        runningSince: runningSince,
        pausedAt: pausedAt
      )

      await activity.update(using: state)
    }
  }

  static func endActivity() async {
    for activity in Activity<StudyTimerActivityAttributes>.activities {
      let state = StudyTimerActivityAttributes.ContentState(
        sessionName: activity.contentState.sessionName,
        sessionId: activity.contentState.sessionId,
        status: StudyTimerStatus.paused.rawValue,
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
}

@available(iOS 16.1, *)
private extension StudyTimerActivityAttributes.ContentState {
  func resolvedElapsedMs(at date: Date) -> Double {
    guard status == StudyTimerStatus.running.rawValue, let runningSince else {
      return accumulatedElapsedMs
    }

    return max(accumulatedElapsedMs + date.timeIntervalSince(runningSince) * 1_000, 0)
  }
}
#endif
