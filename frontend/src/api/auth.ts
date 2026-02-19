import { api } from './client';
import type { User } from '../types';

export interface LoginResponse {
  token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface RegisterResponse {
  message: string;
  user: User;
  token: string;
  token_type: string;
  expires_in: number;
}

export async function register(
  name: string,
  email: string,
  password: string,
  passwordConfirmation: string
): Promise<RegisterResponse> {
  const { data } = await api.post<RegisterResponse>('/auth/register', {
    name,
    email,
    password,
    password_confirmation: passwordConfirmation,
  });
  return data;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}
