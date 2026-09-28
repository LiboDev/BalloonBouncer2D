# Preflight checklist

## Structure
- [ ] Root `index.html` exists.
- [ ] YouTube Playables SDK loads before game code.
- [ ] App is a single-page application.
- [ ] Runtime asset paths are relative.
- [ ] No prohibited external runtime calls/dependencies.
- [ ] Production bundle passes `scripts/audit_playable.py`.

## Lifecycle
- [ ] `firstFrameReady()` fires after first visible game/loading frame.
- [ ] `gameReady()` fires after real interaction is possible.
- [ ] `firstFrameReady()` always precedes `gameReady()`.
- [ ] Pause stops gameplay safely.
- [ ] Pause saves critical state.
- [ ] Resume does not duplicate/restart state unexpectedly.

## Input/UI
- [ ] Every action works with touch.
- [ ] Every action works with mouse.
- [ ] Keyboard is supported where useful.
- [ ] Esc closes in-game dialogs and is not prevented.
- [ ] No interaction depends on hover alone.
- [ ] Portrait, square, and ultrawide layouts remain playable.
- [ ] Resize preserves game state.
- [ ] No accidental scrollbars.
- [ ] No in-game exit button or confusing YouTube-like controls.

## Audio
- [ ] Initial audio state follows `isAudioEnabled()`.
- [ ] Audio responds to `onAudioEnabledChange`.
- [ ] In-game unmute cannot override YouTube mute.

## Saves/scores
- [ ] Save format is versioned.
- [ ] Empty/corrupt/old save data recovers safely.
- [ ] Save size is well below 3 MiB.
- [ ] Critical progress saves on pause/checkpoints.
- [ ] Score meaning is consistent and integer-valued.

## Ads
- [ ] Interstitials occur only at natural breaks.
- [ ] Rewarded ads are user initiated.
- [ ] Reward is granted only on `true`.
- [ ] Ad failure never soft-locks the game.
- [ ] Reward grants are idempotent.
- [ ] No third-party ad/IAP SDK remains.

## Performance
- [ ] Initial bundle <30 MiB; target <15 MiB.
- [ ] Total bundle <250 MiB.
- [ ] Every file <30 MiB.
- [ ] File count <=8,000.
- [ ] Interactive target <5 seconds.
- [ ] Peak JS heap <=512 MB under stress.
- [ ] Repeated restarts/transitions do not leak memory.

## Policy/content
- [ ] No personal-data collection/login screen.
- [ ] No external links or sharing prompts.
- [ ] No additional EULA/ToS prompt.
- [ ] English is supported.
- [ ] Locale uses YouTube API if localized.
- [ ] Rights are cleared for code/assets/music/brands.
- [ ] Content is suitable for general 13+ audience and not specifically made for kids.

## Official verification
- [ ] Current official requirements reviewed.
- [ ] Playables SDK Test Suite passes.
- [ ] Developer Portal verification passes when available.
