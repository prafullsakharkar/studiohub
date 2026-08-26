import React, { useState } from 'react';
import { Task } from '@/types/tasks';
import { useActivityStore } from '@/shared/stores/useActivityStore';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { Button } from '@/shared/components/Button';
import {
  History,
  MessageSquare,
  Send,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Tag,
} from 'lucide-react';

interface TaskActivityTabProps {
  task: Task;
}

export const TaskActivityTab: React.FC<TaskActivityTabProps> = ({ task }) => {
  const { activities, addActivity } = useActivityStore();
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  // Filter activities relevant to this task or project
  const relevantActivities = activities.filter(
    (a) => a.entity?.id === task.id || a.entity?.code === task.code || a.entity?.name === task.title
  );

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsPosting(true);
    try {
      addActivity({
        actor: {
          id: user?.id || 'usr-001',
          name: user?.full_name || 'Alex Chen',
          email: user?.email || 'user@studiohub.vfx',
          role: user?.role || 'Lead Artist',
        },
        action: 'comment',
        actionLabel: 'Task Note Added',
        entity: {
          type: 'task',
          id: task.id,
          code: task.code,
          name: task.title,
          context: task.project_code,
        },
        description: commentText.trim(),
        tags: ['Comment', task.department],
      });
      setCommentText('');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Post Comment Input Card */}
      <form onSubmit={handlePostComment} className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-3">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Add Production Note / Supervisor Feedback
        </label>
        <textarea
          rows={3}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Enter dailies notes, cache issues, render engine feedback, or artist handoff instructions..."
          className="w-full bg-slate-900 border border-slate-700 rounded-md p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
        />
        <div className="flex items-center justify-end">
          <Button
            type="submit"
            size="sm"
            variant="primary"
            disabled={!commentText.trim() || isPosting}
            leftIcon={<Send className="w-3.5 h-3.5" />}
          >
            Post Note
          </Button>
        </div>
      </form>

      {/* Activity Timeline Stream */}
      <div className="bg-slate-900/40 rounded-xl border border-slate-800 p-5 space-y-6">
        <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-400" />
          Audit Trail & Activity Log
        </h4>

        <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-800">
          {relevantActivities.length === 0 ? (
            <div className="pl-8 text-xs text-slate-500 italic py-4">
              Initial creation entry recorded on {new Date(task.created_at).toLocaleDateString()}. No further events logged.
            </div>
          ) : (
            relevantActivities.map((act) => (
              <div key={act.id} className="relative pl-8 space-y-1">
                {/* Node dot */}
                <div className="absolute left-2 top-1.5 w-3 h-3 -translate-x-1/2 rounded-full bg-slate-900 border-2 border-indigo-500" />

                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-200">{act.actor.name}</span>
                  <span className="text-slate-500 font-mono text-[11px]">• {act.actor.role}</span>
                  <span className="text-slate-500 font-mono text-[10px] ml-auto">
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs text-slate-300">
                  <p className="whitespace-pre-wrap">{act.description}</p>

                  {act.tags && act.tags.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5">
                      {act.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
