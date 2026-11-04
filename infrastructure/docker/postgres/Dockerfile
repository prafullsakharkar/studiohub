FROM postgres:18@sha256:3a4264520e121176619f54ff867d12774bc81e95e7b84db58d63bccdb6144b81

RUN apt-get update && apt-get install -y --no-install-recommends \
     postgresql-contrib \
     curl \
     && rm -rf /var/lib/apt/lists/*

COPY infrastructure/docker/postgres/init.sql \
     /docker-entrypoint-initdb.d/

COPY infrastructure/docker/postgres/healthcheck.sh \
     /healthcheck.sh

RUN chmod +x /healthcheck.sh
