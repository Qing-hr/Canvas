export type ShapeType = 'rect' | 'circle' | 'triangle';

export interface BaseShape {
  x: number;
  y: number;
  color: string;
  type: ShapeType;
  rotation: number;
  scale: number;
  flipX: boolean;
  flipY: boolean;
  isSelected: boolean;
}

export interface RectShape extends BaseShape {
  type: 'rect';
  width: number;
  height: number;
}

export interface CircleShape extends BaseShape {
  type: 'circle';
  radius: number;
}

export interface TriangleShape extends BaseShape {
  type: 'triangle';
  points: [number, number][];
}

export type Shape = RectShape | CircleShape | TriangleShape;

// 图形工厂函数
export const createRect = (
  x: number, 
  y: number, 
  width: number, 
  height: number, 
  color: string = '#ff0000'
): RectShape => ({
  x, y, width, height, color,
  type: 'rect',
  rotation: 0,
  scale: 1,
  flipX: false,
  flipY: false,
  isSelected: false
});

export const createCircle = (
  x: number,
  y: number,
  radius: number,
  color: string = '#0000ff'
): CircleShape => ({
  x, y, radius, color,
  type: 'circle',
  rotation: 0,
  scale: 1,
  flipX: false,
  flipY: false,
  isSelected: false
});

export const createTriangle = (
  x: number,
  y: number,
  points: [number, number][],
  color: string = '#00ff00'
): TriangleShape => ({
  x, y, points, color,
  type: 'triangle',
  rotation: 0,
  scale: 1,
  flipX: false,
  flipY: false,
  isSelected: false
});