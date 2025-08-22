<script lang="ts" setup>
import CanvasDraggable from './components/CanvasDraggable.vue';
</script>
<template>
  <div class="fullscreen">
    <CanvasDraggable></CanvasDraggable>
  </div>
</template>

<style scoped>
 .fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background: white;
 }
</style>