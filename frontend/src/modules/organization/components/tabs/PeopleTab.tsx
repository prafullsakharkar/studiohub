import React, { useState } from 'react';
import { Users, Mail, MapPin, Plus, Search, Shield, CheckCircle2 } from 'lucide-react';
import { Organization, Person } from '@/types/organization';
import { usePeople } from '@/modules/organization/hooks/useOrganizationData';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';

export const PeopleTab: React.FC<{ org: Organization }> = ({ org }) => {
  const { data: peopleData, isLoading } = usePeople();
  const people: Person[] = (peopleData as any)?.results ?? peopleData ?? [];
  const [search, setSearch] = useState('');

  const filtered = people.filter(
    (p) =>
      (p.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.role || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.department_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            Studio Crew & Visual Effects Artists Roster
          </h2>
          <p className="text-xs text-slate-400">
            Supervisors, leads, technical directors, FX artists, compositors, and pipeline engineers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search artists..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-48"
            />
          </div>
          <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Invite Artist
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/90 shadow-sm">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 border-b border-slate-800 font-mono text-[10px] uppercase text-slate-400">
            <tr>
              <th className="py-3 px-4">Artist Name</th>
              <th className="py-3 px-4">Role & Discipline</th>
              <th className="py-3 px-4">Department</th>
              <th className="py-3 px-4">Facility Hub</th>
              <th className="py-3 px-4">Active Tasks</th>
              <th className="py-3 px-4">Seniority</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                  No crew members found.
                </td>
              </tr>
            )}
            {filtered.map((person) => (
              <tr key={person.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={person.avatar_url}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-700 shrink-0"
                    />
                    <div>
                      <div className="font-bold text-white">{person.full_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{person.email}</div>
                    </div>
                  </div>
                </td>

                <td className="py-3 px-4">
                  <div className="font-medium text-slate-200">{person.role}</div>
                  <span className="text-[10px] text-slate-400">Status: {person.availability_status}</span>
                </td>

                <td className="py-3 px-4">
                  <Badge variant="outline" className="text-[9px] font-mono text-indigo-300 border-indigo-500/30">
                    {person.department_name}
                  </Badge>
                </td>

                <td className="py-3 px-4 text-slate-300 flex items-center gap-1 mt-2">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  <span>{person.office_name}</span>
                </td>

                <td className="py-3 px-4 font-mono font-bold text-white">{person.active_tasks}</td>

                <td className="py-3 px-4">
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    {person.seniority}
                  </span>
                </td>

                <td className="py-3 px-4 text-right">
                  <span className="text-indigo-400 hover:underline cursor-pointer font-medium">Manage</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
