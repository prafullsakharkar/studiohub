import React, { useState } from 'react';
import { Layers, Plus, Users, Cpu, Shield, Search } from 'lucide-react';
import { Vendor, VendorDepartment } from '@/types/organization';
import { mockVendorDepartments } from '@/mocks/db/organization/clientVendorDetails';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

interface VendorDepartmentsTabProps {
  vendor: Vendor;
}

export const VendorDepartmentsTab: React.FC<VendorDepartmentsTabProps> = ({ vendor }) => {
  const [departments, setDepartments] = useState<VendorDepartment[]>(() =>
    mockVendorDepartments.filter((d) => d.vendor_id === vendor.id)
  );
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [leadName, setLeadName] = useState('');
  const [artistCount, setArtistCount] = useState(25);
  const [softwareStr, setSoftwareStr] = useState('Foundry Nuke 15.1, Silhouette 2024');

  const handleAddDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    const newDept: VendorDepartment = {
      id: `vdept-${Date.now()}`,
      vendor_id: vendor.id,
      name,
      code: code.toUpperCase(),
      lead_name: leadName || 'Lead TD',
      artist_count: Number(artistCount),
      active_tasks_count: 0,
      software: softwareStr.split(',').map((s) => s.trim()).filter(Boolean),
    };

    setDepartments([...departments, newDept]);
    setIsAddOpen(false);
    setName('');
    setCode('');
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            Vendor Operational Departments & Capacity ({departments.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Internal partner discipline departments, artist headcounts, and supported software pipelines.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Department
        </Button>
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/80">
            No departments defined for this vendor partner.
          </div>
        ) : (
          departments.map((dept) => (
            <div
              key={dept.id}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <h4 className="font-bold text-sm text-white">{dept.name}</h4>
                    <span className="text-[11px] font-mono text-purple-300">
                      Lead: {dept.lead_name}
                    </span>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] text-purple-300 border-purple-500/30">
                    {dept.code}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 my-4">
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-center">
                    <div className="text-[10px] font-mono text-slate-400">Artist Capacity</div>
                    <div className="text-lg font-bold font-mono text-white mt-0.5">
                      {dept.artist_count}
                    </div>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-center">
                    <div className="text-[10px] font-mono text-slate-400">Active Tasks</div>
                    <div className="text-lg font-bold font-mono text-indigo-300 mt-0.5">
                      {dept.active_tasks_count}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-mono text-slate-400 mb-1.5">Supported Pipeline Stack:</div>
                  <div className="flex flex-wrap gap-1">
                    {dept.software.map((sw) => (
                      <span
                        key={sw}
                        className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 text-[10px] font-mono border border-slate-800"
                      >
                        {sw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Department Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Add Vendor Department
              </h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddDept} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-slate-400">Department Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 3D Tracking & Photogrammetry"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400">Code (3-4 Letters)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MM"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Department Lead Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Joshi"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Artist Headcount</label>
                <input
                  type="number"
                  min="1"
                  value={artistCount}
                  onChange={(e) => setArtistCount(Number(e.target.value))}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Software Stack (Comma Separated)</label>
                <input
                  type="text"
                  placeholder="e.g. 3DEqualizer 4, Maya 2025, Nuke 15"
                  value={softwareStr}
                  onChange={(e) => setSoftwareStr(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden font-mono"
                />
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
                  Add Department
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
