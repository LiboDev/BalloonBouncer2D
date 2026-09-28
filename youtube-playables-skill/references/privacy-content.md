# Privacy, networking, content, accessibility, localization

## External access

Shipped Playables must not make arbitrary external calls. Do not depend at runtime on:

- custom APIs/backends;
- analytics endpoints;
- remote config;
- third-party ad SDKs;
- CDNs for game libraries/assets;
- arbitrary image/audio/font fetches;
- multiplayer servers unless YouTube explicitly grants/supports an exception.

Allowed platform-required Google/YouTube integrations should follow current official documentation.

## SPA requirement

The game must be a single-page application. Do not navigate the browser to other pages as part of gameplay.

## User data

Do not prompt for or collect personal information such as names, ages, locations, usernames, or passwords. Do not imitate login/account creation UI.

Clipboard access is prohibited except in response to an explicit user paste action.

Do not display QR-code-like content intended to bypass platform restrictions.

## External links / sharing

- no clickable external-site/game links inside the game;
- no in-game sharing prompts;
- no additional end-user agreement screen;
- use supported YouTube engagement APIs when current requirements allow YouTube content linking.

## Code inspectability

- minification is allowed;
- intentional obfuscation is not;
- avoid architectural dependence on `eval`, WebAssembly, or workers unless necessary and review current certification guidance, because YouTube may reject code it cannot adequately evaluate.

## Audience/content

Current Trust & Safety requirements state Playables:

- must follow YouTube Community Guidelines;
- must not be specifically made for kids;
- must be suitable for a general 13+ audience;
- must have cleared IP/music/trademark/personality rights;
- must not use misleading title/thumbnail/description metadata.

## Localization

- English support is required.
- Retrieve locale with `ytgame.system.getLanguage()` when localizing.
- Do not use `navigator.language` or `navigator.languages` as the Playables locale source.

## Accessibility

Make a best effort toward WCAG AA where applicable.

Useful defaults:

- sufficient text contrast;
- readable font sizes;
- large touch targets;
- non-color-only feedback;
- keyboard support where applicable;
- captions/text alternatives for meaning-bearing speech when practical;
- clear focus states for DOM controls;
- reduced dependence on rapid tapping or precision-only gestures.
