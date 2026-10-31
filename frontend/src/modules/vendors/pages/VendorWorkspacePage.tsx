import { useQuery } from '@tanstack/react-query';
import { Briefcase } from 'lucide-react';
import type React from 'react';
import { useParams } from 'react-router-dom';
import { vendorsApi } from '@/api/masterdata/directory';
import { EntityHistory } from '@/components/history/EntityHistory';
import { safeWebUrl } from '@/shared/utils/safeUrl';
import { Badge } from '@/shared/components/Badge';
import { DetailGrid } from '@/modules/directory/workspace/DetailGrid';
import { RecordActions } from '@/modules/directory/workspace/RecordActions';
import { WorkspaceShell, type WorkspaceTab } from '@/modules/directory/workspace/WorkspaceShell';
import { VendorContactsTab } from '../components/vendor-tabs/VendorContactsTab';
import { VendorContractsTab } from '../components/vendor-tabs/VendorContractsTab';

export const VendorWorkspacePage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const query = useQuery({ queryKey: vendorsApi.keys.detail(id), queryFn: ({ signal }) => vendorsApi.get(id, signal), enabled: id !== '' });
  const vendor = query.data;

  const tabs: WorkspaceTab[] = vendor
    ? [
        {
          id: 'overview',
          label: 'Overview',
          render: () => {
            const link = vendor.bandwidth_link ? safeWebUrl(vendor.bandwidth_link) : null;
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <DetailGrid
                    title="Vendor"
                    items={[
                      { label: 'Code', value: vendor.code },
                      { label: 'Status', value: vendor.status },
                      { label: 'Specialization', value: vendor.specialization },
                      { label: 'Location', value: vendor.location },
                      { label: 'Security tier', value: vendor.security_tier },
                      { label: 'NDA signed', value: vendor.nda_signed ? 'Yes' : 'No' },
                      { label: 'Rating', value: vendor.rating },
                      { label: 'Bandwidth (Gbps)', value: vendor.bandwidth_gbps },
                      { label: 'Bandwidth link', value: link ? <a href={link} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:underline">{vendor.bandwidth_link}</a> : vendor.bandwidth_link },
                      { label: 'Main contact', value: vendor.contact_name },
                      { label: 'Email', value: vendor.email },
                    ]}
                  />
                </div>
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <h3 className="text-sm font-bold text-white">Contacts</h3>
                  <div className="text-3xl font-black text-white font-mono">{vendor.contact_count}</div>
                  <p className="text-xs text-slate-400">People recorded for this vendor.</p>
                </div>
              </div>
            );
          },
        },
        { id: 'contacts', label: 'Contacts', render: () => <VendorContactsTab vendorId={vendor.id} /> },
        { id: 'contracts', label: 'Contracts', render: () => <VendorContractsTab vendorId={vendor.id} /> },
        { id: 'history', label: 'History', render: () => <EntityHistory targetType="Vendor" targetId={vendor.id} title="Vendor history" /> },
      ]
    : [];

  return (
    <WorkspaceShell
      noun="vendor"
      backPath="/vendors"
      backLabel="Directory"
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      record={vendor ? { title: vendor.name, code: vendor.code, icon: <Briefcase className="w-6 h-6" />, badges: <Badge variant={vendor.status === 'Active' ? 'success' : 'neutral'}>{vendor.status || '—'}</Badge>, subtitle: vendor.location } : null}
      actions={
        vendor && (
          <RecordActions
            noun="vendor"
            name={vendor.name}
            id={vendor.id}
            basePath="/vendors"
            queryKey={vendorsApi.keys.all}
            managePermission="masterdata.directory.manage"
            remove={vendorsApi.remove}
            status={{ current: vendor.status, archived: 'Archived', active: 'Active', set: (vid, status) => vendorsApi.update(vid, { status }) }}
          />
        )
      }
      tabs={tabs}
    />
  );
};
