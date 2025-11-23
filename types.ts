export enum ProjectColor {
  WHITE = 'bg-white',
  BLUE = 'bg-blue-50',
  YELLOW = 'bg-yellow-50',
  GREEN = 'bg-green-50',
  RED = 'bg-red-50',
  PURPLE = 'bg-purple-50',
}

export type PriorityLevel = 'none' | 'low' | 'medium' | 'high';

export interface Coordinates {
  x: number;
  y: number;
}

export interface ProjectNote {
  id: string;
  title: string;
  content: string; // Now stores HTML
  x: number;
  y: number;
  width: number;
  height: number;
  color: ProjectColor;
  createdAt: number;
  tags: string[];
  priority: PriorityLevel;
}

export interface CanvasState {
  offset: Coordinates;
  zoom: number;
}

export interface User {
  name: string;
  email: string;
  picture: string;
  accessToken: string;
}