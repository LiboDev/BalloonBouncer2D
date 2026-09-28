# Workflow: port an existing web game

## 1. Audit architecture

Identify:

- renderer/framework;
- external network calls;
- remote assets/CDNs/fonts;
- persistence method;
- analytics;
- ad/IAP SDKs;
- login/account flows;
- input methods;
- orientation assumptions;
- router/navigation;
- bundle/file sizes.

## 2. Remove incompatible runtime dependencies

Replace:

- remote assets -> bundled local assets;
- external save/backend -> YouTube cloud save adapter;
- external ads -> YouTube ads API or no ads;
- IAP -> non-purchased progression;
- login/user profile prompts -> remove;
- external links/share prompts -> remove;
- multi-page navigation -> SPA states.

## 3. Add platform adapter

Do not inject `ytgame` calls throughout gameplay. Wrap ready, save/load, audio, pause/resume, score, ads.

## 4. Make interaction universal

Every click path must also work on touch. Every touch-only gesture needs a mouse equivalent.

## 5. Make resize non-destructive

Resizing must relayout/reframe rather than restart or erase state.

## 6. Rebuild and audit

Use production build output, not source-tree estimates. Run the preflight script and test matrix.
