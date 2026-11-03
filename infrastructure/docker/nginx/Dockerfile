FROM nginx:1.31-alpine@sha256:785835ea65db4bba6f021acc0f3be91b0fef76a53fe41f8588c6698d2aed0606

RUN rm -f /etc/nginx/conf.d/default.conf

COPY infrastructure/docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infrastructure/docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY infrastructure/docker/nginx/security-headers.conf /etc/nginx/security-headers.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]