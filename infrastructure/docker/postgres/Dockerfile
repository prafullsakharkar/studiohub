FROM postgres:17

RUN apt-get update && apt-get install -y \
     postgresql-contrib \
     curl \
     && rm -rf /var/lib/apt/lists/*

COPY infrastructure/docker/postgres/init.sql \
     /docker-entrypoint-initdb.d/

COPY infrastructure/docker/postgres/healthcheck.sh \
     /healthcheck.sh

RUN chmod +x /healthcheck.sh
