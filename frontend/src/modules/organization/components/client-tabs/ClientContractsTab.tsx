import React, { useState } from 'react';
import { ShieldCheck, FileText, Plus, Download, CheckCircle2, AlertCircle, Calendar, DollarSign, Lock } from 'lucide-react';
import { Client, ClientContract } from '@/types/organization';
import { mockClientContracts } from '@/mocks/db/organization/clientVendorDetails';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

interface ClientContractsTabProps {
  client: Client;
}

export const ClientContractsTab: React.FC<ClientContractsTabProps> = ({ client }) => {
  const [contracts, setContracts] = useState<ClientContract[]>(() =>
    mockClientContracts.filter((c) => c.client_id === client.id)
  );
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State
  const [contractNumber, setContractNumber] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'MSA' | 'SOW' | 'NDA' | 'Amendment'>('SOW');
  const [valueUsd, setValueUsd] = useState(1000000);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('2027-12-31');

  const handleAddContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractNumber.trim() || !title.trim()) return;

    const newContract: ClientContract = {
      id: `ccon-${Date.now()}`,
      client_id: client.id,
      contract_number: contractNumber.toUpperCase(),
      title,
      type,
      effective_date: effectiveDate,
      expiry_date: expiryDate,
      value_usd: Number(valueUsd),
      status: 'Active',
      nda_signed: true,
    };

    setContracts([newContract, ...contracts]);
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
            <FileText className="w-4 h-4 text-indigo-400" />
            Master Agreements, SOWs & NDA Riders ({contracts.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Legal frameworks, turnover scope boundaries, and intellectual property agreements.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Register Contract
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
                <th className="py-3 px-4">Agreement Value</th>
                <th className="py-3 px-4">NDA Binding</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-500">
                    No legal agreements registered for this client.
                  </td>
                </tr>
              ) : (
                contracts.map((con) => (
                  <tr key={con.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-300">
                      {con.contract_number}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-white max-w-xs truncate">
                      {con.title}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant="outline" className="font-mono text-[10px] text-slate-300">
                        {con.type}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                      {con.effective_date} → {con.expiry_date}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      {con.value_usd > 0 ? `$${(con.value_usd / 1000000).toFixed(2)}M` : 'Standard Scope'}
                    </td>
                    <td className="py-3.5 px-4">
                      {con.nda_signed ? (
                        <div className="flex items-center gap-1 text-emerald-400 text-[11px] font-mono">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Signed</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-400 text-[11px] font-mono">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Pending</span>
                        </div>
                      )}
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
                        onClick={() => {
                          alert(`Downloading agreement: ${con.contract_number}`);
                        }}
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
                <FileText className="w-4 h-4 text-indigo-400" />
                Register Client Agreement / SOW
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
                  <label className="text-[11px] font-mono text-slate-400">Contract Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SOW-NK99-03"
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value.toUpperCase())}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400">Agreement Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-hidden font-mono"
                  >
                    <option value="MSA">MSA (Master Service)</option>
                    <option value="SOW">SOW (Statement of Work)</option>
                    <option value="NDA">NDA (Non-Disclosure)</option>
                    <option value="Amendment">Contract Amendment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Agreement Title / Scope</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Principal Photography Turnaround Scope"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Total Contract Value (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="50000"
                  value={valueUsd}
                  onChange={(e) => setValueUsd(Number(e.target.value))}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-hidden font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-slate-400">Effective Date</label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400">Expiry Date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-hidden font-mono"
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
                <Button type="submit" variant="primary" size="sm">
                  Register Agreement
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
