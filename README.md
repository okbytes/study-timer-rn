# Study Timer

React Native + Expo iOS study timer with a native ActivityKit Live Activity (lock screen + Dynamic Island).

## Requirements

- macOS with Xcode installed
- iOS Simulator runtime that supports Live Activities (iOS 16.1+)
- `bun` installed (this repo uses `bun` for package management and scripts)

Recommended simulator for Dynamic Island testing: an iPhone Pro model with Dynamic Island (for example iPhone 15/16/17 Pro/Pro Max).

## Quickstart (Human And LLM-Friendly)

1. Install dependencies:

```bash
bun install
```

2. Build and run iOS app (full native rebuild; best first run):

```bash
bun run ios:rebuild
```

3. For subsequent runs when native files did not change:

```bash
bun run ios
```

## Daily Commands

```bash
bun run ios          # run iOS app
bun run ios:rebuild  # force full native rebuild
bun run start        # start Expo dev server
bun run typecheck    # TypeScript checks
bun run lint         # lint
```

## Demo Script (Review Checklist)

1. Launch app on a Dynamic Island simulator.
2. Start a session with a custom title.
3. When prompted, allow Live Activities.
4. Confirm Live Activity appears.
5. Confirm running timer updates.
6. Pause and verify paused value is reflected.
7. Resume and verify timer continues.
8. Stop and confirm Live Activity ends.
9. Long-press the Dynamic Island to inspect expanded state.
10. Verify compact and expanded Dynamic Island both show title + timer.

## Timing Model

React Native owns canonical session state and sends checkpoints to native through the Expo module bridge. ActivityKit renders countdown from checkpoint baselines.

The app has two phases:

- Before start: editable draft (`sessionName`, `durationMs`)
- After start: locked active session checkpoint

Session checkpoint fields:

- `durationMs`
- `accumulatedElapsedMs`
- `runningSinceMs` (running only)
- `pausedAtMs` (paused only)
- `status` (`running`, `paused`, `completed`)

Derived values:

- Running elapsed: `accumulatedElapsedMs + (Date.now() - runningSinceMs)`
- Paused elapsed: `accumulatedElapsedMs`
- Remaining: `max(0, durationMs - elapsedMs)`
- Progress: `elapsedMs / durationMs`

Live Activity uses the same baseline. Running native countdown is derived from:

- `endDate = runningSince + (durationMs - accumulatedElapsedMs)`

## Project Layout

- `app/(tabs)/index.tsx`: React Native screen
- `modules/study-timer-module/src/StudyTimerController.ts`: JS timer controller/state machine
- `modules/study-timer-module/ios/StudyTimerModule.swift`: iOS native bridge
- `targets/study-timer-live-activity/StudyTimerLiveActivity.swift`: Live Activity/Dynamic Island UI
- `challenge.md`: original challenge requirements

## Troubleshooting

- Live Activity not appearing:
  - Rebuild with `bun run ios:rebuild`
  - Confirm Live Activities permission is allowed for the app
  - Confirm simulator runtime supports ActivityKit

- Dynamic Island looks stale after native UI edits:
  - Re-run `bun run ios:rebuild` (not just `bun run ios`)

- Type or lint issues:
  - Run `bun run typecheck`
  - Run `bun run lint`

## Notes

- This repo is optimized for iOS challenge demo flow.
- If requirements are unclear, use `challenge.md` as source of truth and document assumptions.

## LLM Runbook

Use this exact flow when an LLM or automation agent needs to run and verify the project locally.

1. Verify tools:

```bash
command -v bun
command -v xcodebuild
```

Expected:
- Both commands print a path and exit `0`.

2. Install dependencies:

```bash
bun install
```

Expected:
- Install completes without errors.
- `bun.lock` is present and dependencies resolve.

3. Run TypeScript checks:

```bash
bun run typecheck
```

Expected:
- Command exits `0`.
- Output ends without TypeScript errors.

4. Rebuild and run iOS app (required after native/widget edits):

```bash
bun run ios:rebuild
```

Expected:
- Xcode build succeeds.
- iOS Simulator launches app.

5. Execute demo verification in simulator:
- Start a timer session with a custom title.
- Allow Live Activities prompt if shown.
- Confirm lock screen and Dynamic Island appear.
- Confirm running timer updates.
- Pause and confirm paused value updates.
- Resume and confirm timer continues.
- Stop and confirm Live Activity ends.

Expected:
- No crash during start/pause/resume/stop.
- Dynamic Island compact and expanded views show title + time.

6. If app code (non-native) changes only, use faster rerun:

```bash
bun run ios
```

Expected:
- App starts without full clean rebuild.

7. If Live Activity/Dynamic Island UI looks stale, force rebuild again:

```bash
bun run ios:rebuild
```

Expected:
- Native extension changes are reflected in simulator UI.
