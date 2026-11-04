# CR-41: older directory TLS, the certificate still checked: verification

Branch `sync/backend-cr-41-ldap-tls` (from `develop` at `bfd304d0`), **not pushed, not merged**. This
branch **changes the backend** (CR-41, approved by the owner: "approved CR-41"). The change request and
its evidence are in `backend-change-requests.md`; ADR-0039 decision 4 is amended.

## 1. What changed

| Commit | What |
|---|---|
| `b8ea337f` | CR-41 written (option B: no way to skip the certificate check) |
| `06d99f00` | Backend: two fields on `DirectoryConfiguration`, migration `identity/0004`, the client's `Tls` arguments, validation, 26 tests |
| `6e5ad49c` | OpenAPI snapshot and `openapi.ts` regenerated |
| `6c8b5b13` | Frontend: two controls on the settings page, recaptured samples, tests |
| (this commit) | Docs: `CONTRACTS.md` API-ID-09 and SEC-SEC-11, the ADR amendment, CR status, this report |

- **`tls_allow_legacy_ciphers`** (default off): `Tls(ciphers=LEGACY_CIPHERS)`, which is Python's default cipher list plus `kRSA+AESGCM`. Only `AES256-GCM-SHA384` and `AES128-GCM-SHA256` are added. This is tighter than the `DEFAULT:kRSA` the CR first named, which would also have added SHA-1 and CBC suites; the CR text now says so.
- **`tls_server_name`** (default empty): `Tls(valid_names=[name])`. The certificate must carry either that name or the URI's host. Only one host name (RFC 1123 labels, at most 253 characters) or one IP address is accepted. A wildcard, scheme, port, space or trailing newline is refused (`400` on `tls_server_name`).
  - **Why the wildcard rule matters:** ldap3's `check_hostname` treats the name `*` as "any certificate is valid". An expected name of `*` would have switched the check off.
- **Unchanged:** `validate=ssl.CERT_REQUIRED`. No setting turns the certificate check off.
- **Connection test and audit:** both fields count as connection settings. Changing either clears `last_tested_at`, so turning sign-in on needs a new test, and the audit event names the field.
- **Frontend:** the Connection card gains a "Certificate name" field and an "Allow older RSA ciphers (no forward secrecy)" checkbox, with hints. The server's refusal of a bad name is shown on the field.
- **Schema snapshot:** besides the two fields, the regenerated snapshot corrects the `Login` schema. The snapshot taken in `c3a74f43` came from an intermediate CR-40 build with a `username` alias, which was removed before commit; `email` is now required, as the backend has it. Nothing in the frontend used the alias.

## 2. Evidence

| Check | Result |
|---|---|
| New backend tests (`apps/identity/tests/security/test_directory_tls.py`) | **26 pass**. The `Tls` arguments: defaults unchanged; each setting changes only its own argument; the cipher list adds exactly the two AES-GCM suites. **Real TLS handshakes** against a local server shaped like the studio's (TLS 1.2, `AES256-GCM-SHA384` only, self-signed `CN=ldap`): the defaults fail on the handshake; older ciphers alone are refused on the name; older ciphers plus the name `ldap` connect; a wrong name is refused; no trusted certificate, or the wrong one, is refused. The API: the fields round-trip and start off; 7 bad names refused, 4 good ones accepted; either change clears the test and blocks enabling; audited by field name |
| Against the studio's server (`ldap://192.168.1.17`, StartTLS, no credentials sent; the app's own `DirectoryClient.server()`) | defaults: `SSLV3_ALERT_HANDSHAKE_FAILURE`. Older ciphers, the server's certificate as CA and name `ldap`: **StartTLS succeeds, cipher `AES256-GCM-SHA384`, certificate checked** |
| Backend mutations | **11 run, 11 caught**: `validate` changed to `CERT_NONE`; ciphers always or never applied; the cipher list widened to `kRSA`; the name always `*` or never applied; the name check accepting anything, or not run; either field missing from the connection fields; the fields not editable |
| Backend regression | see §2a |
| `ruff check`, `ruff format`, `basedpyright` | clean. Changed files: 0 basedpyright errors. All changed files were formatted at HEAD or are new, so formatting them stays within the quality gate. `makemigrations --check`: no changes |
| Frontend gates | `pnpm typecheck` clean; Biome 0 errors; `pnpm test` **1,177 pass** (2 new); `pnpm build` ok; nothing new unreachable |
| Frontend mutations | **3 run, 3 caught**: the name or the cipher setting not read back from the server; the name's error not shown |
| Samples | `identity/_directory_flow.json` recaptured: 36 responses, new ones `patch_tls_options`, `patch_tls_options_off`, `patch_bad_server_name` |

### 2a. Regression run

`uv run pytest --no-cov apps/identity apps/core apps/masterdata`: **3,051 passed**, 0 failed (4 min 36 s). This includes the masterdata role-grant tests that caught CR-40 on CI and the bootstrap migration-count test. The full backend suite was not run locally; CI runs it.

## 3. What the studio enters

| Field | Value |
|---|---|
| Server | `ldap://192.168.1.17`, **Use StartTLS** ticked |
| CA certificate | the server's own certificate (`CN=ldap`, valid to 2028-12-28; compare its SHA-256 fingerprint on the server first) |
| Certificate name | `ldap` |
| Allow older RSA ciphers | ticked |

Then save, **Test connection**, **Look up a username**, and turn sign-in on. The development database needs `migrate` (`identity/0004`) after the merge.

## 4. Not done, and limits

- **No option to skip the certificate check** (option C), by the owner's choice of B.
- **No forward secrecy with older ciphers.** Someone who records sign-in traffic now and later obtains the LDAP server's private key could read the passwords in it. Updating slapd (`olcTLSCipherSuite` with ECDHE) and then unticking the option removes that risk.
- **The service-account bind and a username lookup against the real server were not run here.** They need the service password, which I did not use; the owner runs them from the page.
