import React, { useState } from 'react';
import { Users, Plus, Search, Trash2, Shield, Layers, CheckCircle2, Lock } from 'lucide-react';
import { Vendor, VendorUser } from '@/types/organization';
import { mockVendorUsers } from '@/mocks/db/organization/clientVendorDetails';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

interface VendorUsersTabProps {
  vendor: Vendor;
}

export const VendorUsersTab: React.FC<VendorUsersTabProps> = ({ vendor }) => {
  const [users, setUsers] = useState<VendorUser[]>(() =>
    mockVendorUsers.filter((u) => u.vendor_id === vendor.id)
  );
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Senior Silhouette & Nuke Artist');
  const [specialization, setSpecialization] = useState('Complex Organic Roto & Hair Extraction');
  const [accessLevel, setAccessLevel] = useState<'Full Pipeline' | 'Restricted Portal' | 'FTP Only'>('Full Pipeline');

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase()) ||
      u.specialization.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const newUser: VendorUser = {
      id: `vu-${Date.now()}`,
      vendor_id: vendor.id,
      name,
      email,
      role,
      specialization,
      access_level: accessLevel,
      last_active: new Date().toISOString(),
      status: 'Active',
      active_tasks_count: 4,
    };

    setUsers([newUser, ...users]);
    setIsAddOpen(false);
    setName('');
    setEmail('');
  };

  const handleDeleteUser = (id: string) => {
    setUsers(users.filter((u) => u.id !== id));
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            Vendor Artist & Pipeline User Accounts ({users.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            External partner artists, supervisors, and technical directors with active studio pipeline access.
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
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-purple-500 w-48 font-mono"
            />
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            Add User
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Artist / TD</th>
                <th className="py-3 px-4">Discipline Role</th>
                <th className="py-3 px-4">Technical Specialization</th>
                <th className="py-3 px-4">Access Level</th>
                <th className="py-3 px-4">Active Tasks</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-500">
                    No vendor user accounts match criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-xs">
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-white">{user.name}</div>
                          <div className="text-[11px] font-mono text-slate-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-200">
                      {user.role}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate">
                      {user.specialization}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={user.access_level === 'Full Pipeline' ? 'success' : 'secondary'}
                        className="font-mono text-[10px]"
                      >
                        {user.access_level}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-purple-300">
                      {user.active_tasks_count} Tasks
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                      {new Date(user.last_active).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant="outline" className="font-mono text-[10px] text-emerald-400 border-emerald-500/30">
                        {user.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                        title="Revoke Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                Provision Vendor Artist / User
              </h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400">Artist Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arjun Patel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Email Address (Studio SSO / Portal)</label>
                <input
                  type="email"
                  required
                  placeholder="artist@vendor.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Discipline Role</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Silhouette & Nuke Artist"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Specialization</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Complex Organic Roto & Hair Extraction"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Pipeline Access Level</label>
                <select
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value as any)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-hidden font-mono"
                >
                  <option value="Full Pipeline">Full Pipeline (API + S3/FTP + ShotGrid Sync)</option>
                  <option value="Restricted Portal">Restricted Portal (Web Review & Upload Only)</option>
                  <option value="FTP Only">FTP Ingest Only</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" className="bg-purple-600 hover:bg-purple-500 text-white">
                  Provision User
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
