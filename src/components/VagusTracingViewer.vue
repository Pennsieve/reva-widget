<template>
  <div ref="viewerContainer" @mousedown="onMouseDown" @mousemove="onMouseMove" @mouseup="onMouseUp" class="viewer-container">
    <div class="selected-region-label">Selected Vagus Region: {{ selectedRegionLabel }}</div>
    <div class="highlighted-region-label">Highlighted Vagus Region: {{ highlightedRegionLabel }}</div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, computed } from "vue"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm"

const props = defineProps({
  coordFiles: {
    type: Array,
    required: true
  }
})

const viewerContainer = ref(null)
let mouseMoved = ref(false)
let MultiLineCoordArray = []
let scene, camera, renderer, controls, raycaster, mouse
let lastHighlightedNerveSegment = ref(null)
let lastSelectedNerveSegment = ref(null)

const loadCSVFile = (fileUrl) => {
  const loader = new THREE.FileLoader()
  return new Promise((resolve, reject) => {
    loader.load(
      fileUrl,
      (data) => {
        MultiLineCoordArray.push(data)
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

for (const file of props.coordFiles) {
  await loadCSVFile(file["s3Url"])
}

onMounted(async () => {
  init3DViewer()

  parseCoords()

  const centerPoint = calculateCenterPoint(MultiLineCoordArray)

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
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(50, 1, 0.01, 10000)
  camera.position.z = 5000

  renderer = new THREE.WebGLRenderer()
  const { offsetWidth, offsetHeight } = viewerContainer.value
  renderer.setSize(offsetWidth, offsetHeight)
  viewerContainer.value.appendChild(renderer.domElement)

  scene.add(new THREE.AxesHelper(5))
}

const parseCoords = () => {
  MultiLineCoordArray = MultiLineCoordArray.map((line) => d3.csvParse(line))
  MultiLineCoordArray.forEach((coordArray, index) => {
    const mappedPoints = []
    coordArray.forEach((row) => {
      const x = parseFloat(row.X)
      const y = parseFloat(row.Y)
      const z = parseFloat(row.Z)

      mappedPoints.push(
        new THREE.Vector3(isNaN(x) ? 0 : x, isNaN(y) ? 0 : y, isNaN(z) ? 0 : z)
      )
    })

    const geometry = new THREE.BufferGeometry().setFromPoints(mappedPoints)
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffffff }))

    scene.add(line)

    line.userData = { id: `file_${index}`, fileName: props.coordFiles[index]["name"] }
  })
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

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(scene.children)

  if (intersects.length > 0) {
    const closestObject = intersects[0].object
    if (closestObject.userData?.fileName == lastSelectedNerveSegment.value?.userData?.fileName) {
      return
    }
    else if (lastHighlightedNerveSegment.value && closestObject.userData?.fileName != lastHighlightedNerveSegment.value?.userData?.fileName) {
      if (lastSelectedNerveSegment.value?.userData?.fileName != lastHighlightedNerveSegment.value?.userData?.fileName)
      {
        lastHighlightedNerveSegment.value.material = new THREE.LineBasicMaterial({ color: 0xffffff })
      }
    }

    closestObject.material = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 })
    lastHighlightedNerveSegment.value = closestObject
  } else {
    if (lastHighlightedNerveSegment.value) {
      if (lastSelectedNerveSegment.value == null) {
        lastHighlightedNerveSegment.value.material = new THREE.LineBasicMaterial({ color: 0xffffff })
      }
      else if (lastHighlightedNerveSegment.value?.userData?.fileName != lastSelectedNerveSegment.value?.userData?.fileName) {
        lastHighlightedNerveSegment.value.material = new THREE.LineBasicMaterial({ color: 0xffffff })
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
  const intersects = raycaster.intersectObjects(scene.children)

  if (intersects.length > 0) {
    const closestObject = intersects[0].object

    if (lastSelectedNerveSegment.value && lastSelectedNerveSegment.value != closestObject) {
      lastSelectedNerveSegment.value.material = new THREE.LineBasicMaterial({ color: 0xffffff })
    }

    closestObject.material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 })
    lastSelectedNerveSegment.value = closestObject
  } else {
    if (lastSelectedNerveSegment.value) {
      lastSelectedNerveSegment.value.material = new THREE.LineBasicMaterial({ color: 0xffffff })
      lastSelectedNerveSegment.value = null
    }
  }
}

const highlightedRegionLabel = computed(() => lastHighlightedNerveSegment.value != null ? `${lastHighlightedNerveSegment.value?.userData?.fileName.replace(/\.[^/.]+$/, "")}` : "")
const selectedRegionLabel = computed(() => lastSelectedNerveSegment.value != null ? `${lastSelectedNerveSegment.value?.userData?.fileName.replace(/\.[^/.]+$/, "")}` : "")

// Render
function renderViewer() {
  renderer.render(scene, camera)
  window.addEventListener('resize', onWindowResize, false)
  function onWindowResize() {
    if (viewerContainer.value == null) { return }
    const { offsetWidth, offsetHeight } = viewerContainer.value
    camera.aspect = offsetWidth / offsetHeight
    camera.updateProjectionMatrix()
    renderer.setSize(offsetWidth, offsetHeight)
    render()
  }
}

function animate() {
    requestAnimationFrame(animate)
    render()
}

function render() {
    renderer.render(scene, camera);
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
</style>
