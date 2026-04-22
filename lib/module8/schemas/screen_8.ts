// ───────────────────────────────────────────────────────────────────────────
// Schema: Screen 8 — Define the Student Experience
// ───────────────────────────────────────────────────────────────────────────
// Per Appendix A:
// - Fully structured schema with 6 required enum fields
// - Creator returns the plan + rationale

import { z } from 'zod'
import {
  DELIVERY_CADENCES,
  SUPPORT_CHANNELS,
  COMMUNITY_ACCESS,
  LIVE_SESSION_FREQUENCIES,
  COMPLETION_MODELS,
  CERTIFICATIONS,
} from '../types'

export const studentExperienceRequestSchema = z.object({
  user_preferred_delivery_cadence: z.enum(DELIVERY_CADENCES).optional(),
  user_preferred_support_channel: z.enum(SUPPORT_CHANNELS).optional(),
  user_preferred_community_access: z.enum(COMMUNITY_ACCESS).optional(),
  user_preferred_live_session_frequency: z.enum(LIVE_SESSION_FREQUENCIES).optional(),
  user_preferred_completion_model: z.enum(COMPLETION_MODELS).optional(),
  user_preferred_certification: z.enum(CERTIFICATIONS).optional(),
  additional_notes: z.string().max(500).optional(),
})

export type StudentExperienceRequest = z.infer<typeof studentExperienceRequestSchema>

export const experiencePlanSchema = z.object({
  delivery_cadence: z.enum(DELIVERY_CADENCES),
  support_channel: z.enum(SUPPORT_CHANNELS),
  community_access: z.enum(COMMUNITY_ACCESS),
  live_session_frequency: z.enum(LIVE_SESSION_FREQUENCIES),
  completion_model: z.enum(COMPLETION_MODELS),
  certification: z.enum(CERTIFICATIONS),
})

export type ExperiencePlan = z.infer<typeof experiencePlanSchema>

export const studentExperienceCreatorSchema = z.object({
  plan: experiencePlanSchema,
  rationale_for_user: z.string().min(30).max(1500),
  onboarding_outline: z.string().min(20).max(800).optional(),
  milestone_plan: z.array(z.string()).optional(),
})

export type StudentExperiencePayload = z.infer<typeof studentExperienceCreatorSchema>
