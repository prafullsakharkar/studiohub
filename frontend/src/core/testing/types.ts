export type TestLevel = 'unit' | 'integration' | 'e2e';

export type DomainType = 'Platform' | 'Organization' | 'Production' | 'Cross-Cutting';

export type TestPriority = 'critical' | 'high' | 'medium' | 'low';

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'blocked' | 'not_implemented' | 'pending';

export type AutomationStatus = 'automated' | 'manual' | 'gap';

export interface TestCase {
  id: string;
  name: string;
  description: string;
  domain?: DomainType;
  entity?: string;
  feature?: string;
  category?: string;
  testLevel?: TestLevel;
  priority?: TestPriority;
  tags?: string[];
  preconditions?: string[];
  steps?: string[];
  expectedResult?: string;
  permission?: string;
  scope?: string;
  context?: string;
  automationStatus?: AutomationStatus;
  run: () => Promise<TestResult>;
}

export interface TestResult {
  passed: boolean;
  durationMs: number;
  message: string;
  details?: any;
  error?: string;
  request?: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
  };
  response?: {
    status: number;
    data?: any;
    headers?: Record<string, string>;
  };
  diagnostics?: string[];
  timestamp?: string;
}

export interface TestGroup {
  id: string;
  title: string;
  description: string;
  domain?: DomainType;
  tests: TestCase[];
}

export interface FeatureInventoryItem {
  id: string;
  domain: DomainType;
  entity: string;
  feature: string;
  description: string;
  route?: string;
  component?: string;
  coveredByTests: string[];
  coverageStatus: 'covered' | 'partial' | 'gap';
}

export interface CoverageBreakdown {
  total: number;
  passing: number;
  failing: number;
  skipped: number;
  gaps: number;
  coveragePct: number;
}

export interface TestCoverageReport {
  overall: CoverageBreakdown;
  byLevel: Record<TestLevel, CoverageBreakdown>;
  byDomain: Record<DomainType, CoverageBreakdown>;
  byCategory: Record<string, CoverageBreakdown>;
  gaps: FeatureInventoryItem[];
}

export interface TestRunHistoryItem {
  id: string;
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  runMode: 'all' | 'selected' | 'failed' | 'domain' | 'level';
  coveragePct: number;
}
