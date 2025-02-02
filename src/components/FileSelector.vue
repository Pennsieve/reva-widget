<template>
  <el-table :data="files" @row-click="handleRowClick" height="100vh" style="width: 100%">
    <el-table-column prop="name" label="Filename" />
    <el-table-column prop="packageType" label="Kind" width="80" />
    <el-table-column prop="size" label="Size" width="100">
      <template #default="scope">
        {{ formatFileSize(scope.row.size) }}
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup>

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

const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 bytes'
    const kB = 1000
    const mB = kB * 1000
    const gB = mB * 1000

    if (bytes < kB) return `${bytes} Bytes`
    else if (bytes < mB) return `${(bytes / kB).toFixed(2)} KB`
    else if (bytes < gB) return `${(bytes / mB).toFixed(2)} MB`
    else return `${(bytes / gB).toFixed(2)} GB`
}
</script>

<style scoped>
.el-table {
  cursor: pointer;
  z-index: 5;
}
</style>