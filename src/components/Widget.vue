<template>
  <div v-if="error">
    There was an error loading the vagus tracing files
  </div>
  <div class="widget" v-else-if="!loading">
    <VagusTracingViewer class="vagus-viewer" :coord-files=vagusCoordFiles />
  </div>
</template>
<script setup>
import { ref } from "vue";
import VagusTracingViewer from './VagusTracingViewer.vue'

const subjectId = 'sub-SR005'
const vagusCoordFiles = ref([])
const loading = ref(true)
const error = ref(null)

try {
  vagusCoordFiles.value = await fetchCoordFiles(subjectId)
} catch (err) {
  error.value = "Failed to fetch vagus coordinate files: " + err.message;
} finally {
  loading.value = false
}

async function fetchCoordFiles(subjectId) {
  try {
    const response = await fetch(`${import.meta.env.VITE_SPARC_API}/reva/tracing-files/${subjectId}`)
    if (!response.ok) {
      throw new Error(`Error fetching 3D tracing files! Status: ${response.status}`)
    }
    const data = await response.json()
    return data['files']
  } catch (error) {
    throw new Error(`Error fetching 3D tracing files!: ${error}`);
  }
}
</script>
<style scoped>
.widget {
  height: 100%;
  width: 100%;
  overflow: auto;
}

</style>