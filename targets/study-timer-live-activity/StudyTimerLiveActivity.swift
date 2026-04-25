import ActivityKit
import Foundation
import SwiftUI
import WidgetKit

private let defaultSessionName = "Study Timer"

struct StudyTimerActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var sessionName: String
    public var sessionId: String
    public var status: String
    public var durationMs: Double
    public var accumulatedElapsedMs: Double
    public var runningSince: Date?
    public var pausedAt: Date?
  }

  public var initialSessionName: String
  public var sessionId: String
}

@main
struct StudyTimerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: StudyTimerActivityAttributes.self) { context in
      StudyTimerLockScreenView(context: context)
        .activityBackgroundTint(Color(.systemBackground))
        .activitySystemActionForegroundColor(.primary)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          StudyTimerProgressRing(state: context.state)
        }

        DynamicIslandExpandedRegion(.center) {
          VStack(alignment: .leading, spacing: 4) {
            StudyTimerTitleText(state: context.state)
              .font(.headline)
            StudyTimerRemainingText(state: context.state)
              .font(.system(.title3, design: .rounded).monospacedDigit())
          }
        }

        DynamicIslandExpandedRegion(.trailing) {
          Image(systemName: "book.closed.fill")
            .foregroundStyle(.blue)
        }
      } compactLeading: {
        Image(systemName: "book.closed.fill")
          .foregroundStyle(.blue)
      } compactTrailing: {
        StudyTimerRemainingText(state: context.state)
          .font(.caption2.monospacedDigit())
          .lineLimit(1)
          .minimumScaleFactor(0.75)
      } minimal: {
        StudyTimerRemainingText(state: context.state)
          .font(.caption2.monospacedDigit())
          .lineLimit(1)
          .minimumScaleFactor(0.75)
      }
    }
  }
}

private struct StudyTimerLockScreenView: View {
  let context: ActivityViewContext<StudyTimerActivityAttributes>

  var body: some View {
    VStack(spacing: 10) {
      HStack(spacing: 12) {
        Image(systemName: "book.closed.fill")
          .foregroundStyle(.blue)
          .fixedSize()

        StudyTimerTitleText(state: context.state)
          .font(.headline)

        Spacer(minLength: 8)

        StudyTimerRemainingText(state: context.state)
          .font(.system(.headline, design: .rounded).monospacedDigit())
          .lineLimit(1)
          .minimumScaleFactor(0.8)
          .fixedSize(horizontal: true, vertical: false)
          .layoutPriority(1)
      }

      StudyTimerProgressBar(state: context.state)
    }
    .padding()
  }
}

private struct StudyTimerTitleText: View {
  let state: StudyTimerActivityAttributes.ContentState

  var body: some View {
    Text(state.displayName)
      .lineLimit(1)
      .truncationMode(.tail)
      .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
  }
}

private struct StudyTimerRemainingText: View {
  let state: StudyTimerActivityAttributes.ContentState

  var body: some View {
    if state.isRunning {
      TimelineView(.periodic(from: Date(), by: 1)) { timeline in
        if let endDate = state.endDate, endDate > timeline.date {
          Text(endDate, style: .timer)
        } else {
          Text(formatRemainingTime(state.remaining(at: timeline.date)))
        }
      }
    } else {
      Text(formatRemainingTime(state.remaining(at: Date())))
    }
  }
}

private struct StudyTimerProgressBar: View {
  let state: StudyTimerActivityAttributes.ContentState

  var body: some View {
    TimelineView(.periodic(from: Date(), by: 1)) { timeline in
      ProgressView(value: state.progress(at: timeline.date))
        .progressViewStyle(.linear)
        .tint(.blue)
    }
  }
}

private struct StudyTimerProgressRing: View {
  let state: StudyTimerActivityAttributes.ContentState

  var body: some View {
    TimelineView(.periodic(from: Date(), by: 1)) { timeline in
      let progress = state.progress(at: timeline.date)

      ZStack {
        Circle()
          .stroke(.secondary.opacity(0.25), lineWidth: 3)
        Circle()
          .trim(from: 0, to: progress)
          .stroke(.blue, style: StrokeStyle(lineWidth: 3, lineCap: .round))
          .rotationEffect(.degrees(-90))
      }
    }
    .frame(width: 28, height: 28)
  }
}

private extension StudyTimerActivityAttributes.ContentState {
  var displayName: String {
    let trimmedName = sessionName.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmedName.isEmpty ? defaultSessionName : trimmedName
  }

  var isRunning: Bool {
    status == StudyTimerStatus.running.rawValue
  }

  var isCompleted: Bool {
    status == StudyTimerStatus.completed.rawValue
  }

  var safeDurationMs: Double {
    max(durationMs, 0)
  }

  var endDate: Date? {
    guard isRunning, let runningSince else {
      return nil
    }

    // React Native sends the elapsed checkpoint at the same moment as
    // runningSince. The remaining duration at that checkpoint is the countdown
    // baseline, and adding it to runningSince gives ActivityKit an absolute
    // end date it can render natively without per-second JS updates.
    let remainingAtBaselineMs = max(safeDurationMs - accumulatedElapsedMs, 0)
    return runningSince.addingTimeInterval(remainingAtBaselineMs / 1_000)
  }

  func elapsed(at date: Date) -> Double {
    let rawElapsedMs: Double

    if isRunning, let runningSince {
      rawElapsedMs = accumulatedElapsedMs + date.timeIntervalSince(runningSince) * 1_000
    } else {
      rawElapsedMs = accumulatedElapsedMs
    }

    return min(max(rawElapsedMs, 0), safeDurationMs)
  }

  func remaining(at date: Date) -> Double {
    max(safeDurationMs - elapsed(at: date), 0)
  }

  func progress(at date: Date) -> Double {
    guard safeDurationMs > 0 else {
      return isCompleted ? 1 : 0
    }

    return min(max(elapsed(at: date) / safeDurationMs, 0), 1)
  }
}

private enum StudyTimerStatus: String {
  case idle
  case running
  case paused
  case completed
}

private func formatRemainingTime(_ totalMilliseconds: Double) -> String {
  let safeSeconds = max(Int((totalMilliseconds / 1_000).rounded(.up)), 0)
  let hours = safeSeconds / 3_600
  let minutes = (safeSeconds % 3_600) / 60
  let seconds = safeSeconds % 60

  return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
}

#if DEBUG
@available(iOS 16.2, *)
private enum StudyTimerPreviewFixtures {
  static let attributes = StudyTimerActivityAttributes(
    initialSessionName: "Biology",
    sessionId: "preview-session"
  )

  static let runningShortSessionName = StudyTimerActivityAttributes.ContentState(
    sessionName: "Biology",
    sessionId: "preview-running-short",
    status: StudyTimerStatus.running.rawValue,
    durationMs: 25 * 60 * 1_000,
    accumulatedElapsedMs: 12 * 60 * 1_000,
    runningSince: Date(timeIntervalSinceNow: -8 * 60),
    pausedAt: nil
  )

  static let runningLongSessionName = StudyTimerActivityAttributes.ContentState(
    sessionName: "Advanced Organic Chemistry Problem Set Review",
    sessionId: "preview-running-long",
    status: StudyTimerStatus.running.rawValue,
    durationMs: 60 * 60 * 1_000,
    accumulatedElapsedMs: 42 * 60 * 1_000,
    runningSince: Date(timeIntervalSinceNow: -17 * 60),
    pausedAt: nil
  )

  static let pausedSession = StudyTimerActivityAttributes.ContentState(
    sessionName: "Physics",
    sessionId: "preview-paused",
    status: StudyTimerStatus.paused.rawValue,
    durationMs: 90 * 60 * 1_000,
    accumulatedElapsedMs: ((1 * 60 * 60) + (23 * 60) + 45) * 1_000,
    runningSince: nil,
    pausedAt: Date(timeIntervalSinceNow: -5 * 60)
  )

  static let completedSession = StudyTimerActivityAttributes.ContentState(
    sessionName: "Exam Prep",
    sessionId: "preview-completed",
    status: StudyTimerStatus.completed.rawValue,
    durationMs: 30 * 60 * 1_000,
    accumulatedElapsedMs: 30 * 60 * 1_000,
    runningSince: nil,
    pausedAt: Date(timeIntervalSinceNow: -2 * 60)
  )
}

@available(iOS 16.2, *)
private struct StudyTimerLiveActivityPreviews: PreviewProvider {
  static var previews: some View {
    Group {
      StudyTimerPreviewFixtures.attributes
        .previewContext(
          StudyTimerPreviewFixtures.runningShortSessionName,
          viewKind: .content
        )
        .previewDisplayName("Content - Running Short")

      StudyTimerPreviewFixtures.attributes
        .previewContext(
          StudyTimerPreviewFixtures.runningLongSessionName,
          viewKind: .content
        )
        .previewDisplayName("Content - Running Long")

      StudyTimerPreviewFixtures.attributes
        .previewContext(
          StudyTimerPreviewFixtures.pausedSession,
          viewKind: .content
        )
        .previewDisplayName("Content - Paused")

      StudyTimerPreviewFixtures.attributes
        .previewContext(
          StudyTimerPreviewFixtures.completedSession,
          viewKind: .content
        )
        .previewDisplayName("Content - Completed")

      StudyTimerPreviewFixtures.attributes
        .previewContext(
          StudyTimerPreviewFixtures.runningLongSessionName,
          viewKind: .dynamicIsland(.compact)
        )
        .previewDisplayName("Dynamic Island Compact")

      StudyTimerPreviewFixtures.attributes
        .previewContext(
          StudyTimerPreviewFixtures.runningLongSessionName,
          viewKind: .dynamicIsland(.expanded)
        )
        .previewDisplayName("Dynamic Island Expanded")

      StudyTimerPreviewFixtures.attributes
        .previewContext(
          StudyTimerPreviewFixtures.completedSession,
          viewKind: .dynamicIsland(.minimal)
        )
        .previewDisplayName("Dynamic Island Minimal")
    }
  }
}

@available(iOS 17.0, *)
#Preview("Content - Running Short", as: .content, using: StudyTimerPreviewFixtures.attributes) {
  StudyTimerLiveActivity()
} contentStates: {
  StudyTimerPreviewFixtures.runningShortSessionName
}

@available(iOS 17.0, *)
#Preview("Content - Running Long", as: .content, using: StudyTimerPreviewFixtures.attributes) {
  StudyTimerLiveActivity()
} contentStates: {
  StudyTimerPreviewFixtures.runningLongSessionName
}

@available(iOS 17.0, *)
#Preview("Content - Paused", as: .content, using: StudyTimerPreviewFixtures.attributes) {
  StudyTimerLiveActivity()
} contentStates: {
  StudyTimerPreviewFixtures.pausedSession
}

@available(iOS 17.0, *)
#Preview("Content - Completed", as: .content, using: StudyTimerPreviewFixtures.attributes) {
  StudyTimerLiveActivity()
} contentStates: {
  StudyTimerPreviewFixtures.completedSession
}

@available(iOS 17.0, *)
#Preview("Dynamic Island Compact", as: .dynamicIsland(.compact), using: StudyTimerPreviewFixtures.attributes) {
  StudyTimerLiveActivity()
} contentStates: {
  StudyTimerPreviewFixtures.runningLongSessionName
}

@available(iOS 17.0, *)
#Preview("Dynamic Island Expanded", as: .dynamicIsland(.expanded), using: StudyTimerPreviewFixtures.attributes) {
  StudyTimerLiveActivity()
} contentStates: {
  StudyTimerPreviewFixtures.runningLongSessionName
  StudyTimerPreviewFixtures.pausedSession
  StudyTimerPreviewFixtures.completedSession
}

@available(iOS 17.0, *)
#Preview("Dynamic Island Minimal", as: .dynamicIsland(.minimal), using: StudyTimerPreviewFixtures.attributes) {
  StudyTimerLiveActivity()
} contentStates: {
  StudyTimerPreviewFixtures.completedSession
}
#endif
