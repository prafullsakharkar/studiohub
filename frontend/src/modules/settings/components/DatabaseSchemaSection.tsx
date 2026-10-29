import React, { useState } from 'react';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import {
  Database,
  Download,
  FileCode,
  FileJson,
  Copy,
  Check,
  Table,
  Layers,
  Sparkles,
  ExternalLink,
  HardDrive,
  Network,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export const DatabaseSchemaSection: React.FC = () => {
  const [selectedFormat, setSelectedFormat] = useState<'ts' | 'json' | 'tables'>('ts');
  const [hasCopied, setHasCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const handleDownloadFile = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    addNotification({
      type: 'success',
      title: 'Download Started',
      message: `Downloading ${filename}`,
    });
  };

  const handleExportLiveDb = async () => {
    try {
      setIsExporting(true);
      const state = { projects: [] as unknown[], shots: [] as unknown[] };
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const filename = `studiohub-mock-database-snapshot-${new Date().toISOString().split('T')[0]}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addNotification({
        type: 'success',
        title: 'Database Exported',
        message: `Saved active mock database snapshot (${state.projects.length} projects, ${state.shots.length} shots)`,
      });
    } catch {
      addNotification({
        type: 'error',
        title: 'Export Failed',
        message: 'Could not export current database state.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyCode = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
      addNotification({
        type: 'info',
        title: 'Copied to Clipboard',
        message: 'Schema definition copied.',
      });
    } catch {
      // Fallback
    }
  };

  const tablesSummary = [
    { name: 'projects', records: '4 Productions', pk: 'id', fk: '-', desc: 'VFX Production Projects (FPS, Color Space, ACES, OpenUSD)' },
    { name: 'shows', records: '4 Shows', pk: 'id', fk: 'project_id -> projects.id', desc: 'Authoritative show context for production entities' },
    { name: 'sequences', records: '8 Sequences', pk: 'id', fk: 'project_id -> projects.id', desc: 'Episodic and scene sequence breakdowns' },
    { name: 'shots', records: '24+ Shots', pk: 'id', fk: 'sequence_id -> sequences.id, project_id', desc: 'VFX plates, frame ranges, and turnover data' },
    { name: 'assets', records: '16+ Assets', pk: 'id', fk: 'project_id -> projects.id', desc: 'Digital asset catalog (Characters, Props, Vehicles, Rigs)' },
    { name: 'tasks', records: '45+ Tasks', pk: 'id', fk: 'entity_id -> shots/assets, assignee_id', desc: 'Department tasks, schedules, and dependencies' },
    { name: 'timelogs', records: '30+ Logs', pk: 'id', fk: 'task_id -> tasks.id, user_id', desc: 'Tracked work hours and artist billing logs' },
    { name: 'versions', records: '20+ Versions', pk: 'id', fk: 'task_id -> tasks.id, entity_id', desc: 'Published DCC versions, USD stages, and preview media' },
    { name: 'reviews', records: '6 Sessions', pk: 'id', fk: 'project_id, lead_reviewer_id', desc: 'Dailies review sessions with frame annotations' },
    { name: 'deliveries', records: '5 Packages', pk: 'id', fk: 'project_id', desc: 'Client turnover packages and Aspera/S3 manifests' },
    { name: 'users', records: '8 Studio Crew', pk: 'id', fk: '-', desc: 'Production personnel, artists, and supervisors' },
    { name: 'auditLogs', records: '100+ Events', pk: 'id', fk: 'user_id, project_id', desc: 'Tamper-evident mutation logs and pipeline activity' },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Card with Actions */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                <Database className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">Backend Schema & Export</h3>
              <Badge variant="outline" className="text-[10px] font-mono border-indigo-500/30 text-indigo-300">
                v2.0.0
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Download the complete normalized schema in TypeScript (.ts) or JSON Schema (.json), or export the full active database state.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleDownloadFile('/studiohub-mock-db-schema.ts', 'studiohub-mock-db-schema.ts')}
              leftIcon={<Download className="w-3.5 h-3.5" />}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Download Schema (.ts)
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDownloadFile('/studiohub-mock-db-schema.json', 'studiohub-mock-db-schema.json')}
              leftIcon={<FileJson className="w-3.5 h-3.5 text-amber-400" />}
            >
              Download JSON (.json)
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportLiveDb}
              isLoading={isExporting}
              leftIcon={<HardDrive className="w-3.5 h-3.5 text-emerald-400" />}
            >
              Export Live DB
            </Button>
          </div>
        </CardHeader>

        <CardBody className="p-5">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-[10px] uppercase font-mono text-slate-400">Total Collections</div>
              <div className="text-lg font-bold text-white mt-0.5">25 Tables</div>
              <div className="text-[11px] text-emerald-400 mt-0.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Fully Normalized
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-[10px] uppercase font-mono text-slate-400">Partition Key</div>
              <div className="text-lg font-bold text-indigo-300 font-mono mt-0.5">project_id</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Project-Scoped Isolation</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-[10px] uppercase font-mono text-slate-400">Storage Engine</div>
              <div className="text-lg font-bold text-cyan-300 mt-0.5">IndexedDB</div>
              <div className="text-[11px] text-slate-400 mt-0.5">With LocalStorage Fallback</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-[10px] uppercase font-mono text-slate-400">Cross-Tab Sync</div>
              <div className="text-lg font-bold text-emerald-300 mt-0.5">BroadcastChannel</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Realtime Multi-Tab</div>
            </div>
          </div>

          {/* Sub Tab Switcher */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedFormat('ts')}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                  selectedFormat === 'ts'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>TypeScript (.ts)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('json')}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                  selectedFormat === 'json'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>JSON Schema (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('tables')}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                  selectedFormat === 'tables'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Tables & Foreign Keys</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/studiohub-mock-db-schema.ts"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-slate-400 hover:text-indigo-400 flex items-center gap-1"
              >
                <span>Raw File</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  const content =
                    selectedFormat === 'ts'
                      ? '/* StudioHub Mock DB Schema */ export interface MockDatabaseState { ... }'
                      : JSON.stringify(tablesSummary, null, 2);
                  handleCopyCode(content);
                }}
                leftIcon={hasCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              >
                {hasCopied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Tab 1: TypeScript Schema Snippet */}
          {selectedFormat === 'ts' && (
            <div className="relative rounded-xl bg-slate-950 border border-slate-800/80 p-4 font-mono text-xs text-slate-300 overflow-x-auto max-h-96">
              <pre className="leading-relaxed">
{`// Direct Download available: /studiohub-mock-db-schema.ts
export interface MockDatabaseState {
  version: number;                // Schema version (2)
  lastModified: string;           // ISO Timestamp

  // Studio Workspace
  clients: Client[];              // Studio production clients
  vendors: Vendor[];              // Outsourcing VFX vendor facilities
  departments: DepartmentEntity[];// Art, Modeling, Rigging, Comp, etc.
  teams: Team[];                  // Department artist crews
  accessRoles: AccessRole[];      // RBAC role permissions
  users: User[];                  // Studio crew profiles & credentials

  // VFX Production Hierarchy
  projects: Project[];            // Productions (FPS, ACES Color, OpenUSD)
  shows: Show[];                  // Authoritative show contexts
  sequences: Sequence[];          // Scene sequences (SQ01, SQ02)
  shots: Shot[];                  // Cut plates & frame ranges (1001-1120)
  assets: Asset[];                // Characters, Environments, FX Rigs

  // Execution & Tracking
  tasks: Task[];                  // Pipeline tasks & dependencies
  timelogs: Timelog[];            // Tracked artist work hours

  // Media, Publishing & Dailies
  versions: ProductionVersion[];  // DCC publishes, EXR/MP4s, USD stages
  media: MediaItem[];             // Proxy media files & attachments
  reviews: ReviewSession[];       // Dailies rooms & frame annotations
  playlists: Playlist[];          // Ordered review playlists
  editorial: EditorialCut[];      // Conformed EDLs and XML cut lists

  // Client Turnover & Pipeline
  deliveries: DeliveryPackage[];  // Aspera/Signiant client turnovers
  workflows: Workflow[];          // Automation triggers & hooks
  settings: PipelineSettings;     // Global OpenUSD & ACES configuration
  auditLogs: AuditLog[];          // Tamper-evident mutation audit trail
}`}
              </pre>
            </div>
          )}

          {/* Tab 2: JSON Schema Snippet */}
          {selectedFormat === 'json' && (
            <div className="relative rounded-xl bg-slate-950 border border-slate-800/80 p-4 font-mono text-xs text-slate-300 overflow-x-auto max-h-96">
              <pre className="leading-relaxed">
{`// Direct Download available: /studiohub-mock-db-schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "StudioHubMockDatabaseSchema",
  "version": "2.0.0",
  "type": "object",
  "required": [
    "version", "lastModified", "projects",
    "shows", "sequences", "shots", "assets", "tasks",
    "versions", "reviews", "deliveries", "users"
  ],
  "properties": {
    "version": { "type": "integer", "default": 2 },
    "lastModified": { "type": "string", "format": "date-time" },
    "projects": { "type": "array", "items": { "$ref": "#/definitions/Project" } },
    "shots": { "type": "array", "items": { "$ref": "#/definitions/Shot" } },
    "assets": { "type": "array", "items": { "$ref": "#/definitions/Asset" } },
    "tasks": { "type": "array", "items": { "$ref": "#/definitions/Task" } },
    "versions": { "type": "array", "items": { "$ref": "#/definitions/Version" } }
  }
}`}
              </pre>
            </div>
          )}

          {/* Tab 3: Tables & Foreign Keys */}
          {selectedFormat === 'tables' && (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Table Collection</th>
                    <th className="py-2.5 px-3">Mock Records</th>
                    <th className="py-2.5 px-3">Primary Key</th>
                    <th className="py-2.5 px-3">Foreign Key References</th>
                    <th className="py-2.5 px-3">Domain Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                  {tablesSummary.map((t) => (
                    <tr key={t.name} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">{t.name}</td>
                      <td className="py-2.5 px-3 text-slate-300">{t.records}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400">{t.pk}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{t.fk}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
