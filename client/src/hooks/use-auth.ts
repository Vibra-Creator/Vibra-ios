import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";

async function fetchUser(): Promise<User | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s max
  try {
    const response = await fetch("/api/auth/user", {
      credentials: "include",
      signal: controller.signal,
    });
    if (response.status === 401) return null;
    if (!response.ok) return null; // treat server errors as unauthenticated, not infinite spinner
    return response.json();
  } catch {
    return null; // timeout or network error → unauthenticated, never hang
  } finally {
    clearTimeout(timeout);
  }
}

async function logout(): Promise<void> {
  await fetch("/api/logout", {
    method: "POST",
    credentials: "include",
  });
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      window.location.href = "/";
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
