import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { credentialKeys, credentialsApi } from '@/api/identity/account';
import type { Credential, CredentialKind, IssuedCredential } from '@/api/identity/account';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { Dialog } from '@/components/ui/Dialog';
import { useAuth } from '@/modules/auth';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Field, FormBanner, Table, formatDate, inputClass } from '../components/ui';
import { useServerForm } from '@/shared/forms/useServerForm';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const KINDS: ReadonlyArray<{ id: CredentialKind; label: string; noun: string }> = [
  { id: 'tokens', label: 'Personal access tokens', noun: 'token' },
  { id: 'keys', label: 'API keys', noun: 'key' },
];

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  description: z.string().optional(),
  expires_at: z.string().optional(),
});
type Values = z.infer<typeof schema>;

/** The secret exists only in this response; closing the dialog loses it for good. */
const SecretDialog: React.FC<{ issued: IssuedCredential | null; onClose: () => void }> = ({ issued, onClose }) => {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog isOpen={issued !== null} onClose={() => undefined} title="Copy your secret now" size="md">
      <div className="space-y-3">
        <p className="text-xs text-slate-300">This is the only time the secret for “{issued?.name}” is shown. Store it somewhere safe.</p>
        <code aria-label="Secret" className="block break-all rounded border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-cyan-300">
          {issued?.secret}
        </code>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Copy className="w-3.5 h-3.5" />}
          onClick={() => {
            void navigator.clipboard?.writeText(issued?.secret ?? '').catch(() => undefined);
            setCopied(true);
          }}
        >
          {copied ? 'Copied' : 'Copy secret'}
        </Button>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setCopied(false);
              onClose();
            }}
          >
            I have stored it
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

const CreateDialog: React.FC<{ kind: CredentialKind; noun: string; isOpen: boolean; onClose: () => void; onIssued: (issued: IssuedCredential) => void }> = ({ kind, noun, isOpen, onClose, onIssued }) => {
  const { user } = useAuth();
  const held = useMemo(() => [...(user?.permissions ?? [])].sort(), [user?.permissions]);
  const [scopes, setScopes] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [scopeError, setScopeError] = useState<string | null>(null);
  const {
    register,
    submit,
    reset,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting },
  } = useServerForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', description: '', expires_at: '' } });

  const close = () => {
    reset();
    setScopes([]);
    setFilter('');
    setScopeError(null);
    clearServerError();
    onClose();
  };

  const onSubmit = submit(async (values) => {
    // The API requires a non-empty scope list of codes the caller holds; there is no "unrestricted" option here.
    if (scopes.length === 0) {
      setScopeError('Choose at least one permission.');
      return;
    }
    const issued = await credentialsApi.create(kind, {
      name: values.name,
      ...(values.description ? { description: values.description } : {}),
      scopes,
      ...(values.expires_at ? { expires_at: new Date(values.expires_at).toISOString() } : {}),
    });
    close();
    onIssued(issued);
  });

  const visible = held.filter((code) => code.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <Dialog isOpen={isOpen} onClose={close} title={`New ${noun}`} size="lg">
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <FormBanner error={serverError} />
        <Field id="cred-name" label="Name" error={errors.name?.message}>
          <input id="cred-name" className={inputClass(Boolean(errors.name))} {...register('name', { onChange: clearServerError })} />
        </Field>
        <Field id="cred-description" label="Description (optional)">
          <input id="cred-description" className={inputClass()} {...register('description')} />
        </Field>
        <Field id="cred-expires" label="Expires (optional)">
          <input id="cred-expires" type="datetime-local" className={inputClass()} {...register('expires_at')} />
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-xs font-mono text-slate-400">Permissions this {noun} may use (only ones you hold)</legend>
          <input aria-label="Filter permissions" placeholder="Filter…" className={inputClass()} value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-800 p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
            {visible.map((code) => (
              <label key={code} className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={scopes.includes(code)}
                  onChange={(e) => {
                    setScopeError(null);
                    setScopes((current) => (e.target.checked ? [...current, code] : current.filter((c) => c !== code)));
                  }}
                />
                <span className="font-mono">{code}</span>
              </label>
            ))}
            {visible.length === 0 && <p className="text-xs text-slate-500">No permission matches.</p>}
          </div>
          <p className="text-[11px] text-slate-500">{scopes.length} selected</p>
          {scopeError && (
            <p role="alert" className="text-[11px] text-rose-400">
              {scopeError}
            </p>
          )}
        </fieldset>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Create {noun}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

export const TokensPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<CredentialKind>('tokens');
  const [showRevoked, setShowRevoked] = useState(false);
  const [creating, setCreating] = useState(false);
  const [issued, setIssued] = useState<IssuedCredential | null>(null);
  const [rotating, setRotating] = useState<Credential | null>(null);
  const [revoking, setRevoking] = useState<Credential | null>(null);
  const { noun } = KINDS.find((k) => k.id === kind) ?? KINDS[0];

  const list = useQuery({ queryKey: [...credentialKeys.all, kind, showRevoked], queryFn: ({ signal }) => credentialsApi.listAll(kind, showRevoked, signal) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: credentialKeys.all });

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Credential types" className="flex gap-1 border-b border-slate-800">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="tab"
            aria-selected={kind === k.id}
            onClick={() => setKind(k.id)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px ${kind === k.id ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={showRevoked} onChange={(e) => setShowRevoked(e.target.checked)} /> Show revoked
        </label>
        <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
          New {noun}
        </Button>
      </div>

      <QueryBoundary
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        entityName="credentials"
        isEmpty={(list.data ?? []).length === 0}
        empty={{ title: `No ${noun}s`, description: `Create a ${noun} to call the API without your password.` }}
      >
        <Table label="Credentials" columns={['Name', 'Prefix', 'Permissions', 'Last used', 'Expires', 'Status', '']}>
          {(list.data ?? []).map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-2 text-slate-200">{c.name}</td>
              <td className="px-4 py-2 font-mono text-slate-400">{c.prefix}</td>
              <td className="px-4 py-2 text-slate-400">{c.unrestricted ? 'All of your permissions' : `${c.scopes.length} permission${c.scopes.length === 1 ? '' : 's'}`}</td>
              <td className="px-4 py-2 text-slate-400">{formatDate(c.last_used_at)}</td>
              <td className="px-4 py-2 text-slate-400">{c.expires_at ? formatDate(c.expires_at) : 'Never'}</td>
              <td className="px-4 py-2">
                <Badge variant={c.revoked_at ? 'neutral' : c.is_active ? 'success' : 'warning'}>{c.revoked_at ? 'Revoked' : c.is_active ? 'Active' : 'Inactive'}</Badge>
              </td>
              <td className="px-4 py-2 text-right space-x-3">
                {!c.revoked_at && (
                  <>
                    <button type="button" className="text-cyan-300 hover:underline" aria-label={`Rotate ${c.name}`} onClick={() => setRotating(c)}>
                      Rotate
                    </button>
                    <button type="button" className="text-rose-400 hover:underline" aria-label={`Revoke ${c.name}`} onClick={() => setRevoking(c)}>
                      Revoke
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </QueryBoundary>

      <CreateDialog
        kind={kind}
        noun={noun}
        isOpen={creating}
        onClose={() => setCreating(false)}
        onIssued={(next) => {
          setIssued(next);
          void refresh();
        }}
      />
      <SecretDialog issued={issued} onClose={() => setIssued(null)} />

      <ConfirmDialog
        isOpen={rotating !== null}
        title={`Rotate ${noun}`}
        message={`A new secret replaces the current one for “${rotating?.name ?? ''}”. Anything still using the old secret stops working.`}
        confirmLabel="Rotate"
        destructive
        onClose={() => setRotating(null)}
        onConfirm={async () => {
          if (!rotating) return;
          const next = await credentialsApi.rotate(kind, rotating.id);
          setIssued(next);
          await refresh();
        }}
      />
      <ConfirmDialog
        isOpen={revoking !== null}
        title={`Revoke ${noun}`}
        message={`“${revoking?.name ?? ''}” stops working immediately. This cannot be undone.`}
        confirmLabel="Revoke"
        destructive
        onClose={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return;
          await credentialsApi.revoke(kind, revoking.id);
          await refresh();
        }}
      />
    </div>
  );
};
