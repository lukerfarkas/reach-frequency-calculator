/**
 * DMA Audience Data — re-exports from the generated file (or snapshot fallback).
 *
 * At build time the generated file is produced by `scripts/fetch-dma-demographics.js`.
 * If the generated file doesn't exist, the checked-in snapshot is used instead.
 */

// The generated file and snapshot have the same shape.
// During development / CI, the generated file is preferred (fresher data).
// The snapshot is committed to git so the app can build even without running the script.
export { DMA_LIST, DEMO_LIST, AUDIENCE_SIZE_MAP, lookupAudienceSize } from "./dmaAudienceData.snapshot";
