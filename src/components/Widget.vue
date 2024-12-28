<template>
  <div class="widget" v-loading="subjectIdsLoading" element-loading-text="Loading REVA subject ids...">
    <div class="subject-selector">
      <span>
        Selected Subject: 
      </span>
      <el-select
        v-model="subjectId"
        placeholder="Select Subject Id"
        size="large"
        style="width: 240px"
        :disabled="subjectId != '' && (coordFilesLoading || microCtFilesLoading)"
      >
        <el-option
          v-for="item in subjectIds"
          :key="item"
          :label="item"
          :value="item"
        />
      </el-select>
    </div>
    <template v-if="error == null">
      <div v-if="coordFilesLoading && subjectId != ''" class="vagus-viewer" v-loading="coordFilesLoading" element-loading-text="Loading 3D vagus tracing files..." />
      <VagusTracingViewer v-else class="vagus-viewer" :coord-files=vagusCoordFiles />
      <div v-if="microCtFilesLoading && subjectId != ''" class="file-selector" v-loading="microCtFilesLoading" element-loading-text="Loading subject files..." />
      <FileSelector v-else class="file-selector" :files=vagusMicroCtFiles />
    </template>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import VagusTracingViewer from './VagusTracingViewer.vue'
import FileSelector from './FileSelector.vue'
import { ElMessage } from 'element-plus'

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

watch(error, (newValue) => {
  if (newValue == null) { return }
  ElMessage({
    showClose: true,
    message: newValue,
    type: 'error',
    duration: 0
  })
})

watch(subjectId, async (newValue) => {
  if (newValue == '') { return }
  coordFilesLoading.value = true
  microCtFilesLoading.value = true
  error.value = null
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
  display: flex;
  flex: 0 0 80%;
  max-width: 80%;
}
.file-selector {
  flex: 0 0 20%;
  overflow-y: auto;
}
</style>