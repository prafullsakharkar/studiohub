import React, { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { masterDataApi } from '@/api/masterDataApi';
import type { Position } from '@/types/masterData';

interface ProductionRoleSelectProps {
  /** Selected position id. Blank means "no pick yet". */
  value?: string;
  /** Stored `role` display string, shown when `value` is absent from the list. */
  fallbackRoleName?: string;
  onChange: (roleId: string, position?: Position) => void;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

export function roleDisplayLabel(position: Position, duplicateTitles: Set<string>): string {
  if (!duplicateTitles.has(position.title)) return position.title;
  const bits = [position.department, position.code].filter(Boolean);
  return bits.length ? `${position.title} (${bits.join(' · ')})` : `${position.title} (${position.id})`;
}

/**
 * Position dropdown fed by the flat `/api/v1/positions/` endpoint.
 * Required with a blank default; Master / Custom optgroups; duplicate titles
 * get department/code suffixes; a stored role_id absent from the list clears
 * to blank (submit stays blocked) while the stored display name remains
 * visible via `fallbackRoleName`.
 */
export const ProductionRoleSelect: React.FC<ProductionRoleSelectProps> = ({
  value,
  fallbackRoleName,
  onChange,
  required = true,
  disabled = false,
  id,
}) => {
  const { data, isLoading } = useQuery({
    queryKey: ['positions', 'all'],
    queryFn: () => masterDataApi.getPositions({ include: 'all_masters' }),
  });
  const positions = useMemo(() => data?.items ?? [], [data]);

  const masters = useMemo(() => positions.filter((p) => p.scope === 'global_master'), [positions]);
  const customs = useMemo(() => positions.filter((p) => p.scope !== 'global_master'), [positions]);

  const duplicateTitles = useMemo(() => {
    const counts = new Map<string, number>();
    positions.forEach((p) => counts.set(p.title, (counts.get(p.title) ?? 0) + 1));
    return new Set(
      [...counts.entries()].filter(([, n]) => n > 1).map(([title]) => title),
    );
  }, [positions]);

  const loaded = !isLoading;
  const matched = positions.some((p) => p.id === value);
  const stale = loaded && !!value && !matched;
  const displayValue = stale ? '' : (value ?? '');
  const empty = loaded && positions.length === 0;
  const hadRoleIdRef = useRef(false);
  if (value) hadRoleIdRef.current = true;
  const hadRoleId = hadRoleIdRef.current;
  const showRetiredNote = loaded && !!fallbackRoleName && !matched && hadRoleId;
  const showLegacyNote = loaded && !!fallbackRoleName && !matched && !hadRoleId;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (stale) onChangeRef.current('');
  }, [stale]);

  const selectId = id ?? 'production-role-select';

  return (
    <div>
      <label htmlFor={selectId} className="block text-xs font-medium text-slate-300 mb-1">
        Position {required && <span aria-hidden="true">*</span>}
      </label>
      <select
        id={selectId}
        required={required}
        value={displayValue}
        disabled={disabled || isLoading || empty}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next, positions.find((p) => p.id === next));
        }}
        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500 disabled:opacity-50"
      >
        <option value="">
          {isLoading ? 'Loading roles…' : empty ? 'No roles available' : 'Select a production role…'}
        </option>
        {masters.length > 0 && (
          <optgroup label="Master Roles">
            {masters.map((p) => (
              <option key={p.id} value={p.id}>
                {roleDisplayLabel(p, duplicateTitles)}
              </option>
            ))}
          </optgroup>
        )}
        {customs.length > 0 && (
          <optgroup label="Custom Roles">
            {customs.map((p) => (
              <option key={p.id} value={p.id}>
                {roleDisplayLabel(p, duplicateTitles)}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {showRetiredNote && (
        <p className="text-[11px] text-amber-300 mt-1">
          Current role &ldquo;{fallbackRoleName}&rdquo; is no longer available. Select a new role to
          continue.
        </p>
      )}
      {showLegacyNote && (
        <p className="text-[11px] text-slate-400 mt-1">Select a production role to continue</p>
      )}
      {empty && (
        <p className="text-[11px] text-slate-400 mt-1">
          No roles available. Ask an admin to create a position before adding artists.
        </p>
      )}
    </div>
  );
};
