import { useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { auditKeys } from '@/api/audit/audit';
import { peopleApi } from '@/api/masterdata/directory';
import type { Person } from '@/api/masterdata/directory';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';

/** The person's `skills` list: free text, saved as the whole list with a PATCH. */
export const PersonSkillsTab: React.FC<{ person: Person }> = ({ person }) => {
  const queryClient = useQueryClient();
  const canManage = useCan('masterdata.directory.manage');
  const [newSkill, setNewSkill] = useState('');
  const [saving, setSaving] = useState(false);
  const skills = Array.isArray(person.skills) ? (person.skills as string[]) : [];

  const save = async (next: string[]) => {
    setSaving(true);
    try {
      await peopleApi.update(person.id, { skills: next });
      await Promise.all([queryClient.invalidateQueries({ queryKey: peopleApi.keys.all }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]);
      return true;
    } catch (error) {
      notify.fromError(error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-white">Skills</h3>
      {skills.length === 0 ? (
        <p className="text-xs text-slate-400">No skills recorded.</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Skills">
          {skills.map((skill) => (
            <li key={skill}>
              <Badge variant="info" className="inline-flex items-center gap-1.5">
                {skill}
                {canManage && (
                  <button type="button" aria-label={`Remove skill ${skill}`} disabled={saving} onClick={() => void save(skills.filter((s) => s !== skill))}>
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                )}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <form
          className="flex gap-2 max-w-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            const value = newSkill.trim();
            if (!value || skills.includes(value)) return;
            if (await save([...skills, value])) setNewSkill('');
          }}
        >
          <input aria-label="New skill" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" placeholder="e.g. Houdini" />
          <Button type="submit" size="sm" variant="primary" disabled={saving || newSkill.trim() === ''} leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Add skill
          </Button>
        </form>
      )}
    </div>
  );
};
