# API Client

The frontend talks to the DRF backend through a single **`ky`** instance in `shared/api/client.ts`. No component or hook calls `ky`/`fetch` directly — everything goes through this client and the module-level `api/` wrappers.

Ky was chosen over Axios for this stack: it's fetch-based (smaller surface area, fewer historical CVEs than Axios's XHR-based redirect/proxy handling), has built-in retry/timeout, and its `hooks` model maps cleanly onto the token-attach / 401-refresh flow the Identity module requires. See `authentication.md` for the security reasoning behind token handling itself — this doc covers the transport layer.

## Base Client

```ts
// src/shared/api/client.ts
import ky from "ky";
import { useSessionStore } from "@/shared/stores/session";
import { refreshAccessToken } from "@/modules/identity/api/auth.api";

let refreshPromise: Promise<string> | null = null;

export const apiClient = ky.create({
  prefixUrl: import.meta.env.VITE_API_BASE_URL,
  timeout: 15_000,
  retry: {
    limit: 2,
    methods: ["get", "put", "head", "delete", "options", "trace"], // never auto-retry POST/PATCH
    statusCodes: [408, 429, 502, 503, 504],
  },
  hooks: {
    beforeRequest: [
      (request) => {
        const token = useSessionStore.getState().accessToken;
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status !== 401) return response;

        // Never try to refresh the refresh call itself
        if (request.url.includes("/auth/refresh")) {
          useSessionStore.getState().logout();
          return response;
        }

        try {
          // Coalesce concurrent refreshes into a single in-flight request
          refreshPromise ??= refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
          const newToken = await refreshPromise;
          useSessionStore.getState().setAccessToken(newToken);

          request.headers.set("Authorization", `Bearer ${newToken}`);
          return ky(request, options);
        } catch {
          useSessionStore.getState().logout();
          return response;
        }
      },
    ],
    beforeError: [
      async (error) => {
        error.normalized = await normalizeApiError(error);
        return error;
      },
    ],
  },
});
```

## Error Normalization

DRF's default error envelope (and any custom exception handler in `03-backend/development-guide.md`) is mapped into one consistent shape the rest of the app consumes — components never touch raw `HTTPError` from ky:

```ts
export interface ApiError {
  status: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

async function normalizeApiError(error: HTTPError): Promise<ApiError> {
  const status = error.response?.status ?? 0;
  let body: any = {};
  try {
    body = await error.response.json();
  } catch {
    /* non-JSON error body, e.g. 502 from nginx */
  }

  return {
    status,
    code: body.code ?? "unknown_error",
    message: body.message ?? body.detail ?? "Something went wrong. Please try again.",
    fieldErrors: body.errors, // DRF validator field errors -> react-hook-form via applyServerErrors (forms.md)
  };
}
```

## Module API Files

Each module wraps `apiClient` with typed, resource-specific functions, matching DRF ViewSet URLs and the pagination/filtering/ordering conventions in `05-api/pagination.md`, `05-api/filtering.md`, `05-api/sorting.md`:

```ts
// src/modules/organization/api/departments.api.ts
import { apiClient } from "@/shared/api/client";
import type { Department, DepartmentFilters, Paginated } from "../types";

export const departmentsApi = {
  list: (filters: DepartmentFilters) =>
    apiClient
      .get("organizations/departments/", { searchParams: toSearchParams(filters) })
      .json<Paginated<Department>>(),

  get: (id: string) =>
    apiClient.get(`organizations/departments/${id}/`).json<Department>(),

  create: (payload: CreateDepartmentPayload) =>
    apiClient.post("organizations/departments/", { json: payload }).json<Department>(),

  update: (id: string, payload: UpdateDepartmentPayload) =>
    apiClient.patch(`organizations/departments/${id}/`, { json: payload }).json<Department>(),

  remove: (id: string) => apiClient.delete(`organizations/departments/${id}/`),
};
```

## Large Asset Uploads (VFX-specific)

Ky (like all `fetch`-based clients) has no reliable native **upload** progress across browsers. For a VFX platform where users upload plates, renders, and versions (`Production` module: Versions, Publishing, Deliveries), this matters — a progress bar is a UX requirement, not a nicety.

Two isolated paths, deliberately not forced through `apiClient`:

1. **Small assets/thumbnails/attachments** (< ~10MB): fine through `apiClient` as a normal `POST` with `FormData`.
2. **Large media (plates, renders, versions)**: uploaded directly to storage via a presigned URL issued by the backend, using `XMLHttpRequest` (for `upload.onprogress`) or a resumable client like `tus-js-client` if the backend supports chunked/resumable uploads. This keeps large binary transfer off the main API request/response path and off Django's request cycle entirely.

```ts
// src/modules/production/api/uploadAsset.ts
// Deliberately uses XHR directly — this is the one place in the app that
// does not go through ky/apiClient, because upload progress requires it.
export function uploadAssetWithProgress(
  presignedUrl: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presignedUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(xhr.statusText)));
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}
```

## CSRF

Since auth is JWT-bearer (`Authorization` header), not Django session cookies, standard CSRF protection is not needed for authenticated API calls — CSRF exploits rely on the browser *automatically* attaching credentials (cookies), which a bearer header never does. The one exception: if the refresh token is stored as an `httpOnly` cookie (recommended — see `authentication.md`), the refresh endpoint itself should be protected with `SameSite=Strict` (or `Lax`) on that cookie, which is set by the backend, not the frontend.

## Environment Configuration

`VITE_API_BASE_URL` and any asset-storage base URL are defined per environment (`.env.development`, `.env.production`), consistent with `01-getting-started/environment.md`. These are build-time values baked into the client bundle — never put secrets in them, since anything `VITE_`-prefixed ships to the browser.
