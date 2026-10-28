FROM postgres:17@sha256:31ba9c94a03ada9988f2bb493a22a75eef3a185884533e5cdbcd498ea835b08f

RUN apt-get update && apt-get install -y --no-install-recommends \
     postgresql-contrib \
     curl \
     && rm -rf /var/lib/apt/lists/*

COPY infrastructure/docker/postgres/init.sql \
     /docker-entrypoint-initdb.d/

COPY infrastructure/docker/postgres/healthcheck.sh \
     /healthcheck.sh

RUN chmod +x /healthcheck.sh
