/**
 * StudioHub — REST-only API configuration.
 *
 * The frontend talks exclusively to the live Django REST API.
 * There is no mock mode, no MSW, and no runtime switching.
 */

export interface ApiConfig {
  baseUrl: string;
}

/**
 * Resolve environment variables safely in Vite browser and test environments.
 */
function getEnvVariables(): Record<string, string | undefined> {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  if (metaEnv) {
    return metaEnv;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env as unknown as Record<string, string | undefined>;
  }
  return {};
}

/**
 * Get the target base URL for REST network requests.
 */
export function getApiBaseUrl(): string {
  const env = getEnvVariables();
  const customUrl = env.VITE_API_URL?.trim();
  if (customUrl && customUrl.length > 0) {
    return customUrl.endsWith('/') ? customUrl.slice(0, -1) : customUrl;
  }
  return '';
}

/**
 * Get the unified ApiConfig snapshot.
 */
export function getApiConfig(): ApiConfig {
  return {
    baseUrl: getApiBaseUrl(),
  };
}
