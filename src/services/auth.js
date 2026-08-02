import { reactive, readonly } from 'vue'
import { getDefaultRouteForRole, normalizeRole } from '@/constants/roles'
import {
  isSelfRegistrationEnabled,
  isSupabaseConfigured,
  supabase
} from '@/lib/supabase'

const state = reactive({
  initialized: false,
  loading: false,
  session: null,
  user: null,
  profile: null,
  role: null,
  errorMessage: ''
})

let initializationPromise
let authSubscription

async function fetchUserProfile(userId) {
  if (!supabase || !isSupabaseConfigured || !userId) {
    return null
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, role, is_active')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ?? null
}

function deriveRole(user, profile) {
  const profileRole = normalizeRole(profile?.role)

  if (profileRole) {
    return profileRole
  }

  const directRole = normalizeRole(user?.app_metadata?.role)

  if (directRole) {
    return directRole
  }

  const appRoles = Array.isArray(user?.app_metadata?.roles)
    ? user.app_metadata.roles.map(normalizeRole).filter(Boolean)
    : []

  if (appRoles.length > 0) {
    return appRoles[0]
  }

  return null
}

async function syncSession(session) {
  state.session = session
  state.user = session?.user ?? null
  state.profile = null

  if (state.user) {
    try {
      state.profile = await fetchUserProfile(state.user.id)
    } catch {
      state.profile = null
    }
  }

  state.role = deriveRole(state.user, state.profile)

  return state
}

function ensureSupabase() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to continue.'
    )
  }
}

export function resolveSafeRedirect(targetPath, fallback = '/') {
  if (typeof targetPath !== 'string') {
    return fallback
  }

  if (!targetPath.startsWith('/') || targetPath.startsWith('//')) {
    return fallback
  }

  return targetPath
}

export async function initializeAuth() {
  if (state.initialized) {
    return state
  }

  if (initializationPromise) {
    return initializationPromise
  }

  if (!supabase || !isSupabaseConfigured) {
    state.initialized = true
    state.errorMessage = ''

    return state
  }

  state.loading = true

  initializationPromise = (async () => {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      throw error
    }

    await syncSession(data.session ?? null)

    if (!authSubscription) {
      const { data: listener } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          void syncSession(session)
        }
      )

      authSubscription = listener.subscription
    }

    state.initialized = true
    state.errorMessage = ''

    return state
  })()
    .catch(error => {
      state.session = null
      state.user = null
      state.profile = null
      state.role = null
      state.initialized = true
      state.errorMessage =
        error instanceof Error
          ? error.message
          : 'Unable to initialize authentication.'

      return state
    })
    .finally(() => {
      state.loading = false
    })

  return initializationPromise
}

export async function signInWithPassword({ email, password }) {
  ensureSupabase()
  state.loading = true
  state.errorMessage = ''

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    state.loading = false
    throw error
  }

  await syncSession(data.session ?? null)
  state.loading = false

  return data
}

export async function signUpWithPassword({ email, password, fullName }) {
  ensureSupabase()

  if (!isSelfRegistrationEnabled) {
    throw new Error(
      'Self-registration is disabled for this workspace. Ask an admin to create your account.'
    )
  }

  state.loading = true
  state.errorMessage = ''

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName?.trim() ?? ''
      }
    }
  })

  state.loading = false

  if (error) {
    throw error
  }

  await syncSession(data.session ?? null)

  return data
}

export async function signOut() {
  if (!supabase || !isSupabaseConfigured) {
    await syncSession(null)
    return
  }

  state.loading = true

  const { error } = await supabase.auth.signOut()

  await syncSession(null)
  state.loading = false

  if (error) {
    throw error
  }
}

export const authState = readonly(state)

export {
  getDefaultRouteForRole,
  isSelfRegistrationEnabled,
  isSupabaseConfigured
}
