#if canImport(ActivityKit)
import ActivityKit
import Foundation

@available(iOS 16.1, *)
public struct StudyTimerActivityAttributes: ActivityAttributes {
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

  public init(initialSessionName: String, sessionId: String) {
    self.initialSessionName = initialSessionName
    self.sessionId = sessionId
  }
}
#endif
