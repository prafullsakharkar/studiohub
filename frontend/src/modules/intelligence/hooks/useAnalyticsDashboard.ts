import { useState, useEffect, useCallback } from 'react';
import {
  AnalyticsDashboard,
  AnalyticsDomain,
} from '@/types/intelligence';
import { analyticsService } from '../services/AnalyticsService';

export function useAnalyticsDashboard(initialDomain: AnalyticsDomain = 'projects') {
  const [activeDomain, setActiveDomain] = useState<AnalyticsDomain>(initialDomain);
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [availableDomains, setAvailableDomains] = useState<
    { id: AnalyticsDomain; label: string; description: string; icon: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d' | 'quarter' | 'live'>('30d');

  const fetchDashboard = useCallback(async (domain: AnalyticsDomain) => {
    setLoading(true);
    try {
      const [dash, domains] = await Promise.all([
        analyticsService.getDashboard(domain),
        analyticsService.getAvailableDomains(),
      ]);
      setDashboard(dash);
      setAvailableDomains(domains);
    } catch (err) {
      console.error('Failed to load analytics dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(activeDomain);
  }, [activeDomain, fetchDashboard]);

  return {
    activeDomain,
    setActiveDomain,
    dashboard,
    availableDomains,
    loading,
    timeframe,
    setTimeframe,
    refresh: () => fetchDashboard(activeDomain),
  };
}
