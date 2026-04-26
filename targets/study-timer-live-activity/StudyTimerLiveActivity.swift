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

    public init(
      sessionName: String,
      sessionId: String,
      status: String,
      durationMs: Double,
      accumulatedElapsedMs: Double,
      runningSince: Date?,
      pausedAt: Date?
    ) {
      self.sessionName = sessionName
      self.sessionId = sessionId
      self.status = status
      self.durationMs = durationMs
      self.accumulatedElapsedMs = accumulatedElapsedMs
      self.runningSince = runningSince
      self.pausedAt = pausedAt
    }

    private enum CodingKeys: String, CodingKey {
      case sessionName
      case sessionId
      case status
      case durationMs
      case accumulatedElapsedMs
      case runningSince
      case pausedAt
    }

    public init(from decoder: Decoder) throws {
      let container = try decoder.container(keyedBy: CodingKeys.self)

      sessionName = try container.decode(String.self, forKey: .sessionName)
      sessionId = try container.decode(String.self, forKey: .sessionId)
      status = try container.decode(String.self, forKey: .status)
      durationMs = try container.decodeIfPresent(Double.self, forKey: .durationMs) ?? 0
      accumulatedElapsedMs = try container.decode(Double.self, forKey: .accumulatedElapsedMs)
      runningSince = try container.decodeIfPresent(Date.self, forKey: .runningSince)
      pausedAt = try container.decodeIfPresent(Date.self, forKey: .pausedAt)
    }
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
          StudyTimerDynamicIslandExpandedTopRow(state: context.state)
        }

        DynamicIslandExpandedRegion(.trailing) {
          StudyTimerDynamicIslandProgressRing(state: context.state)
            .frame(width: 38, height: 38)
        }

        DynamicIslandExpandedRegion(.bottom) {
          StudyTimerDynamicIslandExpandedTitle(state: context.state)
        }
      } compactLeading: {
        Text(context.state.compactDisplayName)
          .font(.caption2)
          .lineLimit(1)
          .truncationMode(.tail)
          .minimumScaleFactor(0.75)
          .layoutPriority(1)
      } compactTrailing: {
        StudyTimerDynamicIslandCompactStatus(state: context.state)
          .font(.caption2.monospacedDigit())
          .lineLimit(1)
          .frame(
            minWidth: context.state.compactTrailingMinWidth,
            idealWidth: context.state.compactTrailingIdealWidth,
            maxWidth: context.state.compactTrailingMaxWidth,
            alignment: .trailing
          )
      } minimal: {
        StudyTimerDynamicIslandCompactStatus(state: context.state)
          .font(.caption2.monospacedDigit())
          .lineLimit(1)
      }
    }
  }
}

private struct StudyTimerDynamicIslandExpandedTopRow: View {
  let state: StudyTimerActivityAttributes.ContentState

  var body: some View {
    HStack(spacing: 6) {
      StudyTimerActivityIcon()

      StudyTimerDynamicIslandExpandedStatus(state: state)
        .font(.subheadline.monospacedDigit())
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
    .padding(.leading, 4)
    .padding(.top, 2)
  }
}

private struct StudyTimerDynamicIslandExpandedTitle: View {
  let state: StudyTimerActivityAttributes.ContentState

  var body: some View {
    Text(state.displayName)
      .font(.system(.title3, design: .rounded).weight(.semibold))
      .lineLimit(2)
      .minimumScaleFactor(0.85)
      .truncationMode(.tail)
      .multilineTextAlignment(.leading)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.leading, 4)
      .padding(.top, -6)
  }
}

private struct StudyTimerDynamicIslandExpandedStatus: View {
  let state: StudyTimerActivityAttributes.ContentState

  var body: some View {
    if state.showsCompletedStatus {
      Text("Done")
    } else if let countdownInterval = state.nativeCountdownInterval {
      Text(timerInterval: countdownInterval, countsDown: true)
    } else {
      StudyTimerRemainingText(state: state)
    }
  }
}

private struct StudyTimerLockScreenView: View {
  let context: ActivityViewContext<StudyTimerActivityAttributes>

  var body: some View {
    StudyTimerLockScreenHeader(state: context.state) {
      StudyTimerLockScreenTimeText(state: context.state)
    }
    .padding()
  }
}

private struct StudyTimerLockScreenHeader<Trailing: View>: View {
  let state: StudyTimerActivityAttributes.ContentState
  let trailing: Trailing

  init(
    state: StudyTimerActivityAttributes.ContentState,
    @ViewBuilder trailing: () -> Trailing
  ) {
    self.state = state
    self.trailing = trailing()
  }

  var body: some View {
    HStack(spacing: 12) {
      StudyTimerLockScreenTitle(state: state)

      Spacer(minLength: 8)

      trailing
        .font(.system(.headline, design: .rounded).monospacedDigit())
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .frame(width: 92, alignment: .trailing)
    }
  }
}

private struct StudyTimerLockScreenTitle: View {
  let state: StudyTimerActivityAttributes.ContentState

  var body: some View {
    HStack(spacing: 12) {
      StudyTimerActivityIcon()

      Text(state.displayName)
        .font(.headline)
        .lineLimit(1)
        .truncationMode(.tail)
        .minimumScaleFactor(0.8)
        .layoutPriority(1)
    }
  }
}

private struct StudyTimerRemainingText: View {
  let state: StudyTimerActivityAttributes.ContentState

  var body: some View {
    Text(formatCompactRemainingTime(state.remaining(at: Date())))
  }
}

private struct StudyTimerLockScreenTimeText: View {
  let state: StudyTimerActivityAttributes.ContentState

  var body: some View {
    if state.showsCompletedStatus {
      StudyTimerCompletedStatus(showsText: true)
    } else if let countdownInterval = state.nativeCountdownInterval {
      Text(timerInterval: countdownInterval, countsDown: true)
    } else {
      Text(formatCompactRemainingTime(state.remaining(at: Date())))
    }
  }
}

private struct StudyTimerDynamicIslandCompactStatus: View {
  let state: StudyTimerActivityAttributes.ContentState

  var body: some View {
    if state.showsCompletedStatus {
      StudyTimerCompletedStatus(showsText: false)
    } else if let countdownInterval = state.nativeCountdownInterval {
      Text(timerInterval: countdownInterval, countsDown: true)
    } else {
      StudyTimerRemainingText(state: state)
    }
  }
}

private struct StudyTimerDynamicIslandProgressBar: View {
  let state: StudyTimerActivityAttributes.ContentState

  var body: some View {
    Group {
      if state.showsCompletedStatus {
        ProgressView(value: 1.0)
          .progressViewStyle(.linear)
          .tint(.blue)
      } else if let countdownInterval = state.nativeCountdownInterval {
        ProgressView(timerInterval: countdownInterval, countsDown: true) {
          EmptyView()
        } currentValueLabel: {
          EmptyView()
        }
        .progressViewStyle(.linear)
        .tint(.blue)
      } else {
        ProgressView(value: state.progress(at: Date()))
          .progressViewStyle(.linear)
          .tint(.blue)
      }
    }
    .frame(height: 6)
  }
}

private struct StudyTimerDynamicIslandProgressRing: View {
  let state: StudyTimerActivityAttributes.ContentState

  var body: some View {
    Group {
      if state.showsCompletedStatus {
        ProgressView(value: 1.0)
          .progressViewStyle(.circular)
          .tint(.blue)
      } else if let countdownInterval = state.nativeCountdownInterval {
        ProgressView(timerInterval: countdownInterval, countsDown: true) {
          EmptyView()
        } currentValueLabel: {
          EmptyView()
        }
        .progressViewStyle(.circular)
        .tint(.blue)
      } else {
        ProgressView(value: state.progress(at: Date()))
          .progressViewStyle(.circular)
          .tint(.blue)
      }
    }
    .controlSize(.large)
  }
}

private struct StudyTimerCompletedStatus: View {
  let showsText: Bool

  var body: some View {
    HStack(spacing: 4) {
      Image(systemName: "checkmark.circle.fill")
        .foregroundStyle(.green)

      if showsText {
        Text("Done")
      }
    }
    .fixedSize(horizontal: true, vertical: false)
  }
}

private struct StudyTimerActivityIcon: View {
  var body: some View {
    Image(systemName: "book.closed.fill")
      .foregroundStyle(.blue)
      .fixedSize()
  }
}

extension StudyTimerActivityAttributes.ContentState {
  fileprivate var displayName: String {
    let trimmedName = sessionName.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmedName.isEmpty ? defaultSessionName : trimmedName
  }

  fileprivate var compactDisplayName: String {
    let name = displayName
    let maxCharacterCount = compactLeadingCharacterLimit

    guard name.count > maxCharacterCount else {
      return name
    }

    let endIndex = name.index(name.startIndex, offsetBy: maxCharacterCount - 1)
    return "\(name[..<endIndex])…"
  }

  fileprivate var prefersHourTimerWidth: Bool {
    remaining(at: Date()) >= 3_600_000
  }

  fileprivate var compactLeadingCharacterLimit: Int {
    prefersHourTimerWidth ? 10 : 14
  }

  fileprivate var compactTrailingMinWidth: CGFloat {
    prefersHourTimerWidth ? 44 : 36
  }

  fileprivate var compactTrailingIdealWidth: CGFloat {
    prefersHourTimerWidth ? 50 : 42
  }

  fileprivate var compactTrailingMaxWidth: CGFloat {
    prefersHourTimerWidth ? 56 : 48
  }

  fileprivate var isRunning: Bool {
    status == StudyTimerStatus.running.rawValue
  }

  fileprivate var isCompleted: Bool {
    status == StudyTimerStatus.completed.rawValue
  }

  fileprivate var showsCompletedStatus: Bool {
    if isCompleted {
      return true
    }

    guard isRunning, let endDate else {
      return false
    }

    return endDate <= Date()
  }

  fileprivate var safeDurationMs: Double {
    finiteNonNegative(durationMs)
  }

  fileprivate var safeAccumulatedElapsedMs: Double {
    min(finiteNonNegative(accumulatedElapsedMs), safeDurationMs)
  }

  fileprivate var endDate: Date? {
    guard isRunning, let runningSince else {
      return nil
    }

    let remainingAtBaselineMs = max(safeDurationMs - safeAccumulatedElapsedMs, 0)
    return runningSince.addingTimeInterval(remainingAtBaselineMs / 1_000)
  }

  fileprivate var countdownInterval: ClosedRange<Date>? {
    guard isRunning, let runningSince, let endDate, safeDurationMs > 0 else {
      return nil
    }

    guard endDate > runningSince, endDate > Date() else {
      return nil
    }

    return runningSince...endDate
  }

  fileprivate var nativeCountdownInterval: ClosedRange<Date>? {
    if let countdownInterval {
      return countdownInterval
    }

    guard isRunning, safeDurationMs > 0 else {
      return nil
    }

    let remainingMs = max(safeDurationMs - safeAccumulatedElapsedMs, 0)
    guard remainingMs > 0 else {
      return nil
    }

    let now = Date()
    let endDate = now.addingTimeInterval(remainingMs / 1_000)
    return now...endDate
  }

  fileprivate func elapsed(at date: Date) -> Double {
    let rawElapsedMs: Double

    if isRunning, let runningSince {
      rawElapsedMs = safeAccumulatedElapsedMs + date.timeIntervalSince(runningSince) * 1_000
    } else {
      rawElapsedMs = safeAccumulatedElapsedMs
    }

    guard rawElapsedMs.isFinite else {
      return safeAccumulatedElapsedMs
    }

    return min(max(rawElapsedMs, 0), safeDurationMs)
  }

  fileprivate func remaining(at date: Date) -> Double {
    let remainingMs = safeDurationMs - elapsed(at: date)
    guard remainingMs.isFinite else {
      return 0
    }

    return max(remainingMs, 0)
  }

  fileprivate func progress(at date: Date) -> Double {
    guard safeDurationMs > 0 else {
      return isCompleted ? 1 : 0
    }

    let progress = elapsed(at: date) / safeDurationMs
    guard progress.isFinite else {
      return isCompleted ? 1 : 0
    }

    return min(max(progress, 0), 1)
  }
}

private enum StudyTimerStatus: String {
  case idle
  case running
  case paused
  case completed
}

private func formatCompactRemainingTime(_ totalMilliseconds: Double) -> String {
  let safeMilliseconds = finiteNonNegative(totalMilliseconds)
  let safeSeconds = max(Int((safeMilliseconds / 1_000).rounded(.up)), 0)
  let hours = safeSeconds / 3_600
  let minutes = (safeSeconds % 3_600) / 60
  let seconds = safeSeconds % 60

  if hours > 0 {
    return String(format: "%d:%02d:%02d", hours, minutes, seconds)
  }

  return String(format: "%d:%02d", minutes, seconds)
}

private func finiteNonNegative(_ value: Double) -> Double {
  guard value.isFinite else {
    return 0
  }

  return max(value, 0)
}
