# Certification and publishing

YouTube reviews every Playable before public release. Treat certification as part of development.

## Certification areas

Official requirements cover at least:

- accessibility;
- design;
- internationalization/localization;
- SDK integration;
- monetization;
- privacy/data;
- stability/performance;
- trust and safety.

## Development loop

1. Build production bundle.
2. Run `scripts/audit_playable.py`.
3. Serve locally and exercise all viewports/input types.
4. Test under YouTube-like Content Security Policy constraints.
5. Run the official Playables SDK Test Suite.
6. Upload to Developer Portal when access is available.
7. Complete portal verification/test steps.
8. Fix all deterministic errors before submission.

## CSP testing

YouTube applies a restrictive Content Security Policy. The official Test Suite guide publishes a CSP string for local emulation. Prefer using the current official string rather than copying a stale value from this skill.

CSP failures commonly reveal:

- CDN dependencies;
- remote fonts/assets;
- prohibited connections;
- worker/eval assumptions;
- absolute URLs.

## Metadata

Expect to provide:

- game title;
- description;
- genre;
- publisher/developer information;
- several thumbnail aspect ratios;
- other fields requested by the current Developer Portal.

Do not place branding/logos in metadata where current Playables requirements prohibit it. Verify current dimensions and title/description limits in the portal/docs because these are easy to change.

## Submission readiness principle

Never say “certification-ready” based only on static code review. At minimum require:

- built bundle audit;
- interactive device/input testing;
- official Test Suite pass where available.
