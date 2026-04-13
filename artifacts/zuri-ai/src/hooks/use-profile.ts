import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-context'

export interface UserProfile {
  id: string
  plan: string
  billing_cycle: string | null
  current_period_start: string | null
  current_period_end: string | null
  media_posts_used: number
  ugc_videos_used: number
  brands_count: number
  subscription_id: string | null
  cancel_at_period_end: boolean
  is_africa_pricing: boolean
  full_name: string | null
  email: string | null
}

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }

    async function fetchProfile() {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single()

      if (err) {
        setError(err.message)
      } else {
        setProfile(data as UserProfile)
      }
      setLoading(false)
    }

    fetchProfile()
  }, [user])

  async function refetch() {
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) setProfile(data as UserProfile)
  }

  return { profile, loading, error, refetch }
}
