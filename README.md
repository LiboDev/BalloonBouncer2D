# Balloon Bouncer

![Balloon Bouncer banner](marketing/dist/cover-art/with-logo/banner-16x9-1280x720.jpg)

**Fling once. Watch everything pop.** Aim, launch, and ricochet through colorful balloon fields. Earn coins, upgrade your loadout, and turn a single shot into a chain reaction.

[Play the game](https://libodev.github.io/BalloonBouncer2D/) · [Screenshots, banners, and gameplay previews](PROMO.md)

## How to play

Click **Play**, then drag back and release to launch. With a keyboard, use the arrow keys to adjust aim and power, then press **Space** or **Enter**. Clear at least **75%** of the balloons to advance, and spend coins on upgrades between levels.

## Run and build

Open `index.html` in a browser, or serve this folder with a static web server. The game uses plain JavaScript and Canvas; there are no runtime dependencies to install.

```sh
node scripts/build.mjs
```

The build packages the game into `dist/`. Every push to `main` builds and deploys it through [the GitHub Pages workflow](.github/workflows/pages.yml).

The repository includes finished promotional assets and their source captures in [marketing/](marketing/). Intermediate video frames, duplicate encoded exports, and the generated ZIP remain local and are ignored by Git.
