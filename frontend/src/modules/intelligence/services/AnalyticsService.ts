import {
  AnalyticsDashboard,
  AnalyticsDomain,
} from '@/types/intelligence';
import { getDomainAnalyticsDashboard } from '@/mocks/db/intelligence/analytics';

class AnalyticsService {
  async getDashboard(domain: AnalyticsDomain): Promise<AnalyticsDashboard> {
    await new Promise((r) => setTimeout(r, 40));
    return getDomainAnalyticsDashboard(domain);
  }

  async getAvailableDomains(): Promise<{
    id: AnalyticsDomain;
    label: string;
    description: string;
    icon: string;
  }[]> {
    return [
      { id: 'projects', label: 'Projects & Shows', description: 'Show burn-down & budget tracking', icon: 'Film' },
      { id: 'production', label: 'Shot Production', description: 'Sequence stages & revisions', icon: 'Clapperboard' },
      { id: 'tasks', label: 'Task Execution', description: 'Department velocity & roadblocks', icon: 'CheckSquare' },
      { id: 'artists', label: 'Artists & Teams', description: 'Workload & utilization balance', icon: 'Users' },
      { id: 'vendors', label: 'Vendors & Partners', description: 'External turnaround & SLA', icon: 'Briefcase' },
      { id: 'resources', label: 'Compute Farm & Storage', description: 'GPU blades & NVMe quotas', icon: 'Cpu' },
      { id: 'delivery', label: 'Deliveries & Reviews', description: 'Aspera transfers & dailies', icon: 'Send' },
    ];
  }
}

export const analyticsService = new AnalyticsService();
