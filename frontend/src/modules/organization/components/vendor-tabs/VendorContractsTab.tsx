import React, { useState } from 'react';
import { FileText, Plus, Download, ShieldCheck, CheckCircle2, DollarSign } from 'lucide-react';
import { Vendor, VendorContract } from '@/types/organization';
import { mockVendorContracts } from '@/mocks/db/organization/clientVendorDetails';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

interface VendorContractsTabProps {
  vendor: Vendor;
}

export const VendorContractsTab: React.FC<VendorContractsTabProps> = ({ vendor }) => {
  const [contracts, setContracts] = useState<VendorContract[]>(() =>
    mockVendorContracts.filter((c) => c.vendor_id === vendor.id)
  );
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State
  const [contractNumber, setContractNumber] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'MSA' | 'SOW' | 'RateSheet'>('SOW');
  const [totalValueUsd, setTotalValueUsd] = useState(250000);
  const [securityTier, setSecurityTier] = useState('MPAA Certified Tier 4');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('2027-12-31');

  const handleAddContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractNumber.trim() || !title.trim()) return;

    const newCon: VendorContract = {
      id: `vcon-${Date.now()}`,
      vendor_id: vendor.id,
      contract_number: contractNumber.toUpperCase(),
      title,
      type,
      effective_date: effectiveDate,
      expiry_date: expiryDate,
      total_value_usd: Number(totalValueUsd),
      nda_signed: true,
      security_tier: securityTier,
      status: 'Active',
    };

    setContracts([newCon, ...contracts]);
    setIsAddOpen(false);
    setContractNumber('');
    setTitle('');
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            Outsourcing Master Agreements, SOWs & Rate Cards ({contracts.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Binding vendor master agreements, shot rate cards, and MPAA facility security riders.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white"
        >
          <Plus className="w-3.5 h-3.5" />
          Register Agreement
        </Button>
      </div>

      {/* Contracts Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Contract #</th>
                <th className="py-3 px-4">Agreement Title</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Effective Period</th>
                <th className="py-3 px-4">Security Tier</th>
                <th className="py-3 px-4">Contract Value</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-500">
                    No agreements registered for this vendor partner.
                  </td>
                </tr>
              ) : (
                contracts.map((con) => (
                  <tr key={con.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-purple-300">
                      {con.contract_number}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-white max-w-xs truncate">
                      {con.title}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <Badge variant="outline" className="text-[10px] text-slate-300">
                        {con.type}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                      {con.effective_date} → {con.expiry_date}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 font-mono">
                        {con.security_tier}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      ${con.total_value_usd.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={con.status === 'Active' ? 'success' : 'secondary'}
                        className="text-[10px]"
                      >
                        {con.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-slate-400 hover:text-white"
                        onClick={() => alert(`Downloading vendor agreement: ${con.contract_number}`)}
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

      {/* Add Contract Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                Register Vendor Contract / Rate Card
              </h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddContract} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-slate-400">Contract #</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OUT-SRP-2026-05"
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value.toUpperCase())}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-hidden font-mono"
                  >
                    <option value="MSA">MSA (Master Agreement)</option>
                    <option value="SOW">SOW (Turnover Package)</option>
                    <option value="RateSheet">Rate Card Rider</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Title / Scope</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dedicated Roto/Prep Turnover Package"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Contract Value (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={totalValueUsd}
                  onChange={(e) => setTotalValueUsd(Number(e.target.value))}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Security Tier</label>
                <select
                  value={securityTier}
                  onChange={(e) => setSecurityTier(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-hidden font-mono"
                >
                  <option value="MPAA Certified Tier 4">MPAA Certified Tier 4 (Air-gapped)</option>
                  <option value="CDSA High Security">CDSA High Security</option>
                  <option value="TPN App and Cloud Gold">TPN App and Cloud Gold</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-slate-400">Effective Date</label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400">Expiry Date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-hidden font-mono"
                  />
                </div>
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
                  Save Contract
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
