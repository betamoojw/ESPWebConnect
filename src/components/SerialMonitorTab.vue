<template>
  <div class="monitor-shell">
    <v-card class="monitor-panel" variant="flat">
      <v-card-title class="monitor-toolbar">
        <div class="monitor-toolbar__meta">
          <v-icon class="monitor-toolbar__icon" size="20">
            {{ monitorActive ? 'mdi-monitor-eye' : 'mdi-monitor-off' }}
          </v-icon>
          <span class="monitor-toolbar__title">Serial Monitor</span>
          <span class="monitor-toolbar__status" :class="{ 'monitor-toolbar__status--live': monitorActive }">
            {{ monitorActive ? 'Live stream' : 'Paused' }}
          </span>
        </div>
        <div class="monitor-toolbar__actions">
          <v-btn
            color="primary"
            variant="tonal"
            density="comfortable"
            prepend-icon="mdi-play-circle"
            :disabled="monitorActive || !canStart"
            @click="emit('start-monitor')"
          >
            Start
          </v-btn>
          <v-btn
            color="primary"
            variant="text"
            density="comfortable"
            prepend-icon="mdi-stop-circle"
            :disabled="!monitorActive"
            @click="emit('stop-monitor')"
          >
            Stop
          </v-btn>
          <v-btn
            color="surface"
            variant="text"
            density="comfortable"
            prepend-icon="mdi-eraser"
            :disabled="!monitorText"
            @click="emit('clear-monitor')"
          >
            Clear
          </v-btn>
          <v-btn
            color="error"
            variant="tonal"
            density="comfortable"
            prepend-icon="mdi-power-cycle"
            :disabled="!canCommand"
            @click="emit('reset-board')"
          >
            Reset
          </v-btn>
        </div>
      </v-card-title>

      <v-divider class="monitor-divider" />

      <v-card-text class="monitor-output-wrapper">
        <div class="monitor-output-surface">
          <div class="monitor-output__header">
            <span class="monitor-output__label">
              <v-icon size="16" class="me-2">mdi-console</v-icon>
              Console Stream
            </span>
            <v-chip
              class="monitor-output__chip"
              :color="monitorActive ? 'success' : 'grey-darken-1'"
              density="comfortable"
              size="small"
              label
            >
              <v-icon size="16" start>mdi-circle-medium</v-icon>
              {{ monitorActive ? 'Streaming' : 'Idle' }}
            </v-chip>
          </div>
          <pre ref="outputEl" class="monitor-output">
{{ monitorText || 'Serial data will appear here once the monitor is started.' }}
          </pre>
        </div>
      </v-card-text>
    </v-card>

    <v-alert
      v-if="monitorError"
      type="warning"
      variant="tonal"
      class="monitor-alert"
      icon="mdi-alert-circle-outline"
    >
      {{ monitorError }}
    </v-alert>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  monitorText: {
    type: String,
    default: '',
  },
  monitorActive: {
    type: Boolean,
    default: false,
  },
  monitorError: {
    type: String,
    default: null,
  },
  canStart: {
    type: Boolean,
    default: false,
  },
  canCommand: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['start-monitor', 'stop-monitor', 'clear-monitor', 'reset-board']);

const outputEl = ref(null);

watch(
  () => props.monitorText,
  () => {
    if (outputEl.value) {
      outputEl.value.scrollTop = outputEl.value.scrollHeight;
    }
  }
);
</script>

<style scoped>
.monitor-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.monitor-panel {
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--v-theme-primary) 16%, transparent);
  background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--v-theme-surface) 96%, transparent) 0%,
      color-mix(in srgb, var(--v-theme-primary) 10%, transparent) 60%,
      color-mix(in srgb, var(--v-theme-secondary) 12%, transparent) 100%
    ),
    linear-gradient(145deg, rgba(255, 255, 255, 0.04), transparent);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}

.monitor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  padding: 20px clamp(16px, 4vw, 26px);
}

.monitor-toolbar__meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.monitor-toolbar__icon {
  color: color-mix(in srgb, var(--v-theme-primary) 82%, transparent);
}

.monitor-toolbar__title {
  font-size: 1.05rem;
  font-weight: 650;
  letter-spacing: 0.01em;
  color: color-mix(in srgb, var(--v-theme-on-surface) 95%, transparent);
}

.monitor-toolbar__status {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: color-mix(in srgb, var(--v-theme-on-surface) 55%, transparent);
}

.monitor-toolbar__status--live {
  color: color-mix(in srgb, var(--v-theme-success) 70%, var(--v-theme-on-surface) 30%);
}

.monitor-toolbar__actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.monitor-divider {
  opacity: 0.28;
}

.monitor-output-wrapper {
  padding: 0 clamp(16px, 3.4vw, 26px) clamp(18px, 4vw, 32px);
}

.monitor-output-surface {
  border-radius: 18px;
  padding: 18px 20px;
  background: radial-gradient(
      circle at 20% 20%,
      color-mix(in srgb, var(--v-theme-primary) 22%, transparent) 0%,
      transparent 65%
    ),
    radial-gradient(
      circle at 80% 25%,
      color-mix(in srgb, var(--v-theme-secondary) 18%, transparent) 0%,
      transparent 60%
    ),
    color-mix(in srgb, var(--v-theme-surface) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--v-theme-primary) 20%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
  position: relative;
}

.monitor-output__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.monitor-output__label {
  display: inline-flex;
  align-items: center;
  font-weight: 600;
  font-size: 0.88rem;
  color: color-mix(in srgb, var(--v-theme-on-surface) 85%, transparent);
  letter-spacing: 0.015em;
}

.monitor-output__chip {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}

.monitor-output {
  margin: 0;
  padding: 16px 0 12px;
  min-height: 260px;
  max-height: 540px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Fira Code', 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 0.9rem;
  line-height: 1.48;
  color: color-mix(in srgb, var(--v-theme-on-surface) 94%, transparent);
}

.monitor-output::-webkit-scrollbar {
  width: 8px;
}

.monitor-output::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--v-theme-primary) 40%, transparent);
  border-radius: 999px;
}

.monitor-alert {
  margin-top: 6px;
}

@media (max-width: 959px) {
  .monitor-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .monitor-toolbar__actions {
    width: 100%;
    justify-content: flex-start;
    gap: 8px;
  }

  .monitor-output-wrapper {
    padding-inline: clamp(12px, 3vw, 20px);
  }
}
</style>
