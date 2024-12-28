<template>
  <el-table :data="files" @row-click="handleRowClick" height="100vh" style="width: 100%">
    <el-table-column prop="name" label="Filename" />
    <el-table-column prop="packageType" label="Kind" width="60" />
    <el-table-column prop="size" label="Size" width="100" />
  </el-table>
</template>

<script setup>
import { defineEmits } from 'vue';
const emit = defineEmits(['fileSelected']);

const props = defineProps({
  files: {
    type: Array,
    required: true
  }
})

const handleRowClick = (row) => {
  emit('fileSelected', row)
}
</script>

<style scoped>
.el-table {
  cursor: pointer;
}
</style>