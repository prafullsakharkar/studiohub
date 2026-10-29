import type React from 'react';
import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { catalogApi, softwareVersionsApi } from '@/api/masterdata/catalog';
import type { AssetType, CatalogKind, CatalogRowBase, FileType, MasterStatus, ReviewType, ShotType, Software, SoftwareVersion, TaskType } from '@/api/masterdata/catalog';
import { Dialog } from '@/components/ui/Dialog';
import type { FieldDef } from '@/modules/directory/types';
import { cn } from '@/shared/utils/cn';
import { CatalogTable } from './CatalogTable';

const base: FieldDef[] = [
  { kind: 'text', name: 'name', label: 'Name', required: true },
  { kind: 'text', name: 'code', label: 'Code', required: true },
  { kind: 'textarea', name: 'description', label: 'Description' },
];
const withOrder: FieldDef[] = [{ kind: 'number', name: 'sort_order', label: 'Sort order', hint: 'Use the arrows in the list to reorder.' }];

const nameCode = <T extends CatalogRowBase>() => [
  { header: 'Name', cell: (r: T) => r.name },
  { header: 'Code', cell: (r: T) => <span className="font-mono">{r.code}</span> },
];

const LABELS: Record<CatalogKind, string> = {
  'task-types': 'Task types',
  'asset-types': 'Asset types',
  'shot-types': 'Shot types',
  'review-types': 'Review types',
  'file-types': 'File types',
  statuses: 'Statuses',
  software: 'Software',
};
const KINDS = Object.keys(LABELS) as CatalogKind[];

const VersionsDialog: React.FC<{ software: Software; onClose: () => void }> = ({ software, onClose }) => (
  <Dialog isOpen onClose={onClose} title={`${software.name}: versions`} size="2xl">
    <CatalogTable<SoftwareVersion & CatalogRowBase>
      scope={['software', software.id, 'versions']}
      noun="version"
      api={softwareVersionsApi(software.id) as never}
      fields={[
        { kind: 'text', name: 'version', label: 'Version', required: true },
        { kind: 'text', name: 'version_code', label: 'Version code' },
        { kind: 'text', name: 'name', label: 'Name' },
        { kind: 'date', name: 'release_date', label: 'Release date' },
        { kind: 'date', name: 'end_of_support', label: 'End of support' },
        ...withOrder,
      ]}
      columns={[
        { header: 'Version', cell: (v) => v.version },
        { header: 'Released', cell: (v) => v.release_date ?? '—' },
        { header: 'End of support', cell: (v) => v.end_of_support ?? '—' },
      ]}
    />
  </Dialog>
);

function KindPanel({ kind }: { kind: CatalogKind }) {
  const [versionsOf, setVersionsOf] = useState<Software | null>(null);
  const api = catalogApi(kind) as never;
  switch (kind) {
    case 'task-types':
      return (
        <CatalogTable<TaskType & CatalogRowBase>
          scope={[kind]}
          noun="task type"
          api={api}
          fields={[...base, { kind: 'text', name: 'category', label: 'Category' }, { kind: 'text', name: 'department_code', label: 'Department code' }, { kind: 'text', name: 'color', label: 'Color' }, { kind: 'text', name: 'icon', label: 'Icon' }, ...withOrder]}
          columns={[...nameCode<TaskType & CatalogRowBase>(), { header: 'Category', cell: (r) => r.category || '—' }, { header: 'Department', cell: (r) => r.department_name || r.department_code || '—' }]}
        />
      );
    case 'asset-types':
      return (
        <CatalogTable<AssetType & CatalogRowBase> scope={[kind]} noun="asset type" api={api} fields={[...base, { kind: 'text', name: 'color', label: 'Color' }, { kind: 'text', name: 'icon', label: 'Icon' }, ...withOrder]} columns={nameCode<AssetType & CatalogRowBase>()} />
      );
    case 'shot-types':
      return (
        <CatalogTable<ShotType & CatalogRowBase>
          scope={[kind]}
          noun="shot type"
          api={api}
          fields={[...base, { kind: 'number', name: 'default_handle_frames', label: 'Default handle frames' }, ...withOrder]}
          columns={[...nameCode<ShotType & CatalogRowBase>(), { header: 'Handles', cell: (r) => r.default_handle_frames ?? '—' }]}
        />
      );
    case 'review-types':
      return (
        <CatalogTable<ReviewType & CatalogRowBase>
          scope={[kind]}
          noun="review type"
          api={api}
          fields={[...base, { kind: 'checkbox', name: 'allow_verdicts', label: 'Allow verdicts' }, { kind: 'checkbox', name: 'require_notes', label: 'Require notes' }, ...withOrder]}
          columns={[...nameCode<ReviewType & CatalogRowBase>(), { header: 'Verdicts', cell: (r) => (r.allow_verdicts ? 'Yes' : 'No') }, { header: 'Notes required', cell: (r) => (r.require_notes ? 'Yes' : 'No') }]}
        />
      );
    case 'file-types':
      return (
        <CatalogTable<FileType & CatalogRowBase>
          scope={[kind]}
          noun="file type"
          api={api}
          fields={[...base, { kind: 'text', name: 'extension', label: 'Extension' }, { kind: 'text', name: 'mime_type', label: 'MIME type' }, { kind: 'text', name: 'category', label: 'Category' }, { kind: 'text', name: 'dcc_affinity', label: 'DCC affinity' }, ...withOrder]}
          columns={[...nameCode<FileType & CatalogRowBase>(), { header: 'Extension', cell: (r) => r.extension || '—' }, { header: 'Category', cell: (r) => r.category || '—' }]}
        />
      );
    case 'statuses':
      return (
        <CatalogTable<MasterStatus & CatalogRowBase>
          scope={[kind]}
          noun="status"
          api={api}
          fields={[{ kind: 'text', name: 'entity_type', label: 'Applies to', required: true, hint: 'The record type, for example Task or Shot.' }, ...base, { kind: 'text', name: 'category', label: 'Category' }, { kind: 'text', name: 'color', label: 'Color' }, { kind: 'number', name: 'order', label: 'Order' }, { kind: 'checkbox', name: 'is_default', label: 'Default for new records' }, { kind: 'checkbox', name: 'is_final', label: 'Final status' }]}
          columns={[{ header: 'Applies to', cell: (r) => r.entity_type }, ...nameCode<MasterStatus & CatalogRowBase>(), { header: 'Flags', cell: (r) => [r.is_default && 'default', r.is_final && 'final'].filter(Boolean).join(', ') || '—' }]}
        />
      );
    case 'software':
      return (
        <>
          <CatalogTable<Software & CatalogRowBase>
            scope={[kind]}
            noun="software"
            api={api}
            fields={[...base, { kind: 'text', name: 'publisher', label: 'Publisher' }, { kind: 'text', name: 'category', label: 'Category' }, { kind: 'url', name: 'website', label: 'Website' }, ...withOrder]}
            columns={[...nameCode<Software & CatalogRowBase>(), { header: 'Publisher', cell: (r) => r.publisher || '—' }, { header: 'Versions', cell: (r) => r.version_count }]}
            rowExtra={(row) => (
              <button type="button" className="text-cyan-300 hover:underline" aria-label={`Versions of ${row.name}`} onClick={() => setVersionsOf(row)}>
                Versions
              </button>
            )}
          />
          {versionsOf && <VersionsDialog software={versionsOf} onClose={() => setVersionsOf(null)} />}
        </>
      );
  }
}

/** Platform catalog administration: the lookup lists other screens choose from. */
export const CatalogAdminPage: React.FC = () => {
  const { kind } = useParams<{ kind?: string }>();
  const active = (KINDS as string[]).includes(kind ?? '') ? (kind as CatalogKind) : 'task-types';
  return (
    <div className="p-4 sm:p-6 space-y-5 flex-1 min-h-0 w-full">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Catalog</h1>
        <p className="text-xs text-slate-400 mt-1">Task, asset, shot, review and file types, statuses and software. Reading is open; changing needs the catalog permission.</p>
      </div>
      <nav aria-label="Catalog sections" className="flex gap-1 border-b border-slate-800 overflow-x-auto">
        {KINDS.map((k) => (
          <NavLink key={k} to={`/platform/catalog/${k}`} className={() => cn('px-3 py-2 text-xs font-semibold border-b-2 -mb-px whitespace-nowrap', active === k ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200')}>
            {LABELS[k]}
          </NavLink>
        ))}
      </nav>
      <KindPanel key={active} kind={active} />
    </div>
  );
};
