export type PlanId = 'free' | 'solo' | 'growth' | 'studio' | 'enterprise'

export interface PlanDefinition {
  id: PlanId
  name: string
  tagline: string
  target: string
  price: {
    africa: { monthly: number; annual: number; currency: 'NGN' }
    global: { monthly: number; annual: number; currency: 'USD' }
  }
  limits: {
    brands: number
    media_posts_monthly: number
    ugc_videos_monthly: number
    platforms_connected: number
    team_members: number
    voice_examples: number
    bulk_plan_days: number
    scheduled_posts: number
  }
  features: {
    quick_create: boolean
    media_first_creation: boolean
    multi_platform_post: boolean
    bulk_planning: boolean
    content_calendar: boolean
    brand_calendar: boolean
    creative_studio: boolean
    carousel_builder: boolean
    ugc_video: boolean
    voice_file: boolean
    lessons_bank: boolean
    client_approvals: boolean
    team_workspace: boolean
    white_label: boolean
    analytics: boolean
    priority_support: boolean
    api_access: boolean
    caption_enhancement: boolean
    scheduling: boolean
  }
  popular: boolean
  cta: string
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Try Zuri AI',
    target: 'New users exploring the platform',
    price: {
      africa: { monthly: 0, annual: 0, currency: 'NGN' },
      global: { monthly: 0, annual: 0, currency: 'USD' },
    },
    limits: {
      brands: 1,
      media_posts_monthly: 5,
      ugc_videos_monthly: 0,
      platforms_connected: 1,
      team_members: 1,
      voice_examples: 5,
      bulk_plan_days: 0,
      scheduled_posts: 3,
    },
    features: {
      quick_create: true,
      media_first_creation: true,
      multi_platform_post: false,
      bulk_planning: false,
      content_calendar: false,
      brand_calendar: false,
      creative_studio: false,
      carousel_builder: false,
      ugc_video: false,
      voice_file: true,
      lessons_bank: false,
      client_approvals: false,
      team_workspace: false,
      white_label: false,
      analytics: false,
      priority_support: false,
      api_access: false,
      caption_enhancement: true,
      scheduling: false,
    },
    popular: false,
    cta: 'Start free',
  },

  solo: {
    id: 'solo',
    name: 'Solo',
    tagline: 'For one-person businesses',
    target: 'Solo founders, freelancers, small creators',
    price: {
      africa: { monthly: 9500, annual: 7917, currency: 'NGN' },
      global: { monthly: 6, annual: 5, currency: 'USD' },
    },
    limits: {
      brands: 1,
      media_posts_monthly: 30,
      ugc_videos_monthly: 2,
      platforms_connected: 2,
      team_members: 1,
      voice_examples: -1,
      bulk_plan_days: 7,
      scheduled_posts: 20,
    },
    features: {
      quick_create: true,
      media_first_creation: true,
      multi_platform_post: false,
      bulk_planning: true,
      content_calendar: true,
      brand_calendar: true,
      creative_studio: false,
      carousel_builder: false,
      ugc_video: false,
      voice_file: true,
      lessons_bank: true,
      client_approvals: false,
      team_workspace: false,
      white_label: false,
      analytics: false,
      priority_support: false,
      api_access: false,
      caption_enhancement: true,
      scheduling: true,
    },
    popular: false,
    cta: 'Start with Solo',
  },

  growth: {
    id: 'growth',
    name: 'Growth',
    tagline: 'For serious brands and creators',
    target: 'Small brands, active creators, small teams',
    price: {
      africa: { monthly: 24000, annual: 20000, currency: 'NGN' },
      global: { monthly: 15, annual: 12, currency: 'USD' },
    },
    limits: {
      brands: 3,
      media_posts_monthly: -1,
      ugc_videos_monthly: 5,
      platforms_connected: 6,
      team_members: 2,
      voice_examples: -1,
      bulk_plan_days: 31,
      scheduled_posts: -1,
    },
    features: {
      quick_create: true,
      media_first_creation: true,
      multi_platform_post: true,
      bulk_planning: true,
      content_calendar: true,
      brand_calendar: true,
      creative_studio: true,
      carousel_builder: true,
      ugc_video: true,
      voice_file: true,
      lessons_bank: true,
      client_approvals: false,
      team_workspace: false,
      white_label: false,
      analytics: true,
      priority_support: false,
      api_access: false,
      caption_enhancement: true,
      scheduling: true,
    },
    popular: true,
    cta: 'Start with Growth',
  },

  studio: {
    id: 'studio',
    name: 'Studio',
    tagline: 'For agencies and power users',
    target: 'Agencies, marketers managing multiple brands',
    price: {
      africa: { monthly: 55000, annual: 45833, currency: 'NGN' },
      global: { monthly: 35, annual: 29, currency: 'USD' },
    },
    limits: {
      brands: 10,
      media_posts_monthly: -1,
      ugc_videos_monthly: 20,
      platforms_connected: 6,
      team_members: 5,
      voice_examples: -1,
      bulk_plan_days: 31,
      scheduled_posts: -1,
    },
    features: {
      quick_create: true,
      media_first_creation: true,
      multi_platform_post: true,
      bulk_planning: true,
      content_calendar: true,
      brand_calendar: true,
      creative_studio: true,
      carousel_builder: true,
      ugc_video: true,
      voice_file: true,
      lessons_bank: true,
      client_approvals: true,
      team_workspace: true,
      white_label: false,
      analytics: true,
      priority_support: true,
      api_access: false,
      caption_enhancement: true,
      scheduling: true,
    },
    popular: false,
    cta: 'Start with Studio',
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large organisations',
    target: 'Large brands, enterprise teams, corporations',
    price: {
      africa: { monthly: 0, annual: 0, currency: 'NGN' },
      global: { monthly: 0, annual: 0, currency: 'USD' },
    },
    limits: {
      brands: -1,
      media_posts_monthly: -1,
      ugc_videos_monthly: -1,
      platforms_connected: 6,
      team_members: -1,
      voice_examples: -1,
      bulk_plan_days: 31,
      scheduled_posts: -1,
    },
    features: {
      quick_create: true,
      media_first_creation: true,
      multi_platform_post: true,
      bulk_planning: true,
      content_calendar: true,
      brand_calendar: true,
      creative_studio: true,
      carousel_builder: true,
      ugc_video: true,
      voice_file: true,
      lessons_bank: true,
      client_approvals: true,
      team_workspace: true,
      white_label: true,
      analytics: true,
      priority_support: true,
      api_access: true,
      caption_enhancement: true,
      scheduling: true,
    },
    popular: false,
    cta: 'Contact us',
  },
}

export function getPlan(planId: PlanId): PlanDefinition {
  return PLANS[planId] || PLANS.free
}

export const TESTING_MODE = true

export function canAccess(planId: PlanId, feature: keyof PlanDefinition['features']): boolean {
  if (TESTING_MODE) return true
  return PLANS[planId]?.features[feature] ?? false
}

export function withinLimit(
  planId: PlanId,
  limitKey: keyof PlanDefinition['limits'],
  currentUsage: number
): boolean {
  if (TESTING_MODE) return true
  const limit = PLANS[planId]?.limits[limitKey]
  if (limit === undefined) return false
  if (limit === -1) return true
  return currentUsage < limit
}

export function formatPrice(planId: PlanId, isAfrica: boolean, isAnnual: boolean): string {
  if (planId === 'enterprise') return 'Custom'
  if (planId === 'free') return 'Free'
  const plan = PLANS[planId]
  const pricing = isAfrica ? plan.price.africa : plan.price.global
  const amount = isAnnual ? pricing.annual : pricing.monthly
  if (isAfrica) return `${amount.toLocaleString()}`
  return `$${amount}`
}

export const ANNUAL_DISCOUNT_PERCENT = 17

const PLAN_ORDER: PlanId[] = ['free', 'solo', 'growth', 'studio', 'enterprise']

export function planRank(planId: PlanId): number {
  return PLAN_ORDER.indexOf(planId)
}
