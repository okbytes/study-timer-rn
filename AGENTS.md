The role of this file is to describe common mistakes and confusion points that agents might encounter as they work in this project and across other projects. If you ever encounter something in the project that surprises you, please alert the developer working with you and indicate that this is the case in this instruction file to help prevent future agents from having the same issue.

## Package Manager

- This repo uses `bun` as its package manager and for running scripts in `package.json`.

## Live Activity Rendering

- In `StudyTimerLiveActivity`, avoid lock-screen `ProgressView` timer/current-value labels. On the iOS 26 simulator they rendered as a mostly blank card or got stuck showing `24:--` even though ActivityKit startup and widget reloads succeeded. The current lock-screen layout intentionally has no progress bar: it shows only the title and one trailing time value. Running state uses `Text(timerInterval:countsDown:)` from a stable `runningSince...endDate` range; paused state uses explicit compact formatted text.
