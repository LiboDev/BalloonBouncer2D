# Runtime test matrix

Run at least these combinations before submission.

| Area | Cases |
|---|---|
| Viewport | 360x800, 800x360, 768x768, 1920x1080, ultrawide/narrow extremes |
| Input | touch simulation, real touch device, mouse, keyboard where supported |
| Resize | resize during menu, gameplay, pause, results, ad-return state |
| Audio | start muted, start audible, toggle YouTube mute during gameplay/ad flow |
| Lifecycle | pause during gameplay, pause during transition, background then resume, pause with no resume |
| Save | empty save, valid save, old-version save, malformed save, save API rejection |
| Ads | ad shown, no-fill/no-show, API rejection, rewarded returns false, rewarded returns true |
| Performance | cold load, repeated restart, long session, repeated scene transitions |
| Connectivity | SDK/ad/save API failures handled without soft-locking |

## Failure injection

Force platform adapter methods to:

- throw/reject;
- resolve slowly;
- return empty save strings;
- return malformed saved JSON;
- return `false` for rewarded ads.

The game should remain playable whenever the failing feature is non-essential.
