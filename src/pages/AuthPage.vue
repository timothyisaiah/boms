<template>
  <q-page class="auth-page">
    <div class="auth-shell">
      <!--
        The h1 stays visible at every width (MF-08). Below 1024px only the
        brand line and title remain; the body copy and highlights are desktop
        context.
      -->
      <section class="auth-hero" aria-labelledby="auth-title">
        <p class="auth-hero__eyebrow">Beecone Honey · BOMS</p>
        <h1 id="auth-title" class="auth-hero__title"
          >Trace every batch with the right people in the right places.</h1
        >
        <p class="auth-hero__body">
          BOMS starts with secure access so every purchase, batch, and
          remittance stays tied to a real teammate.
        </p>

        <ul class="auth-hero__highlights">
          <li
            v-for="highlight in highlights"
            :key="highlight.title"
            class="auth-highlight"
          >
            <q-icon
              :name="highlight.icon"
              size="24px"
              color="primary"
              aria-hidden="true"
            />
            <div>
              <div class="auth-highlight__title">{{ highlight.title }}</div>
              <div class="auth-highlight__text">{{ highlight.text }}</div>
            </div>
          </li>
        </ul>
      </section>

      <q-card flat class="auth-card">
        <q-card-section class="auth-card__header">
          <div>
            <p class="auth-card__kicker">{{
              mode === 'sign-in' ? 'Sign in' : 'Request access'
            }}</p>
            <h2 class="auth-card__title">
              {{
                mode === 'sign-in'
                  ? 'Access your Beecone workspace'
                  : 'Create your account request'
              }}
            </h2>
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
          <div
            v-if="statusMessage"
            class="auth-message auth-message--status"
            role="status"
          >
            {{ statusMessage }}
          </div>

          <div
            v-if="errorMessage"
            ref="errorRef"
            class="auth-message auth-message--error"
            role="alert"
            tabindex="-1"
          >
            {{ errorMessage }}
          </div>

          <q-form class="auth-form" @submit.prevent="submitForm">
            <q-input
              v-if="mode === 'sign-up'"
              v-model="form.fullName"
              outlined
              for="auth-full-name"
              name="name"
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
              for="auth-email"
              name="email"
              type="email"
              inputmode="email"
              label="Work email"
              :autocomplete="mode === 'sign-in' ? 'username' : 'email'"
              autocapitalize="off"
              spellcheck="false"
              :disable="isBusy"
              :rules="[
                value => Boolean(value?.trim()) || 'Enter an email address',
                value => value.includes('@') || 'Use a valid email address'
              ]"
            />

            <q-input
              v-model="form.password"
              outlined
              for="auth-password"
              name="password"
              :type="showPassword ? 'text' : 'password'"
              label="Password"
              :autocomplete="
                mode === 'sign-in' ? 'current-password' : 'new-password'
              "
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
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  :aria-pressed="showPassword ? 'true' : 'false'"
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
              unelevated
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
import { computed, nextTick, reactive, ref } from 'vue'
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
const errorRef = ref(null)
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

async function showError(message) {
  errorMessage.value = message
  // role="alert" announces it; focus lets keyboard users continue from it.
  await nextTick()
  errorRef.value?.focus()
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
    await showError(
      error instanceof Error
        ? error.message
        : 'Authentication failed. Please try again.'
    )
  }
}
</script>

<style scoped>
/*
 * Overrides of the global auth rules in app.scss (MF-08, MF-13): a flat page
 * without decorative glows, a visible h1 at every width and no overflow at
 * 320px.
 */
.auth-page {
  overflow: visible;
}
.auth-page .auth-hero {
  background: var(--boms-color-surface-subtle);
}
.auth-hero__eyebrow,
.auth-card__kicker {
  margin: 0;
}
.auth-card__title {
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: normal;
  overflow-wrap: anywhere;
}
.auth-hero__highlights {
  list-style: none;
  padding: 0;
}
.auth-highlight {
  background: var(--boms-color-surface);
}
.auth-message {
  margin-bottom: var(--boms-space-4);
  padding: var(--boms-space-3) var(--boms-space-4);
  border-radius: var(--boms-radius-sm);
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.auth-message:focus-visible {
  outline: 3px solid var(--boms-color-focus);
  outline-offset: 2px;
}
.auth-message--status {
  background: var(--boms-color-info-bg);
  color: var(--boms-color-info-text);
}
.auth-message--error {
  border: 1px solid var(--boms-color-danger);
  background: var(--boms-color-danger-bg);
  color: var(--boms-color-danger-text);
}

@media (max-width: 1023px) {
  /* app.scss hides .auth-hero below 1024px; keep the brand line and h1. */
  .auth-page .auth-hero {
    display: block;
    padding: 0 0 var(--boms-space-2);
    border: 0;
    background: none;
  }
  .auth-page .auth-hero__title {
    font-size: 1.375rem;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .auth-page .auth-hero__body,
  .auth-page .auth-hero__highlights {
    display: none;
  }
  .auth-page .auth-shell {
    gap: var(--boms-space-3);
    align-content: start;
  }
  .auth-page .auth-card__header {
    padding-top: var(--boms-space-4);
  }
}
</style>
