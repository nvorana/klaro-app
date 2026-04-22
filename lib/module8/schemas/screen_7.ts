// ───────────────────────────────────────────────────────────────────────────
// Schema: Screen 7 — Add the Implementation Layer
// ───────────────────────────────────────────────────────────────────────────
// Per Appendix A + Doc 2:
// - Per module: 1-3 implementation assets from the canonical 12-type list
// - Hard rules: RULE_010 (min 1, max 3 per module), RULE_007 (closed lists)

import { z } from 'zod'
import { ASSET_TYPES } from '../types'

export const implementationLayerRequestSchema = z.object({
  user_notes: z.string().max(500).optional(),
})

export type ImplementationLayerRequest = z.infer<typeof implementationLayerRequestSchema>

export const assetEntrySchema = z.object({
  type: z.enum(ASSET_TYPES),
  title: z.string().min(3).max(150),
  purpose: z.string().min(10).max(400),
})

export type AssetEntry = z.infer<typeof assetEntrySchema>

export const moduleAssetsSchema = z.object({
  module_number: z.number().int().min(1).max(7),
  module_title: z.string().min(1),
  assets: z.array(assetEntrySchema).min(1).max(3),  // RULE_010
})

export type ModuleAssets = z.infer<typeof moduleAssetsSchema>

export const implementationLayerCreatorSchema = z.object({
  asset_map: z.array(moduleAssetsSchema).min(1),
  reused_from_offer_stack: z.array(z.string()).optional(),
  asset_coverage_complete: z.boolean(),
})

export type ImplementationLayerPayload = z.infer<typeof implementationLayerCreatorSchema>
