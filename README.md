# Study Timer

This app is a duration-based study timer. A study session starts with a name and a fixed duration, then counts down to zero.

## Timing Model

React Native owns session orchestration and sends canonical checkpoint state to the native Live Activity through the Expo Modules API. ActivityKit renders timing natively from those checkpoints, so the app does not rely on JavaScript ticking in the background and does not send per-second Live Activity updates.

The app has two phases:

- before start: an editable draft with `sessionName` and `durationMs`
- after start: a locked session checkpoint

Title and duration are draft-only inputs. Once a session starts, React Native stops exposing active-session rename or duration-edit flows.

Each timer session tracks:

- `durationMs`
- `accumulatedElapsedMs`
- `runningSinceMs` while running
- `pausedAtMs` while paused
- `status`: `running`, `paused`, or `completed`

Elapsed time is still tracked internally because it is the stable source for progress, pause/resume correctness, and deriving remaining time:

- running elapsed: `accumulatedElapsedMs + (Date.now() - runningSinceMs)`
- paused elapsed: `accumulatedElapsedMs`
- remaining: `max(0, durationMs - elapsedMs)`
- progress: `elapsedMs / durationMs`

The Live Activity receives the same checkpoint baseline. When running, Swift computes `endDate = runningSince + (durationMs - accumulatedElapsedMs)` and lets SwiftUI render the countdown to that absolute date.

The React Native screen is intentionally thin: a JS controller owns draft state, session transitions, ticking, foreground reconciliation, and Live Activity sync policy. A small adapter hides the native `startActivity`, `updateActivity`, `completeActivity`, and `endActivity` bridge details.

## Development

Install dependencies:

```bash
bun install
```

Start the app:

```bash
bun run start
```
