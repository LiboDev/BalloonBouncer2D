# Playables SDK integration

Canonical namespace: global `ytgame`. Never overwrite it.

## Load order

`index.html` must load the Playables SDK before any game code:

```html
<script src="https://www.youtube.com/game_api/v1"></script>
<script type="module" src="./assets/main.js"></script>
```

The exact built filename may differ. Preserve the ordering.

## Environment detection

```ts
const inPlayables =
  typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV;
```

Use this to select YouTube behavior versus local/dev fallback behavior.

## Ready lifecycle

Required order:

```ts
ytgame.game.firstFrameReady();
// later, only after menus/gameplay are interactive
ytgame.game.gameReady();
```

Rules:

- `firstFrameReady()` is required and must precede `gameReady()`.
- Use it when the first game frame/loading UI is actually rendered.
- Do not call `gameReady()` while a non-interactive loading/splash screen blocks the player.
- `gameReady()` should correspond to real user interactivity.

## Pause/resume

Register early:

```ts
const unsetPause = ytgame.system.onPause(() => {
  pauseSimulation();
  void saveCriticalState();
});

const unsetResume = ytgame.system.onResume(() => {
  resumeSimulation();
});
```

`onPause` can represent exit/backgrounding and the game is not guaranteed to resume. Save critical state promptly.

Pause all gameplay clocks, physics, AI, animation state that affects gameplay, and input transitions. Visual-only animation may also pause unless there is a reason not to.

## Audio

Initialize from YouTube state and subscribe to changes:

```ts
setPlatformAudioEnabled(ytgame.system.isAudioEnabled());

const unsetAudio = ytgame.system.onAudioEnabledChange((enabled) => {
  setPlatformAudioEnabled(enabled);
});
```

Your in-game volume setting is subordinate to the YouTube mute state. Effective output should conceptually be:

```text
YouTubeAllowsAudio AND PlayerInGameVolume > 0
```

Do not let an in-game unmute override YouTube mute.

## Locale

Use:

```ts
const locale = await ytgame.system.getLanguage();
```

Do not use `navigator.language`/`navigator.languages` for Playables locale selection. Do not persist the locale preference in cloud save.

## Health logging

The SDK exposes best-effort, rate-limited:

```ts
ytgame.health.logError();
ytgame.health.logWarning();
```

Do not treat these as a replacement for robust error handling.

## Error handling

SDK promises can reject and some examples note the thrown value may be undefined. Guard every async platform operation:

```ts
try {
  await platformOperation();
} catch (error) {
  // degrade gracefully; avoid blocking play unless operation is essential
}
```

Relevant `SdkErrorType` values include API unavailability, invalid parameters, size limit exceeded, and unknown errors. Avoid endless automatic retries.
