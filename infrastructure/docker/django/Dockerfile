FROM python:3.14-slim

LABEL maintainer="Prafull Sakharkar"

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV UV_PROJECT_ENVIRONMENT=/opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    git \
    curl \
    libpq-dev \
    pkg-config \
    libldap2-dev \
    libsasl2-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Dependency layer
COPY backend/pyproject.toml .
COPY backend/uv.lock .
COPY backend/README.md .

RUN uv sync --frozen --no-install-project

# Application source
COPY backend/ .

RUN uv sync --frozen

# Startup scripts
COPY --chmod=755 infrastructure/docker/django/entrypoint.sh /entrypoint.sh
COPY --chmod=755 infrastructure/docker/django/start.sh /start.sh
COPY --chmod=755 infrastructure/docker/django/start-celery.sh /start-celery.sh
COPY --chmod=755 infrastructure/docker/django/start-beat.sh /start-beat.sh
COPY --chmod=755 infrastructure/docker/django/start-flower.sh /start-flower.sh

# RUN mkdir -p /static /media && \
#     chown -R app:app /app /static /media
# USER app

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/start.sh"]