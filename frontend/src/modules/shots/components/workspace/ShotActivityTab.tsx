import React, { useState, useEffect } from 'react';
import { Shot } from '@/types/production';
import { activityService } from '@/core/activity/activityService';
import { ActivityLogItem } from '@/types/audit';
import { Activity, Clock, User, Shield, CheckCircle2, Sparkles, RefreshCw } from 'lucide-react';
import { Card, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

export interface ShotActivityTabProps {
  shot: Shot;
}

export const ShotActivityTab: React.FC<ShotActivityTabProps> = ({ shot }) => {
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      const logs = activityService.getActivities({
        resourceId: shot.id,
        limit: 50,
      });

      if (!logs || logs.length === 0) {
        const allLogs = activityService.getActivities({
          projectId: shot.project_id,
          limit: 50,
        });
        const shotSpecific = allLogs.filter(
          (l) =>
            l.resourceId === shot.id ||
            l.entity?.code === shot.code ||
            l.entity?.name?.includes(shot.code) ||
            l.entity?.context?.includes(shot.code) ||
            l.description?.includes(shot.code)
        );
        setActivities(shotSpecific.length > 0 ? shotSpecific : allLogs.slice(0, 10));
      } else {
        setActivities(logs);
      }
    } catch (err) {
      console.error('Failed to fetch activity logs for shot:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [shot.id]);

  return (
    <div className="space-y-4">
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Audit Trail & Event Log
          </span>
        </div>

        <Button
          variant="outline"
          size="xs"
          onClick={fetchActivities}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
        >
          Refresh Log
        </Button>
      </div>

      {activities.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/50 p-12 text-center">
          <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white">No Historical Events Recorded</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Status changes, version submissions, and task updates will populate this audit log.
          </p>
        </Card>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
          {activities.map((act) => (
            <div key={act.id} className="relative group">
              <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-indigo-500 ring-4 ring-slate-950" />

              <Card className="border-slate-800/80 bg-slate-900 shadow-xs hover:border-slate-700 transition-colors">
                <CardBody className="p-3.5 space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {act.actionLabel || act.action}
                      </span>
                      {act.resourceCode && (
                        <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-1.5 py-0.2 rounded border border-indigo-500/20">
                          {act.resourceCode}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(act.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">{act.description}</p>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/60">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{act.actorName || 'System Service'}</span>
                    </div>
                    {act.context && <span className="text-slate-400 font-semibold">{act.context}</span>}
                  </div>
                </CardBody>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
