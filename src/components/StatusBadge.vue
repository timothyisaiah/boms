<template>
  <span :class="statusChipClass(tone)"
    ><slot>{{ label }}</slot></span
  >
</template>

<script setup>
import { statusChipClass } from '@/lib/status'

defineProps({
  /** neutral | success | info | warning | danger; anything else is neutral. */
  tone: { type: String, default: 'neutral' },
  /** State or noun ("Payment due"), never a verb. The default slot overrides. */
  label: { type: String, default: '' }
})
</script>
