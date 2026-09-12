<template>
  <q-page class="auth-page">
    <div class="auth-page__glow auth-page__glow--left" />
    <div class="auth-page__glow auth-page__glow--right" />

    <div class="auth-shell">
      <section class="auth-hero">
        <p class="auth-hero__eyebrow">Beecone Honey</p>
        <h1 class="auth-hero__title"
          >Trace every batch with the right people in the right places.</h1
        >
        <p class="auth-hero__body">
          BOMS starts with secure access so every purchase, batch, and
          remittance stays tied to a real teammate.
        </p>

        <div class="auth-hero__highlights">
          <div
            v-for="highlight in highlights"
            :key="highlight.title"
            class="auth-highlight"
          >
            <q-icon :name="highlight.icon" size="24px" color="warning" />
            <div>
              <div class="auth-highlight__title">{{ highlight.title }}</div>
              <div class="auth-highlight__text">{{ highlight.text }}</div>
            </div>
          </div>
        </div>
      </section>

      <q-card flat class="auth-card">
        <q-card-section class="auth-card__header">
          <div>
            <div class="auth-card__kicker">{{
              mode === 'sign-in' ? 'Sign in' : 'Request access'
            }}</div>
            <div class="auth-card__title">
              {{
                mode === 'sign-in'
                  ? 'Access your Beecone workspace'
                  : 'Create your account request'
              }}
            </div>
          </div>

          <q-btn
            v-if="isSelfRegistrationEnabled"
            flat
            color="secondary"
            no-caps
            :label="mode === 'sign-in' ? 'Need access?' : 'Have an account?'"
            @click="toggleMode"
          />
        </q-card-section>

        <q-card-section>
          <q-banner
            v-if="statusMessage"
            class="bg-secondary text-white rounded-borders q-mb-md"
          >
            {{ statusMessage }}
          </q-banner>

          <q-banner
            v-if="errorMessage"
            class="bg-red-1 text-negative rounded-borders q-mb-md"
          >
            {{ errorMessage }}
          </q-banner>

          <q-form class="auth-form" @submit.prevent="submitForm">
            <q-input
              v-if="mode === 'sign-up'"
              v-model="form.fullName"
              outlined
              label="Full name"
              autocomplete="name"
              :disable="isBusy"
              :rules="[
                value => Boolean(value?.trim()) || 'Enter the teammate name'
              ]"
            />

            <q-input
              v-model="form.email"
              outlined
              type="email"
              label="Work email"
              autocomplete="email"
              :disable="isBusy"
              :rules="[
                value => Boolean(value?.trim()) || 'Enter an email address',
                value => value.includes('@') || 'Use a valid email address'
              ]"
            />

            <q-input
              v-model="form.password"
              outlined
              :type="showPassword ? 'text' : 'password'"
              label="Password"
              autocomplete="current-password"
              :disable="isBusy"
              :rules="[
                value => Boolean(value) || 'Enter your password',
                value =>
                  mode === 'sign-in' ||
                  value.length >= 8 ||
                  'Use at least 8 characters'
              ]"
            >
              <template #append>
                <q-btn
                  flat
                  round
                  dense
                  aria-label="Show or hide password"
                  :icon="showPassword ? 'visibility_off' : 'visibility'"
                  @click="showPassword = !showPassword"
                />
              </template>
            </q-input>

            <p v-if="mode === 'sign-up'" class="auth-form__hint">
              New accounts still need an admin role assignment before restricted
              modules open.
            </p>

            <q-btn
              class="full-width"
              color="primary"
              no-caps
              type="submit"
              size="lg"
              :loading="isBusy"
              :disable="isBusy"
              :label="
                mode === 'sign-in'
                  ? 'Sign in to BOMS'
                  : 'Request workspace access'
              "
            />
          </q-form>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  authState,
  getDefaultRouteForRole,
  isSelfRegistrationEnabled,
  resolveSafeRedirect,
  signInWithPassword,
  signUpWithPassword
} from '@/services/auth'

const route = useRoute()
const router = useRouter()

const mode = ref('sign-in')
const showPassword = ref(false)
const errorMessage = ref('')
const statusMessage = ref('')
const form = reactive({
  fullName: '',
  email: '',
  password: ''
})

const highlights = [
  {
    title: 'Role-based entry',
    text: 'Each team starts with the routes and actions it actually needs.',
    icon: 'admin_panel_settings'
  },
  {
    title: 'Traceability first',
    text: 'Stock movement and financial activity stay linked to an authenticated user.',
    icon: 'route'
  },
  {
    title: 'Secure access',
    text: 'Session persistence and guarded navigation are already wired in.',
    icon: 'verified_user'
  }
]

const isBusy = computed(() => authState.loading)

function toggleMode() {
  errorMessage.value = ''
  statusMessage.value = ''
  showPassword.value = false
  mode.value = mode.value === 'sign-in' ? 'sign-up' : 'sign-in'
}

async function submitForm() {
  if (isBusy.value) return
  errorMessage.value = ''
  statusMessage.value = ''

  try {
    if (mode.value === 'sign-in') {
      await signInWithPassword({
        email: form.email.trim(),
        password: form.password
      })

      await router.replace(
        resolveSafeRedirect(
          typeof route.query.next === 'string' ? route.query.next : null,
          getDefaultRouteForRole(authState.role)
        )
      )

      return
    }

    const data = await signUpWithPassword({
      email: form.email.trim(),
      password: form.password,
      fullName: form.fullName
    })

    if (data.session) {
      statusMessage.value =
        'Account created. Ask an admin to assign your BOMS role before using restricted modules.'
      await router.replace(getDefaultRouteForRole(authState.role))
      return
    }

    statusMessage.value =
      'Account request received. Check your email to confirm the account, then ask an admin to assign your role.'
    form.password = ''
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Authentication failed. Please try again.'
  }
}
</script>
