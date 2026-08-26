import React, { useState } from 'react';
import { Briefcase, Plus, DollarSign, CheckCircle2, Clock, AlertTriangle, FileCheck, Layers } from 'lucide-react';
import { Client, PurchaseOrder } from '@/types/organization';
import { mockPurchaseOrders } from '@/mocks/db/organization/clientVendorDetails';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

interface ClientPurchaseOrdersTabProps {
  client: Client;
}

export const ClientPurchaseOrdersTab: React.FC<ClientPurchaseOrdersTabProps> = ({ client }) => {
  const [pos, setPos] = useState<PurchaseOrder[]>(() =>
    mockPurchaseOrders.filter((p) => p.client_id === client.id)
  );
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State
  const [poNumber, setPoNumber] = useState('');
  const [projectCode, setProjectCode] = useState('NK99');
  const [amountUsd, setAmountUsd] = useState(500000);
  const [scopeDescription, setScopeDescription] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);

  const totalAmount = pos.reduce((sum, p) => sum + p.amount_usd, 0);
  const totalInvoiced = pos.reduce((sum, p) => sum + p.invoiced_usd, 0);
  const totalRemaining = pos.reduce((sum, p) => sum + p.remaining_usd, 0);

  const handleAddPO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poNumber.trim()) return;

    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      client_id: client.id,
      po_number: poNumber.toUpperCase(),
      project_id: 'proj-001',
      project_code: projectCode.toUpperCase(),
      project_name: 'Production Turnover Scope',
      amount_usd: Number(amountUsd),
      invoiced_usd: 0,
      remaining_usd: Number(amountUsd),
      issue_date: issueDate,
      status: 'Approved',
      scope_description: scopeDescription || 'Production Milestones Turnover Scope',
    };

    setPos([newPO, ...pos]);
    setIsAddOpen(false);
    setPoNumber('');
    setScopeDescription('');
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-400" />
            Client Purchase Orders ({pos.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Binding studio PO allocations, invoiced drawdown totals, and remaining production budget balances.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Issue Purchase Order
        </Button>
      </div>

      {/* PO Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-mono text-slate-400">Total PO Allocation</div>
          <div className="text-xl font-bold font-mono text-white mt-1">
            ${(totalAmount / 1000000).toFixed(2)}M
          </div>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-mono text-slate-400">Invoiced / Drawn Down</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            ${(totalInvoiced / 1000000).toFixed(2)}M
          </div>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-mono text-slate-400">Remaining PO Balance</div>
          <div className="text-xl font-bold font-mono text-indigo-300 mt-1">
            ${(totalRemaining / 1000000).toFixed(2)}M
          </div>
        </div>
      </div>

      {/* PO List */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Show</th>
                <th className="py-3 px-4">Scope Summary</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Invoiced</th>
                <th className="py-3 px-4">Remaining</th>
                <th className="py-3 px-4">Issue Date</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {pos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-500">
                    No purchase orders recorded for this studio account.
                  </td>
                </tr>
              ) : (
                pos.map((po) => {
                  const percentUsed = Math.round((po.invoiced_usd / (po.amount_usd || 1)) * 100);
                  return (
                    <tr key={po.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-300">
                        {po.po_number}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <Badge variant="outline" className="text-[10px] text-slate-200">
                          {po.project_code}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate">
                        {po.scope_description}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        ${po.amount_usd.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400 font-medium">
                        ${po.invoiced_usd.toLocaleString()}
                        <span className="text-[10px] text-slate-500 ml-1">({percentUsed}%)</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-indigo-300 font-medium">
                        ${po.remaining_usd.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {po.issue_date}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={
                            po.status === 'Approved'
                              ? 'success'
                              : po.status === 'Pending Approval'
                              ? 'warning'
                              : 'secondary'
                          }
                          className="text-[10px]"
                        >
                          {po.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add PO Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400" />
                Register Client Purchase Order
              </h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPO} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-slate-400">PO Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PO-WNS-99320"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value.toUpperCase())}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400">Production Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NK99"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Total Authorized Amount (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="25000"
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(Number(e.target.value))}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Authorized Scope Summary</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Act 3 Climactic Battle & Vehicle Chase simulation shots..."
                  value={scopeDescription}
                  onChange={(e) => setScopeDescription(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Issue Date</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-hidden font-mono"
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
                <Button type="submit" variant="primary" size="sm">
                  Register PO
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
