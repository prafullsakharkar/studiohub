# Setting up a new database

The project starts from one fresh set of migrations (`0001_initial` in every app; `0002_initial` in
`audit`, `core` and `deliveries`, where apps depend on each other). The earlier chain of 115 migrations
was removed on 2026-10-28 because the project had no data to keep. Every database built from the old
chain is incompatible and must be wiped and rebuilt (below); the old files are in git history.

## One command for a new database

```bash
cd backend
uv run python manage.py bootstrap
```

It migrates, runs `init_platform` (permissions, roles, statuses, departments, teams, offices, positions),
makes sure the default work calendar exists, and creates the first superuser with the `platform-admin`
role. Running it again changes nothing, except that it restores a superuser who was demoted or disabled.
`--no-migrate` skips the migrations; `--reset-password` sets the superuser's password again.

What the migrations themselves create, because the models cannot express it: the `btree_gist` extension
(needed by the booking and contract exclusion constraints) and the default work calendar `STUDIO`
(Monday to Friday, 8 hours, UTC). Create your office calendars through the API (`Asia/Kolkata` was chosen).

## The superuser

| Setting | Meaning |
|---|---|
| `INITIAL_ADMIN_EMAIL` | The account's email. |
| `INITIAL_ADMIN_PASSWORD` | Its password. Must pass the password validators. |

Only with `DJANGO_ENV` set to `local` or `testing` may both be left out. Then the development defaults
are used: email `admin@studiohub.local`, password `ChangeMe-Dev-2026!`. In any other environment
(`production`, `docker`, `ci`, anything else) the command stops with an error unless both are set, and
it never prints the password. In every case the account must change its password at the first login
(`must_change_password`). **Never use the development default anywhere a stranger can reach.**

## Wiping a development or test database

```bash
cd backend
scripts/reset_and_bootstrap.sh <database-name>      # wipe, then bootstrap
# or, in two steps:
uv run python manage.py reset_database --name <database-name> --yes-wipe <database-name>
uv run python manage.py bootstrap
```

`reset_database` drops the application role's tables and sequences in the `public` schema. It does not
drop the database, the role's privileges or the installed extensions, so it works without `CREATEDB`.
It stops unless the database name is repeated in `--yes-wipe`, prints the host, port and name it is about
to wipe, refuses when `DJANGO_ENV` is not `local`, `testing`, `ci` or `docker`, and reports any table
another role owns instead of hiding it. PostgreSQL only.

The test database is wiped the same way (`--name test_studiohub`); pytest rebuilds it from the migrations
on its next run.

## Notes

* If the configured cache (Redis) cannot be reached, `bootstrap` says so and uses a local cache for its
  own run. Clear the shared cache afterwards if it held permissions from an older database.
* From now on a model change needs a normal `makemigrations`; CI fails on `makemigrations --check`.
* The Docker start script (`infrastructure/docker/django/start.sh`) still runs only `migrate`. Run
  `bootstrap` once after the first start of a new environment.
