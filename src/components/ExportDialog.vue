<template>
  <div v-if="visible" class="modal-overlay">
    <div class="export-modal">
      <h3>导出图片样式</h3>
      
      <div class="export-option">
        <label>导出范围：</label>
        <select v-model="settings.exportType">
          <option value="whole">整个画布</option>
          <option value="shapes">仅绘制图形</option>
        </select>
      </div>
      
      <div class="export-option">
        <label>边距宽度：</label>
        <input 
          type="number" 
          v-model.number="settings.padding" 
          min="0" 
          max="100"
          step="1"
        >
        <span>px</span>
      </div>
      
      <div class="export-option">
        <label>
          <input type="checkbox" v-model="settings.transparentBackground">
          透明背景
        </label>
      </div>
      
      <div class="export-actions">
        <button @click="handleExportClick">确认导出</button>
        <button @click="cancel">取消</button>
      </div>
    </div>

    <PromptDialog
      v-model:visible="showPromptDialog"
      title="导出图片"
      placeholder="请输入文件名（不带扩展名）"
      :default-value="defaultFileName"
      @confirm="handleFileNameConfirm"
    />

  </div>
</template>

<script setup>
import { ref } from 'vue';
import PromptDialog from './PromptDialog.vue';

const props = defineProps({
  visible: Boolean,
  canvasWidth: Number,
  canvasHeight: Number,
  drawnShapes: Array
});

const emit = defineEmits(['update:visible', 'export']);

const showPromptDialog = ref(false);
const defaultFileName = ref('drawing');
const exportCanvas = ref(null);

const settings = ref({
  exportType: 'shapes',
  padding: 10, // 默认10px边距
  transparentBackground: false
});

function handleExportClick() {
  exportCanvas.value = createExportCanvas();
  showPromptDialog.value = true;
}

function handleFileNameConfirm(fileName) {
  const finalFileName = fileName || defaultFileName.value;
  emit('export', { canvas: exportCanvas.value, fileName: finalFileName });
  close();
}

function cancel() {
  close();
}

function close() {
  emit('update:visible', false);
}

function createExportCanvas() {
  const exportCanvas = document.createElement('canvas');
  const exportCtx = exportCanvas.getContext('2d');
  
  if (settings.value.exportType === 'whole') {
    // 导出整个画布时，边距是画布内容与图片边缘的距离
    exportCanvas.width = props.canvasWidth + settings.value.padding * 2;
    exportCanvas.height = props.canvasHeight + settings.value.padding * 2;
    
    // 设置背景
    if (settings.value.transparentBackground) {
      exportCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
    } else {
      exportCtx.fillStyle = '#ffffff';
      exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    }
    
    // 绘制图形（考虑边距偏移）
    const offsetX = settings.value.padding;
    const offsetY = settings.value.padding;
    
    props.drawnShapes.forEach(shape => {
      const adjustedShape = {
        ...shape,
        points: {
          x1: shape.points.x1 + offsetX,
          y1: shape.points.y1 + offsetY,
          x2: shape.points.x2 + offsetX,
          y2: shape.points.y2 + offsetY
        }
      };
      drawShapeOnCanvas(adjustedShape, exportCtx);
    });
  } else {
    // 仅导出图形时，边距是图形内容与图片边缘的距离
    const bounds = calculateShapesBounds();
    exportCanvas.width = bounds.width + settings.value.padding * 2;
    exportCanvas.height = bounds.height + settings.value.padding * 2;
    
    // 设置背景
    if (settings.value.transparentBackground) {
      exportCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
    } else {
      exportCtx.fillStyle = '#ffffff';
      exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    }
    
    // 绘制图形（考虑边距和图形边界偏移）
    const offsetX = settings.value.padding - bounds.left;
    const offsetY = settings.value.padding - bounds.top;
    
    props.drawnShapes.forEach(shape => {
      const adjustedShape = {
        ...shape,
        points: {
          x1: shape.points.x1 + offsetX,
          y1: shape.points.y1 + offsetY,
          x2: shape.points.x2 + offsetX,
          y2: shape.points.y2 + offsetY
        }
      };
      drawShapeOnCanvas(adjustedShape, exportCtx);
    });
  }
  
  return exportCanvas;
}

function calculateShapesBounds() {
  if (props.drawnShapes.length === 0) {
    return { left: 0, top: 0, right: 100, bottom: 100 };
  }
  
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  
  props.drawnShapes.forEach(shape => {
    const bounds = getShapeBounds(shape);
    left = Math.min(left, bounds.left);
    top = Math.min(top, bounds.top);
    right = Math.max(right, bounds.right);
    bottom = Math.max(bottom, bounds.bottom);
  });
  
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top
  };
}

function getShapeBounds(shape) {
  const { x1, y1, x2, y2 } = shape.points;
  
  if (shape.type === 'rect') {
    return {
      left: Math.min(x1, x2),
      right: Math.max(x1, x2),
      top: Math.min(y1, y2),
      bottom: Math.max(y1, y2)
    };
  } else if (shape.type === 'circle') {
    const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    return {
      left: x1 - radius,
      right: x1 + radius,
      top: y1 - radius,
      bottom: y1 + radius
    };
  } else if (shape.type === 'line') {
    return {
      left: Math.min(x1, x2),
      right: Math.max(x1, x2),
      top: Math.min(y1, y2),
      bottom: Math.max(y1, y2)
    };
  } else if (shape.type === 'triangle') {
    const x3 = x1 * 2 - x2;
    return {
      left: Math.min(x1, x2, x3),
      right: Math.max(x1, x2, x3),
      top: Math.min(y1, y2),
      bottom: Math.max(y1, y2)
    };
  }
  
  return { left: 0, right: 0, top: 0, bottom: 0 };
}

function drawShapeOnCanvas(shape, context) {
  context.fillStyle = shape.fillColor || '#ffffff';
  context.strokeStyle = '#000000';
  context.lineWidth = 2;
  
  const { x1, y1, x2, y2 } = shape.points;
  
  switch (shape.type) {
    case 'rect':
      context.beginPath();
      context.rect(x1, y1, x2 - x1, y2 - y1);
      context.fill();
      context.stroke();
      break;
    case 'circle':
      const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      context.beginPath();
      context.arc(x1, y1, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      break;
    case 'line':
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.stroke();
      break;
    case 'triangle':
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.lineTo(x1 * 2 - x2, y2);
      context.closePath();
      context.fill();
      context.stroke();
      break;
  }
}
</script>

<style scoped>
.export-option input[type="number"] {
  width: 60px;
  margin: 0 5px;
  padding: 3px;
  border: 1px solid #ccc;
  border-radius: 3px;
}

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
  z-index: 1000;
}

.export-modal {
  background-color: white;
  padding: 20px;
  border-radius: 5px;
  width: 400px;
  max-width: 90%;
}

.export-modal h3 {
  margin-top: 0;
  margin-bottom: 20px;
}

.export-option {
  margin-bottom: 15px;
}

.export-option label {
  margin-right: 10px;
}

.export-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.export-actions button {
  padding: 5px 15px;
  cursor: pointer;
}
</style>