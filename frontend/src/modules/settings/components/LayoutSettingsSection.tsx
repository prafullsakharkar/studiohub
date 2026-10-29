import React from 'react';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { usePageLayoutStore, LayoutDensity, ContainerWidth } from '@/core/layout/usePageLayoutStore';
import {
  Layout,
  Maximize2,
  Minimize2,
  CheckCircle2,
  RotateCcw,
  Sliders,
  Sparkles,
  Layers,
  Monitor,
  Check,
} from 'lucide-react';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export const LayoutSettingsSection: React.FC = () => {
  const {
    density,
    containerWidth,
    headerSticky,
    setDensity,
    setContainerWidth,
    setHeaderSticky,
    resetLayout,
  } = usePageLayoutStore();

  const addNotification = useNotificationStore((state) => state.addNotification);

  const handleReset = () => {
    resetLayout();
    addNotification({
      type: 'info',
      title: 'Layout Reset',
      message: 'Restored default Organization layout (Comfortable + Edge-to-Edge).',
    });
  };

  const densities: {
    id: LayoutDensity;
    title: string;
    description: string;
    paddingClass: string;
    recommendedFor: string;
  }[] = [
    {
      id: 'compact',
      title: 'Compact Density',
      description: 'Tight padding (12px/16px) and reduced vertical gap (space-y-4).',
      paddingClass: 'p-3 sm:p-4 space-y-4',
      recommendedFor: 'High-density production workflows, multi-shot lists, and laptop screens',
    },
    {
      id: 'comfortable',
      title: 'Comfortable Density (Default)',
      description: 'Standard Organization page spacing (p-4 sm:p-6 space-y-6).',
      paddingClass: 'p-4 sm:p-6 space-y-6',
      recommendedFor: 'Standard Studio Organization balance between information and whitespace',
    },
    {
      id: 'spacious',
      title: 'Spacious Density',
      description: 'Expansive breathing space (24px/32px) and wide gaps (space-y-8).',
      paddingClass: 'p-6 sm:p-8 space-y-8',
      recommendedFor: 'Executive dashboards, presentation reviews, and ultra-wide studio monitors',
    },
  ];

  const widths: {
    id: ContainerWidth;
    title: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'full',
      title: 'Edge-to-Edge (Full Width)',
      description: 'Utilizes 100% of available viewport width without restrictive gutters. Matches Organization page.',
      icon: <Maximize2 className="w-4 h-4 text-indigo-400" />,
    },
    {
      id: 'contained',
      title: 'Contained (Max-w-7xl)',
      description: 'Constrains page body width to max 1280px with auto centered gutters.',
      icon: <Minimize2 className="w-4 h-4 text-indigo-400" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <Layout className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Studio Default Page Layout Configuration
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active System-Wide
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Configure default margins, container padding, and header pinning applied across all pages.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Reset to Organization Defaults
          </Button>
        </CardHeader>
      </Card>

      {/* Spacing Density Card */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Default Spacing & Padding Density</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Governs the body outer padding and vertical card rhythm for all studio pages.
          </p>
        </CardHeader>
        <CardBody className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {densities.map((item) => {
              const isSelected = density === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setDensity(item.id);
                    addNotification({
                      type: 'success',
                      title: `Density Updated: ${item.title}`,
                      message: 'Stored as default layout across all studio pages.',
                    });
                  }}
                  className={`relative p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-600/10 border-indigo-500 ring-2 ring-indigo-500/30'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm text-white flex items-center gap-1.5">
                      {item.title}
                    </div>
                    {isSelected ? (
                      <span className="p-1 rounded-full bg-indigo-500 text-white">
                        <Check className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-slate-700" />
                    )}
                  </div>

                  <p className="text-xs text-slate-300 mt-2">{item.description}</p>
                  <div className="mt-3 pt-3 border-t border-slate-800/80 font-mono text-[11px] text-indigo-300">
                    Class: <span className="text-slate-400">{item.paddingClass}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    <span className="text-slate-400 font-semibold">Best for:</span> {item.recommendedFor}
                  </p>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Container Width Card */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Container Width Mode</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Choose whether pages stretch fluidly across wide monitors or remain centered with maximum boundary constraints.
          </p>
        </CardHeader>
        <CardBody className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {widths.map((item) => {
              const isSelected = containerWidth === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setContainerWidth(item.id);
                    addNotification({
                      type: 'success',
                      title: `Container Width Updated: ${item.title}`,
                      message: 'Stored as default layout across all studio pages.',
                    });
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                    isSelected
                      ? 'bg-indigo-600/10 border-indigo-500 ring-2 ring-indigo-500/30'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-white">{item.title}</h4>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Header Behavior & Persistence Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">Header Pinning & Backdrop</h3>
            </div>
          </CardHeader>
          <CardBody className="p-5 space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={headerSticky}
                onChange={(e) => setHeaderSticky(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-800 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-300 font-medium">
                Keep page header & navigation tabs sticky at top during scroll
              </span>
            </label>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              When enabled, studio page headers remain fixed with blur backdrop (<code className="text-indigo-300 font-mono">backdrop-blur-md</code>) while scrolling through long asset lists or permission matrices.
            </p>
          </CardBody>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Local Persistence Storage</h3>
            </div>
          </CardHeader>
          <CardBody className="p-5 space-y-3">
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 font-mono text-xs space-y-1">
              <div className="text-slate-400">Storage Key: <span className="text-indigo-300">studio_page_layout_default</span></div>
              <div className="text-slate-400">Active Density: <span className="text-emerald-400 font-bold">{density}</span></div>
              <div className="text-slate-400">Container Width: <span className="text-emerald-400 font-bold">{containerWidth}</span></div>
              <div className="text-slate-400">Header Sticky: <span className="text-emerald-400 font-bold">{String(headerSticky)}</span></div>
            </div>
            <p className="text-[11px] text-slate-400">
              Preferences are saved in your browser and automatically applied to Organization, Access & RBAC, Pipeline & Settings, and Roles & Security pages.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
