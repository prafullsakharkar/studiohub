import React, { useState } from 'react';
import { FileText, Plus, Trash2, Calendar, DollarSign } from 'lucide-react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import {
  useClientContracts,
  useClientContractMutations,
} from '../../hooks/useClientRegistryData';

interface ClientContractsTabProps {
  clientId: string;
}

const CONTRACT_TYPES = ['MSA', 'SOW', 'NDA', 'Amendment'] as const;

/**
 * Client contracts — backed by the flat /api/v1/client-contracts/ registry,
 * filtered with ?client=<id>. No org dimension.
 */
export const ClientContractsTab: React.FC<ClientContractsTabProps> = ({ clientId }) => {
  const { data, isLoading } = useClientContracts(clientId);
  const contracts = data?.items ?? [];
  const { createClientContract, deleteClientContract } = useClientContractMutations();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [contractNumber, setContractNumber] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<(typeof CONTRACT_TYPES)[number]>('SOW');
  const [valueUsd, setValueUsd] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractNumber.trim() || !title.trim()) return;
    createClientContract.mutate(
      {
        client: clientId,
        contract_number: contractNumber.trim().toUpperCase(),
        title: title.trim(),
        type,
        value_usd: valueUsd ? Number(valueUsd) : undefined,
        effective_date: effectiveDate || undefined,
        expiry_date: expiryDate || undefined,
      },
      {
        onSuccess: () => {
          setIsAddOpen(false);
          setContractNumber('');
          setTitle('');
          setValueUsd('');
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            Master Agreements, SOWs &amp; NDA Riders ({contracts.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Legal frameworks, scope boundaries, and intellectual property agreements.
          </p>
        </div>
        <Button size="sm" variant="primary" onClick={() => setIsAddOpen(true)} className="flex items-center gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" />
          Register Contract
        </Button>
      </div>

      {contracts.length === 0 && (
        <div className="p-10 text-center text-xs font-mono text-slate-500 bg-slate-900/60 rounded-2xl border border-slate-800">
          No contracts registered for this client yet.
        </div>
      )}

      <div className="space-y-3">
        {contracts.map((contract) => (
          <div key={contract.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-sky-950 font-mono text-[10px] font-bold text-sky-300 border border-sky-500/30">
                  {contract.contract_number}
                </span>
                <span className="text-xs font-bold text-white">{contract.title}</span>
                {contract.type && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {contract.type}
                  </Badge>
                )}
                {contract.nda_signed && (
                  <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 no-underline">
                    NDA Signed
                  </Badge>
                )}
                {contract.status && (
                  <Badge variant="outline" className="text-[10px] font-mono ml-auto">
                    {contract.status}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono flex-wrap">
                {typeof contract.value_usd === 'number' && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    {contract.value_usd.toLocaleString()} USD
                  </span>
                )}
                {(contract.effective_date || contract.expiry_date) && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {contract.effective_date || '—'} → {contract.expiry_date || 'open-ended'}
                  </span>
                )}
              </div>
              {contract.document_url && (
                <a
                  href={contract.document_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-mono text-indigo-300 hover:underline"
                >
                  View document
                </a>
              )}
            </div>
            <button
              type="button"
              title="Delete contract"
              onClick={() => deleteClientContract.mutate(contract.id)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Register Client Contract"
        subtitle="Record a master agreement, SOW, NDA, or amendment for this client studio."
        size="sm"
      >
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-500 block">Contract # *</label>
              <input
                type="text"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-500 block">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as (typeof CONTRACT_TYPES)[number])}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
              >
                {CONTRACT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-500 block">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-500 block">Value (USD)</label>
              <input
                type="number"
                min="0"
                value={valueUsd}
                onChange={(e) => setValueUsd(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-500 block">Effective</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-500 block">Expiry</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={createClientContract.isPending}>
              Register Contract
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
