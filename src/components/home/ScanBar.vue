<template>
  <div class="scan-bar">
    <q-btn
      unelevated
      no-caps
      color="secondary"
      icon="qr_code_scanner"
      label="Scan jars"
      class="scan-bar__camera"
      data-scan-camera
      @click="openCamera"
    />
    <div class="scan-bar__manual">
      <q-input
        v-model="manual"
        dense
        outlined
        inputmode="numeric"
        autocomplete="off"
        placeholder="Barcode"
        aria-label="Type or scan a barcode"
        class="scan-bar__input"
        data-scan-input
        hide-bottom-space
        @keydown.enter.prevent="submitManual"
      >
        <template #append>
          <q-btn
            flat
            dense
            round
            icon="keyboard_return"
            aria-label="Add scanned jar"
            @click="submitManual"
          />
        </template>
      </q-input>
    </div>
    <p
      v-if="feedback"
      class="scan-bar__feedback"
      :class="`scan-bar__feedback--${feedback.tone}`"
      role="status"
    >
      {{ feedback.text }}
    </p>

    <q-dialog v-model="cameraOpen" maximized @hide="stopCamera">
      <div class="scan-camera">
        <video ref="video" class="scan-camera__video" playsinline muted />
        <div class="scan-camera__frame" aria-hidden="true" />
        <div class="scan-camera__panel">
          <p class="scan-camera__status" role="status">
            {{ cameraMessage }}
          </p>
          <p v-if="feedback" class="scan-camera__last">{{ feedback.text }}</p>
          <q-btn
            unelevated
            no-caps
            size="lg"
            color="primary"
            label="Finish scanning"
            class="scan-camera__finish"
            @click="cameraOpen = false"
          />
        </div>
      </div>
    </q-dialog>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

defineProps({
  /** Latest outcome from the parent: `{ text, tone: 'success'|'warning' }`. */
  feedback: { type: Object, default: null }
})
const emit = defineEmits(['scan'])

const manual = ref('')
const cameraOpen = ref(false)
const cameraMessage = ref('')
const video = ref(null)
let stream = null
let detector = null
let frame = 0
let lastCode = ''
let lastAt = 0

function report(code) {
  const value = String(code ?? '').trim()
  if (!value) return
  // The same jar held in front of the camera must count once.
  const now = Date.now()
  if (value === lastCode && now - lastAt < 1500) return
  lastCode = value
  lastAt = now
  navigator.vibrate?.(40)
  emit('scan', value)
}

function submitManual() {
  report(manual.value)
  lastCode = ''
  manual.value = ''
}

async function openCamera() {
  cameraOpen.value = true
  cameraMessage.value = 'Starting camera…'
  await nextTick()
  if (!('BarcodeDetector' in window)) {
    cameraMessage.value =
      'This browser cannot read barcodes with the camera. Use Chrome on Android, a handheld scanner, or type the number.'
    return
  }
  try {
    detector = new window.BarcodeDetector({
      formats: [
        'ean_13',
        'ean_8',
        'upc_a',
        'upc_e',
        'code_128',
        'code_39',
        'qr_code'
      ]
    })
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false
    })
    video.value.srcObject = stream
    await video.value.play()
    cameraMessage.value =
      'Point the camera at a jar barcode. Each jar counts once.'
    loop()
  } catch {
    cameraMessage.value =
      'The camera could not start. Allow camera access, or type the barcode.'
  }
}

async function loop() {
  if (!cameraOpen.value || !detector || !video.value) return
  try {
    const codes = await detector.detect(video.value)
    if (codes.length) report(codes[0].rawValue)
  } catch {
    /* A frame that cannot be read is skipped. */
  }
  frame = requestAnimationFrame(() => setTimeout(loop, 150))
}

function stopCamera() {
  cancelAnimationFrame(frame)
  stream?.getTracks().forEach(track => track.stop())
  stream = null
}

// Handheld USB/Bluetooth scanners type the code quickly and press Enter.
// Capture that burst anywhere on the page except in other text fields.
let buffer = ''
let bufferAt = 0
function onKeydown(event) {
  const target = event.target
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
    return
  const now = Date.now()
  if (now - bufferAt > 80) buffer = ''
  bufferAt = now
  if (event.key === 'Enter') {
    if (buffer.length >= 4) {
      event.preventDefault()
      report(buffer)
    }
    buffer = ''
  } else if (event.key.length === 1) buffer += event.key
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  stopCamera()
})
</script>

<style scoped>
.scan-bar {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--boms-space-2);
  align-items: center;
}
.scan-bar__camera {
  min-height: 44px;
}
.scan-bar__feedback {
  grid-column: 1 / -1;
  margin: 0;
  font-size: var(--boms-font-size-label);
  font-weight: 700;
}
.scan-bar__feedback--success {
  color: var(--boms-color-success-text);
}
.scan-bar__feedback--warning {
  color: var(--boms-color-danger-text);
}
.scan-camera {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: var(--boms-ink);
}
.scan-camera__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.scan-camera__frame {
  position: absolute;
  inset: 30% 12%;
  border: 3px solid var(--boms-honey);
  border-radius: var(--boms-radius-md);
}
.scan-camera__panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-2);
  padding: var(--boms-space-4);
  padding-bottom: calc(var(--boms-space-4) + var(--boms-safe-bottom));
  background: var(--boms-color-surface);
}
.scan-camera__status,
.scan-camera__last {
  margin: 0;
}
.scan-camera__last {
  font-weight: 800;
  color: var(--boms-color-success-text);
}
.scan-camera__finish {
  min-height: 52px;
}
</style>
