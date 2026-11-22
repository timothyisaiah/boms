<template>
  <q-page class="auth-page">
    <div class="auth-page__orbit auth-page__orbit--one" aria-hidden="true" />
    <div class="auth-page__orbit auth-page__orbit--two" aria-hidden="true" />

    <div class="auth-shell">
      <section class="auth-hero" aria-labelledby="auth-title">
        <div class="auth-hero__hive" aria-hidden="true">
          <span v-for="cell in 7" :key="cell" class="auth-hero__cell" />
        </div>

        <div class="auth-brand">
          <span class="auth-brand__mark" aria-hidden="true">
            <q-icon name="emoji_nature" size="30px" />
          </span>
          <span class="auth-brand__wordmark">
            <strong>Beecone Honey</strong>
            <small>Operations management</small>
          </span>
        </div>

        <div class="auth-hero__copy">
          <p class="auth-hero__eyebrow">
            <span aria-hidden="true" />
            Live traceability workspace
          </p>
          <h1 id="auth-title" class="auth-hero__title">
            From hive to handoff, every move has a name.
          </h1>
          <p class="auth-hero__body">
            One secure workspace for purchases, production, stock and
            remittances—connected to the teammate responsible at every step.
          </p>
        </div>

        <ol class="auth-trace" aria-label="Beecone operations workflow">
          <li
            v-for="(highlight, index) in highlights"
            :key="highlight.title"
            class="auth-trace__step"
          >
            <span class="auth-trace__index">0{{ index + 1 }}</span>
            <div>
              <strong>{{ highlight.title }}</strong>
              <span>{{ highlight.text }}</span>
            </div>
          </li>
        </ol>

        <div class="auth-hero__foot">
          <q-icon name="verified_user" size="18px" aria-hidden="true" />
          <span>Role-aware access. Complete audit trail.</span>
        </div>
      </section>

      <section class="auth-panel" aria-labelledby="auth-form-title">
        <div class="auth-panel__topline" aria-hidden="true">
          <span>Secure workspace</span>
          <span>{{ mode === 'sign-in' ? '01 / Sign in' : '02 / Access' }}</span>
        </div>

        <q-card flat class="auth-card">
          <q-card-section class="auth-card__header">
            <div class="auth-card__heading">
              <span class="auth-card__symbol" aria-hidden="true">
                <q-icon
                  :name="mode === 'sign-in' ? 'lock_open' : 'person_add'"
                  size="24px"
                />
              </span>
              <div>
                <p class="auth-card__kicker">{{
                  mode === 'sign-in' ? 'Welcome back' : 'Join the workspace'
                }}</p>
                <h2 id="auth-form-title" class="auth-card__title">
                  {{
                    mode === 'sign-in'
                      ? 'Sign in to continue'
                      : 'Request team access'
                  }}
                </h2>
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

          <q-card-section class="auth-card__body">
            <p class="auth-card__intro">
              {{
                mode === 'sign-in'
                  ? 'Use the work email and password assigned to your Beecone account.'
                  : 'Tell us who you are. An administrator will assign your operating role.'
              }}
            </p>

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
              >
                <template #prepend>
                  <q-icon name="badge" aria-hidden="true" />
                </template>
              </q-input>

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
              >
                <template #prepend>
                  <q-icon name="alternate_email" aria-hidden="true" />
                </template>
              </q-input>

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
                <template #prepend>
                  <q-icon name="key" aria-hidden="true" />
                </template>
                <template #append>
                  <q-btn
                    flat
                    round
                    dense
                    :aria-label="
                      showPassword ? 'Hide password' : 'Show password'
                    "
                    :aria-pressed="showPassword ? 'true' : 'false'"
                    :icon="showPassword ? 'visibility_off' : 'visibility'"
                    @click="showPassword = !showPassword"
                  />
                </template>
              </q-input>

              <p v-if="mode === 'sign-up'" class="auth-form__hint">
                New accounts still need an admin role assignment before
                restricted modules open.
              </p>

              <q-btn
                class="full-width"
                color="primary"
                no-caps
                unelevated
                icon-right="arrow_forward"
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

            <div class="auth-card__divider" aria-hidden="true">
              <span />
              <small>Managed team access</small>
              <span />
            </div>

            <div class="auth-card__assurance">
              <q-icon name="shield" size="20px" aria-hidden="true" />
              <p>
                Accounts are created and assigned by your Beecone administrator.
                Your activity remains linked to your role.
              </p>
            </div>
          </q-card-section>
        </q-card>

        <p class="auth-panel__footer">
          Beecone Operations Management System
          <span aria-hidden="true">·</span>
          Built for accountable teams
        </p>
      </section>
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
  { title: 'Source', text: 'Supplier to store' },
  { title: 'Transform', text: 'Batch to product' },
  { title: 'Deliver', text: 'Stock to settlement' }
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
.auth-page {
  min-height: 100vh;
  overflow: hidden;
  padding: max(24px, var(--boms-safe-top)) max(24px, var(--boms-safe-right))
    max(24px, var(--boms-safe-bottom)) max(24px, var(--boms-safe-left));
  background: var(--boms-color-canvas);
}
.auth-page__orbit {
  position: absolute;
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-pill);
  pointer-events: none;
}
.auth-page__orbit--one {
  width: 28rem;
  height: 28rem;
  top: -18rem;
  right: -10rem;
}
.auth-page__orbit--two {
  width: 18rem;
  height: 18rem;
  bottom: -12rem;
  left: -8rem;
}
.auth-page .auth-shell {
  width: min(100%, 1380px);
  min-height: calc(100vh - 48px);
  margin: 0 auto;
  grid-template-columns: minmax(0, 1.15fr) minmax(390px, 0.85fr);
  gap: 0;
  border: 1px solid var(--boms-color-border-strong);
  border-radius: var(--boms-radius-lg);
  overflow: hidden;
  background: var(--boms-color-surface);
  box-shadow: var(--boms-elevation-overlay);
}
.auth-page .auth-hero {
  position: relative;
  isolation: isolate;
  min-width: 0;
  padding: clamp(32px, 5vw, 72px);
  border: 0;
  border-radius: 0;
  overflow: hidden;
  background: var(--boms-forest);
  color: var(--boms-cream);
}
.auth-hero__hive {
  position: absolute;
  z-index: -1;
  width: 24rem;
  height: 21rem;
  right: -8rem;
  bottom: -6rem;
  opacity: 0.11;
  transform: rotate(-8deg);
}
.auth-hero__cell {
  position: absolute;
  width: 7.5rem;
  aspect-ratio: 1.1;
  background: var(--boms-honey);
  clip-path: polygon(25% 6.7%, 75% 6.7%, 100% 50%, 75% 93.3%, 25% 93.3%, 0 50%);
}
.auth-hero__cell:nth-child(1) {
  left: 0;
  top: 4rem;
}
.auth-hero__cell:nth-child(2) {
  left: 6.4rem;
  top: 0;
}
.auth-hero__cell:nth-child(3) {
  left: 12.8rem;
  top: 4rem;
}
.auth-hero__cell:nth-child(4) {
  left: 6.4rem;
  top: 8rem;
}
.auth-hero__cell:nth-child(5) {
  left: 0;
  top: 12rem;
}
.auth-hero__cell:nth-child(6) {
  left: 12.8rem;
  top: 12rem;
}
.auth-hero__cell:nth-child(7) {
  left: 6.4rem;
  top: 16rem;
}
.auth-brand {
  display: flex;
  align-items: center;
  gap: var(--boms-space-3);
}
.auth-brand__mark,
.auth-card__symbol {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}
.auth-brand__mark {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: var(--boms-radius-md);
  background: var(--boms-honey);
  color: var(--boms-ink);
  transform: rotate(-3deg);
}
.auth-brand__mark :deep(.q-icon) {
  transform: rotate(3deg);
}
.auth-brand__wordmark {
  display: grid;
  gap: 2px;
}
.auth-brand__wordmark strong {
  font-size: 1rem;
  letter-spacing: 0.02em;
}
.auth-brand__wordmark small {
  color: var(--boms-honey);
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.auth-hero__copy {
  max-width: 44rem;
  margin: auto 0;
  padding: clamp(48px, 8vh, 96px) 0;
}
.auth-hero__eyebrow,
.auth-card__kicker {
  margin: 0;
}
.auth-hero__eyebrow {
  display: flex;
  align-items: center;
  gap: var(--boms-space-2);
  color: var(--boms-honey);
}
.auth-hero__eyebrow > span {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: var(--boms-radius-pill);
  background: var(--boms-honey);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--boms-honey) 18%, transparent);
}
.auth-page .auth-hero__title {
  max-width: 12ch;
  margin: var(--boms-space-6) 0 0;
  color: var(--boms-cream);
  font-size: clamp(2.75rem, 5.2vw, 5.6rem);
  line-height: 0.98;
  letter-spacing: -0.055em;
  text-wrap: balance;
}
.auth-page .auth-hero__body {
  max-width: 39rem;
  margin-top: var(--boms-space-6);
  color: color-mix(in srgb, var(--boms-cream) 78%, transparent);
  font-size: 1rem;
  line-height: 1.75;
}
.auth-trace {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  padding: var(--boms-space-6) 0 0;
  border-top: 1px solid color-mix(in srgb, var(--boms-cream) 18%, transparent);
  list-style: none;
}
.auth-trace__step {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--boms-space-3);
  min-width: 0;
  padding-right: var(--boms-space-4);
}
.auth-trace__step:not(:last-child)::after {
  position: absolute;
  top: 1rem;
  right: var(--boms-space-3);
  width: 1rem;
  height: 1px;
  background: color-mix(in srgb, var(--boms-honey) 54%, transparent);
  content: '';
}
.auth-trace__index {
  color: var(--boms-honey);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.auth-trace__step div {
  display: grid;
  gap: var(--boms-space-1);
}
.auth-trace__step strong {
  color: var(--boms-cream);
  font-size: 0.85rem;
}
.auth-trace__step div span {
  color: color-mix(in srgb, var(--boms-cream) 62%, transparent);
  font-size: 0.72rem;
  line-height: 1.45;
}
.auth-hero__foot {
  display: flex;
  align-items: center;
  gap: var(--boms-space-2);
  margin-top: var(--boms-space-6);
  color: color-mix(in srgb, var(--boms-cream) 68%, transparent);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
}
.auth-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: clamp(28px, 4vw, 64px);
  background: var(--boms-color-surface);
}
.auth-panel__topline {
  display: flex;
  justify-content: space-between;
  gap: var(--boms-space-4);
  padding-bottom: var(--boms-space-4);
  border-bottom: 1px solid var(--boms-color-border);
  color: var(--boms-color-text-muted);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.auth-page .auth-card {
  width: min(100%, 31rem);
  margin: auto;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.auth-card__heading {
  display: flex;
  align-items: center;
  gap: var(--boms-space-4);
}
.auth-card__symbol {
  width: 3rem;
  height: 3rem;
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-selected-bg);
  color: var(--boms-color-primary);
}
.auth-card__title {
  margin: var(--boms-space-1) 0 0;
  color: var(--boms-color-heading);
  font-size: clamp(1.75rem, 3vw, 2.35rem);
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: -0.035em;
  overflow-wrap: anywhere;
}
.auth-card__intro {
  margin: 0 0 var(--boms-space-6);
  color: var(--boms-color-text-muted);
  line-height: 1.65;
}
.auth-page .auth-card__header {
  align-items: center;
  padding: var(--boms-space-8) 0 var(--boms-space-4);
}
.auth-page .auth-card__body {
  padding: var(--boms-space-4) 0 0;
}
.auth-page .auth-form {
  gap: var(--boms-space-2);
}
.auth-page .auth-form :deep(.q-field__control) {
  min-height: 56px;
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-surface-subtle);
}
.auth-page .auth-form :deep(.q-field__prepend) {
  color: var(--boms-color-primary);
}
.auth-page .auth-form :deep(.q-btn[type='submit']) {
  min-height: 54px;
  margin-top: var(--boms-space-2);
  border-radius: var(--boms-radius-md);
  font-weight: 700;
  letter-spacing: 0.01em;
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
.auth-card__divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--boms-space-3);
  margin: var(--boms-space-8) 0 var(--boms-space-4);
  color: var(--boms-color-text-muted);
}
.auth-card__divider span {
  height: 1px;
  background: var(--boms-color-border);
}
.auth-card__divider small {
  font-size: 0.67rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.auth-card__assurance {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--boms-space-3);
  padding: var(--boms-space-4);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-surface-subtle);
  color: var(--boms-color-text-muted);
}
.auth-card__assurance :deep(.q-icon) {
  color: var(--boms-color-success);
}
.auth-card__assurance p {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.55;
}
.auth-panel__footer {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--boms-space-2);
  margin: var(--boms-space-6) 0 0;
  color: var(--boms-color-text-muted);
  font-size: 0.68rem;
  text-align: center;
}

@media (max-width: 1023px) {
  .auth-page {
    overflow: visible;
    padding: var(--boms-space-4);
  }
  .auth-page__orbit {
    display: none;
  }
  .auth-page .auth-shell {
    min-height: calc(100vh - 32px);
    grid-template-columns: 1fr;
    gap: 0;
    align-content: start;
  }
  .auth-page .auth-hero {
    display: flex;
    min-height: auto;
    padding: var(--boms-space-8);
  }
  .auth-page .auth-hero__title {
    max-width: 18ch;
    font-size: clamp(2.15rem, 7vw, 3.5rem);
    line-height: 1.02;
    overflow-wrap: anywhere;
  }
  .auth-hero__copy {
    padding: var(--boms-space-8) 0 0;
  }
  .auth-page .auth-hero__body,
  .auth-trace,
  .auth-hero__foot {
    display: none;
  }
  .auth-hero__hive {
    right: -11rem;
    bottom: -10rem;
  }
  .auth-panel {
    padding: var(--boms-space-8);
  }
  .auth-page .auth-card {
    width: min(100%, 35rem);
  }
}

@media (max-width: 599px) {
  .auth-page {
    padding: 0;
  }
  .auth-page .auth-shell {
    min-height: 100vh;
    border: 0;
    border-radius: 0;
    box-shadow: var(--boms-elevation-none);
  }
  .auth-page .auth-hero {
    padding: max(24px, var(--boms-safe-top)) max(20px, var(--boms-safe-right))
      var(--boms-space-8) max(20px, var(--boms-safe-left));
  }
  .auth-brand__mark {
    width: 2.75rem;
    height: 2.75rem;
  }
  .auth-brand__wordmark strong {
    font-size: 0.9rem;
  }
  .auth-brand__wordmark small {
    font-size: 0.62rem;
  }
  .auth-hero__copy {
    padding: var(--boms-space-8) 0 0;
  }
  .auth-hero__eyebrow {
    font-size: 0.65rem;
  }
  .auth-page .auth-hero__title {
    margin-top: var(--boms-space-4);
    font-size: clamp(2rem, 11vw, 2.85rem);
  }
  .auth-panel {
    padding: var(--boms-space-6) max(20px, var(--boms-safe-right))
      max(24px, var(--boms-safe-bottom)) max(20px, var(--boms-safe-left));
  }
  .auth-panel__topline {
    display: none;
  }
  .auth-page .auth-card__header {
    padding-top: 0;
  }
  .auth-card__symbol {
    width: 2.75rem;
    height: 2.75rem;
  }
  .auth-card__title {
    font-size: 1.7rem;
  }
  .auth-card__intro {
    margin-bottom: var(--boms-space-4);
    font-size: 0.9rem;
  }
  .auth-card__divider {
    margin-top: var(--boms-space-6);
  }
  .auth-panel__footer {
    margin-top: var(--boms-space-4);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-brand__mark,
  .auth-brand__mark :deep(.q-icon),
  .auth-hero__hive {
    transform: none;
  }
}
</style>
