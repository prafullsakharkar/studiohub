import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProject, useProjects } from '../hooks/useProjects';
import { useProjectMutations } from '../hooks/useProjectMutations';
import { Button } from '@/shared/components/Button';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { ArrowLeft, Film, Building, Layers, Check, Sparkles } from 'lucide-react';
import { Project } from '@/mocks/db/production/projects';
import { mockClients, mockVendors } from '@/mocks/db/organization/organization';
import { mockClientContacts } from '@/mocks/db/organization/clientVendorDetails';
import { ClientSelect } from '@/modules/organization/components/ClientSelect';
import { ClientContactSelect } from '@/modules/organization/components/ClientContactSelect';
import { VendorSelect } from '@/modules/organization/components/VendorSelect';

export const ProjectFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const { data: project, isLoading: isProjectLoading } = useProject(id);
  const { data: allProjectsData } = useProjects();
  const { createProject, updateProject, isCreating, isUpdating } = useProjectMutations();

  const resolvedProject =
    project || (id ? allProjectsData?.results.find((p) => p.id === id) : undefined);

  const [formData, setFormData] = useState<Partial<Project>>({
    name: '',
    code: '',
    type: 'Feature Film',
    description: '',
    status: 'In Progress',
    delivery_date: '2026-11-30',
    budget_usd: 3500000,
    fps: 24,
    resolution: '4096x2160 (4K DCI)',
    color_space: 'ACEScg / Linear',
    aspect_ratio: '2.39:1',
    client_id: 'cli-001',
    client_name: 'Warner Nexus Entertainment',
    client_contact_name: 'David Z. Kogen',
    vendor_ids: ['ven-001', 'ven-002'],
    vendor_names: ['Scanline Roto & Prep Lab', 'Virtuos Creature FX House'],
    total_shots: 240,
    approved_shots: 0,
    total_assets: 85,
  });

  useEffect(() => {
    if (resolvedProject && isEdit) {
      setFormData(resolvedProject);
    }
  }, [resolvedProject, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEdit && id) {
      await updateProject({ id, data: formData });
      navigate(`/projects/${id}`);
    } else {
      const newProj = await createProject({
        ...formData,
        approved_shots: 0,
        created_at: new Date().toISOString(),
      });
      navigate(`/projects/${newProj.id}`);
    }
  };

  const handleClientChange = (clientId: string, clientName?: string) => {
    const contacts = mockClientContacts.filter((c) => c.client_id === clientId);
    const primary = contacts.find((c) => c.is_primary) || contacts[0];
    setFormData((prev) => ({
      ...prev,
      client_id: clientId,
      client_name: clientName || '',
      client_contact_id: primary?.id,
      client_contact_name: primary?.name,
    }));
  };

  const handleVendorToggle = (vendorId: string, vendorName?: string) => {
    const currentIds = formData.vendor_ids || [];
    const currentNames = formData.vendor_names || [];

    if (currentIds.includes(vendorId)) {
      setFormData((prev) => ({
        ...prev,
        vendor_ids: currentIds.filter((vId) => vId !== vendorId),
        vendor_names: currentNames.filter((vName) => vName !== vendorName),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        vendor_ids: [...currentIds, vendorId],
        vendor_names: vendorName ? [...currentNames, vendorName] : currentNames,
      }));
    }
  };

  if (isEdit && isProjectLoading && !resolvedProject) {
    return (
      <div className="py-20">
        <LoadingSpinner size="lg" label="Loading project details..." />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Back Button */}
      <Link
        to={isEdit && id ? `/projects/${id}` : '/projects'}
        className="inline-flex items-center text-xs font-mono text-slate-400 hover:text-indigo-400 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> {isEdit ? 'Back to Show Workspace' : 'Back to Projects Directory'}
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight font-sans">
            {isEdit ? `Edit Project: ${formData.name || formData.code}` : 'Initialize New Production Project'}
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            {isEdit
              ? 'Update technical specs, show milestones, client liaison, and partner assignments.'
              : 'Provision a top-level production show container with OpenUSD color pipelines and studio routing.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Identity */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                1. Project Identity & Production Classification
              </h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Project Title / Show Name *</label>
                <input
                  required
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Neo-Kyoto 2099: Cyber Runner"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Project Code (Short ID) *</label>
                <input
                  required
                  type="text"
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. NK99"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Production Type</label>
                <select
                  value={formData.type || 'Feature Film'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="Feature Film">Feature Film</option>
                  <option value="Episodic Series">Episodic Series</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Game Cinematic">Game Cinematic</option>
                  <option value="Virtual Production">Virtual Production</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Lifecycle Status</label>
                <select
                  value={formData.status || 'In Progress'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="Turnover">Turnover</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Pending Review">Pending Review</option>
                  <option value="Final Color">Final Color</option>
                  <option value="Completed">Completed</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Master Delivery Target Date</label>
                <input
                  type="date"
                  value={formData.delivery_date || '2026-11-30'}
                  onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Project Brief & Production Synopsis</label>
              <textarea
                rows={3}
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="High-level narrative context, visual effects scope, and studio creative direction..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </CardBody>
        </Card>

        {/* Client & Vendor Relationships */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                2. Client Studio & Outsourcing Vendor Assignments
              </h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Client Studio Entity</label>
                <ClientSelect
                  value={formData.client_id}
                  onChange={handleClientChange}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Client Contact Representative</label>
                <ClientContactSelect
                  clientId={formData.client_id}
                  value={formData.client_contact_id}
                  onChange={(contactId, contactName) =>
                    setFormData((prev) => ({
                      ...prev,
                      client_contact_id: contactId,
                      client_contact_name: contactName,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300">Contracted Outsourcing Vendors</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {mockVendors.map((vendor) => {
                  const isAssigned = formData.vendor_ids?.includes(vendor.id);
                  return (
                    <div
                      key={vendor.id}
                      onClick={() => handleVendorToggle(vendor.id, vendor.name)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                        isAssigned
                          ? 'bg-purple-950/40 border-purple-500/50 text-white'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-bold block">{vendor.name}</span>
                        <span className="text-[10px] font-mono text-purple-300">{vendor.specialization} • {vendor.location}</span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                          isAssigned ? 'bg-purple-600 text-white' : 'border border-slate-700 text-transparent'
                        }`}
                      >
                        ✓
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Technical Pipeline Envelope */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                3. Technical Pipeline & Format Specifications
              </h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Master Color Space</label>
                <select
                  value={formData.color_space || 'ACEScg / Linear'}
                  onChange={(e) => setFormData({ ...formData, color_space: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                >
                  <option value="ACEScg / Linear">ACEScg / Linear (ACES 1.3)</option>
                  <option value="ACES2065-1 (AP0)">ACES2065-1 (AP0 Archive)</option>
                  <option value="Rec.709 Gamma 2.4">Rec.709 Gamma 2.4</option>
                  <option value="DCI-P3 D65">DCI-P3 D65</option>
                  <option value="ARRI LogC4">ARRI LogC4</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Master Resolution</label>
                <select
                  value={formData.resolution || '4096x2160 (4K DCI)'}
                  onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                >
                  <option value="4096x2160 (4K DCI)">4096x2160 (4K DCI)</option>
                  <option value="3840x2160 (UHD)">3840x2160 (UHD)</option>
                  <option value="2048x1080 (2K DCI)">2048x1080 (2K DCI)</option>
                  <option value="1920x1080 (HD)">1920x1080 (HD)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Master FPS</label>
                <select
                  value={formData.fps || 24}
                  onChange={(e) => setFormData({ ...formData, fps: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                >
                  <option value={24}>24.0 FPS (Theatrical)</option>
                  <option value={23.976}>23.976 FPS (Broadcast)</option>
                  <option value={25}>25.0 FPS (PAL/EU)</option>
                  <option value={29.97}>29.97 FPS (NTSC)</option>
                  <option value={60}>60.0 FPS (HFR)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Budget (USD)</label>
                <input
                  type="number"
                  value={formData.budget_usd || 0}
                  onChange={(e) => setFormData({ ...formData, budget_usd: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Link to={isEdit && id ? `/projects/${id}` : '/projects'}>
            <Button variant="ghost" size="md" type="button">
              Cancel
            </Button>
          </Link>

          <Button
            variant="primary"
            size="md"
            type="submit"
            isLoading={isCreating || isUpdating}
            leftIcon={<Check className="w-4 h-4" />}
          >
            {isEdit ? 'Update Project Container' : 'Initialize Project'}
          </Button>
        </div>
      </form>
    </div>
  );
};
