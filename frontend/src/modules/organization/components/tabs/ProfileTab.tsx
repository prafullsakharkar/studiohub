import React from 'react';
import { Building2, Globe, Mail, Phone, MapPin, Shield, Calendar, Award } from 'lucide-react';
import { Organization } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Link } from 'react-router-dom';

export const ProfileTab: React.FC<{ org: Organization }> = ({ org }) => {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Studio Header Card */}
      <div className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <img
              src={org.logo_url}
              alt={org.name}
              className="w-16 h-16 rounded-2xl object-cover ring-1 ring-slate-700 bg-slate-950 shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{org.name}</h2>
                <span className="text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                  {org.code}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">Tenant ID: {org.id}</p>
            </div>
          </div>

          <Link to={`/organizations/${org.id}/edit`}>
            <Button size="sm" variant="outline">
              Edit Studio Profile
            </Button>
          </Link>
        </div>

        {/* Detailed Properties Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div className="space-y-4">
            <h3 className="font-bold text-white uppercase font-mono text-[11px] text-indigo-400">
              Legal & Registration Info
            </h3>

            <div className="space-y-3">
              <div>
                <span className="text-slate-400 block mb-0.5">Operating Entity Name</span>
                <span className="font-medium text-white">{org.name} Limited / Inc.</span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Headquarters & Jurisdiction</span>
                <span className="font-medium text-white flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  {org.headquarters}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Registered URL Slug</span>
                <span className="font-mono text-indigo-300">https://studiohub.vfx/{org.slug}</span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Provisioning Timestamp</span>
                <span className="font-mono text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {new Date(org.created_at).toLocaleDateString()} ({new Date(org.created_at).toLocaleTimeString()})
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-white uppercase font-mono text-[11px] text-indigo-400">
              Key Supervisory Contacts
            </h3>

            <div className="space-y-3">
              <div>
                <span className="text-slate-400 block mb-0.5">Primary Visual Effects Supervisor</span>
                <span className="font-medium text-white">{org.primary_contact_name}</span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Supervisory Email</span>
                <span className="font-mono text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  {org.primary_contact_email}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Service Tier</span>
                <span className="font-medium text-emerald-400 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-emerald-400" />
                  {org.tier}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Security Compliance Status</span>
                <span className="font-medium text-indigo-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  MPAA / CDSA Content Security Audited (Level 4)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
