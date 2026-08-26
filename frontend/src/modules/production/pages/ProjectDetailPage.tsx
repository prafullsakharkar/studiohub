import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProject } from '../hooks/useProjects';
import { useShots } from '@/modules/shots/hooks/useShots';
import { useAssets } from '@/modules/assets/hooks/useAssets';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { Badge } from '@/shared/components/Badge';
import {
  ArrowLeft,
  Calendar,
  Film,
  Layers,
  Clock,
  DollarSign,
  User,
  Clapperboard,
  Box,
  Sliders,
  Building,
  Briefcase,
  ExternalLink,
  Shield,
} from 'lucide-react';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading: isProjLoading } = useProject(id!);
  const { data: shotsData } = useShots({ project: id, page_size: 6 });
  const { data: assetsData } = useAssets({ project: id, page_size: 6 });

  if (isProjLoading) {
    return <LoadingSpinner size="lg" label="Loading project production ledger..." />;
  }

  if (!project) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold text-white">Project Not Found</h2>
        <p className="text-xs text-slate-400">The requested production manifest does not exist.</p>
        <Link to="/projects">
          <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  const shots = shotsData?.results || [];
  const assets = assetsData?.results || [];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link to="/projects">
            <button className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                {project.code}
              </span>
              <h1 className="text-xl font-bold text-white tracking-tight">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{project.type} Production</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Link to="/shots">
            <Button variant="secondary" size="sm" leftIcon={<Film className="w-4 h-4" />}>
              Explore Shots
            </Button>
          </Link>
          <Link to="/reviews">
            <Button variant="primary" size="sm" leftIcon={<Clapperboard className="w-4 h-4" />}>
              Screening Dailies
            </Button>
          </Link>
        </div>
      </div>

      {/* Production Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardBody className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-indigo-400" />
                Client Studio
              </span>
              {project.client_id && (
                <Link
                  to={`/clients/${project.client_id}`}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                >
                  Workspace <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              )}
            </div>
            <p className="text-sm font-bold text-white">{project.client_name}</p>
            {project.client_contact_name && (
              <p className="text-[11px] text-slate-400 font-mono">Contact: {project.client_contact_name}</p>
            )}
          </CardBody>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardBody className="p-4 space-y-1">
            <span className="text-xs text-slate-400">VFX Supervisor</span>
            <p className="text-sm font-bold text-white">{project.supervisor_name}</p>
            <p className="text-[11px] text-slate-400 font-mono">Coord: {project.coordinator_name}</p>
          </CardBody>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardBody className="p-4 space-y-1">
            <span className="text-xs text-slate-400">Pipeline Color & Format</span>
            <p className="text-sm font-bold text-indigo-400">{project.color_space}</p>
            <p className="text-[11px] text-slate-400 font-mono">{project.fps} FPS @ {project.resolution}</p>
          </CardBody>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardBody className="p-4 space-y-1">
            <span className="text-xs text-slate-400">Delivery Deadline</span>
            <p className="text-sm font-bold text-white">{project.delivery_date}</p>
            <p className="text-[11px] text-emerald-400 font-mono">${(project.budget_usd / 1000000).toFixed(2)}M Budget</p>
          </CardBody>
        </Card>
      </div>

      {/* Outsourcing Vendors Card */}
      {project.vendor_names && project.vendor_names.length > 0 && (
        <Card className="bg-slate-900/90 border-slate-800">
          <CardBody className="p-4">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  Contracted Outsourcing Vendor Partners ({project.vendor_names.length})
                </h3>
              </div>
              <Link to="/vendors" className="text-xs text-purple-400 hover:text-purple-300">
                Vendor Directory →
              </Link>
            </div>

            <div className="flex flex-wrap gap-2">
              {project.vendor_names.map((vName, idx) => {
                const vId = project.vendor_ids?.[idx];
                return (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-3 text-xs"
                  >
                    <span className="font-bold text-white">{vName}</span>
                    {vId && (
                      <Link
                        to={`/vendors/${vId}`}
                        className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-mono"
                      >
                        Workspace <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Description & Overview */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <h3 className="text-sm font-semibold text-white">Production Brief & Scope</h3>
        </CardHeader>
        <CardBody className="p-5 text-sm text-slate-300 leading-relaxed">
          {project.description}
        </CardBody>
      </Card>

      {/* Shots List preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clapperboard className="w-5 h-5 text-indigo-400" />
            Show Shots ({shots.length})
          </h3>
          <Link to="/shots" className="text-xs text-indigo-400 hover:text-indigo-300">
            View full shot table →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shots.map((shot) => (
            <Card key={shot.id} className="bg-slate-900 border-slate-800">
              <CardBody className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-white text-sm">{shot.code}</span>
                  <StatusBadge status={shot.status} />
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{shot.description}</p>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800">
                  <span>Frame Range: {shot.frame_in} - {shot.frame_out} ({shot.frame_count}f)</span>
                  <span className="text-slate-300 font-semibold">{shot.assigned_artist_name || 'Unassigned'}</span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* USD Assets preview */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Box className="w-5 h-5 text-indigo-400" />
            Linked OpenUSD Assets ({assets.length})
          </h3>
          <Link to="/assets" className="text-xs text-indigo-400 hover:text-indigo-300">
            View asset directory →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {assets.map((asset) => (
            <Card key={asset.id} className="bg-slate-900 border-slate-800">
              <CardBody className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-indigo-400">{asset.category}</span>
                  <StatusBadge status={asset.status} />
                </div>
                <h4 className="text-sm font-bold text-white">{asset.name}</h4>
                <p className="text-xs font-mono text-slate-400">{asset.code} ({asset.version})</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
