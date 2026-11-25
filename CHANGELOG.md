# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Store-listing preparation materials (DRAFT only; **no PR submitted**):
  - `store/HJ-Create-World__dsh-cineforge.yml` — DRAFT submission YAML for `data/plugins/`, with `description.en` / `description.zh`, `category: skill` and an optional `icon`.
  - `docs/PUBLISH-商店上架指南.md` — Chinese step-by-step listing guide: mechanism, hard-requirement table, P0 blockers, 8-step checklist, CI / human review, `held: author` handling, reader-side index source, optional npm publish, exact URL list.
  - `README.en.md` — English README mirroring the current facts and known boundaries (synced to 0.3.0).
  - `CHANGELOG.md` — this file.
  - `screenshots.json` — empty array `[]`; the repository has no tracked images available for screenshots (optional, not provided).
  - `assets/plugin-icon.png` — 256×256 bitmap PNG, dark `#0B0E14` + amber `#D3923C`, letter-C motif.

### Changed

- The publish-kit stage itself modified no runtime source files. The main thread subsequently completed the 0.3.0 rework (see `[0.3.0]` below), added the 7 GitHub topics (including `dsh-plugin`) and installed the plugin into the live `desktop` profile.

### Archived / documented

- `275e10b` — `docs(qa)`: archived the independent final review of the 0.2.0 demo film. Verdict: rework (27 rules: ✓7 / ✗14 / N/A6); P0 `publish.ai_disclosure` explicit + implicit both false; **NOT FOR PUBLISH**. The demo is a phase-1 placeholder sample, not a publishable film.

## [0.3.2] - 2026-11-25

`fix(rework)`: cleared the P1/P2 backlog from the second independent final review (`docs/QA-一期返工终检报告.md`, 27 rules / 8 failing). No new dependencies, no new audio asset.

### Fixed (7 of 8 failing rules)

- **Q5** — new `hero` layout: single-subject opening; `buildTweens` hero branch implements the full spotlight → push-in → float → rim-light → settle arc (deterministic, no `Math.random`).
- **Q8** — new `outro-finale` layout: four-direction fly-in of 4 feature chips, stage beam, 12 deterministic sparks, wordmark hold; `18.5s` and `19.75s` frames are no longer byte-identical.
- **Q10** — `.mini-card .meta` raised from `calc(var(--small-px) * 0.80)` (29.6px) to `var(--small-px)` (37px), `white-space:nowrap; overflow:hidden; text-overflow:ellipsis`; three cards reflowed from a narrow 3-column grid to a full-width flex row.
- **Q11** — 37px clears the 32px floor; the 9:16 / 5.2%-frame-height (100px) conflict is written up in `docs/视觉规范与口径.md` and recorded in `manifest.conscious_violations`.
- **S4** — `buildAudio` now clamps each SFX to its **own shot end** (not the film end), so `impact-cine` no longer bleeds ~1.06s into `s02`; a 12-clip foley map gives `s03` 3 card landings, `s04` 3 checklist rows and `s05` a real metric lock.
- **S5** — `docs/QA-音频工程实测报告.md` (492→500 lines, measured with ffprobe/ffmpeg): per-file peak lag, AAC priming, MP4 elst compensation; compiler now computes `from_s = peak_f / fps - SFX_PEAK_OFFSET_S[file] - OUTPUT_OFFSET_S` (OUTPUT_OFFSET_S = 0.000s for hyperframes 0.9.88 / FFmpeg native AAC 48kHz / MP4 Lavf62.12.101 / 30fps, 6/6 NCC residual 0.000s). Recorded in `manifest.audio_alignment`.
- **C2** — abstract slogan `普通模型也能有导演级设计感` replaced with concrete benefit `124 张配方卡 / 先定分镜，再开机`; `免费商用` rights claim removed from the outro.
- **Q1 (partial)** — header rule, bottom info band and right-side ruler fill the `--pb:691px` dead space; real product screenshots remain a documented conscious violation.

### Added

- `docs/视觉规范与口径.md` — font-size thresholds, safe-zone px values, Q7/Q5/Q8/C1 conscious-violation write-up.
- `docs/QA-音频工程实测报告.md` — promoted from gitignored `.local/` so it ships as `manifest.audio_alignment.evidence`.
- `manifest.legal_word_check` (on-screen copy only, 0 hits) and `manifest.conscious_violations` (Q11 / Q7 / C1).
- `scripts/self-test.mjs`: 97/97 (4 new 0.3.2 assertions for hero / finale / 12-clip alignment / legal-word check).

### Honestly still open

- The 0.3.2 film was re-rendered and measured: ffprobe H.264 / 1080×1920 / 30fps / 600f / 20.0s / 5,095,058 bytes + AAC 48kHz stereo; `hyperframes audio --json` −19.6 LUFS / −1.3 dBTP / 0 clipping / peak moment 17.745s (lands on the s06 finale impact). Human blind listening (S1) and two rendered BGM versions were still not done; the audio report substitutes objective LUFS / NCC / silencedetect measurement from an in-memory amix reconstruction and says so.
- `publish.ai_disclosure` stays false and `publish_allowed:false`; the film remains **NOT FOR PUBLISH** (phase-1 template-viability demo).
- `out/` artifacts still carry local absolute paths; `out/` is gitignored and never pushed.

## [0.3.1] - 2026-11-25

`fix(activation)`: repaired the plugin activation failure reported with the screenshot "启用失败：dsh: warning: 1 entry did not activate cineforge-skills (dsh-cineforge): Error: cannot get property "tools" without inject".

### Root cause

- `lib/index.js` declared `inject = ["skills", "tools"]` and read `ctx.tools` eagerly. Cordis injects only in-scope services; any profile without a `tools` service (CLI/TUI) left the entry PENDING, and a Cordis Proxy getter throws on un-injected property reads. Only the cineforge entry failed; all other plugins activated normally (verified against `cordis.patch.yml` 1910 lines, zero cineforge inserts, and 300+ intact plugin directories in `node_modules`).

### Fixed

- `inject = ["skills"]` only; `tools` is now an optional self-check service via `optionalService(ctx, name)` which tries `ctx.get(name, false)` and falls back to `ctx[name]`, swallowing the Proxy throw.
- `scripts/install-local.mjs`: fixed two `async get: (n) =>` → `get: async (n) =>` syntax errors (`SyntaxError: Unexpected token ":" at compileSourceTextModule`) and added 5 Cordis/Proxy regression checks (verify is now **32/32**, up from 27/27).
- `scripts/self-test.mjs`: added the same 5 regression assertions, including a Cordis Proxy mock that throws on un-injected reads.
- All node verification uses the explicit `C:/Program Files/nodejs/node.exe`; the Electron `process.execPath` cannot run `.mjs` reliably on this machine.

## [0.3.0] - 2026-11-25

`feat(rework)`: reworked the phase-1 demo film after the independent final review returned **打回** (rework). Turned the 5-shot silent placeholder into a 6-shot, 20s, audio-enabled film and fixed the 14 flagged engineering / contract defects. No new dependencies.

### Added

- `lib/hf-layouts.mjs`: six distinct shot layouts (title / quote / card-grid / checklist / metric / outro) — fixes "5 shots on one template".
- `lib/vendor/gsap.min.js`: local GSAP 3.15.0, referenced by relative path in the generated `index.html`; no CDN request at render time.
- Audio chain: `assets/audio/bgm/cineforge-bgm-20s.mp3` (trimmed from the upstream Mixkit-licensed `cat-walk.mp3`, fade in/out) plus six pinned SFX, each copied with its upstream `ATTRIBUTION.md` so the attribution chain is preserved. Manifest now records `audio.bgm` and `audio.sfx`.
- Two functional shots: the 124-card library (three mini cards) and the storyboard confirmation gate (checklist with a pending row), plus a 150-preview metric shot.
- AI-label metadata: `<meta name="aigc">` in the HTML and an `aigc-metadata.json` sidecar; `manifest.aigc` records explicit / implicit label state. `publish_allowed` stays `false` because `publish.ai_disclosure` is still unset — **NOT FOR PUBLISH** remains in force.

### Fixed

- **Single source of truth**: `resolvePrimitive` now honours an explicit `shot.primitive` first; `transition_in` / category are fallbacks only. The six declared primitives equal the manifest primitives.
- **Duration identity**: `padding_seconds: 0`, `declared_duration_s` / `declared_frames` equal `duration_s` / `total_frames` (20s / 600f); the old silent 0.6s tail padding was removed.
- **Determinism**: fixed seed `20261124`, `hyperframes.json` registry pinned to commit `45846f1e6d5609462d29652315d0d4254fe92c24`, `window.__timelines` fallback, first frame non-empty.
- **Readability / safe area**: 9:16 paddings in px against the strictest TikTok / Reels / Shorts intersection (left≥120 / right≤780 / top≥288 / bottom≤1248); short 2–3-word copy per shot; transform-only opening arc (no `letterSpacing` tween).
- **Visual defects**: merged the eyebrow and page badge into one text block (removed `content_overlap`), removed the `shot__edge` decoration, fixed the third mini-card overflow with `minmax(0, 1fr)` + `min-width: 0` + 0.80× meta font.
- `hyperframes check` now reports 0 error and 0 warning in layout / motion / contrast / craft / audio; only 7 structural lint warnings remain (sub-composition splitting, phase 2).

### Measured

- `scripts/self-test.mjs` rewritten to 86 fully offline checks (86/86), including byte-identical sha256 across two compilations of 10 artifacts (now also `aigc-metadata.json`, vendor GSAP, BGM and attribution files).
- `npm pack` → isolated profile install → real import: 27/27; the live `desktop` profile install also verifies 27/27.
- End-to-end render: `hyperframes@0.9.88` 600/600 frames, 20.0s, H.264 1080×1920 @30fps, AAC 48kHz stereo, 3.0MB. `hyperframes audio --json`: −19.4 LUFS / −1.2 dBTP / 0 clipping (measured, not listened). The integrated loudness is quieter than the −16 to −14 LUFS social target.
- `scripts/verify-hf.mjs`: `ok=true`, 7 non-zero PNG frames, contact sheet reviewed by eye.

### Notes

- The 124 shot cards are still **not** reproduced per card; the automatic mapping table is phase 3. No GUI workbench (phase 2), no publishing loop (phase 3). This is a phase-1 taste-layer / pipeline demo, not a publishable film.

### Second independent final review (2026-11-25)

- `docs/QA-一期返工终检报告.md`: a clean-context independent subagent re-checked all 27 rules against 8 materials (including the full-resolution contact sheet). **Verdict: conditional pass — internal phase-1 template-viability archive only; if judged as a publishable film it would still be "rework".**
- Improved to ✓14 / ✗8 / N/A5 (0.2.0 was ✓7 / ✗14 / N/A6). Of the old 14 failures: 1 fixed, 11 partially fixed, 2 unfixed (Q5 multi-subject opening, Q8 non-peak outro).
- **"Do not enter the publishing stage" still holds**: `publish.ai_disclosure` explicit + implicit remain false, title / description / cover / tags empty, `manifest.publish_allowed:false`, **NOT FOR PUBLISH**.
- New findings: S5 (audio offset not measured, first applicable after audio was added), Q11 (`mini-card .meta` 29.6px below the 32px floor, wraps mid-word), S4 (`impact-cine 4.063s` crosses the s01 3s boundary into s02).
- Audio: BGM + 6 pinned SFX present, `film_silent` gone, but measured-not-listened, the with/without-BGM two versions were not rendered, and no S5 offset measurement exists.
- The film is still a text-card template (6 shots sharing one background / grid / eyebrow / progress-bar skeleton and one 0.62s entrance); no real screenshots, complex lighting, publication-grade typography or camera language. `check 0 error` proves the template rendered, not that it looks good.
- Data safety: the picture / `index.html` / `manifest.json` are clean, but `out/` artifacts contain local absolute paths. `out/` is gitignored and never pushed; sanitize only if exporting the whole folder manually.
- Remediation order: P0 publishing compliance → P1 audio listening / two versions / S5 offset / S4 trim → P1 group-photo outro and single-subject opening → P2 publication-grade functional shots and font size → P2 sanitization and evidence consistency → P3 sub-composition and copy.

## [0.2.0] - 2026-11-24

`1eb8a31` — `feat(runtime)`: wired the plugin to 0.2.0 — skill registration, storyboard compiler, static-frame verification, offline self-test and local install script.

### Added

- Three in-chat skills registered via `ctx.skills.register` (`cineforge-director`, `cineforge-cards`, `cineforge-qa`) plus the `cineforge_health` tool (`lib/index.js`, `lib/skill-loader.js`).
- `scripts/compile-hf.mjs`: deterministic `cineforge/storyboard/v1` JSON → HyperFrames standalone composition (6 files); `lib/hf-primitives.mjs` with 7 deterministic GSAP primitives, 10 category mappings and 6 preset eases.
- `scripts/verify-hf.mjs`: static-frame verification (check report + up to 6 snapshots + contact sheet); 7 non-zero PNG frames, `ok=true`.
- `scripts/self-test.mjs`: 60/60 offline checks (zero CLI, zero network), including byte-identical sha256 across two compilations.
- `scripts/install-local.mjs`: idempotent, reversible local DSH wiring (status / install / uninstall / verify, dry-run by default); isolated install verification 27/27.
- End-to-end demo: `examples/demo-project.json` → 1080×1920 H.264 MP4, 30fps, 468 frames, 15.6s (about 5.0MB) via `hyperframes@0.9.88` (`check`: 0 error / 7 warnings).

### Notes

- The 124 shot cards are **not** reproduced per card in this release; the automatic mapping table is planned for phase 3. No GUI workbench (phase 2) and no publishing loop (phase 3).

## [0.1.0-design] - 2026-11-24

`cc1a916` — `feat`: CineForge design draft and taste layer (v0.1.0-design).

### Added

- Design spec `docs/design/2026-11-24-cineforge-design.md`: positioning, three-layer architecture, 11-stage pipeline, workbench shape, acceptance criteria.
- `docs/工作台设计.md` (workbench panel / interaction / state-machine design with wireframes), `docs/ROADMAP.md`, `docs/RESEARCH-生态调研.md`.
- Taste layer derived from upstream `video-shotcraft` (Apache-2.0, pinned `59f3e9b9e936ff2bce0e18446226d770a3f2f61f`): `knowledge/shot-cards.json` (124 cards / 150 styles), `knowledge/motion-tokens.json`, `knowledge/aesthetic-rules.json`, `knowledge/energy-arc.json`, `knowledge/platform-presets.json`, `knowledge/storyboard.schema.json`; `upstream/catalog.json` as the single source of truth.
- `skills/` skill definitions, `examples/`, `package.json` / `cordis.patch.yml`, `spec.json`, `LICENSE` (Apache-2.0) and `NOTICE` (upstream attribution chain).

### Notes

- Design / documentation phase only; no runtime wiring yet.

## Commit references

- `cc1a916` — https://github.com/HJ-Create-World/dsh-cineforge/commit/cc1a916
- `1eb8a31` — https://github.com/HJ-Create-World/dsh-cineforge/commit/1eb8a31
- `275e10b` — https://github.com/HJ-Create-World/dsh-cineforge/commit/275e10b
- `0.3.0` — rework commit (see `git log` / the commit list on GitHub)
