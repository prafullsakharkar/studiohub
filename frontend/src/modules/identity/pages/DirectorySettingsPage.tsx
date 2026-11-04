import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { mapHttpError } from '@/api/errors/errorMapper';
import { directoryApi, directoryKeys } from '@/api/identity/directory';
import type { DirectoryConfiguration, DirectoryConfigurationPatch, DirectoryConnectionResult, DirectoryUserResult } from '@/api/identity/directory';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { SystemNav } from '@/modules/settings';
import { useServerForm } from '@/shared/forms/useServerForm';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Field, FormBanner, PageShell, formatDate, inputClass } from '../components/ui';
import { errorText } from '../errorText';

/** The form's fields: everything editable except `enabled`, which has its own switch (enabling needs a passing test). */
interface FormValues {
  server_uri: string;
  start_tls: boolean;
  ca_certificate: string;
  tls_allow_legacy_ciphers: boolean;
  tls_server_name: string;
  bind_dn: string;
  bind_password: string;
  clear_bind_password: boolean;
  user_search_base: string;
  user_filter: string;
  attr_subject: string;
  attr_username: string;
  attr_email: string;
  attr_first_name: string;
  attr_last_name: string;
  attr_display_name: string;
  timeout_seconds: number;
  default_role_code: string;
  require_mfa: boolean;
}

const toForm = (c: DirectoryConfiguration): FormValues => ({
  server_uri: c.server_uri ?? '',
  start_tls: c.start_tls ?? false,
  ca_certificate: c.ca_certificate ?? '',
  tls_allow_legacy_ciphers: c.tls_allow_legacy_ciphers ?? false,
  tls_server_name: c.tls_server_name ?? '',
  bind_dn: c.bind_dn ?? '',
  bind_password: '',
  clear_bind_password: false,
  user_search_base: c.user_search_base ?? '',
  user_filter: c.user_filter ?? '',
  attr_subject: c.attr_subject ?? '',
  attr_username: c.attr_username ?? '',
  attr_email: c.attr_email ?? '',
  attr_first_name: c.attr_first_name ?? '',
  attr_last_name: c.attr_last_name ?? '',
  attr_display_name: c.attr_display_name ?? '',
  timeout_seconds: c.timeout_seconds ?? 5,
  default_role_code: c.default_role_code ?? '',
  require_mfa: c.require_mfa ?? false,
});

/** The PATCH body: the password only when typed (a new one) or when "remove" is ticked (`''`); absent keeps it. */
const toPatch = ({ bind_password, clear_bind_password, ...rest }: FormValues): DirectoryConfigurationPatch => {
  if (bind_password) return { ...rest, bind_password };
  if (clear_bind_password) return { ...rest, bind_password: '' };
  return rest;
};

/** A 400 here names one field (`enabled`, `username`): its sentence says why, the generic line does not. */
const failureText = (error: unknown) => Object.values(mapHttpError(error).fieldErrors).flat()[0] ?? errorText(error);

const ATTRIBUTES: ReadonlyArray<{ name: keyof FormValues; label: string }> = [
  { name: 'attr_subject', label: 'Unique id (never changes)' },
  { name: 'attr_username', label: 'Username' },
  { name: 'attr_email', label: 'Email' },
  { name: 'attr_first_name', label: 'First name' },
  { name: 'attr_last_name', label: 'Last name' },
  { name: 'attr_display_name', label: 'Display name' },
];

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section aria-label={title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
    <h2 className="text-xs font-bold text-white">{title}</h2>
    {children}
  </section>
);

const Checkbox: React.FC<{ id: string; label: string; error?: string } & React.ComponentProps<'input'>> = ({ id, label, error, ...input }) => (
  <div className="space-y-1">
    <label htmlFor={id} className="flex items-center gap-2 text-xs text-slate-300">
      <input id={id} type="checkbox" className="h-3.5 w-3.5 accent-cyan-500" {...input} />
      {label}
    </label>
    {error && (
      <p role="alert" className="text-[11px] text-rose-400">
        {error}
      </p>
    )}
  </div>
);

const StatusCard: React.FC<{ config: DirectoryConfiguration; onChanged: (c: DirectoryConfiguration) => void }> = ({ config, onChanged }) => {
  const [error, setError] = useState<string | null>(null);
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => directoryApi.update({ enabled }),
    onSuccess: (saved) => {
      setError(null);
      onChanged(saved);
      notify.success(saved.enabled ? 'Directory sign-in is on.' : 'Directory sign-in is off.');
    },
    onError: (e) => setError(failureText(e)),
  });

  return (
    <Card title="Directory sign-in">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={config.enabled && !config.forced_off ? 'success' : 'neutral'}>{config.enabled && !config.forced_off ? 'On' : 'Off'}</Badge>
        <span className="text-[11px] text-slate-400">Last successful connection test: {config.last_tested_at ? formatDate(config.last_tested_at) : 'never (or the connection changed since)'}</span>
      </div>
      {config.forced_off && (
        <p role="status" className="text-[11px] text-amber-300">
          Directory sign-in is switched off on the server (DIRECTORY_LOGIN_FORCE_OFF), whatever this page says.
        </p>
      )}
      {!config.encryption_key_set && (
        <p role="status" className="text-[11px] text-amber-300">
          The server has no DIRECTORY_ENCRYPTION_KEY, so the service password cannot be stored or read.
        </p>
      )}
      <p className="text-[11px] text-slate-500">
        People sign in with their directory username and password; the first sign-in makes their account and People record. Local accounts keep signing in as before.
      </p>
      {error && (
        <p role="alert" className="text-[11px] text-rose-400">
          {error}
        </p>
      )}
      <Button size="sm" variant={config.enabled ? 'outline' : 'primary'} isLoading={toggle.isPending} disabled={config.forced_off} onClick={() => toggle.mutate(!config.enabled)}>
        {config.enabled ? 'Turn directory sign-in off' : 'Turn directory sign-in on'}
      </Button>
    </Card>
  );
};

const SettingsForm: React.FC<{ config: DirectoryConfiguration; onChanged: (c: DirectoryConfiguration) => void }> = ({ config, onChanged }) => {
  const {
    register,
    submit,
    reset,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting },
  } = useServerForm<FormValues>({ defaultValues: toForm(config) });
  const text = (name: keyof FormValues) => register(name, { onChange: clearServerError });

  const onSave = submit(async (values) => {
    const saved = await directoryApi.update(toPatch(values));
    reset(toForm(saved));
    onChanged(saved);
    notify.success('Directory settings saved.');
  });

  return (
    <form noValidate onSubmit={onSave} className="space-y-4">
      <FormBanner error={serverError} />
      <Card title="Connection">
        <p className="text-[11px] text-slate-500">Changing the connection clears the last test: test it again before sign-in can be turned on.</p>
        <Field id="dir-server-uri" label="Server" error={errors.server_uri?.message} hint="ldaps://ldap.example.com, or ldap:// with StartTLS">
          <input id="dir-server-uri" type="text" autoComplete="off" className={inputClass(Boolean(errors.server_uri))} {...text('server_uri')} />
        </Field>
        <Checkbox id="dir-start-tls" label="Use StartTLS" error={errors.start_tls?.message} {...text('start_tls')} />
        <Field id="dir-ca" label="CA certificate (PEM)" error={errors.ca_certificate?.message} hint="Leave empty to trust the server's system certificates.">
          <textarea id="dir-ca" rows={3} className={inputClass(Boolean(errors.ca_certificate))} {...text('ca_certificate')} />
        </Field>
        <Field
          id="dir-tls-name"
          label="Certificate name"
          error={errors.tls_server_name?.message}
          hint="Only when the server address is not a name the certificate carries, e.g. the certificate says ldap and the server is an IP. Leave empty otherwise."
        >
          <input id="dir-tls-name" type="text" autoComplete="off" className={inputClass(Boolean(errors.tls_server_name))} {...text('tls_server_name')} />
        </Field>
        <Checkbox id="dir-legacy-ciphers" label="Allow older RSA ciphers (no forward secrecy)" error={errors.tls_allow_legacy_ciphers?.message} {...text('tls_allow_legacy_ciphers')} />
        <p className="text-[11px] text-slate-500">
          Only for a directory that offers no modern key exchange. The certificate is still checked; updating the directory's TLS is better.
        </p>
        <Field id="dir-bind-dn" label="Service account DN" error={errors.bind_dn?.message}>
          <input id="dir-bind-dn" type="text" autoComplete="off" className={inputClass(Boolean(errors.bind_dn))} {...text('bind_dn')} />
        </Field>
        <Field
          id="dir-bind-password"
          label="Service account password"
          error={errors.bind_password?.message}
          hint={config.bind_password_set ? 'A password is set. Type a new one to replace it; leave empty to keep it.' : 'No password is set.'}
        >
          <input id="dir-bind-password" type="password" autoComplete="new-password" className={inputClass(Boolean(errors.bind_password))} {...text('bind_password')} />
        </Field>
        {config.bind_password_set && <Checkbox id="dir-clear-password" label="Remove the stored password" {...text('clear_bind_password')} />}
        <Field id="dir-timeout" label="Timeout (seconds)" error={errors.timeout_seconds?.message}>
          <input id="dir-timeout" type="number" min={1} max={60} className={inputClass(Boolean(errors.timeout_seconds))} {...register('timeout_seconds', { valueAsNumber: true, onChange: clearServerError })} />
        </Field>
      </Card>

      <Card title="Finding people">
        <Field id="dir-search-base" label="Search base" error={errors.user_search_base?.message} hint="e.g. ou=people,dc=studio,dc=com">
          <input id="dir-search-base" type="text" autoComplete="off" className={inputClass(Boolean(errors.user_search_base))} {...text('user_search_base')} />
        </Field>
        <Field id="dir-filter" label="User filter" error={errors.user_filter?.message} hint="Must contain {username}; the typed username is escaped before it is put in.">
          <input id="dir-filter" type="text" autoComplete="off" className={inputClass(Boolean(errors.user_filter))} {...text('user_filter')} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          {ATTRIBUTES.map((a) => (
            <Field key={a.name} id={`dir-${a.name}`} label={`${a.label} attribute`} error={errors[a.name]?.message}>
              <input id={`dir-${a.name}`} type="text" autoComplete="off" className={inputClass(Boolean(errors[a.name]))} {...text(a.name)} />
            </Field>
          ))}
        </div>
      </Card>

      <Card title="New accounts">
        <Field id="dir-role" label="Role given at the first sign-in" error={errors.default_role_code?.message} hint="A role code, e.g. artist.">
          <input id="dir-role" type="text" autoComplete="off" className={inputClass(Boolean(errors.default_role_code))} {...text('default_role_code')} />
        </Field>
        <Checkbox
          id="dir-require-mfa"
          label="Require two-factor sign-in for every directory account"
          error={errors.require_mfa?.message}
          {...text('require_mfa')}
        />
        <p className="text-[11px] text-slate-500">Off by default. One account can still be required to use it from the person's Account section.</p>
      </Card>

      <Button type="submit" size="sm" variant="primary" isLoading={isSubmitting}>
        Save settings
      </Button>
    </form>
  );
};

const ConnectionTest: React.FC<{ onTested: () => void }> = ({ onTested }) => {
  const [result, setResult] = useState<DirectoryConnectionResult | null>(null);
  const test = useMutation({
    mutationFn: directoryApi.testConnection,
    onSuccess: (r) => {
      setResult(r);
      onTested();
    },
    onError: (e) => setResult({ ok: false, detail: errorText(e) }),
  });
  return (
    <Card title="Test the connection">
      <p className="text-[11px] text-slate-500">Binds with the service account and reads the search base, using the saved settings.</p>
      <Button size="sm" variant="secondary" isLoading={test.isPending} onClick={() => test.mutate()}>
        Test connection
      </Button>
      {result && (
        <p role="status" className={result.ok ? 'text-[11px] text-emerald-300' : 'text-[11px] text-rose-400'}>
          {result.detail}
        </p>
      )}
    </Card>
  );
};

const UserTest: React.FC = () => {
  const [username, setUsername] = useState('');
  const [result, setResult] = useState<DirectoryUserResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const test = useMutation({
    mutationFn: () => directoryApi.testUser(username),
    onSuccess: (r) => {
      setError(null);
      setResult(r);
    },
    onError: (e) => {
      setResult(null);
      setError(failureText(e));
    },
  });
  const entry = result?.entry;
  return (
    <Card title="Look up a username">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          test.mutate();
        }}
      >
        <div className="flex-1">
          <Field id="dir-test-username" label="Username">
            <input id="dir-test-username" type="text" autoComplete="off" className={inputClass(Boolean(error))} value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
        </div>
        <Button type="submit" size="sm" variant="secondary" isLoading={test.isPending}>
          Look up
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-[11px] text-rose-400">
          {error}
        </p>
      )}
      {result && !result.found && <p role="status" className="text-[11px] text-slate-400">{result.detail}</p>}
      {entry && (
        <dl aria-label="Directory entry" className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-[11px]">
          {(
            [
              ['DN', entry.dn],
              ['Unique id', entry.subject],
              ['Username', entry.username],
              ['Email', entry.email],
              ['First name', entry.first_name],
              ['Last name', entry.last_name],
              ['Display name', entry.display_name],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-slate-500">{label}</dt>
              <dd className="font-mono text-slate-200 break-all">{value || '—'}</dd>
            </div>
          ))}
        </dl>
      )}
      {(result?.problems ?? []).map((p) => (
        <p key={p} role="alert" className="text-[11px] text-amber-300">
          {p}
        </p>
      ))}
    </Card>
  );
};

/** `/settings/system/directory`: the directory (LDAP) sign-in settings (CR-40). Needs `identity.directory.manage`. */
export const DirectorySettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: directoryKeys.all, queryFn: ({ signal }) => directoryApi.get(signal) });
  const onChanged = (saved: DirectoryConfiguration) => queryClient.setQueryData(directoryKeys.all, saved);
  const refetch = () => void queryClient.invalidateQueries({ queryKey: directoryKeys.all });

  return (
    <>
      <SystemNav />
      <PageShell title="Directory (LDAP)" subtitle="Sign-in with the studio's OpenLDAP directory, beside local accounts.">
        <QueryBoundary isLoading={config.isLoading} error={config.error} onRetry={() => void config.refetch()} entityName="directory settings">
          {config.data && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] max-w-6xl">
              <SettingsForm config={config.data} onChanged={onChanged} />
              <div className="space-y-4">
                <StatusCard config={config.data} onChanged={onChanged} />
                <ConnectionTest onTested={refetch} />
                <UserTest />
              </div>
            </div>
          )}
        </QueryBoundary>
      </PageShell>
    </>
  );
};
