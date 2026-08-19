import React, { useState } from 'react';
import {
  Share2,
  Search,
  Plus,
  ShieldCheck,
  Star,
  Activity,
  MapPin,
  Mail,
  Zap,
  Lock,
  Layers,
} from 'lucide-react';
import { useVendors, useVendorMutations } from '../hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { cn } from '@/shared/utils/cn';

export const VendorsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [specFilter, setSpecFilter] = useState('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newSpec, setNewSpec] = useState<
    'Roto & Paint' | 'Matchmove & Tracking' | 'Creature FX & Sim' | 'Environment DMP' | 'Crowd Sim' | 'Stereo Conversion'
  >('Roto & Paint');
  const [newLocation, setNewLocation] = useState('Vancouver, BC');
  const [newSecurity, setNewSecurity] = useState<
    'MPAA Certified Tier 4' | 'CDSA High Security' | 'Standard Studio NDA'
  >('MPAA Certified Tier 4');

  const { data: vendorsData, isLoading } = useVendors({ search });
  const { createVendor } = useVendorMutations();

  const vendors = vendorsData?.results || [];
  const filtered = vendors.filter(
    (v) => specFilter === 'ALL' || v.specialization === specFilter
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newCode.trim()) return;

    createVendor.mutate(
      {
        name: newName,
        code: newCode.toUpperCase(),
        contact_name: newContact,
        email: newEmail,
        specialization: newSpec,
        location: newLocation,
        security_tier: newSecurity,
        nda_signed: true,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setNewName('');
          setNewCode('');
          setNewContact('');
          setNewEmail('');
        },
      }
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Vendors & Outsourcing Partners</h1>
            <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
              {vendors.length} Approved Facilities
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            External roto, matchmove, crowd, and simulation vendors with MPAA/CDSA encrypted turnover pipelines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search partner labs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-52"
            />
          </div>

          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setIsCreateOpen(true)}
          >
            Enroll Vendor
          </Button>
        </div>
      </div>

      {/* Specialization Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['ALL', 'Roto & Paint', 'Matchmove & Tracking', 'Creature FX & Sim', 'Crowd Sim'].map((spec) => (
          <button
            key={spec}
            onClick={() => setSpecFilter(spec)}
            className={cn(
              'px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
              specFilter === spec
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            )}
          >
            {spec === 'ALL' ? 'All Disciplines' : spec}
          </button>
        ))}
      </div>

      {/* Vendor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((vendor) => (
          <div
            key={vendor.id}
            className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={vendor.logo_url}
                    alt={vendor.name}
                    className="w-10 h-10 rounded-lg object-cover ring-1 ring-slate-700 shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white">{vendor.name}</h3>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30">
                        {vendor.code}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {vendor.location} • {vendor.specialization}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-mono font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {vendor.rating.toFixed(1)}
                </div>
              </div>

              {/* Vendor Metadata Bento */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                  <span className="text-[10px] font-mono text-slate-400 block">Active Tasks</span>
                  <span className="text-sm font-bold text-white font-mono">{vendor.active_tasks_count} Shots</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                  <span className="text-[10px] font-mono text-slate-400 block">Bandwidth</span>
                  <span className="text-sm font-bold text-indigo-400 font-mono">{vendor.bandwidth_gbps} Gbps</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                  <span className="text-[10px] font-mono text-slate-400 block">Security Tier</span>
                  <span className="text-[11px] font-bold text-emerald-400 font-mono truncate block">
                    {vendor.security_tier.split(' ')[0]}
                  </span>
                </div>
              </div>

              <div className="mt-3 p-2 rounded-lg bg-slate-950/50 border border-slate-800/60 flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Mail className="w-3 h-3 text-indigo-400" />
                  {vendor.contact_name}: {vendor.email}
                </span>
                <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                  <ShieldCheck className="w-3 h-3" />
                  NDA Verified
                </span>
              </div>
            </div>

            {/* Bottom Status */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="font-mono text-[11px] text-slate-400">
                Shows: {vendor.active_projects.join(', ')}
              </span>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono"
              >
                {vendor.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      {/* Enroll Vendor Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-indigo-400" />
                Enroll Outsourcing Partner
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400">Facility / Studio Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Matchmove Labs"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-slate-400">Vendor Code</label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    placeholder="e.g. AML"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-400">Specialization</label>
                  <select
                    value={newSpec}
                    onChange={(e) => setNewSpec(e.target.value as any)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="Roto & Paint">Roto & Paint</option>
                    <option value="Matchmove & Tracking">Matchmove & Tracking</option>
                    <option value="Creature FX & Sim">Creature FX & Sim</option>
                    <option value="Crowd Sim">Crowd Sim</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Facility Supervisor Name</label>
                <input
                  type="text"
                  placeholder="e.g. Liam Vance"
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Encrypted Delivery Email</label>
                <input
                  type="email"
                  placeholder="deliveries@partnerlab.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Enroll Partner
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
