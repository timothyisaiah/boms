import { boot } from 'quasar/wrappers'
import {
  authState,
  initializeAuth,
  signInWithPassword,
  signOut,
  signUpWithPassword
} from '@/services/auth'

export default boot(async ({ app }) => {
  await initializeAuth()

  app.config.globalProperties.$auth = {
    state: authState,
    initializeAuth,
    signInWithPassword,
    signUpWithPassword,
    signOut
  }
})
