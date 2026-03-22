import type { DashboardSnapshot, VaultMutationResponse } from "@/types/dashboard";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function fetchDashboardSnapshot() {
  return fetchJson<DashboardSnapshot>("/dashboard");
}

export function postDeposit(amountUsd: number, wallet = "guest") {
  return fetchJson<VaultMutationResponse>("/vault/deposit", {
    method: "POST",
    body: JSON.stringify({ amountUsd, wallet }),
  });
}
