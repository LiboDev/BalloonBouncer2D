# Persistence, scores, and engagement

## Cloud save

Within Playables, persistent game state must use YouTube's game data APIs:

```ts
const raw = await ytgame.game.loadData();
await ytgame.game.saveData(JSON.stringify(save));
```

`saveData()` accepts a serialized, well-formed UTF-16 string with a hard maximum of 3 MiB. Target <500 KiB.

## Save schema

Always version saves:

```ts
type SaveV3 = {
  version: 3;
  coins: number;
  unlockedLevel: number;
  settings: {
    musicVolume: number;
    sfxVolume: number;
    haptics: boolean;
  };
};
```

Implement migrations:

```text
unknown/empty -> defaults
v1 -> v2 -> v3
future/invalid -> safe recovery without crash
```

Do not save volatile frame-level state unless necessary. Prefer meaningful checkpoints.

Save when:

- completing a level/run;
- purchasing/unlocking something using in-game earned currency;
- changing persistent settings;
- receiving `onPause`;
- reaching a critical progression checkpoint.

Avoid saving every frame or every score increment.

## Local development fallback

Outside Playables, an adapter may use localStorage so developers can iterate:

```ts
if (inPlayables) await ytgame.game.saveData(raw);
else localStorage.setItem('SAVE_DATA', raw);
```

Do not accidentally make localStorage the authoritative production persistence path in Playables.

## Scores

Send a single consistent progress/skill dimension:

```ts
await ytgame.engagement.sendScore({ value: score });
```

The score value is an integer and must not exceed JavaScript's maximum safe integer. YouTube displays the high score, so in-game high-score semantics should match what you send.

Do not change the meaning of the score between sessions/releases without careful migration/product consideration.

## Opening YouTube content

The SDK can request opening YouTube content through `ytgame.engagement.openYTContent(...)`. Use only when it is a deliberate part of the experience and allowed by current requirements. Never replace this with arbitrary external links.
