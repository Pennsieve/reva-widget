<template>
  <div v-if="error">
    There was an error loading the vagus tracing files
  </div>
  <div class="widget" v-else v-loading="subjectIdsLoading" element-loading-text="Loading REVA subject ids...">
    <div class="subject-selector">
      <span>
        Selected Subject: 
      </span>
      <el-select
        v-model="subjectId"
        placeholder="Select Subject Id"
        size="large"
        style="width: 240px"
      >
        <el-option
          v-for="item in subjectIds"
          :key="item"
          :label="item"
          :value="item"
        />
      </el-select>
    </div>
    <VagusTracingViewer v-if="!coordFilesLoading" class="vagus-viewer" :coord-files=vagusCoordFiles />
    <FileSelector v-if="!microCtFilesLoading" class="file-selector" :files=vagusMicroCtFiles />
  </div>
</template>
<script setup>
import { ref, watch } from "vue";
import VagusTracingViewer from './VagusTracingViewer.vue'
import FileSelector from './FileSelector.vue'

const subjectId = ref('')
const subjectIds = ref([])
const vagusCoordFiles = ref([])
const vagusMicroCtFiles = ref([])
const subjectIdsLoading = ref(true)
const coordFilesLoading = ref(true)
const microCtFilesLoading = ref(true)
const error = ref(null)

try {
  subjectIds.value = await fetchSubjectIds()
} catch (err) {
  error.value = "Failed to fetch subject ids: " + err.message;
} finally {
  subjectIdsLoading.value = false
}

watch(subjectId, async (newValue) => {
  if (newValue == '') { return }
  coordFilesLoading.value = true
  microCtFilesLoading.value = true
  try {
    vagusCoordFiles.value = await fetchCoordFiles(newValue)
  } catch (err) {
    error.value = `Failed to fetch vagus coordinate files for subject with id ${newValue}: ` + err.message;
  } finally {
    coordFilesLoading.value = false
  }
  try {
    vagusMicroCtFiles.value = await fetchMicroCtFiles(newValue)
  } catch (err) {
    error.value = `Failed to fetch Micro CT files for subject with id ${newValue}: ` + err.message;
  } finally {
    microCtFilesLoading.value = false
  }
})

async function fetchSubjectIds() {
  try {
    const response = await fetch(`${import.meta.env.VITE_SPARC_API}/reva/subject-ids`)
    if (!response.ok) {
      throw new Error(`Error fetching subject ids! Status: ${response.status}`)
    }
    const data = await response.json()
    return data['ids']
  } catch (error) {
    throw new Error(`Error fetching subject ids!: ${error}`);
  }
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

async function fetchMicroCtFiles(subjectId) {
  try {
    const response = await fetch(`${import.meta.env.VITE_SPARC_API}/reva/micro-ct-files/${subjectId}`)
    if (!response.ok) {
      throw new Error(`Error fetching Micro CT files! Status: ${response.status}`)
    }
    const data = await response.json()
    return data['files']
  } catch (error) {
    throw new Error(`Error fetching Micro CT files!: ${error}`);
  }
}
</script>
<style scoped>
.widget {
  height: 100%;
  width: 100%;
  overflow: auto;
  display: flex;
}
.subject-selector {
  position: absolute;
  top: 1rem;
  left: 1rem;
  color: white;
}
.vagus-viewer {
  flex: 0 0 80%;
}
.file-selector {
  flex: 0 0 20%;
  overflow-y: auto;
}
</style>