<template>
  <div class="canvas-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <button 
        v-for="shape in shapes" 
        :key="shape.type"
        @click="selectShape(shape.type)"
        :class="{ active: selectedShape === shape.type }"
      >
        {{ shape.label }}
      </button>
      <button @click="clearCanvas">清空画布</button>
      <button @click="showExportDialog = true">导出PNG</button>
      <div v-if="selectedShapes.length > 0" class="transform-controls">
        <div class="color-picker">
          <label>颜色:</label>
          <input type="color" v-model="currentColor" @input="updateSelectedShapesColor">
        </div>
        <button @click="flipSelectedShapes('horizontal')">水平翻转</button>
        <button @click="flipSelectedShapes('vertical')">垂直翻转</button>
        <button @click="deleteSelectedShapes">删除</button>
      </div>
    </div>
    
    <!-- 导出对话框组件 -->
    <ExportDialog
      v-model:visible="showExportDialog"
      :canvas-width="canvas.width"
      :canvas-height="canvas.height"
      :drawn-shapes="drawnShapes"
      @export="handleExport"
    />

    <!-- 画布区域 -->
    <canvas 
      ref="canvas" 
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
    ></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import ExportDialog from './ExportDialog.vue';

// 导出相关状态
const showExportDialog = ref(false);

// 处理导出事件
function handleExport({ canvas, fileName }) {
  const link = document.createElement('a');
  link.download = `${fileName}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
// 画布引用 canvas初始化
const canvas = ref({
  width: 0,
  height: 0
});
let ctx = null;
let bufferCanvas = null; // 离屏画布（用于存储已完成图形）
let bufferCtx = null;

// 工具状态
const shapes = [
  { type: 'rect', label: '矩形' },
  { type: 'circle', label: '圆形' },
  { type: 'line', label: '直线' },
  { type: 'triangle', label: '三角形' }
];
const selectedShape = ref(null);
const currentColor = ref('#ffffff'); // 填充色默认设置为白色

// 绘图状态
const isDrawing = ref(false);
const isDragging = ref(false);
const isSelecting = ref(false); // 是否正在框选
const startX = ref(0);
const startY = ref(0);

// 图形状态
const drawnShapes = ref([]);
const selectedShapes = ref([]); // 存储选中的图形索引
const dragOffset = ref({ x: 0, y: 0 });

const isResizing = ref(false); // 是否正在调整大小
const resizeDirection = ref(''); // 调整大小的方向
const originalShapeData = ref(null); // 保存调整前的图形数据

const selectionRect = ref({ x1: 0, y1: 0, x2: 0, y2: 0 }); // 选择框的坐标

const MIN_SIZE_THRESHOLD = 5; // 最小尺寸阈值（像素）

// 添加一个新的状态变量来跟踪当前模式
const currentMode = ref('select'); // 'select' 或 'draw'

// 初始化画布
onMounted(() => {
  resizeCanvas();
  ctx = canvas.value.getContext('2d');

  // 创建离屏画布
  bufferCanvas = document.createElement('canvas');
  bufferCanvas.width = canvas.value.width;
  bufferCanvas.height = canvas.value.height;
  bufferCtx = bufferCanvas.getContext('2d');

  window.addEventListener('resize', resizeCanvas);
});

// 导出为PNG功能
function exportToPNG() {
  // 询问文件名
  const fileName = prompt('请输入导出文件名（不带扩展名）:', 'drawing') || 'drawing';

  // 创建一个临时canvas来合并所有图层
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.value.width;
  exportCanvas.height = canvas.value.height;
  const exportCtx = exportCanvas.getContext('2d');
  
  // 1. 绘制背景（如果需要）
  exportCtx.fillStyle = '#d5d6d2'; // 与画布背景色一致
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  
  // 2. 绘制所有图形
  drawnShapes.value.forEach(shape => {
    exportCtx.fillStyle = shape.fillColor || '#ffffff';
    exportCtx.strokeStyle = '#000000';
    exportCtx.lineWidth = 2;
    
    const { x1, y1, x2, y2 } = shape.points;
    
    switch (shape.type) {
      case 'rect':
        drawRect(x1, y1, x2 - x1, y2 - y1, exportCtx);
        break;
      case 'circle':
        drawCircle(x1, y1, x2, y2, exportCtx);
        break;
      case 'line':
        drawLine(x1, y1, x2, y2, exportCtx);
        break;
      case 'triangle':
        drawTriangle(x1, y1, x2, y2, exportCtx);
        break;
    }
  });
  
  // 3. 创建下载链接
  const link = document.createElement('a');
  link.download = 'drawing.png';
  link.href = exportCanvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // 添加导出成功提示
  alert(`图像已导出为 ${fileName}.png`);
}

// 更新选中图形的颜色
function updateSelectedShapesColor() {
  selectedShapes.value.forEach(index => {
    drawnShapes.value[index].fillColor = currentColor.value;
  });
  updateBufferCanvas();
  redrawCanvas();
}

// 调整画布大小
function resizeCanvas() {
  const container = canvas.value.parentElement;
  canvas.value.width = container.clientWidth;
  canvas.value.height = container.clientHeight - 50; // 减去工具栏高度

  // 同时调整离屏画布大小
  if (bufferCanvas) {
    bufferCanvas.width = canvas.value.width;
    bufferCanvas.height = canvas.value.height;
    redrawCanvas(); // 调整大小后重绘
  }
}

// 选择图形
function selectShape(shape) {
  selectedShape.value = shape;
  selectedShapes.value = []; // 选择新图形时取消选中已有图形
  currentMode.value = shape ? 'draw' : 'select'; // 如果选择了图形工具，则进入绘制模式
  redrawCanvas();
}

// 鼠标按下事件
function handleMouseDown(e) {
  const [mouseX, mouseY] = getMousePos(e);
  
  // 检查是否按住Shift键进行多选
  const isMultiSelect = e.shiftKey;
  
  // 检查是否点击了控制点
  if (selectedShapes.value.length === 1) {
    const direction = getResizeDirection(mouseX, mouseY);
    if (direction) {
      isResizing.value = true;
      resizeDirection.value = direction;
      originalShapeData.value = { 
        ...drawnShapes.value[selectedShapes.value[0]] 
      };
      return;
    }
  }

  // 首先检查是否点击了已有图形
  const clickedShapeIndex = findShapeAtPosition(mouseX, mouseY);
  
  if (clickedShapeIndex !== null) {
    if (isMultiSelect) {
      // 多选模式：添加或移除选中状态
      const index = selectedShapes.value.indexOf(clickedShapeIndex);
      if (index === -1) {
        selectedShapes.value.push(clickedShapeIndex);
      } else {
        selectedShapes.value.splice(index, 1);
      }
    } else {
      // 单选模式：只选中当前图形
      if (selectedShapes.value.indexOf(clickedShapeIndex) === -1) {
        selectedShapes.value = [clickedShapeIndex];
      }
    }
    
    // 准备拖动选中的图形
    if (selectedShapes.value.length > 0) {
      isDragging.value = true;
      
      // 计算鼠标与图形控制点的偏移量
      const firstShape = drawnShapes.value[selectedShapes.value[0]];
      const vertices = getShapeVertices(firstShape);
      
      // 找到距离点击位置最近的控制点
      let nearestPoint = null;
      let minDistance = Infinity;
      
      for (const point of Object.values(vertices)) {
        const distance = Math.sqrt(Math.pow(mouseX - point.x, 2) + Math.pow(mouseY - point.y, 2));
        if (distance < minDistance) {
          minDistance = distance;
          nearestPoint = point;
        }
      }
      
      // 如果点击位置靠近某个控制点（5像素内），则使用该点作为基准
      // 否则使用点击位置本身作为基准（自由拖动）
      const referencePoint = minDistance <= 5 ? nearestPoint : { x: mouseX, y: mouseY };
      
      dragOffset.value = {
        x: mouseX - referencePoint.x,
        y: mouseY - referencePoint.y,
        referenceX: referencePoint.x, // 存储参考点坐标
        referenceY: referencePoint.y
      };
    }
    
    updateBufferCanvas();
    redrawCanvas();
    return;
  }
  
  // 根据当前模式决定行为
  if (currentMode.value === 'draw' && selectedShape.value) {
    // 绘制模式：开始绘制新图形
    isDrawing.value = true;
    [startX.value, startY.value] = [mouseX, mouseY];
    selectedShapes.value = []; // 开始绘制新图形时取消选中已有图形
    redrawCanvas(); // 清除之前的选中状态
  } else {
    // 选择模式：开始框选
    isSelecting.value = true;
    [startX.value, startY.value] = [mouseX, mouseY];
    selectionRect.value = { x1: mouseX, y1: mouseY, x2: mouseX, y2: mouseY };
    
    // 如果没有按住Shift键，则清空当前选择
    if (!isMultiSelect) {
      selectedShapes.value = [];
    }
    
    redrawCanvas();
  }
}

// 获取鼠标所在控制点的方向
function getResizeDirection(x, y) {
  if (selectedShapes.value.length !== 1) return '';
  
  const shape = drawnShapes.value[selectedShapes.value[0]];
  const { x1, y1, x2, y2 } = shape.points;
  
  // 获取图形的顶点
  const vertices = getShapeVertices(shape);
  
  // 检测鼠标是否在某个顶点上（5像素范围内）
  for (const [direction, point] of Object.entries(vertices)) {
    const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
    if (distance <= 5) return direction;
  }
  
  return '';
}

// 获取图形的顶点坐标
function getShapeVertices(shape) {
  const { x1, y1, x2, y2 } = shape.points;
  
  if (shape.type === 'rect') {
    return {
      'top-left': { x: Math.min(x1, x2), y: Math.min(y1, y2) },
      'top-right': { x: Math.max(x1, x2), y: Math.min(y1, y2) },
      'bottom-right': { x: Math.max(x1, x2), y: Math.max(y1, y2) },
      'bottom-left': { x: Math.min(x1, x2), y: Math.max(y1, y2) }
    };
  } else if (shape.type === 'circle') {
    // 圆形只有一个控制点，即鼠标释放的点
    return {
      'control-point': { x: x2, y: y2 }
    };
  } else if (shape.type === 'line') {
    return {
      'start-point': { x: x1, y: y1 },
      'end-point': { x: x2, y: y2 }
    };
  } else if (shape.type === 'triangle') {
    const x3 = x1 * 2 - x2;
    return {
      'vertex-1': { x: x1, y: y1 },
      'vertex-2': { x: x2, y: y2 },
      'vertex-3': { x: x3, y: y2 }
    };
  }
  
  return {};
}

// 鼠标移动事件
function handleMouseMove(e) {
  const [mouseX, mouseY] = getMousePos(e);
  
  // 处理调整大小
  if (isResizing.value && selectedShapes.value.length === 1) {
    const shape = drawnShapes.value[selectedShapes.value[0]];
    const { x1, y1, x2, y2 } = originalShapeData.value.points;
    
    // 根据方向调整图形大小
    switch (resizeDirection.value) {
      case 'top-left':
        shape.points = { x1: mouseX, y1: mouseY, x2, y2 };
        break;
      case 'top-right':
        shape.points = { x1, y1: mouseY, x2: mouseX, y2 };
        break;
      case 'bottom-right':
        shape.points = { x1, y1, x2: mouseX, y2: mouseY };
        break;
      case 'bottom-left':
        shape.points = { x1: mouseX, y1, x2, y2: mouseY };
        break;
      case 'start-point': // 直线起点
        shape.points = { x1: mouseX, y1: mouseY, x2, y2 };
        break;
      case 'end-point': // 直线终点
        shape.points = { x1, y1, x2: mouseX, y2: mouseY };
        break;
      case 'vertex-1': // 三角形顶点1
        shape.points = { x1: mouseX, y1: mouseY, x2, y2 };
        break;
      case 'vertex-2': // 三角形顶点2
        shape.points = { x1, y1, x2: mouseX, y2: mouseY };
        break;
      case 'vertex-3': // 三角形顶点3
        const newX3 = mouseX;
        const newX1 = (newX3 + x2) / 2;
        shape.points = { x1: newX1, y1, x2, y2 };
        break;
      case 'control-point': // 圆形控制点
        shape.points = { x1, y1, x2: mouseX, y2: mouseY };
        break;
    }
    
    updateBufferCanvas();
    redrawCanvas();
    return;
  }

  if (isDragging.value && selectedShapes.value.length > 0) {
    // 拖动选中的图形
    const referenceX = mouseX - dragOffset.value.x;
    const referenceY = mouseY - dragOffset.value.y;
    
    // 计算图形需要移动的增量
    const deltaX = referenceX - dragOffset.value.referenceX;
    const deltaY = referenceY - dragOffset.value.referenceY;
    
    // 更新所有选中图形的位置
    selectedShapes.value.forEach(index => {
      const shape = drawnShapes.value[index];
      shape.points = {
        x1: shape.points.x1 + deltaX,
        y1: shape.points.y1 + deltaY,
        x2: shape.points.x2 + deltaX,
        y2: shape.points.y2 + deltaY
      };
    });
    
    // 更新参考点位置（为下一次移动做准备）
    dragOffset.value.referenceX = referenceX;
    dragOffset.value.referenceY = referenceY;
    
    updateBufferCanvas();
    redrawCanvas();
  } else if (isDrawing.value && selectedShape.value) {
    // 绘制新图形
    requestAnimationFrame(() => {
      ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
      ctx.drawImage(bufferCanvas, 0, 0);
      
      ctx.strokeStyle = currentColor.value;
      ctx.lineWidth = 2;
      ctx.fillStyle = currentColor.value;
      
      switch (selectedShape.value) {
        case 'rect':
          drawRect(startX.value, startY.value, mouseX - startX.value, mouseY - startY.value, ctx);
          break;
        case 'circle':
          drawCircle(startX.value, startY.value, mouseX, mouseY, ctx);
          break;
        case 'line':
          drawLine(startX.value, startY.value, mouseX, mouseY, ctx);
          break;
        case 'triangle':
          drawTriangle(startX.value, startY.value, mouseX, mouseY, ctx);
          break;
      }
    });
  } else if (isSelecting.value) {
    // 更新选择框
    selectionRect.value = {
      x1: startX.value,
      y1: startY.value,
      x2: mouseX,
      y2: mouseY
    };
    
    // 实时更新选中的图形
    if (e.shiftKey) {
      // 多选模式下，保留之前选中的图形
      const newSelected = findShapesInSelection();
      selectedShapes.value = [...new Set([...selectedShapes.value, ...newSelected])];
    } else {
      selectedShapes.value = findShapesInSelection();
    }
    
    redrawCanvas();
  }
}

// 查找选择框内的图形
function findShapesInSelection() {
  const { x1, y1, x2, y2 } = selectionRect.value;
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  
  const selectedIndices = [];
  
  drawnShapes.value.forEach((shape, index) => {
    const shapeBounds = getShapeBounds(shape);
    
    // 检查图形是否在选择框内
    if (
      shapeBounds.left >= left &&
      shapeBounds.right <= right &&
      shapeBounds.top >= top &&
      shapeBounds.bottom <= bottom
    ) {
      selectedIndices.push(index);
    }
  });
  
  return selectedIndices;
}

// 获取图形的边界框
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

// 鼠标释放事件
function handleMouseUp(e) {
  // 重置调整大小状态
  isResizing.value = false;
  resizeDirection.value = '';
  originalShapeData.value = null;

  if (isDrawing.value && selectedShape.value) {
    // 完成绘制新图形
    const [mouseX, mouseY] = getMousePos(e);
    
    const newShape = {
      type: selectedShape.value,
      fillColor: currentColor.value, // 保存填充色
      points: {
        x1: startX.value,
        y1: startY.value,
        x2: mouseX,
        y2: mouseY
      }
    };
    
    // 检查图形尺寸是否有效
    if (isShapeSizeValid(newShape.type, newShape.points)) {
      drawnShapes.value.push(newShape);
      updateBufferCanvas();
    }

    // 绘制完成后自动切换回选择模式
    currentMode.value = 'select';
    selectedShape.value = null;
  } else if (isSelecting.value) {
    // 完成框选
    const [mouseX, mouseY] = getMousePos(e);
    selectionRect.value = {
      x1: startX.value,
      y1: startY.value,
      x2: mouseX,
      y2: mouseY
    };
    
    // 如果选择框太小，则视为点击而不是框选
    if (Math.abs(mouseX - startX.value) < 5 && Math.abs(mouseY - startY.value) < 5) {
      selectedShapes.value = [];
    }
  }
  
  isDrawing.value = false;
  isDragging.value = false;
  isSelecting.value = false;
  updateBufferCanvas();
  redrawCanvas();
}

// 添加辅助方法：检查图形是否满足最小尺寸要求
function isShapeSizeValid(shapeType, points) {
  const { x1, y1, x2, y2 } = points;
  
  switch (shapeType) {
    case 'rect':
    case 'triangle':
      // 检查宽度和高度
      return Math.abs(x2 - x1) >= MIN_SIZE_THRESHOLD && 
             Math.abs(y2 - y1) >= MIN_SIZE_THRESHOLD;
    case 'circle':
      // 检查半径
      return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) >= MIN_SIZE_THRESHOLD;
    case 'line':
      // 检查长度
      return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) >= MIN_SIZE_THRESHOLD;
    default:
      return false;
  }
}

// 查找鼠标位置下的图形
function findShapeAtPosition(x, y) {
  // 从后往前检查，这样最后绘制的图形会优先被选中
  for (let i = drawnShapes.value.length - 1; i >= 0; i--) {
    const shape = drawnShapes.value[i];
    const { x1, y1, x2, y2 } = shape.points;
    
    switch (shape.type) {
      case 'rect':
        if (isPointInRect(x, y, x1, y1, x2, y2)) return i;
        break;
      case 'circle':
        if (isPointInCircle(x, y, x1, y1, x2, y2)) return i;
        break;
      case 'line':
        if (isPointNearLine(x, y, x1, y1, x2, y2)) return i;
        break;
      case 'triangle':
        if (isPointInTriangle(x, y, x1, y1, x2, y2)) return i;
        break;
    }
  }
  return null;
}

// 判断点是否在矩形内
function isPointInRect(x, y, x1, y1, x2, y2) {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  
  return x >= left && x <= right && y >= top && y <= bottom;
}

// 判断点是否在圆内
function isPointInCircle(x, y, x1, y1, x2, y2) {
  const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  const distance = Math.sqrt(Math.pow(x - x1, 2) + Math.pow(y - y1, 2));
  return distance <= radius;
}

// 判断点是否在直线附近
function isPointNearLine(x, y, x1, y1, x2, y2, tolerance = 5) {
  // 线段长度
  const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  
  // 点到线段的距离
  const distance = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / length;
  
  // 检查点是否在线段的范围内
  const dotProduct = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / Math.pow(length, 2);
  
  return distance <= tolerance && dotProduct >= 0 && dotProduct <= 1;
}

// 判断点是否在三角形内
function isPointInTriangle(x, y, x1, y1, x2, y2) {
  // 计算三角形的第三个点
  const x3 = x1 * 2 - x2;
  const y3 = y2;
  
  // 计算三个子三角形的面积
  const area = Math.abs((x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1)) / 2;
  const area1 = Math.abs((x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)) / 2;
  const area2 = Math.abs((x - x2) * (y3 - y2) - (y - y2) * (x3 - x2)) / 2;
  const area3 = Math.abs((x - x3) * (y1 - y3) - (y - y3) * (x1 - x3)) / 2;
  
  // 允许一定的误差
  return Math.abs(area - (area1 + area2 + area3)) < 1;
}

// 更新离屏画布
function updateBufferCanvas() {
  bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);
  
  drawnShapes.value.forEach((shape, index) => {
    bufferCtx.lineWidth = 2;
    bufferCtx.fillStyle = shape.fillColor || '#ffffff'; // 使用保存的填充色
    
    const { x1, y1, x2, y2 } = shape.points;
    
    switch (shape.type) {
      case 'rect':
        drawRect(x1, y1, x2 - x1, y2 - y1, bufferCtx);
        break;
      case 'circle':
        drawCircle(x1, y1, x2, y2, bufferCtx);
        break;
      case 'line':
        drawLine(x1, y1, x2, y2, bufferCtx);
        break;
      case 'triangle':
        drawTriangle(x1, y1, x2, y2, bufferCtx);
        break;
    }
    
    // 如果是选中的图形，绘制控制点
    if (selectedShapes.value.includes(index)) {
      drawControlPoints(shape, bufferCtx);
    }
  });
}

// 绘制控制点
function drawControlPoints(shape, context) {
  const vertices = getShapeVertices(shape);
  
  context.save();
  context.fillStyle = '#0095ff';
  
  // 绘制所有顶点作为控制点
  for (const point of Object.values(vertices)) {
    context.beginPath();
    context.arc(point.x, point.y, 5, 0, Math.PI * 2);
    context.fill();
  }
  
  context.restore();
}

// 清空画布
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
  bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);
  drawnShapes.value = [];
  selectedShapes.value = [];
}

// 重绘整个画布
function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
  ctx.drawImage(bufferCanvas, 0, 0);
  
  // 如果正在框选，绘制选择框
  if (isSelecting.value) {
    const { x1, y1, x2, y2 } = selectionRect.value;
    ctx.save();
    ctx.strokeStyle = '#0095ff';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(
      Math.min(x1, x2),
      Math.min(y1, y2),
      Math.abs(x2 - x1),
      Math.abs(y2 - y1)
    );
    ctx.restore();
  }
}

// 获取鼠标位置
function getMousePos(e) {
  const rect = canvas.value.getBoundingClientRect();
  return [
    e.clientX - rect.left,
    e.clientY - rect.top
  ];
}

// 翻转选中的图形
function flipSelectedShapes(direction) {
  if (selectedShapes.value.length === 0) return;
  
  selectedShapes.value.forEach(index => {
    const shape = drawnShapes.value[index];
    const { x1, y1, x2, y2 } = shape.points;
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    
    if (direction === 'horizontal') {
      shape.points = {
        x1: centerX * 2 - x1,
        y1: y1,
        x2: centerX * 2 - x2,
        y2: y2
      };
    } else {
      shape.points = {
        x1: x1,
        y1: centerY * 2 - y1,
        x2: x2,
        y2: centerY * 2 - y2
      };
    }
  });
  
  updateBufferCanvas();
  redrawCanvas();
}

// 删除选中的图形
function deleteSelectedShapes() {
  if (selectedShapes.value.length === 0) return;
  
  // 从后往前删除，避免索引变化
  selectedShapes.value
    .sort((a, b) => b - a)
    .forEach(index => {
      drawnShapes.value.splice(index, 1);
    });
  
  selectedShapes.value = [];
  updateBufferCanvas();
  redrawCanvas();
}

// 绘制矩形
function drawRect(x, y, width, height, context = ctx) {
  // 检查矩形尺寸是否大于阈值
  if (Math.abs(width) < MIN_SIZE_THRESHOLD || Math.abs(height) < MIN_SIZE_THRESHOLD) {
    return; // 不绘制过小的矩形
  }
  context.beginPath();
  context.rect(x, y, width, height);
  context.fillStyle = context === ctx ? currentColor.value : context.fillStyle;
  context.fill();
  context.strokeStyle = '#000000';
  context.stroke();
}

// 绘制圆形
function drawCircle(x1, y1, x2, y2, context = ctx) {
  const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  // 检查圆形半径是否大于阈值
  if (radius < MIN_SIZE_THRESHOLD) {
    return; // 不绘制过小的圆形
  }
  context.beginPath();
  context.arc(x1, y1, radius, 0, Math.PI * 2);
  context.fillStyle = context === ctx ? currentColor.value : context.fillStyle;
  context.fill();
  context.strokeStyle = '#000000';
  context.stroke();
}

// 绘制直线
function drawLine(x1, y1, x2, y2, context = ctx) {
  const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  // 检查直线长度是否大于阈值
  if (length < MIN_SIZE_THRESHOLD) {
    return; // 不绘制过短的直线
  }

  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.strokeStyle = context === ctx ? currentColor.value : context.fillStyle;
  context.stroke();
}

// 绘制三角形
function drawTriangle(x1, y1, x2, y2, context = ctx) {
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);
  // 检查三角形尺寸是否大于阈值
  if (width < MIN_SIZE_THRESHOLD || height < MIN_SIZE_THRESHOLD) {
    return; // 不绘制过小的三角形
  }

  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.lineTo(x1 * 2 - x2, y2);
  context.closePath();
  context.fillStyle = context === ctx ? currentColor.value : context.fillStyle;
  context.fill();
  context.strokeStyle = '#000000';
  context.stroke();
}
</script>

<style>
.canvas-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.toolbar {
  padding: 10px;
  background: #f0f0f0;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.toolbar button {
  padding: 5px 10px;
  cursor: pointer;
  border: 1px solid #ccc;
  background: white;
  border-radius: 3px;
}

.toolbar button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.color-picker {
  display: flex;
  align-items: center;
  gap: 5px;
}

.transform-controls {
  display: flex;
  gap: 5px;
  margin-left: auto;
}

canvas {
  background-image: radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px);
  background-size: 20px 20px;
  background-color: #d5d6d2;
  border: 1px solid #ddd;
  cursor: crosshair;
  flex-grow: 1;
}
</style>
