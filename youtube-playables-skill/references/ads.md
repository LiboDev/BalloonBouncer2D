# Ads and monetization

## Allowed monetization

Use only YouTube-provided monetization APIs. Do not integrate off-platform ad networks or off-platform IAP.

YouTube currently exposes:

```ts
await ytgame.ads.requestInterstitialAd();
const earned = await ytgame.ads.requestRewardedAd(rewardId);
```

Ads may not always be shown. All ad requests must have graceful fallbacks.

## Interstitial ads

Use only at natural breaks:

- after a run ends;
- between levels;
- after a Game Over result is visible;
- during a genuine transition/loading break.

Avoid requesting during active control, precision gameplay, dialogue that would be lost, or immediately after startup.

`requestInterstitialAd()` resolving does not mean an ad was necessarily shown. Never grant rewards based on this call.

Example:

```ts
async function maybeShowInterstitial() {
  pauseGameForPlatformFlow();
  try {
    await ytgame.ads.requestInterstitialAd();
  } catch {
    // Continue normally.
  } finally {
    resumeGameAfterPlatformFlow();
  }
}
```

Your game must still respond correctly to YouTube `onPause` / `onResume` and audio callbacks while ads are integrated.

## Rewarded ads

Rewarded ads must be explicitly requested by the player. Grant the reward only when the returned boolean is true:

```ts
async function offerContinue() {
  try {
    const earned = await ytgame.ads.requestRewardedAd('continue-run-v1');
    if (earned) grantContinue();
  } catch {
    showNonBlockingAdUnavailableState();
  }
}
```

Reward IDs:

- identify the reward type consistently;
- may be readable strings or UUIDs;
- must not contain user data.

Examples:

```text
continue-run-v1
bonus-100-coins-v1
skip-level-v1
```

Do not grant the reward on rejection, timeout, or `false`.

## UX policy

- The game must be fully playable even if ad requests fail.
- Never soft-lock the user behind an unavailable ad.
- Avoid manipulative button placement or misleading rewards.
- Keep reward state idempotent so resume/reentry cannot duplicate the grant.

## Revenue state

YouTube's revenue sharing remains a limited pilot rather than a generally published fixed rev-share program. Do not encode assumed CPMs, fill rates, or revenue shares into design decisions unless the current commercial agreement provides them.
