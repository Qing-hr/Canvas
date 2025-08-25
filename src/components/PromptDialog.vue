<template>
  <div v-if="visible" class="modal-overlay">
    <div class="prompt-modal">
      <h3>{{ title }}</h3>
      <label>{{ placeholder }}</label>
      <input 
        type="text" 
        v-model="inputValue" 
        :placeholder="placeholder"
        @keyup.enter="confirm"
      >
      <div class="prompt-actions">
        <button @click="confirm">确认</button>
        <button @click="cancel">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  visible: Boolean,
  title: {
    type: String,
    default: '输入文件名'
  },
  placeholder: {
    type: String,
    default: '请输入文件名'
  },
  defaultValue: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:visible', 'confirm']);

const inputValue = ref(props.defaultValue);

function confirm() {
  emit('confirm', inputValue.value);
  close();
}

function cancel() {
  close();
}

function close() {
  emit('update:visible', false);
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1001; /* 比ExportDialog更高 */
}

.prompt-modal {
  background-color: white;
  padding: 20px;
  border-radius: 5px;
  width: 300px;
}

.prompt-modal h3 {
  margin-top: 0;
  margin-bottom: 15px;
}

.prompt-modal input {
  width: 100%;
  padding: 8px;
  margin-top: 10px;
  margin-bottom: 15px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.prompt-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.prompt-actions button {
  padding: 5px 15px;
  cursor: pointer;
}
</style>