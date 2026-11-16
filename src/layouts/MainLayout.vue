<template>
  <q-layout
    view="hHh Lpr lFf"
    class="shell-layout"
    :class="{ 'shell-layout--bottom-nav': showBottomNav }"
  >
    <q-header class="shell-header">
      <q-toolbar class="q-px-md q-py-sm q-px-lg-md">
        <q-btn
          flat
          dense
          round
          icon="menu"
          color="brown-10"
          aria-label="Toggle navigation"
          :aria-expanded="leftDrawerOpen ? 'true' : 'false'"
          @click="toggleLeftDrawer"
        />

        <div class="brand-lockup">
          <img :src="logoUrl" class="brand-badge" alt="Beecone Honey" />
          <div>
            <div class="brand-kicker">Beecone Honey</div>
            <div class="brand-title">Operations Management System</div>
          </div>
        </div>

        <div class="route-context gt-sm">
          <div class="route-context__eyebrow">Traceability first</div>
          <div class="route-context__title">{{ pageTitle }}</div>
        </div>

        <q-space />

        <div class="topbar-user gt-sm">
          <q-chip
            square
            color="amber-2"
            text-color="brown-10"
            icon="verified_user"
          >
            {{ roleLabel }}
          </q-chip>

          <div class="topbar-user__meta gt-xs">
            <div class="topbar-user__name">{{ userName }}</div>
            <div class="topbar-user__email">{{ authState.user?.email }}</div>
          </div>

          <q-btn
            flat
            color="primary"
            no-caps
            :loading="isSigningOut"
            label="Sign out"
            @click="handleSignOut"
          />
        </div>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      :behavior="isCompact ? 'mobile' : 'desktop'"
      show-if-above
      bordered
      :width="280"
      class="shell-drawer"
    >
      <div class="drawer-summary">
        <div class="drawer-summary__label">Signed in as</div>
        <div class="drawer-summary__name">{{ userName }}</div>
        <div class="drawer-summary__email">{{ authState.user?.email }}</div>
        <q-chip
          square
          dense
          color="amber-2"
          text-color="brown-10"
          icon="verified_user"
          class="q-ml-none q-mt-sm"
        >
          {{ roleLabel }}
        </q-chip>
      </div>

      <nav aria-label="All destinations">
        <q-list
          v-for="section in drawerSections"
          :key="section.key"
          padding
          class="drawer-nav"
          :data-section="section.key"
        >
          <q-item-label header class="drawer-nav__header">
            {{ section.label }}
          </q-item-label>

          <q-item
            v-for="item in section.items"
            :key="item.name"
            clickable
            :to="item.path"
            exact
            class="drawer-link"
            active-class="drawer-link--active"
            :data-destination="item.name"
            @click="closeDrawerIfOverlay"
          >
            <q-item-section avatar>
              <q-icon :name="item.icon" />
            </q-item-section>

            <q-item-section>
              <q-item-label>{{ item.label }}</q-item-label>
              <q-item-label caption>{{ item.caption }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </nav>
      <q-btn
        flat
        no-caps
        class="q-ma-md"
        label="Sign out"
        :loading="isSigningOut"
        @click="handleSignOut"
      />

      <div class="drawer-footer q-pa-md">
        <q-banner
          v-if="!authState.role"
          class="bg-amber-1 text-dark rounded-borders"
        >
          This account is authenticated, but it still needs a BOMS role
          assignment before restricted routes unlock.
        </q-banner>
      </div>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer v-if="showBottomNav" bordered class="shell-bottom-nav">
      <nav aria-label="Primary">
        <q-tabs
          :model-value="activeTab"
          no-caps
          align="justify"
          indicator-color="primary"
          active-color="primary"
          class="shell-bottom-nav__tabs"
          @update:model-value="ignoreTabModel"
        >
          <template v-for="item in bottomItems" :key="item.name">
            <q-tab
              v-if="item.more"
              :name="item.name"
              :icon="item.icon"
              :label="item.label"
              aria-haspopup="true"
              :aria-expanded="leftDrawerOpen ? 'true' : 'false'"
              data-destination="more"
              class="shell-bottom-nav__tab"
              @click="leftDrawerOpen = true"
            />
            <q-route-tab
              v-else
              :name="item.name"
              :to="item.path"
              exact
              :icon="item.icon"
              :label="item.label"
              :aria-current="activeTab === item.name ? 'page' : undefined"
              :data-destination="item.name"
              class="shell-bottom-nav__tab"
            />
          </template>
        </q-tabs>
      </nav>
    </q-footer>
  </q-layout>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { getRoleLabel } from '@/constants/roles'
import { primaryDestinations, routesForRole } from '@/constants/capabilities'
import { authState, signOut } from '@/services/auth'
import logoUrl from '@/assets/logo.png'

// Below Quasar's md breakpoint (1024px) the drawer is an overlay and the
// bottom navigation carries the primary destinations; at 1024px and above the
// drawer is persistent and the bottom navigation is hidden. Both are driven by
// the same signal so there is no width where neither is available.
const COMPACT_BELOW = 1024

const $q = useQuasar()
const leftDrawerOpen = ref(false)
const isSigningOut = ref(false)
const route = useRoute()
const router = useRouter()

const isCompact = computed(() => $q.screen.width < COMPACT_BELOW)
const destinations = computed(() => routesForRole(authState.role))
const drawerSections = computed(() =>
  [
    {
      key: 'primary',
      label: 'Workspaces',
      items: destinations.value.filter(item => item.group === 'primary')
    },
    {
      key: 'settings',
      label: 'Settings',
      items: destinations.value.filter(item => item.group === 'settings')
    }
  ].filter(section => section.items.length > 0)
)
const bottomItems = computed(() => primaryDestinations(authState.role))
const showBottomNav = computed(
  () => isCompact.value && bottomItems.value.length > 0
)
const activeTab = computed(() =>
  bottomItems.value.some(item => item.name === route.name) ? route.name : null
)
const pageTitle = computed(() => route.meta.title ?? 'Dashboard')
const userName = computed(() => {
  const fullName =
    authState.profile?.full_name?.trim() ??
    authState.user?.user_metadata?.full_name?.trim()

  if (fullName) {
    return fullName
  }

  return authState.user?.email?.split('@')[0] ?? 'Beecone teammate'
})
const roleLabel = computed(() => getRoleLabel(authState.role))

// Browser back/forward and bottom-nav taps must not leave an overlay drawer
// open over the new page.
watch(
  () => route.fullPath,
  () => closeDrawerIfOverlay()
)

function closeDrawerIfOverlay() {
  if (isCompact.value) leftDrawerOpen.value = false
}

// Route tabs follow the router; the "More" tab only opens the drawer.
function ignoreTabModel() {}

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

async function handleSignOut() {
  isSigningOut.value = true

  try {
    await signOut()
    await router.replace('/auth')
  } finally {
    isSigningOut.value = false
  }
}
</script>

<style lang="scss">
// Shell-owned chrome for the bottom navigation (kept out of app.scss).
// Unscoped because QFooter/QTabs render nested markup.
.shell-bottom-nav {
  background: var(--boms-color-chrome);
  border-top: 1px solid var(--boms-color-border);
  color: var(--boms-color-text-muted);
  // Keep tabs clear of the home indicator / gesture area and side cutouts.
  padding-bottom: env(safe-area-inset-bottom, 0px);
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}

.shell-bottom-nav__tabs .q-tabs__content {
  min-height: 56px;
}

.shell-bottom-nav__tab {
  min-height: 56px;
  min-width: 48px;
  padding: 4px;
  flex: 1 1 0;

  .q-tab__label {
    font-size: 0.75rem;
    line-height: 1.2;
    white-space: nowrap;
  }

  .q-tab__icon {
    font-size: 22px;
  }
}
</style>
