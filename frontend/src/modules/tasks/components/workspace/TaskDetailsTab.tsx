import React, { useState } from 'react';
import { Task } from '@/types/tasks';
import { Button } from '@/shared/components/Button';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { Save, Code2, Cpu, FileCode, CheckCircle2, Tag } from 'lucide-react';

interface TaskDetailsTabProps {
  task: Task;
  onUpdate: (data: Partial<Task>) => Promise<any>;
}

export const TaskDetailsTab: React.FC<TaskDetailsTabProps> = ({ task, onUpdate }) => {
  const addNotification = useNotificationStore((state) => state.addNotification);
  const [title, setTitle] = useState(task.title);
  const [software, setSoftware] = useState(task.software || 'Houdini 20.5');
  const [description, setDescription] = useState(task.description || '');
  const [tagsInput, setTagsInput] = useState(task.tags?.join(', ') || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
      await onUpdate({
        title,
        software,
        description,
        tags,
      });
      addNotification({
        type: 'success',
        title: 'Task Details Saved',
        message: 'Updated specifications and execution metadata.',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Failed to Save',
        message: err.message || 'An error occurred.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Technical Task Specifications</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure parameters, software versions, and asset references.
            </p>
          </div>
          <Button type="submit" variant="primary" isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>
            Save Details
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Task Full Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Primary DCC Software & Engine
            </label>
            <input
              type="text"
              value={software}
              onChange={(e) => setSoftware(e.target.value)}
              placeholder="e.g. Houdini 20.5 / Solaris / Karma XPU"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Detailed Production Brief & Delivery Specifications
          </label>
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md p-3.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 resize-none font-mono text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Production Tags (Comma Separated)
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="FX, Rain, Simulation, Hero, 8K"
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Read-Only System Pipeline Metadata */}
      <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-800">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Pipeline Context
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">TASK CODE</span>
            <span className="text-indigo-400 font-bold">{task.code}</span>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">TARGET ENTITY</span>
            <span className="text-cyan-400 font-bold">{task.entity_code}</span>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">DEPARTMENT CODE</span>
            <span className="text-emerald-400 font-bold">{task.department_code || 'FX'}</span>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">CREATED TIMESTAMP</span>
            <span className="text-slate-300">{new Date(task.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </form>
  );
};
