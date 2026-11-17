import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { reviewMediaApi } from '@/api/production/review';
import type { ReviewColourOptions } from '@/api/production/review';
import { Field, inputClass } from '@/shared/forms/FormParts';

/** The project fields chosen from the studio's OpenColorIO config (RP-15, C-RP-39). */
export type ReviewColourField = 'color_space' | 'review_view' | 'review_look';

const LABELS: Record<ReviewColourField, string> = {
  color_space: 'Color space',
  review_view: 'Review view',
  review_look: 'Review look',
};

/** What a blank value means for each field. */
export function blankLabel(field: ReviewColourField, options: ReviewColourOptions | undefined): string {
  if (field === 'color_space') return 'None: EXR copies use the plain linear-to-sRGB curve';
  if (field === 'review_view') return options?.default_view ? `Default: ${options.default_view}` : 'Default view';
  return 'None';
}

/** The choices of `field`, grouped where the config groups them (colour spaces by family). */
export function choicesOf(field: ReviewColourField, options: ReviewColourOptions): { group: string; names: string[] }[] {
  if (field === 'review_view') return [{ group: '', names: options.views }];
  if (field === 'review_look') return [{ group: '', names: options.looks }];
  const groups = new Map<string, string[]>();
  for (const space of options.color_spaces) {
    const group = space.family.split('/')[0] || 'Other';
    groups.set(group, [...(groups.get(group) ?? []), space.name]);
  }
  return [...groups].map(([group, names]) => ({ group, names }));
}

/** Whether `value` is one of the config's names for `field` (blank always is). */
export function knownTo(field: ReviewColourField, options: ReviewColourOptions, value: string): boolean {
  return value === '' || choicesOf(field, options).some((g) => g.names.includes(value));
}

const HINTS: Record<ReviewColourField, string> = {
  color_space: 'The colour space of the EXR frames uploaded for review. They are shown through the review view below.',
  review_view: 'How review copies of EXR frames (and uploads that name a colour space) are shown on an sRGB screen.',
  review_look: 'An optional look applied with the view.',
};

/**
 * A select of the names the studio's colour config offers for one project field (RP-15). A stored value the config does
 * not know (a project made before RP-15) stays chosen and is marked; the server only checks a value that changes.
 */
export const ReviewColourSelect: React.FC<{ field: ReviewColourField; value: string; onChange: (value: string) => void; error?: string }> = ({ field, value, onChange, error }) => {
  const { data: options, isError } = useQuery({
    queryKey: reviewMediaApi.colourOptionsKey,
    queryFn: ({ signal }) => reviewMediaApi.colourOptions(signal),
    staleTime: 5 * 60_000,
  });
  const id = `f-${field}`;
  const unavailable = isError || options?.available === false;
  const stray = options?.available && !knownTo(field, options, value);
  const hint = unavailable
    ? "The studio's colour config cannot be read, so this cannot be changed now."
    : stray
      ? `"${value}" is not in the studio's colour config: copies are made without it until another is chosen.`
      : HINTS[field];
  return (
    <Field id={id} label={LABELS[field]} error={error} hint={hint}>
      <select id={id} value={value} disabled={!options || unavailable} className={inputClass(Boolean(error))} onChange={(e) => onChange(e.target.value)}>
        <option value="">{blankLabel(field, options)}</option>
        {stray && <option value={value}>{value} (not in the studio's colour config)</option>}
        {/* the stored value while the options load, so the form never shows a blank it would not send */}
        {!options?.available && value !== '' && <option value={value}>{value}</option>}
        {options?.available &&
          choicesOf(field, options).map(({ group, names }) =>
            group ? (
              <optgroup key={group} label={group}>
                {names.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            ) : (
              names.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))
            )
          )}
      </select>
    </Field>
  );
};
