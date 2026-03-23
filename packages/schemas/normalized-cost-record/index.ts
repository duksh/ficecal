/**
 * NormalizedCostRecord — FiceCal v2 Phase 8 canonical billing record
 *
 * A FOCUS 1.3-aligned billing record type that provides a vendor-neutral
 * representation of cloud/AI cost line items for FinOps analysis and
 * economics computation.
 *
 * Schema version: 2.2.0
 *
 * FOCUS 1.3 coverage: ~72/77 columns (~93%)
 * Uncovered columns are noted with @focus-gap and are deferred to Phase 9+.
 *
 * Non-breaking additions in v2.2.0:
 *   - dataRefreshedAt: ISO 8601 refresh timestamp from the source adapter
 *   - dataAgeSeconds: age of record in seconds at query time
 *   - dataFreshnessStatus: fresh | stale | very-stale | unknown
 *   - dataSource: live | deterministic | cached | fixture
 *   - NORMALIZED_COST_RECORD_SCHEMA_VERSION bumped to "2.2.0".
 *
 * Non-breaking additions in v2.1.0:
 *   - CapacityReservationId / CapacityReservationStatus (new enum)
 *   - skuMeter, skuPriceDetails, pricingBlockSize
 *   - pricingCurrencyContractedUnitPrice, pricingCurrencyEffectiveCost
 *   - servicePeriodStart, servicePeriodEnd
 *   - billingCurrency, effectiveExchangeRate
 *   - contractApplied
 *   - allocatedResourceId, allocatedResourceName, allocatedTags
 *   - ContractCommitmentRecord type + CONTRACT_COMMITMENT_SCHEMA_VERSION
 *   - All changes are additive; no removals or renames.
 *   - NORMALIZED_COST_RECORD_SCHEMA_VERSION bumped to "2.1.0".
 *
 * Non-breaking additions in v2.0.0:
 *   - Added ~35 new optional fields across billing context, sub-account,
 *     resource, pricing, commitment discount dataset (7 FOCUS cols), and tags.
 *   - All v1 fields remain; no removals or renames — fully additive.
 *   - NORMALIZED_COST_RECORD_SCHEMA_VERSION bumped to "2.0.0".
 *
 * @see https://focus.finops.org/ — FinOps Open Cost and Usage Specification
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const NORMALIZED_COST_RECORD_SCHEMA_VERSION = "2.2.0";

// ---------------------------------------------------------------------------
// Enums (string union types) — v1 retained, v2 additions below
// ---------------------------------------------------------------------------

/**
 * The nature of the cost amount.
 * - "actual"    : On-demand / pay-as-you-go charges as billed
 * - "amortized" : Upfront commitment cost spread over the commitment term
 * - "blended"   : Weighted average of on-demand and committed pricing
 * - "list"      : Public list price before any discounts
 * - "allocated" : Cost that has been re-allocated from a parent entity
 */
export type AmountType = "actual" | "amortized" | "blended" | "list" | "allocated";

/**
 * The role of the provider in the billing relationship.
 * - "service-provider" : Provides the service being consumed (e.g. OpenAI)
 * - "host-provider"    : Hosts/resells the service (e.g. Azure hosting OpenAI models)
 * - "direct-provider"  : Both hosts and provides the service natively
 * - "unknown"          : Provider role cannot be determined
 */
export type ProviderRole = "service-provider" | "host-provider" | "direct-provider" | "unknown";

/**
 * Confidence level in the completeness of the record's data.
 * - "complete" : All mandatory fields are present and validated
 * - "partial"  : Some optional or expected fields are missing
 * - "unknown"  : Cannot determine completeness (e.g. raw ingest not validated)
 */
export type DataCompleteness = "complete" | "partial" | "unknown";

/**
 * Type of pricing commitment associated with this charge.
 * - "on-demand"       : No commitment; pay per use
 * - "reserved"        : Reserved capacity commitment (1yr, 3yr, etc.)
 * - "savings-plan"    : Flexible commitment (AWS Savings Plans style)
 * - "committed-use"   : GCP committed use discounts
 * - "spot"            : Spot / preemptible / interruptible instance pricing
 * - "none"            : No commitment type applicable (e.g. data transfer)
 */
export type CommitmentType =
  | "on-demand"
  | "reserved"
  | "savings-plan"
  | "committed-use"
  | "spot"
  | "none";

/**
 * Method used to allocate costs to a consumer entity.
 * - "direct"        : Cost is directly attributed (no allocation needed)
 * - "proportional"  : Allocated proportionally to usage or spend share
 * - "equal-split"   : Divided equally among consumers
 * - "rule-based"    : Custom allocation rule applied
 * - "none"          : No allocation performed
 */
export type AllocationMethod =
  | "direct"
  | "proportional"
  | "equal-split"
  | "rule-based"
  | "none";

// ── v2: FOCUS 1.3 enum additions ────────────────────────────────────────────

/**
 * FOCUS 1.3: ChargeCategory — the classification of a charge.
 * - "usage"      : Charges for actual resource consumption
 * - "purchase"   : One-time or recurring purchase (e.g. RI, support plan)
 * - "credit"     : Credits applied to reduce total spend
 * - "adjustment" : Corrections or refunds to previously billed amounts
 * - "tax"        : Tax charges associated with other line items
 *
 * @focus FOCUS 1.3 / ChargeCategory
 */
export type ChargeCategory = "usage" | "purchase" | "credit" | "adjustment" | "tax";

/**
 * FOCUS 1.3: ChargeClass — whether this row corrects a previously published charge.
 * - "correction" : This row corrects an earlier row in the same or prior billing period
 *
 * Absence of this field (undefined) means the charge is original / non-corrective.
 *
 * @focus FOCUS 1.3 / ChargeClass
 */
export type ChargeClass = "correction";

/**
 * FOCUS 1.3: ChargeFrequency — how often a charge recurs.
 * - "one-time"    : Charged once (upfront purchases, refunds)
 * - "recurring"   : Charged on a regular schedule regardless of usage
 * - "usage-based" : Charged based on measured consumption
 *
 * @focus FOCUS 1.3 / ChargeFrequency
 */
export type ChargeFrequency = "one-time" | "recurring" | "usage-based";

/**
 * FOCUS 1.3: PricingCategory — how the price was determined.
 * - "standard"  : Published list rate; no negotiated discount applied
 * - "dynamic"   : Price varies based on market conditions (e.g. spot)
 * - "committed" : Rate associated with a commitment discount (RI, SP, CUD)
 * - "other"     : Pricing method outside the above categories
 *
 * @focus FOCUS 1.3 / PricingCategory
 */
export type PricingCategory = "standard" | "dynamic" | "committed" | "other";

/**
 * FOCUS 1.3: CommitmentDiscountCategory — the unit basis of the commitment.
 * - "spend" : Commitment is expressed as a monetary spend target (e.g. AWS Savings Plans)
 * - "usage" : Commitment is expressed as a usage quantity (e.g. Reserved Instances, GCP CUDs)
 *
 * @focus FOCUS 1.3 / CommitmentDiscountCategory
 */
export type CommitmentDiscountCategory = "spend" | "usage";

/**
 * FOCUS 1.3: CommitmentDiscountStatus — whether the commitment was consumed.
 * - "used"   : The commitment was applied to a resource charge in this period
 * - "unused" : The commitment went unconsumed and generated an unused-commitment charge
 *
 * @focus FOCUS 1.3 / CommitmentDiscountStatus
 */
export type CommitmentDiscountStatus = "used" | "unused";

/**
 * v2: PublisherCategory — the business role of the entity publishing the service.
 * - "cloud-provider" : Hyperscaler publishing its own native services
 * - "isv"            : Independent software vendor distributing through a marketplace
 * - "marketplace"    : Generic marketplace-sourced offer (publisher unknown)
 * - "unknown"        : Publisher category cannot be determined
 */
export type PublisherCategory = "cloud-provider" | "isv" | "marketplace" | "unknown";

/**
 * FOCUS 1.3: CapacityReservationStatus — state of a capacity reservation.
 * - "allocated" : Capacity is reserved and currently in use by a resource
 * - "unused"    : Capacity is reserved but not consumed in this charge period
 * - "expired"   : Reservation term has ended
 *
 * @focus FOCUS 1.3 / CapacityReservationStatus
 */
export type CapacityReservationStatus = "allocated" | "unused" | "expired";

// ---------------------------------------------------------------------------
// Core record type — v2.0.0
// ---------------------------------------------------------------------------

/**
 * NormalizedCostRecord — canonical billing line item.
 *
 * All monetary amounts are decimal-safe strings to prevent floating-point loss.
 * All date/time fields use ISO 8601 format.
 *
 * @see NORMALIZED_COST_RECORD_SCHEMA_VERSION
 */
export type NormalizedCostRecord = {
  // ── Identity ──────────────────────────────────────────────────────────────

  /**
   * Globally unique record identifier (UUID v4 recommended).
   * @required
   */
  recordId: string;

  /**
   * Identifier of the upstream system that produced this record.
   * E.g. "aws-cur", "azure-cost-management", "openai-usage-api".
   * @required
   */
  sourceSystem: string;

  // ── Provider ──────────────────────────────────────────────────────────────

  /**
   * Canonical name of the cloud/AI provider.
   * E.g. "aws", "azure", "gcp", "openai", "anthropic".
   * @required
   */
  provider: string;

  /**
   * Provider-side account or subscription identifier.
   * E.g. AWS account ID, Azure subscription ID.
   * @optional
   */
  providerAccountId?: string;

  /**
   * The role this provider plays in the billing relationship.
   * @required
   */
  providerRole: ProviderRole;

  // ── Billing account (v2 — FOCUS 1.3) ──────────────────────────────────────

  /**
   * FOCUS 1.3: BillingAccountId — the top-level account used for invoicing.
   * E.g. AWS management account ID, Azure billing account ID.
   * Corresponds to the entity that receives the invoice.
   *
   * @optional
   * @focus FOCUS 1.3 / BillingAccountId
   */
  billingAccountId?: string;

  /**
   * FOCUS 1.3: BillingAccountName — human-readable name of the billing account.
   *
   * @optional
   * @focus FOCUS 1.3 / BillingAccountName
   */
  billingAccountName?: string;

  /**
   * FOCUS 1.3: InvoiceId — provider-issued invoice or statement identifier.
   * Links this record to the corresponding invoice document.
   *
   * @optional
   * @focus FOCUS 1.3 / InvoiceId
   */
  invoiceId?: string;

  /**
   * FOCUS 1.3: InvoiceIssuerName — name of the entity issuing the invoice.
   * May differ from provider when resellers or distributors are involved.
   *
   * @optional
   * @focus FOCUS 1.3 / InvoiceIssuerName
   */
  invoiceIssuerName?: string;

  /**
   * FOCUS 1.3: PublisherName — name of the entity that publishes the service.
   * E.g. "Amazon Web Services", "Microsoft", "OpenAI", "Anthropic".
   *
   * @optional
   * @focus FOCUS 1.3 / PublisherName
   */
  publisherName?: string;

  /**
   * v2: PublisherCategory — the business role of the publisher.
   *
   * @optional
   */
  publisherCategory?: PublisherCategory;

  // ── Sub-account (v2 — FOCUS 1.3) ──────────────────────────────────────────

  /**
   * FOCUS 1.3: SubAccountId — child account below the billing account.
   * E.g. AWS linked account ID, Azure subscription ID, GCP project ID.
   *
   * @optional
   * @focus FOCUS 1.3 / SubAccountId
   */
  subAccountId?: string;

  /**
   * FOCUS 1.3: SubAccountName — human-readable name of the sub-account.
   *
   * @optional
   * @focus FOCUS 1.3 / SubAccountName
   */
  subAccountName?: string;

  // ── Billing period ────────────────────────────────────────────────────────

  /**
   * Start of the billing period (inclusive), ISO 8601.
   * This is the period covered by the invoice or statement.
   * @required
   */
  billingPeriodStart: string;

  /**
   * End of the billing period (exclusive), ISO 8601.
   * @required
   */
  billingPeriodEnd: string;

  /**
   * Start of the actual charge period (inclusive), ISO 8601.
   * May differ from billingPeriodStart for amortized charges.
   * @required
   */
  chargePeriodStart: string;

  /**
   * End of the actual charge period (exclusive), ISO 8601.
   * @required
   */
  chargePeriodEnd: string;

  /**
   * FOCUS 1.3: ServicePeriodStart — start of the contracted service period
   * (inclusive), ISO 8601. Distinct from chargePeriodStart; represents the
   * period for which the service is contractually available, not when charged.
   * E.g. for an annual subscription billed monthly, the service period spans
   * the full year while the charge period is one month.
   *
   * @optional
   * @focus FOCUS 1.3 / ServicePeriodStart
   */
  servicePeriodStart?: string;

  /**
   * FOCUS 1.3: ServicePeriodEnd — end of the contracted service period
   * (exclusive), ISO 8601.
   *
   * @optional
   * @focus FOCUS 1.3 / ServicePeriodEnd
   */
  servicePeriodEnd?: string;

  // ── Charge detail (v2 — FOCUS 1.3) ────────────────────────────────────────

  /**
   * FOCUS 1.3: ChargeCategory — classification of the charge.
   *
   * @optional — defaults to "usage" if omitted
   * @focus FOCUS 1.3 / ChargeCategory
   */
  chargeCategory?: ChargeCategory;

  /**
   * FOCUS 1.3: ChargeClass — indicates if this row corrects a prior charge.
   * Undefined means the charge is original (non-corrective).
   *
   * @optional
   * @focus FOCUS 1.3 / ChargeClass
   */
  chargeClass?: ChargeClass;

  /**
   * FOCUS 1.3: ChargeDescription — human-readable description of the charge.
   * Provider-supplied line item description.
   *
   * @optional
   * @focus FOCUS 1.3 / ChargeDescription
   */
  chargeDescription?: string;

  /**
   * FOCUS 1.3: ChargeFrequency — recurrence cadence of this charge.
   *
   * @optional
   * @focus FOCUS 1.3 / ChargeFrequency
   */
  chargeFrequency?: ChargeFrequency;

  // ── Monetary ──────────────────────────────────────────────────────────────

  /**
   * ISO 4217 currency code of the amount field.
   * @required
   */
  currency: string;

  /**
   * Monetary charge amount as a decimal-safe string.
   * Positive = charge; negative = credit.
   * Maps to FOCUS BilledCost for actual charges.
   * @required
   */
  amount: string;

  /**
   * The nature of the amount (actual, amortized, blended, list, allocated).
   * @required
   */
  amountType: AmountType;

  /**
   * FOCUS 1.3: BillingCurrency — the currency in which the provider invoices
   * the customer. May differ from `currency` (the charge/display currency) when
   * the provider applies FX conversion between the service price currency and
   * the invoice currency (e.g. EUR invoice for a USD-priced service).
   * ISO 4217 currency code.
   *
   * @optional
   * @focus FOCUS 1.3 / BillingCurrency
   */
  billingCurrency?: string;

  /**
   * FOCUS 1.3: EffectiveExchangeRate — the FX exchange rate applied to convert
   * the effective cost from the pricing currency to the billing currency.
   * Stored as a decimal-safe string with 10 decimal places.
   * E.g. "1.0849200000" = 1 USD → 1.08492 EUR.
   *
   * @optional
   * @focus FOCUS 1.3 / EffectiveExchangeRate
   */
  effectiveExchangeRate?: string;

  // ── FOCUS cost columns (v2 — FOCUS 1.3) ───────────────────────────────────

  /**
   * FOCUS 1.3: BilledCost — the amount charged by the provider on the invoice.
   * Decimal-safe string. Equivalent to `amount` for actual charges; provided
   * separately to allow storing multiple cost types on the same record.
   *
   * @optional
   * @focus FOCUS 1.3 / BilledCost
   */
  billedCost?: string;

  /**
   * FOCUS 1.3: ListCost — cost calculated at the provider's published list price.
   * Decimal-safe string. Excludes negotiated discounts, credits, or commitments.
   *
   * @optional
   * @focus FOCUS 1.3 / ListCost
   */
  listCost?: string;

  /**
   * FOCUS 1.3: ListUnitPrice — provider's published unit price before discounts.
   * Decimal-safe string.
   *
   * @optional
   * @focus FOCUS 1.3 / ListUnitPrice
   */
  listUnitPrice?: string;

  /**
   * FOCUS 1.3: ContractedCost — cost after negotiated rate discounts.
   * Between listCost (highest) and effectiveCost (lowest for committed resources).
   * Decimal-safe string.
   *
   * @optional
   * @focus FOCUS 1.3 / ContractedCost
   */
  contractedCost?: string;

  /**
   * FOCUS 1.3: ContractedUnitPrice — per-unit price after negotiated discounts.
   * Decimal-safe string.
   *
   * @optional
   * @focus FOCUS 1.3 / ContractedUnitPrice
   */
  contractedUnitPrice?: string;

  /**
   * FOCUS 1.3: EffectiveCost — final cost after all discounts, including
   * amortized upfront commitment fees. This is the cost most useful for
   * FinOps unit economics and showback.
   * Decimal-safe string.
   *
   * @optional
   * @focus FOCUS 1.3 / EffectiveCost
   */
  effectiveCost?: string;

  /**
   * FOCUS 1.3: BilledUnitPrice — per-unit price as it appears on the invoice.
   * Decimal-safe string.
   *
   * @optional
   * @focus FOCUS 1.3 / BilledUnitPrice
   */
  billedUnitPrice?: string;

  // ── Pricing (v2 — FOCUS 1.3) ──────────────────────────────────────────────

  /**
   * FOCUS 1.3: PricingCategory — how the unit price was determined.
   *
   * @optional
   * @focus FOCUS 1.3 / PricingCategory
   */
  pricingCategory?: PricingCategory;

  /**
   * FOCUS 1.3: PricingQuantity — amount of the product metered at the pricing rate.
   * May differ from usageQuantity when pricing tiers apply.
   * Decimal-safe string.
   *
   * @optional
   * @focus FOCUS 1.3 / PricingQuantity
   */
  pricingQuantity?: string;

  /**
   * FOCUS 1.3: PricingUnit — unit of measure for pricingQuantity.
   * E.g. "1M tokens", "GB-month", "vCPU-hour".
   *
   * @optional
   * @focus FOCUS 1.3 / PricingUnit
   */
  pricingUnit?: string;

  /**
   * FOCUS 1.3: SkuId — provider's product/service SKU identifier.
   * E.g. AWS usage type code, Azure meter ID.
   *
   * @optional
   * @focus FOCUS 1.3 / SkuId
   */
  skuId?: string;

  /**
   * FOCUS 1.3: SkuPriceId — provider's unique identifier for the specific rate applied.
   * More granular than skuId — identifies the exact pricing version.
   *
   * @optional
   * @focus FOCUS 1.3 / SkuPriceId
   */
  skuPriceId?: string;

  /**
   * FOCUS 1.3: SkuMeter — provider's label for the specific usage meter driving
   * this charge. E.g. "BoxUsage:t3.medium", "AmazonBedrock-InputTokens:claude".
   *
   * @optional
   * @focus FOCUS 1.3 / SkuMeter
   */
  skuMeter?: string;

  /**
   * FOCUS 1.3: SkuPriceDetails — additional human-readable detail about the
   * pricing rate, such as "6-month Reserved, Partial Upfront, Linux".
   *
   * @optional
   * @focus FOCUS 1.3 / SkuPriceDetails
   */
  skuPriceDetails?: string;

  /**
   * FOCUS 1.3: PricingBlockSize — the minimum billable increment for this charge.
   * E.g. 60 for a 1-minute minimum billing block (in seconds).
   * Applies when usage is rounded up to the nearest block.
   *
   * @optional
   * @focus FOCUS 1.3 / PricingBlockSize
   */
  pricingBlockSize?: number;

  /**
   * FOCUS 1.3: PricingCurrencyContractedUnitPrice — the contracted unit price
   * expressed in the pricing currency (which may differ from the billing currency).
   * Decimal-safe string.
   *
   * @optional
   * @focus FOCUS 1.3 / PricingCurrencyContractedUnitPrice
   */
  pricingCurrencyContractedUnitPrice?: string;

  /**
   * FOCUS 1.3: PricingCurrencyEffectiveCost — the effective cost expressed in
   * the pricing currency before FX conversion to billing currency.
   * Decimal-safe string.
   *
   * @optional
   * @focus FOCUS 1.3 / PricingCurrencyEffectiveCost
   */
  pricingCurrencyEffectiveCost?: string;

  // ── Service classification ────────────────────────────────────────────────

  /**
   * High-level service category.
   * E.g. "AI / Machine Learning", "Compute", "Storage", "Networking".
   * @optional
   */
  serviceCategory?: string;

  /**
   * Specific service name as reported by the provider.
   * E.g. "Amazon Bedrock", "Azure OpenAI Service", "Claude API".
   * @optional
   */
  serviceName?: string;

  /**
   * Provider-assigned resource identifier (ARN, resource ID, etc.).
   * @optional
   */
  resourceId?: string;

  /**
   * Human-readable name of the resource, if available.
   * @optional
   */
  resourceName?: string;

  // ── Resource context (v2 — FOCUS 1.3) ─────────────────────────────────────

  /**
   * FOCUS 1.3: ResourceType — the kind of resource the charge is associated with.
   * E.g. "Virtual Machine", "Object Storage", "LLM Inference Endpoint".
   *
   * @optional
   * @focus FOCUS 1.3 / ResourceType
   */
  resourceType?: string;

  // ── Capacity reservation (FOCUS 1.3) ─────────────────────────────────────

  /**
   * FOCUS 1.3: CapacityReservationId — provider-issued unique identifier for
   * a dedicated capacity reservation pool associated with this charge.
   * E.g. AWS On-Demand Capacity Reservation ID, Azure Capacity Reservation Group.
   *
   * @optional
   * @focus FOCUS 1.3 / CapacityReservationId
   */
  capacityReservationId?: string;

  /**
   * FOCUS 1.3: CapacityReservationStatus — state of the capacity reservation
   * during this charge period.
   *
   * @optional
   * @focus FOCUS 1.3 / CapacityReservationStatus
   */
  capacityReservationStatus?: CapacityReservationStatus;

  // ── Geography (expanded in v2) ────────────────────────────────────────────

  /**
   * Cloud region where the resource was consumed.
   * E.g. "us-east-1", "eastus", "europe-west1".
   * @optional
   */
  region?: string;

  /**
   * FOCUS 1.3: RegionId — provider's machine-readable region identifier.
   * E.g. "us-east-1" (AWS), "eastus" (Azure), "us-central1" (GCP).
   *
   * @optional
   * @focus FOCUS 1.3 / RegionId
   */
  regionId?: string;

  /**
   * FOCUS 1.3: RegionName — provider's human-readable region display name.
   * E.g. "US East (N. Virginia)", "East US", "Iowa".
   *
   * @optional
   * @focus FOCUS 1.3 / RegionName
   */
  regionName?: string;

  /**
   * FOCUS 1.3: AvailabilityZone — the zone within the region.
   * E.g. "us-east-1a", "eastus-1".
   *
   * @optional
   * @focus FOCUS 1.3 / AvailabilityZone
   */
  availabilityZone?: string;

  // ── Usage ─────────────────────────────────────────────────────────────────

  /**
   * Quantity of the resource consumed during the charge period.
   * Stored as a decimal-safe string.
   * @optional
   */
  usageQuantity?: string;

  /**
   * Unit of measurement for usageQuantity.
   * E.g. "tokens", "GB", "hours", "API calls", "requests".
   * @optional
   */
  usageUnit?: string;

  // ── Commitment / pricing — v1 fields (retained) ───────────────────────────

  /**
   * The type of pricing commitment associated with this charge.
   * @optional — defaults to "on-demand" if omitted
   */
  commitmentType?: CommitmentType;

  /**
   * Reference ID of the commitment (e.g. reservation ID, savings plan ARN).
   * @optional
   */
  commitmentReference?: string;

  // ── Commitment discount dataset (v2 — FOCUS 1.3, 7 columns) ──────────────
  //
  // The FOCUS CommitmentDiscount dataset covers unconsumed commitments and
  // the mapping of usage to specific commitment instruments. These 7 columns
  // fully cover the FOCUS 1.3 CommitmentDiscount dimension.

  /**
   * FOCUS 1.3: CommitmentDiscountCategory — whether the commitment is
   * spend-based (Savings Plans) or usage-based (Reserved Instances, CUDs).
   *
   * @optional
   * @focus FOCUS 1.3 / CommitmentDiscountCategory
   */
  commitmentDiscountCategory?: CommitmentDiscountCategory;

  /**
   * FOCUS 1.3: CommitmentDiscountId — provider-issued unique identifier
   * for the commitment instrument (RI ID, SP ARN, CUD contract ID).
   *
   * @optional
   * @focus FOCUS 1.3 / CommitmentDiscountId
   */
  commitmentDiscountId?: string;

  /**
   * FOCUS 1.3: CommitmentDiscountName — human-readable name of the
   * commitment instrument, if provided by the provider.
   *
   * @optional
   * @focus FOCUS 1.3 / CommitmentDiscountName
   */
  commitmentDiscountName?: string;

  /**
   * FOCUS 1.3: CommitmentDiscountStatus — whether this record represents
   * a used or unused portion of the commitment for the charge period.
   *
   * @optional
   * @focus FOCUS 1.3 / CommitmentDiscountStatus
   */
  commitmentDiscountStatus?: CommitmentDiscountStatus;

  /**
   * FOCUS 1.3: CommitmentDiscountType — provider-specific label for the
   * commitment instrument type.
   * E.g. "Savings Plans", "Reserved Instance", "Committed Use Discount".
   *
   * @optional
   * @focus FOCUS 1.3 / CommitmentDiscountType
   */
  commitmentDiscountType?: string;

  /**
   * FOCUS 1.3: CommitmentDiscountQuantity — amount of the commitment
   * consumed (used) or wasted (unused) during the charge period.
   * Decimal-safe string. The unit is given by commitmentDiscountUnit.
   *
   * @optional
   * @focus FOCUS 1.3 / CommitmentDiscountQuantity
   */
  commitmentDiscountQuantity?: string;

  /**
   * FOCUS 1.3: CommitmentDiscountUnit — unit of measure for
   * commitmentDiscountQuantity.
   * E.g. "USD/hr", "vCPU-hr", "Normalized units".
   *
   * @optional
   * @focus FOCUS 1.3 / CommitmentDiscountUnit
   */
  commitmentDiscountUnit?: string;

  // ── Allocation ────────────────────────────────────────────────────────────

  /**
   * Scope to which costs are allocated (e.g. team name, project, cost center).
   * @optional
   */
  allocationScope?: string;

  /**
   * Method used to allocate this cost.
   * @optional
   */
  allocationMethod?: AllocationMethod;

  /**
   * Source of the allocation rule or policy that produced this record.
   * E.g. "ficecal-allocation-engine-v1", "manual".
   * @optional
   */
  allocationSource?: string;

  /**
   * Identifier of the entity consuming the resource.
   * E.g. a team ID, user ID, or workload identifier.
   * @optional
   */
  consumerEntityId?: string;

  /**
   * Identifier of the entity that owns the resource subscription or account.
   * @optional
   */
  ownerEntityId?: string;

  /**
   * FOCUS 1.3: AllocatedCost — the portion of a shared cost assigned to
   * this consumer after applying the allocation method.
   * Decimal-safe string. Only present when allocationMethod is set.
   *
   * @optional
   * @focus FOCUS 1.3 / AllocatedCost (shared cost allocation)
   */
  allocatedCost?: string;

  /**
   * FOCUS 1.3: AllocatedResourceId — the resource ID of the source resource
   * whose cost was allocated to produce this record. Present when this record
   * is the result of a shared-cost allocation split from a parent resource.
   *
   * @optional
   * @focus FOCUS 1.3 / AllocatedResourceId
   */
  allocatedResourceId?: string;

  /**
   * FOCUS 1.3: AllocatedResourceName — human-readable name of the source
   * resource whose cost was allocated. Companion to allocatedResourceId.
   *
   * @optional
   * @focus FOCUS 1.3 / AllocatedResourceName
   */
  allocatedResourceName?: string;

  /**
   * FOCUS 1.3: AllocatedTags — the tags present on the source (allocated-from)
   * resource at the time the allocation was computed. Allows cost recipients
   * to trace the origin resource's classification.
   *
   * @optional
   * @focus FOCUS 1.3 / AllocatedTags
   */
  allocatedTags?: Record<string, string>;

  /**
   * FOCUS 1.3: ContractApplied — whether a contract (Enterprise Agreement,
   * private pricing agreement, or negotiated rate) discount was applied
   * to determine the effective cost of this charge.
   *
   * @optional
   * @focus FOCUS 1.3 / ContractApplied
   */
  contractApplied?: boolean;

  // ── Tagging and dimensions ─────────────────────────────────────────────────

  /**
   * Provider-level resource tags as key-value pairs.
   * @optional
   */
  tags?: Record<string, string>;

  /**
   * v2: Ordered list of tag key names present in this record.
   * Denormalized from `tags` to allow efficient filtering and faceting
   * without full object traversal. Derived field — keep in sync with `tags`.
   *
   * @optional
   */
  tagKeys?: string[];

  /**
   * Additional provider-specific or organization-specific dimensions.
   * @optional
   */
  dimensions?: Record<string, string>;

  // ── Data quality ──────────────────────────────────────────────────────────

  /**
   * Completeness confidence of this record.
   * @required
   */
  dataCompleteness: DataCompleteness;

  /**
   * ISO 8601 timestamp indicating how recent the source data is.
   * E.g. the export timestamp of the billing file.
   * @optional
   */
  dataRecencyTimestamp?: string;

  /**
   * ISO 8601 timestamp when this record was ingested into FiceCal.
   * @required
   */
  ingestedAt: string;

  /**
   * Schema version of this record, for forward compatibility.
   * Should match NORMALIZED_COST_RECORD_SCHEMA_VERSION.
   * @required
   */
  schemaVersion: string;

  // ── Data freshness (v2.2.0) ───────────────────────────────────────────────

  /**
   * ISO 8601 datetime when this record was last refreshed from the provider.
   *
   * @optional
   */
  dataRefreshedAt?: string;

  /**
   * Age of this record in seconds at time of query.
   * Computed from dataRefreshedAt relative to the query execution time.
   *
   * @optional
   */
  dataAgeSeconds?: number;

  /**
   * Staleness classification at time of query:
   * - "fresh"      : refreshed within the last hour (<3600s)
   * - "stale"      : refreshed between 1 hour and 24 hours ago (3600–86400s)
   * - "very-stale" : refreshed more than 24 hours ago (>86400s)
   * - "unknown"    : refresh timestamp not available
   *
   * @optional
   */
  dataFreshnessStatus?: "fresh" | "stale" | "very-stale" | "unknown";

  /**
   * Adapter type that produced this record.
   * - "live"          : data fetched live from provider API
   * - "deterministic" : data returned from a registered fixture
   * - "cached"        : data served from an intermediate cache layer
   * - "fixture"       : static test fixture, not real billing data
   *
   * @optional
   */
  dataSource?: "live" | "deterministic" | "cached" | "fixture";
};

// ---------------------------------------------------------------------------
// FOCUS 1.3 gap registry — columns deferred to Phase 9+
// ---------------------------------------------------------------------------

/**
 * FOCUS 1.3 columns not yet represented in NormalizedCostRecord v2.
 * Listed here to track coverage progress and inform Phase 9 additions.
 *
 * v2.1.0: ~72/77 columns (~93%) — 9 columns newly implemented:
 *   CapacityReservationId, CapacityReservationStatus, SkuMeter, SkuPriceDetails,
 *   PricingBlockSize, ServicePeriodStart, ServicePeriodEnd, BillingCurrency,
 *   EffectiveExchangeRate, PricingCurrencyContractedUnitPrice,
 *   PricingCurrencyEffectiveCost, ContractApplied, AllocatedResourceId,
 *   AllocatedResourceName, AllocatedTags.
 *
 * @focus-gap columns (estimated 5 remaining):
 *   - ServiceSubcategory   : More granular than serviceCategory; FOCUS sub-tier
 *   - ContractId            : Enterprise Agreement or custom contract reference
 *   - AccountCreationDate   : sub-account creation timestamp
 *   - BillingExchangeRate   : FX rate used to convert to billing currency
 *   - InvoiceRecordType     : invoice vs. credit memo vs. adjustment note
 *   - x_*                   : Provider-specific extension columns (FOCUS §8)
 */
export const FOCUS_V1_3_GAP_COLUMNS = [
  "ServiceSubcategory",
  "ContractId",
  "AccountCreationDate",
  "BillingExchangeRate",
  "InvoiceRecordType",
  "x_CustomExtensions",
] as const;

// ---------------------------------------------------------------------------
// Validation error
// ---------------------------------------------------------------------------

/**
 * Thrown when a NormalizedCostRecord fails structural or business-rule validation.
 */
export class NormalizedCostRecordValidationError extends Error {
  public readonly field?: string;
  public readonly recordId?: string;

  constructor(message: string, options?: { field?: string; recordId?: string }) {
    super(message);
    this.name = "NormalizedCostRecordValidationError";
    this.field = options?.field;
    this.recordId = options?.recordId;
  }
}

// ---------------------------------------------------------------------------
// Validation helper (lightweight, no zod dependency)
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS: Array<keyof NormalizedCostRecord> = [
  "recordId",
  "sourceSystem",
  "provider",
  "providerRole",
  "billingPeriodStart",
  "billingPeriodEnd",
  "chargePeriodStart",
  "chargePeriodEnd",
  "currency",
  "amount",
  "amountType",
  "dataCompleteness",
  "ingestedAt",
  "schemaVersion",
];

/**
 * Asserts that a NormalizedCostRecord has all required fields populated.
 * Throws NormalizedCostRecordValidationError on the first missing or empty field.
 *
 * For a non-throwing version that collects all errors, use
 * `validateNormalizedCostRecord` from `./validate.js`.
 */
export function assertNormalizedCostRecord(
  record: Partial<NormalizedCostRecord>
): asserts record is NormalizedCostRecord {
  for (const field of REQUIRED_FIELDS) {
    const value = record[field];
    if (value === undefined || value === null || value === "") {
      throw new NormalizedCostRecordValidationError(
        `Missing required field: "${field}"`,
        { field, recordId: record.recordId }
      );
    }
  }
}

/**
 * Type-guard that checks if an object conforms to NormalizedCostRecord shape
 * without throwing. Returns false on the first validation failure.
 */
export function isNormalizedCostRecord(
  value: unknown
): value is NormalizedCostRecord {
  if (typeof value !== "object" || value === null) return false;
  try {
    assertNormalizedCostRecord(value as Partial<NormalizedCostRecord>);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// v2 migration helpers
// ---------------------------------------------------------------------------

/**
 * Derives tagKeys from a record's tags object.
 * Call this when ingesting v1 records into v2 to populate the denormalized field.
 */
export function deriveTagKeys(tags: Record<string, string> | undefined): string[] | undefined {
  if (!tags) return undefined;
  const keys = Object.keys(tags);
  return keys.length > 0 ? keys.sort() : undefined;
}

/**
 * Upgrades a v1.0.0 NormalizedCostRecord to v2.0.0 in-place (non-destructive).
 * Adds `tagKeys` derived from existing `tags`, sets `schemaVersion` to the
 * current NORMALIZED_COST_RECORD_SCHEMA_VERSION.
 * All v1 required fields remain unchanged.
 *
 * @returns A new object (does not mutate the input).
 */
export function upgradeToV2(record: NormalizedCostRecord): NormalizedCostRecord {
  return {
    ...record,
    tagKeys: deriveTagKeys(record.tags),
    schemaVersion: NORMALIZED_COST_RECORD_SCHEMA_VERSION,
  };
}

// ---------------------------------------------------------------------------
// ContractCommitmentRecord — FOCUS 1.3 Contract Commitment Dataset
// ---------------------------------------------------------------------------

/**
 * Schema version for ContractCommitmentRecord.
 * Follows semver; increment when breaking changes are introduced.
 */
export const CONTRACT_COMMITMENT_SCHEMA_VERSION = "1.0.0";

/**
 * ContractCommitmentRecord — FOCUS 1.3 Contract Commitment Dataset
 *
 * Represents an active contract commitment (RI, Savings Plan, CUD, etc.)
 * as of a billing period. This is a separate FOCUS dataset from
 * NormalizedCostRecord (Cost and Usage Dataset).
 *
 * @see https://focus.finops.org/ — FOCUS 1.3 Contract Commitment Dataset
 */
export type ContractCommitmentRecord = {
  // Identity
  recordId: string;
  schemaVersion: string;

  // Contract details (FOCUS 1.3 Contract Dataset columns)

  /** ContractId — provider-issued unique identifier for the contract. */
  contractId: string;

  /** ContractApplied — whether a contract discount was applied to this charge. */
  contractApplied: boolean;

  /**
   * ContractCommitmentCategory — whether the commitment is spend- or usage-based.
   * Reuses the CommitmentDiscountCategory enum.
   */
  contractCommitmentCategory: CommitmentDiscountCategory;

  /**
   * ContractCommitmentDiscount — monetary or usage discount amount provided
   * by this contract commitment. Decimal-safe string.
   */
  contractCommitmentDiscount: string;

  /**
   * CommitmentDiscountUnit — unit of measure for contractCommitmentDiscountQuantity.
   * E.g. "USD/hr", "vCPU-hr", "Normalized units".
   */
  contractCommitmentDiscountUnit: string;

  /**
   * ContractCommitmentDiscountQuantity — quantity of commitment consumed or
   * wasted during this billing period. Decimal-safe string.
   */
  contractCommitmentDiscountQuantity: string;

  /**
   * ContractCommitmentStatus — whether the commitment was used or unused.
   * Reuses the CommitmentDiscountStatus enum.
   */
  contractCommitmentStatus: CommitmentDiscountStatus;

  /**
   * ContractCommitmentType — the type of pricing commitment.
   * Reuses the CommitmentType enum.
   */
  contractCommitmentType: CommitmentType;

  /** ISO 8601 — start of the contract commitment period (inclusive). */
  contractPeriodStart: string;

  /** ISO 8601 — end of the contract commitment period (exclusive). */
  contractPeriodEnd: string;

  // Provider context

  /** Canonical name of the cloud/AI provider. E.g. "aws", "azure", "gcp". */
  provider: string;

  /** Top-level billing account identifier (optional for sub-account contracts). */
  billingAccountId?: string;

  /** ISO 8601 — start of the billing period this record covers (inclusive). */
  billingPeriodStart: string;

  /** ISO 8601 — end of the billing period this record covers (exclusive). */
  billingPeriodEnd: string;

  /** ISO 4217 currency code for all monetary amounts in this record. */
  currency: string;

  // Commitment financial summary

  /**
   * Total cost over the full contract commitment period.
   * Decimal-safe string.
   */
  commitmentTotalCost: string;

  /**
   * Amortized cost attributable to this billing period.
   * Decimal-safe string.
   */
  commitmentAmortizedCost: string;

  /**
   * Cost of unused/wasted commitment capacity during this billing period.
   * Decimal-safe string.
   */
  commitmentWastedCost: string;

  /**
   * Utilization rate for this billing period.
   * Range: 0.0000000000 to 1.0000000000 (10 decimal places).
   * Decimal-safe string.
   */
  utilizationRate: string;

  // Metadata

  /** ISO 8601 timestamp when this record was ingested into FiceCal. */
  ingestedAt: string;

  /** Completeness confidence of this record. */
  dataCompleteness: DataCompleteness;
};

// ---------------------------------------------------------------------------
// Data validation pipeline (Gap D5) — non-throwing { valid, errors } variants
// ---------------------------------------------------------------------------

export {
  validateNormalizedCostRecord,
  validateNormalizedCostBatch,
} from "./validate.js";
export type {
  ValidationResult,
  BatchValidationResult,
  InvalidRecordEntry,
} from "./validate.js";
