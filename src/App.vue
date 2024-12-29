<template>
  <Suspense>
    <Widget />
  </Suspense>
</template>

<script setup>
import Widget from './components/Widget.vue';


</script>

<style scoped>
#app {
  padding: 0 !important;
  margin: 0 !important;
  display: contents !important;
}
body {
  margin: 0 !important;
  display: contents !important;
}
@media (min-width: 1024px) {
  #app {
    padding: 0 !important;
    margin: 0 !important;
    display: contents !important;
  }
}
</style>
