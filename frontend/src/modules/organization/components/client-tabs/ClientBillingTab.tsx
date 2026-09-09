import React, { useState } from 'react';
import { DollarSign, FileText, Download, CheckCircle2, Clock, Plus, AlertCircle, TrendingUp } from 'lucide-react';
import { Client, ClientInvoice } from '@/types/organization';
import { mockClientInvoices } from '@/mocks/db/organization/clientVendorDetails';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

interface ClientBillingTabProps {
  client: Client;
}

export const ClientBillingTab: React.FC<ClientBillingTabProps> = ({ client }) => {
  const [invoices, setInvoices] = useState<ClientInvoice[]>(() =>
    mockClientInvoices.filter((i) => i.client_id === client.id)
  );

  const totalBilled = invoices.reduce((sum, i) => sum + i.amount_usd, 0);
  const totalPaid = invoices.reduce((sum, i) => sum + i.paid_usd, 0);
  const totalOutstanding = totalBilled - totalPaid;

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Client Invoicing & Production Billing ({invoices.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Production milestone disbursements, Net 30/60 remittance schedules, and accounts receivable tracking.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => alert('Generating Milestone Invoice Draft...')}
          className="flex items-center gap-1.5 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Invoice
        </Button>
      </div>

      {/* Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-mono text-slate-400">Total Billed Scope</div>
          <div className="text-xl font-bold font-mono text-white mt-1">
            ${(totalBilled / 1000000).toFixed(2)}M
          </div>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-mono text-slate-400">Received & Reconciled</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            ${(totalPaid / 1000000).toFixed(2)}M
          </div>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-mono text-slate-400">Outstanding (Net 30)</div>
          <div className="text-xl font-bold font-mono text-amber-300 mt-1">
            ${(totalOutstanding / 1000000).toFixed(2)}M
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Production</th>
                <th className="py-3 px-4">Milestone Description</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Paid</th>
                <th className="py-3 px-4">Issue Date</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-slate-500">
                    No invoices recorded for this client account.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-300">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <Badge variant="outline" className="text-[10px] text-slate-200">
                        {inv.project_code}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate">
                      {inv.items_summary}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      ${inv.amount_usd.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-400">
                      ${inv.paid_usd.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {inv.issue_date}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {inv.due_date}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={inv.status === 'Paid' ? 'success' : 'warning'}
                        className="text-[10px]"
                      >
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-slate-400 hover:text-white"
                        onClick={() => alert(`Downloading Invoice PDF: ${inv.invoice_number}`)}
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
