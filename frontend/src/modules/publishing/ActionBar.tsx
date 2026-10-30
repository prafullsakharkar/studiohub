import type React from 'react';
import { useContext, useState } from 'react';
import { InputError } from '@/api/errors/serverMessage';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { AuthContext } from '@/core/auth/AuthContext';
import { evaluateAccess } from '@/core/permissions/access';
import { Button } from '@/shared/components/Button';
import { publishErrorMessage } from './errors';

export interface BarAction {
  action: string;
  label: string;
  permission: string;
  confirm: string;
  ask?: { label: string; required?: boolean };
  destructive?: boolean;
}

/**
 * The actions a record offers in its status, each behind a dialog that asks for what the call needs and keeps the
 * server’s reason on screen when it refuses. Only the actions the caller holds the permission for are shown; the
 * server decides again.
 */
export function ActionBar<A extends BarAction>({ name, subject, actions, run, primary = [] }: { name: string; subject: string; actions: readonly A[]; run: (action: A, text: string) => Promise<unknown>; primary?: readonly string[] }) {
  const user = useContext(AuthContext)?.user ?? null;
  const [pending, setPending] = useState<A | null>(null);
  const [text, setText] = useState('');
  const offered = actions.filter((a) => evaluateAccess(user, a.permission, {}));
  if (offered.length === 0) return null;
  return (
    <>
      <div role="toolbar" aria-label={name} className="flex flex-wrap gap-2">
        {offered.map((a) => (
          <Button
            key={a.action}
            size="sm"
            variant={primary.includes(a.action) ? 'primary' : a.destructive ? 'outline' : 'secondary'}
            onClick={() => {
              setText('');
              setPending(a);
            }}
          >
            {a.label}
          </Button>
        ))}
      </div>
      <ConfirmDialog
        isOpen={pending !== null}
        title={pending ? `${pending.label}: ${subject}` : ''}
        confirmLabel={pending?.label ?? 'Confirm'}
        destructive={pending?.destructive}
        message={
          <>
            <p>{pending?.confirm}</p>
            {pending?.ask && (
              <label className="mt-3 block text-xs text-slate-400">
                {pending.ask.label}
                {pending.ask.required ? ' *' : ''}
                <textarea aria-label={pending.ask.label} rows={3} value={text} onChange={(e) => setText(e.target.value)} className="mt-1 block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />
              </label>
            )}
          </>
        }
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          if (pending.ask?.required && !text.trim()) throw new InputError(`${pending.ask.label} is required.`);
          try {
            await run(pending, text.trim());
          } catch (error) {
            // Thrown so the dialog stays open with the specific reason.
            throw new InputError(publishErrorMessage(error));
          }
        }}
      />
    </>
  );
}

export const Empty: React.FC<{ children: string }> = ({ children }) => <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">{children}</p>;
