# Autonomous gameplay upgrade: audit and verification plan

This document records the pre-upgrade failure analysis and the automated acceptance criteria for the autonomous five-act game. It intentionally describes spoiler-bearing server behavior and belongs with the development documentation, not in player-facing screens.

## Pre-upgrade audit

The previous multiplayer build could stall because progression was entirely host-driven:

- `GameService.setGameControls` was the only path that started play, changed rounds, or opened accusations, and it required `isHost`.
- `GameService.revealSolution` was also host-only. There was no server-owned path from accusations to revelation.
- The server had no scheduler or progression tick. `timerView` could label a timer `expired`, but expiry did not mutate the game or advance a chapter.
- The browser's one-second timer only redrew the countdown. It did not trigger a server transition when the timer reached zero.
- Investigation completion, player inactivity, disconnects, and missing votes were never evaluated as advancement conditions.

The interaction loop felt repetitive because:

- Every original hotspot had `repeatable: false`. A second investigation returned the same narrative with no new evidence.
- Repeat attempts still created investigation and audit records, so they looked like actions without changing gameplay.
- The public hotspot list remained clickable after discovery. The client added an `is-investigated` style but did not provide a new staged action or consequence.
- Only the six Grand Foyer hotspots were implemented. Later-room evidence existed in the story catalog but had no interactive room objects.
- Progress did not react to investigative actions, so clicking more objects could not move the story forward.

These are architectural causes, not test timing problems. The upgraded engine must therefore own its clock and transitions on the server, make repeated interactions explicitly idempotent or staged, and guarantee timeout fallbacks.

## Required automated scenarios

The Node test suite treats the following as release-blocking behavior:

1. A fast-mode game traverses all five acts and reaches reveal, reunion, awards, and completion in minutes of simulated time.
2. Six human players coexist with six server-owned NPC participants, each with a unique character and private state.
3. A disconnected or inactive human cannot block act transitions, confessionals, accusations, or the finale.
4. Two characters investigating the same object receive only their own personalized discovery; repeating an interaction never duplicates evidence.
5. Sharing, concealing, revealing, and planting evidence are recorded as player actions while the immutable mystery truth remains unchanged; revealed clues enter every case file and planted clues appear in their chosen room.
6. Confessional prompts and responses are private to their participant until the synchronized reunion.
7. Reunion selections contain at least one confessional or represented segment for every human and NPC participant.
8. Golden Rose awards are derived from recorded actions and include receipts rather than random-only winners.
9. After the initial start request, the simulation invokes only the server engine—not host controls—to advance the game.
10. Ordinary snapshots, peer lists, public configuration, and normal administrator views never expose the hidden murderer, method, private clues, or unreleased confessional text.
11. Every one of the eight mansion rooms has a reachable navigation card and at least one server-backed interaction.
12. A service waking after an idle period catches up every overdue act and postgame stage from the original deadlines in one engine cycle.
13. Pre-upgrade sessions without a sealed mystery are migrated before progression, and avatar bytes survive application restarts in persistent state.

## Deterministic simulation rules

- Tests use an isolated JSON store and a long test-only session secret.
- Fast mode advances a supplied logical clock; tests do not sleep for wall-clock timers.
- Most simulations advance one supplied deadline at a time; a dedicated wake-up test jumps beyond the whole evening and requires every overdue transition in one engine cycle.
- A bounded iteration count makes a progression loop fail loudly instead of hanging the test runner.
- Assertions use stable IDs and semantic state (`actIndex`, finale stages, participant IDs), not prose timing or animation details.
- Mystery truth is read directly from the isolated store only inside the server-side test. Player-facing payloads are checked separately for non-disclosure.

## Deployment smoke checks

After automated tests pass, a deployed build should still be checked with two private browser sessions:

- join and reconnect with the same bearer session;
- observe synchronized narrator beats and public actions;
- verify a private clue and confessional do not appear in the other browser's network payload;
- disconnect one browser through an act boundary and confirm the other continues;
- finish a fast-mode game and confirm reveal, reunion, and awards render on both phone and desktop widths.
