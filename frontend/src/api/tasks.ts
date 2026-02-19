import { api } from './client';
import type { Task, TaskFormData } from '../types';
import type { PaginatedResponse } from '../types';

export async function fetchTasks(params?: {
  page?: number;
  per_page?: number;
  status?: string;
  priority?: string;
}): Promise<PaginatedResponse<Task>> {
  const { data } = await api.get<PaginatedResponse<Task>>('/tasks', { params });
  return data;
}

export async function fetchTask(id: number): Promise<Task> {
  const { data } = await api.get<Task>(`/tasks/${id}`);
  return data;
}

export async function createTask(payload: TaskFormData): Promise<Task> {
  const { data } = await api.post<Task>('/tasks', payload);
  return data;
}

export async function updateTask(id: number, payload: Partial<TaskFormData>): Promise<Task> {
  const { data } = await api.patch<Task>(`/tasks/${id}`, payload);
  return data;
}

export async function deleteTask(id: number): Promise<void> {
  await api.delete(`/tasks/${id}`);
}
