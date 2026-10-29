import { mapHttpError } from '@/api/errors/errorMapper';

/**
 * Text for a failed action. For 4xx answers the backend's own sentence is the useful one ("This user
 * is already linked to another person."), whereas `userMessage` is a generic line per status class.
 * 401 (session) and 5xx keep the generic text: the server's wording there is not for end users.
 */
export function errorText(error: unknown): string {
  const apiError = mapHttpError(error);
  const serverSaid = apiError.status >= 400 && apiError.status < 500 && apiError.status !== 401;
  return (serverSaid && apiError.message) || apiError.userMessage || apiError.message;
}
