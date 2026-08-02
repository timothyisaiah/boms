import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { loadLocalEnvFiles, resolveMode } from './env.mjs'

const selectedMode = resolveMode()

loadLocalEnvFiles(selectedMode)

const supabaseUrl =
  process.env.SUPABASE_URL?.trim() ??
  process.env.VITE_SUPABASE_URL?.trim() ??
  ''
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim() ?? ''

const adminEmail =
  process.env.SUPABASE_ADMIN_EMAIL?.trim() ?? 'admin@beecone.local'
const adminPassword =
  process.env.SUPABASE_ADMIN_PASSWORD?.trim() ?? 'ChangeMe123!'
const adminFullName =
  process.env.SUPABASE_ADMIN_FULL_NAME?.trim() ?? 'Beecone Administrator'
const adminRole = process.env.SUPABASE_ADMIN_ROLE?.trim() ?? 'admin_owner'

if (!supabaseUrl || !supabaseSecretKey) {
  console.error(
    `Missing SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SECRET_KEY. The script reads .env files automatically for mode "${selectedMode}", so add them there or export them in your shell.`
  )
  process.exit(1)
}

if (
  supabaseSecretKey.startsWith('sb_publishable_') ||
  supabaseSecretKey.startsWith('eyJ')
) {
  console.error(
    'SUPABASE_SECRET_KEY must be a server-side secret key, not the publishable client key.'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
})

async function findUserByEmail(email) {
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000
    })

    if (error) {
      throw error
    }

    const users = data?.users ?? []
    const matchingUser = users.find(
      user => user.email?.toLowerCase() === email.toLowerCase()
    )

    if (matchingUser) {
      return matchingUser
    }

    if (users.length < 1000) {
      return null
    }

    page += 1
  }
}

async function ensureAdminUser() {
  const existingUser = await findUserByEmail(adminEmail)

  if (existingUser) {
    const { error } = await supabase.auth.admin.updateUserById(
      existingUser.id,
      {
        email_confirm: true,
        password: adminPassword,
        user_metadata: {
          ...existingUser.user_metadata,
          full_name: adminFullName
        },
        app_metadata: {
          ...existingUser.app_metadata,
          role: adminRole,
          is_active: true
        }
      }
    )

    if (error) {
      throw error
    }

    console.log(
      `Updated existing administrator ${adminEmail} (${existingUser.id}).`
    )
    return
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      full_name: adminFullName
    },
    app_metadata: {
      role: adminRole,
      is_active: true
    }
  })

  if (error) {
    throw error
  }

  console.log(`Created administrator ${adminEmail} (${data.user.id}).`)
}

ensureAdminUser().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
