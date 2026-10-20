import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Match, Person, Profile, Venue } from '@matchplay/shared/game';
import { useToast } from './toast-context';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function getErrorMessage(result: unknown, fallback: string) {
  if (!result || typeof result !== 'object') return fallback;
  const message = 'message' in result ? String((result as { message?: unknown }).message ?? '') : '';
  const errors = 'error' in result ? (result as { error?: unknown }).error : undefined;
  if (typeof errors === 'string' && errors.trim()) return errors;
  if (message.trim()) return message;
  return fallback;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => ({}));
  const message = getErrorMessage(result, 'Could not complete this action.');

  if (!response.ok) {
    if (response.status === 429) {
      throw new ApiError(429, 'Too many attempts. Please wait a moment and try again.');
    }

    if (response.status === 401) {
      throw new ApiError(401, message || 'Sign in to continue.');
    }

    if (response.status === 403) {
      throw new ApiError(403, message || 'This action is not allowed.');
    }

    throw new ApiError(response.status, message);
  }

  if (result?.serverTime) result.serverOffset = Date.parse(result.serverTime) - Date.now();
  return result as T;
}

export const json = (body: unknown, method = 'POST'): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<Person | null>('/me'),
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
      return failureCount < 2;
    },
  });
}

export function useVenues() {
  return useQuery({
    queryKey: ['venues'],
    queryFn: () => api<Venue[]>('/venues'),
    staleTime: 60_000,
  });
}

export function useProfile() {
  return useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/profile'), retry: false });
}

export function useMatch(id: string) {
  return useQuery({
    queryKey: ['match', id],
    queryFn: () => api<Match>(`/matches/${id}`),
    retry: false,
    refetchInterval: 15_000,
  });
}

export function useAction<TInput, TOutput = unknown>(
  run: (input: TInput) => Promise<TOutput>,
  success?: string,
) {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await Promise.all(
        ['matches', 'venues', 'profile', 'match', 'admin'].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
      if (success) toast(success);
    },
    onError: (error: Error) => {
      toast(error.message || 'Something went wrong. Please try again.', 'error');
    },
  });
}
