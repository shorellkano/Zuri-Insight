import { useProfile } from '@/hooks/use-profile'
import { getPlan, canAccess, withinLimit, planRank, type PlanId, type PlanDefinition } from '@/lib/plans'

export function usePlan() {
  const { profile, loading, refetch } = useProfile()
  const planId = (profile?.plan || 'free') as PlanId
  const plan = getPlan(planId)
  const isAfrica = profile?.is_africa_pricing ?? true

  function hasFeature(feature: keyof PlanDefinition['features']): boolean {
    return canAccess(planId, feature)
  }

  function checkLimit(limitKey: keyof PlanDefinition['limits'], currentUsage: number): boolean {
    return withinLimit(planId, limitKey, currentUsage)
  }

  function requiresPlan(minimumPlan: PlanId): boolean {
    return planRank(planId) >= planRank(minimumPlan)
  }

  const mediaPostsUsed = profile?.media_posts_used ?? 0
  const mediaPostsLimit = plan.limits.media_posts_monthly
  const mediaPostsPct = mediaPostsLimit === -1 ? 0 : Math.min((mediaPostsUsed / mediaPostsLimit) * 100, 100)
  const mediaPostsAtLimit = mediaPostsLimit !== -1 && mediaPostsUsed >= mediaPostsLimit

  return {
    planId,
    plan,
    isAfrica,
    hasFeature,
    checkLimit,
    requiresPlan,
    profile,
    loading,
    refetch,
    usage: {
      mediaPostsUsed,
      mediaPostsLimit,
      mediaPostsPct,
      mediaPostsAtLimit,
      ugcVideosUsed: profile?.ugc_videos_used ?? 0,
      brandsCount: profile?.brands_count ?? 0,
    },
  }
}
