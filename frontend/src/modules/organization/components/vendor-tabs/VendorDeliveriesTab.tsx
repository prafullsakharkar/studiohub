import React, { useState } from 'react';
import { PackageCheck, CheckCircle2, AlertTriangle, XCircle, Search, Filter, HardDrive, Download } from 'lucide-react';
import { Vendor, VendorDelivery } from '@/types/organization';
import { mockVendorDeliveries } from '@/mocks/db/organization/clientVendorDetails';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

interface VendorDeliveriesTabProps {
  vendor: Vendor;
}

export const VendorDeliveriesTab: React.FC<VendorDeliveriesTabProps> = ({ vendor }) => {
  const [deliveries, setDeliveries] = useState<VendorDelivery[]>(() =>
    mockVendorDeliveries.filter((d) => d.vendor_id === vendor.id)
  );
  const [search, setSearch] = useState('');
  const [qcFilter, setQcFilter] = useState('ALL');

  const filtered = deliveries.filter((d) => {
    const matchSearch =
      d.delivery_code.toLowerCase().includes(search.toLowerCase()) ||
      d.shot_code.toLowerCase().includes(search.toLowerCase()) ||
      d.project_code.toLowerCase().includes(search.toLowerCase()) ||
      d.package_type.toLowerCase().includes(search.toLowerCase());
    const matchQc = qcFilter === 'ALL' || d.qc_status === qcFilter;
    return matchSearch && matchQc;
  });

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-purple-400" />
            Vendor Incoming Deliveries & Ingest QC ({deliveries.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Turned in matte channels, clean plates, rotomations, and automated technical validation logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search deliveries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-purple-500 w-48 font-mono"
            />
          </div>

          <select
            value={qcFilter}
            onChange={(e) => setQcFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-hidden font-mono"
          >
            <option value="ALL">All QC Statuses</option>
            <option value="QC Passed">QC Passed</option>
            <option value="QC Warning">QC Warning</option>
            <option value="QC Rejected">QC Rejected</option>
          </select>
        </div>
      </div>

      {/* Deliveries Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Delivery Code</th>
                <th className="py-3 px-4">Show & Shot</th>
                <th className="py-3 px-4">Package Type</th>
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4">Frame Range</th>
                <th className="py-3 px-4">Submitted At</th>
                <th className="py-3 px-4">Automated QC Status</th>
                <th className="py-3 px-4">Technical Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-slate-500">
                    No incoming deliveries recorded.
                  </td>
                </tr>
              ) : (
                filtered.map((del) => (
                  <tr key={del.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-purple-300">
                      {del.delivery_code}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div className="text-white font-bold">{del.shot_code}</div>
                      <div className="text-slate-400 text-[10px]">Show: {del.project_code}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {del.package_type}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-indigo-300 font-bold">
                      {del.version}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                      {del.frame_range}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(del.submitted_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          del.qc_status === 'QC Passed'
                            ? 'success'
                            : del.qc_status === 'QC Warning'
                            ? 'warning'
                            : 'destructive'
                        }
                        className="font-mono text-[10px]"
                      >
                        {del.qc_status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate text-[11px]">
                      {del.notes}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-slate-400 hover:text-white"
                        onClick={() => alert(`Ingesting delivery package: ${del.delivery_code}`)}
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
