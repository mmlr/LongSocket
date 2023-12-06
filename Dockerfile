FROM python:3.12-alpine

RUN apk add dumb-init

RUN mkdir -p /longsocket/web/novnc

WORKDIR /longsocket

COPY server.py /longsocket/

COPY web/*.js web/*.html web/*.css /longsocket/web/

COPY web/novnc/core /longsocket/web/novnc/core

COPY web/novnc/vendor /longsocket/web/novnc/vendor

ENV PYTHONUNBUFFERED=1

ENTRYPOINT ["dumb-init", "./server.py"]
