import {
  AnalyticsDashboard,
  AnalyticsDomain,
  KPIMetric,
  DashboardWidgetConfig,
} from '@/types/intelligence';

import { mockProjects } from '@/mocks/db/production/projects';
import { mockShots } from '@/mocks/db/production/shots';
import { mockTasks } from '@/mocks/db/tasks/tasks';
import { mockReviews } from '@/mocks/db/reviews/reviews';
import { mockPeople, mockVendors, mockClients, mockDepartments } from '@/mocks/db/organization/organization';
import { mockProductionKpis } from '@/mocks/db/analytics/metrics';

export function getDomainAnalyticsDashboard(domain: AnalyticsDomain): AnalyticsDashboard {
  switch (domain) {
    case 'projects':
      return {
        id: 'dash-projects',
        domain: 'projects',
        title: 'Projects Portfolio & Velocity Analytics',
        subtitle: 'Multi-show burn-down velocity, milestone deliverables, and budget tracking',
        kpis: [
          {
            id: 'kpi-proj-1',
            label: 'Active Productions',
            value: mockProjects.length,
            target: 6,
            delta_percentage: 20,
            trend: 'up',
            trend_label: '+1 this quarter',
            status: 'optimal',
            info_tooltip: 'Currently active tier-1 and tier-2 film & episodic productions',
          },
          {
            id: 'kpi-proj-2',
            label: 'Total Studio Shots',
            value: 2340,
            target: 2500,
            delta_percentage: 12.4,
            trend: 'up',
            trend_label: '+240 in turnover',
            status: 'optimal',
          },
          {
            id: 'kpi-proj-3',
            label: 'Portfolio Approval Rate',
            value: '72.8%',
            target: '75%',
            delta_percentage: 4.6,
            trend: 'up',
            status: 'optimal',
          },
          {
            id: 'kpi-proj-4',
            label: 'Budget Variance',
            value: '-3.8%',
            delta_percentage: -1.2,
            trend: 'down',
            trend_label: 'Under budget pace',
            status: 'optimal',
          },
        ],
        widgets: [
          {
            id: 'w-proj-1',
            title: 'Project Shot Turnaround & Completion Curve',
            subtitle: 'Cumulative approved cuts vs turnover timeline',
            domain: 'projects',
            chart_type: 'area',
            span: 'col-3',
            height: 280,
            data: [
              { label: 'Week 1', NK99: 45, DUNE: 60, CP88: 20, AVTR: 15 },
              { label: 'Week 2', NK99: 98, DUNE: 130, CP88: 48, AVTR: 38 },
              { label: 'Week 3', NK99: 175, DUNE: 210, CP88: 85, AVTR: 72 },
              { label: 'Week 4', NK99: 260, DUNE: 320, CP88: 140, AVTR: 110 },
              { label: 'Week 5', NK99: 340, DUNE: 410, CP88: 195, AVTR: 150 },
              { label: 'Week 6', NK99: 383, DUNE: 485, CP88: 240, AVTR: 190 },
            ],
            data_keys: [
              { name: 'NK99', color: '#6366f1', label: 'Nebula Knights' },
              { name: 'DUNE', color: '#ec4899', label: 'Dune Sisterhood' },
              { name: 'CP88', color: '#06b6d4', label: 'Cyberpunk 2088' },
              { name: 'AVTR', color: '#10b981', label: 'Avatar Chronicles' },
            ],
          },
          {
            id: 'w-proj-2',
            title: 'Project Budget vs Actual Bids',
            subtitle: 'Actual spend against baseline bids (in thousands $)',
            domain: 'projects',
            chart_type: 'bar',
            span: 'col-1',
            height: 280,
            data: [
              { label: 'NK99', Bid: 3200, Actual: 2950 },
              { label: 'DUNE', Bid: 2800, Actual: 2680 },
              { label: 'CP88', Bid: 1900, Actual: 1850 },
              { label: 'AVTR', Bid: 4100, Actual: 3900 },
            ],
            data_keys: [
              { name: 'Bid', color: '#64748b', label: 'Bid Target' },
              { name: 'Actual', color: '#6366f1', label: 'Actual Spent' },
            ],
          },
        ],
      };

    case 'production':
      return {
        id: 'dash-production',
        domain: 'production',
        title: 'Shot Production & Pipeline Throughput',
        subtitle: 'Shot turnover lifecycle, sequence milestones, and revision churn',
        kpis: [
          {
            id: 'kpi-prod-1',
            label: 'Approved Shots',
            value: mockProductionKpis.approved_shots,
            target: 500,
            delta_percentage: 18.2,
            trend: 'up',
            status: 'optimal',
          },
          {
            id: 'kpi-prod-2',
            label: 'Pending In-Review',
            value: mockProductionKpis.pending_review_shots,
            status: 'warning',
            trend: 'up',
            trend_label: '+24 today',
          },
          {
            id: 'kpi-prod-3',
            label: 'Avg Revisions Per Shot',
            value: '3.4x',
            target: '< 4.0x',
            delta_percentage: -0.6,
            trend: 'down',
            status: 'optimal',
          },
          {
            id: 'kpi-prod-4',
            label: 'First-Pass Approval',
            value: '41.2%',
            target: '40%',
            delta_percentage: 3.1,
            trend: 'up',
            status: 'optimal',
          },
        ],
        widgets: [
          {
            id: 'w-prod-1',
            title: 'Shot Status Distribution by Sequence',
            subtitle: 'Current pipeline stages across sequence batches',
            domain: 'production',
            chart_type: 'bar',
            span: 'col-2',
            height: 270,
            data: [
              { label: 'SEQ_010', Approved: 38, InProgress: 14, Review: 8, Blocked: 2 },
              { label: 'SEQ_020', Approved: 45, InProgress: 22, Review: 12, Blocked: 1 },
              { label: 'SEQ_030', Approved: 29, InProgress: 35, Review: 16, Blocked: 4 },
              { label: 'SEQ_040', Approved: 12, InProgress: 42, Review: 18, Blocked: 6 },
            ],
            data_keys: [
              { name: 'Approved', color: '#10b981', label: 'Approved' },
              { name: 'InProgress', color: '#6366f1', label: 'In Progress' },
              { name: 'Review', color: '#f59e0b', label: 'Pending Review' },
              { name: 'Blocked', color: '#ef4444', label: 'Blocked' },
            ],
          },
          {
            id: 'w-prod-2',
            title: 'Weekly Render Output Volume (GB)',
            subtitle: 'EXR render passes generated by farm nodes',
            domain: 'production',
            chart_type: 'line',
            span: 'col-2',
            height: 270,
            data: [
              { label: 'Mon', Volume: 1420 },
              { label: 'Tue', Volume: 1890 },
              { label: 'Wed', Volume: 2340 },
              { label: 'Thu', Volume: 2890 },
              { label: 'Fri', Volume: 3100 },
              { label: 'Sat', Volume: 1600 },
              { label: 'Sun', Volume: 1200 },
            ],
            data_keys: [{ name: 'Volume', color: '#06b6d4', label: 'GB Rendered' }],
          },
        ],
      };

    case 'tasks':
      return {
        id: 'dash-tasks',
        domain: 'tasks',
        title: 'Task Execution & Departmental Flow',
        subtitle: 'Granular task completion status, cycle time, and dependency roadblocks',
        kpis: [
          {
            id: 'kpi-task-1',
            label: 'Total Active Tasks',
            value: mockTasks.length * 8 + 42,
            trend: 'up',
            status: 'optimal',
          },
          {
            id: 'kpi-task-2',
            label: 'Tasks Completed (Sprint)',
            value: 284,
            delta_percentage: 14.5,
            trend: 'up',
            status: 'optimal',
          },
          {
            id: 'kpi-task-3',
            label: 'Blocked Dependencies',
            value: 9,
            delta_percentage: -2,
            trend: 'down',
            status: 'warning',
            info_tooltip: 'Tasks paused awaiting upstream cache or tracking approval',
          },
          {
            id: 'kpi-task-4',
            label: 'Avg Task Cycle Time',
            value: '4.2 Days',
            target: '4.0 Days',
            trend: 'neutral',
            status: 'optimal',
          },
        ],
        widgets: [
          {
            id: 'w-task-1',
            title: 'Department Task Completion Rate (%)',
            subtitle: 'Progress against current milestone target',
            domain: 'tasks',
            chart_type: 'horizontal_bar',
            span: 'col-2',
            height: 270,
            data: [
              { label: 'Concept Art', Progress: 93 },
              { label: 'Modeling & Assets', Progress: 73 },
              { label: 'Rigging', Progress: 63 },
              { label: 'Character Animation', Progress: 52 },
              { label: 'FX Simulation', Progress: 40 },
              { label: 'Lighting & LookDev', Progress: 34 },
              { label: 'Compositing', Progress: 24 },
            ],
            data_keys: [{ name: 'Progress', color: '#6366f1', label: 'Completion %' }],
          },
          {
            id: 'w-task-2',
            title: 'Task Status Breakdown',
            subtitle: 'Proportion of tasks in each operational state',
            domain: 'tasks',
            chart_type: 'donut',
            span: 'col-2',
            height: 270,
            data: [
              { label: 'Approved', value: 380, color: '#10b981' },
              { label: 'In Progress', value: 240, color: '#6366f1' },
              { label: 'In Review', value: 110, color: '#f59e0b' },
              { label: 'Ready to Start', value: 85, color: '#06b6d4' },
              { label: 'Blocked', value: 25, color: '#ef4444' },
            ],
            data_keys: [{ name: 'value', color: '#6366f1' }],
          },
        ],
      };

    case 'artists':
    case 'teams':
    case 'departments':
      return {
        id: 'dash-crew',
        domain: 'artists',
        title: 'Artist & Department Resource Intelligence',
        subtitle: 'Workload distribution, weekly utilization, and skill throughput',
        kpis: [
          {
            id: 'kpi-art-1',
            label: 'Active Crew Members',
            value: mockPeople.length * 6 + 18,
            trend: 'up',
            status: 'optimal',
          },
          {
            id: 'kpi-art-2',
            label: 'Avg Studio Utilization',
            value: '84.2%',
            target: '80-85%',
            status: 'optimal',
          },
          {
            id: 'kpi-art-3',
            label: 'Overbooked Artists',
            value: 3,
            delta_percentage: -1,
            trend: 'down',
            status: 'warning',
            info_tooltip: 'Artists with scheduled hours exceeding 100% capacity',
          },
          {
            id: 'kpi-art-4',
            label: 'Sprint Velocity Points',
            value: '420 pts',
            delta_percentage: 8.4,
            trend: 'up',
            status: 'optimal',
          },
        ],
        widgets: [
          {
            id: 'w-art-1',
            title: 'Department Weekly Workload vs Capacity (Hours)',
            subtitle: 'Total hours booked against 40h/artist capacity',
            domain: 'artists',
            chart_type: 'bar',
            span: 'col-3',
            height: 280,
            data: [
              { label: 'Compositing', Allocated: 540, Capacity: 480 },
              { label: 'FX Simulation', Allocated: 490, Capacity: 400 },
              { label: 'Animation', Allocated: 380, Capacity: 400 },
              { label: 'Lighting', Allocated: 320, Capacity: 360 },
              { label: 'Matchmove', Allocated: 260, Capacity: 280 },
              { label: 'Assets', Allocated: 290, Capacity: 320 },
            ],
            data_keys: [
              { name: 'Allocated', color: '#6366f1', label: 'Allocated Hours' },
              { name: 'Capacity', color: '#64748b', label: 'Max Capacity' },
            ],
          },
          {
            id: 'w-art-2',
            title: 'Skill Discipline Distribution',
            subtitle: 'Crew count by primary department specialty',
            domain: 'artists',
            chart_type: 'donut',
            span: 'col-1',
            height: 280,
            data: [
              { label: 'Compositing', value: 16, color: '#6366f1' },
              { label: 'FX Houdini', value: 12, color: '#ec4899' },
              { label: 'Animation', value: 14, color: '#06b6d4' },
              { label: 'Lighting', value: 10, color: '#f59e0b' },
              { label: 'Other', value: 18, color: '#10b981' },
            ],
            data_keys: [{ name: 'value', color: '#6366f1' }],
          },
        ],
      };

    case 'vendors':
    case 'clients':
      return {
        id: 'dash-external',
        domain: 'vendors',
        title: 'Vendors, Partners & Client SLA Performance',
        subtitle: 'External package turnaround, review turnaround times, and contract delivery health',
        kpis: [
          {
            id: 'kpi-ext-1',
            label: 'Active Vendor Partners',
            value: mockVendors.length + 3,
            status: 'optimal',
          },
          {
            id: 'kpi-ext-2',
            label: 'Vendor On-Time SLA',
            value: '94.6%',
            target: '90%',
            delta_percentage: 2.1,
            trend: 'up',
            status: 'optimal',
          },
          {
            id: 'kpi-ext-3',
            label: 'Client Review Turnaround',
            value: '1.8 Days',
            target: '< 2.0 Days',
            delta_percentage: -0.4,
            trend: 'down',
            status: 'optimal',
          },
          {
            id: 'kpi-ext-4',
            label: 'External Dispatches (MTD)',
            value: 48,
            delta_percentage: 15,
            trend: 'up',
            status: 'optimal',
          },
        ],
        widgets: [
          {
            id: 'w-ext-1',
            title: 'Vendor Shot Turnaround Performance (Days)',
            subtitle: 'Average days from dispatch to first version delivery',
            domain: 'vendors',
            chart_type: 'bar',
            span: 'col-2',
            height: 270,
            data: [
              { label: 'PixelCraft Studios', AvgDays: 3.2, SLA: 4.0 },
              { label: 'Nova Roto & Paint', AvgDays: 2.1, SLA: 2.5 },
              { label: 'Vortex 3D Assets', AvgDays: 4.8, SLA: 5.0 },
              { label: 'CineMatch Tracking', AvgDays: 1.6, SLA: 2.0 },
            ],
            data_keys: [
              { name: 'AvgDays', color: '#6366f1', label: 'Actual Avg Days' },
              { name: 'SLA', color: '#64748b', label: 'Target SLA' },
            ],
          },
          {
            id: 'w-ext-2',
            title: 'Client Review Turnaround Velocity (Hours)',
            subtitle: 'Speed of director & studio client feedback approvals',
            domain: 'clients',
            chart_type: 'line',
            span: 'col-2',
            height: 270,
            data: [
              { label: 'Week 1', Paramount: 28, WarnerBros: 34, Universal: 42 },
              { label: 'Week 2', Paramount: 24, WarnerBros: 30, Universal: 38 },
              { label: 'Week 3', Paramount: 20, WarnerBros: 26, Universal: 32 },
              { label: 'Week 4', Paramount: 18, WarnerBros: 22, Universal: 28 },
            ],
            data_keys: [
              { name: 'Paramount', color: '#6366f1', label: 'Paramount Pictures' },
              { name: 'WarnerBros', color: '#ec4899', label: 'Warner Bros' },
              { name: 'Universal', color: '#06b6d4', label: 'Universal' },
            ],
          },
        ],
      };

    case 'resources':
      return {
        id: 'dash-resources',
        domain: 'resources',
        title: 'Compute Farm, GPU Blades & Storage Telemetry',
        subtitle: 'Render node utilization, storage IOPS, and license pool saturation',
        kpis: [
          {
            id: 'kpi-res-1',
            label: 'Render Nodes Online',
            value: `${mockProductionKpis.render_nodes_busy} / ${mockProductionKpis.render_nodes_total}`,
            status: 'optimal',
            trend_label: '73.4% busy',
          },
          {
            id: 'kpi-res-2',
            label: 'Tier-1 NVMe Storage',
            value: `${mockProductionKpis.storage_usage_tb} TB`,
            target: `${mockProductionKpis.storage_quota_tb} TB`,
            status: 'optimal',
            trend_label: '67.3% capacity',
          },
          {
            id: 'kpi-res-3',
            label: 'Houdini Engine Licenses',
            value: '28 / 32',
            status: 'warning',
            trend_label: '87.5% in-use',
          },
          {
            id: 'kpi-res-4',
            label: 'Nuke Studio Seats',
            value: '42 / 50',
            status: 'optimal',
            trend_label: '84.0% in-use',
          },
        ],
        widgets: [
          {
            id: 'w-res-1',
            title: 'Hourly GPU Blade Cluster Utilization (%)',
            subtitle: 'Peak rendering load over the last 24 hours',
            domain: 'resources',
            chart_type: 'area',
            span: 'col-3',
            height: 280,
            data: [
              { label: '00:00', GPU_Load: 88, CPU_Load: 72 },
              { label: '04:00', GPU_Load: 94, CPU_Load: 85 },
              { label: '08:00', GPU_Load: 65, CPU_Load: 58 },
              { label: '12:00', GPU_Load: 78, CPU_Load: 68 },
              { label: '16:00', GPU_Load: 84, CPU_Load: 74 },
              { label: '20:00', GPU_Load: 92, CPU_Load: 89 },
              { label: '23:59', GPU_Load: 96, CPU_Load: 91 },
            ],
            data_keys: [
              { name: 'GPU_Load', color: '#ec4899', label: 'GPU VRAM Utilization %' },
              { name: 'CPU_Load', color: '#6366f1', label: 'CPU Cluster Load %' },
            ],
          },
          {
            id: 'w-res-2',
            title: 'Storage Growth Forecast (TB)',
            subtitle: 'Projected monthly storage footprint',
            domain: 'resources',
            chart_type: 'line',
            span: 'col-1',
            height: 280,
            data: [
              { label: 'Aug', TB: 168 },
              { label: 'Sep', TB: 195 },
              { label: 'Oct', TB: 220 },
              { label: 'Nov', TB: 245 },
            ],
            data_keys: [{ name: 'TB', color: '#10b981', label: 'TB Used' }],
          },
        ],
      };

    case 'delivery':
    case 'review':
    default:
      return {
        id: 'dash-delivery-review',
        domain: 'delivery',
        title: 'Delivery Dispatches & Screening Room Dailies',
        subtitle: 'Aspera transfer throughput, review session feedback velocity, and approval sign-offs',
        kpis: [
          {
            id: 'kpi-del-1',
            label: 'Aspera Dispatches (Month)',
            value: 64,
            delta_percentage: 12,
            trend: 'up',
            status: 'optimal',
          },
          {
            id: 'kpi-del-2',
            label: 'Screening Dailies Held',
            value: 48,
            status: 'optimal',
          },
          {
            id: 'kpi-del-3',
            label: 'Feedback Turnaround Time',
            value: '45 mins',
            target: '< 60 mins',
            delta_percentage: -15,
            trend: 'down',
            status: 'optimal',
          },
          {
            id: 'kpi-del-4',
            label: 'Delivery Success Rate',
            value: '99.8%',
            status: 'optimal',
          },
        ],
        widgets: [
          {
            id: 'w-del-1',
            title: 'Weekly Dailies Review Notes Volume',
            subtitle: 'Total supervisor annotation notes logged per day',
            domain: 'review',
            chart_type: 'bar',
            span: 'col-2',
            height: 270,
            data: [
              { label: 'Mon', Notes: 34, Approved: 18 },
              { label: 'Tue', Notes: 48, Approved: 24 },
              { label: 'Wed', Notes: 62, Approved: 35 },
              { label: 'Thu', Notes: 54, Approved: 29 },
              { label: 'Fri', Notes: 78, Approved: 44 },
            ],
            data_keys: [
              { name: 'Notes', color: '#f59e0b', label: 'Notes Logged' },
              { name: 'Approved', color: '#10b981', label: 'Cuts Approved' },
            ],
          },
          {
            id: 'w-del-2',
            title: 'Aspera Dispatch Volume by Client (GB)',
            subtitle: 'Total package turnover bandwidth dispatched',
            domain: 'delivery',
            chart_type: 'donut',
            span: 'col-2',
            height: 270,
            data: [
              { label: 'Paramount Global', value: 480, color: '#6366f1' },
              { label: 'Warner Bros', value: 290, color: '#ec4899' },
              { label: 'Universal Studios', value: 210, color: '#06b6d4' },
              { label: 'Disney / Marvel', value: 160, color: '#10b981' },
            ],
            data_keys: [{ name: 'value', color: '#6366f1' }],
          },
        ],
      };
  }
}
