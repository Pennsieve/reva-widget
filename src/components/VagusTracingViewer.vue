<template>
  <div ref="viewerContainer" @mousedown="onMouseDown" @mousemove="onMouseMove" @mouseup="onMouseUp" class="viewer-container">
    <div class="selected-region-label">Selected Vagus Region: {{ selectedRegionLabel }}</div>
    <div class="highlighted-region-label">Highlighted Vagus Region: {{ highlightedRegionLabel }}</div>
    <el-checkbox-group class="anatomical-landmarks-toggle" v-if="anatomicalLandmarksFolders.length > 1" v-model="visibleAnatomicalLandmarksFolders">
      <el-checkbox v-for="folder in anatomicalLandmarksFolders" :key="folder['name']" :label="folder['name']" :value="folder['name']" />
    </el-checkbox-group>
  </div>
</template>

<script setup>
import { pathOr } from 'ramda'
import { onMounted, onBeforeUnmount, ref, computed, watch } from "vue"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import * as d3 from "d3"
import * as THREE from "three"


const emit = defineEmits(['segmentSelected']);
const VAGUS_TRACING_LAYER_ID = 0;

const props = defineProps({
  vagusCoordFiles: {
    type: Array,
    required: true
  },
  anatomicalLandmarksFolders: {
    type: Array,
    required: true
  }
})

const viewerContainer = ref(null)
let mouseMoved = ref(false)
let VagusTracingCoordArray = []
let AnatomicalLandmarksCoordArray = ref([])
let vagusNerveScene, camera, renderer, controls, raycaster, mouse, labelRenderer
let lastHighlightedNerveSegment = ref(null)
let lastSelectedNerveSegment = ref(null)
const visibleAnatomicalLandmarksFolders = ref([])

watch(lastSelectedNerveSegment, (newValue) => {
  emit('segmentSelected', pathOr(null, ['userData','fileName'], newValue))
})

const getAnatomicalLandmarksFolder = (name) => {
  for (const folder of props.anatomicalLandmarksFolders) {
    if (folder['name'] == name) {
      return folder
    }
  }
  return null
}

const loadVagusTracingCSVFile = (fileUrl) => {
  const loader = new THREE.FileLoader()
  return new Promise((resolve, reject) => {
    loader.load(
      fileUrl,
      (data) => {
        VagusTracingCoordArray.push(data)
        resolve()
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded")
      },
      (err) => {
        console.error("An error occurred during csv load")
        reject(err)
      }
    )
  })
}

const loadAnatomicalLandmarksCSVFile = (fileUrl, folderName) => {
  const loader = new THREE.FileLoader()
  return new Promise((resolve, reject) => {
    loader.load(
      fileUrl,
      (data) => {
        AnatomicalLandmarksCoordArray.value.push({ "data": data, "folderName": folderName })
        resolve()
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded")
      },
      (err) => {
        console.error("An error occurred during csv load")
        reject(err)
      }
    )
  })
}

for (const folder of props.anatomicalLandmarksFolders){
  for (const file of folder['files']) {
    await loadAnatomicalLandmarksCSVFile(file["s3Url"], folder["name"])
  }
  visibleAnatomicalLandmarksFolders.value.push(folder["name"])
}
for (const file of props.vagusCoordFiles) {
  await loadVagusTracingCSVFile(file["s3Url"])
}

onMounted(async () => {
  init3DViewer()

  parseCoords()

  addLabelsToAnatomicalLandmarks()

  const centerPoint = calculateCenterPoint(VagusTracingCoordArray)

  camera.position.set(centerPoint.x, centerPoint.y, centerPoint.z + 500)
  camera.lookAt(centerPoint)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(centerPoint.x, centerPoint.y, centerPoint.z)
  controls.update()

  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()

  renderViewer()
  animate()
})

const init3DViewer = () => {
  // Create and attach CSS2DRenderer
  labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0px';
  labelRenderer.domElement.style.zIndex = "1";
  labelRenderer.domElement.style.pointerEvents = 'none'
  viewerContainer.value.appendChild(labelRenderer.domElement);
  vagusNerveScene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(50, 1, 0.01, 10000)
  camera.position.z = 5000

  renderer = new THREE.WebGLRenderer()
  renderer.autoClear = false
  const { offsetWidth, offsetHeight } = viewerContainer.value
  renderer.setSize(offsetWidth, offsetHeight)
  labelRenderer.setSize(offsetWidth, offsetHeight + 32)
  viewerContainer.value.appendChild(renderer.domElement)

  vagusNerveScene.add(new THREE.AxesHelper(5))
}

const createTextLabel = (text, position) => {
  const div = document.createElement('div');
  div.className = 'text-label';
  div.textContent = text;
  div.style.color = 'white';
  div.style.fontSize = '12px';
  div.style.background = 'rgba(0, 0, 0, 0.5)';
  div.style.padding = '2px 5px';
  div.style.borderRadius = '3px';
  viewerContainer.value.appendChild(div)

  const textObject = new CSS2DObject(div);
  textObject.position.set(position.x, position.y, position.z);
  return textObject;
};

const addLabelsToAnatomicalLandmarks = () => {
  let fileIndex = 0
  AnatomicalLandmarksCoordArray.value.forEach(({ data, folderName }) => {
    const coordArray = data
    if (coordArray.length < 2) return

    // Compute midpoint of the first and last point of the line
    const firstPoint = new THREE.Vector3(
      parseFloat(coordArray[0].X) || 0,
      parseFloat(coordArray[0].Y) || 0,
      parseFloat(coordArray[0].Z) || 0
    )

    const lastPoint = new THREE.Vector3(
      parseFloat(coordArray[coordArray.length - 1].X) || 0,
      parseFloat(coordArray[coordArray.length - 1].Y) || 0,
      parseFloat(coordArray[coordArray.length - 1].Z) || 0
    )

    const midpoint = new THREE.Vector3().addVectors(firstPoint, lastPoint).multiplyScalar(0.5)

    // Create a label with the line's filename
    const folder = getAnatomicalLandmarksFolder(folderName)
    if (folder) {
      const label = createTextLabel(folder['files'][fileIndex]["name"], midpoint)
      label.layers.set(folder['id'])
      vagusNerveScene.add(label)
    }
    // Since we are iterating over all the different folders data but pulling the files from only one folder
    // we need to reset the index each time we start looking into a different folder
    if (fileIndex == folder['files'].length - 1) {
      fileIndex = 0
    } else {
      fileIndex += 1
    }
  })
}

const parseCoords = () => {
  VagusTracingCoordArray = VagusTracingCoordArray.map((line) => d3.csvParse(line))
  VagusTracingCoordArray.forEach((coordArray, index) => {
    const mappedPoints = []
    coordArray.forEach((row) => {
      const x = parseFloat(row.X)
      const y = parseFloat(row.Y)
      const z = parseFloat(row.Z)

      mappedPoints.push(
        new THREE.Vector3(isNaN(x) ? 0 : x, isNaN(y) ? 0 : y, isNaN(z) ? 0 : z)
      )
    })

    const lineGeometry = new LineGeometry()
    lineGeometry.setPositions(mappedPoints.flatMap(p => [p.x, p.y, p.z])) // Flatten the points for LineGeometry

    // Create a LineMaterial with adjustable thickness
    const lineMaterial = new LineMaterial({
      color: 0xffffff,
      linewidth: 1,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    })

    // Create the Line2 object with the geometry and material
    const line = new Line2(lineGeometry, lineMaterial)
    line.layers.set(VAGUS_TRACING_LAYER_ID)
    vagusNerveScene.add(line)

    line.userData = { id: `file_${index}`, fileName: props.vagusCoordFiles[index]["name"] }
  })

  AnatomicalLandmarksCoordArray.value = AnatomicalLandmarksCoordArray.value.map(({ data, folderName }) => ({
    'data': d3.csvParse(data),
    'folderName': folderName
  }))
  AnatomicalLandmarksCoordArray.value.forEach(({ data, folderName }) => {
    const coordArray = data
    const mappedPoints = []
    coordArray.forEach((row) => {
      const x = parseFloat(row.X)
      const y = parseFloat(row.Y)
      const z = parseFloat(row.Z)

      mappedPoints.push(
        new THREE.Vector3(isNaN(x) ? 0 : x, isNaN(y) ? 0 : y, isNaN(z) ? 0 : z)
      )
    })

    const lineGeometry = new LineGeometry()
    lineGeometry.setPositions(mappedPoints.flatMap(p => [p.x, p.y, p.z])) // Flatten the points for LineGeometry
    const color = stringToColor(folderName)
    const lineMaterial = new LineMaterial({
      color: color,
      linewidth: 5,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    })
    const line = new Line2(lineGeometry, lineMaterial)
    const folder = getAnatomicalLandmarksFolder(folderName)
    line.layers.set(folder['id'])
    
    vagusNerveScene.add(line)
    
    //line.userData = { id: `file_${index}`, fileName: props.anatomicalLandmarksFolders[index]["name"] }
  })
}

const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  let color = "#"
  for (let i = 0; i < 3; i++) {
    color += ("00" + ((hash >> (i * 8)) & 0xff).toString(16)).slice(-2)
  }
  return color
}

const calculateCenterPoint = (coordArrays) => {
  let totalX = 0, totalY = 0, totalZ = 0
  let totalPoints = 0

  coordArrays.forEach((coordArray) => {
    coordArray.forEach((row) => {
      const x = parseFloat(row.X)
      const y = parseFloat(row.Y)
      const z = parseFloat(row.Z)

      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
        totalX += x
        totalY += y
        totalZ += z
        totalPoints++
      }
    })
  })

  return new THREE.Vector3(totalX / totalPoints, totalY / totalPoints, totalZ / totalPoints)
}

const onMouseDown = (event) => {
  mouseMoved.value = false
}

const onMouseMove = (event) => {
  mouseMoved.value = true
  if (viewerContainer.value == null) { return }
  const { offsetWidth, offsetHeight } = viewerContainer.value
  mouse.x = event.offsetX / offsetWidth * 2 - 1
  mouse.y = -(event.offsetY / offsetHeight) * 2 + 1
  raycaster.layers.set(VAGUS_TRACING_LAYER_ID)
  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(vagusNerveScene.children)
  if (intersects.length > 0) {
    const closestObject = intersects[0].object
    if (closestObject.userData?.fileName == lastSelectedNerveSegment.value?.userData?.fileName) {
      return
    }
    else if (lastHighlightedNerveSegment.value && closestObject.userData?.fileName != lastHighlightedNerveSegment.value?.userData?.fileName) {
      if (lastSelectedNerveSegment.value?.userData?.fileName != lastHighlightedNerveSegment.value?.userData?.fileName)
      {
        lastHighlightedNerveSegment.value.material = new LineMaterial({ color: 0xffffff })
      }
    }

    closestObject.material = new LineMaterial({ color: 0xff0000, linewidth: 2 })
    lastHighlightedNerveSegment.value = closestObject
  } else {
    if (lastHighlightedNerveSegment.value) {
      if (lastSelectedNerveSegment.value == null) {
        lastHighlightedNerveSegment.value.material = new LineMaterial({ color: 0xffffff })
      }
      else if (lastHighlightedNerveSegment.value?.userData?.fileName != lastSelectedNerveSegment.value?.userData?.fileName) {
        lastHighlightedNerveSegment.value.material = new LineMaterial({ color: 0xffffff })
      }
      lastHighlightedNerveSegment.value = null
    }
  }
}

const onMouseUp = (event) => {
  // We do not want to treat panning and rotations as mouse selection clicks
  if (mouseMoved.value) {
    return
  }
  if (viewerContainer.value == null) { return }
  const { offsetWidth, offsetHeight } = viewerContainer.value
  mouse.x = event.offsetX / offsetWidth * 2 - 1
  mouse.y = -(event.offsetY / offsetHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(vagusNerveScene.children)

  if (intersects.length > 0) {
    const closestObject = intersects[0].object

    if (lastSelectedNerveSegment.value && lastSelectedNerveSegment.value != closestObject) {
      lastSelectedNerveSegment.value.material = new LineMaterial({ color: 0xffffff })
    }

    closestObject.material = new LineMaterial({ color: 0x00ff00, linewidth: 2 })
    lastSelectedNerveSegment.value = closestObject
  } else {
    if (lastSelectedNerveSegment.value) {
      lastSelectedNerveSegment.value.material = new LineMaterial({ color: 0xffffff })
      lastSelectedNerveSegment.value = null
    }
  }
}

const highlightedRegionLabel = computed(() => lastHighlightedNerveSegment.value != null ? `${lastHighlightedNerveSegment.value?.userData?.fileName.replace(/\.[^/.]+$/, "")}` : "")
const selectedRegionLabel = computed(() => lastSelectedNerveSegment.value != null ? `${lastSelectedNerveSegment.value?.userData?.fileName.replace(/\.[^/.]+$/, "")}` : "")

// Render
function renderViewer() {
  window.addEventListener('resize', onWindowResize, false)
  function onWindowResize() {
    if (viewerContainer.value == null) { return }
    const { offsetWidth, offsetHeight } = viewerContainer.value
    camera.aspect = offsetWidth / offsetHeight
    camera.updateProjectionMatrix()
    renderer.setSize(offsetWidth, offsetHeight)
    labelRenderer.setSize(offsetWidth, offsetHeight + 32)
    render()
  }
}

function animate() {
  requestAnimationFrame(animate)
  render()
}

function render() {
  camera.layers.enableAll()
  renderer.render(vagusNerveScene, camera)
  labelRenderer.render(vagusNerveScene, camera)
}

onBeforeUnmount(() => {
  if (renderer) {
    renderer.dispose()
  }
})
</script>

<style scoped>
.viewer-container {
  min-height: 50rem;
  min-width: 50rem;
  height: 100vh;
  width: 100vw;
}
.selected-region-label {
  position: absolute;
  top: 4rem;
  left: 1rem;
  z-index: 1;
  color: green;
}
.highlighted-region-label {
  position: absolute;
  top: 6rem;
  left: 1rem;
  z-index: 1;
  color: red;
}
canvas {
  background-color: #999;
  position: absolute;
  min-height: 50rem;
  min-width: 50rem;
  height: 100vh;
  width: 100vw;
  right: 0;
  top: 0;
}
.anatomical-landmarks-toggle {
  position: absolute;
  top: 1rem;
  right: 0;
}
.el-checkbox {
  display: block;
}
</style>
