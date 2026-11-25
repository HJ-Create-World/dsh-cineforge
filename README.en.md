# CineForge — a DSH plugin for video creation

CineForge is a DSH plugin that provides in-chat skills for turning a brief into a script and a confirmable storyboard, plus a deterministic compiler that turns `cineforge/storyboard/v1` JSON into a HyperFrames project that can be rendered locally to MP4.

GitHub: [HJ-Create-World/dsh-cineforge](https://github.com/HJ-Create-World/dsh-cineforge) · Upstream: [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) (Apache-2.0)

> This README describes what is actually implemented in **0.4.0** (workbench skeleton + reference-video analysis). It does not claim features planned for later phases. For the full Chinese README, see [README.md](README.md).

## Current status: runtime 0.4.0 (workbench skeleton · reference analysis · installed into the live DSH profile)

The design phase (0.1.0-design) was closed on 2026-11-24; 0.2.0 wired the runtime; 0.3.0/0.3.2 reworked the phase-1 demo film after two independent final reviews; **0.4.0 lands phase C (reference-video analysis promoted to `lib/`) and phase A (a read-only workbench panel)** — the plugin is no longer skills-only: it ships a `sidebar.panellist` row plus a paired `main` panel, and two zero-dependency CLIs (`analyze`, `extract-template`). Offline self-test is **129/129**. Next: 0.4.1 (interactive workbench), 0.4.2 (polish), 0.5.0 (the five new-requirement UI surfaces).

| Capability | Implementation | Measured result |
|---|---|---|
| Skill registration | `lib/index.js` + `lib/skill-loader.js`: 3 skills registered via `ctx.skills.register`, `resourceBase` points to the plugin root | `scripts/self-test.mjs` **97/97**; isolated install (`npm pack` → `npm install` → real import) 32/32; **live `desktop` profile 32/32** |
| Storyboard compilation | `scripts/compile-hf.mjs` compiles `cineforge/storyboard/v1` into a HyperFrames standalone composition (8 files + local GSAP / audio assets) | `hyperframes@0.9.88 check`: **0 error / 10 warning** (layout / motion / contrast / audio all 0/0; 7 structural lint warnings for phase-2 sub-compositions + 3 craft line_unread short-line readability); none blocking |
| Frame verification | `scripts/verify-hf.mjs`: check-report parsing + up to 6 snapshots + contact sheet | 7 PNG frames all non-zero bytes, `ok=true` |
| Film render | `npx --yes hyperframes@0.9.88 render` | `examples/demo-project.json` → `renders/cineforge-demo-01_2026-11-25_14-12-40.mp4`; ffprobe: H.264 / 1080×1920 / 30fps / **600 frames / 20.0s / 5.1MB** + **AAC 48kHz stereo**; `hyperframes audio --json`: **−19.6 LUFS / −1.3 dBTP / 0 clipping** (peak moment 17.745s lands on the s06 finale impact; measured, not listened) |
| Offline self-test | `scripts/self-test.mjs` (zero CLI, zero network) | 97/97, including byte-identical sha256 across two compilations of 10 artifacts (deterministic render) |
| Local DSH wiring | `scripts/install-local.mjs`: status / install / uninstall / verify, idempotent, reversible, dry-run by default | isolated profile install → idempotent → uninstall all pass; **installed into the live `desktop` profile and verified 32/32** |

**GUI**: as of 0.4.0 the plugin **ships a graphical workbench**: a `sidebar.panellist` row ("影铸工作台") plus a paired `main` panel with three columns (A input sources / B storyboard / C library). This release is **read-only** — it lists projects, reads storyboards and browses the 124-card library; drag-reorder, duration trimming, animatic playback and the approve gate land in 0.4.1. **Store listing**: materials are prepared but **no PR has been submitted**; listing requires the repository to be ≥1 day old (after 2026-11-25 16:32 +08:00) and a manual PR to `awesome-dsh-plugin` by the user. A local private catalog can make the card visible immediately (see `docs/PUBLISH-商店上架指南.md`).

## Quick start (runtime)

```bash
# 0. Offline self-test (zero dependencies, seconds)
npm test                         # scripts/self-test.mjs: 97/97

# 1. Storyboard source: examples/demo-project.json (cineforge/storyboard/v1, 9:16, 6 shots, 20s)
#    In real use the cineforge-director skill produces it in chat, behind the storyboard confirmation gate

# 2. Compile into a HyperFrames project (dependency-free ESM, 8 files + assets/ into out/<id>/)
node scripts/compile-hf.mjs --project examples/demo-project.json --out out/cineforge-demo-01

# 3. Static-frame verification (check + snapshots + contact sheet, writes a JSON report)
node scripts/verify-hf.mjs --out out/cineforge-demo-01
#    → out/qa/cineforge-demo-01.verify.json (ok=true)

# 4. Render MP4 (only after user confirmation; about 4 min 23 s / 600 frames locally)
cd out/cineforge-demo-01
npx --yes hyperframes@0.9.88 render --output renders/cineforge-demo-01.mp4 --quality draft --fps 30 --workers 2

# 5. Check the output parameters and the audio track
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames -of json renders/cineforge-demo-01.mp4
npx --yes hyperframes@0.9.88 audio renders/cineforge-demo-01.mp4 --json
```

Determinism guarantees of the compiler: no `Date.now()` / `Math.random()`, fixed seed `20261124`, one primary motion per shot, **SHOTS as the single source of truth** (an explicit `shot.primitive` is authoritative; `transition_in` / category are fallbacks only), declared duration equals rendered duration (20s / 600f, no silent tail padding), local vendored GSAP (no CDN), registry pinned to a commit, `window.__timelines` fallback, non-empty first frame, and px-based 9:16 safe-area paddings against the strictest TikTok / Reels / Shorts intersection. Audio is BGM + six pinned SFX, all copied from upstream cleared-license material with their `ATTRIBUTION.md` files.

## Install into DSH

```bash
# Distribution (recommended: npm package / git URL)
dsh plugin --profile desktop add HJ-Create-World/dsh-cineforge

# Local development (source link, changes take effect immediately)
node scripts/install-local.mjs status                 # dry-run by default, read-only
node scripts/install-local.mjs install --apply      # backs up to .local/profile-backup/ before writing
node scripts/install-local.mjs verify               # real import from installed location, 27 checks
node scripts/install-local.mjs uninstall --apply    # one-command rollback
```

The plugin's `cordis.patch.yml` is merged automatically by the host when loading the bundle (`dsh.bundle.patch` in `package.json`); it does **not** need to be added to the profile's own `cordis.patch.yml`. The install script only changes `dependencies` and `dsh.profile.bundles` in `package.json`. After reloading the profile, DSH chats get `cineforge-director` / `cineforge-cards` / `cineforge-qa` and the `cineforge_health` tool.

## Deliverables

| File | Purpose |
|---|---|
| `docs/design/2026-11-24-cineforge-design.md` | Design spec: positioning, three-layer architecture, 11-stage pipeline, workbench shape, acceptance criteria |
| `docs/工作台设计.md` | Workbench panel / interaction / state-machine design (with wireframes) |
| `docs/ROADMAP.md` | Phased roadmap: phase 1 usable, phase 2 workbench, phase 3 publishing loop |
| `docs/RESEARCH-生态调研.md` | Ecosystem research: plugin market, HyperFrames positioning, animation ecosystem, publishing compliance |
| `docs/QA-一期终检报告.md` | Independent final review of the 0.2.0 demo film (verdict: rework, NOT FOR PUBLISH) — historical archive |
| `docs/QA-一期返工终检报告.md` | Second independent review of the 0.3.0 reworked film (conditional pass, internal archive only) |
| `package.json` / `cordis.patch.yml` | DSH plugin manifest and bundle patch (`dsh.bundle.patch`) |
| `lib/index.js` / `lib/skill-loader.js` | Plugin entry: 3 skill registrations + `cineforge_health` tool + unload cleanup |
| `lib/hf-primitives.mjs` | 7 deterministic GSAP primitives + 10 category mappings + 6 preset eases (v0.3: explicit primitive authoritative) |
| `lib/hf-layouts.mjs` | 6 shot layouts (title / quote / card-grid / checklist / metric / outro) |
| `lib/vendor/gsap.min.js` | Local GSAP 3.15.0 (no CDN request at render time) |
| `assets/audio/` | Cleared-license BGM (trimmed to 20s) + 6 Mixkit SFX + two `ATTRIBUTION.md` |
| `lib/hf-template.html` / `.css` / `hf-shot.html` / `hf-timeline.js` | HyperFrames standalone composition templates (placeholder substitution) |
| `scripts/compile-hf.mjs` | Storyboard JSON → HyperFrames project compiler |
| `scripts/verify-hf.mjs` | Static-frame verification: check report + snapshots + contact sheet + JSON report |
| `scripts/self-test.mjs` | 86 fully offline checks (including deterministic sha256 comparison) |
| `scripts/install-local.mjs` | Local DSH wiring: idempotent install / status / verify / rollback |
| `scripts/fetch-upstream.mjs` | Pull the pinned upstream snapshot via API SHA → codeload tar.gz |
| `scripts/build-card-index.mjs` | Rebuild the taste index from upstream cards (idempotent) |
| `examples/demo-project.json` | End-to-end example storyboard (9:16, 20s, 6 shots, BGM + 6 SFX) |
| `skills/cineforge-director/` | Director skill: idea → storyboard confirmation → film state machine |
| `skills/cineforge-cards/` | Shot-card skill: retrieval of 124 recipe cards and the three-read protocol |
| `skills/cineforge-qa/` | Final-review skill: independent subagent checking 27 rules |
| `knowledge/*.json` | 124 cards / 150 styles index, motion tokens (6 presets), aesthetic rules (27), energy arc, platform presets, storyboard schema |
| `upstream/catalog.json` | Single source of truth for upstream: exact version, license, inclusion method, 18 ecosystem assessments |
| `spec.json` | Machine-readable project specification |
| `LICENSE` / `NOTICE` | Apache-2.0 and upstream attribution statement |

## Specs

- **Type**: DSH plugin (npm package + `cordis.patch.yml` + `ctx.skills.register`), not a standalone app.
- **Version / status**: 0.4.0 / runtime + workbench (wired, installed into the live DSH profile, can run through to an audio-enabled MP4; workbench is a read-only skeleton in 0.4.0; film still NOT FOR PUBLISH).
- **Primary render backend**: HyperFrames (DSH built-in `dsh-hyperframes` 0.14.1; CLI pinned `hyperframes@0.9.88`), a runtime dependency, not vendored.
- **Upstream**: [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft), Apache-2.0, author Wei Yihao, pinned SHA `59f3e9b9e936ff2bce0e18446226d770a3f2f61f`. Only the 124 shot recipe cards, aesthetic rules and motion-token method were absorbed; runtime rendering goes through HyperFrames. No Remotion or MotionHarness code is bundled.
- **Knowledge scale**: 124 shot recipe cards / 150 animation styles / 10 categories.
- **Pipeline**: 11 stages; the only hard confirmation gate is storyboard sign-off.
- **Storyboard contract**: `cineforge/storyboard/v1`; SHOTS is the single source of truth.
- **Output**: default 1920×1080 @ 30fps; vertical platforms 1080×1920; deterministic render (fixed seed 20261124) + BGM/SFX audio (AAC 48kHz stereo).

## Second independent final review (0.3.0, 2026-11-25 — historical basis for the 0.3.2 rework)

See `docs/QA-一期返工终检报告.md`: a clean-context independent subagent re-checked all 27 rules against 8 materials (including the full-resolution contact sheet).

- **Verdict: conditional pass — internal phase-1 template-viability archive only; if judged as a publishable film it would still be "rework".** This is **not** "final review passed"; do not phrase it that way externally.
- 27 rules: ✓14 / ✗8 / N/A5 (0.2.0 baseline ✓7 / ✗14 / N/A6); old 14 failures: 1 fixed / 11 partially fixed / 2 unfixed (Q5 multi-subject opening, Q8 non-peak outro).
- **"Do not enter the publishing stage" still holds**: `publish.ai_disclosure` explicit + implicit remain false, title / description / cover / tags empty, `manifest.publish_allowed:false` → **NOT FOR PUBLISH**. The new `aigc` meta tag and sidecar are carriers only; the switches are not set.
- Audio: **measured, not listened** — −19.4 LUFS (quieter than the −16 to −14 LUFS social target) / −1.2 dBTP / 0 clipping; only one of the with/without-BGM versions was rendered; `S5` offset unmeasured; `S4` `impact-cine 4.063s` crosses the s01 3s boundary; `Q11` `mini-card .meta` is 29.6px, below the 32px floor.
- The film is still a text-card template (6 shots sharing one background / grid / eyebrow / progress-bar skeleton and one 0.62s entrance), with no real screenshots, complex lighting, publication-grade typography or camera language. `check 0 error` proves the template rendered, not that it looks good.
- Data safety: picture / `index.html` / `manifest.json` are clean; `out/` artifacts carry local absolute paths but are gitignored and never pushed. Sanitize only if exporting that folder manually.
- P1/P2 findings are registered as phase-2 remediation items; the current frames and contact sheet are frozen as the baseline, so no further film-code change was made in this round.

## Known boundaries (read this before using)

1. **The 0.2.0 demo film was rejected by an independent final review (2026-11-24).** 27 rules: ✓7 / ✗14 / N/A6; verdict "rework"; P0 `publish.ai_disclosure` (explicit + implicit AI labels) both false; **NOT FOR PUBLISH**. 0.3.0 reworked that film into 6 shots / 20s / audio-enabled and fixed the flagged engineering defects, but `publish.ai_disclosure` is still unset, so the film remains **NOT FOR PUBLISH**. It is a phase-1 taste-layer / pipeline demo, not a finished film; see `docs/QA-一期终检报告.md` (historical) and `docs/QA-一期返工终检报告.md`.
2. **The phase-1 compiler is not a per-card reproduction of the 124 cards.** `lib/hf-primitives.mjs` implements 7 deterministic GSAP primitives (fade / slide-up / slide-left / scale-in / crash-zoom / wipe / hold), 10 category mappings and 6 preset eases. The automatic 124-card → HyperFrames mapping table is planned for phase 3.
3. **The 0.4.0 workbench is read-only, and there is no publishing loop yet.** No drag-reorder / trimming / animatic playback / approve gate (0.4.1), no B站 / 抖音 publishing closed loop; the phase-10 publish confirmation is a design gate.
4. **Claims to avoid.** A delivered "top-tier design feel" or "all 124 cards usable per card" are targets / aspirations, not features of 0.3.0. `check 0 error` proves contract compliance, not visual quality.
5. **Upstream attribution.** Apache-2.0; `NOTICE` records the upstream chain (video-shotcraft © Wei Yihao). Four `ATTRIBUTION.md` files in the upstream archive must be preserved verbatim. No Remotion or MotionHarness code is distributed with this plugin.
6. **Plugin listing is a separate matter** from publishing a film. The store submission is a local DRAFT and has not been submitted; see `docs/PUBLISH-商店上架指南.md`.

## Publishing materials (preparation only, not submitted)

- `store/HJ-Create-World__dsh-cineforge.yml` — DRAFT submission YAML for the third-party list.
- `docs/PUBLISH-商店上架指南.md` — Chinese step-by-step listing guide.
- `README.en.md` — this file.
- `CHANGELOG.md` — Keep a Changelog history.
- `screenshots.json` — empty array `[]`; no tracked screenshots are available (optional, not provided).
- GitHub topics (including `dsh-plugin`) were added; the live `desktop` profile install was performed.
- `assets/plugin-icon.png` — 256×256 bitmap PNG icon, dark `#0B0E14` + amber `#D3923C`, letter-C motif.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
