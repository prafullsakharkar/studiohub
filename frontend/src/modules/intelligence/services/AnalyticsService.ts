import { ApiClient } from '@/api/client/ApiClient';
import {
  AnalyticsDashboard,
  AnalyticsDomain,
} from '@/types/intelligence';

class AnalyticsService {
  private api = new ApiClient('/api/v1');

  async getDashboard(domain: AnalyticsDomain): Promise<AnalyticsDashboard> {
    const response = await this.api.get<AnalyticsDashboard>(`/intelligence/analytics/${domain}/`);
    return response;
  }

  async getAvailableDomains(): Promise<{
    id: AnalyticsDomain;
    label: string;
    description: string;
    icon: string;
  }[]> {
    // Static list — could be moved to backend /intelligence/analytics/domains/ in future
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
