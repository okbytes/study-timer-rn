import ActivityKit
import Foundation
import SwiftUI
import WidgetKit

struct StudyTimerActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var sessionName: String
    public var sessionId: String
    public var status: String
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
            Text(context.state.sessionName)
              .font(.headline)
              .lineLimit(1)
            StudyTimerElapsedText(state: context.state)
              .font(.system(.title3, design: .rounded).monospacedDigit())
          }
        }

        DynamicIslandExpandedRegion(.trailing) {
          Image(systemName: "book.closed.fill")
            .foregroundStyle(.blue)
        }
      } compactLeading: {
        Text(context.state.sessionName)
          .font(.caption2)
          .lineLimit(1)
      } compactTrailing: {
        StudyTimerElapsedText(state: context.state)
          .font(.caption2.monospacedDigit())
      } minimal: {
        StudyTimerElapsedText(state: context.state)
          .font(.caption2.monospacedDigit())
      }
    }
  }
}

private struct StudyTimerLockScreenView: View {
  let context: ActivityViewContext<StudyTimerActivityAttributes>

  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: "book.closed.fill")
        .foregroundStyle(.blue)

      Text(context.state.sessionName)
        .font(.headline)
        .lineLimit(1)

      Spacer(minLength: 8)

      StudyTimerElapsedText(state: context.state)
        .font(.system(.headline, design: .rounded).monospacedDigit())
    }
    .padding()
  }
}

private struct StudyTimerElapsedText: View {
  let state: StudyTimerActivityAttributes.ContentState

  var body: some View {
    if state.isRunning, let adjustedStartDate = state.adjustedStartDate {
      Text(timerInterval: adjustedStartDate...Date.distantFuture, countsDown: false)
    } else {
      Text(formatElapsedTime(state.accumulatedElapsedMs))
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
  var isRunning: Bool {
    status == StudyTimerStatus.running.rawValue
  }

  var adjustedStartDate: Date? {
    guard let runningSince else {
      return nil
    }

    // ActivityKit will keep rendering while JS is suspended. Moving the start date
    // backward by the already-accumulated study time lets SwiftUI's native timer
    // display total active time for the current segment without per-second JS updates.
    return runningSince.addingTimeInterval(-(accumulatedElapsedMs / 1_000))
  }

  func elapsed(at date: Date) -> Double {
    guard isRunning, let runningSince else {
      return accumulatedElapsedMs
    }

    return max(accumulatedElapsedMs + date.timeIntervalSince(runningSince) * 1_000, 0)
  }

  func progress(at date: Date) -> Double {
    (elapsed(at: date) / 1_000).truncatingRemainder(dividingBy: 3_600) / 3_600
  }
}

private enum StudyTimerStatus: String {
  case running
  case paused
}

private func formatElapsedTime(_ totalMilliseconds: Double) -> String {
  let safeSeconds = max(Int((totalMilliseconds / 1_000).rounded(.down)), 0)
  let hours = safeSeconds / 3_600
  let minutes = (safeSeconds % 3_600) / 60
  let seconds = safeSeconds % 60

  return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
}
