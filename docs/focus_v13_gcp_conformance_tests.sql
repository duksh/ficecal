-- =============================================================================
-- FOCUS v1.3 Conformance Tests for GCP BigQuery FOCUS View
-- Author: Duksh Koonjoobeeharry | ficecal.com
--
-- PURPOSE:
--   Verify how GCP's FOCUS v1.0 GA BigQuery view holds up against the
--   FOCUS 1.3 specification (ratified December 2025).
--   Each test maps to a documented finding. Run them independently.
--
-- SETUP — update these two placeholders before running any query:
--
--   YOUR_BQ_PROJECT   → your GCP project ID
--                        e.g. my-company-billing
--
--   YOUR_FOCUS_VIEW   → your FOCUS BigQuery view name
--                        e.g. gcp_billing.focus_v1_view
--
--   Replace both placeholders in every query below, OR do a global
--   find-and-replace in your editor before running.
--
-- REFERENCE:
--   GCP FOCUS guide:   https://services.google.com/fh/files/misc/focus_guide_v1.pdf
--   FOCUS 1.3 spec:    https://focus.finops.org/focus-specification/
--   What's new in 1.3: https://www.finops.org/insights/introducing-focus-1-3/
-- =============================================================================


-- =============================================================================
-- TEST 1 — Column Deprecation Check
--
-- FOCUS 1.3 deprecates ProviderName and PublisherName, replacing them with
-- ServiceProviderName (who sells the service) and HostProviderName (where
-- it runs). GCP's view still uses the old columns. Any tooling built on the
-- deprecated columns will break when GCP updates to v1.4.
-- =============================================================================

SELECT
  column_name,
  data_type,
  CASE
    WHEN column_name IN ('ProviderName', 'PublisherName')
      THEN 'DEPRECATED in FOCUS 1.3 — will be removed in v1.4'
    WHEN column_name IN ('ServiceProviderName', 'HostProviderName')
      THEN 'NEW — FOCUS 1.3 compliant replacement'
    ELSE 'Other'
  END AS focus_13_status
FROM
  `YOUR_BQ_PROJECT`.INFORMATION_SCHEMA.COLUMNS
WHERE
  table_name   = 'YOUR_FOCUS_VIEW'
  AND column_name IN (
    'ProviderName',
    'PublisherName',
    'ServiceProviderName',
    'HostProviderName'
  )
ORDER BY column_name;

-- EXPECTED RESULT ON GCP TODAY:
--   ProviderName  → present, flagged DEPRECATED
--   PublisherName → present, flagged DEPRECATED
--   ServiceProviderName → absent (GCP has not added this yet)
--   HostProviderName    → absent (GCP has not added this yet)
--
-- WHY IT MATTERS:
--   Reseller and multi-cloud billing relationships cannot be correctly
--   modelled using the deprecated columns. Dashboards built on them
--   will silently break when GCP ships the v1.4 update.


-- =============================================================================
-- TEST 2 — ChargeCategory: GCP emits 3 of 5 FOCUS values
--
-- FOCUS 1.3 defines five valid ChargeCategory values:
--   usage | purchase | tax | credit | adjustment
--
-- GCP's guide explicitly states it only uses: usage, tax, adjustment.
-- Purchases and credits are embedded inside usage rows — not separated.
-- This breaks cross-cloud charge-type filtering.
-- =============================================================================

SELECT
  ChargeCategory,
  COUNT(*)                      AS row_count,
  ROUND(SUM(BilledCost), 2)    AS total_billed_cost,
  CASE
    WHEN ChargeCategory = 'usage'
      THEN 'WARNING — GCP bundles purchases and credits into this category'
    WHEN ChargeCategory IN ('tax', 'adjustment')
      THEN 'OK — standard FOCUS value'
    WHEN ChargeCategory IN ('purchase', 'credit')
      THEN 'OK — FOCUS-compliant (unexpected on GCP — verify)'
    ELSE 'UNKNOWN — check against FOCUS spec'
  END AS focus_13_status
FROM
  `YOUR_BQ_PROJECT.YOUR_FOCUS_VIEW`
WHERE
  DATE(ChargePeriodStart) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY ChargeCategory
ORDER BY row_count DESC;

-- EXPECTED RESULT ON GCP TODAY:
--   Only 'usage', 'tax', 'adjustment' will appear.
--   'purchase' and 'credit' will be absent.
--
-- WHY IT MATTERS:
--   A multi-cloud FOCUS dashboard grouping by ChargeCategory will show
--   misleading totals for GCP compared to AWS or Azure, where purchase
--   and credit rows are separated per spec.


-- =============================================================================
-- TEST 3 — EffectiveCost: GCP deviates from FOCUS cost-movement semantics
--
-- FOCUS spec requires EffectiveCost to MOVE the commitment fee FROM the
-- commitment SKU row TO the corresponding usage SKU rows.
-- GCP calculates EffectiveCost as: cost + credit per line item (no movement).
-- Commitment SKU rows will show non-zero EffectiveCost — incorrect per spec.
-- =============================================================================

-- 3a. Find commitment-related rows and inspect EffectiveCost
SELECT
  SkuId,
  SkuDescription,
  CommitmentDiscountId,
  ROUND(SUM(BilledCost), 4)       AS total_billed_cost,
  ROUND(SUM(ContractedCost), 4)   AS total_contracted_cost,
  ROUND(SUM(EffectiveCost), 4)    AS total_effective_cost,
  CASE
    WHEN SUM(EffectiveCost) != 0 AND CommitmentDiscountId IS NOT NULL
      THEN 'NON-ZERO EffectiveCost on commitment SKU — GCP deviation from FOCUS spec'
    WHEN SUM(EffectiveCost) = 0
      THEN 'OK — zero EffectiveCost on commitment row (FOCUS-compliant)'
    ELSE 'No commitment discount — standard usage row'
  END AS focus_13_status
FROM
  `YOUR_BQ_PROJECT.YOUR_FOCUS_VIEW`
WHERE
  DATE(ChargePeriodStart) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  AND (
    CommitmentDiscountId IS NOT NULL
    OR LOWER(SkuDescription) LIKE '%commitment%'
    OR LOWER(SkuDescription) LIKE '%committed use%'
  )
GROUP BY 1, 2, 3
ORDER BY total_effective_cost DESC;

-- EXPECTED RESULT ON GCP TODAY:
--   Commitment SKU rows will show non-zero EffectiveCost.
--   In a fully FOCUS-compliant implementation those rows should be 0
--   (cost moved to usage SKU rows).
--
-- NOTE: The aggregate EffectiveCost total across ALL rows is still correct.
--       The deviation is in how cost is attributed at SKU level.


-- 3b. Confirm GCP's actual EffectiveCost formula (cost + credit per row)
SELECT
  SkuDescription,
  ROUND(BilledCost, 4)                    AS billed_cost,
  ROUND(ContractedCost, 4)               AS contracted_cost,
  ROUND(EffectiveCost, 4)                AS effective_cost,
  ROUND(BilledCost - EffectiveCost, 4)   AS implied_credit_applied
FROM
  `YOUR_BQ_PROJECT.YOUR_FOCUS_VIEW`
WHERE
  DATE(ChargePeriodStart) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND CommitmentDiscountId IS NOT NULL
LIMIT 20;


-- =============================================================================
-- TEST 4 — ServiceCategory: GCP taxonomy vs FOCUS normative values
--
-- GCP's FOCUS guide acknowledges that ServiceCategory "doesn't precisely
-- match the FOCUS set of possible values." FOCUS 1.3 defines a normative
-- list. Non-compliant values break cross-cloud category grouping.
-- =============================================================================

-- 4a. List all distinct ServiceCategory values in your view
SELECT
  ServiceCategory,
  COUNT(*)                      AS row_count,
  ROUND(SUM(BilledCost), 2)    AS total_billed_cost
FROM
  `YOUR_BQ_PROJECT.YOUR_FOCUS_VIEW`
WHERE
  DATE(ChargePeriodStart) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY ServiceCategory
ORDER BY total_billed_cost DESC;


-- 4b. Flag values that deviate from the FOCUS 1.3 normative list
SELECT
  ServiceCategory,
  ROUND(SUM(BilledCost), 2) AS total_billed_cost,
  CASE
    WHEN ServiceCategory IN (
      'Compute', 'Storage', 'Database', 'Networking',
      'AI and Machine Learning', 'Analytics', 'Security',
      'Identity', 'Developer Tools', 'Management',
      'Integration', 'IoT', 'Mixed', 'Other'
    ) THEN 'OK — FOCUS 1.3 normative value'
    ELSE 'NON-STANDARD — breaks cross-cloud category grouping'
  END AS focus_13_status
FROM
  `YOUR_BQ_PROJECT.YOUR_FOCUS_VIEW`
WHERE
  DATE(ChargePeriodStart) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY ServiceCategory
ORDER BY total_billed_cost DESC;

-- EXPECTED RESULT ON GCP TODAY:
--   Several GCP-specific category values will appear that are not in the
--   FOCUS normative list (e.g. 'Other Google Services', 'Support').
--
-- NOTE: ListUnitPrice and ServiceCategory reflect the price as of the
--       manually chosen SQL date in the GCP view, NOT the date of usage.
--       This can cause mismatches in historical analysis.


-- =============================================================================
-- TEST 5 — Recency Metadata: No data freshness signal from GCP
--
-- FOCUS 1.3 requires providers to surface:
--   DatasetLastUpdatedAt    → when the dataset was last written
--   DatasetCompletionStatus → whether data is final or still being revised
--
-- GCP provides x_ExportTime as a non-standard extension field.
-- This is NOT equivalent to FOCUS 1.3 recency metadata.
-- Automated pipelines cannot reliably detect incomplete exports.
-- =============================================================================

-- 5a. Check which freshness columns exist
SELECT
  column_name,
  data_type,
  CASE
    WHEN column_name = 'x_ExportTime'
      THEN 'GCP non-standard field — not FOCUS 1.3 recency metadata'
    WHEN column_name IN ('DatasetLastUpdatedAt', 'DatasetCompletionStatus')
      THEN 'FOCUS 1.3 recency metadata — compliant'
    ELSE 'Other'
  END AS focus_13_status
FROM
  `YOUR_BQ_PROJECT`.INFORMATION_SCHEMA.COLUMNS
WHERE
  table_name   = 'YOUR_FOCUS_VIEW'
  AND column_name IN (
    'x_ExportTime',
    'DatasetLastUpdatedAt',
    'DatasetCompletionStatus'
  );

-- EXPECTED RESULT ON GCP TODAY:
--   x_ExportTime present, flagged as non-standard.
--   DatasetLastUpdatedAt and DatasetCompletionStatus absent.


-- 5b. Use x_ExportTime as a proxy to understand export lag (workaround only)
SELECT
  DATE(ChargePeriodStart)                        AS charge_date,
  MIN(x_ExportTime)                              AS earliest_export,
  MAX(x_ExportTime)                              AS latest_export,
  TIMESTAMP_DIFF(
    MAX(x_ExportTime), MIN(x_ExportTime), HOUR)  AS export_window_hours,
  COUNT(*)                                       AS row_count
FROM
  `YOUR_BQ_PROJECT.YOUR_FOCUS_VIEW`
WHERE
  DATE(ChargePeriodStart) >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
GROUP BY 1
ORDER BY 1 DESC;

-- NOTE: x_ExportTime is NOT a completeness guarantee. The same charge_date
--       can appear across multiple export windows. FOCUS 1.3 recency metadata
--       would make pipeline orchestration deterministic — GCP does not
--       provide this yet.


-- =============================================================================
-- TEST 6 — Commitment Coverage (proxy for missing Contract Commitment dataset)
--
-- FOCUS 1.3 introduces a dedicated Contract Commitment dataset where a single
-- query returns all active commitments with start/end dates, remaining units,
-- and descriptions. GCP has no equivalent. This query is the closest
-- approximation using the existing FOCUS view — it is a workaround.
-- =============================================================================

SELECT
  CommitmentDiscountId,
  CommitmentDiscountName,
  CommitmentDiscountCategory,
  CommitmentDiscountType,
  CommitmentDiscountStatus,
  DATE(MIN(ChargePeriodStart))            AS earliest_seen,
  DATE(MAX(ChargePeriodStart))            AS latest_seen,
  COUNT(DISTINCT DATE(ChargePeriodStart)) AS days_active,
  ROUND(SUM(BilledCost), 2)              AS total_billed,
  ROUND(SUM(EffectiveCost), 2)           AS total_effective,
  ROUND(SUM(ListCost), 2)               AS total_list,
  ROUND(
    (SUM(ListCost) - SUM(EffectiveCost))
    / NULLIF(SUM(ListCost), 0) * 100, 2
  )                                      AS effective_discount_pct
FROM
  `YOUR_BQ_PROJECT.YOUR_FOCUS_VIEW`
WHERE
  CommitmentDiscountId IS NOT NULL
GROUP BY 1, 2, 3, 4, 5
ORDER BY total_billed DESC;

-- WHAT IS MISSING vs FOCUS 1.3 Contract Commitment dataset:
--   - Contract start date (not available in FOCUS view)
--   - Contract end date (not available in FOCUS view)
--   - Remaining committed units (not available)
--   - Contract description / terms (not available)
--
-- A FOCUS 1.3 compliant provider would surface all of the above in a
-- dedicated, queryable dataset. GCP does not provide this yet.


-- =============================================================================
-- TEST 7 — Full Column Inventory with FOCUS 1.3 Status Labels
--
-- Produces a complete picture of your FOCUS view's conformance status.
-- Useful as a screenshot for documentation or presentations.
-- =============================================================================

SELECT
  column_name,
  data_type,
  CASE
    -- Core v1.0 GA columns confirmed in GCP (June 2024)
    WHEN column_name IN (
      'BilledCost', 'ContractedCost', 'ContractedUnitPrice',
      'EffectiveCost', 'ListCost', 'ListUnitPrice',
      'BillingAccountId', 'SubAccountId',
      'ChargePeriodStart', 'ChargePeriodEnd',
      'ChargeCategory', 'ChargeClass', 'ChargeDescription',
      'CommitmentDiscountCategory', 'CommitmentDiscountId',
      'CommitmentDiscountName', 'CommitmentDiscountStatus',
      'CommitmentDiscountType',
      'ConsumedQuantity', 'ConsumedUnit',
      'InvoiceIssuerName', 'PricingCategory',
      'PricingQuantity', 'PricingUnit',
      'RegionId', 'RegionName',
      'ResourceId', 'ResourceName', 'ResourceType',
      'ServiceCategory', 'ServiceName',
      'SkuId', 'SkuPriceId', 'SkuDescription',
      'Tags'
    ) THEN 'FOCUS v1.0 GA — supported by GCP'

    -- Deprecated in FOCUS 1.3, still present in GCP v1.0
    WHEN column_name IN ('ProviderName', 'PublisherName')
      THEN 'DEPRECATED in FOCUS 1.3 — removal planned for v1.4'

    -- New in FOCUS 1.3 — not yet in GCP
    WHEN column_name IN (
      'ServiceProviderName',
      'HostProviderName',
      'DatasetLastUpdatedAt',
      'DatasetCompletionStatus',
      'SplitCostAllocationHandling'
    ) THEN 'NEW in FOCUS 1.3 — not yet supported by GCP'

    -- GCP non-standard extension fields
    WHEN column_name LIKE 'x_%'
      THEN 'GCP extension field (non-FOCUS) — avoid in multi-cloud queries'

    ELSE 'Other'
  END AS focus_13_status
FROM
  `YOUR_BQ_PROJECT`.INFORMATION_SCHEMA.COLUMNS
WHERE
  table_name = 'YOUR_FOCUS_VIEW'
ORDER BY
  CASE
    WHEN column_name LIKE 'x_%' THEN 2
    ELSE 1
  END,
  column_name;


-- =============================================================================
-- END OF FOCUS v1.3 CONFORMANCE TESTS
--
-- Suggested commit path (GitLab / GitHub):
--   sql/focus_conformance/focus_v13_conformance_tests.sql
--
-- References:
--   GCP FOCUS v1.0 GA blog:  https://cloud.google.com/blog/topics/cost-management/cloud-costs-come-into-view-with-focus-v1-0-ga
--   GCP FOCUS PDF guide:     https://services.google.com/fh/files/misc/focus_guide_v1.pdf
--   FOCUS 1.3 spec:          https://focus.finops.org/focus-specification/
--   FOCUS 1.3 release notes: https://www.finops.org/insights/introducing-focus-1-3/
-- =============================================================================
