import React, { useState } from 'react';
import { CheckCircle2, Film, Download, ShieldCheck, Search, Filter, HardDrive, PackageCheck, AlertCircle } from 'lucide-react';
import { Client, ClientDeliverable } from '@/types/organization';
import { mockClientDeliverables } from '@/mocks/db/organization/clientVendorDetails';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

interface ClientDeliverablesTabProps {
  client: Client;
}

export const ClientDeliverablesTab: React.FC<ClientDeliverablesTabProps> = ({ client }) => {
  const [deliverables, setDeliverables] = useState<ClientDeliverable[]>(() =>
    mockClientDeliverables.filter((d) => d.client_id === client.id)
  );
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const filtered = deliverables.filter((d) => {
    const matchSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.project_code.toLowerCase().includes(search.toLowerCase()) ||
      d.package_type.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'ALL' || d.package_type === typeFilter;
    return matchSearch && matchType;
  });

  const totalSizeGb = deliverables.reduce((sum, d) => sum + d.file_size_gb, 0);
  const totalFrames = deliverables.reduce((sum, d) => sum + d.frame_count, 0);

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Client Final Delivery Packages ({deliverables.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Turned over master EXR plates, graded QuickTimes, and OpenUSD scene graphs with MD5 checksum verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search deliverables..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-48 font-mono"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-hidden font-mono"
          >
            <option value="ALL">All Package Types</option>
            <option value="Final Master EXR">Final Master EXR</option>
            <option value="ProRes 4444 XQ">ProRes 4444 XQ</option>
            <option value="QuickTime Dailies">QuickTime Dailies</option>
            <option value="OpenUSD Turnaround">OpenUSD Turnaround</option>
          </select>
        </div>
      </div>

      {/* Deliverable Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-mono text-slate-400">Total Frames Shipped</div>
          <div className="text-xl font-bold font-mono text-white mt-1">
            {totalFrames.toLocaleString()} Frames
          </div>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-mono text-slate-400">Master Data Volume</div>
          <div className="text-xl font-bold font-mono text-indigo-300 mt-1">
            {totalSizeGb.toFixed(1)} GB
          </div>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-mono text-slate-400">Studio Delivery Acceptance</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            100% QC Compliance
          </div>
        </div>
      </div>

      {/* Deliverables List */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Package Identifier</th>
                <th className="py-3 px-4">Show</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Resolution & Color</th>
                <th className="py-3 px-4">Frames</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Delivered Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-slate-500">
                    No deliverables match criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((del) => (
                  <tr key={del.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-white max-w-xs truncate">
                      {del.title}
                      {del.checksum_md5 && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          md5: {del.checksum_md5}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <Badge variant="outline" className="text-[10px] text-slate-200">
                        {del.project_code}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {del.package_type}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">
                      <div>{del.resolution}</div>
                      <div className="text-slate-500 text-[10px]">{del.color_space}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {del.frame_count.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-indigo-300">
                      {del.file_size_gb} GB
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {del.delivery_date}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          del.status.includes('Accepted')
                            ? 'success'
                            : del.status === 'Pending QC'
                            ? 'warning'
                            : 'secondary'
                        }
                        className="text-[10px]"
                      >
                        {del.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-slate-400 hover:text-white"
                        onClick={() => alert(`Downloading manifest & token for ${del.title}`)}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
