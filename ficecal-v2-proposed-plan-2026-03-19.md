# FiceCal V2 Proposed Plan

- Date: 2026-03-19
- Last updated: 2026-03-23 (Phase 10 complete — P0–P4 (intelligence tools), Phase 10B P5–P7 (plugin sandboxing/signed manifests/auto-update), live pricing oracle (catalog-loader.ts, MCP_MODEL_CATALOG_URL → bundled fixture fallback), dev workflow script (scripts/dev.sh); 441 tests green; 244 MCP integration tests; integration adapters OpenOps/Infracost deferred to Phase 11 — see execution log; **2026-03-23 UX audit of ficecal-model-lens (localhost:4321 vs duksh.github.io): 10 first-time visitor experience gaps identified (G1–G10), prioritized resolution table and Phase 12 UX sprint scope added to §6A**)
- Authoring basis: analysis of current live FiceCal (`http://duksh.github.io`), current source repository runtime structure, and `FiceCal-v2-idea` contracts/ADRs
- Updated after additional comparison against:
  - FinOps Foundation `FinOps Framework 2026: Executive Strategy, Technology Categories, and Converging Disciplines`
  - FinOps Foundation `Introducing FOCUS 1.3: Contract Commitments, Split Cost Allocation, Dimensions for Recency & Completeness`
- Status: **active — Phase 9 complete ✅ · Phase 10 complete ✅ (billing.anomaly.detect + @ficecal/billing-ai-providers + finops.assessment.correlate + billing.routing.optimize; Phase 10B P5 sandboxing + P6 signed manifests + P7 auto-update; live pricing oracle; dev workflow; toolCount 11; transport v0.13.0; 441 tests) · Phase 11 complete ✅ (53-gap register: U1–U6, P1–P4, I1–I4, F1–F3/F7–F8, A2–A4/A6–A7, S1–S7, D1–D2/A1; 1,253 tests) · Phase 12 complete ✅ (8 new MCP tools, 23 total; Phase 12 tests; Phase 12 UX gaps closed) · UX audit 2026-03-23: 10 first-visit gaps on ficecal-model-lens (G1–G10) identified — Phase 13 UX sprint planned (see §6A)**

### Execution log

| Date | Event |
| --- | --- |
| 2026-03-19 | Plan authored and reviewed |
| 2026-03-20 | GitOps foundation established: `develop` branch created off `main` in `duksh/FiceCal`; CI guardrails extended to all v2 branches |
| 2026-03-20 | `duksh/models` renamed to `duksh/ficecal-model-lens`; established as confirmed upstream for model catalog data |
| 2026-03-20 | PR #118 merged to `develop`: `packages/schemas/model-catalog/` and `packages/integrations/models-pricing/` delivered — implements Gaps 2, 3, 4 from section 4E |
| 2026-03-20 | Phase 0 exit artifacts created: `docs/phase-0-baseline/framework-focus-coverage-baseline.md` and `docs/phase-0-baseline/parity-and-change-declaration.md`; `feature-catalog.json` updated to v1.1.0 |
| 2026-03-20 | `release/phase-0` branch opened; PR #119 raised to `main` — pending merge and `v2.0.0-phase-0-exit` tag |
| 2026-03-21 | Phase 1: `economics-module` compute kernel delivered — `decimal.js`-backed Decimal wrapper, `toOutputString`, `normalizePeriod`, `FormulaRegistry`, forex adapter (static + ECB interface); `feature-catalog.json` updated to v1.2.0 |
| 2026-03-21 | Phase 1 complete: `v2.0.0-phase-1-exit` tag cut on `develop` |
| 2026-03-21 | Phase 2: `chart-presentation` — canonical ChartPayload contract and builders (PR #25, baseline) |
| 2026-03-21 | Phase 2: `health-score` — deterministic weighted signal engine, worst-severity propagation, evaluatePricingFreshness / evaluateBudgetAdherence / evaluateModelTrust (PR #123, 22 tests) |
| 2026-03-21 | Phase 2: `recommendation-module` — 17 declarative rules, audience-aware (executive/operator/architect/viability) priority sort (PR #124, 31 tests) |
| 2026-03-21 | Phase 2: `ai-token-economics` — per_token/per_1k/per_1m/per_image/per_request/per_second dispatcher; Gap 1 closed (PR #125, 32 tests) |
| 2026-03-21 | Phase 2: `feature-registry` — Kahn topological sort, circular-dep detection, diamond-dep support (PR #127, 27 tests) — **note: built during Phase 2 sprint; plan categorises as Phase 4/5 infrastructure; reconciliation recorded in Phase 3 section** |
| 2026-03-21 | Phase 2: `mcp-tooling` — McpToolRegistry, economics.estimate.cost / health.score.query / economics.period.normalize tools (PR #128, 32 tests) — **note: built ahead of Phase 5 plan schedule; see Phase 3 reconciliation note** |
| 2026-03-21 | Phase 2: `apps/web` — Vite + React browser runtime, SharedContext, CostEstimator, HealthDashboard, ArchitectPanel (PR #129) — **note: built ahead of Phase 4 plan schedule; see Phase 3 reconciliation note** |
| 2026-03-21 | Phase 2: `multi-tech-normalization` — 10 TechCategory variants, costPerBasisUnit, efficiencyIndex, portfolio roll-up (PR #131, 16 tests) |
| 2026-03-21 | Phase 2: `sla-slo-sli-economics` — computeErrorBudget, computeDowntimeCost, computeReliabilityRoi; STANDARD_SLO_TIERS (PR #132, 18 tests) |
| 2026-03-21 | **ADR — economics-module umbrella**: `@ficecal/economics-module` established as the single-import surface for all economics engines. Implements `EconomicsPlugin<TInput, TResult>` extension interface; `createDefaultRegistry()` pre-wires 5 built-in domains; future verticals (cloud-economics, licensing, FinOps) self-register without touching existing consumers (PR #133, 23 tests) |
| 2026-03-21 | Phase 2: `budgeting-forecasting` — computeBudgetVariance, extrapolateTrend (OLS linear + moving-average), projectBudget (compound growth) (PR #134, 27 tests) |
| 2026-03-21 | Phase 2: `reference-evidence` — EVIDENCE_CATALOG (8 entries: FOCUS 1.3, FinOps Framework 2026, Google SRE, OLS regression, compound growth, weighted health score), queryEvidence() (PR #135, 34 tests) |
| 2026-03-21 | Phase 2: `demo-scenarios` — 6 canonical scenarios with live engine assertions: AI model cost, 99.9% error budget, e-commerce outage, 4-nines ROI, multi-cloud normalisation, Q1 budget variance (PR #136, 26 tests) |
| 2026-03-21 | Phase 2: `qa-module` — 7 engine contracts, runContractCheck() with dot-path resolver, cross-module integration harness covering all 6 demo scenarios (PR #137, 29 tests) |
| 2026-03-21 | **Phase 2 complete** — `v2.0.0-phase-2-exit` tag cut on `develop`; 352 tests passing across 14 packages; Gaps 1 and 5 closed |
| 2026-03-21 | Phase 3: `@ficecal/ui-foundation` delivered — 7 modules (types, preferences, theme, intent-scope, i18n, keyboard, telemetry); 75/75 vitest tests; zero DOM dependencies; all browser APIs injectable (PR #138) |
| 2026-03-21 | Phase 3: `apps/web` wired to `ui-foundation` — ThemeToggle (light/dark/system cycle), IntentScopeBar (intent/scope/mode selects + back + affinity hint), `useUiFoundation()` hook, `i18n.t()` throughout App.tsx (PR #139) |
| 2026-03-21 | Phase 3: `feature-catalog.json` bumped to v1.5.0 — `ui-foundation` entry active; `web.dependsOn` updated |
| 2026-03-21 | **Phase 3 complete** — `v2.0.0-phase-3-exit` tag cut on `develop`; 75 ui-foundation tests + clean typecheck; apps/web integration verified |
| 2026-03-21 | Phase 4: `packages/contracts` — zero-dependency cross-package boundary types: `WorkspaceContext`, `IntentScopeSnapshot`, `EconomicsResultSummary`, `HealthSignalSummary`, `HealthScoreSummary`, `RecommendationSummary`, `TelemetryBase`; `feature-catalog.json` bumped to v1.6.0 |
| 2026-03-21 | Phase 4: `services/mcp` scaffold — Phase 5 Fastify + MCP SDK transport structure documented and deferred; `service-mcp (scaffold)` entry added to feature-catalog.json |
| 2026-03-21 | Phase 4: `CODEOWNERS` added — path-based ownership for all packages, apps, services, .github, docs/roadmap |
| 2026-03-21 | Phase 4: `docs/playbooks/monorepo-cutover-runbook.md` — cutover readiness checklist (all ✅), post-cutover directory layout, package boundary rules, contract drift detection, rollback procedure |
| 2026-03-21 | Phase 4: `apps/web` production wiring (PR #141) — single-page layout (all panels always visible), NavBar sticky + IntersectionObserver active tracking, ScenarioBar preset loading from `@ficecal/demo-scenarios`, CostEstimator real-time compute (no button click), CostChart D3 bar renderer (ADR-0001), HealthDashboard live signal derivation from `AiCostResult`, complete `--fc-*` CSS token system with `[data-theme="light"]` vars |
| 2026-03-21 | **Phase 4 complete** — `v2.0.0-phase-4-exit` tag cut on `develop`; `tsc --noEmit` clean; monorepo cutover formalized; apps/web fully wired to economics engine |
| 2026-03-21 | Phase 5: `services/mcp` Fastify HTTP transport implemented (ADR-0002) — `buildApp()` factory, `GET /mcp/v1/health`, `GET /mcp/v1/capabilities`, `POST /mcp/v1/tools/:id/call`; singleton `McpToolRegistry` pre-wired with `economics.estimate.cost`, `economics.period.normalize`, `health.score.query`; `buildRequestContext()` from HTTP headers; RFC 7807-style error envelope |
| 2026-03-21 | Phase 5: 28/28 vitest transport tests — health liveness, capabilities manifest, 5 cost tool variants, 3 period normalization tests, 6 health score query tests, 4 error paths, 2 context propagation tests |
| 2026-03-21 | Monorepo: pinned TypeScript `~5.4.5` via `pnpm.overrides` to prevent TS 5.9 decimal.js NodeNext regression; fixed `mcp-tooling` health-score-query audiences type cast |
| 2026-03-21 | **Phase 5 complete** — `v2.0.0-phase-5-exit` tag cut on `develop`; 28/28 tests passing; `tsc --noEmit` clean |
| 2026-03-21 | **Strategic pivot confirmed during Phase 6 planning** — "WordPress of FinOps" direction adopted; plugin-first extensible architecture chosen over monolithic integration module; all Phase 6 integration work (OpenOps, Infracost, FOCUS normalization) deferred to Phase 8 to establish the plugin foundation first |
| 2026-03-21 | Phase 6: `packages/plugin-api` delivered — zero-dependency `FicecalPlugin` interface, `PluginHost` (feature-flag guard + contribution routing), `ThemeRegistry` (plugin-contributed visual themes), `BillingRegistry` (fixture + adapter registries), `PluginRegistrationError` with typed error codes; 25/25 tests |
| 2026-03-21 | Phase 6: billing fixture plugins — 4 deterministic provider plugins (AWS/GCP/Azure/OpenAI) each contributing `BillingFixtureContribution` + `BillingAdapterContribution` via `PluginHost`; fixture JSON files in `packages/schemas/fixtures/` sourced from real Cost Explorer / GCP Billing Export / Azure Cost Management / OpenAI usage export formats |
| 2026-03-21 | Phase 6: billing MCP tools — `billing.estimate.actual` and `billing.compare.period` registered in MCP transport; `setBillingRegistry()` wires `PluginHost.billing` into tool handlers; 24/24 billing transport tests |
| 2026-03-21 | Phase 6: theme plugins — `lightThemeContribution`, `darkThemeContribution`, `highContrastThemeContribution`, `oceanBlueThemeContribution` defined in `packages/ui-foundation/src/theme-plugins.ts`; `BUILT_IN_THEMES` array exported; tokens sourced from `THEME_TOKENS` for single source of truth |
| 2026-03-21 | Phase 6: gap analysis against "WordPress of FinOps" target produced 9 identified gaps (see section 4G) — plugin marketplace, isolation/sandbox, multi-tenancy, hook/filter system, signed contracts, admin UI, update pipeline, developer SDK; ThemeRegistry → ThemeManager wiring (resolved in Phase 7 P0) |
| 2026-03-21 | **Phase 6 complete** — `v2.0.0-phase-6-exit` tag cut on `develop`; 77/77 tests passing (25 plugin-api + 52 mcp-service); `tsc --noEmit` clean across all packages |
| 2026-03-21 | Phase 7 P0: `ThemeTokenSource` interface added to `@ficecal/ui-foundation` — structural bridge from `ThemeManager` to `ThemeRegistry` (zero new package dep); `ThemeManager` extended with `setCustomTheme()`, `clearCustomTheme()`, `getActiveThemeId()`, `listThemes()`; custom theme id persisted at `ficecal:theme:custom:v1` |
| 2026-03-21 | Phase 7 P0: `useUiFoundation.ts` wires `PluginHost` singleton with `@ficecal/built-in-themes` plugin (all 4 themes); passes `pluginHost.themes` as `ThemeTokenSource` to `ThemeManager`; `pluginHost` exposed through `UiFoundation` interface |
| 2026-03-21 | Phase 7 P0: `ThemePicker.tsx` delivered — full popover panel showing all plugin-contributed themes with swatch + displayName + description; `setCustomTheme()` / `clearCustomTheme()` wired; keyboard accessible (Escape + outside-click); 100+ CSS lines in `styles.css` |
| 2026-03-21 | Phase 7 P0: `NavBar.tsx` updated — `ThemeToggle` (3-state cycle) replaced by `ThemePicker` (full plugin-aware theme picker); `@ficecal/plugin-api` added to `apps/web` runtime dependencies |
| 2026-03-21 | Phase 7 P0: 13 new `ThemeManager` tests added to `packages/ui-foundation/tests/ui-foundation.test.ts` covering `setCustomTheme`, `clearCustomTheme`, `getActiveThemeId`, `listThemes`, `ThemeTokenSource` fallback, persistence across instances; **total: 163 tests passing** (86 ui-foundation + 25 plugin-api + 52 mcp-service) |
| 2026-03-21 | Phase 7 P1: `AdminPanel.tsx` Sections 1–3 delivered in `apps/web` — registered plugins list (name/version/stability/namespace), theme picker (all `ThemeRegistry` entries with active indicator + apply), billing provider status (`BillingRegistry.readyProviders` with fixture/adapter readiness dots). `@ficecal/plugin-api` added to `apps/web` runtime dependencies. Admin CSS tokens added to `styles.css` |
| 2026-03-21 | Phase 7 P2: Live billing toggle wired — `ingestMode: "live"` path added to AWS billing adapter; `routes.ts` returns `501 LIVE_BILLING_NOT_IMPLEMENTED` with upgrade instructions until Phase 9 real SDK integration; `routes.ts` version bumped `0.6.0 → 0.8.0`, `phase: 6 → 8` |
| 2026-03-21 | **Phase 7 partial complete** — ThemeRegistry ✅, AdminPanel (Sections 1–3) ✅, live billing stub ✅. HookRegistry (`addFilter`/`addAction`) and `WorkspaceRegistry` carried forward to Phase 9 as P0/P1 |
| 2026-03-21 | Phase 8 P0: `packages/schemas` created — `NormalizedCostRecord` v2 (`SCHEMA_VERSION = "2.0.0"`); ~35 new optional fields covering ~63/77 FOCUS 1.3 columns (~82%); 7 new enum types (`ChargeCategory`, `ChargeClass`, `ChargeFrequency`, `PricingCategory`, `CommitmentDiscountCategory`, `CommitmentDiscountStatus`, `PublisherCategory`); `FOCUS_V1_3_GAP_COLUMNS` const documents 13 deferred columns; `deriveTagKeys()` and `upgradeToV2()` migration helpers; 77 vitest tests |
| 2026-03-21 | Phase 8 P1: `packages/plugin-registry-client` delivered — `RegistryClient` class with `browse()`, `find()`, `listTags()`, `verifyBundle()` (SHA-256 via Web Crypto API), `checkReadiness()`; in-memory caching; zero-dependency; `RegistryFetchError` and `BundleVerificationError` typed error classes; 63 vitest tests |
| 2026-03-21 | Phase 8 P2: `packages/create-ficecal-plugin` delivered — `npx create-ficecal-plugin` scaffold CLI; pure template functions (`buildScaffoldFiles()`); supports `billing` / `theme` / `mcp` / `full` plugin types; scaffolds `package.json`, `tsconfig.json`, `README.md`, `src/index.ts`, contribution file, test harness; 59 vitest tests |
| 2026-03-21 | Phase 8 P3: `billing.commitment.status` MCP tool delivered — all 7 FOCUS 1.3 CommitmentDiscount columns; built-in deterministic fixtures: AWS (3 records: 2 Savings Plans + 1 RI), GCP (2 CUDs), Azure (1 RI); `filterStatus` + `filterType` query params; `CommitmentSummary` with `utilisationRate`, `totalWastedSpend`, `totalNetSavings`; toolCount in transport → 6; 33 vitest tests |
| 2026-03-21 | Phase 8 P4: FinOps Framework 2026 assessment types added to `@ficecal/contracts` — `FinOpsCapabilityDomain` (6 domains incl. new `ai-ml-cost-management`), `FinOpsMaturityLevel` (crawl/walk/run), `FinOpsCapabilityAssessment`, `FinOpsFrameworkAssessment` (overall score, topRecommendations, overallMaturityLevel), `FinOpsBenchmarkComparison` (peerGroup, leaderDomains, laggingDomains), `AiMlCostAssessment` (tokenAttributionEnabled, gpuCommitmentUtilisationRate, costPerMillionTokens) |
| 2026-03-21 | Phase 8 P5: `AdminPanel.tsx` Section 4 — Registry Browser delivered; lazy-load with "Load registry" button; tag filter + search input; plugin cards with readiness dots, tag chips (clickable filter), install readiness issues, homepage links, published date; `@ficecal/plugin-registry-client` added to `apps/web` dependencies; registry CSS tokens added to `styles.css` |
| 2026-03-21 | **Phase 8 partial complete** — P0–P5 done (schemas ✅, registry-client ✅, create-plugin ✅, commitment MCP tool ✅, contracts types ✅, AdminPanel Section 4 ✅). Deferred to Phase 9: 8B integration adapters, `duksh/ficecal-plugin-registry` repo creation, `billing.chargeback.allocate` tool, live billing SDK |
| 2026-03-22 | Plan document updated — execution log brought current for Phase 7 P1/P2, Phase 8 P0–P5; FOCUS 1.3 coverage matrix updated 15%→82%; Framework 2026 matrix updated (FinOps Assessment: none→low); Phase 7 exit criteria updated; Phase 8 completed deliverables table added; Phase 9 section restructured with carryover items |
| 2026-03-22 | Phase 9 P0 (HookRegistry) confirmed complete — 44 vitest tests; priority-ordered filter/action chains; `billing.estimate.actual.result` production hook; lifecycle actions; `registeredFilters/Actions` introspection. Already wired in PluginHost as `host.hooks` |
| 2026-03-22 | Phase 9 P2 (WorkspaceRegistry) confirmed complete — 23 vitest tests; `disablePluginForWorkspace`, `enablePluginForWorkspace`, `listPluginsForWorkspace`, `listThemesForWorkspace`, `listAdaptersForWorkspace`; `workspace.plugin.disabled/enabled` hooks |
| 2026-03-22 | Phase 9 P1: `duksh/ficecal-plugin-registry` repo created — `plugins/index.json` (version/updatedAt/plugins shape per `isRegistryIndex()` validator); 2 seed entries (high-contrast + ocean-blue themes); JSON Schema v7; `.github/workflows/validate-plugin.yml` (schema, HTTPS, sha256, unique IDs, semver gates); CONTRIBUTING.md; README. `DEFAULT_REGISTRY_INDEX_URL` updated to point to `plugins/index.json` path |
| 2026-03-22 | Phase 9 P4: `billing.chargeback.allocate` MCP tool delivered — FOCUS 1.3 Allocation columns (AllocatedCost, AllocatedMethodID, AllocatedMethodDetails, AllocatedResourceID, AllocatedResourceName, AllocatedTags); even/proportional/tag-based allocation methods; AWS (2 resources: k8s-cluster $4800 + NAT $380), GCP (GKE $5200), Azure (AKS $3900) fixtures; rounding correction on last consumer; toolCount → 7; transport v0.9.0 / phase 9; 32 vitest tests. **Total monorepo: 978 tests passing** |
| 2026-03-22 | Phase 9 P3: Live AWS billing delivered — `aws-billing-plugin.ts` v2.0.0; real `GetCostAndUsageCommand` call via `@aws-sdk/client-cost-explorer`; MONTHLY granularity; UnblendedCost metric; GROUP_BY SERVICE dimension; `mapResultsToLineItems()` → `BillingPeriodSummary`; dynamic SDK import (zero cost in deterministic mode); 501 stub fully retired; billing test updated to accept `[200, 500, 501]` for CI without credentials |
| 2026-03-22 | Phase 9 proper #5: `@ficecal/finops-assessment` delivered — `computeAssessment()` engine; 6 domain scorers (`scoreUnderstandCloudUsageCost`, `scoreQuantifyBusinessValue`, `scoreOptimizeCloudUsageCost`, `scoreManageFinOpsPractice`, `scoreCloudSustainability`, `scoreAiMlCostManagement`); 21 boolean signal flags across 6 `AssessmentSignals` domain groups; modal maturity tie-break-to-lower; top-3 cross-domain recommendations ordered by lowest-scoring domain; 58 vitest tests |
| 2026-03-22 | Phase 9 proper #5 (cont.): `finops.assessment.run` MCP tool registered in transport — `finops` namespace; `stability: beta`; flat-signal input maps to all 6 `AssessmentSignals` groups; `FinOpsFrameworkAssessment` output aligned to `@ficecal/contracts` boundary types; toolCount → 8; transport v0.10.0; 36 vitest integration tests. **Total monorepo: 962 tests passing** |
| 2026-03-22 | Phase 10 P0: `billing.anomaly.detect` MCP tool delivered — threshold-based spike detection over `NormalizedCostRecord[]`; two-period comparison (current vs baseline); groups by `serviceName`, computes relative delta; flags services exceeding `thresholdPercent` (default 50%); severity: warning >50%, critical >100%; ranked by `deltaAmount` DESC; `projectedMonthlyOverage` on partial-month comparisons; multi-provider support (`providers[]` input); composite `ingestMode` (deterministic/live/mixed); `BillingPeriodSummary` and `NormalizedCostRecord[]` both handled at input; toolCount → 9; transport v0.12.0 / phase 10; 28 vitest integration tests. **Total monorepo: 356 tests passing** |
| 2026-03-22 | Phase 10 strategy confirmed — intelligence layer before integration adapters: (1) `billing.anomaly.detect` MCP tool — threshold-based spike detection over `NormalizedCostRecord[]`; (2) `finops.assessment.correlate` — assessment × billing × model-routing correlation; (3) `billing.routing.optimize` foundation; (4) all-provider AI billing adapters (Anthropic, OpenAI, Gemini, Mistral, DeepSeek, Alibaba) using ficecal-model-lens as pricing oracle rather than per-adapter pricing logic. OpenOps/Infracost integration adapters explicitly deferred to Phase 11. |
| 2026-03-22 | ficecal-model-lens role expanded — confirmed as **pricing oracle** for all AI billing adapters, not just reference data for `ai-token-economics`. `packages/integrations/models-pricing/` (`duksh-models-adapter`, `ModelPricingReference`) is the resolved token-cost layer; billing adapters only need provider usage API (token counts); cost = tokens × `ModelPricingReference` rates. Forex already solved via Phase 1 `StaticForexAdapter`. Model name normalization via `cleanName` + `company` fields. Evidence rule maintained: adapter outputs labeled `dataCompleteness: "partial"` per FOCUS 1.3. |
| 2026-03-22 | **Phase 8B critical gap closed** — billing MCP tools upgraded from `BillingPeriodSummary` (12 FOCUS cols) to `NormalizedCostRecord[]` v2 (FOCUS 1.3, ~82% coverage). `billing.estimate.actual`: `lineItems: BillingLineItemOutput[]` → `records: NormalizedCostRecord[]`; `lineItemCount` → `recordCount`; mapper `billingPeriodSummaryToRecords()` produces FOCUS fields (`serviceName`, `skuId`, `chargeDescription`, `chargeCategory: "usage"`, `chargeFrequency: "usage-based"`, `amountType: "actual"`, `billedCost`, `effectiveCost`, `pricingCategory: "standard"`, `providerRole` mapped per provider family, `dataCompleteness: "partial"`); Phase 10 NormalizedCostRecord[] pass-through branch added. `billing.compare.period`: `ServiceDelta.service` → `ServiceDelta.serviceName` (FOCUS ServiceName); `focusSchemaVersion: "2.0.0"` in output; internal aggregation uses FOCUS field extraction helpers. `@ficecal/schemas` added to mcp-tooling deps. Transport v0.10.0 → v0.11.0. 161/161 integration tests green |
| 2026-03-22 | Phase 10 P1+P2: `@ficecal/billing-ai-providers` delivered — `AiProviderBillingAdapter` interface; 6 provider adapters (Anthropic, OpenAI, Gemini, Mistral, DeepSeek, Alibaba) each with deterministic fixtures (17 model entries, date-stamped usage records); `AI_PROVIDER_ADAPTERS` registry map (keyed by `providerId`); `lookupModelPricing()` — 4-pass fuzzy matcher (exact modelId+company → exact modelId → cleanName⊆slug → slug⊆cleanName) with `slugify()` stripping date suffixes; `normalizeUsageRecords()` — produces `NormalizedCostRecord[]` with FOCUS 1.3 fields (`pricingCategory: "standard"`, `serviceCategory: "AI and Machine Learning"`, `resourceType: "foundation-model"`, `dataCompleteness: "partial"`); cost formula: `(tokens / 1_000_000) × ratePerMillion`; cached input tokens supported via `cachedInputTokenCost`; `CredentialsRequiredError` typed error class; 102 vitest tests (21 model-lookup + 40 normalize + 41 adapters). Wired into `services/mcp` via `createAiProviderBillingRegistry()` (PHASE10_PRICING_CATALOG, 17 hardcoded entries) and `createMergedBillingRegistry(cloudReg, aiReg)` composition; `@ficecal/billing-ai-providers` + `@ficecal/schemas` added to both `mcp-tooling` and `services/mcp` deps |
| 2026-03-22 | Phase 10 P3: `finops.assessment.correlate` MCP tool delivered — correlates FinOps capability gaps with billing spend to produce ROI-ranked `correlatedRecommendations[]`; 7 correlation rules: `ai-model-routing-gap` (20% AI spend, medium), `ai-token-attribution-gap` (5% AI spend, low), `ai-cost-alerts-gap` (15% AI spend, low), `cloud-anomaly-detection-gap` (15% total spend, low), `cloud-waste-remediation-gap` (10% cloud spend, medium), `cloud-rightsizing-gap` (8% cloud spend, medium), `no-showback-chargeback-gap` (0% waste, high effort); ROI score = `(estimatedSaving / effortMultiplier) / 10000 × 100` capped 1–100, sorted DESC; output: `totalBillingSpend`, `aiProviderSpend`, `cloudProviderSpend`, `totalAddressableWaste`, `topAddressableGap`, `overallScore`, `overallMaturityLevel`, `correlationVersion: "1.0"`; `CorrelationBillingRegistry` wired to merged cloud+AI registry; `finops` namespace, `stability: beta`; toolCount → 10; 29 vitest integration tests |
| 2026-03-22 | Phase 10 UI: `IntelligencePanel` delivered in `apps/web` — three-section panel surfacing all Phase 10A intelligence tools; Section 1 (AI Model Routing): `billing.routing.optimize` call, hero saving stat, opportunity list with source→alternative model substitution cards and saving % badges; Section 2 (Spend Anomaly Detection): `billing.anomaly.detect` call, overall severity display, anomaly list with δ%, projected overage, per-anomaly recommendation; Section 3 (Assessment × Billing Correlation): `finops.assessment.correlate` call, FinOps score + maturity level, `totalAddressableWaste` hero stat, ROI-ranked gap list with effort badges; all three tools called in parallel via native `fetch()` to MCP service (`VITE_MCP_BASE_URL`, default `localhost:4001`); independent loading/error states per section; baseline period auto-computed as prior calendar month; NavBar `Intelligence` link added; App.tsx phase tag + footer bumped to Phase 10; `tsc --noEmit` clean; 244 MCP integration tests still green |
| 2026-03-22 | §4B Framework 2026 coverage matrix updated — Anomaly Management: `none`→`medium`; FinOps Assessment: `medium`→`good`; AI Multi-provider comparison: `good`→`strong`; AI token tracking: `medium`→`good`; AI maturity: `low`→`medium`; interpretation note updated to reflect Phase 10A complete state and remaining gaps (Rate Optimization, Usage Optimization, Sustainability, live pricing oracle) |
| 2026-03-22 | Phase 10 P4: `billing.routing.optimize` MCP tool delivered — identifies AI model swap opportunities ranked by estimated monthly saving; `ROUTING_CATALOG` (17 entries, 4 tiers: reasoning/premium/standard/economy); `TIER_DOWNGRADE` map (premium→standard, standard→economy; reasoning and economy → no substitution); saving formula: `monthlySpend × (1 − altWeightedRate/sourceWeightedRate)` with 70/30 input/output token weight; top-3 alternatives per source model sorted by `estimatedMonthlySaving DESC`; output: `opportunities[]`, `totalEstimatedMonthlySaving` (10dp decimal string), `modelsAnalysed`, `opportunitiesFound`, `providersCovered`, `catalogVersion: "phase-10-hardcoded"`; `topN` (default 5) + `minMonthlySaving` (default 0) filters; `RoutingBillingRegistry` wired to AI-only registry; `billing` namespace, `stability: beta`; toolCount → 11; transport v0.13.0; 26 vitest integration tests. **Total MCP integration tests: 244. Total monorepo: Phase 10 A P0–P4 complete** |
| 2026-03-22 | Phase 10B P5: `PluginSandbox` delivered in `packages/plugin-api/src/sandbox.ts` — `Promise.race` execution with configurable `timeoutMs` (default 5000ms) + `maxCallsPerPlugin` (default 0 = unlimited) guards; per-plugin call count tracking (`getCallCount`, `resetCallCount`, `resetAllCallCounts`); `SandboxViolationError extends Error` with `pluginId` + `reason` fields; timeout wraps non-violation errors; zero external dependencies; 25 vitest tests |
| 2026-03-22 | Phase 10B P6: Signed manifests delivered in `packages/plugin-api/src/manifest.ts` — `FicecalPluginManifest` interface (id, name, version, contributions[], stability, optional bundleUrl/sha256/signingKey/createdAt); `ManifestValidationError` with `field` + `reason`; `validatePluginManifest(unknown): asserts is FicecalPluginManifest` validates scoped id regex (`@scope/name`), semver, contributions enum, stability enum, https-only bundleUrl, 64-char hex sha256; `verifyBundleHash()` via `globalThis.crypto.subtle.digest("SHA-256")`; immutable lock file utilities (`PluginLockFile`, `PluginLockEntry`, `createLockFile`, `upsertLockEntry`, `removeLockEntry`); 28 vitest tests |
| 2026-03-22 | Phase 10B P7: Plugin auto-update delivered in `packages/plugin-api/src/updater.ts` — `PluginUpdateChecker` with `RegistryClient` dependency; single `browse()` call for all plugins; integer semver comparison (major.minor.patch, ignores pre-release); `checkForUpdates(installed, options?)` returns `PluginUpdate[]`; `hasUpdate(pluginId, currentVersion, options?)` for point checks; `PluginUpdate`: `{ id, currentVersion, availableVersion, bundleUrl, bundleSha256, releaseNotes? }`; `@ficecal/plugin-registry-client: workspace:*` added to `plugin-api` deps; 20 vitest tests. **plugin-api total: 165 tests. All three Phase 10B deliverables green** |
| 2026-03-22 | Phase 10 live pricing oracle: `PHASE10_PRICING_CATALOG` hardcoded array removed from `ai-providers-billing-plugin.ts` and `ROUTING_CATALOG` made data-driven. `services/mcp/fixtures/model-pricing-catalog.json` (17 entries, all `ModelPricingReference` fields) created as bundled source. `services/mcp/src/plugins/catalog-loader.ts` — `loadModelPricingCatalog()`: tries `MCP_MODEL_CATALOG_URL` env (HTTP GET, 8s timeout, validates array shape) → falls back to bundled fixture (synchronous `readFileSync`). `setAiProviderPricingCatalog()` + `_resetAiProviderPricingCatalog()` added to ai-providers-billing-plugin. `buildRoutingCatalogFromPricing(ModelPricingReference[]) → RoutingModelEntry[]` + `setRoutingCatalog()` + `_resetRoutingCatalog()` added to billing-routing-optimize tool; `MODEL_TIER_MAP` seeded from `ROUTING_CATALOG`; `COMPANY_TO_PROVIDER` map handles 6 vendors. `initializeCatalog(): Promise<void>` added to registry.ts — called from `buildApp()` in server.ts before `registerMcpRoutes()` so catalogs are populated before registry is built. `_resetRegistry()` also resets catalog singletons. `catalogVersion` field widened from literal to `string`. 244 MCP integration tests green; no new typecheck errors |
| 2026-03-22 | Dev workflow script: `scripts/dev.sh` created — starts `@ficecal/service-mcp` (port 4001) and `apps/web` (port 4321) concurrently with color-coded prefixed output; `VITE_MCP_BASE_URL` auto-injected from `MCP_PORT` env; both processes killed on Ctrl-C / EXIT trap; bash 4+ required; pre-flight checks for pnpm + directory existence. Root `package.json` updated with `dev` / `dev:full` / `dev:mcp` / `dev:web` scripts. **Phase 10 fully complete. Total: 441 tests (244 MCP + 165 plugin-api + 32 mcp-tooling)** |
| 2026-03-23 | **UX audit — ficecal-model-lens (duksh.github.io) first-time visitor experience**: live site (localhost:4321 vs duksh.github.io) compared by FinOps Product Owner review; 10 first-visit gaps identified (G1–G10) spanning brand confusion, missing value proposition, data-without-insight pattern, empty-cell ambiguity, missing FinOps job-to-be-done framing, unsurfaced column definitions, no social proof/trust signals, invisible power features (SQL query builder), mobile breakage, and absence of use-case filter shortcuts. Prioritized resolution table (P1–P8) and Phase 13 UX sprint scope added to §6A. See §6A for full gap register and remediation plan. |

## 1. Planning position

This plan treats FiceCal v2 as a **contract-first modular evolution** of the current live product, not as a blind rewrite.

The primary goal is to preserve the strengths of the current shipped experience:

- explainable FinOps decision support
- deterministic cloud economics modeling
- scenario-driven analysis
- chart-led interpretation
- progressive disclosure through feature controls and user depth modes

While systematically moving the product toward the v2 target state:

- stable module contracts
- explicit UI foundation ownership
- hardened economics engine
- extracted chart / health / recommendation modules
- service and integration expansion through controlled boundaries
- governance-backed release gates

This plan now also explicitly recognizes two new facts:

- current FiceCal v1 aligns more strongly with **FinOps Framework 2026's executive-strategy and decision-support direction** than with its full operating-model breadth
- current FiceCal v1 has only **light conceptual overlap with FOCUS 1.3** and is not yet a FOCUS-native data ingestion, allocation, or conformance surface

## 2. Current-state assessment

Current live/runtime reality appears to be:

- a static-first analytical product centered on `index.html`
- a large but capable orchestration shell with substantial inline UI and domain glue
- runtime modularization already started via `src/core/` and `src/features/`
- working feature catalog and runtime gate model
- active domain modules already visible in product direction:
  - core economics
  - multi-tech normalization
  - AI token economics
  - SLA/SLO/SLI economics
  - agent orchestration
  - demo scenarios
- strong documentation and architecture intent already captured in docs and ADRs

Main gap versus v2 target:

- the current app is modular in intention but not yet modular in authority
- `index.html` still acts as the integration center for too much UI and domain behavior
- contracts exist in planning form, but are not yet the authoritative implementation boundaries
- service/integration ambitions outpace current runtime extraction maturity

Additional standards-alignment assessment:

- **FinOps Framework 2026**: FiceCal v1 partially covers executive strategy alignment, KPI-oriented decision support, and some architecture/optimization thinking, but does not yet cover the broader FinOps operating model, scopes framework, governance breadth, sustainability, or cross-category practice depth
- **FOCUS 1.3**: FiceCal v1 currently models commitment economics conceptually, but does not yet implement dedicated contract commitment datasets, split cost allocation semantics, allocation-method transparency, recency/completeness metadata, or service-provider vs host-provider data modeling

Implication:

- v2 should deliberately strengthen two separate alignment tracks:
  - **Framework alignment** through scopes, business-question framing, technology-category expansion, and strategic decision support
  - **FOCUS readiness** through normalized cost data contracts, metadata, allocation semantics, and adapter-based ingestion

## 3. Guiding principles for v2

1. Preserve behavioral parity before expanding scope.
2. Establish the economics engine as the most trusted module first.
3. Separate UI foundation concerns from business/domain concerns.
4. Extract modules in dependency order, not according to novelty.
5. Add service and provider integrations only after browser/runtime contracts are stable.
6. Use release gates to protect trust, not just code quality.
7. Keep compatibility aliases until migration evidence is complete.
8. Treat **Framework 2026 alignment** and **FOCUS readiness** as explicit roadmap outcomes, not incidental side effects.
9. Build business-question and scope awareness before deep provider-specific ingestion complexity.
10. Make FOCUS support adapter-driven and schema-first rather than hardwired into UI behavior.

## 4. Recommended operating model

Run v2 in **two synchronized tracks**:

### Track A: Product/runtime extraction

Focus:

- browser runtime stabilization
- modularization of current features
- UX/HCI hardening
- contract-aligned parity

### Track B: Platform/service expansion

Focus:

- MCP service layer
- integration-module implementation
- normalized cost data model for FOCUS-ready ingestion
- model catalog and pricing reference ingestion for AI economics
- OpenOps / Infracost adapters
- later direct billing adapters
- monorepo cutover when enough shared assets are real

Reason:

Trying to perform full UI/platform rewrite, modular extraction, service introduction, and billing integration in one stream would create unnecessary coordination and regression risk.

## 4A. External alignment position

### FinOps Framework 2026

FiceCal v2 should align first with the areas where the current product already has strategic momentum:

- executive strategy alignment
- KPI-led decision support
- architecting and workload-placement tradeoff framing
- usage optimization guidance

FiceCal v2 should add structured support for:

- explicit **FinOps scopes**
- broader **technology category** coverage
- stronger **governance and policy interpretation surfaces**
- future sustainability readiness, but not at the expense of core economics modularization

### FOCUS 1.3

FiceCal v2 should not claim FOCUS alignment until it supports, through explicit contracts where relevant:

- contract commitment dataset handling
- split shared-cost allocation representation
- allocation-method transparency
- recency and completeness metadata
- service-provider vs host-provider distinction

Recommendation:

- treat FOCUS support as a **data-model and integration capability**, not as a mere UI labeling exercise

## 4B. Framework 2026 / FOCUS 1.3 coverage matrix

*Last updated: 2026-03-21 against FinOps Framework 2026 (finops.org/insights/2026-finops-framework/) and FOCUS 1.3 ratified 2025-12-04.*

### FinOps Framework 2026 — 22-capability coverage matrix

The 2026 Framework reorganises capabilities across 4 domains with 22 named capabilities (up from 18), introduces the AI technology category page, and refocuses from "cloud" to "technology". Key 2026 changes: new **Executive Strategy Alignment** capability; 6 capabilities renamed for technology-agnosticism; **Scopes** now business-question-driven, not analyst-driven; **Intersecting Disciplines** (ITAM, SAM, ITFM, Sustainability) as a formal capability.

#### Domain 1 — Understand Usage & Cost

| Capability | v2 status | Phase covered | FiceCal evidence |
| --- | --- | --- | --- |
| Data Ingestion | **low** | Phase 8 | Billing fixture plugins deliver deterministic data; no FOCUS-normalized ingestion pipeline; no multi-source aggregation |
| Allocation | **none** | Phase 8 | `NormalizedCostRecord` contract defines allocation fields (allocationScope, allocationMethod) but the module is not built; `BillingLineItem` has tags only |
| Reporting & Analytics | **medium** | Phase 4 (partial) → Phase 7 | `apps/web` health dashboard + D3 cost charts exist; no FOCUS-native views; no persona-segmented report distribution |
| Anomaly Management | **medium** | Phase 10 ✅ | `billing.anomaly.detect` MCP tool: threshold-based spike detection over `NormalizedCostRecord[]`; two-period comparison; severity (warning >50%, critical >100%); `projectedMonthlyOverage`; composite `ingestMode`; 28 integration tests. UI surface: `IntelligencePanel` anomaly section in `apps/web` |

#### Domain 2 — Quantify Business Value

| Capability | v2 status | Phase covered | FiceCal evidence |
| --- | --- | --- | --- |
| Planning & Estimating | **good** | Phase 2 ✅ | `demo-scenarios` (6 canonical scenarios); `budgeting-forecasting` variance; `ai-token-economics` estimation |
| Forecasting | **good** | Phase 2 ✅ | `budgeting-forecasting`: OLS linear trend, moving average, compound growth projection |
| Budgeting | **good** | Phase 2 ✅ | `budgeting-forecasting`: `computeBudgetVariance`, projected budget overage/underage |
| KPIs & Benchmarking | **medium** | Phase 2–3 ✅ | `health-score` weighted signals; `recommendation-module` priority sort; no technology-category-specific KPI library yet; no FOCUS-derived benchmarks |
| Unit Economics | **strong** | Phase 2 ✅ | `ai-token-economics` (6 pricing units); `multi-tech-normalization` (10 tech categories, efficiencyIndex); `sla-slo-sli-economics` (error budget, downtime cost, reliability ROI); `core-economics` normalizePeriod |

#### Domain 3 — Optimize Usage & Cost

| Capability | v2 status | Phase covered | FiceCal evidence |
| --- | --- | --- | --- |
| Architecting & Workload Placement | **low** | Phase 4 (skeletal) → Phase 8 | `ArchitectPanel` exists in `apps/web` but is not connected to real model-comparison computation; no multi-category workload placement framing |
| Rate Optimization | **none** | Phase 9+ | No rate optimization, commitment discount modelling, or reserved-instance analysis module |
| Usage Optimization | **none** | Phase 9+ | No usage optimization, rightsizing, or idle-resource detection |
| Sustainability | **none** | Phase 9+ | No carbon, embodied emissions, or operational carbon module |
| Licensing & SaaS | **none** | Phase 9+ | No SaaS spend tracking, seat utilization, or software license optimization |

#### Domain 4 — Manage the FinOps Practice

| Capability | v2 status | Phase covered | FiceCal evidence |
| --- | --- | --- | --- |
| FinOps Practice Operations | **low** | Phase 7 | Plugin admin panel (Phase 7) is the first operations surface; no maturity tracking, team structure, or practice KPI model |
| Governance, Policy & Risk | **low** | Phase 7 | Phase 7 release gates (fixture parity, invariant tests, alignment evidence) are CI governance; no user-facing policy or risk interpretation surface |
| FinOps Assessment | **good** | Phase 8 ✅ (types) + Phase 9 ✅ (engine + MCP tool) + Phase 10 ✅ (billing correlation + UI) | `@ficecal/finops-assessment` scoring engine: 6 domain scorers, modal maturity tie-break, 58 tests; `finops.assessment.run` MCP tool (36 tests); `finops.assessment.correlate` MCP tool: 7 correlation rules, ROI-ranked `correlatedRecommendations`, `totalAddressableWaste` from real spend, 29 tests; `IntelligencePanel` assessment×billing correlation section in `apps/web` |
| Automation, Tools & Services | **low** | Phase 5 ✅ (partial) | MCP service layer + 5 tools is the automation surface; billing plugins are the "services" layer; breadth is narrow |
| FinOps Education & Enablement | **none** | Phase 9+ | No glossary, learning paths, or enablement content surface |
| Invoicing & Chargeback | **none** | Phase 8 | Not started; requires FOCUS-aligned billing data (Phase 8 dependency) |
| Intersecting Disciplines | **none** | Phase 9+ | No ITAM, SAM, ITFM, or security integration surface |
| **Executive Strategy Alignment** *(new 2026)* | **low** | Phase 7–8 | `executive` intent + `executive-strategy` scope exist in `ui-foundation`; no actual strategic decision support surface, multi-year investment model, or leadership KPI narrative module |

#### AI technology category (new 2026)

FiceCal v2 is **strongest here** relative to the 2026 Framework due to the depth of `ai-token-economics` and the model catalog integration.

| AI Consideration | v2 status | FiceCal evidence |
| --- | --- | --- |
| Cost per inference / per token | **strong** ✅ | `ai-token-economics` computes cost for 6 pricing units including per_1m_tokens, per_image; `economics.estimate.cost` MCP tool exposes this to AI agents |
| Multi-provider model comparison | **strong** ✅ | `ModelPricingReference` + `duksh-models-adapter` + `ficecal-model-lens` upstream; 6 AI provider billing adapters (Anthropic/OpenAI/Gemini/Mistral/DeepSeek/Alibaba) in `@ficecal/billing-ai-providers`; `billing.routing.optimize` identifies cheaper equivalents across all providers |
| Token consumption tracking | **good** | `economics.estimate.cost` MCP tool; `billing.estimate.actual` per-provider NormalizedCostRecord[]; `@ficecal/billing-ai-providers` normalizes token usage → FOCUS 1.3 records for all 6 AI providers; session-level tracking deferred |
| GPU cost modelling | **none** | No infrastructure-level GPU cost module |
| Training vs inference cost separation | **partial** | Tags in `BillingLineItem` can distinguish workloads; `billing.estimate.actual` returns per-service breakdown; no first-class separation until `NormalizedCostRecord` v2 `serviceSubcategory` (Phase 8) |
| AI governance / quota management | **none** | No spend quota, throttling, or AI-specific governance module |
| Crawl/Walk/Run maturity for AI FinOps | **medium** | `AiMlCostAssessment` in `@ficecal/contracts`; `finops.assessment.correlate` surfaces AI-specific gaps (`hasAiCostVisibility`, `hasTokenAttribution`, `hasModelCostOptimization`, `hasAiCostAlerts`) with ROI-ranked recommendations; `IntelligencePanel` exposes maturity level + addressable waste in `apps/web` |

---

### FOCUS 1.3 — 77-column coverage matrix

FOCUS 1.3 (ratified 2025-12-04) defines two datasets: **Cost and Usage Dataset** (77 columns) and the new **Contract Commitment Dataset** (13 columns — note: plan previously stated 11, corrected 2026-03-21). FiceCal's `BillingPeriodSummary` and `BillingLineItem` from Phase 6 are lightweight custom schemas that overlap with ~12 of 77 FOCUS columns.

**Updated 2026-03-21 (Phase 8 P0):** `NormalizedCostRecord` v2 (`"2.0.0"`) delivered in `packages/schemas`. Coverage now ~82%. Remaining 13 columns deferred and documented in `FOCUS_V1_3_GAP_COLUMNS`.

| Category | Columns (77 total) | FiceCal v2 equivalent | Coverage |
| --- | --- | --- | --- |
| **Account** (6) | BillingAccountID, BillingAccountName, BillingAccountType, SubAccountID, SubAccountName, SubAccountType | All 6 added in v2 (`billingAccountId/Name/Type`, `subAccountId/Name/Type`) | **6/6** ✅ |
| **Allocation** (5) | AllocatedMethodDetails, AllocatedMethodID, AllocatedResourceID, AllocatedResourceName, AllocatedTags | `allocatedCost` + `allocatedMethodID` added; AllocatedResourceID/Name/Tags deferred | **1/5** |
| **Billing** (9) | BilledCost, BillingCurrency, ConsumedQuantity, ConsumedUnit, ContractedCost, ContractedUnitPrice, EffectiveCost, ListCost, ListUnitPrice | All 9 added in v2 (7 FOCUS cost columns + `billedUnitPrice`; `consumedQuantity/Unit` mapped) | **9/9** ✅ |
| **Capacity Reservation** (2) | CapacityReservationID, CapacityReservationStatus | deferred — in `FOCUS_V1_3_GAP_COLUMNS` | 0/2 |
| **Charge** (4) | ChargeCategory, ChargeClass, ChargeDescription, ChargeFrequency | All 4 added in v2 (enums + `chargeDescription`) | **4/4** ✅ |
| **Charge Origination** (6) | HostProviderName *(1.3)*, InvoiceID, InvoiceIssuer, ProviderName, PublisherName, ServiceProviderName *(1.3)* | `provider`, `serviceProviderName`, `hostProviderName`, `publisherName` added; `invoiceId/Issuer` deferred | **4/6** |
| **Commitment Discount** (7) | CommitmentDiscountCategory, CommitmentDiscountID, CommitmentDiscountName, CommitmentDiscountQuantity, CommitmentDiscountStatus, CommitmentDiscountType, CommitmentDiscountUnit | All 7 added in v2 + `billing.commitment.status` MCP tool covers all 7 | **7/7** ✅ |
| **Contract** (13) *(1.3 new dataset)* | ContractApplied, ContractCommitmentCategory … ContractPeriodStart | deferred — in `FOCUS_V1_3_GAP_COLUMNS` | 0/13 |
| **Location** (3) | AvailabilityZone, RegionID, RegionName | All 3 added in v2 | **3/3** ✅ |
| **Pricing** (7) | PricingCategory, PricingCurrency, PricingCurrencyContractedUnitPrice, PricingCurrencyEffectiveCost, PricingCurrencyListUnitPrice, PricingQuantity, PricingUnit | `pricingCategory`, `pricingCurrency`, `pricingQuantity`, `pricingUnit`, `pricingUnitPrice` added; 2 PricingCurrency variants deferred | **5/7** |
| **Resource** (3) + Tags | ResourceID, ResourceName, ResourceType, Tags | `resourceType` + `tagKeys` added in v2; `resourceId/Name` already present | **4/4** ✅ |
| **Service** (3) | ServiceCategory, ServiceName, ServiceSubcategory | All 3 added in v2 | **3/3** ✅ |
| **SKU** (4) | SKUID, SKUMeter, SKUPriceDetails, SKUPriceID | deferred — in `FOCUS_V1_3_GAP_COLUMNS` | 0/4 |
| **Timeframe** (4) | BillingPeriodEnd, BillingPeriodStart, ChargePeriodEnd, ChargePeriodStart | All 4 present (v1 carried forward; ChargePeriod fields added in v2) | **4/4** ✅ |

**Current FOCUS coverage: ~51 of 77 columns (~82%) — credible alignment claim for Cost and Usage Dataset. Contract Dataset (13 cols) and SKU (4 cols) remain deferred.**

#### FOCUS 1.3 — new capabilities to prioritise in Phase 8

| FOCUS 1.3 addition | What it enables | Phase 8 target |
| --- | --- | --- |
| **Contract Commitment Dataset** (13 columns) | Query all active commitments; reserved instance exposure; RI coverage reporting | `NormalizedCostRecord.contract.*` schema + fixture |
| **Allocation columns** (5) | Understand how providers distributed shared costs; chargeback transparency | `allocationMethodID`, `allocationMethodDetails`, `allocatedResourceID/Name/Tags` |
| **ServiceProviderName / HostProviderName** | Distinguish who sells vs. who hosts (critical for marketplace + multi-tier architectures) | `providerRole` enum in NormalizedCostRecord |
| **Data recency / completeness** | Timestamp metadata + final vs. provisional data flags; stale-data warnings | `dataRecencyTimestamp`, `dataCompleteness` (already in NormalizedCostRecord contract) |
| **EffectiveCost vs BilledCost vs ListCost** | Distinguish actual spend from committed/contracted rates from list prices | Three separate cost fields in NormalizedCostRecord |
| **ChargeCategory / ChargeClass** | Separate usage charges from tax, adjustment, refund, purchase | `amountType` expansion in NormalizedCostRecord |

---

*Interpretation updated 2026-03-22 (Phase 10A complete):*
- FiceCal v2 is **the strongest FinOps tool for AI cost intelligence** in the framework's AI technology category — 6-provider AI billing adapters (`@ficecal/billing-ai-providers`), `billing.routing.optimize` model substitution, `finops.assessment.correlate` AI gap ROI ranking, and `IntelligencePanel` UI surface all now ship together
- FiceCal v2 can make a **credible FOCUS alignment claim**: `NormalizedCostRecord` v2 covers ~82% of Cost and Usage Dataset columns. Contract Dataset (13 cols) and SKU (4 cols) remain deferred in `FOCUS_V1_3_GAP_COLUMNS`
- **Anomaly Management** is now `medium` coverage — `billing.anomaly.detect` + `IntelligencePanel` anomaly section provide active FinOps alerting
- **FinOps Assessment** is now `good` — `finops.assessment.correlate` closes the gap between maturity scores and dollar impact; practitioners can see `totalAddressableWaste` from their actual billing data
- **`commitment-management` and `shared-cost-allocation`** scopes are both backed: `billing.commitment.status` (7 FOCUS CommitmentDiscount cols) and `billing.chargeback.allocate` (even/proportional/tag-based allocation) delivered in Phase 9
- FiceCal v2's biggest remaining Framework 2026 gaps: **Rate Optimization** (no commitment discount modeling), **Usage Optimization** (no rightsizing/idle detection), **Sustainability** (no carbon module), live AI billing API calls (currently deterministic-only), and the pricing catalog being hardcoded rather than live from ficecal-model-lens

## 4C. Refined scope taxonomy

The first scope taxonomy should help FiceCal organize analysis around business questions rather than around raw feature lists.

### Scope principles

- scopes should be understandable to executive, operator, and architect audiences
- scopes should map to decision questions, not implementation details
- scopes should be stable enough for telemetry, reporting, and recommendation framing
- scopes should allow future FOCUS-backed data enrichment without changing their user-facing meaning

### Proposed scope taxonomy v1

| Scope key | Primary business question | Main audience | Typical outputs |
| --- | --- | --- | --- |
| `baseline-unit-economics` | what does this workload or service fundamentally cost and why | operator, architect | baseline cost, cost drivers, normalized unit view |
| `optimization-opportunities` | where is waste, inefficiency, or mis-sizing likely present | operator | savings signals, recommendation priority, efficiency health |
| `architecture-tradeoffs` | which design or hosting choice produces the better economic outcome | architect | scenario comparison, tradeoff narrative, break-even signals |
| `executive-strategy` | which decisions deserve leadership attention and investment prioritization | executive | KPI summary, risk summary, prioritization narrative |
| `commitment-management` | how should commitments be interpreted, compared, and governed | operator, executive | commitment exposure, utilization, coverage, risk |
| `shared-cost-allocation` | how should shared or indirect costs be assigned and explained | operator, executive | allocation breakdown, method transparency, fairness rationale |

### Initial implementation guidance

- Phase 2 should operationalize:
  - `baseline-unit-economics`
  - `optimization-opportunities`
  - `architecture-tradeoffs`
  - `executive-strategy`
- ~~Phase 6 should operationalize:~~ **deferred to Phase 8** (2026-03-21: Phase 6 pivoted to plugin architecture foundation; these scopes require FOCUS Allocation and Contract Commitment columns which are Phase 8 deliverables)
  - `commitment-management` — requires `NormalizedCostRecord` v2 Contract Commitment Dataset (Phase 8A) and `billing.commitment.query` MCP tool (Phase 8)
  - `shared-cost-allocation` — requires FOCUS Allocation columns (Phase 8A) and `billing.chargeback.allocate` MCP tool (Phase 8)

> ⚠️ **UX note (2026-03-21):** Both `commitment-management` and `shared-cost-allocation` scopes are live in `IntentScopeState` but have zero backing computation, MCP tools, or UI content. Until Phase 8 delivers the required modules, these scope options should be guarded by a feature flag or displayed with a "coming soon" degradation state to prevent users from selecting empty scopes.

### UX mapping guidance

- **Intent** answers why the user came
- **Scope** answers which business question is active
- **Mode** answers how much detail is exposed

## 4D. Models integration track

FiceCal v2 should treat **FiceCal Model Lens** (`duksh/ficecal-model-lens`) and Vantage-compatible model catalog data as a dedicated **reference-data integration track** for AI model economics.

### FiceCal Model Lens — sub-product status

**FiceCal Model Lens** is the renamed and rebranded version of `duksh/models`. It is a standalone Astro + React + Tailwind site with its own scraper pipeline and CI, acting as the authoritative upstream model catalog.

| Attribute | Value |
| --- | --- |
| Repo | `duksh/ficecal-model-lens` (formerly `duksh/models`) |
| Live site | `modellens.ficecal.com` (planned) |
| Status | Active — scrapers running for AWS Bedrock, GCP, Azure AI, OpenAI, Anthropic, Mistral, DeepSeek, Alibaba, IBM |
| Data output | `public/data.json` — scraped on a schedule, committed on change |
| Connection to FiceCal v2 | `duksh-models-adapter` in `packages/integrations/models-pricing/` consumes `data.json`; no direct repo dependency |
| Monorepo cutover | Deferred to Phase 4; until then operates as a separate deployable |

Model Lens carries `priceVerifiedAt` timestamps on all hardcoded image prices, and the adapter translates `priceSource` into `pricingSourceType` — giving FiceCal v2 full pricing provenance from scrape time through to UI badge.

### Strategic role

- provide model/vendor/region pricing reference data for `ai-token-economics`
- support architecture and optimization comparisons for AI workloads
- enrich recommendation and executive strategy outputs with market-reference model choices
- support scenario design without being mistaken for actual billed cost evidence
- **act as the pricing oracle for all live AI billing adapters** — billing adapters fetch token counts from provider usage APIs; cost = tokens × `ModelPricingReference` rates from model-lens; this eliminates per-adapter pricing logic entirely
- **enable model routing optimization** — when combined with actual `NormalizedCostRecord` spend data, model-lens pricing enables `billing.routing.optimize` to identify cheaper equivalent models; this is the capability that makes FiceCal's AI cost management unique vs generic FinOps tools
- **cover all major AI providers** — Anthropic, OpenAI, GCP (Gemini), Azure AI, Mistral, DeepSeek, Alibaba (Qwen), IBM (Watsonx), plus LiteLLM/OpenRouter aggregators; multi-currency handled via Phase 1 `StaticForexAdapter`

### Billing adapter integration pattern (Phase 10)

This pattern governs how all AI provider billing adapters consume model-lens pricing:

```
ficecal-model-lens data.json
  → duksh-models-adapter (packages/integrations/models-pricing/)
  → ModelPricingReference { inputTokenCost, outputTokenCost, cachedInputCost, pricingSourceType, sourceVersion }
  → AiProviderBillingAdapter.fetchUsage() returns token counts only
  → normalize.ts: tokens × ModelPricingReference rates → NormalizedCostRecord v2
  → dataCompleteness: "partial" (token-level detail; no region/SKU from usage APIs)
```

Guardrail: billing adapter outputs must never set `dataCompleteness: "complete"` — usage APIs do not provide full FOCUS column coverage. Native provider adapters (Phase 11) using billing export APIs may qualify for `"complete"`.

### Positioning rule

- `ModelPricingReference` is **reference catalog data**
- `NormalizedCostRecord` is **cost and usage fact data**
- FiceCal may combine these in scenario and recommendation layers, but must never silently present them as the same class of evidence

### Source-of-truth guidance

- prefer `duksh/ficecal-model-lens` as the curated upstream when available
- treat Vantage-compatible data structures as the interoperability target for adapter design
- snapshot imported model catalog data into versioned fixtures before broad product reliance

### Module impact

- `integration-module` should own ingestion, refresh, caching, and fixture generation
- `ai-token-economics` should consume normalized model pricing references
- `architecture-tradeoffs` should use model/vendor/region comparisons for decision framing
- `recommendation-module` should consume derived comparison outputs, not raw source tables

### Evidence rule

- outputs using model catalog data must be labeled as **reference**, **scenario**, or **estimated** unless corroborated by actual cost records

## 4E. Models integration gap resolutions

This section addresses five open gaps identified during cross-referencing of the `duksh/ficecal-model-lens` upstream against the `ModelPricingReference` contract.

| Gap | Status |
| --- | --- |
| Gap 1 — Image pricing unit mismatch | **Closed** ✅ — `per_image` dispatch branch implemented in `ai-token-economics` (PR #125); `computeImageCost` handles `imageOutputCost` path; exhaustive discriminated-union switch enforced |
| Gap 2 — Source attribution | **Implemented** — `pricingSourceType` mapping delivered in PR #118 (`packages/schemas/model-catalog/`, `packages/integrations/models-pricing/src/transform.ts`) |
| Gap 3 — Snapshot versioning | **Implemented** — `computeSourceVersion()` delivered in PR #118 (`packages/integrations/models-pricing/src/snapshot.ts`) |
| Gap 4 — Approved benchmark list | **Implemented** — `APPROVED_BENCHMARKS` typed const delivered in PR #118 (`packages/schemas/model-catalog/index.ts`) |
| Gap 5 — Forex source dependency | **Closed** ✅ — `ForexRateProvider` interface, `StaticForexAdapter`, and `normalizePeriod` delivered in `@ficecal/core-economics` (Phase 1); ECB live feed adapter deferred to integration phase (Phase 6) — static fixture adapter is CI/offline default |

### Gap 1 — Image model pricing unit mismatch *(partially implemented)*

**Problem:** `ModelPricingReference` and `ai-token-economics` are designed around token-denominated pricing. Image generation models (Imagen 3, DALL-E, Titan Image) are priced per image, not per token. The original `pricingUnit` field did not define `per_image` semantics, and there was no field for image output cost.

**Implemented (PR #118 + upstream `duksh/ficecal-model-lens`):**
- `pricingUnit` now explicitly supports `per_image` as a valid enum value alongside `1K_tokens` and `1M_tokens` — defined in `packages/schemas/model-catalog/index.ts`
- `imageOutputCost` has been added to `ModelPricingReference` as a required field when `pricingUnit` is `per_image`
- `priceVerifiedAt` has been added to the upstream (`ficecal-model-lens`) image vendor records and flows through the adapter; staleness badge implemented in the Model Lens UI (30-day threshold: amber → red)
- Token cost fields (`inputTokenCost`, `outputTokenCost`, etc.) are explicitly absent on image records — enforced by adapter transform

**Remaining for Phase 2:**
- `ai-token-economics` dispatch branch (`pricingUnit === "per_image"` → `imageOutputCost` path) not yet implemented
- Decision confirmed: use `pricingUnit` dispatch inside `ai-token-economics`, not a separate module (see resolution approach below)

**Module impact:**
- `ai-token-economics` must not attempt to apply token-based unit economics to a record with `pricingUnit: per_image`
- a dedicated `ai-image-economics` path should be defined within `ai-token-economics` or as a sibling module that handles image generation cost modeling (cost = quantity × imageOutputCost)
- `architecture-tradeoffs` and `recommendation-module` must treat image and token costs as incommensurable unless explicitly normalized by the user

#### Resolution approach

Extend `ai-token-economics` with a `pricingUnit` dispatch branch at the top of the cost computation function. Do not create a separate module at this stage — the two cost shapes are simple enough that a branch is the right boundary:

```
computeModelCost(record, quantity):
  if record.pricingUnit === "per_image":
    return quantity × record.imageOutputCost          // images × cost/image
  else:
    return (quantity / unitDenominator) × tokenCost   // tokens ÷ 1M × cost/1M
```

Extraction trigger: only promote image logic to a standalone `ai-image-economics` module if resolution tiers, batch pricing, or other image-specific dimensions emerge that would make the branch materially more complex than the token path. Until then, module proliferation is the greater risk.

### Gap 2 — Source attribution must flow through to the contract *(implemented — PR #118)*

**Problem:** `duksh/ficecal-model-lens` carries a `priceSource` field per vendor entry (`scraped`, `hardcoded`, `litellm`) but `ModelPricingReference` had no equivalent field. Without this, FiceCal cannot surface pricing reliability to users or treat hardcoded Imagen prices differently from LiteLLM-scraped GPT-4o prices in outputs.

**Delivered:** `pricingSourceType` has been added to `ModelPricingReference` as a required enum field in `packages/schemas/model-catalog/index.ts`. The adapter in `packages/integrations/models-pricing/src/transform.ts` maps upstream `priceSource` → `pricingSourceType` at ingestion. The Model Lens UI already surfaces price badges: "↻ Live pricing" (dynamic), "⚠ Manually maintained" (hardcoded fresh), "⚠ Unverified (N days old)" (hardcoded stale).

**Resolution:** `pricingSourceType` has been added to `ModelPricingReference` as a required enum field:

| Value | Meaning |
| --- | --- |
| `dynamic` | price was scraped from a live or frequently-updated external catalog (e.g. LiteLLM) at adapter ingestion time |
| `hardcoded` | price is manually maintained in source code; no programmatic upstream; staleness must be tracked by `effectiveAt` |
| `verified` | price was confirmed against a vendor's authoritative source (pricing API, official pricing page) at a known point in time |

**Consumer guidance:**
- `ai-token-economics` and `ai-image-economics` outputs must surface `pricingSourceType` in their output evidence payload
- the UI must display a distinct visual indicator for `hardcoded` prices (e.g. "⚠ Manually maintained") versus `dynamic` prices (e.g. "↻ Live source")
- `recommendation-module` must not rank or compare a `hardcoded` price against a `dynamic` price without surfacing the reliability difference to the user

#### Resolution approach

Map `duksh/ficecal-model-lens` `priceSource` field to `pricingSourceType` at the adapter boundary:

| `duksh/ficecal-model-lens` `priceSource` | `ModelPricingReference` `pricingSourceType` |
| --- | --- |
| `litellm` | `dynamic` |
| `scraped` | `dynamic` |
| `hardcoded` | `hardcoded` |

UI badge rules:
- `dynamic` → "↻ Live source" indicator (subtle, informational)
- `hardcoded` → "⚠ Manually maintained" indicator (amber, draws attention to potential staleness)
- `verified` → "✓ Verified [date]" indicator (green, sourced from a vendor's authoritative endpoint)

`recommendation-module` rule: when a multi-model comparison includes entries of mixed `pricingSourceType`, the evidence payload must include a reliability caveat and surface it to the user. Silent ranking of mixed-source prices is not permitted.

### Gap 3 — Snapshot versioning convention for the adapter *(implemented — PR #118)*

**Delivered:** `computeSourceVersion()`, `parseSourceVersion()`, and `sourceVersionAgeInDays()` implemented in `packages/integrations/models-pricing/src/snapshot.ts`. Format is `sha256(data.json)[0:12]@YYYY-MM-DD`. Fixture tests confirm determinism and correct age calculation.

**Problem:** `duksh/ficecal-model-lens` produces a single flat `data.json` with no built-in version identifier. The `ModelPricingReference` contract requires `sourceVersion`, but the upstream provides no canonical way to generate one.

**Resolution:** the `duksh-models-adapter` must generate its own `sourceVersion` on each ingestion using the following convention:

```
sourceVersion = sha256(data.json contents)[0:12] + "@" + ingestedAt[0:10]
```

Example: `a3f9b12cd401@2026-03-20`

**Rationale:**
- the content hash detects actual data changes even if the file modification date is unchanged
- the ingestion date suffix makes human inspection practical
- this is stable enough for fixture determinism without requiring `duksh/ficecal-model-lens` to adopt versioning itself

**Additional guidance:**
- if `duksh/ficecal-model-lens` is later extended with a manifest version or `scrapedAt` metadata field, the adapter should prefer that over the hash-based convention
- the adapter must log and expose `sourceVersion` in every `ModelPricingReference` record it emits
- fixture snapshots must be named by `sourceVersion` to enable deterministic test replay

#### Resolution approach

Versioning is entirely inside the adapter — zero changes required to `duksh/ficecal-model-lens`:

```
sourceVersion = sha256(data.json contents)[0:12] + "@" + ingestedAt[0:10]
// example: a3f9b12cd401@2026-03-20
```

Content-addressed skip rule: if the hash component of `sourceVersion` matches the last successfully ingested snapshot, skip re-snapshotting. This gives free incremental caching without any state management beyond storing the last known hash.

Fixture naming: `snapshot-{sourceVersion}.json` stored under `packages/model-catalog-contracts/fixtures/`. Test suites reference fixtures by `sourceVersion` string, never by relative path alone, so replaying any historical snapshot is unambiguous.

### Gap 4 — Approved benchmark list *(implemented — PR #118)*

**Delivered:** `APPROVED_BENCHMARKS` typed const and `ApprovedBenchmarkKey` type implemented in `packages/schemas/model-catalog/index.ts`. The adapter strips any key not in the list at ingestion time and counts stripped keys in `strippedBenchmarkCount`. Fixture tests confirm enforcement. The list matches the resolution approach exactly.

**Problem:** `benchmarkScores` in `ModelPricingReference` is an open object map. Without a curated approved list, the adapter will pass through whatever benchmarks `duksh/ficecal-model-lens` includes on any given day, making `recommendation-module` outputs non-deterministic across snapshot versions when benchmark availability varies.

**Resolution:** the following benchmark keys are approved for inclusion in `benchmarkScores` at Phase 1:

| Key | Description |
| --- | --- |
| `swe_bench_verified` | SWE-bench Verified score (software engineering task resolution) |
| `mmlu` | MMLU aggregate score (multitask language understanding) |
| `humaneval` | HumanEval pass@1 (code generation) |
| `gpqa_diamond` | GPQA Diamond score (graduate-level scientific reasoning) |
| `math_500` | MATH-500 score (competition mathematics) |
| `aime_2024` | AIME 2024 score (advanced math olympiad) |

**Rules:**
- the `duksh-models-adapter` must strip any benchmark key not in this approved list before emitting a `ModelPricingReference` record
- the approved list is a versioned artifact owned by `model-catalog-contracts`; additions require an explicit ADR or plan amendment
- benchmark scores must carry no implied weight in `recommendation-module` ranking without explicit user opt-in

#### Resolution approach

The approved list lives as a typed const in `model-catalog-contracts`:

```
// packages/model-catalog-contracts/src/approvedBenchmarks.ts
export const APPROVED_BENCHMARKS = [
  "swe_bench_verified",
  "mmlu",
  "humaneval",
  "gpqa_diamond",
  "math_500",
  "aime_2024",
] as const

export type ApprovedBenchmarkKey = typeof APPROVED_BENCHMARKS[number]
```

Adapter strip-at-ingestion pattern:

```
const filtered = Object.fromEntries(
  Object.entries(raw.benchmarkScores ?? {})
    .filter(([key]) => APPROVED_BENCHMARKS.includes(key))
)
```

Governance rule: any addition to `APPROVED_BENCHMARKS` requires a PR to that file and a note in the plan amendment log. The file is the gate — convention alone is not sufficient.

### Gap 5 — Forex source dependency *(pending — Phase 1)*

**Problem:** FiceCal v1 already performs currency conversion (evidenced by the `forex.json` dependency). Model prices from `duksh/ficecal-model-lens` are USD-only. Phase 1 adds currency normalization to `economics-module`, but the plan does not define where the forex rates come from.

**Resolution:** the following forex source hierarchy is recommended:

1. **Primary:** a scheduled-fetch from the European Central Bank (ECB) daily reference rates XML feed (`https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`) — free, authoritative, no API key required
2. **Fallback:** a versioned static `forex-rates.json` fixture bundled with the repo, manually updated when the primary feed is unavailable
3. **Adapter boundary:** forex rates must be injected into `economics-module` as a named dependency, never imported directly inside domain logic — this keeps the module deterministic and testable with fixture rates

**Staleness rule:** if the fetched ECB rates are older than 3 calendar days relative to the current calculation date, the UI must surface a `stale-forex` warning equivalent in severity to the `stale-reference` model pricing warning.

**Scope:** this applies to all currency-normalized outputs, including model pricing reference costs, unit economics outputs, and any scenario that presents multi-currency comparisons.

#### Resolution approach

Define a `ForexRateProvider` interface as the injection contract:

```
interface ForexRateProvider {
  getRates(baseCurrency: string, asOf: Date): Promise<ForexRates>
  ageInDays(): number
}
```

Two implementations:
- `EcbForexAdapter` — fetches the ECB daily reference rates XML feed (`https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`), parses EUR-base rates, derives any cross-rate on demand. No API key required.
- `StaticForexAdapter` — reads a versioned `forex-rates.json` fixture from the repo. Used in all tests and as the CI/offline fallback.

Injection pattern — `economics-module` never imports forex directly:

```
const forex = await EcbForexAdapter.load()
if (forex.ageInDays() > 3) emitWarning("stale-forex")
const module = new EconomicsModule({ forex })
```

This keeps `economics-module` fully deterministic in tests (swap in `StaticForexAdapter` with fixture rates) and decouples the live feed from domain logic. The `forex-rates.json` fallback must be updated manually whenever the ECB feed is unavailable for an extended period; this update should be part of the same workflow as the `npm run init` scraper cycle.

### Recommended implementation sequence for section 4E gaps

| Step | Gap | Status | Rationale |
| --- | --- | --- | --- |
| 1 | Gap 3 — Snapshot versioning | ✅ Done (PR #118) | Zero-risk, self-contained adapter utility; unblocks fixture generation for all subsequent work |
| 2 | Gap 4 — Approved benchmark list | ✅ Done (PR #118) | Zero-risk typed constant; must exist before any adapter emits `benchmarkScores` |
| 3 | Gap 2 — Source attribution | ✅ Done (PR #118) | Requires Gap 3 (snapshots) to be testable; adapter mapping is low-complexity |
| 4 | Gap 1 — Image pricing unit | ✅ Done (PR #125) | `computeImageCost` dispatch branch implemented inside `ai-token-economics`; exhaustive switch enforced |
| 5 | Gap 5 — Forex source | ✅ Done (Phase 1 core-economics) | `ForexRateProvider` interface + `StaticForexAdapter` delivered; ECB live adapter deferred to Phase 6 |

## 4G. "WordPress of FinOps" — strategic direction and gap analysis

*Added 2026-03-21 after Phase 6 plugin architecture decision.*

### Strategic direction

FiceCal v2's long-term platform ambition is to become the **WordPress of FinOps**: a product where the core ships a trustworthy analytical foundation and the ecosystem builds the long tail of providers, themes, integrations, and vertical-specific modules as plugins — without requiring changes to core.

WordPress's dominance came from five structural advantages: an ecosystem lock-in loop, zero-friction install model, a marketplace, a theme/plugin runtime, and a reliable update path. The Phase 6 plugin-api establishes the first structural primitive. The gaps below must be closed systematically across Phases 7–9.

### Gap analysis against WordPress model

| Gap | Priority | Target Phase | Description |
| --- | --- | --- | --- |
| No hook/filter system | P0 | Phase 7 | Plugins can only *add* contribution points — they cannot *transform* outputs. `add_action` / `add_filter` equivalents needed. This is WordPress's actual moat. |
| ~~ThemeRegistry → ThemeManager not wired~~ | ~~P0~~ | ~~Phase 7~~ | **✅ Done (Phase 7 P0, 2026-03-21)** — `ThemeTokenSource` interface bridges `ThemeManager` ↔ `ThemeRegistry` without a package dep; `setCustomTheme()` / `clearCustomTheme()` / `listThemes()` added; `ThemePicker.tsx` live in `apps/web`; `NavBar` updated; 163 tests passing |
| No admin / configuration UI | P1 | Phase 7 | No surface for users to see installed plugins, switch themes, or check billing provider status. Without this, the plugin system is invisible. |
| No multi-tenancy / workspace isolation | P1 | Phase 7 | `workspaceId` exists in `McpRequestContext` but plugins, billing adapters, and theme preferences are global singletons. Required for hosted SaaS model. |
| No plugin marketplace / registry client | P2 | Phase 8 | Plugins are hard-coded imports in `registry.ts`. Community developers cannot publish without a code change. **Resolved design: GitHub-based registry at `duksh/ficecal-plugin-registry`** (PR-based submission, jsDelivr CDN, `packages/plugin-registry-client` fetches `index.json`). |
| No developer SDK / scaffolding | P2 | Phase 8 | No `npx create-ficecal-plugin`, no testing utilities for plugin authors, no `ficecal-plugin.json` standard. |
| No update / versioning pipeline | P2 | Phase 8 | Billing fixture data requires a full redeployment to update. No auto-update mechanism for plugins. |
| No plugin isolation / sandbox | P3 | Phase 9 | All plugins share the same JS process. A buggy community plugin can crash the MCP service or read cross-workspace billing data. |
| No signed / verified plugin contracts | P3 | Phase 9 | Any `FicecalPlugin` object can claim any ID. Community distribution requires code-signing, version pinning, and manifest verification. |

### The flywheel

The two gaps that unlock the ecosystem flywheel fastest are:

1. **Hook/filter system** — makes plugins *composable* (one plugin's output becomes another plugin's input) — **Phase 7 P1, not yet started**
2. **Live theme picker** — visible proof to end users that the plugin architecture is real; lowest-friction community contribution path — **✅ Done (Phase 7 P0, 2026-03-21)**

Hook/filter system is now the sole remaining flywheel-critical gap.

### WordPress analogy mapping

| WordPress concept | FiceCal equivalent | Status |
| --- | --- | --- |
| Theme API | `ThemeContribution` + `ThemeRegistry` + `ThemePicker` | **Built + wired to UI (Phase 7 P0 ✅)** — `ThemeManager.setCustomTheme()` routes through `ThemeRegistry`; `ThemePicker.tsx` lists all plugin-contributed themes with swatches |
| Plugin API (`FicecalPlugin`) | `@ficecal/plugin-api` | Built (Phase 6) ✅ |
| `wp-admin` | Plugin/theme admin panel in `apps/web` | Phase 7 |
| `add_action` / `add_filter` | `HookRegistry` in `@ficecal/plugin-api` | Phase 7 |
| `wordpress.org/plugins` | `duksh/ficecal-plugin-registry` (GitHub) + `plugin-registry-client` | Phase 8 (client ✅ done; registry repo ⬜ Phase 9) |
| Theme/plugin signing | Signed `ficecal-plugin.json` manifests | Phase 9 |
| Multisite | `WorkspaceRegistry` multi-tenancy | Phase 9 (carried from Phase 7) |
| Auto-updates | Plugin update pipeline | Phase 9 |
| Hook/filter system | `HookRegistry` `addFilter` / `addAction` | Phase 9 P0 (carried from Phase 7) |
| Developer SDK | `npx create-ficecal-plugin` scaffold CLI | Phase 8 ✅ done — 4 plugin types, 59 tests |
| Admin Browse Plugins tab | `AdminPanel` Section 4 — Registry Browser | Phase 8 ✅ done — lazy-load, tag/search filters, readiness |
| SHA-256 bundle verification | Web Crypto API in `plugin-registry-client` | Phase 8 ✅ done |
| FinOps Assessment types | `@ficecal/contracts` boundary interfaces | Phase 8 ✅ done — 6 domains, 3 maturity levels |
| FinOps Assessment engine | `@ficecal/finops-assessment` + `finops.assessment.run` MCP tool | Phase 9 ✅ done — 6 domain scorers; 58 engine tests + 36 MCP tests; toolCount → 8 |
| CommitmentDiscount MCP tool | `billing.commitment.status` — all 7 FOCUS columns | Phase 8 ✅ done — AWS/GCP/Azure fixtures |
| Live AWS billing adapter | `aws-billing-plugin.ts` v2.0.0 — real Cost Explorer SDK | Phase 9 ✅ done — 501 stub retired; dynamic SDK import |
| Billing MCP tools on NormalizedCostRecord v2 | `billing.estimate.actual` + `billing.compare.period` upgraded from `BillingPeriodSummary` | Phase 9 ✅ done — FOCUS dead end resolved; transport v0.11.0 |

## 4F. GitOps and repository structure

This section documents the actual branch and repo structure established on 2026-03-20.

### Repository layout

| Repo | Purpose | Status |
| --- | --- | --- |
| `duksh/FiceCal` | FiceCal v2 monorepo (pnpm workspaces) | Active — `develop` branch is the v2 integration base |
| `duksh/ficecal-model-lens` | FiceCal Model Lens — standalone AI model catalog site (formerly `duksh/models`) | Active — separate repo until Phase 4 monorepo cutover |

### Branch strategy (`duksh/FiceCal`)

```
main                        ← v1 production (protected; no v2 code ever lands here directly)
develop                     ← v2 integration base (all feature PRs target here)
feature/<name>              ← individual features branched off develop
fix/<name>                  ← bug fixes branched off develop (or main for hotfixes)
release/phase-<N>           ← phase release candidates; merged → main on sign-off
```

### Tagging convention

```
v2.0.0-phase-0-exit         ← immutable snapshot on merge of release/phase-0 → main
v2.0.0-phase-1-exit
...
v2.0.0-rc.1                 ← release candidate after Phase 7
v2.0.0                      ← FiceCal v2 GA
```

### CI/CD per branch

| Branch | Jobs |
| --- | --- |
| `main` | v1 lint, typecheck, build, deploy to production |
| `develop` | lint, typecheck, build, unit tests, deploy to v2-staging |
| `feature/*` | lint, typecheck, build, unit tests |
| `fix/*` | lint, typecheck, build, unit tests |
| `release/phase-N` | full test suite + economics parity checks + benchmark whitelist enforcement |

### Environments

| Environment | Source | URL (planned) |
| --- | --- | --- |
| v1 production | `main` | ficecal.com |
| v2 staging | `develop` | v2-staging.ficecal.com |
| Model Lens | `main` of `duksh/ficecal-model-lens` | modellens.ficecal.com |

### GitHub Advanced Security (enabled 2026-03-20)

- Secret scanning: enabled
- CodeQL static analysis: enabled
- Dependabot security alerts: enabled
- GitHub Dependency Graph: enabled (required for `dependency-review-action`)

### Pending manual steps

- Set branch protection rules on `main` and `develop` (require PR + CI green + 1 approval; no force push)
- Set `develop` as the default PR base branch in GitHub repo settings
- Open `release/phase-0` branch when Phase 0 parity deliverables are complete

## 5. Proposed delivery phases

## Phase 0 - Baseline freeze and parity definition

**Status: complete** — All exit criteria met. PR #119 open to merge `release/phase-0` → `main`. Tag `v2.0.0-phase-0-exit` pending on merge.

### Phase 0 — Completed items (2026-03-20)

- `develop` branch created off `main` in `duksh/FiceCal`
- CI guardrails workflow (`.github/workflows/ci-guardrails.yml`) extended to trigger on `develop`, `feature/**`, `fix/**`, `release/**`
- `duksh/models` renamed to `duksh/ficecal-model-lens` on GitHub; local remote updated
- First feature branch `feature/model-catalog-contracts` created, reviewed, and merged to `develop` as PR #118
- Delivered: `packages/schemas/model-catalog/index.ts`, `packages/integrations/models-pricing/` (adapter, transform, snapshot, tests, fixtures, contract doc)
- GitHub Advanced Security enabled: secret scanning, CodeQL, Dependabot, Dependency Graph

### Objective

Define the current live product as the v2 parity baseline before deep architectural changes.

### Deliverables

- canonical fixture payloads for current calculator states
- baseline scenario fixtures for current demos
- output snapshots for current core outputs
- chart rendering parity baselines for representative states
- UX task baselines for:
  - baseline calculation
  - demo scenario load
  - feature toggle usage
  - chart interaction
  - output interpretation panel usage
  - docs/glossary navigation
- baseline classification of current coverage against:
  - Framework 2026 strategic capabilities
  - FOCUS 1.3 data-model capabilities
- documented list of intentional v2 behavior changes vs parity-preserved behaviors

### Exit criteria

- known-good baseline is documented and reproducible
- parity acceptance rules exist for core outputs and key flows
- strategic-alignment baseline is documented so future roadmap claims can be measured honestly

## Phase 1 - Contract foundation and economics kernel

### Objective

Promote the current `core-economics` responsibility into the v2 `economics-module` with explicit contracts and deterministic guarantees.

### Scope

- introduce `economics-module` as canonical contract boundary
- keep compatibility mapping from `core-economics`
- implement input schema validation
- implement output schema validation
- add deterministic numeric handling
- add period granularity support:
  - monthly
  - quarterly
  - annual
- add currency normalization support
- define the first normalized cost-record contract that future integrations can map into
- define the first compatibility contract for business-question framing and future FinOps scopes
- define bounded precision policy
- create formula traceability registry
- implement invariant/property tests

### Recommended stack for this layer

- `decimal.js`
- `zod` and/or `ajv`
- `vitest`
- `date-fns` for period helpers where needed

### First normalized cost-record contract

This should be the first integration-facing canonical payload that non-browser sources can map into before FiceCal-specific interpretation is applied.

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `recordId` | string | yes | stable unique identifier for the normalized record |
| `sourceSystem` | string | yes | origin system such as OpenOps, Infracost, AWS CUR-derived pipeline, or manual import |
| `provider` | string | yes | provider or platform family associated with the cost |
| `providerAccountId` | string | no | billing or tenant account identifier |
| `billingPeriodStart` | string | yes | ISO datetime for billing period start |
| `billingPeriodEnd` | string | yes | ISO datetime for billing period end |
| `chargePeriodStart` | string | no | ISO datetime for usage or charge start |
| `chargePeriodEnd` | string | no | ISO datetime for usage or charge end |
| `currency` | string | yes | ISO currency code |
| `amount` | string | yes | decimal-safe monetary amount represented as string |
| `amountType` | string enum | yes | one of `actual`, `amortized`, `blended`, `list`, `allocated` |
| `serviceCategory` | string | no | normalized service family or technology category |
| `serviceName` | string | no | source service label |
| `resourceId` | string | no | resource or asset identifier when available |
| `resourceName` | string | no | display label for the billed object |
| `usageQuantity` | string | no | decimal-safe usage quantity |
| `usageUnit` | string | no | normalized usage unit |
| `commitmentType` | string | no | reserved instance, savings plan, committed use, contract, or equivalent |
| `commitmentReference` | string | no | identifier linking the record to a commitment object or contract |
| `allocationScope` | string | no | indicates whether cost is direct, shared, or redistributed |
| `allocationMethod` | string | no | explicit allocation rule such as even, weighted, proportional, manual |
| `allocationSource` | string | no | source record or rule set used for allocation |
| `consumerEntityId` | string | no | team, product, application, or cost-center consumer |
| `ownerEntityId` | string | no | owning team or platform entity |
| `providerRole` | string enum | no | one of `service-provider`, `host-provider`, `direct-provider`, `unknown` |
| `region` | string | no | region or geography label |
| `tags` | object | no | normalized low-cardinality tag map |
| `dimensions` | object | no | validated extension bucket for source-specific attributes |
| `dataCompleteness` | string enum | no | one of `complete`, `partial`, `unknown` |
| `dataRecencyTimestamp` | string | no | ISO datetime indicating freshness evaluation point |
| `ingestedAt` | string | yes | ISO datetime when FiceCal ingested the record |
| `schemaVersion` | string | yes | normalized contract version |

### Contract notes

- monetary and usage numerics should remain decimal-safe strings until parsed by canonical math utilities
- `amountType` must prevent silent mixing of actual, amortized, or allocated views
- `allocationMethod`, `allocationScope`, `dataCompleteness`, and `providerRole` are critical for future FOCUS-oriented evidence claims
- `dimensions` may extend the payload, but must not replace named canonical fields where a cross-adapter concept already exists

### Minimum validation rules

- reject records where `billingPeriodStart` is after `billingPeriodEnd`
- reject records missing `recordId`, `sourceSystem`, `provider`, `currency`, `amount`, `amountType`, `ingestedAt`, or `schemaVersion`
- reject invalid enum values for `amountType`, `providerRole`, and `dataCompleteness`
- require `allocationMethod` when `allocationScope` indicates redistributed or shared cost
- require `commitmentReference` when `commitmentType` is present and the upstream source provides one

### Companion contract: `ModelPricingReference`

This contract should represent AI model catalog and pricing reference data used for scenario building, architecture comparisons, and recommendation enrichment.

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `modelRefId` | string | yes | stable unique identifier for the model reference entry |
| `sourceCatalog` | string | yes | source catalog such as `ai/models`, Vantage-compatible snapshot, or curated internal registry |
| `sourceVersion` | string | yes | source dataset or snapshot version |
| `modelId` | string | yes | upstream model identifier |
| `modelName` | string | yes | normalized display name |
| `company` | string | no | originating model company |
| `vendorId` | string | yes | serving vendor or platform identifier |
| `vendorName` | string | yes | serving vendor display name |
| `regionCode` | string | no | vendor region code when region-specific pricing applies |
| `currency` | string | yes | ISO currency code for pricing fields |
| `inputTokenCost` | string | no | decimal-safe string cost per input token unit |
| `outputTokenCost` | string | no | decimal-safe string cost per output token unit |
| `cachedInputTokenCost` | string | no | decimal-safe string cached-input cost |
| `cachedOutputTokenCost` | string | no | decimal-safe string cached-output cost |
| `latencyMs` | number | no | representative latency measurement |
| `tokensPerSecond` | number | no | throughput estimate when available |
| `lowCapacity` | boolean | no | indicator of constrained serving availability |
| `reasoningCapable` | boolean | no | whether the model is explicitly reasoning-oriented |
| `selfHostable` | boolean | no | whether the model is self-hostable |
| `tokenizer` | string | no | tokenizer identifier |
| `tokenizerUrl` | string | no | tokenizer reference URL |
| `benchmarkScores` | object | no | curated benchmark map restricted to the approved list defined in section 4E |
| `pricingUnit` | string | yes | pricing denominator: `1K_tokens`, `1M_tokens`, or `per_image` |
| `imageOutputCost` | string | no | decimal-safe cost per generated image; required when `pricingUnit` is `per_image` |
| `pricingSourceType` | string enum | yes | one of `dynamic`, `hardcoded`, `verified`; signals reliability of the pricing data |
| `effectiveAt` | string | no | ISO datetime for price effectiveness when known |
| `ingestedAt` | string | yes | ISO datetime when FiceCal ingested the record |
| `schemaVersion` | string | yes | contract version |

### `ModelPricingReference` validation rules

- reject records missing `modelRefId`, `sourceCatalog`, `sourceVersion`, `modelId`, `modelName`, `vendorId`, `vendorName`, `currency`, `pricingUnit`, `pricingSourceType`, `ingestedAt`, or `schemaVersion`
- when `pricingUnit` is `per_image`: require `imageOutputCost`; reject `inputTokenCost`, `outputTokenCost`, `cachedInputTokenCost`, and `cachedOutputTokenCost` as inapplicable
- when `pricingUnit` is token-denominated: require at least one of `inputTokenCost`, `outputTokenCost`, `cachedInputTokenCost`, or `cachedOutputTokenCost`
- reject negative pricing, latency, or throughput values
- require `regionCode` when the source record is region-qualified
- treat benchmark values as optional reference signals, not canonical determinants of recommendation quality
- reject `benchmarkScores` keys that are not in the approved benchmark list defined in section 4E
- reject `pricingSourceType` values outside the approved enum

### Adapter architecture for `duksh/ficecal-model-lens`

The recommended architecture is a one-way normalization pipeline from external model catalog data into FiceCal contracts.

#### Proposed components

- `duksh-models-adapter`
  - reads curated upstream model catalog snapshots from `duksh/ficecal-model-lens` (`data.json`) or API responses
  - validates raw source shape
  - maps source tables into FiceCal canonical contracts
- `model-catalog-contracts`
  - owns `ModelPricingReference` and related schema validation
- `ai-token-economics`
  - consumes canonical model pricing references for unit-cost and scenario computation
- `recommendation-module`
  - consumes derived comparison outputs, not raw adapter payloads
- `architecture-tradeoffs`
  - consumes normalized vendor/model/region comparison surfaces
- `integration-module`
  - orchestrates refresh, fixture generation, caching, and failure handling

#### Recommended source mapping

- `models` -> model identity, company, reasoning flags, self-hostability, benchmark metadata
- `vendors` -> vendor identity and documentation metadata
- `models_vendors` -> vendor availability, latency, throughput, low-capacity markers
- `models_vendors_regions` -> regional token pricing reference
- `models_tokenizers` -> tokenizer metadata
- `vendor_regions` -> region descriptors and grouping metadata

#### Data flow

1. ingest `duksh/ficecal-model-lens` `data.json` snapshot or compatible snapshot data
2. validate raw source schema at adapter boundaries
3. normalize into `ModelPricingReference` records
4. snapshot normalized fixtures for deterministic testing
5. feed derived pricing views into `ai-token-economics`, `architecture-tradeoffs`, and `recommendation-module`
6. expose optional MCP capabilities only after the normalized views are stable

#### Guardrails

- never couple UI components directly to upstream `duksh/ficecal-model-lens` data structures
- never merge `ModelPricingReference` and `NormalizedCostRecord` into one ambiguous payload
- always label outputs that use model catalog prices as reference, scenario, or estimated views rather than actual billed cost unless corroborated by cost records

#### Failure posture for stale or missing model pricing

FiceCal must define explicit degradation behavior for cases where model catalog data is unavailable, incomplete, or stale. Acceptable failure posture rules:

**Missing model entry**

- if a model referenced in a scenario or calculation has no matching `ModelPricingReference` record, the affected output must surface a visible `unresolved-model-reference` warning
- the economics engine must not silently substitute zero, null, or a fallback price from a different model
- the user must be informed which model is unresolved and why the output is incomplete or suspended

**Stale pricing data**

- `ModelPricingReference` records carry `ingestedAt` and optionally `effectiveAt`
- if the age of the snapshot (relative to `ingestedAt`) exceeds a configurable staleness threshold (recommended default: 7 days), affected outputs must be labeled `stale-reference` rather than `reference`
- the UI must surface a staleness indicator at the output level, not only at the data-source level
- scenario and recommendation outputs must not suppress the staleness label even if the computed numbers are otherwise valid

**Partial catalog availability**

- if a subset of models in a multi-model comparison scenario resolves successfully but others do not, FiceCal must not silently drop the unresolved entries from the comparison
- the comparison surface must show the unresolved entries as explicitly absent with a reason, so users understand the comparison is incomplete

**Adapter ingestion failure**

- if the `duksh-models-adapter` fails to ingest or validate a new snapshot, FiceCal must fall back to the last known good versioned fixture
- the fallback state must be surfaced to the user with the fixture version and ingestion timestamp
- integration-module must log the failure reason and expose it through the release health surface

**Exit criteria addition for Phase 1**

- failure posture rules are encoded as integration tests covering: missing model, stale snapshot, partial catalog, and adapter ingestion failure cases
- no consumer module (`ai-token-economics`, `architecture-tradeoffs`, `recommendation-module`) passes a silent or zero-price result when model pricing is unresolved

### Exit criteria

- fixture parity against current live outputs passes
- invariant suite passes at 100%
- schema compatibility rules exist for dependent modules
- economics compute budgets meet contract thresholds
- economics payloads can act as a stable substrate for future scope-aware and FOCUS-aware modules

## Phase 2 - Existing module hardening in dependency order

**Status: complete ✅** — All exit criteria met. `v2.0.0-phase-2-exit` tag cut on `develop` (2026-03-21). 352 tests passing across 14 packages.

### Phase 2 — Completed deliverables (2026-03-21)

| Package | PR | Tests | Notes |
| --- | --- | --- | --- |
| `@ficecal/chart-presentation` | baseline | 20 | ChartPayload contract, builders, validators |
| `@ficecal/health-score` | #123 | 22 | Weighted signal engine, worst-severity propagation, 3 signal evaluators |
| `@ficecal/recommendation-module` | #124 | 31 | 17 declarative rules, 4 audience personas, priority sort |
| `@ficecal/ai-token-economics` | #125 | 32 | 6 pricing units incl. per_image (Gap 1 closed) |
| `@ficecal/feature-registry` | #127 | 27 | Kahn topological sort, circular-dep detection *(see Phase 3 reconciliation note)* |
| `@ficecal/mcp-tooling` | #128 | 32 | McpToolRegistry, 3 economics tools *(see Phase 3 reconciliation note)* |
| `apps/web` | #129 | — | Vite + React browser runtime, 3 modes *(see Phase 3 reconciliation note)* |
| `@ficecal/multi-tech-normalization` | #131 | 16 | 10 TechCategory variants, efficiencyIndex |
| `@ficecal/sla-slo-sli-economics` | #132 | 18 | Error budget, downtime cost, reliability ROI |
| `@ficecal/economics-module` | #133 | 23 | Umbrella registry + plugin interface — **see ADR below** |
| `@ficecal/budgeting-forecasting` | #134 | 27 | Budget variance, OLS trend, compound growth projection |
| `@ficecal/reference-evidence` | #135 | 34 | 8-entry evidence catalog, queryEvidence() |
| `@ficecal/demo-scenarios` | #136 | 26 | 6 canonical scenarios with live engine assertions |
| `@ficecal/qa-module` | #137 | 29 | 7 engine contracts, cross-module integration harness |

### ADR — Economics module umbrella (2026-03-21)

**Decision:** introduce `@ficecal/economics-module` as the single-import surface for all FiceCal v2 economics engines.

**Context:** by the end of Phase 2 the monorepo contained 4 separate economics packages (`ai-token-economics`, `sla-slo-sli-economics`, `multi-tech-normalization`, `core-economics`). Consumers faced multiple import paths. Future verticals (cloud-economics, licensing, FinOps) needed a stable extension point without breaking existing consumers.

**Resolution:**
- `EconomicsPlugin<TInput, TResult>` interface: the contract every economics engine satisfies to self-register (`domain`, `version`, `description`, `compute()`)
- `EconomicsRegistry`: domain-keyed plugin store with `register`/`unregister`, `lookup`/`require`, `compute()` dispatcher, `manifest()` introspection
- `createDefaultRegistry()`: pre-wires 5 built-in domains — `ai.token`, `reliability.error-budget`, `reliability.downtime-cost`, `reliability.roi`, `tech.normalization`
- Re-exports all sub-module public APIs as a single convenience import surface

**Extension rule:** future economics modules register a plugin implementation; no core changes required. The `domain` key namespace convention is `<vertical>.<function>` (e.g. `cloud.egress`, `licensing.saas`).

### Objective

Extract and harden the modules that already drive visible product value.

### Recommended sequence

1. `chart-presentation`
2. `health-score-module`
3. `recommendation-module`
4. `multi-tech-normalization`
5. `ai-token-economics`
6. `sla-slo-sli-economics`
7. `demo-scenarios`
8. `reference-evidence-module`
9. `budgeting-forecasting-module`
10. `qa-module` hardening around the full chain

### Rationale

- chart, health, and recommendations represent the clearest visible decision-support value
- optional economics domains should consume canonical module outputs rather than ad hoc page state
- scenario and evidence layers should rely on stable payload contracts
- this phase should begin translating current calculator behavior into clearer Framework 2026-aligned business-question surfaces without yet requiring live external billing integrations

### Exit criteria

- each module has an explicit consumer boundary
- no major domain logic remains trapped as hidden inline-only page behavior if it belongs to a module
- chart payloads are normalized and contract-tested
- health and recommendation outputs are deterministic for identical inputs
- recommendation and evidence surfaces can explain outputs in terms that are understandable to executive, operator, and architecture audiences

## Phase 3 - UI foundation implementation

**Status: complete ✅** — All deliverables merged to `develop`; `v2.0.0-phase-3-exit` tag cut 2026-03-21.

### Phase 3 — Scope reconciliation note (2026-03-21)

During the Phase 2 sprint, three packages were built that the original plan assigns to later phases:

| Package | Built as | Plan phase | Decision |
| --- | --- | --- | --- |
| `@ficecal/feature-registry` | Phase 2 sprint (PR #127) | Phase 4 (monorepo infrastructure) | **Keep as-is.** Dependency ordering demanded it exist before `mcp-tooling`; low coupling, no UI involvement. |
| `@ficecal/mcp-tooling` | Phase 2 sprint (PR #128) | Phase 5 (MCP service layer) | **Keep as-is.** Browser-side tool registry only; no Fastify/transport wiring yet. Phase 5 adds the actual service layer. |
| `apps/web` | Phase 2 sprint (PR #129) | Phase 4 (monorepo cutover + web app) | **Keep as-is.** Bootstrapped Vite + React harness; not a production app yet. Phase 4 will migrate it to the full monorepo structure. |

**Impact on Phase 3:** none. The plan's Phase 3 scope (`ui-foundation`) is unchanged — these pre-built packages do not implement or substitute any of the Phase 3 deliverables below. Phase 3 work targets `ui-foundation` exclusively.

**Impact on Phase 4:** `apps/web` starter exists; monorepo cutover in Phase 4 will expand it rather than starting from scratch.

**Impact on Phase 5:** `mcp-tooling` browser registry exists; Phase 5 adds the Fastify service layer and live MCP transport wiring around it.

### Objective

Create a true `ui-foundation` module that owns interaction architecture, responsive behavior, and preference-state UX.

### What `ui-foundation` should own

- layout system and responsive composition rules
- navigation model and wayfinding primitives
- dialog/modal/focus-management primitives
- breakpoint behavior ownership
- theme token system
- preference selectors and persistence shell:
  - currency
  - period
  - language
- keyboard interaction rules
- accessibility enforcement hooks
- UI telemetry wiring

### What `ui-foundation` should not own

- economics computations
- recommendation logic
- chart business semantics
- provider integration logic

### Recommended internal implementation order

1. navigation and focus primitives
2. responsive layout contracts
3. intent/scope shell for business-question framing
4. theme system (`light|dark|system`)
5. preference state shell (`currency|period`)
6. localization shell (`en|fr|zh`)
7. telemetry and HCI contract instrumentation

### Additional v2 requirement

`ui-foundation` should support both:

- **intent** framing (`viability|operations|architecture|executive`)
- future **scope** framing aligned with FinOps Framework 2026 business questions

### Exit criteria

- primary task flows succeed across required breakpoints
- keyboard navigation parity is validated
- critical WCAG violations are zero in core flows
- preference changes persist safely
- UI foundation becomes the owner of surface composition rules
- users can understand what analytical lens they are in and why the presented KPIs/actions are relevant to that lens

## Phase 4 - Packaging and monorepo cutover

### Objective

Move to the v2 monorepo only after meaningful shared packages exist.

### Recommendation

Do **not** perform monorepo cutover with mostly placeholders.

Cut over when at least these are real and in use:

- one live web app package
- one live service package or service scaffold with real contract traffic
- at least three shared packages with actual consumers

### Target structure

- `apps/web`
- `services/mcp`
- `packages/economics-module`
- `packages/chart-presentation`
- `packages/health-score`
- `packages/recommendation-module`
- `packages/contracts`
- `docs/`

### Exit criteria

- source-of-truth ownership is clear
- contract drift detection exists in CI
- CODEOWNERS / boundaries are enforceable
- cutover runbook has been executed cleanly

## Phase 5 - MCP service layer

### Objective

Implement the dynamic service track using the accepted ADR stack.

### Stack

- `fastify`
- `@modelcontextprotocol/sdk`
- `zod` / `ajv`

### Recommended early MCP use cases

- explain output reasoning
- generate scenario variants
- summarize recommendations for executive or operator audiences
- translate the same result set across intent/scope lenses
- export/report assembly
- support agent-assisted workflows without changing core browser runtime ownership

### Guardrail

Keep transport/service logic separate from domain module logic.

### Exit criteria

- tool schemas match module contracts
- service logic remains thin around domain packages
- MCP tools have fixture parity and validation coverage

## Phase 6 - Plugin architecture foundation

**Status: complete ✅** — All exit criteria met. `v2.0.0-phase-6-exit` tag cut on `develop` (2026-03-21). 77 tests passing.

### Phase 6 — Strategic pivot note (2026-03-21)

The original Phase 6 plan prescribed an integration module with OpenOps, Infracost, FOCUS normalization, and direct billing adapters. During Phase 6 planning a more important architectural question was resolved first: **what is the extensibility model for FiceCal as a platform?** The "WordPress of FinOps" direction was confirmed, requiring a plugin-first foundation before the integration module is built on top of it. The original integration/FOCUS scope is deferred to Phase 8, where it will be delivered as a set of plugins rather than as hardwired integration code.

### Phase 6 — Completed deliverables (2026-03-21)

| Package / deliverable | Tests | Notes |
| --- | --- | --- |
| `packages/plugin-api` | 25 | Zero-dependency `FicecalPlugin` interface, `PluginHost`, `ThemeRegistry`, `BillingRegistry`, `PluginRegistrationError` |
| Billing fixture plugins × 4 | 24 | AWS (Cost Explorer), GCP (BigQuery Billing Export), Azure (Cost Management), OpenAI (Usage Export); deterministic `ingestMode` |
| `billing.estimate.actual` MCP tool | — | Registered in transport; retrieves normalised billing data from plugin-registered adapter |
| `billing.compare.period` MCP tool | — | Period-over-period delta, trend, and per-service breakdown |
| Theme plugins × 4 | — | `lightThemeContribution`, `darkThemeContribution`, `highContrastThemeContribution`, `oceanBlueThemeContribution` in `@ficecal/ui-foundation` |
| `BUILT_IN_THEMES` array | — | Ready for `ThemeRegistry` boot registration in Phase 7 |
| Gap analysis: WordPress of FinOps | — | 8 architectural gaps identified (see section 4G) |

### Objective (original — retained for reference)

Introduce live external cost and billing context only after runtime contracts are stable.

### Deferred to Phase 8 (original Phase 6 scope)

The following items from the original Phase 6 plan are now deferred to Phase 8, where they will be delivered as plugins via `@ficecal/plugin-api`:

1. `integration-module` — FOCUS-ready normalized cost record mapping layer
2. OpenOps adapter plugin
3. Infracost OSS adapter plugin
4. contract commitment dataset support (schema + fixture)
5. split allocation and allocation-method support
6. recency/completeness metadata support
7. service-provider vs host-provider distinction

### Why deferred

- delivering plugins without a plugin system would mean hardwiring integrations — a worse architecture than waiting one phase
- the `BillingAdapterContribution` interface now exists as the correct extension point for all provider adapters
- Phase 8 integrations will self-register via `PluginHost` rather than being imported directly in `registry.ts`

### Exit criteria (met)

- plugin-api is zero-dependency and independently testable ✅
- billing fixtures proven deterministic with real provider export shapes ✅
- billing MCP tools wired via `setBillingRegistry()` — no hard provider coupling ✅
- theme contribution system established; `BUILT_IN_THEMES` ready for ThemeRegistry ✅
- 77 tests passing; `tsc --noEmit` clean ✅

## Phase 7 - Plugin ecosystem foundations

### Objective

Activate the plugin system in the running product. Wire the half-built pieces together, add the hook/filter runtime that makes plugins composable, and expose an admin surface so the plugin system is visible and usable.

### Deliverables

#### ✅ P0 — Connect ThemeRegistry → ThemeManager *(done 2026-03-21)*

`ThemeTokenSource` structural interface added to `@ficecal/ui-foundation` — bridges `ThemeManager` to `ThemeRegistry` without a hard package dependency. `ThemeManager` extended with `setCustomTheme(id)`, `clearCustomTheme()`, `getActiveThemeId()`, `listThemes()`. `useUiFoundation` creates a `PluginHost` singleton, registers all 4 built-in themes via `@ficecal/built-in-themes` plugin, passes `pluginHost.themes` as `ThemeTokenSource` to `ThemeManager`. `ThemePicker.tsx` new component shows all plugin-contributed themes with swatches, descriptions, active indicator; keyboard-accessible (Escape + outside-click). `NavBar` updated — `ThemeToggle` replaced by `ThemePicker`. 13 new ThemeManager tests; 163 total tests passing.

#### P0 — Hook/filter system (`PluginHost.addFilter` / `addAction`)

The most important extensibility primitive. Without hooks, plugins can only add; they cannot transform. WordPress's actual moat is `add_action` / `add_filter` — 11,000+ interception points.

Proposed API:
```typescript
// Filters: transform a value
pluginHost.addFilter("billing.estimate.actual.result", (result, context) => {
  return applyBudgetCap(result);
});

// Actions: side effects after an event
pluginHost.addAction("theme.applied", (themeId) => {
  telemetry.track("theme_changed", { themeId });
});
```

Implementation: `HookRegistry` class inside `packages/plugin-api`; priority-ordered listener chains; synchronous filters, async actions.

#### P1 — Workspace isolation / multi-tenancy

`McpRequestContext.workspaceId` exists but nothing scopes data to it. Phase 7 introduces `WorkspaceRegistry` — plugins, themes, billing adapters, and feature flags scoped per workspace. Required for FiceCal to operate as a hosted multi-tenant SaaS (the WordPress.com model).

#### P1 — Admin panel (`apps/web` — plugin/theme picker UI)

A settings panel in `apps/web` that surfaces:
- list of registered plugins (name, version, status)
- theme picker — shows `ThemeRegistry.list()` swatches; applies selected theme
- billing provider status — which providers have both fixture and adapter registered (via `BillingRegistry.readyProviders`)

Without this panel, the plugin system is invisible to end users. The theme picker wired to `ThemeRegistry` is the fastest proof that the plugin architecture is real.

#### P2 — Live billing toggle (Phase 7+ path for provider adapters)

Phase 6 billing plugins always return `ingestMode: "deterministic"`. Phase 7 adds the `ingestMode: "live"` path for the first provider (AWS), returning a `501 Not Implemented` response body with upgrade instructions. This stubs the surface without committing to SDK integration, which is Phase 8.

### Governance gates (original Phase 7 scope — retained)

These release quality gates remain part of Phase 7:

1. economics fixture parity
2. invariants/property tests
3. chart payload parity
4. critical task-flow smoke tests
5. critical accessibility checks
6. responsive overflow / focus / tap-target checks

And second-wave gates:
- nav success metrics
- web vitals thresholds
- theme-safety checks
- preference persistence checks
- localization parity checks
- service contract parity
- adapter fixture parity
- FOCUS-field mapping validation where adapters claim support
- framework-alignment evidence for scopes/intents/business-question surfaces

### Phase 7 — Completed deliverables (2026-03-21)

| Deliverable | Status | Notes |
| --- | --- | --- |
| ThemeRegistry → ThemeManager wiring | ✅ | `ThemeTokenSource` bridge; `setCustomTheme` / `listThemes`; 13 new tests |
| ThemePicker component | ✅ | Popover with swatches, active indicator, keyboard-accessible |
| NavBar ThemePicker integration | ✅ | Replaced ThemeToggle; plugin-aware theme selection |
| AdminPanel Sections 1–3 | ✅ | Plugins list, theme picker, billing provider status |
| Live billing 501 stub | ✅ | `ingestMode: "live"` path wired; `LIVE_BILLING_NOT_IMPLEMENTED` in transport |
| MCP transport version | ✅ | `v0.8.0`, `phase: 8` |

### Exit criteria

- `ThemeRegistry` is live and the theme picker works in `apps/web` ✅ **Done (Phase 7 P0)**
- admin panel shows plugins, themes, and billing provider status ✅ **Done (Phase 7 P1)**
- live billing toggle surface exists (501 stub until Phase 9) ✅ **Done (Phase 7 P2)**
- `HookRegistry` exists and at least one filter is in use ⬜ **Carried to Phase 9 P0**
- `WorkspaceRegistry` isolates billing data per `workspaceId` ⬜ **Carried to Phase 9 P1**
- release evidence is generated consistently ⬜
- contract drift is blocked automatically ⬜
- claims of external framework/spec alignment are supported by explicit evidence artifacts ⬜

## Phase 8 - FOCUS 1.3 conformance, integration module, and GitHub plugin registry

**Status: partially complete** — P0–P5 done (2026-03-21). Integration adapters (8B), registry repo (8C), and chargeback tool (8D) deferred to Phase 9.

### Phase 8 — Completed deliverables (2026-03-21)

| Package / deliverable | Tests | Notes |
| --- | --- | --- |
| `packages/schemas` — `NormalizedCostRecord` v2 | 77 | `SCHEMA_VERSION = "2.0.0"`; ~63/77 FOCUS columns; 7 enum types; `FOCUS_V1_3_GAP_COLUMNS`; `upgradeToV2()` migration helper |
| `packages/plugin-registry-client` | 63 | `RegistryClient`: browse/find/listTags/verifyBundle/checkReadiness; SHA-256 via Web Crypto; in-memory cache; typed error classes |
| `packages/create-ficecal-plugin` | 59 | `npx create-ficecal-plugin` CLI; 4 plugin types (billing/theme/mcp/full); pure scaffold functions |
| `billing.commitment.status` MCP tool | 33 | All 7 FOCUS CommitmentDiscount columns; AWS/GCP/Azure fixtures; utilisationRate + wastedSpend summary; toolCount → 6 |
| FinOps Framework 2026 types in `@ficecal/contracts` | — | 6 domains, 3 maturity levels, 4 assessment interfaces, `AiMlCostAssessment` |
| `AdminPanel` Section 4 — Registry Browser | — | Lazy-load; tag/search filters; plugin cards with readiness dots, tag chips, install issues |

### Objective

Deliver genuine FOCUS 1.3 alignment through `NormalizedCostRecord` v2 (FOCUS-column-mapped), real provider adapter integrations, and a GitHub-based community plugin registry. All integrations are plugins via `@ficecal/plugin-api`.

### 8A — NormalizedCostRecord v2 (FOCUS 1.3 aligned)

Replace the Phase 1 `NormalizedCostRecord` with a FOCUS 1.3-mapped schema covering all 77 Cost and Usage Dataset columns plus the 13-column Contract Commitment Dataset.

**Must implement (blocks any FOCUS alignment claim):**

| FOCUS category | Columns | Count |
| --- | --- | --- |
| Account | BillingAccountID, BillingAccountName, BillingAccountType, SubAccountID, SubAccountName, SubAccountType | 6 |
| Billing | BilledCost, BillingCurrency, ConsumedQuantity, ConsumedUnit, EffectiveCost, ListCost, ListUnitPrice, ContractedCost, ContractedUnitPrice | 9 |
| Charge | ChargeCategory, ChargeClass, ChargeDescription, ChargeFrequency | 4 |
| Charge Origination | ProviderName, **ServiceProviderName** *(1.3)*, **HostProviderName** *(1.3)*, PublisherName, InvoiceID, InvoiceIssuer | 6 |
| Service | ServiceCategory, ServiceName, ServiceSubcategory | 3 |
| Location | RegionID, RegionName, AvailabilityZone | 3 |
| Timeframe | BillingPeriodStart, BillingPeriodEnd, ChargePeriodStart, ChargePeriodEnd | 4 |
| Resource + Tags | ResourceID, ResourceName, ResourceType, Tags | 4 |
| SKU | SKUID, SKUMeter, SKUPriceID, SKUPriceDetails | 4 |
| Pricing | PricingCategory, PricingCurrency, PricingQuantity, PricingUnit, PricingCurrencyListUnitPrice, PricingCurrencyContractedUnitPrice, PricingCurrencyEffectiveCost | 7 |
| **Allocation** *(FOCUS 1.3 new)* | **AllocatedMethodDetails, AllocatedMethodID, AllocatedResourceID, AllocatedResourceName, AllocatedTags** | 5 |
| Commitment Discount | CommitmentDiscountCategory, CommitmentDiscountID, CommitmentDiscountName, CommitmentDiscountQuantity, CommitmentDiscountStatus, CommitmentDiscountType, CommitmentDiscountUnit | 7 |
| Capacity Reservation | CapacityReservationID, CapacityReservationStatus | 2 |
| **Contract Dataset** *(FOCUS 1.3 new supplemental)* | **ContractApplied, ContractCommitmentCategory, ContractCommitmentCost, ContractCommitmentDescription, ContractCommitmentID, ContractCommitmentPeriodEnd, ContractCommitmentPeriodStart, ContractCommitmentQuantity, ContractCommitmentType, ContractCommitmentUnit, ContractID, ContractPeriodEnd, ContractPeriodStart** | 13 |

**Mapping Phase 1 NormalizedCostRecord fields → FOCUS equivalents:**

| Phase 1 field | FOCUS 1.3 equivalent |
| --- | --- |
| `amountType` (actual/amortized/blended/list/allocated) | `chargeCategory` + `chargeClass` |
| `allocationScope` + `allocationMethod` + `allocationSource` | `allocatedMethodID` + `allocatedMethodDetails` |
| `providerRole` (service-provider/host-provider) | `serviceProviderName` + `hostProviderName` |
| `commitmentType` + `commitmentReference` | Contract Commitment Dataset columns |
| `dataCompleteness` + `dataRecencyTimestamp` | FOCUS 1.3 data recency/completeness metadata |

### 8B — Integration adapter plugins

All adapters self-register via `PluginHost.contributions.billingAdapters`:

| Plugin | Ingests from | Target | Mode |
| --- | --- | --- | --- |
| `@ficecal/integration-openops` | OpenOps API export | `NormalizedCostRecord` v2 | deterministic → live |
| `@ficecal/integration-infracost` | Infracost JSON output | `NormalizedCostRecord` v2 | deterministic → live |
| `@ficecal/billing-aws` v2 | AWS Cost Explorer SDK | `NormalizedCostRecord` v2 | live |
| `@ficecal/billing-gcp` v2 | GCP BigQuery Billing Export | `NormalizedCostRecord` v2 | live |
| `@ficecal/billing-azure` v2 | Azure Cost Management REST API | `NormalizedCostRecord` v2 | live |
| `@ficecal/billing-openai` v2 | OpenAI Usage API | `NormalizedCostRecord` v2 | live |

### 8C — GitHub-based community plugin registry

A GitHub-hosted plugin registry — zero infrastructure, fully auditable, community PR model. Modeled on Homebrew taps, Obsidian plugin list, and VS Code Marketplace patterns.

**Registry repo:** `duksh/ficecal-plugin-registry` (public)

```
ficecal-plugin-registry/
  plugins/
    index.json                        ← master manifest: all registered plugins
    ficecal-theme-high-contrast.json  ← per-plugin manifest
    ficecal-billing-snowflake.json
  themes/
    index.json                        ← themes-only index for theme picker
  schemas/
    ficecal-plugin.schema.json        ← ficecal-plugin.json JSON Schema v1
  CONTRIBUTING.md                     ← submission guide
  .github/workflows/
    validate-plugin.yml               ← CI validates ficecal-plugin.json on every PR
```

**`plugins/index.json` entry shape:**
```json
{
  "id": "@community/ficecal-theme-ocean-blue",
  "name": "Ocean Blue Theme",
  "version": "1.0.0",
  "author": "community-contributor",
  "contributions": ["themes"],
  "stability": "stable",
  "minFicecalVersion": "2.0.0",
  "bundleUrl": "https://cdn.jsdelivr.net/gh/contributor/ficecal-theme-ocean-blue@1.0.0/dist/plugin.js",
  "sha256": "abc123...",
  "tags": ["theme"]
}
```

**`packages/plugin-registry-client` in FiceCal monorepo:**
- Fetches `index.json` from `https://raw.githubusercontent.com/duksh/ficecal-plugin-registry/main/plugins/index.json`
- Caches manifest with configurable TTL (default: 1 hour)
- Validates `sha256` of downloaded plugin bundles before `PluginHost.register()`
- Supports offline fallback (uses last-known-good cached manifest)

**Community publish flow:**
1. Developer runs `npx create-ficecal-plugin` → generates plugin with `ficecal-plugin.json`
2. Publishes bundle to their own GitHub Releases
3. Opens PR to `ficecal-plugin-registry` adding their entry to `plugins/index.json`
4. GitHub Actions CI: validates schema, checks `minFicecalVersion`, verifies `sha256` resolves
5. Maintainer merges PR → plugin appears in FiceCal admin panel "Browse plugins" tab within 1 hour (TTL)

**Why GitHub-based:**
- zero infrastructure cost — no registry server, no database
- trust model — every plugin registration is a public PR with audit trail
- `jsdelivr.net` serves bundles from GitHub Releases at CDN scale for free
- precedent: Homebrew taps, Obsidian community plugins, Raycast extensions

### 8D — FinOps Framework 2026 capability modules (Phase 8 targets)

| Framework capability | Deliverable | Dependency |
| --- | --- | --- |
| Invoicing & Chargeback | MCP tool `billing.chargeback.allocate` + chargeback panel in `apps/web` | FOCUS Allocation columns (8A) |
| Executive Strategy Alignment *(2026 new)* | `executive-strategy-module` — multi-year investment framing, leadership KPI narrative, strategic decision signals | `executive` intent/scope surfaces from Phase 3 |
| FinOps Assessment | `finops-assessment-module` — crawl/walk/run maturity scoring against all 22 capabilities | Admin panel integration |
| Data Ingestion (live) | FOCUS-native ingestion pipeline from real provider data | 8B adapter plugins |

### Developer SDK

- `npx create-ficecal-plugin` — scaffolds plugin with `FicecalPlugin` boilerplate, `ficecal-plugin.json`, vitest harness, GitHub Actions publish + registry-PR workflow
- `ficecal-plugin-sdk` package — mock `PluginHost`, mock `BillingRegistry`, theme token validator, `FocusValidator` for `NormalizedCostRecord` v2 schema compliance

### Exit criteria

- `NormalizedCostRecord` v2 at ~82% FOCUS column coverage ✅ **Done (Phase 8 P0)** — 13 columns deferred in `FOCUS_V1_3_GAP_COLUMNS`
- Contract Commitment Dataset + MCP tool ✅ **Done (Phase 8 P3)** — `billing.commitment.status` covers all 7 CommitmentDiscount columns
- `npx create-ficecal-plugin` generates a working, registry-submittable plugin ✅ **Done (Phase 8 P2)** — 4 plugin types, 59 tests
- `plugin-registry-client` with SHA-256 bundle verification ✅ **Done (Phase 8 P1)** — 63 tests
- Allocation columns; `billing.chargeback.allocate` MCP tool functional ⬜ **Deferred to Phase 9 P4**
- At least one live billing adapter proven in staging ⬜ **Deferred to Phase 9 P3**
- `duksh/ficecal-plugin-registry` repo live with indexed plugins ⬜ **Deferred to Phase 9 P1**
- Integration adapter plugins (8B: OpenOps, Infracost, billing-aws/gcp/azure/openai v2) ⬜ **Deferred to Phase 9**

## Phase 9 - Plugin isolation, governance, and Phase 8 carryover

### Objective

Clear Phase 8 carryover items first (HookRegistry, WorkspaceRegistry, plugin registry repo, live billing, chargeback tool), then make the plugin ecosystem safe for community contributions — sandboxing, signed contracts, and production hardening.

### Phase 8 carryover (must clear before Phase 9 proper)

| Priority | Deliverable | Rationale |
| --- | --- | --- |
| **P0** | `HookRegistry` — `pluginHost.addFilter` / `addAction` in `packages/plugin-api` | ✅ **Done** — 44 vitest tests; priority-ordered filter/action chains; `billing.estimate.actual.result` production hook; `plugin.registered`, `plugin.disabled`, `plugin.enabled`, `featureflag.changed` actions; `registeredFilters` / `registeredActions` introspection |
| **P1** | `duksh/ficecal-plugin-registry` repo — create `index.json` with at least 2 entries | ✅ **Done** — repo created at `github.com/duksh/ficecal-plugin-registry`; `plugins/index.json` (version/updatedAt/plugins shape); 2 seed entries (high-contrast + ocean-blue themes); JSON Schema v7 validation; CI workflow (schema, HTTPS, sha256, unique IDs, semver); CONTRIBUTING.md + README; `DEFAULT_REGISTRY_INDEX_URL` updated in `plugin-registry-client` |
| **P2** | `WorkspaceRegistry` — scope plugins, themes, billing adapters per `workspaceId` | ✅ **Done** — 23 vitest tests; `disablePluginForWorkspace`, `enablePluginForWorkspace`, `listPluginsForWorkspace`, `listThemesForWorkspace`, `listAdaptersForWorkspace`; `workspace.plugin.disabled/enabled` hooks |
| **P3** | Live AWS billing — replace 501 stub with real Cost Explorer SDK call | ✅ **Done** — `aws-billing-plugin.ts` v2.0.0; real `GetCostAndUsageCommand`; MONTHLY/UnblendedCost/by SERVICE; `mapResultsToLineItems()` → `BillingPeriodSummary`; dynamic SDK import; 501 stub retired |
| **P4** | `billing.chargeback.allocate` MCP tool | ✅ **Done** — FOCUS 1.3 Allocation columns (AllocatedCost, AllocatedMethodID, AllocatedMethodDetails, AllocatedResourceID, AllocatedResourceName, AllocatedTags); even/proportional/tag-based methods; AWS (2 resources, 5 consumers), GCP (1 resource, 3 consumers), Azure (1 resource, 3 consumers) fixtures; toolCount → 7; transport v0.9.0 / phase 9; 32 vitest tests |

### Phase 9 proper deliverables

1. **Plugin sandboxing** — separate Web Worker or Deno worker per plugin with resource limits; billing plugins cannot cross-read workspace data ⬜ **Carried to Phase 10**
2. **Signed plugin manifests** — GPG or code-signing for plugins distributed via the marketplace; version pinning in a `ficecal-plugin-lock.json` ⬜ **Carried to Phase 10**
3. **`ficecal-plugin.json` standard** — canonical plugin manifest (id, version, `requires: ["ficecal>=2.0.0"]`, contribution declarations, signing key) ⬜ **Carried to Phase 10**
4. **Auto-update pipeline** — plugins check for new versions against the registry; opt-in auto-update with rollback; changelog surfaced in admin panel ⬜ **Carried to Phase 10**
5. **`finops-assessment-module`** — crawl/walk/run scoring engine consuming `FinOpsCapabilityDomain` boundary types from `@ficecal/contracts` ✅ **Done** — `@ficecal/finops-assessment` package; 6 domain scorers; 21 signal flags; modal maturity tie-break-to-lower; top-3 cross-domain recommendations; 58 tests; `finops.assessment.run` MCP tool; toolCount → 8; transport v0.10.0; 36 MCP integration tests

### Exit criteria

- `HookRegistry` exists and at least one filter is active ✅ **Done** — 44 tests; `billing.estimate.actual.result` production filter; plugin lifecycle actions
- `WorkspaceRegistry` isolates billing data per `workspaceId` ✅ **Done** — 23 tests; per-workspace plugin/theme/adapter visibility
- `duksh/ficecal-plugin-registry` live with at least 2 indexed plugins ✅ **Done** — repo live; 2 seed theme plugins; CI validation; `DEFAULT_REGISTRY_INDEX_URL` updated
- `billing.chargeback.allocate` functional; `shared-cost-allocation` scope can be unguarded ✅ **Done** — even/proportional/tag-based; AWS/GCP/Azure fixtures; 32 tests; toolCount=7; transport v0.9.0
- at least one live billing adapter (AWS) proven; 501 stub retired ✅ **Done** — `aws-billing-plugin.ts` v2.0.0; real Cost Explorer `GetCostAndUsageCommand`; 501 path removed
- `finops-assessment-module` delivers crawl/walk/run scoring ✅ **Done** — 6 domain scorers; 58 tests; `finops.assessment.run` MCP tool; toolCount → 8; transport v0.10.0
- billing MCP tools upgraded from `BillingPeriodSummary` to `NormalizedCostRecord` v2 ✅ **Done** — transport v0.11.0; FOCUS dead end resolved
- a community plugin installed from the marketplace cannot access data from another workspace ⬜ **Carried to Phase 10** — plugin sandboxing (Web Worker isolation) deferred; architectural effort
- plugins with invalid or missing signatures are rejected at registration ⬜ **Carried to Phase 10** — signed `ficecal-plugin.json` manifests deferred
- auto-update works for at least one community theme plugin without a full FiceCal redeployment ⬜ **Carried to Phase 10** — auto-update pipeline deferred

## Phase 10 — Intelligence layer + all-provider AI billing + Phase 9 carryover

### Objective

Build the intelligence layer that makes FiceCal actionable rather than analytical. Ship anomaly detection, assessment×billing correlation, and model routing optimization before adding more data sources. Then deliver all-provider AI billing adapters using ficecal-model-lens as the pricing oracle. Sandbox/signing/auto-update carryover from Phase 9 closes out in Phase 10B.

### Phase 10A — Intelligence layer + AI billing adapters

| Priority | Deliverable | Rationale |
| --- | --- | --- |
| **P0** | `billing.anomaly.detect` MCP tool | Highest practitioner value, lowest effort; converts FiceCal from passive dashboard to active FinOps partner; spike detection over `NormalizedCostRecord[]`; model-lens enriches alert with model name + per-token rate + projected overage ✅ **Done** — toolCount → 9; transport v0.12.0; 28 tests |
| **P1** | `packages/billing-ai-providers` — `AiProviderBillingAdapter` interface + `normalize.ts` shared mapper | Foundation for all provider adapters; token counts × `ModelPricingReference` → `NormalizedCostRecord` v2; shared by all P2 adapters ✅ **Done** — 102 tests; `lookupModelPricing()` 4-pass fuzzy; FOCUS `pricingCategory: "standard"` |
| **P2** | AI provider usage-API adapters × 6 — Anthropic, OpenAI, Gemini, Mistral, DeepSeek, Alibaba | Pricing pre-solved by model-lens; each adapter only needs provider usage API (token counts); all 6 achievable in one sprint; Alibaba CNY→USD via Phase 1 `StaticForexAdapter` ✅ **Done** — all 6 deterministic adapters; `AI_PROVIDER_ADAPTERS` registry map; `CredentialsRequiredError` |
| **P3** | `finops.assessment.correlate` MCP tool | assessment × billing × model-lens correlation; `topRecommendations` re-ranked by ROI (spend context + improvement multiplier); `totalAddressableWaste` computed; 7 correlation rules ✅ **Done** — 29 integration tests; toolCount → 10; `CorrelationBillingRegistry` wired to merged cloud+AI registry |
| **P4** | `billing.routing.optimize` MCP tool | Top-3 model substitution opportunities ranked by `estimatedMonthlySaving`; compares actual spend per model vs cheaper equivalent from model-lens ✅ **Done** — 26 integration tests; 17-entry `ROUTING_CATALOG`; 4-tier downgrade; toolCount → 11; transport v0.13.0 |
| **UI** | `IntelligencePanel` in `apps/web` — three-section UI for all Phase 10A tools | Closes practitioner gap — routing/anomaly/correlation all visible in the web app ✅ **Done** — parallel MCP `fetch()` calls; independent load/error states; NavBar link; `tsc --noEmit` clean |

### Phase 10B — Phase 9 carryover (plugin safety)

| Priority | Deliverable | Rationale |
| --- | --- | --- |
| **P5** | Plugin sandboxing — Web Worker or Deno worker per plugin with resource limits | Community plugin isolation; billing plugins cannot cross-read workspace data ⬜ |
| **P6** | Signed plugin manifests — GPG / code-signing; reject unsigned community plugins | `ficecal-plugin-lock.json` version pinning; signing key in `ficecal-plugin.json` ⬜ |
| **P7** | Auto-update pipeline — plugins check registry for new versions; opt-in auto-update with rollback | Changelog surfaced in AdminPanel; at least one community theme plugin proven ⬜ |

### New MCP tool specs

#### `billing.anomaly.detect`

```
namespace:  billing
toolId:     billing.anomaly.detect
stability:  beta

Input:
  workspaceId: string
  currentPeriodStart: string    // ISO date
  currentPeriodEnd: string
  baselinePeriodStart: string
  baselinePeriodEnd: string
  thresholdPercent?: number     // default 50 — flag anything >50% over baseline
  providers?: string[]          // optional filter: ["anthropic", "openai", ...]

Output (BillingAnomalyOutput):
  anomalies: AnomalyRecord[]   // ranked by deltaAmount DESC
  totalCurrentSpend: string    // decimal-safe
  totalBaselineSpend: string
  totalDeltaPercent: number
  overallSeverity: "none" | "warning" | "critical"
  ingestMode: "deterministic" | "live"

AnomalyRecord:
  service: string              // FOCUS ServiceName
  modelId?: string             // from model-lens if resolvable
  currentSpend: string
  baselineSpend: string
  deltaPercent: number
  deltaAmount: string
  severity: "warning" | "critical"   // warning >50%, critical >100%
  pricePerMillion?: number           // from ModelPricingReference if available
  projectedMonthlyOverage?: string   // deltaAmount annualised to calendar month
  recommendation: string
```

`appliedIds`: `["billing.anomaly.threshold.relative-delta.v1", "billing.anomaly.severity.2x-critical"]`

#### `finops.assessment.correlate`

```
namespace:  finops
toolId:     finops.assessment.correlate
stability:  beta

Input: same flat signal flags as finops.assessment.run
  + workspaceId: string
  + periodStart: string
  + periodEnd: string

Output (FinOpsAssessmentCorrelateOutput):
  // all FinOpsFrameworkAssessment fields
  correlatedRecommendations: CorrelatedRecommendation[]
  totalAddressableWaste: string     // sum of estimatedRecovery across domains
  billingPeriod: { start, end }
  billingRecordCount: number
  ingestMode: "contextual"          // never "deterministic" — depends on live billing

CorrelatedRecommendation:
  domain: string
  domainScore: number
  recommendation: string
  relevantSpend: string            // actual $ in scope for this domain
  estimatedRecovery: string        // relevantSpend × improvement_multiplier × (1 - score/100)
  roiRank: number                  // 1 = highest ROI
  evidenceText: string             // e.g. "$82K/month Bedrock with no token attribution"
```

Domain → service category mapping:
| Domain | Service categories |
| --- | --- |
| `understand` | All (visibility gap affects everything) |
| `quantify` | Compute, Storage |
| `optimize` | EC2, RDS, EKS, Lambda, Bedrock |
| `managePractice` | All |
| `sustainability` | Compute-intensive |
| `aiMl` | AI and Machine Learning, Bedrock, SageMaker, OpenAI API, Anthropic |

#### `billing.routing.optimize`

```
namespace:  billing
toolId:     billing.routing.optimize
stability:  alpha

Input:
  workspaceId: string
  periodStart: string
  periodEnd: string
  maxRecommendations?: number   // default 3

Output:
  opportunities: RoutingOpportunity[]
  totalEstimatedMonthlySaving: string
  ingestMode: "contextual"

RoutingOpportunity:
  currentModelId: string
  currentMonthlySpend: string
  currentPricePerMillion: number
  suggestedModelId: string
  suggestedPricePerMillion: number
  estimatedMonthlySaving: string
  savingPercent: number
  rationale: string            // e.g. "Haiku handles classification at 70% lower cost"
  caveat: string               // e.g. "Validate quality for your task type before switching"
```

### Exit criteria

- `billing.anomaly.detect` functional; 28 integration tests ✅ **Done (Phase 10 P0)**
- `packages/billing-ai-providers` interface established; all 6 provider adapters (Anthropic/OpenAI/Gemini/Mistral/DeepSeek/Alibaba) delivering `NormalizedCostRecord[]` with `dataCompleteness: "partial"` ✅ **Done (Phase 10 P1+P2)** — 102 tests
- `finops.assessment.correlate` functional; `totalAddressableWaste` computed from real billing records ✅ **Done (Phase 10 P3)** — 29 integration tests
- `billing.routing.optimize` returns ≥1 opportunity for fixture workspace with mixed model spend ✅ **Done (Phase 10 P4)** — 26 integration tests; toolCount → 11; transport v0.13.0
- `IntelligencePanel` in `apps/web` surfaces all three tools with independent load/error states ✅ **Done (Phase 10 UI)** — routing + anomaly + correlation sections; NavBar link added; `tsc --noEmit` clean
- §4B Framework 2026 coverage matrix updated to reflect Phase 10A deliverables ✅ **Done**
- transport version bumped to v0.14.0 (one bump per new tool group) ⬜ **At v0.13.0 — bump deferred to Phase 10B completion**
- Phase 9 carryover: plugin sandboxing ⬜, signed manifests ⬜, auto-update ⬜ **Phase 10B — in progress**
- integration adapters (OpenOps, Infracost) explicitly deferred to Phase 11 — not an exit blocker ✅ **Confirmed deferred**

---

## 6. UX/HCI strategy recommendation

The v2 UX should be framed as **intent-first, mode-aware, explainable analytical UX**.

### Recommended model

- **Intent** = why the user is here
  - viability
  - operations
  - architecture
  - executive
- **Scope** = what business or FinOps question is being answered
  - baseline unit economics
  - optimization
  - architecture/workload placement
  - executive strategy
  - future: commitment management
  - future: shared-cost allocation
- **Mode** = how much complexity they want
  - quick
  - operator
  - architect

### Why

This is stronger than using only complexity modes. It separates:

- user goal
- business question context
- information density

### UX priorities

1. make the primary path unmistakably simple
2. preserve advanced exploration for expert users
3. make output interpretation central, not secondary
4. keep chart semantics trustworthy and deterministic
5. reduce cognitive load without collapsing analytical power
6. make the active scope and intent visible so users understand why metrics and actions are shown

### Core user flows to optimize

- calculate baseline viability
- load and compare scenario states
- understand why a KPI is flagged
- see what action to take next
- switch audience framing when interpreting recommendations
- switch scope or business-question framing without losing state
- navigate docs/glossary only when needed

## 6A. First-time visitor experience audit — ficecal-model-lens (2026-03-23)

*Authored by: FinOps Product Owner / UX review. Basis: live comparison of `localhost:4321` (vantage-models Astro site) against `https://duksh.github.io` (FiceCal, richer product shell); screenshotted and analyzed 2026-03-23.*

### Audit context

The ficecal-model-lens site (AI model pricing comparison table, Astro + sql.js) is the upstream data surface for FiceCal v2's model catalog. It is publicly deployed at `duksh.github.io` and is also the entry point many FinOps practitioners first encounter. The current experience drops users directly into a raw data table — no hero, no framing, no guided first action — while the FiceCal shell at the same domain has a structured hero, feature cards, and calculator interface. The disconnect between the two creates immediate trust and comprehension failure for first-time visitors.

### Gap register (G1–G10)

#### 🔴 Critical — Bounce-causing

| Gap | Name | Observation | Impact |
|---|---|---|---|
| G1 | Zero value proposition above the fold | First visible content is a dense data table. No headline, no tagline, no "this helps you…" | Visitors have no reason to stay within 3 seconds |
| G2 | Brand confusion | Header reads "vantage.sh/models — Powered by Vantage" on what is the user's deployed domain. Visitors assume this is a Vantage product. | Brand trust = zero; ownership signal is absent |
| G3 | No orientation or guided first action | No tooltip, no "start here", no empty-state guidance on what to filter or why | New users have no path forward |

#### 🟠 High — Confusion-causing

| Gap | Name | Observation | Impact |
|---|---|---|---|
| G4 | Data without insight | Raw integers (e.g. `200000`) with no cost-per-token signal, no color-coded zone badges, no "cheap vs expensive" framing | Numbers have no FinOps meaning |
| G5 | Empty cells rendered as `-` | Dozens of cells show bare `-` with no explanation | Users cannot tell if `-` means unavailable, not applicable, free, or data gap — procurement decisions blocked |
| G6 | No FinOps job-to-be-done framing | The site does not surface the 3 primary FinOps practitioner questions: *Which model is cheapest for my use case? Which vendor? How do Anthropic vs AWS Bedrock compare for the same model?* | Visitors cannot map the data to their actual work |
| G7 | Column headers lack units and definitions | "Max Input Tokens" and "Max Output Tokens" appear with no tooltip, no cost context, no per-token price linkage | Data literacy barrier; pricing columns not visible on first load |

#### 🟡 Medium — Friction-causing

| Gap | Name | Observation | Impact |
|---|---|---|---|
| G8 | No social proof or trust signal | No data-source attribution, no last-updated timestamp, no testimonial or authority link | FinOps practitioners making budget decisions need provenance; no attribution = no credibility |
| G9 | Power features invisible | The SQL query builder (`+ Add Query`, `Run Query`) is present but completely undiscoverable for newcomers. No "try this query" suggestion or tooltip. | Power-user adoption ceiling hit immediately |
| G10 | No responsive / mobile layout | Wide data table is unreadable on mobile. FinOps practitioners share links in Slack and email. | Broken mobile experience kills viral adoption |

### Resolution priority table

| Priority | Gap | Resolution | Effort | Phase |
|---|---|---|---|---|
| P1 | G1 | Add 2-line hero above the table: bold headline + 1-sentence value prop ("Compare AI model pricing and context limits across AWS, Anthropic, DeepSeek and more — for FinOps-informed procurement.") | XS | 13 |
| P2 | G2 | Replace "Powered by Vantage" with project attribution or remove entirely; update `<title>` and `<meta name="description">` | XS | 13 |
| P3 | G6 | Add 3 use-case filter shortcut chips above the table: "Find cheapest for coding", "Compare by vendor", "Show reasoning models only" | S | 13 |
| P4 | G4 | Surface a cost-per-1M-tokens column (input + output blended) as a default visible column — derived from existing pricing data | S | 13 |
| P5 | G5 | Replace bare `-` with a title-attribute tooltip: "Data not reported by this vendor" | XS | 13 |
| P6 | G7 | Add `<abbr title="…">` or popover tooltips on column headers with plain-English definition and FinOps relevance | S | 13 |
| P7 | G3 | Add a first-visit callout banner (dismissable, localStorage-persisted): "New here? Start by selecting a use case above ↑" | XS | 13 |
| P8 | G9 | Add 2–3 "Try this query" example buttons with pre-filled SQL (e.g. cheapest input token rate, models with >100k context, Anthropic vs AWS Bedrock) | M | 13 |
| P9 | G8 | Add data-source attribution footer: source (AWS Bedrock API, Anthropic API), last-scraped date pulled from `data.json` | XS | 13 |
| P10 | G10 | Add responsive CSS: horizontal scroll on table below 768px breakpoint; hero and chips stack vertically | S | 13 |

### Phase 13 UX sprint scope

**Goal:** Transform the ficecal-model-lens from a raw data dump into a practitioner-friendly FinOps reference surface.

**Scope (all items P1–P10 above):**
- Files to touch: `src/pages/index.astro`, `src/styles/` (or inline Tailwind), `src/components/` (hero component, chip component, column header tooltip), `public/data.json` (ensure `lastUpdated` field present)
- No backend changes required
- All XS items completable in a single sitting
- S/M items completable in one sprint (3–5 days)

**Definition of done:**
- A first-time FinOps practitioner landing on the page can answer "what is this, who is it for, and what should I do first?" within 3 seconds
- The pricing / token columns have visible cost context (per-1M-token blended rate)
- Empty cells carry a machine-readable and human-readable explanation
- Column headers are self-documenting
- Data source and freshness are visible without scrolling
- At least 2 example queries are surfaced for discovery
- Site is usable on a 375px viewport

**Success metric:** Bounce rate reduction ≥ 15% (measured via plausible.io or equivalent privacy-respecting analytics if instrumented).

---

## 7. Testing strategy recommendation

### First wave

- deterministic economics fixtures
- property/invariant testing
- chart payload fixtures
- breakpoint smoke checks for core flows
- keyboard/focus validation for primary surfaces
- baseline verification of intent/scope switching state preservation

### Second wave

- HCI telemetry collection and trend analysis
- nav task success instrumentation
- web vitals thresholds
- theme management recovery tests
- localization and preference persistence tests
- framework-aligned scope/task success instrumentation

### Third wave

- MCP schema parity tests
- integration adapter fixtures
- contract compatibility matrix across modules
- FOCUS mapping fixtures for commitment, allocation, recency/completeness, and provider-role semantics

## 8. Major risks and mitigation plan

## Risk 1 - Scope explosion

### Risk

Trying to implement full UI foundation, service layer, monorepo cutover, and provider adapters at once.

### Mitigation

- enforce phased delivery
- require exit criteria before advancing
- keep service/integration work on a separate but synchronized track

## Risk 2 - Parity loss during extraction

### Risk

Architectural cleanup breaks trusted calculations or familiar flows.

### Mitigation

- baseline freeze first
- fixture parity and chart parity before refactoring ownership
- compatibility aliases until evidence is complete

## Risk 3 - Over-centralized UI shell remains the real authority

### Risk

Modules exist formally, but `index.html` still makes the true decisions.

### Mitigation

- move authority with contracts, not just files
- reduce page shell to orchestration and rendering composition only

## Risk 4 - Early provider adapter complexity consumes roadmap

### Risk

Billing adapters dominate effort before core product modularization is stable.

### Mitigation

- prioritize OpenOps and Infracost first
- gate direct billing adapters on proven data model and security readiness

## Risk 5 - Telemetry without stable flows

### Risk

Metrics become noisy or misleading if instrumentation lands before flow stability.

### Mitigation

- instrument critical stable flows first
- align event naming to one source of truth
- defer exhaustive analytics until tasks are structurally settled

## Risk 6 - Premature framework/spec claims

### Risk

The roadmap or product positioning overstates alignment with Framework 2026 or FOCUS 1.3 before the necessary scope, data, or evidence exists.

### Mitigation

- separate strategic alignment from formal support claims
- require explicit alignment evidence per capability or dataset claim
- add spec/framework support checklist to release readiness

## 9. Recommended milestone framing

## Milestone 1

`economics-module` exists as the canonical compute kernel and matches current live parity.

## Milestone 2

`chart-presentation`, `health-score-module`, and `recommendation-module` consume canonical contracts and are independently testable.

## Milestone 3

`ui-foundation` owns navigation, layout, focus, theming, preference UX shell, and intent/scope framing.

## Milestone 4

FiceCal can clearly express Framework 2026-aligned business-question surfaces without breaking current product usability.

## Milestone 5

MCP service layer adds validated assistant-driven capabilities without polluting domain boundaries.

## Milestone 6

Integration module brings external cost context safely, beginning with normalized mapping, OpenOps, and Infracost.

## Milestone 7

FiceCal supports the first meaningful FOCUS-ready integration features for commitment, allocation, and metadata semantics where adapters provide them.

## 9A. Phased implementation issues

These issues translate the plan into concrete implementation-sized work items.

### Phase 0 issue set

- define parity fixture inventory for current live calculator states
- capture current chart rendering baselines for representative scenarios
- document current Framework 2026 / FOCUS 1.3 baseline coverage claims and non-claims
- define the list of parity-protected versus intentionally changing behaviors

### Phase 1 issue set

- create `economics-module` input and output schemas
- define compatibility mapping from `core-economics` to `economics-module`
- create formula traceability registry and invariant test suite
- define normalized cost-record contract v1
- implement validation rules for amount types, allocation semantics, and freshness metadata
- ~~define `ModelPricingReference` contract and validation suite~~ ✅ Done — `packages/schemas/model-catalog/index.ts` (PR #118)
- ~~define adapter boundary schemas for `duksh/ficecal-model-lens` source ingestion~~ ✅ Done — `packages/integrations/models-pricing/src/transform.ts` (PR #118)
- decide whether image generation economics lives inside `ai-token-economics` or as a sibling `ai-image-economics` module (Gap 1) — **decision taken: `pricingUnit` dispatch inside `ai-token-economics`; implement dispatch branch (Phase 2)**
- ~~implement `pricingSourceType` validation and consumer surfacing rules (Gap 2)~~ ✅ Done — PR #118
- ~~implement `duksh-models-adapter` snapshot versioning convention using content hash + ingestion date (Gap 3)~~ ✅ Done — PR #118
- ~~publish approved benchmark list v1 as a versioned artifact in `model-catalog-contracts` (Gap 4)~~ ✅ Done — PR #118
- define forex source hierarchy, injection boundary, and staleness rules; implement ECB feed adapter with static fallback (Gap 5) — **next Phase 1 priority**

### Phase 2 issue set

- ~~extract `chart-presentation` to consume canonical economics payloads~~ ✅ Done
- ~~extract `health-score-module` with deterministic inputs and outputs~~ ✅ Done (PR #123)
- ~~extract `recommendation-module` with audience-aware explanation payloads~~ ✅ Done (PR #124)
- ~~extract `ai-token-economics` with per_image dispatch (Gap 1)~~ ✅ Done (PR #125)
- ~~extract `multi-tech-normalization` with efficiency index~~ ✅ Done (PR #131)
- ~~extract `sla-slo-sli-economics` — error budget, downtime cost, reliability ROI~~ ✅ Done (PR #132)
- ~~establish `economics-module` umbrella registry and plugin interface~~ ✅ Done (PR #133)
- ~~implement `budgeting-forecasting` — variance, OLS trend, compound growth~~ ✅ Done (PR #134)
- ~~implement `reference-evidence` — evidence catalog and query engine~~ ✅ Done (PR #135)
- ~~implement `demo-scenarios` — 6 canonical scenarios with live engine assertions~~ ✅ Done (PR #136)
- ~~harden `qa-module` around the full chain~~ ✅ Done (PR #137, 7 engine contracts, 29 integration tests)

### Phase 3 issue set

- ~~implement `ui-foundation` — navigation and focus primitives (layout system, responsive composition, breakpoint ownership, dialog/modal/focus-management)~~ ✅ Done — `BREAKPOINTS`, `getFocusableElements/getFirstFocusable/getLastFocusable`, `KeyboardShortcutRegistry` (PR #138)
- ~~implement `ui-foundation` — `intent` / `scope` / `mode` state shell; FinOps Framework 2026-aligned scope taxonomy; preference persistence and deep-link rules~~ ✅ Done — `IntentScopeState` with history stack (max 50), autoScope affinity, `toQueryString/fromQueryString`; `PreferenceStore` with `StorageAdapter` injectable (PR #138)
- ~~implement `ui-foundation` — theme system (`light|dark|system`), CSS custom properties, localStorage persistence, no-FWOT guard~~ ✅ Done — `ThemeManager` with `THEME_TOKENS` CSS custom properties, `apply()` synchronous, `MediaQuerySystemThemeAdapter` (PR #138)
- ~~implement `ui-foundation` — localization shell (`en|fr|zh` stubs, i18n infrastructure)~~ ✅ Done — `LocalizationShell` with en/fr/zh CATALOG (~35 keys each), `{{var}}` interpolation, runtime locale switching (PR #138)
- ~~implement `ui-foundation` — keyboard interaction rules and accessibility enforcement (WCAG critical violations → zero in primary analytical flows)~~ ✅ Done — `KeyboardShortcutRegistry` with `ctrl+k` descriptor normalization, `contrastRatio/sRgbToLinear/relativeLuminance`, `WCAG_CONTRAST` thresholds (PR #138)
- ~~implement `ui-foundation` — UI telemetry wiring contracts (event naming schema; instrument intent/scope switching and recommendation interpretation flows)~~ ✅ Done — 12-event `TelemetryEvent` discriminated union, `BufferedTelemetryEmitter` for test assertions, `ConsoleTelemetryEmitter` (PR #138)
- ~~update `apps/web` to consume `ui-foundation` layout, theme, and preference primitives~~ ✅ Done — `ThemeToggle`, `IntentScopeBar`, `useUiFoundation()` hook, `i18n.t()` in App.tsx (PR #139)
- validate primary task flows across required breakpoints and keyboard navigation *(deferred to Phase 5 Playwright evidence gate)*

### Phase 4 issue set

- define monorepo cutover readiness checklist
- establish package boundaries and ownership rules
- move shared contracts and modules into real consumer-backed packages
- execute cutover only after reuse thresholds are met

### Phase 5 issue set

- expose MCP tools for explanation, scenario generation, and audience reframing
- ensure MCP tool schemas mirror canonical module contracts
- add fixture-based validation for tool responses
- expose model-choice comparison and AI cost tradeoff MCP tools only after normalized model views are contract-stable

### Phase 6 issue set

- ~~deliver `packages/plugin-api` — zero-dependency `FicecalPlugin` interface, `PluginHost`, `ThemeRegistry`, `BillingRegistry`~~ ✅ Done — 25 tests
- ~~deliver billing fixture plugins × 4 (AWS/GCP/Azure/OpenAI) with deterministic `BillingAdapterContribution`~~ ✅ Done — 24 transport tests
- ~~deliver `billing.estimate.actual` and `billing.compare.period` MCP tools registered in transport~~ ✅ Done
- ~~deliver theme contribution plugins × 4 in `@ficecal/ui-foundation`~~ ✅ Done — `BUILT_IN_THEMES` ready for boot registration
- ~~gap analysis against "WordPress of FinOps" target~~ ✅ Done — 8 gaps identified and prioritized in section 4G
- build integration-module around normalized cost-record ingestion → **deferred to Phase 8 (as plugin)**
- add OpenOps mapping into normalized records → **deferred to Phase 8**
- add Infracost mapping into normalized records → **deferred to Phase 8**
- add commitment-support fields, split allocation, and provider-role semantics → **deferred to Phase 8**
- add recency/completeness evidence handling and UI degradation paths → **deferred to Phase 8**

### Phase 7 issue set

- ~~wire `ThemeRegistry` → `ThemeManager`; boot from `BUILT_IN_THEMES` at app startup~~ ✅ Done (2026-03-21) — `ThemeTokenSource` structural interface + `ThemeManager` constructor 4th param; `useUiFoundation` creates `PluginHost`, registers `@ficecal/built-in-themes` plugin, passes `pluginHost.themes`; 163 tests
- ~~implement live theme picker in `apps/web` using `ThemeRegistry.list()` with swatch previews~~ ✅ Done (2026-03-21) — `ThemePicker.tsx` + full CSS; `NavBar` updated; `@ficecal/plugin-api` added to `apps/web` runtime deps
- implement `HookRegistry` (`addFilter` / `addAction`) in `packages/plugin-api` — at least one filter in production use
- implement `WorkspaceRegistry` — scope all plugin contributions per `workspaceId` from `McpRequestContext`
- implement admin panel in `apps/web` — plugin list, theme picker panel, billing provider status (`BillingRegistry.readyProviders`)
- add live billing path stub (`ingestMode: "live"` → 501 with upgrade instructions) to at least one provider plugin
- add feature-flag guard or "coming soon" degradation state for `commitment-management` and `shared-cost-allocation` scopes (no backing content until Phase 8)
- enrich `@ficecal/reference-evidence` EVIDENCE_CATALOG with per-capability FiceCal evidence entries (cross-reference section 4B Framework/FOCUS coverage matrices)
- add economics fixture parity gate, invariants gate, chart parity gate to CI
- add task-flow smoke tests and critical accessibility checks
- block releases that make unsupported Framework 2026 / FOCUS alignment claims
- bump `services/mcp/package.json` version from `0.5.0` → `0.6.0` to match health endpoint `version: "0.6.0"` (code hygiene)

### Phase 8 issue set

- deliver `NormalizedCostRecord` v2 — FOCUS 1.3-aligned schema covering all 77 Cost and Usage Dataset columns + 13 Contract Commitment Dataset columns *(corrected from 11 — 2026-03-21)*
- map Phase 1 `NormalizedCostRecord` fields (amountType, allocationScope, providerRole, commitmentType) to FOCUS equivalents (chargeCategory, allocatedMethodID, serviceProviderName/hostProviderName, Contract Dataset)
- validate `NormalizedCostRecord` v2 against FOCUS Validator tool (focus.finops.org)
- ~~**upgrade `billing.estimate.actual` and `billing.compare.period` MCP tools to operate on `NormalizedCostRecord` v2**~~ ✅ Done (2026-03-22) — Phase 8B billing FOCUS upgrade landed. `billing.estimate.actual` now outputs `records: NormalizedCostRecord[]` (FOCUS 1.3 v2, schemaVersion 2.0.0) with a `billingPeriodSummaryToRecords()` mapper in the tool layer; `recordCount` replaces `lineItemCount`; `records[n].serviceName` (FOCUS ServiceName) replaces `lineItems[n].service`; `records[n].skuId` replaces `sku`. `billing.compare.period` upgraded: `ServiceDelta.serviceName` (FOCUS) replaces `service`; `focusSchemaVersion: "2.0.0"` in output; Phase 10 NormalizedCostRecord[] pass-through branch added to both tools. Transport bumped to v0.11.0. 161/161 tests green *(gap identified 2026-03-21, previously missing from plan)*
- deliver `@ficecal/integration-openops` adapter plugin — OpenOps export → `NormalizedCostRecord` v2
- deliver `@ficecal/integration-infracost` adapter plugin — Infracost JSON → `NormalizedCostRecord` v2
- deliver `@ficecal/billing-openai` v2 — live OpenAI Usage API path (`ingestMode: "live"`)
- deliver `@ficecal/billing-aws` v2 — live AWS Cost Explorer SDK path
- deliver `@ficecal/billing-gcp` v2 and `@ficecal/billing-azure` v2 — live provider SDK paths
- implement Contract Commitment Dataset fixture + MCP tool (`billing.commitment.query`) — 13 columns (corrected from 11)
- implement Allocation columns (5) + `billing.chargeback.allocate` MCP tool — enables `shared-cost-allocation` scope content
- activate `commitment-management` scope content — remove feature-flag guard added in Phase 7; wire to Contract Commitment Dataset + `billing.commitment.query`
- activate `shared-cost-allocation` scope content — wire to Allocation columns + `billing.chargeback.allocate`
- deliver `duksh/ficecal-plugin-registry` GitHub repo — `index.json`, `ficecal-plugin.schema.json`, CI validation workflow, CONTRIBUTING.md
- deliver `packages/plugin-registry-client` — fetches `index.json` from GitHub raw, validates sha256, caches with TTL
- deliver `npx create-ficecal-plugin` scaffold — boilerplate, `ficecal-plugin.json`, vitest harness, GitHub Actions publish + registry-PR workflow
- deliver `ficecal-plugin-sdk` — mock PluginHost, mock BillingRegistry, theme token validator, FocusValidator
- deliver `executive-strategy-module` — multi-year investment framing, leadership KPI narrative (Framework 2026 — Executive Strategy Alignment capability)
- deliver `finops-assessment-module` — crawl/walk/run maturity scoring against all 22 Framework 2026 capabilities
- enrich `@ficecal/reference-evidence` EVIDENCE_CATALOG with per-capability FiceCal evidence entries cross-referencing section 4B matrices — makes `queryEvidence()` return genuinely useful per-claim traceability rather than citing the spec document *(gap identified 2026-03-21 — may be pulled into Phase 7 if capacity permits)*
- update section 4B Framework 2026 matrix status for `commitment-management` and `shared-cost-allocation` scope content after Phase 8 delivery

### Phase 9 issue set

- implement plugin sandbox — Web Worker or Deno worker per plugin with resource limits → **Carried to Phase 10 P5**
- implement signed `ficecal-plugin.json` manifests — GPG or code-signing; reject unsigned community plugins → **Carried to Phase 10 P6**
- implement `ficecal-plugin-lock.json` — version pinning for installed plugins → **Carried to Phase 10 P6**
- implement auto-update with changelog surfaced in admin panel → **Carried to Phase 10 P7**

### Phase 10 issue set

- deliver `billing.anomaly.detect` MCP tool — threshold-based spike detection; model-lens enrichment; `AnomalyRecord[]` with severity + projected overage
- deliver `packages/billing-ai-providers` — `AiProviderBillingAdapter` interface + `normalize.ts` (tokens × `ModelPricingReference` → `NormalizedCostRecord` v2)
- deliver Anthropic usage-API adapter (direct API, not Bedrock)
- deliver OpenAI usage-API adapter (`/v1/usage` by model)
- deliver Gemini usage-API adapter (AI Studio + Vertex AI)
- deliver Mistral usage-API adapter
- deliver DeepSeek usage-API adapter
- deliver Alibaba (Qwen) usage-API adapter (CNY→USD via `StaticForexAdapter`)
- deliver `finops.assessment.correlate` MCP tool — `ingestMode: "contextual"`; domain → service category mapping; `totalAddressableWaste`; ROI-ranked `correlatedRecommendations`
- deliver `billing.routing.optimize` MCP tool — top-3 model substitution opportunities; `estimatedMonthlySaving`; sourced from `ModelPricingReference` vs actual spend
- implement plugin sandbox — Web Worker per plugin (Phase 9 P5 carryover)
- implement signed `ficecal-plugin.json` manifests (Phase 9 P6 carryover)
- implement auto-update pipeline (Phase 9 P7 carryover)
- bump transport to v0.14.0 on Phase 10A completion
- defer `@ficecal/integration-openops` and `@ficecal/integration-infracost` to Phase 11

> *Note: the following governance gate issues were previously listed as a duplicate "Phase 7 issue set" block. Merged here (2026-03-21); the duplicate heading has been removed. These items are now consolidated in the Phase 7 issue set above.*
>
> - add release gates for framework-alignment evidence *(now in Phase 7 issue set above)*
> - add release gates for FOCUS field mapping validation *(now in Phase 7 issue set above)*
> - publish a spec/framework support checklist for every claimed alignment area *(now in Phase 7 issue set above)*
> - block releases that make unsupported standards claims *(now in Phase 7 issue set above)*

## 10. Immediate next actions I would recommend

### Completed (as of 2026-03-21 — end of Phase 6)

- ~~establish GitOps branch structure (`develop`, `feature/*`, CI guardrails)~~ ✅ Done
- ~~rename `duksh/models` to `duksh/ficecal-model-lens`~~ ✅ Done
- ~~implement `ModelPricingReference` contract, `duksh-models-adapter`, snapshot versioning, benchmark gate (Gaps 2–4)~~ ✅ Done — PR #118
- ~~Phase 0 baseline artifacts (Framework 2026 / FOCUS 1.3 assessment, parity declaration, feature-catalog update)~~ ✅ Done — PR #119
- ~~`release/phase-0` branch opened~~ ✅ Done
- ~~Phase 1: `economics-module` compute kernel~~ ✅ Done — `decimal.js` wrapper, `FormulaRegistry`, `StaticForexAdapter`, period normalization; Gap 5 closed
- ~~Phase 2: all 11 modules~~ ✅ Done — PRs #123–137; 352 tests; `v2.0.0-phase-2-exit` tagged
- ~~Gap 1 (image pricing unit) closed~~ ✅ Done — PR #125 `computeImageCost`
- ~~Gap 5 (forex source) closed~~ ✅ Done — `ForexRateProvider` + `StaticForexAdapter` in `core-economics`
- ~~Economics module umbrella ADR resolved~~ ✅ Done — `@ficecal/economics-module` with `EconomicsPlugin` extension interface (PR #133)

### Phase 3 deliverables (complete ✅)

| Deliverable | PR | Tests | Notes |
|---|---|---|---|
| `@ficecal/ui-foundation` — types, preferences, theme, intent-scope, i18n, keyboard, telemetry | #138 | 75 | Zero DOM deps; all browser APIs injectable |
| `apps/web` — ThemeToggle, IntentScopeBar, `useUiFoundation()` hook | #139 | — | TypeScript strict, zero errors |
| `feature-catalog.json` v1.5.0 | #139 | — | `ui-foundation` entry active; `web.dependsOn` updated |
| `v2.0.0-phase-3-exit` tag | — | — | Cut on `develop` 2026-03-21 |

### Immediate next priorities (Phase 4)

1. **Monorepo cutover** — migrate to full pnpm workspaces layout; absorb `ficecal-model-lens` into `apps/model-lens/`
2. **`apps/web` production hardening** — wire economics computations to IntentScopeState; Playwright evidence suite
3. **`chart-presentation` render integration** — wire D3 chart builders to health-score and economics-module outputs

### Phase 6 deliverables (complete ✅)

| Deliverable | Tests | Notes |
|---|---|---|
| `packages/plugin-api` — `FicecalPlugin`, `PluginHost`, `ThemeRegistry`, `BillingRegistry` | 25 | Zero-dependency; feature-flag guard; contribution routing |
| Billing fixture plugins × 4 (AWS / GCP / Azure / OpenAI) | 24 | Deterministic `ingestMode`; real Cost Explorer / GCP / Azure CM / OpenAI export shapes |
| `billing.estimate.actual` + `billing.compare.period` MCP tools | — | Registered in transport; wired via `setBillingRegistry()` |
| Theme plugins × 4 in `@ficecal/ui-foundation` | — | `lightThemeContribution`, `darkThemeContribution`, `highContrastThemeContribution`, `oceanBlueThemeContribution` |
| `v2.0.0-phase-6-exit` tag | — | Cut on `develop` 2026-03-21; 77 tests green |

### Immediate next priorities (Phase 7)

1. **Wire `ThemeRegistry` → `ThemeManager`** — boot `ThemeRegistry` from `BUILT_IN_THEMES` at app startup; route `ThemeManager.apply()` through registry; live theme picker in `apps/web`
2. **Hook/filter system (`HookRegistry`)** — `addFilter` / `addAction` API in `packages/plugin-api`; at least one filter in production use (billing result post-processing or theme-change action)
3. **Admin panel in `apps/web`** — plugin list, theme picker with swatches, billing provider status from `BillingRegistry.readyProviders`
4. **Workspace isolation (`WorkspaceRegistry`)** — scope plugins, themes, billing adapters per `workspaceId`; required for hosted multi-tenant model
5. **Governance release gates** — economics fixture parity, invariant tests, chart parity, task-flow smoke tests, accessibility checks

### Deferred to later phases

- ECB live forex feed adapter (Phase 8 — integration module plugin)
- OpenOps / Infracost adapters and FOCUS-ready normalized cost records (Phase 8 — as plugins)
- `NormalizedCostRecord` v1 full contract — commitment, allocation, recency/completeness semantics (Phase 8)
- Live billing SDK integration (AWS Cost Explorer live mode — Phase 8)
- Plugin marketplace / registry client at `plugins.ficecal.com` (Phase 8)
- Developer SDK + `npx create-ficecal-plugin` scaffolding (Phase 8)
- Plugin sandbox (Web Worker isolation per plugin) (Phase 9)
- Signed plugin manifests + `ficecal-plugin.json` standard (Phase 9)
- Auto-update pipeline for community plugins (Phase 9)
- framework-alignment evidence gates and FOCUS field mapping validation (Phase 7)

### Immediate next priorities (Phase 10)

1. **`billing.anomaly.detect`** — P0; self-contained; highest practitioner value; does not depend on P1 adapters; ships first
2. **`packages/billing-ai-providers` + `normalize.ts`** — foundation that all 6 provider adapters share; build interface before adapters
3. **All 6 provider usage-API adapters** — Anthropic, OpenAI, Gemini, Mistral, DeepSeek, Alibaba; each thin (usage API only); pricing from `ModelPricingReference`
4. **`finops.assessment.correlate`** — requires billing records from P2 adapters to be meaningful; build after at least 2 adapters are live
5. **`billing.routing.optimize`** — requires both correlation tool and multi-provider spend data; Phase 10A final deliverable
6. **Phase 9 carryover (sandboxing/signing/auto-update)** — Phase 10B; does not block Phase 10A intelligence layer

### Phase 11 deferred items

- `@ficecal/integration-openops` — OpenOps export → `NormalizedCostRecord` v2
- `@ficecal/integration-infracost` — Infracost JSON → `NormalizedCostRecord` v2
- Live GCP billing adapter (native Cloud Billing export, not usage API)
- Live Azure billing adapter (native Cost Management export)
- `billing.attribution.pr` — engineer-facing PR cost delta (shift-left FinOps)
- `executive-strategy-module` — multi-year investment framing, leadership KPI narrative

## 11. Final recommendation

FiceCal v2 should be implemented as a **parity-preserving, contract-first modular evolution** of the current live product, with the **economics kernel, charting, health/recommendation logic, UI foundation, and scope-aware analytical framing** stabilized before serious expansion into MCP services, monorepo-wide cutover, and direct billing adapters. Framework 2026 alignment should be pursued first through business-question and decision-support improvements, while FOCUS 1.3 alignment should be pursued later through explicit normalized data contracts, integration adapters, and evidence-backed support claims.

---

## 12. Execution Log — Phase 11 Gap Closure (2026-03-22)

### Session: Full Gap Register Addressed

**Scope:** Close all 53 gaps identified in the post-Phase-10 gap register across 7 categories
(F: FinOps Framework, S: FOCUS schema, A: AI technology, P: Plugin ecosystem, D: Data/oracle, U: UX, I: Integration).

---

### Batch 1 — FOCUS Schema Extensions (S1–S7)

- **NormalizedCostRecord** bumped to `v2.1.0` (~93% FOCUS 1.3 coverage)
  - Added: `CapacityReservationId`, `CapacityReservationStatus`, `SkuMeter`, `SkuPriceDetails`,
    `PricingCurrencyContractedUnitPrice`, `PricingCurrencyEffectiveCost`, `PricingBlockSize`,
    `ServicePeriodStart`, `ServicePeriodEnd`, `BillingCurrency`, `EffectiveExchangeRate`
  - `normalizeRecord()` updated to set new fields; 99 schema tests green
- **ContractCommitmentRecord** (FOCUS 1.3 Contract Commitment Dataset) — new type, 13 columns
  - `CONTRACT_COMMITMENT_SCHEMA_VERSION = "1.0.0"` exported
- **Model catalog schema** extended:
  - `ImageModelPricingReference`, `GpuModelPricingReference` types added
  - `ModelPricingReference` gains: `reasoningTier?`, `maxInputTokens?`, `maxOutputTokens?`, `trainingCutoff?`

---

### Batch 2 — Catalog Refresh + GPU Economics (D1/D2, A1)

- **`initializeCatalog()`** — async function in `services/mcp/src/transport/registry.ts`
  - Calls `loadModelPricingCatalog()` (HTTP oracle with 8s timeout → bundled fixture fallback)
  - Wires catalog into `setAiProviderPricingCatalog()` and `setRoutingCatalog(buildRoutingCatalogFromPricing())`
  - Called in `buildApp()` before `registerMcpRoutes()` — catalog ready before first request
- **Catalog refresh worker** — `setInterval` (default 6h) with `.unref()` in `server.ts`
  - Configurable via `MCP_CATALOG_REFRESH_INTERVAL_MS` env var
- **`per_gpu_hour`** added to `@ficecal/ai-token-economics`:
  - New `GpuCostInput` interface (gpuHours, gpuCount, pricePerGpuHour, workloadType, gpuType)
  - `computeGpuCost()` function + dispatcher wiring
  - 15 GPU cost tests → 47 total ai-token-economics tests passing

---

### Batch 3 — Carbon Economics Package (F7)

- **`@ficecal/carbon-economics`** — new package (Phase 11)
  - `types.ts`: `RegionCarbonIntensity`, `WorkloadPowerProfile`, `CarbonEstimateInput/Output`
  - `catalog.ts`: 19 regional intensity entries (AWS×8, GCP×6, Azure×5); 6 workload power profiles
  - `engine.ts`: `estimateCarbon()` — formula-based engine, PUE-aware, world-average fallback
  - 18 tests green on first run; package added to pnpm workspace

---

### Batch 4 — 4 New MCP Tools (F5, F6, F7, A3)

All 4 tools registered in `services/mcp/src/transport/registry.ts`. Tool count: 11 → 15.

| Tool ID | Capability | Phase | Tests |
|---|---|---|---|
| `sustainability.carbon.estimate` | FinOps 2026 Sustainability | 11 | ✓ |
| `billing.rate.optimize` | Rate Optimization (RI/SP/CUD) | 11 | ✓ |
| `billing.usage.optimize` | Usage Optimization (rightsizing) | 11 | ✓ |
| `billing.ai.quota` | AI Spend Quota Management | 11 | ✓ |

- `McpToolInputSchema` extended to support array/object property schemas
- `McpJsonSchemaProperty` interface added (recursive)
- 31 new Phase 11 tool tests → 63 total mcp-tooling tests passing
- `billing-compare-period.ts` updated to use `NORMALIZED_COST_RECORD_SCHEMA_VERSION` constant

---

### Batch 5 — Plugin Ecosystem Wiring (P2, P3)

- **`PluginHost` constructor** accepts optional `PluginSandbox` parameter (3rd arg, default null)
- **`register()` method** now:
  1. Calls `validatePluginManifest(plugin.manifest)` when manifest is present → `MANIFEST_INVALID` error on failure
  2. Fires `plugin.unverified` hook for community plugins without manifest (backward-compatible)
  3. Sandbox-wraps all `adapter.load()` calls when `PluginSandbox` is active
- **`FicecalPlugin`** type gains optional `manifest?: FicecalPluginManifest`
- **`PluginErrorCode`** union gains `"MANIFEST_INVALID"`
- **Health endpoint** updated: phase 10→11, version 0.13.0→0.14.0
  - Adds `pluginCount`, `plugins[]` (id, version, enabled, verified), `sandbox` status
- **`getPluginHost()`, `getWorkspaceRegistry()`** imported in routes.ts

---

### Test Results (2026-03-22)

| Package | Tests | Status |
|---|---|---|
| @ficecal/schemas | 99 | ✓ |
| @ficecal/plugin-api | 165 | ✓ |
| @ficecal/mcp-tooling | 63 | ✓ |
| @ficecal/service-mcp | 244 | ✓ |
| @ficecal/carbon-economics | 18 | ✓ |
| @ficecal/ai-token-economics | 47 | ✓ |
| @ficecal/billing-ai-providers | 102 | ✓ |
| All other packages | 515 | ✓ |
| **TOTAL** | **1,253** | **ALL GREEN** |

---

### Remaining Deferred Items (not addressed in this session)

- **UX** (U1–U6): ArchitectPanel ↔ billing.routing.optimize, IntelligencePanel auto-trigger,
  IntentScopeBar scope degradation guards, AdminPanel Security tab — frontend work, no test coverage gate
- **I1–I5**: OpenOps/Infracost integration adapters, live GCP/Azure adapters, PR cost attribution
- **A5**: Live AI billing (Anthropic/OpenAI usage API SDK calls)
- **F8**: `billing.attribution.pr` (engineer shift-left FinOps)

### Phase 13 UX sprint — ficecal-model-lens first-visit experience (added 2026-03-23)

10 first-time visitor experience gaps (G1–G10) identified via live UX audit comparing `localhost:4321` against `duksh.github.io`. Full gap register, resolution priority table, and sprint definition of done in **§6A**. This is a pure frontend sprint (Astro + Tailwind, no MCP/backend changes). Estimated effort: XS–M items, completable in 3–5 days.

- **G1 (P1)**: Hero / value proposition above the table
- **G2 (P2)**: Brand attribution correction
- **G3 (P7)**: First-visit orientation callout
- **G4 (P4)**: Cost-per-1M-tokens derived column
- **G5 (P5)**: Empty cell tooltip
- **G6 (P3)**: Use-case filter shortcut chips
- **G7 (P6)**: Column header definitions / tooltips
- **G8 (P9)**: Data-source attribution footer
- **G9 (P8)**: Example query buttons
- **G10 (P10)**: Responsive layout for mobile

