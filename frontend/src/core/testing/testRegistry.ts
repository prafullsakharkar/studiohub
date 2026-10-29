import {
  FeatureInventoryItem,
  TestCase,
  TestCoverageReport,
  CoverageBreakdown,
  TestLevel,
  DomainType,
  TestResult,
} from './types';

export const FEATURE_INVENTORY: FeatureInventoryItem[] = [
  // PLATFORM DOMAIN
  {
    id: 'FEAT-PLAT-001',
    domain: 'Platform',
    entity: 'Platform Administration',
    feature: 'Master Data CRUD (Departments, Positions, Software)',
    description: 'Management of global departments, positions, software, and versions',
    route: '/platform/departments',
    coveredByTests: ['PLATFORM-MD-001', 'PLATFORM-MD-002', 'PLATFORM-MD-003'],
    coverageStatus: 'covered',
  },
  {
    id: 'FEAT-PLAT-002',
    domain: 'Platform',
    entity: 'Platform Roles & Groups',
    feature: 'RBAC Catalog & Permission Matrices',
    description: 'System-wide role definitions, access groups, and global permission catalog',
    route: '/platform/roles',
    coveredByTests: ['PLATFORM-RBAC-001', 'PLATFORM-RBAC-002'],
    coverageStatus: 'covered',
  },
  {
    id: 'FEAT-PLAT-003',
    domain: 'Platform',
    entity: 'Task & Asset Types',
    feature: 'Production Type Registries',
    description: 'Global registry for Task Types, Asset Types, Shot Types, and Review Types',
    route: '/platform/task-types',
    coveredByTests: ['PLATFORM-TYPES-001', 'PLATFORM-TYPES-002'],
    coverageStatus: 'covered',
  },

  // PRODUCTION DOMAIN
  {
    id: 'FEAT-PROD-001',
    domain: 'Production',
    entity: 'Project & Show',
    feature: 'Project Workspace & Show Tracking',
    description: 'Full project lifecycle, show schedules, budgets, and multi-show hierarchy',
    route: '/projects',
    coveredByTests: ['PROJECT-CRUD-001', 'SHOW-CRUD-001', 'PROJECT-SETTINGS-001'],
    coverageStatus: 'covered',
  },
  {
    id: 'FEAT-PROD-002',
    domain: 'Production',
    entity: 'Editorial & Sequences',
    feature: 'Sequence Breakdown & Shot Tracking',
    description: 'Sequence creation, frame range validation, editorial cuts, and shot associations',
    route: '/shots',
    coveredByTests: ['SEQ-CRUD-001', 'SEQ-FRAMES-001'],
    coverageStatus: 'covered',
  },
  {
    id: 'FEAT-PROD-003',
    domain: 'Production',
    entity: 'Shots & Assets',
    feature: 'VFX Shot & Asset Management',
    description: 'Shot complexity, status transitions, asset categories, and entity linking',
    route: '/shots',
    coveredByTests: ['SHOT-CRUD-001', 'ASSET-CRUD-001', 'SHOT-ASSET-LINK-001'],
    coverageStatus: 'covered',
  },
  {
    id: 'FEAT-PROD-004',
    domain: 'Production',
    entity: 'Tasks & Workflow',
    feature: 'Task Assignment & State Transitions',
    description: 'Task assignment to artists, start/pause/complete workflows, time logs, and dependencies',
    route: '/tasks',
    coveredByTests: ['TASK-CRUD-001', 'TASK-WORKFLOW-001', 'TASK-ASSIGN-001'],
    coverageStatus: 'covered',
  },
  {
    id: 'FEAT-PROD-005',
    domain: 'Production',
    entity: 'Versions & Reviews',
    feature: 'Daily Reviews, Approvals & Annotations',
    description: 'Media version submission, review playlists, client approval/rejection, and note annotations',
    route: '/reviews',
    coveredByTests: ['VERSION-CRUD-001', 'REVIEW-APPROVAL-001', 'REVIEW-NOTES-001'],
    coverageStatus: 'covered',
  },
  {
    id: 'FEAT-PROD-006',
    domain: 'Production',
    entity: 'Deliveries & Manifests',
    feature: 'Client Packaging & Dispatch',
    description: 'Delivery package creation, checksum validation, and client package release',
    route: '/deliveries',
    coveredByTests: ['DELIVERY-CRUD-001', 'DELIVERY-CHECKSUM-001'],
    coverageStatus: 'covered',
  },

  // CROSS-CUTTING DOMAIN
  {
    id: 'FEAT-CROSS-001',
    domain: 'Cross-Cutting',
    entity: 'RBAC & Authorization',
    feature: 'Permission Matrix & Field-Level Masking',
    description: 'Role-based access evaluation, restricted action blocking, and sensitive data masking',
    coveredByTests: ['RBAC-PERM-001', 'RBAC-MASKING-001', 'RBAC-ACTIONS-001'],
    coverageStatus: 'covered',
  },
  {
    id: 'FEAT-CROSS-002',
    domain: 'Cross-Cutting',
    entity: 'Multi-Tenant Isolation',
    feature: 'Tenant & Project Scoped Queries',
    description: 'Zero data leakage between projects and shows across all queries',
    coveredByTests: ['SECURITY-ISOLATION-001', 'SECURITY-IDOR-001'],
    coverageStatus: 'covered',
  },
  {
    id: 'FEAT-CROSS-003',
    domain: 'Cross-Cutting',
    entity: 'API Error Handling',
    feature: 'Resilient Error Classification & Retries',
    description: 'Unified handling of 400, 401, 403, 404, 409, 422, 429, 500, and offline network state',
    coveredByTests: ['API-ERR-400', 'API-ERR-401', 'API-ERR-403', 'API-ERR-404', 'API-ERR-500'],
    coverageStatus: 'covered',
  },
  {
    id: 'FEAT-CROSS-004',
    domain: 'Cross-Cutting',
    entity: 'Bulk Operations',
    feature: 'Batch Create, Update & Deduplication',
    description: 'Bulk shot/task import, validation, duplicate resolution, and batch status transitions',
    coveredByTests: ['BULK-CREATE-001', 'BULK-DEDUP-001', 'BULK-STATUS-001'],
    coverageStatus: 'covered',
  },
  {
    id: 'FEAT-CROSS-005',
    domain: 'Cross-Cutting',
    entity: 'Search & Filters',
    feature: 'Multi-Field Filtering & Saved Views',
    description: 'DRF query filtering, multi-column sort, global search, and custom saved views',
    coveredByTests: ['SEARCH-FILTERS-001', 'SEARCH-SORT-001', 'SEARCH-VIEWS-001'],
    coverageStatus: 'covered',
  },
  {
    id: 'FEAT-CROSS-006',
    domain: 'Cross-Cutting',
    entity: 'Accessibility & Responsive',
    feature: 'WCAG AA Compliance & Breakpoints',
    description: 'ARIA labels, keyboard navigation, contrast compliance, and responsive layouts (768-1920px)',
    coveredByTests: ['A11Y-ARIA-001', 'A11Y-KEYBOARD-001', 'RESPONSIVE-BREAKPOINTS-001'],
    coverageStatus: 'covered',
  },
];

export class TestRegistryManager {
  public static calculateCoverage(tests: TestCase[], results: Record<string, TestResult>): TestCoverageReport {
    const totalTests = tests.length;
    let passing = 0;
    let failing = 0;
    let skipped = 0;

    const byLevel: Record<TestLevel, CoverageBreakdown> = {
      unit: { total: 0, passing: 0, failing: 0, skipped: 0, gaps: 0, coveragePct: 0 },
      integration: { total: 0, passing: 0, failing: 0, skipped: 0, gaps: 0, coveragePct: 0 },
      e2e: { total: 0, passing: 0, failing: 0, skipped: 0, gaps: 0, coveragePct: 0 },
    };

    const byDomain: Record<DomainType, CoverageBreakdown> = {
      Platform: { total: 0, passing: 0, failing: 0, skipped: 0, gaps: 0, coveragePct: 0 },
      Organization: { total: 0, passing: 0, failing: 0, skipped: 0, gaps: 0, coveragePct: 0 },
      Production: { total: 0, passing: 0, failing: 0, skipped: 0, gaps: 0, coveragePct: 0 },
      'Cross-Cutting': { total: 0, passing: 0, failing: 0, skipped: 0, gaps: 0, coveragePct: 0 },
    };

    const byCategory: Record<string, CoverageBreakdown> = {};

    tests.forEach((t) => {
      const res = results[t.id];
      const isPassed = res?.passed === true;
      const isFailed = res && !res.passed;
      const isSkipped = !res;

      if (isPassed) passing++;
      if (isFailed) failing++;
      if (isSkipped) skipped++;

      const lvl = t.testLevel || 'integration';
      const dom = t.domain || 'Production';
      const cat = t.category || 'General';

      // By Level
      if (byLevel[lvl]) {
        byLevel[lvl].total++;
        if (isPassed) byLevel[lvl].passing++;
        if (isFailed) byLevel[lvl].failing++;
        if (isSkipped) byLevel[lvl].skipped++;
      }

      // By Domain
      if (byDomain[dom]) {
        byDomain[dom].total++;
        if (isPassed) byDomain[dom].passing++;
        if (isFailed) byDomain[dom].failing++;
        if (isSkipped) byDomain[dom].skipped++;
      }

      // By Category
      if (!byCategory[cat]) {
        byCategory[cat] = { total: 0, passing: 0, failing: 0, skipped: 0, gaps: 0, coveragePct: 0 };
      }
      byCategory[cat].total++;
      if (isPassed) byCategory[cat].passing++;
      if (isFailed) byCategory[cat].failing++;
      if (isSkipped) byCategory[cat].skipped++;
    });

    // Calculate percentages
    const calcPct = (p: number, t: number) => (t > 0 ? Math.round((p / t) * 100) : 0);

    const overall: CoverageBreakdown = {
      total: totalTests,
      passing,
      failing,
      skipped,
      gaps: 0,
      coveragePct: calcPct(passing, totalTests),
    };

    Object.keys(byLevel).forEach((k) => {
      const lvl = k as TestLevel;
      byLevel[lvl].coveragePct = calcPct(byLevel[lvl].passing, byLevel[lvl].total);
    });

    Object.keys(byDomain).forEach((k) => {
      const dom = k as DomainType;
      byDomain[dom].coveragePct = calcPct(byDomain[dom].passing, byDomain[dom].total);
    });

    Object.keys(byCategory).forEach((cat) => {
      byCategory[cat].coveragePct = calcPct(byCategory[cat].passing, byCategory[cat].total);
    });

    // Identify gaps from feature inventory
    const testedIds = new Set(tests.map((t) => t.id));
    const gaps = FEATURE_INVENTORY.filter(
      (feat) => feat.coveredByTests.length === 0 || feat.coveredByTests.some((id) => !testedIds.has(id))
    );

    return {
      overall,
      byLevel,
      byDomain,
      byCategory,
      gaps,
    };
  }

  public static exportReportAsJson(tests: TestCase[], results: Record<string, TestResult>): string {
    const reportData = tests.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      domain: t.domain,
      entity: t.entity,
      feature: t.feature,
      category: t.category,
      level: t.testLevel,
      priority: t.priority,
      tags: t.tags,
      preconditions: t.preconditions,
      steps: t.steps,
      expectedResult: t.expectedResult,
      status: results[t.id]?.passed ? 'PASSED' : results[t.id] ? 'FAILED' : 'PENDING',
      durationMs: results[t.id]?.durationMs ?? 0,
      message: results[t.id]?.message ?? 'Not executed',
      error: results[t.id]?.error,
      diagnostics: results[t.id]?.diagnostics,
      timestamp: results[t.id]?.timestamp || new Date().toISOString(),
    }));

    return JSON.stringify(
      {
        appName: 'StudioHub Production Test Suite',
        generatedAt: new Date().toISOString(),
        totalTests: tests.length,
        results: reportData,
      },
      null,
      2
    );
  }

  public static exportReportAsCsv(tests: TestCase[], results: Record<string, TestResult>): string {
    const headers = [
      'Test ID',
      'Name',
      'Domain',
      'Entity',
      'Level',
      'Category',
      'Priority',
      'Status',
      'Duration (ms)',
      'Message',
    ];

    const rows = tests.map((t) => {
      const res = results[t.id];
      const status = res?.passed ? 'PASSED' : res ? 'FAILED' : 'PENDING';
      const duration = res?.durationMs ?? 0;
      const message = (res?.message ?? '').replace(/"/g, '""');
      return `"${t.id}","${t.name.replace(/"/g, '""')}","${t.domain}","${t.entity}","${t.testLevel}","${t.category}","${t.priority}","${status}",${duration},"${message}"`;
    });

    return [headers.join(','), ...rows].join('\n');
  }
}
