# Workflow: debug certification/test failures

## Triage order

1. SDK load/order.
2. `firstFrameReady` / `gameReady` timing.
3. prohibited network/CSP violations.
4. save/load/audio/pause callbacks.
5. input coverage and resize behavior.
6. package/file limits.
7. runtime crashes/memory.
8. metadata/content/privacy issues.

## Common symptoms

### Spinner never disappears
Check that `gameReady()` is called after true interactivity and that SDK loaded before game code.

### Blank game on YouTube but works locally
Check absolute paths, CSP violations, remote dependencies, unsupported filenames, and SDK ordering.

### Mobile controls fail
Check pointer/touch event mapping, passive listeners, pointer cancellation, CSS overlays intercepting events, and multi-touch assumptions.

### Audio certification failure
Ensure YouTube mute state overrides in-game settings and subscribe to `onAudioEnabledChange`.

### Lost progress on exit/background
Save critical state during `onPause`; never assume a matching resume occurs.

### Reward duplication
Make reward grant idempotent and grant only when rewarded-ad API resolves `true`.

### Build too large
Inspect initial versus total package separately; defer later content instead of merely compressing everything.
