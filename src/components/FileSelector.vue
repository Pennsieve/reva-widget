<template>
  <el-table :data="files" height="100vh" style="width: 100%">
    <el-table-column prop="name" label="Filename" />
    <el-table-column prop="packageType" label="Kind" width="60" />
    <el-table-column prop="size" label="Size" width="100" />
  </el-table>
</template>

<script setup>
const props = defineProps({
  files: {
    type: Array,
    required: true
  }
})

</script>