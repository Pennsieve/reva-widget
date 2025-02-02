<template>
  <div class="widget" v-loading="subjectIdsLoading" element-loading-text="Loading REVA subject ids...">
    <div class="subject-selector">
      <span>
        Selected Subject: 
      </span>
      <el-select
        class="selector"
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
    <div v-if="(coordFilesLoading || anatomicalLandmarksFoldersLoading) && subjectId != ''" class="vagus-viewer loading-overlay" v-loading="coordFilesLoading || anatomicalLandmarksFoldersLoading" element-loading-text="Loading 3D vagus tracing files..." />
    <VagusTracingViewer v-else class="vagus-viewer" :vagus-coord-files=vagusCoordFiles :anatomical-landmarks-folders="anatomicalLandmarksFolders" @segment-selected="onVagusSegmentSelected"/>
    <div v-if="microCtFilesLoading && subjectId != ''" class="file-selector loading-overlay" v-loading="microCtFilesLoading" element-loading-text="Loading subject files..." />
    <FileSelector v-else class="file-selector" :files=filteredVagusMicroCtFiles @file-selected="onFileSelected" />
    <el-dialog v-if="selectedFile" class="dialog" v-model="isDialogOpen" @close="closeDialog" :title="selectedFile.name">
      <VideoPlayer v-if="selectedFile.type === 'MP4'" :videoSrc="selectedFile.s3Url" />
      <img v-if="selectedFile.type === 'PNG'" :src="selectedFile.s3Url" style="width: 100%; height: auto;" />
    </el-dialog>
  </div>
</template>

<script setup>
import { useConfig } from '../index.js'
import { computed, ref, watch } from "vue";
import VagusTracingViewer from './VagusTracingViewer.vue'
import FileSelector from './FileSelector.vue'
import VideoPlayer from './VideoPlayer.vue'
import { ElMessage } from 'element-plus'

const subjectId = ref('')
const subjectIds = ref([])
const vagusCoordFiles = ref([])
const anatomicalLandmarksFolders = ref([])
const vagusMicroCtFiles = ref([])
const filteredVagusMicroCtFiles = ref([])
const selectedFile = ref(null)
const subjectIdsLoading = ref(true)
const coordFilesLoading = ref(true)
const anatomicalLandmarksFoldersLoading = ref(true)
const microCtFilesLoading = ref(true)
const error = ref(null)
const isDialogOpen = ref(false)
const config = useConfig()

// Attempting to map segment file names to microCt filename and account for naming inconsistencies
const SEGMENT_TO_FILE_KEYS_MAPPING = {
  'CR-': ['CR'],
  'CL-': ['CL'],
  'TR-': ['TR'],
  'TL': ['TL'],
  'E-': ['EA','EP'],
  'S-': ['SA', 'SP'],
  'EA-': ['EA'],
  'EP-': ['EP'],
  'SA-': ['SA'],
  'SP-': ['SP']
}

const viewerLoading = computed(() => coordFilesLoading.value || anatomicalLandmarksFoldersLoading.value)

watch(error, (newValue) => {
  if (newValue == null) { return }
  ElMessage({
    showClose: true,
    message: newValue,
    type: 'error',
    duration: 0
  })
})

watch(selectedFile, (newValue) => {
  if (newValue == null) { return }
  switch (newValue.type) {
    case 'MP4':
      openDialog()
      break;
    case 'PNG':
      openDialog()
      break;
    default:
      break;
  }
})

watch(subjectId, async (newValue) => {
  if (newValue == '') { return }
  coordFilesLoading.value = true
  anatomicalLandmarksFoldersLoading.value = true
  microCtFilesLoading.value = true
  error.value = null
  try {
    vagusCoordFiles.value = await fetchCoordFiles(newValue)
  } catch (err) {
    vagusCoordFiles.value = []
    error.value = err.message;
  } finally {
    coordFilesLoading.value = false
  }
  try {
    anatomicalLandmarksFolders.value = await fetchAnatomicalLandmarksFolders(newValue)
  } catch (err) {
    anatomicalLandmarksFolders.value = []
    error.value = err.message;
  } finally {
    anatomicalLandmarksFoldersLoading.value = false
  }
  try {
    vagusMicroCtFiles.value = await fetchMicroCtFiles(newValue)
    filteredVagusMicroCtFiles.value = vagusMicroCtFiles.value
  } catch (err) {
    vagusMicroCtFiles.value = []
    filteredVagusMicroCtFiles.value = []
    error.value = err.message;
  } finally {
    microCtFilesLoading.value = false
  }
})

try {
  subjectIds.value = await fetchSubjectIds()
} catch (err) {
  error.value = err.message;
} finally {
  subjectIdsLoading.value = false
}

async function fetchSubjectIds() {
  try {
    const response = await fetch(`${config.sparcApi}/reva/subject-ids`)
    const data = await response.json()
    return data['ids']
  } catch (error) {
    throw new Error(`Error fetching subject ids! ${error}`)
  }
}

async function fetchCoordFiles(subjectId) {
  try {
    const response = await fetch(`${config.sparcApi}/reva/tracing-files/${subjectId}`)
    if (!response.ok) {
      throw new Error(`Error fetching 3D tracing files for ${subjectId}! ${response.status}: ${response.statusText}`)
    }
    const data = await response.json()
    return data['files']
  } catch (error) {
    throw new Error(error.message)
  }
}

async function fetchAnatomicalLandmarksFolders(subjectId) {
  try {
    const response = await fetch(`${config.sparcApi}/reva/anatomical-landmarks-files/${subjectId}`)
    if (!response.ok) {
      throw new Error(`Error fetching Anatomical landmarks files for ${subjectId}! ${response.status}: ${response.statusText}`)
    }
    const data = await response.json()
    return data['folders']
  } catch (error) {
    throw new Error(error.message)
  }
}

async function fetchMicroCtFiles(subjectId) {
  try {
    const response = await fetch(`${config.sparcApi}/reva/micro-ct-files/${subjectId}`)
    if (!response.ok) {
      if (response.status == '404')
        throw new Error(`Failed to fetch files for ${subjectId} because they do not exist for this subject.`)
      else
        throw new Error(`Failed to fetch files for subject with id ${subjectId}! ${response.status}: ${response.statusText}`)
    }
    const data = await response.json()
    return data['files']
  } catch (error) {
    throw new Error(error.message)
  }
}

// Based off the REVA naming convention outlined in their MicroCTDataOverview.pdf
function getSegmentFileKeys(filename) {
  let foundKeys = []
  Object.keys(SEGMENT_TO_FILE_KEYS_MAPPING).forEach(segKey => {
    if (filename.includes(segKey)) {
      foundKeys.push(segKey)
    }
  })
  return foundKeys
}

function onVagusSegmentSelected(filename) {
  if (filename == null) {
    filteredVagusMicroCtFiles.value = vagusMicroCtFiles.value
  } else {
    const segmentFileKeys = getSegmentFileKeys(filename)
    let microCtKeys = []
    segmentFileKeys.forEach(segKey => {
      const segFileKeyValues = SEGMENT_TO_FILE_KEYS_MAPPING[segKey]
      segFileKeyValues.forEach(keyValue => microCtKeys.push(keyValue))
    })
    filteredVagusMicroCtFiles.value = vagusMicroCtFiles.value.filter(file => microCtKeys.some(microCtKey => file.name.includes(microCtKey)))
  }
}

function onFileSelected(file) {
  if (!file || file == {}) { return }
  selectedFile.value = file
}

function openDialog() {
  isDialogOpen.value = true
}

function closeDialog() {
  isDialogOpen.value = false
  selectedFile.value = null
}

</script>
<style scoped>
.widget {
  height: 100%;
  width: 100%;
  overflow: auto;
  display: flex;
  position: relative;
}
.subject-selector {
  position: absolute;
  top: 1rem;
  left: 1rem;
  color: white;
}
.vagus-viewer {
  flex: 0 0 80%;
  max-width: 80%;
  background-color: black;
}
.file-selector {
  flex: 0 0 20%;
  overflow-y: auto;
}
.dialog {
  --el-dialog-width: 80%
}
.selector {
  z-index: 5;
}
.loading-overlay {
  z-index: 1000;
}
</style>