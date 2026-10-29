import React, { useState } from 'react';
import { Users, Plus, Mail, Phone, Star, Trash2 } from 'lucide-react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import {
  useVendorContacts,
  useVendorContactMutations,
} from '../../hooks/useVendorRegistryData';

interface VendorContactsTabProps {
  vendorId: string;
}

/**
 * Vendor contacts — backed by the flat /api/v1/vendor-contacts/ registry,
 * filtered with ?vendor=<id>. No org dimension.
 */
export const VendorContactsTab: React.FC<VendorContactsTabProps> = ({ vendorId }) => {
  const { data, isLoading } = useVendorContacts(vendorId);
  const contacts = data?.items ?? [];
  const { createVendorContact, deleteVendorContact } = useVendorContactMutations();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createVendorContact.mutate(
      {
        vendor: vendorId,
        name: name.trim(),
        role: role.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      },
      {
        onSuccess: () => {
          setIsAddOpen(false);
          setName('');
          setRole('');
          setEmail('');
          setPhone('');
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            Vendor Contacts ({contacts.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            People authorized to receive work assignments and communicate on behalf of this vendor studio.
          </p>
        </div>
        <Button size="sm" variant="primary" onClick={() => setIsAddOpen(true)} className="flex items-center gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" />
          Add Contact
        </Button>
      </div>

      {contacts.length === 0 && (
        <div className="p-10 text-center text-xs font-mono text-slate-500 bg-slate-900/60 rounded-2xl border border-slate-800">
          No contacts registered for this vendor yet.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {contacts.map((contact) => (
          <div key={contact.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-white">{contact.name}</span>
                {contact.is_primary && (
                  <Star className="w-3 h-3 text-amber-400" />
                )}
                {contact.role && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {contact.role}
                  </Badge>
                )}
              </div>
              <div className="mt-1 space-y-0.5 text-[11px] text-slate-400 font-mono">
                {contact.email && (
                  <div className="flex items-center gap-1.5 break-all">
                    <Mail className="w-3 h-3 shrink-0" />
                    {contact.email}
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 shrink-0" />
                    {contact.phone}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              title="Remove contact"
              onClick={() => deleteVendorContact.mutate(contact.id)}
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
        title="Add Vendor Contact"
        subtitle="Register a person authorized to act on behalf of this vendor studio."
        size="sm"
      >
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-500 block">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-500 block">Role</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Vendor Producer"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-500 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-500 block">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={createVendorContact.isPending}>
              Add Contact
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
