# [1.3.0](https://github.com/CariHQ/opencad/compare/v1.2.0...v1.3.0) (2026-05-02)


### Bug Fixes

* **app:** correct coordinate save in PropertiesPanel when 3D viewport is active ([#442](https://github.com/CariHQ/opencad/issues/442)) ([0020065](https://github.com/CariHQ/opencad/commit/002006544e72b07def06eb42652d9716cbfa5545))
* **app:** project name sync + framed thumbnails + quiet marketplace ([395780f](https://github.com/CariHQ/opencad/commit/395780f85af78d8c6f88dd10edf8ecfc318d9fcc))
* **app:** project rename in editor updates dashboard listing ([b738ccb](https://github.com/CariHQ/opencad/commit/b738ccb9c34d32c0df5081884a56acddff571daa))
* **billing:** admin bypass for read-only + surface resubscribe errors ([86d43c3](https://github.com/CariHQ/opencad/commit/86d43c3e87872e72509c58e3e526208ea265cfce))
* **ci:** fix YAML syntax errors in deploy.yml and release.yml ([730688a](https://github.com/CariHQ/opencad/commit/730688af3a35059d5c0f041c79229e169eb832f9))
* **doc:** persist every mutating action — not just addElement ([f8b3171](https://github.com/CariHQ/opencad/commit/f8b3171659979c37315c647fc7308191f26f99e5))
* **document:** deduplicate 'window' case in computeBoundingBox ([48485f3](https://github.com/CariHQ/opencad/commit/48485f3f8323c52a27f49b6e07617b77322e0d8f))
* **infra:** move Cloud Run secrets to GCP Secret Manager ([e7f9ce8](https://github.com/CariHQ/opencad/commit/e7f9ce8343508c417a234456389f86c50f9844de))
* **lint:** escape apostrophes / quotes in JSX copy ([aceaeec](https://github.com/CariHQ/opencad/commit/aceaeec6f1bc4279ef4e2a6f7102345208c03474))
* **lint:** rename useSystem to resetToSystem (rules-of-hooks) and drop unused i18n import ([79eb228](https://github.com/CariHQ/opencad/commit/79eb22870288bf7ce0ad24cc3797da5913399fea))
* **marketplace:** drop the fake Refresh button ([d830acf](https://github.com/CariHQ/opencad/commit/d830acff8ed3f4138b67c48392dacace91c919ce))
* **release:** sync desktop bundle version with root package.json ([0f62279](https://github.com/CariHQ/opencad/commit/0f62279e75569c196fc43a5af3f45e04cfd2128b))
* **sso:** hide SSO tab behind VITE_SSO_ENABLED flag ([a651e21](https://github.com/CariHQ/opencad/commit/a651e215557d5bd8ddee62158c23fe536fb44341))
* **subscription:** wait for Firebase auth before status fetch ([38f11f3](https://github.com/CariHQ/opencad/commit/38f11f39fd1a499455c4aebb370b3f7e4b96b22a))
* **viz:** photoreal render works end-to-end with correct aspect + opt-in save ([f2cefa0](https://github.com/CariHQ/opencad/commit/f2cefa0afd90e85c6765f928a0d9896239752f8f))
* **viz:** wire BVH generator so photoreal Render doesn't throw ([8278ead](https://github.com/CariHQ/opencad/commit/8278ead7ec9488883a7c463420003c67e50cdeb3))


### Features

* **app,document:** T-PRES-01/02/03 — camera animation, WebXR utils, panorama export ([99d7ce3](https://github.com/CariHQ/opencad/commit/99d7ce37f249afda4d057090c33a9e182d4b748d))
* **app:** [#451](https://github.com/CariHQ/opencad/issues/451)/[#452](https://github.com/CariHQ/opencad/issues/452)/[#453](https://github.com/CariHQ/opencad/issues/453) feedback + T-VIS-V2-01/02 view visibility ([173e3d9](https://github.com/CariHQ/opencad/commit/173e3d98e4f37c72198a63215cc265295d0bb06b)), closes [418/#419](https://github.com/CariHQ/opencad/issues/419)
* **app:** accessibility — screen reader, RTL/Hebrew, keyboard focus ([#375](https://github.com/CariHQ/opencad/issues/375) [#378](https://github.com/CariHQ/opencad/issues/378) [#382](https://github.com/CariHQ/opencad/issues/382)) ([#445](https://github.com/CariHQ/opencad/issues/445)) ([58bc0dc](https://github.com/CariHQ/opencad/commit/58bc0dccf8d851da5d09f63a7ba9a64d730bb840))
* **app:** Cluster D analysis engines — daylight, egress, acoustics, carbon (T-ANA-01 through T-ANA-04) ([d40065d](https://github.com/CariHQ/opencad/commit/d40065d620f995382e10200789519f8968b7e290)), closes [#406](https://github.com/CariHQ/opencad/issues/406) [#409](https://github.com/CariHQ/opencad/issues/409) [#410](https://github.com/CariHQ/opencad/issues/410) [#411](https://github.com/CariHQ/opencad/issues/411)
* **app:** landscape tool panel + bake pipeline (T-SITE-02 & T-SITE-03) ([#450](https://github.com/CariHQ/opencad/issues/450)) ([b4c68ad](https://github.com/CariHQ/opencad/commit/b4c68adf172a655b0fe6ef3ec512d78785500841))
* **app:** live 3D thumbnails on the project dashboard ([0481e32](https://github.com/CariHQ/opencad/commit/0481e32fe562dafb6cfe8f44e6a2d546b5cf2c26))
* **app:** Parametric Object Language v1 — Families-lite ([#368](https://github.com/CariHQ/opencad/issues/368)) ([#446](https://github.com/CariHQ/opencad/issues/446)) ([e1541ff](https://github.com/CariHQ/opencad/commit/e1541ffd0f791b2bbfcfc6ac0cfce8d0e4e4ab7e))
* **app:** T-ANA-04/05/06/07/08/09 + T-AI-01 + T-PERF-01/02 — analysis, AI copilot, OPFS, LOD tiling ([6909ef2](https://github.com/CariHQ/opencad/commit/6909ef26e03148917a093ab8c2a9aa3f8518338b)), closes [#422](https://github.com/CariHQ/opencad/issues/422) [#423](https://github.com/CariHQ/opencad/issues/423) [#424](https://github.com/CariHQ/opencad/issues/424) [#425](https://github.com/CariHQ/opencad/issues/425) [#426](https://github.com/CariHQ/opencad/issues/426) [#427](https://github.com/CariHQ/opencad/issues/427) [#428](https://github.com/CariHQ/opencad/issues/428) [#429](https://github.com/CariHQ/opencad/issues/429) [#430](https://github.com/CariHQ/opencad/issues/430)
* **app:** T-FIELD-01/02/03 — iPad PWA layout, markup layer, geolocated issues ([a95a5c1](https://github.com/CariHQ/opencad/commit/a95a5c1d1131bc9443a5578aff6329651f5a2627))
* **app:** T-IO/LIB/FIELD/EXT/PRES/IFC v2 — interop, library, AR, plugins, render farm, IFC4x3 ([b7b9cd9](https://github.com/CariHQ/opencad/commit/b7b9cd9e6407084a6756b512c4540d8d0da14514)), closes [#412](https://github.com/CariHQ/opencad/issues/412) [#413](https://github.com/CariHQ/opencad/issues/413) [#414](https://github.com/CariHQ/opencad/issues/414) [#415](https://github.com/CariHQ/opencad/issues/415) [#416](https://github.com/CariHQ/opencad/issues/416) [#417](https://github.com/CariHQ/opencad/issues/417) [#420](https://github.com/CariHQ/opencad/issues/420) [#421](https://github.com/CariHQ/opencad/issues/421) [#431](https://github.com/CariHQ/opencad/issues/431) [#438](https://github.com/CariHQ/opencad/issues/438) [#439](https://github.com/CariHQ/opencad/issues/439) [#440](https://github.com/CariHQ/opencad/issues/440) [#441](https://github.com/CariHQ/opencad/issues/441) [#454](https://github.com/CariHQ/opencad/issues/454)
* **app:** T-SITE-04 landscape instanced mesh viewport integration ([960540a](https://github.com/CariHQ/opencad/commit/960540af4d4cba027f04aa3cf38197ada6fa9c5d))
* **app:** T-SITE-05 terrain raycast snap for landscape placement ([3ab4e31](https://github.com/CariHQ/opencad/commit/3ab4e312a7e33856654b62b23ea8a01c4f336050))
* **app:** T-SITE-06 toposolid — terrain mesh from CSV/GeoJSON elevation data ([197813e](https://github.com/CariHQ/opencad/commit/197813e2bfdab7f241018dab41a991c8b3f6be58))
* **app:** T-SITE-07 property lines + setback envelope ([897a8ca](https://github.com/CariHQ/opencad/commit/897a8ca44f8ddd64b61b7151e7fdfbc94e628074))
* **app:** T-SITE-08 grading — spot levels, drainage arrows, cut/fill ([c19cc09](https://github.com/CariHQ/opencad/commit/c19cc09f383f46e09d5859a7e15a89317f71fbb4))
* **app:** T-SITE-09 pathtracer BVH bake — landscape instances merged for path-tracer ([44eacd8](https://github.com/CariHQ/opencad/commit/44eacd8a2db91391beb6662e6d6c8574c02dab29))
* **app:** T-SITE-V2-01/02/03/04/05/06 — scatter brush, grass, wind shader, seasonal, tree gen, CDN cache ([5947b9b](https://github.com/CariHQ/opencad/commit/5947b9b3d48e56663fc3a9e0a3de21775635eb54)), closes [#432](https://github.com/CariHQ/opencad/issues/432) [#433](https://github.com/CariHQ/opencad/issues/433) [#434](https://github.com/CariHQ/opencad/issues/434) [#435](https://github.com/CariHQ/opencad/issues/435) [#436](https://github.com/CariHQ/opencad/issues/436) [#437](https://github.com/CariHQ/opencad/issues/437)
* **app:** T-VIEW-01 section views + elevation views with cut-plane geometry ([112d548](https://github.com/CariHQ/opencad/commit/112d5483f488ddecca8434299d9a30cab6d55d93))
* **app:** T-VIEW-02/03 tag system + detail views ([0b9622d](https://github.com/CariHQ/opencad/commit/0b9622d48f7d17577ed8008b1ab07d108a88291d))
* **app:** T-VIEW-04/05/06 revision clouds + callouts + keynotes ([15d0d1d](https://github.com/CariHQ/opencad/commit/15d0d1d49c3ecef7034988562e11eff9146aead2))
* **app:** T-VIEW-07/08/09/10 dimensions + legend + sheet browser + multi-PDF ([d7200c9](https://github.com/CariHQ/opencad/commit/d7200c93e9e158762427c9baf2a3503a1156c2e1))
* **app:** visual programming node graph (T-EXT-02, Grasshopper-lite) ([#371](https://github.com/CariHQ/opencad/issues/371)) ([#447](https://github.com/CariHQ/opencad/issues/447)) ([a8a43ab](https://github.com/CariHQ/opencad/commit/a8a43ab50c2147c051d96064f7d113b35731a4ec))
* **billing:** real Stripe frontend + entitlements + read-only grace mode ([e0ad35e](https://github.com/CariHQ/opencad/commit/e0ad35e24653aba8971dbd02d55e87819fbbabcc))
* **branches:** server-persisted design branches ([69366b7](https://github.com/CariHQ/opencad/commit/69366b7f897ade74f0818af2c9e0f30f66399592))
* **document:** implement Cluster C interop formats (T-IO-01 through T-IO-06) ([e318628](https://github.com/CariHQ/opencad/commit/e31862813d59f6e82e52fc983818f15b6240d6d4))
* **document:** landscape element types — T-SITE-01 ([#367](https://github.com/CariHQ/opencad/issues/367)) ([#449](https://github.com/CariHQ/opencad/issues/449)) ([b5525ee](https://github.com/CariHQ/opencad/commit/b5525ee4b756dd02d003a5a50757ef8664db0837))
* **document:** T-COL-01/02/03 — branch diff, element ownership, BCF workflow ([abe678d](https://github.com/CariHQ/opencad/commit/abe678d8e311f4a1d7dbcb915eb2475cef503720))
* **i18n:** complete UI translation across all 10 locales ([30ada79](https://github.com/CariHQ/opencad/commit/30ada79426ec678fef874d91dd756db1fae9465a))
* **i18n:** migrate visible chrome to t() across 10 locales ([dc5ecb3](https://github.com/CariHQ/opencad/commit/dc5ecb366821484eb0153f9c1896b98d02676e65)), closes [#293](https://github.com/CariHQ/opencad/issues/293) [hi#visibility](https://github.com/hi/issues/visibility)
* **i18n:** Phase 1 infrastructure + Spanish & German baselines ([#293](https://github.com/CariHQ/opencad/issues/293)) ([19a72d6](https://github.com/CariHQ/opencad/commit/19a72d6b168d9b0d33e40c79d9375d2fe6e77bba))
* **i18n:** top-10 languages, system detection, Settings override UI ([0637f7e](https://github.com/CariHQ/opencad/commit/0637f7e995d27b6399031a20494f97d38671e96c))
* **marketplace:** publisher flow + bundle upload + admin moderation + Stripe ([43abcea](https://github.com/CariHQ/opencad/commit/43abcea01b37c5f110617e78a971af127f8736bc))
* **marketplace:** real uninstall in bundled catalogue and My Plugins ([652ab21](https://github.com/CariHQ/opencad/commit/652ab210e356809b7a067d9f5a11033d8b5afd88))
* **marketplace:** update-available prompts, kill-switch honored, report flow ([d646d47](https://github.com/CariHQ/opencad/commit/d646d47d3784564bdc242806e03993af7944b637))
* **marketplace:** wire frontend to real backend API ([dedc1dc](https://github.com/CariHQ/opencad/commit/dedc1dc240e40866dc9bade6b2f9ef7dcee028fe))
* **members:** real project members with role management ([92b3506](https://github.com/CariHQ/opencad/commit/92b3506f54e611b842e810938f6cff0756152523))
* **photoreal:** v1 RenderingPanel via three-gpu-pathtracer ([#333](https://github.com/CariHQ/opencad/issues/333)) ([c7fd813](https://github.com/CariHQ/opencad/commit/c7fd813dccc303518513ec9b7197ea25d774382b))
* **plugins:** enforce manifest permissions + install consent dialog ([f3dd4e6](https://github.com/CariHQ/opencad/commit/f3dd4e61c278400d9e5107a1dba1d50c2bd884d9))
* **server:** real marketplace backend ([364131a](https://github.com/CariHQ/opencad/commit/364131a32ea7ba4a1b49c6a1fa36bef0757eea45))
* **server:** real Stripe user subscription backend ([68da0cf](https://github.com/CariHQ/opencad/commit/68da0cf6777bb3035308ab31ef009726d4e8f43e))
* **tools:** every ToolShelf tool is now a first-class element ([a11d0e2](https://github.com/CariHQ/opencad/commit/a11d0e28cfa015f29e4ca5cac60809faedfc246d))
* **versions:** wire VersionHistoryPanel to server-persisted snapshots ([f05f2a2](https://github.com/CariHQ/opencad/commit/f05f2a2b8381833b8f1a9bb6bdbf687a632747a4))
* **vis:** element visibility — hide/show, temp isolate, category filter ([#363](https://github.com/CariHQ/opencad/issues/363)-366) ([#444](https://github.com/CariHQ/opencad/issues/444)) ([8643ae1](https://github.com/CariHQ/opencad/commit/8643ae193e4f46f13d633a5f7fb96dbf3a3061eb)), closes [#363-366](https://github.com/CariHQ/opencad/issues/363-366) [#364](https://github.com/CariHQ/opencad/issues/364) [#365](https://github.com/CariHQ/opencad/issues/365) [#366](https://github.com/CariHQ/opencad/issues/366)
* **viz:** photoreal v2 + Navigator scroll fix (closes [#333](https://github.com/CariHQ/opencad/issues/333)) ([30ac0e9](https://github.com/CariHQ/opencad/commit/30ac0e9932a00e5859e4944834fc0c96223896a0))

# [1.2.0](https://github.com/CariHQ/opencad/compare/v1.1.1...v1.2.0) (2026-04-21)


### Features

* **landing,desktop:** mobile pricing page + Firebase inject + sign pipeline ([f76d1c4](https://github.com/CariHQ/opencad/commit/f76d1c4cc39f7be2603b17386e7738790cd318d5)), closes [#pricing](https://github.com/CariHQ/opencad/issues/pricing)

## [1.1.1](https://github.com/CariHQ/opencad/compare/v1.1.0...v1.1.1) (2026-04-21)


### Bug Fixes

* **archicad:** build NUL-terminator regex via RegExp() to satisfy lint ([3186d66](https://github.com/CariHQ/opencad/commit/3186d66d0e8c822db0710d4ab49ce26e7a226d6e))

## [1.0.10](https://github.com/CariHQ/opencad/compare/v1.0.9...v1.0.10) (2026-04-19)


### Bug Fixes

* **ci:** increase Docker job timeout to 60 min for arm64 QEMU build ([0680ad1](https://github.com/CariHQ/opencad/commit/0680ad10e021f2002759fac9487e163b10638a22))

## [1.0.9](https://github.com/CariHQ/opencad/compare/v1.0.8...v1.0.9) (2026-04-19)


### Bug Fixes

* **ci:** remove Windows .pnpm cleanup step that broke node_modules ([f4bba27](https://github.com/CariHQ/opencad/commit/f4bba2721bd5e422f6ef4c49c6c82a81855574c7))

## [1.0.8](https://github.com/CariHQ/opencad/compare/v1.0.7...v1.0.8) (2026-04-19)


### Bug Fixes

* **ci:** pin wasm-bindgen-cli to 0.2.93 to match Cargo.toml ([1572487](https://github.com/CariHQ/opencad/commit/1572487cfae5377f1b7eeab80c8d23640cbea540))

## [1.0.7](https://github.com/CariHQ/opencad/compare/v1.0.6...v1.0.7) (2026-04-19)


### Bug Fixes

* **ci:** install wasm-bindgen-cli on all desktop/Docker runners ([259e173](https://github.com/CariHQ/opencad/commit/259e173d080a5a9ca0b74bd6811f0535faa54dc8))

## [1.0.6](https://github.com/CariHQ/opencad/compare/v1.0.5...v1.0.6) (2026-04-19)


### Bug Fixes

* **release:** install wasm-pack for desktop builds, fix filter syntax ([3ab1b24](https://github.com/CariHQ/opencad/commit/3ab1b2447bea2cad7149de3371159607c5ed6207))

## [1.0.5](https://github.com/CariHQ/opencad/compare/v1.0.4...v1.0.5) (2026-04-19)


### Bug Fixes

* **docker:** replace nginx with serve for Cloud Run ([bf86486](https://github.com/CariHQ/opencad/commit/bf864862a7e784f9265f524e3584d2e3fcf8c570))

## [1.0.4](https://github.com/CariHQ/opencad/compare/v1.0.3...v1.0.4) (2026-04-19)


### Bug Fixes

* **release:** fix Tauri script, wasm-pack build exclusion, and Dockerfile ([f271104](https://github.com/CariHQ/opencad/commit/f2711046f74f37cf6f0ff6c7235a9bf2200cf3e8))

## [1.0.3](https://github.com/CariHQ/opencad/compare/v1.0.2...v1.0.3) (2026-04-19)


### Bug Fixes

* **release:** trigger desktop builds on release:published, not tag push ([f25a70e](https://github.com/CariHQ/opencad/commit/f25a70eeea80e47ed9f085d187c8a39136f7e3d9))

## [1.0.2](https://github.com/CariHQ/opencad/compare/v1.0.1...v1.0.2) (2026-04-19)


### Bug Fixes

* **release:** use RELEASE_TOKEN PAT so semantic-release can push to main ([9100d21](https://github.com/CariHQ/opencad/commit/9100d21bab338f79a3c01467c2632688558cd2d0))
