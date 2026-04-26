The role of this file is to describe common mistakes and confusion points that agents might encounter as they work in this project and across other projects. If you ever encounter something in the project that surprises you, please alert the developer working with you and indicate that this is the case in this instruction file to help prevent future agents from having the same issue.

## Package Manager

- This repo uses `bun` as its package manager and for running scripts in `package.json`.

## Live Activity Rendering

### Known-Good Architecture (April 26, 2026)

- React Native owns canonical timer state and sends checkpoints through the Expo module bridge (`sessionName`, `sessionId`, `status`, `durationMs`, `accumulatedElapsedMs`, `runningSinceMs`, `pausedAtMs`).
- Lock-screen running view should prefer native countdown primitives (`Text(timerInterval:countsDown:)`) using a safe `nativeCountdownInterval` fallback when strict baseline interval construction fails.
- Dynamic Island running view should use native countdown primitives too (`Text(timerInterval:countsDown:)` and `ProgressView(timerInterval:countsDown:)`) so ticking continues when JS is suspended in background.
- Dynamic Island layout should reserve explicit trailing width (`frame(width:)`) and keep compact leading title short (current max 12 chars) so timer text is not dropped from compact/expanded regions.
- Paused and completed states should use snapshot/formatted text (no running timer primitive).

### Simulator Failure Modes

- `TimelineView(.periodic)` in DI can render but freeze at the last checkpoint.
- `Text(endDate, style: .timer)` can disappear entirely in DI compact/expanded ("no-see-um").
- Per-second JS `updateActivity` snapshot syncing while running can look correct briefly, then freeze when the app is background-suspended.

### Practical Guidance

- Do not rely on JS per-second Live Activity updates for running DI continuity; use ActivityKit-native ticking for running state.
- If DI running text disappears again, check trailing width constraints and compact-leading truncation before changing timer primitives.
