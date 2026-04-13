import { Lock, Zap } from 'lucide-react'
import { Link } from 'wouter'
import type { PlanId } from '@/lib/plans'

interface UpgradePromptProps {
  feature: string
  requiredPlan: PlanId
  description?: string
  variant?: 'inline' | 'overlay' | 'card' | 'page'
}

const PLAN_LABELS: Record<PlanId, string> = {
  free: 'Free',
  solo: 'Solo',
  growth: 'Growth',
  studio: 'Studio',
  enterprise: 'Enterprise',
}

export function UpgradePrompt({
  feature,
  requiredPlan,
  description,
  variant = 'card',
}: UpgradePromptProps) {
  const desc = description || `Available on ${PLAN_LABELS[requiredPlan]} plan and above`

  if (variant === 'inline') {
    return (
      <Link href="/settings/billing">
        <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full cursor-pointer hover:bg-amber-100 transition-colors">
          <Lock size={10} />
          {PLAN_LABELS[requiredPlan]}+
        </span>
      </Link>
    )
  }

  if (variant === 'overlay') {
    return (
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center z-10 p-6 text-center">
        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mb-3">
          <Lock size={18} className="text-amber-600" />
        </div>
        <p className="font-medium text-sm text-foreground mb-1">{feature}</p>
        <p className="text-xs text-muted-foreground mb-4">{desc}</p>
        <Link href="/settings/billing">
          <button className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors">
            Upgrade to {PLAN_LABELS[requiredPlan]}
          </button>
        </Link>
      </div>
    )
  }

  if (variant === 'page') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
          <Lock size={28} className="text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">{feature}</h2>
        <p className="text-muted-foreground mb-6 max-w-sm">{desc}</p>
        <Link href="/settings/billing">
          <button className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition-colors">
            <Zap size={16} />
            Upgrade to {PLAN_LABELS[requiredPlan]}
          </button>
        </Link>
        <Link href="/pricing" className="mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
          View all plans
        </Link>
      </div>
    )
  }

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 flex items-start gap-3">
      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
        <Lock size={14} className="text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground">{feature}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <Link href="/settings/billing">
        <button className="border border-amber-400 text-amber-700 hover:bg-amber-100 flex-shrink-0 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium">
          Upgrade
        </button>
      </Link>
    </div>
  )
}
