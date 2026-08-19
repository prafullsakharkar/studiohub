import React, { useState } from 'react';
import { Sparkles, Plus, X, Award, CheckCircle2 } from 'lucide-react';
import { Person } from '@/types/organization';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

export const PersonSkillsTab: React.FC<{
  person: Person;
  onUpdateSkills?: (skills: string[]) => void;
}> = ({ person, onUpdateSkills }) => {
  const [skills, setSkills] = useState<string[]>(person.skills || []);
  const [newSkill, setNewSkill] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkill.trim() || skills.includes(newSkill.trim())) return;
    const updated = [...skills, newSkill.trim()];
    setSkills(updated);
    setNewSkill('');
    if (onUpdateSkills) onUpdateSkills(updated);
  };

  const handleRemove = (skillToRemove: string) => {
    const updated = skills.filter((s) => s !== skillToRemove);
    setSkills(updated);
    if (onUpdateSkills) onUpdateSkills(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Software Competencies, Pipeline Tools & Certifications
          </h3>
          <p className="text-xs text-slate-400">
            Skills are used by production coordinators to match incoming task disciplines and bid quotas.
          </p>
        </div>

        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Add skill (e.g. Solaris, USD)..."
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-52"
          />
          <Button size="sm" variant="primary" type="submit" leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Add Skill
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {skills.map((skill) => (
          <div
            key={skill}
            className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 flex items-center justify-between group hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Award className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <span className="font-mono text-xs font-bold text-white">{skill}</span>
                <span className="text-[10px] text-emerald-400 block flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                </span>
              </div>
            </div>
            <button
              onClick={() => handleRemove(skill)}
              className="text-slate-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove skill"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
