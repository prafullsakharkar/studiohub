# State Management

| State type | Tool | Examples |
|---|---|---|
| Server state | **TanStack Query** (already in `package.json`) | shots, departments, versions — anything from the DRF API |
| Global client/UI state | **Zustand** *(recommended addition — not yet in `package.json`)* | session (access token, current user), sidebar state, active theme/direction |
| Local component state | `useState`/`useReducer` | form draft, modal open, MRT column visibility |
| Toast/notifications | **notistack** (already present) | success/error toasts from mutations |

## Adding Zustand

Nothing in the current dependency list manages cross-cutting client state — there's no Redux, Jotai, or Context-based store. Given the security requirement that the access token live in memory (`authentication.md`), a small dedicated store is the right tool rather than React Context (Context re-renders are harder to scope/optimize for something read on every request).

```bash
npm install zustand
```

```ts
// src/shared/stores/session.ts
import { create } from "zustand";

interface SessionState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAccessToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: () => set({ accessToken: null, user: null, isAuthenticated: false }),
}));
```

Note: the session store deliberately does **not** use Zustand's `persist` middleware for `accessToken` — persisting it to `localStorage`/`sessionStorage` would undo the in-memory-only guarantee from `authentication.md`. Only non-sensitive UI state (theme, direction, sidebar collapsed) is persisted.

```ts
// src/shared/stores/ui.ts
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({ theme: "system", direction: "ltr", sidebarCollapsed: false, /* ... */ }),
    { name: "studiohub-ui-preferences" }
  )
);
```

## Server State — TanStack Query

Query keys are centralized per module:

```ts
// src/modules/production/hooks/useShots.ts
export const shotKeys = {
  all: ["shots"] as const,
  list: (filters: ShotFilters) => [...shotKeys.all, "list", filters] as const,
  detail: (id: string) => [...shotKeys.all, "detail", id] as const,
};

export function useShots(filters: ShotFilters) {
  return useQuery({
    queryKey: shotKeys.list(filters),
    queryFn: () => shotsApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateShotStatus() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar(); // notistack
  return useMutation({
    mutationFn: shotsApi.updateStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shotKeys.all });
      enqueueSnackbar("Shot status updated", { variant: "success" });
    },
    onError: (error: ApiError) => {
      enqueueSnackbar(error.message, { variant: "error" });
    },
  });
}
```

- `staleTime` is set per-resource by volatility: reference data (offices, roles, positions) gets minutes; production-tracking data (shot/task status, review state) stays near-zero given how quickly it changes during active production.
- Mutations invalidate rather than manually patch the cache, except for high-frequency inline edits (e.g. editing a task status directly in a Material React Table cell), which use optimistic updates with explicit `onError` rollback.
- `queryClient.clear()` is called on logout (`authentication.md`) — non-negotiable given shared review-room workstations are common in VFX studios.

## Global QueryClient Defaults

```ts
// src/app/providers.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: true },
    mutations: {
      onError: (error) => {
        enqueueSnackbar((error as ApiError).message, { variant: "error" });
      },
    },
  },
});
```

`@tanstack/react-query-devtools` (already in `package.json`) is mounted only in development builds.
