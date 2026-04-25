/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  name: "StudyTimerLiveActivityExtension",
  displayName: "Study Timer",
  bundleIdentifier: ".StudyTimerLiveActivity",
  deploymentTarget: "16.1",
  frameworks: ["ActivityKit", "SwiftUI", "WidgetKit"],
  exportJs: false,
};
