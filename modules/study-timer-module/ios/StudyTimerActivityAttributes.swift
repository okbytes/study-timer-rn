#if canImport(ActivityKit)
import ActivityKit
import Foundation

@available(iOS 16.1, *)
public struct StudyTimerActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var sessionName: String
    public var sessionId: String
    public var status: String
    public var accumulatedElapsedMs: Double
    public var runningSince: Date?
    public var pausedAt: Date?

    public init(
      sessionName: String,
      sessionId: String,
      status: String,
      accumulatedElapsedMs: Double,
      runningSince: Date?,
      pausedAt: Date?
    ) {
      self.sessionName = sessionName
      self.sessionId = sessionId
      self.status = status
      self.accumulatedElapsedMs = accumulatedElapsedMs
      self.runningSince = runningSince
      self.pausedAt = pausedAt
    }
  }

  public var initialSessionName: String
  public var sessionId: String

  public init(initialSessionName: String, sessionId: String) {
    self.initialSessionName = initialSessionName
    self.sessionId = sessionId
  }
}
#endif
