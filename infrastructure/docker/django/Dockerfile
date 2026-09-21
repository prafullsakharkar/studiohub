# syntax=docker/dockerfile:1
#
# StudioHub backend production image.
#
# Multi-stage build:
#   builder  -> installs the locked dependency set into /opt/venv with `uv`
#               (no dev group, no project install, frozen against uv.lock).
#   runtime  -> minimal image: copied venv + application source, non-root user,
#               no .env, no git metadata, no build toolchain.
#
# The lock file (uv.lock) is authoritative. No dependency resolution happens
# during production deployment.

FROM python:3.14-slim AS builder

ENV \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /uvx /usr/local/bin/

WORKDIR /app

# Build toolchain + headers required to compile any wheel without a prebuilt
# binary. These stay in the builder stage only.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        libpq-dev \
        pkg-config \
        libldap2-dev \
        libsasl2-dev \
        libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Dependency layer (cache-friendly: source is copied afterwards).
COPY backend/pyproject.toml backend/uv.lock ./

RUN uv sync --frozen --no-install-project --no-dev

# ---------------------------------------------------------------------------

FROM python:3.14-slim AS runtime

ENV \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    DJANGO_SETTINGS_MODULE="config.settings.production"

WORKDIR /app

# Runtime shared libraries only. psycopg[binary]/argon2/pillow ship wheels, so
# no compiler or -dev packages are required here.
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        libssl3 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --home-dir /app --shell /usr/sbin/nologin app

# Reproducible dependency set produced in the builder stage.
COPY --from=builder /opt/venv /opt/venv

# Application source (build context is the repository root; see .dockerignore).
COPY backend/ ./

# Runtime entrypoint / process scripts.
COPY --chmod=755 infrastructure/docker/django/entrypoint.sh /entrypoint.sh
COPY --chmod=755 infrastructure/docker/django/start.sh /start.sh
COPY --chmod=755 infrastructure/docker/django/start-prod.sh /start-prod.sh
COPY --chmod=755 infrastructure/docker/django/start-celery.sh /start-celery.sh
COPY --chmod=755 infrastructure/docker/django/start-beat.sh /start-beat.sh
COPY --chmod=755 infrastructure/docker/django/start-flower.sh /start-flower.sh

# Writable media/static dirs owned by the app user so collectstatic and media
# uploads work without running as root.
RUN mkdir -p /app/static /app/media \
    && chown -R app:app /app

USER app

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/start-prod.sh"]
