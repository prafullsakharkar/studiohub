/**
 * Standard Django REST Framework Paginated Response Envelope
 */
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Standard query parameters for DRF endpoints
 */
export interface QueryParams {
  page?: number;
  page_size?: number;
  limit?: number;
  offset?: number;
  search?: string;
  ordering?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Standard DRF error envelope
 */
export interface DrfErrorResponse {
  detail?: string;
  non_field_errors?: string[];
  [field: string]: string | string[] | undefined;
}
