import type React from 'react';
import { useState } from 'react';
import type { ShotGrade } from '@/api/production/work';
import { Button } from '@/shared/components/Button';
import { inputClass } from '@/shared/forms/FormParts';

const CHANNELS = ['slope', 'offset', 'power'] as const;
const RGB = ['R', 'G', 'B'] as const;
/** The grade that changes nothing: what a new grade starts from. */
const IDENTITY: ShotGrade = { slope: [1, 1, 1], offset: [0, 0, 0], power: [1, 1, 1], saturation: 1 };
const LABEL: Record<(typeof CHANNELS)[number], string> = { slope: 'Slope', offset: 'Offset', power: 'Power' };

type Texts = Record<(typeof CHANNELS)[number], [string, string, string]> & { saturation: string };

const toTexts = (g: ShotGrade): Texts => ({
  slope: g.slope.map(String) as [string, string, string],
  offset: g.offset.map(String) as [string, string, string],
  power: g.power.map(String) as [string, string, string],
  saturation: String(g.saturation),
});

/** A typed number, or the text itself, so the server names the part that is not a number (C-RP-52). */
const asNumber = (text: string): number | string => (text.trim() !== '' && Number.isFinite(Number(text)) ? Number(text) : text);

const toJson = (t: Texts): string =>
  JSON.stringify({ slope: t.slope.map(asNumber), offset: t.offset.map(asNumber), power: t.power.map(asNumber), saturation: asNumber(t.saturation) });

function parse(value: string): ShotGrade | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as ShotGrade;
  } catch {
    return null;
  }
}

/**
 * A grade in one line: `slope 1.1 1 0.9 · offset 0.01 0 -0.01 · power 1 1 1.05 · sat 0.9`. The numbers are written as CDL
 * files write them (a point, up to six places), not in the studio's number format: they are copied between tools.
 */
export function gradeText(g: ShotGrade): string {
  const three = (v: readonly number[]) => v.map(String).join(' ');
  return `slope ${three(g.slope)} · offset ${three(g.offset)} · power ${three(g.power)} · sat ${g.saturation}`;
}

/**
 * The shot's grade, its ASC CDL (RP-20, C-RP-52): slope, offset and power for red, green and blue, and saturation. The
 * form holds it as JSON text (`jsonValue`); blank is no grade, which Clear sends as null. The bounds are the server's.
 */
export const ShotGradeField: React.FC<{ value: string; onChange: (value: string) => void; error?: string }> = ({ value, onChange, error }) => {
  const [texts, setTexts] = useState<Texts | null>(() => {
    const grade = parse(value);
    return grade ? toTexts(grade) : null;
  });
  const update = (next: Texts | null) => {
    setTexts(next);
    onChange(next ? toJson(next) : '');
  };
  return (
    <fieldset className="space-y-2" aria-describedby={error ? 'grade-error' : undefined}>
      <legend className="text-xs font-medium text-slate-300">Grade (ASC CDL)</legend>
      {texts === null ? (
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>No grade. Review copies are shown with the project's view only.</span>
          {/* type="button": the field sits in the shot's edit form, and a plain button would submit it */}
          <Button type="button" size="sm" variant="outline" onClick={() => update(toTexts(IDENTITY))}>
            Add grade
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[5rem_repeat(3,minmax(0,1fr))] gap-2 items-center text-xs text-slate-400">
            <span />
            {RGB.map((c) => (
              <span key={c} className="text-center">
                {c}
              </span>
            ))}
            {CHANNELS.map((channel) => (
              <div key={channel} className="contents">
                <span>{LABEL[channel]}</span>
                {RGB.map((c, i) => (
                  <input
                    key={c}
                    type="number"
                    step="any"
                    aria-label={`${LABEL[channel]} ${c}`}
                    className={inputClass(Boolean(error))}
                    value={texts[channel][i]}
                    onChange={(e) => {
                      const three = [...texts[channel]] as [string, string, string];
                      three[i] = e.target.value;
                      update({ ...texts, [channel]: three });
                    }}
                  />
                ))}
              </div>
            ))}
            <span>Saturation</span>
            <input type="number" step="any" aria-label="Saturation" className={inputClass(Boolean(error))} value={texts.saturation} onChange={(e) => update({ ...texts, saturation: e.target.value })} />
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">Slope 0 to 10, offset −1 to 1, power above 0 up to 10, saturation 0 to 10.</p>
            <Button type="button" size="sm" variant="ghost" onClick={() => update(null)}>
              Clear grade
            </Button>
          </div>
        </>
      )}
      {error && (
        <p id="grade-error" role="alert" className="text-xs text-rose-300">
          {error}
        </p>
      )}
    </fieldset>
  );
};
