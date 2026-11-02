import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { Link } from 'react-router-dom';
import { assetsApi } from '@/api/production/work';
import type { Asset } from '@/api/production/work';
import { DetailGrid } from '@/modules/directory/workspace/DetailGrid';
import { Badge } from '@/shared/components/Badge';
import { fetchAllRows } from '@/shared/data/listing';
import { safeWebUrl } from '@/shared/utils/safeUrl';

/**
 * The asset above and below this one. The API names the parent; it has no filter for the children, so they are the
 * project's assets whose own `parent_asset_id` is this asset.
 */
const AssetHierarchy: React.FC<{ asset: Asset }> = ({ asset }) => {
  const parent = useQuery({ queryKey: assetsApi.keys.detail(asset.parent_asset_id ?? ''), queryFn: ({ signal }) => assetsApi.get(asset.parent_asset_id as string, signal), enabled: Boolean(asset.parent_asset_id), staleTime: 60_000 });
  const children = useQuery({
    queryKey: [...assetsApi.keys.lists(), 'children-of', asset.id],
    queryFn: async ({ signal }) => (await fetchAllRows(assetsApi.list, { project: asset.project_id }, { signal })).filter((a) => a.parent_asset_id === asset.id),
  });
  const kids = children.data ?? [];
  if (!asset.parent_asset_id && kids.length === 0) return null;
  return (
    <section aria-label="Hierarchy" className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
      <h3 className="text-sm font-bold text-white">Hierarchy</h3>
      {asset.parent_asset_id && (
        <p className="text-xs text-slate-300">
          Part of{' '}
          {parent.data ? (
            <Link to={`/assets/${parent.data.id}`} className="text-indigo-300 hover:underline">
              {parent.data.code} {parent.data.name}
            </Link>
          ) : (
            '…'
          )}
        </p>
      )}
      {kids.length > 0 && (
        <ul className="space-y-1 text-xs" aria-label="Child assets">
          {kids.map((a) => (
            <li key={a.id}>
              <Link to={`/assets/${a.id}`} className="text-indigo-300 hover:underline">
                {a.code} {a.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/** An asset's own fields as the API sends them; a field it does not have is left out, not invented. */
export const AssetOverview: React.FC<{ asset: Asset }> = ({ asset }) => {
  const turntable = asset.turntable_video_url ? safeWebUrl(asset.turntable_video_url) : undefined;
  return (
    <div className="space-y-4">
      <DetailGrid
        title="Asset"
        description={asset.description}
        items={[
          { label: 'Code', value: asset.code },
          { label: 'Name', value: asset.name },
          { label: 'Status', value: asset.status },
          { label: 'Category', value: asset.category },
          { label: 'Asset type', value: asset.asset_type_name },
          { label: 'Version', value: asset.version },
          { label: 'Project', value: asset.project_code },
          { label: 'Department', value: asset.department_name },
          { label: 'Team', value: asset.team_name },
          { label: 'Assigned artist', value: asset.assigned_artist_name },
          { label: 'Software', value: asset.software },
          { label: 'File format', value: asset.file_format },
          { label: 'Polygons', value: asset.poly_count },
          { label: 'LOD levels', value: asset.lod_levels },
          { label: 'USD prim path', value: asset.usd_prim_path ? <span className="font-mono">{asset.usd_prim_path}</span> : null },
          { label: 'Tags', value: asset.tags?.length ? <span className="flex flex-wrap gap-1">{asset.tags.map((t) => <Badge key={t} variant="neutral">{t}</Badge>)}</span> : null },
          { label: 'Turntable', value: turntable ? <a href={turntable} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:underline">Open</a> : null },
        ]}
      />
      <AssetHierarchy asset={asset} />
    </div>
  );
};
