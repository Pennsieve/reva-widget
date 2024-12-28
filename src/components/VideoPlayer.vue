<template>
  <div class="video-player">
    <video
      style="width: 100%; height: auto;"
      controls
      playsinline
    >
      <source :src="videoSrc" type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  </div>
</template>

<script setup>
import { defineProps } from 'vue'

const props = defineProps({
  videoSrc: {
    type: String,
    required: true,
  },
})

</script>

<style scoped>
.video-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>