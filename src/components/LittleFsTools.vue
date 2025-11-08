<template>
  <div class="littlefs-manager">
    <v-card class="littlefs-card" variant="tonal">
      <v-card-title class="d-flex align-center gap-2">
        <v-icon size="18">mdi-alpha-l-box-outline</v-icon>
        LittleFS Tools
        <v-chip v-if="state.ready" size="x-small" color="success" variant="tonal">Ready</v-chip>
      </v-card-title>
      <v-card-text class="littlefs-card__body">
        <div class="littlefs-card__controls">
          <v-text-field v-model.number="state.blockSize" label="Block size" type="number" density="comfortable"
            variant="outlined" :disabled="state.loading" min="128" step="128" />
          <v-text-field v-model.number="state.blockCount" label="Block count" type="number" density="comfortable"
            variant="outlined" :disabled="state.loading" min="16" step="16" />
          <v-spacer />
          <v-btn color="primary" :loading="state.loading && !state.ready" :disabled="state.loading"
            @click="initializeLittleFs">
            <v-icon start>mdi-power</v-icon>
            {{ state.ready ? 'Reinitialize' : 'Initialize' }}
          </v-btn>
          <v-btn color="secondary" variant="tonal" :disabled="!state.ready || state.loading" @click="formatLittleFs">
            <v-icon start>mdi-broom</v-icon>
            Format
          </v-btn>
          <v-btn color="secondary" variant="text" :disabled="!state.ready || state.loading" @click="refreshListing">
            <v-icon start>mdi-refresh</v-icon>
            Refresh
          </v-btn>
        </div>
        <v-alert v-if="state.error" type="error" variant="tonal" border="start" density="comfortable" class="mb-2">
          {{ state.error }}
        </v-alert>
        <v-alert v-else-if="state.status" type="info" variant="tonal" border="start" density="comfortable"
          class="mb-2">
          {{ state.status }}
        </v-alert>
      </v-card-text>
    </v-card>

    <v-card variant="tonal">
      <v-card-title class="d-flex align-center justify-space-between">
        <span class="text-subtitle-1">Files</span>
        <v-chip v-if="state.ready" size="small" variant="tonal">
          {{ usageSummary }}
        </v-chip>
      </v-card-title>
      <v-card-text>
        <div v-if="state.ready" class="spiffs-usage">
          <div class="spiffs-usage__labels">
            <span>Used {{ formatSize(usage.usedBytes) }} / {{ formatSize(usage.capacityBytes) }}</span>
            <span>{{ usagePercent }}%</span>
          </div>
          <v-progress-linear :model-value="usagePercent" height="8" rounded color="primary" />
          <div class="text-caption text-medium-emphasis">
            Free {{ formatSize(usage.freeBytes) }}
          </div>
        </div>

        <div class="upload-row upload-row--split">
          <div class="upload-picker">
            <v-file-input v-model="uploadFile" density="comfortable" accept="*/*" label="Select file"
              prepend-icon="mdi-file-upload" :disabled="!state.ready || state.loading" />
            <v-btn color="primary" variant="tonal" class="upload-row__cta"
              :disabled="!state.ready || state.loading || !uploadFile"
              @click="submitUpload">
              <v-icon start>mdi-upload</v-icon>
              Upload
            </v-btn>
          </div>
          <div class="spiffs-dropzone" :class="{ 'spiffs-dropzone--active': dragActive }" @dragover.prevent="handleDragOver"
            @dragleave.prevent="handleDragLeave" @drop.prevent="handleDrop">
            <div class="spiffs-dropzone__hint">
              <v-icon size="32">mdi-cloud-upload-outline</v-icon>
              <div class="spiffs-dropzone__hint-text">
                <strong>Drop file to upload</strong>
                <span>Auto uploads on drop</span>
              </div>
            </div>
          </div>
        </div>

        <v-alert v-if="!filteredFiles.length && !state.loading" type="info" variant="tonal"
          density="comfortable" border="start" class="mt-4">
          No files detected. Upload to begin.
        </v-alert>
        <template v-else>
          <div class="spiffs-table__toolbar mt-4">
            <v-text-field v-model="fileSearch" label="Filter files" variant="outlined" density="comfortable" clearable
              hide-details prepend-inner-icon="mdi-magnify" class="spiffs-table__filter spiffs-table__filter--search" />
            <v-select v-model="fileTypeFilter" :items="fileFilterOptions" item-title="label" item-value="value"
              label="File type" density="comfortable" hide-details variant="outlined"
              class="spiffs-table__filter spiffs-table__filter--type" />
            <v-chip size="small" variant="tonal" color="primary">
              {{ filteredCountLabel }}
            </v-chip>
          </div>
          <v-data-table :headers="fileTableHeaders" :items="filteredFiles" item-key="path"
            :items-per-page="-1" hide-default-footer density="comfortable" class="spiffs-table mt-4">
            <template #item.path="{ item }">
              <code>{{ item.raw.path }}</code>
            </template>
            <template #item.size="{ item }">
              {{ formatSize(item.raw.size) }}
            </template>
            <template #item.actions="{ item }">
              <v-btn size="small" variant="text" color="error"
                :disabled="!state.ready || state.loading"
                @click="deleteFile(item.raw.path)">
                <v-icon start size="16">mdi-delete</v-icon>
                Delete
              </v-btn>
            </template>
          </v-data-table>
        </template>
      </v-card-text>
    </v-card>

    <input ref="hiddenFileInput" type="file" class="d-none" />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';

type LittleFSFileEntry = { path: string; size: number };
type LittleFS = {
  format(): void;
  list(): LittleFSFileEntry[];
  addFile(path: string, data: Uint8Array | ArrayBuffer | string): void;
  deleteFile(path: string): void;
};

const LITTLEFS_MODULE_PATH = '/wasm/littlefs/index.js';
const DEFAULT_BLOCK_SIZE = 512;
const DEFAULT_BLOCK_COUNT = 512;
const FALLBACK_TEXT_EXT = ['txt', 'log', 'json', 'csv', 'ini', 'cfg', 'conf', 'htm', 'html', 'md', 'xml'];
const FALLBACK_IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'];
const FALLBACK_AUDIO_EXT = ['mp3', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'flac', 'weba', 'webm'];
const FILE_CATEGORY_LABELS: Record<string, string> = {
  all: 'All types',
  text: 'Text',
  image: 'Images',
  audio: 'Audio',
  other: 'Other',
};

const state = reactive({
  ready: false,
  loading: false,
  status: '',
  error: '',
  fs: null as LittleFS | null,
  files: [] as LittleFSFileEntry[],
  blockSize: DEFAULT_BLOCK_SIZE,
  blockCount: DEFAULT_BLOCK_COUNT,
});

const uploadFile = ref<File | null>(null);
const dragActive = ref(false);
const fileSearch = ref('');
const fileTypeFilter = ref('all');
const hiddenFileInput = ref<HTMLInputElement | null>(null);

const usage = computed(() => {
  const capacityBytes = state.blockSize * state.blockCount;
  const usedBytes = state.files.reduce((sum, file) => sum + file.size, 0);
  const freeBytes = Math.max(capacityBytes - usedBytes, 0);
  return { capacityBytes, usedBytes, freeBytes };
});

const usagePercent = computed(() => {
  if (!usage.value.capacityBytes) return 0;
  const ratio = usage.value.usedBytes / usage.value.capacityBytes;
  if (!Number.isFinite(ratio) || ratio < 0) return 0;
  return Math.min(100, Math.round(ratio * 100));
});

const usageSummary = computed(() => {
  if (!usage.value.capacityBytes) return 'Unavailable';
  return `${formatSize(usage.value.usedBytes)} of ${formatSize(usage.value.capacityBytes)}`;
});

const fileFilterOptions = computed(() => {
  const counts = state.files.reduce<Record<string, number>>((acc, file) => {
    const category = getFileCategory(file.path);
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  const options = [
    { value: 'all', label: `${FILE_CATEGORY_LABELS.all} (${state.files.length})` },
  ];
  for (const [key, label] of Object.entries(FILE_CATEGORY_LABELS)) {
    if (key === 'all') continue;
    if (counts[key]) {
      options.push({ value: key, label: `${label} (${counts[key]})` });
    }
  }
  return options;
});

const filteredFiles = computed(() => {
  const query = (fileSearch.value || '').trim().toLowerCase();
  const typeFilter = fileTypeFilter.value;
  return state.files.filter(file => {
    if (typeFilter !== 'all' && getFileCategory(file.path) !== typeFilter) {
      return false;
    }
    if (!query) {
      return true;
    }
    return file.path.toLowerCase().includes(query);
  });
});

const filteredCountLabel = computed(() => {
  const total = state.files.length;
  const filtered = filteredFiles.value.length;
  const pluralize = (count: number) => (count === 1 ? 'file' : 'files');
  if (!total) {
    return 'No files';
  }
  if (filtered === total) {
    return `${total} ${pluralize(total)}`;
  }
  return `${filtered} of ${total} files`;
});

const fileTableHeaders = Object.freeze([
  { title: 'Name', key: 'path', sortable: true, align: 'start' },
  { title: 'Size', key: 'size', sortable: true, align: 'start' },
  { title: 'Actions', key: 'actions', sortable: false, align: 'start' },
]);

watch([fileSearch, () => state.files.length], () => {
  if (!fileFilterOptions.value.some(option => option.value === fileTypeFilter.value)) {
    fileTypeFilter.value = 'all';
  }
});

async function loadFactory() {
  const resolvedUrl = new URL(LITTLEFS_MODULE_PATH, window.location.origin).toString();
  const module = (await import(
    /* @vite-ignore */ resolvedUrl
  )) as typeof import('/wasm/littlefs/index.js');
  return module.createLittleFS || module.default;
}

async function initializeLittleFs() {
  if (state.loading) return;
  state.loading = true;
  state.error = '';
  state.status = 'Loading WASM module...';
  console.time('littlefs-init');
  try {
    const factory = await loadFactory();
    state.status = 'Mounting filesystem...';
    state.fs = await factory({
      formatOnInit: true,
      blockSize: state.blockSize,
      blockCount: state.blockCount,
    });
    console.timeEnd('littlefs-init');
    state.ready = true;
    state.status = 'LittleFS is ready.';
    await refreshListing();
  } catch (error) {
    console.timeEnd('littlefs-init');
    console.error('LittleFS init failed', error);
    state.error =
      error?.message || 'Failed to load the LittleFS module. Confirm the WASM files exist under /public/wasm.';
    state.ready = false;
    state.fs = null;
  } finally {
    state.loading = false;
  }
}

async function formatLittleFs() {
  if (!state.fs || state.loading) return;
  try {
    state.loading = true;
    state.fs.format();
    state.status = 'Filesystem formatted.';
    await refreshListing();
  } catch (error) {
    state.error = error?.message || 'Format failed.';
  } finally {
    state.loading = false;
  }
}

async function refreshListing() {
  if (!state.fs || state.loading) return;
  try {
    const entries = state.fs.list();
    state.files = Array.isArray(entries) ? entries : [];
  } catch (error) {
    state.error = error?.message || 'Failed to list files.';
  }
}

async function submitUpload() {
  if (!uploadFile.value || !state.fs) {
    return;
  }
  await addFile(uploadFile.value);
  uploadFile.value = null;
}

async function addFile(file: File) {
  if (!state.fs || state.loading) return;
  const path = file.name.trim();
  if (!path) {
    state.status = 'File name cannot be empty.';
    return;
  }
  try {
    state.loading = true;
    const data = new Uint8Array(await file.arrayBuffer());
    state.fs.addFile(path, data);
    state.status = `Stored "${path}" in LittleFS.`;
    await refreshListing();
  } catch (error) {
    state.error = error?.message || 'Add file failed.';
  } finally {
    state.loading = false;
  }
}

async function deleteFile(path: string) {
  if (!state.fs || state.loading) return;
  try {
    state.loading = true;
    state.fs.deleteFile(path);
    state.status = `Deleted "${path}".`;
    await refreshListing();
  } catch (error) {
    state.error = error?.message || 'Delete failed.';
  } finally {
    state.loading = false;
  }
}

function handleDragOver(event: DragEvent) {
  if (!state.ready || state.loading) {
    event.dataTransfer!.dropEffect = 'none';
    dragActive.value = false;
    return;
  }
  event.dataTransfer!.dropEffect = 'copy';
  dragActive.value = true;
}

function handleDragLeave(event: DragEvent) {
  if (event.currentTarget && event.relatedTarget && (event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) {
    return;
  }
  dragActive.value = false;
}

function handleDrop(event: DragEvent) {
  dragActive.value = false;
  if (!state.ready || state.loading) return;
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  addFile(file);
}

function getFileCategory(name = '') {
  const ext = normalizeExtension(name);
  if (FALLBACK_TEXT_EXT.includes(ext)) return 'text';
  if (FALLBACK_IMAGE_EXT.includes(ext)) return 'image';
  if (FALLBACK_AUDIO_EXT.includes(ext)) return 'audio';
  return 'other';
}

function normalizeExtension(name = '') {
  const idx = name.lastIndexOf('.');
  if (idx === -1) return '';
  return name.slice(idx + 1).toLowerCase();
}

function formatSize(size: number) {
  if (!Number.isFinite(size)) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}
</script>

<style scoped>
.littlefs-manager {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.littlefs-card {
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--v-theme-primary) 18%, transparent);
  background: color-mix(in srgb, var(--v-theme-surface) 96%, transparent);
}

.littlefs-card__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.littlefs-card__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.upload-row {
  display: grid;
  gap: 12px;
}

.upload-row--split {
  align-items: stretch;
}

.upload-picker {
  display: grid;
  gap: 12px;
}

@media (min-width: 960px) {
  .upload-row {
    grid-template-columns: 1fr auto;
    align-items: end;
  }

  .upload-row--split {
    grid-template-columns: 1fr 1fr;
  }
  .upload-row__cta {
    align-self: center;
  }
}

.spiffs-usage {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.spiffs-usage__labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.7;
}

.spiffs-table__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.spiffs-table__filter {
  flex: 1;
  max-width: 360px;
}

.spiffs-table__filter--type {
  flex: 0 0 auto;
  min-width: 180px;
  max-width: 220px;
}

.spiffs-dropzone {
  position: relative;
  border: 2px dashed transparent;
  border-radius: 12px;
  transition: border-color 0.2s ease, background-color 0.2s ease;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spiffs-dropzone--active {
  border-color: color-mix(in srgb, var(--v-theme-primary) 60%, transparent);
  background-color: color-mix(in srgb, var(--v-theme-primary) 10%, transparent);
}

.spiffs-dropzone__hint {
  display: flex;
  align-items: center;
  gap: 12px;
  color: color-mix(in srgb, var(--v-theme-on-surface) 80%, transparent);
}

.spiffs-dropzone__hint-text {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
  text-transform: none;
}

.spiffs-table code {
  font-size: 0.85rem;
}
</style>
