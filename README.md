# Study Timer

This app is a duration-based study timer. A study session starts with a name and a fixed duration, then counts down to zero.

## Timing Model

React Native owns session orchestration and sends checkpoint state to the native Live Activity through the Expo Modules API. ActivityKit renders timing natively from those checkpoints, so the app does not rely on JavaScript ticking in the background and does not send per-second Live Activity updates.

Each timer session tracks:

- `durationMs`
- `accumulatedElapsedMs`
- `runningSinceMs` while running
- `pausedAtMs` while paused
- `status`: `idle`, `running`, `paused`, or `completed`

Elapsed time is still tracked internally because it is the stable source for progress, pause/resume correctness, and deriving remaining time:

- running elapsed: `accumulatedElapsedMs + (Date.now() - runningSinceMs)`
- paused elapsed: `accumulatedElapsedMs`
- remaining: `max(0, durationMs - elapsedMs)`
- progress: `elapsedMs / durationMs`

The Live Activity receives the same baseline. When running, Swift computes `endDate = runningSince + (durationMs - accumulatedElapsedMs)` and lets SwiftUI render the countdown to that absolute date.

## Development

Install dependencies:

```bash
bun install
```

Start the app:

```bash
bun run start
```
