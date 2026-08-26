import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Shield, HardDrive, Globe, Award, Layers } from 'lucide-react';
import { useVendors, useVendorMutations } from '../hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

export const VendorFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const { data: vendorsData, isLoading } = useVendors();
  const { createVendor, updateVendor } = useVendorMutations();

  const existing = vendorsData?.results?.find((v) => v.id === id);

  // Form Fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [specialization, setSpecialization] = useState<'Roto / Prep' | 'Creature FX' | 'Matchmove' | 'Environments' | 'Matte Painting' | 'Full VFX'>('Roto / Prep');
  const [location, setLocation] = useState('Mumbai, India');
  const [securityTier, setSecurityTier] = useState<'MPAA Certified Tier 4' | 'CDSA High Security' | 'TPN App and Cloud Gold'>('MPAA Certified Tier 4');
  const [bandwidthLink, setBandwidthLink] = useState('10 Gbps Dark Fiber');
  const [status, setStatus] = useState<'Active' | 'Under Review' | 'Archived'>('Active');
  const [rating, setRating] = useState(4.8);
  const [activeTasksCount, setActiveTasksCount] = useState(12);

  useEffect(() => {
    if (isEdit && existing) {
      setName(existing.name);
      setCode(existing.code);
      setSpecialization(existing.specialization as any);
      setLocation(existing.location);
      setSecurityTier(existing.security_tier as any);
      setBandwidthLink(existing.bandwidth_link || '10 Gbps Direct Link');
      setStatus(existing.status as any);
      setRating(existing.rating);
      setActiveTasksCount(existing.active_tasks_count);
    }
  }, [isEdit, existing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    if (isEdit && id) {
      updateVendor.mutate(
        {
          id,
          data: {
            name,
            code: code.toUpperCase(),
            specialization,
            location,
            security_tier: securityTier,
            bandwidth_link: bandwidthLink,
            status,
            rating: Number(rating),
            active_tasks_count: Number(activeTasksCount),
          },
        },
        {
          onSuccess: () => navigate(`/vendors/${id}`),
        }
      );
    } else {
      createVendor.mutate(
        {
          name,
          code: code.toUpperCase(),
          specialization,
          location,
          security_tier: securityTier,
          bandwidth_link: bandwidthLink,
          status,
          rating: Number(rating),
          active_tasks_count: Number(activeTasksCount),
          active_projects: ['NK99', 'CR88'],
        },
        {
          onSuccess: (newVen) => navigate(`/vendors/${newVen.id}`),
        }
      );
    }
  };

  if (isEdit && isLoading) {
    return <div className="p-8 text-center text-xs font-mono text-slate-400">Loading vendor...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Back Link */}
      <Link
        to={isEdit ? `/vendors/${id}` : '/vendors'}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {isEdit ? 'Back to Vendor Workspace' : 'Back to Vendor Directory'}
      </Link>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="pb-5 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-purple-400" />
            {isEdit ? `Edit Vendor: ${existing?.name || name}` : 'Register New Vendor Partner'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure organization-level partner studio, security tiering, pipe credentials, and outsourcing specializations.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Studio Name and Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                Vendor Studio Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Apex Silhouette Labs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                Vendor Code (3-4 Letters) *
              </label>
              <input
                type="text"
                required
                maxLength={4}
                placeholder="e.g. ASL"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden font-mono"
              />
            </div>
          </div>

          {/* Specialization and Security Tier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                Primary VFX Discipline Specialization
              </label>
              <select
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-hidden font-mono"
              >
                <option value="Roto / Prep">Roto / Prep</option>
                <option value="Creature FX">Creature FX & Rigging</option>
                <option value="Matchmove">Matchmove & Tracking</option>
                <option value="Environments">Environments & DMP</option>
                <option value="Matte Painting">Matte Painting</option>
                <option value="Full VFX">Full Turnkey VFX</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                Facility Security Accreditation
              </label>
              <select
                value={securityTier}
                onChange={(e) => setSecurityTier(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-hidden font-mono"
              >
                <option value="MPAA Certified Tier 4">MPAA Certified Tier 4 (Air-gapped)</option>
                <option value="CDSA High Security">CDSA High Security</option>
                <option value="TPN App and Cloud Gold">TPN App and Cloud Gold</option>
              </select>
            </div>
          </div>

          {/* Location and Bandwidth */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                Facility Geographic Location
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Mumbai, India"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                Optical Dedicated Bandwidth
              </label>
              <input
                type="text"
                placeholder="e.g. 10 Gbps Dark Fiber"
                value={bandwidthLink}
                onChange={(e) => setBandwidthLink(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden font-mono"
              />
            </div>
          </div>

          {/* Status, Rating, Active Tasks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                Account Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-hidden font-mono"
              >
                <option value="Active">Active Partner</option>
                <option value="Under Review">Under Review</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                Initial Quality Score (1.0 - 5.0)
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                Active Tasks Capacity
              </label>
              <input
                type="number"
                min="0"
                value={activeTasksCount}
                onChange={(e) => setActiveTasksCount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-hidden font-mono"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-800">
            <Link to={isEdit ? `/vendors/${id}` : '/vendors'}>
              <Button type="button" variant="outline" size="sm">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {isEdit ? 'Save Changes' : 'Create Vendor Partner'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
