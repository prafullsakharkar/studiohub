import React, { useState } from 'react';
import { User, Mail, Phone, Globe, Plus, Search, Trash2 } from 'lucide-react';
import { Client } from '@/types/organization';
import { useClientContacts, useClientContactMutations } from '../../hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

interface ClientContactsTabProps {
  client: Client;
}

export const ClientContactsTab: React.FC<ClientContactsTabProps> = ({ client }) => {
  const { data: contacts = [], isLoading } = useClientContacts(client.id);
  const { createContact, deleteContact } = useClientContactMutations(client.id);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('America/Los_Angeles (PST)');
  const [portalAccess, setPortalAccess] = useState(true);
  const [isPrimary, setIsPrimary] = useState(false);

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.role.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    createContact.mutate({
      name,
      role,
      email,
      phone,
      timezone,
      portal_access: portalAccess,
      is_primary: isPrimary || contacts.length === 0,
    });

    setIsAddModalOpen(false);
    setName('');
    setRole('');
    setEmail('');
    setPhone('');
  };

  const handleDelete = (id: string) => {
    deleteContact.mutate(id);
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-400" />
            Client Executives & Production Contacts ({contacts.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Key VFX supervisors, production managers, review sign-off leads, and executive producers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-48 font-mono"
            />
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Contacts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/80">
            Loading contacts...
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/80">
            No client contacts match your criteria.
          </div>
        ) : (
          filtered.map((contact) => (
            <div
              key={contact.id}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-sm">
                      {contact.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white flex items-center gap-1.5">
                        {contact.name}
                        {contact.is_primary && (
                          <Badge variant="outline" className="font-mono text-[9px] text-amber-300 border-amber-500/30">
                            Primary
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-indigo-300 mt-0.5">{contact.role}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(contact.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                    title="Remove Contact"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-4 space-y-2 text-xs font-mono text-slate-300 pt-3 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <a href={`mailto:${contact.email}`} className="hover:text-white truncate">
                      {contact.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{contact.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{contact.timezone}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Portal Access</span>
                <Badge
                  variant={contact.portal_access ? 'success' : 'secondary'}
                  className="font-mono text-[10px]"
                >
                  {contact.portal_access ? 'Enabled' : 'Restricted'}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Contact Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" />
                Add Studio Contact
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400">Contact Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. David Vance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Studio Role / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior VFX Producer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-slate-400">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="contact@studio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400">Phone</label>
                  <input
                    type="text"
                    placeholder="+1 (818) 555-0100"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-hidden font-mono"
                >
                  <option value="America/Los_Angeles (PST)">America/Los_Angeles (PST)</option>
                  <option value="America/New_York (EST)">America/New_York (EST)</option>
                  <option value="America/Toronto (EDT)">America/Toronto (EDT)</option>
                  <option value="Europe/London (GMT/BST)">Europe/London (GMT/BST)</option>
                  <option value="Asia/Tokyo (JST)">Asia/Tokyo (JST)</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={portalAccess}
                    onChange={(e) => setPortalAccess(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                  />
                  <span>Enable Client Review Portal</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                  />
                  <span>Set as Primary Contact</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Save Contact
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
