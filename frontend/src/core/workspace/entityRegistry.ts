import { UniversalEntityType, UniversalEntityDetail, EntityReference } from '@/types/workspace';

// REST-only: mock collections removed. Real entity detail is loaded via API hooks.
// Kept as empty arrays so any legacy imports don't break at runtime.
export const mockSequences: any[] = [];
export const mockNotes: any[] = [];
export const mockDeliveries: any[] = [];
export const mockSchedules: any[] = [];
export const mockResources: any[] = [];

/**
 * Universal Entity Resolver (REST-only stub)
 * Returns null — real detail is loaded via API hooks.
 */
export function resolveEntity(type: UniversalEntityType, id: string): UniversalEntityDetail | null {
  void type;
  void id;
  return null;
}

/**
 * Universal Global Search (REST-only stub)
 * Returns [] — real search goes through /api/v1/* endpoints.
 */
export function searchUniversalEntities(query: string, filterType?: UniversalEntityType): EntityReference[] {
  void query;
  void filterType;
  return [];
}

/**
 * Format entity type into human label
 */
export function formatEntityType(type: UniversalEntityType): string {
  const map: Record<UniversalEntityType, string> = {
    client: 'Client Studio',
    vendor: 'Vendor Partner',
    person: 'Crew Member',
    department: 'Department',
    team: 'Squad / Team',
    office: 'Office Facility',
    project: 'Project Show',
    sequence: 'Sequence',
    shot: 'Shot Cut',
    asset: 'Asset Element',
    task: 'Task Item',
    version: 'Published Version',
    review: 'Review Session',
    note: 'Supervisor Directive',
    delivery: 'Client Delivery',
    schedule: 'Schedule Milestone',
    resource: 'Compute / SAN Resource',
    publishing: 'USD Publish Record',
    playlist: 'Review Playlist / Reel',
    workflow: 'Pipeline Workflow DAG',
    timelog: 'Artist Timelog',
    calendar: 'Production Calendar',
    media: 'Source Media / Plate',
    attachment: 'Production Attachment',
  };
  return map[type] || type;
}
