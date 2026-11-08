# Pterodactyl image with Bun (installed at startup)

FROM --platform=$TARGETOS/$TARGETARCH debian:bookworm-slim

LABEL author="Oxyde Groupe Bot's" maintainer="gabsamw@oxyde-bots.xyz"

ENV DEBIAN_FRONTEND=noninteractive \
    HOME=/home/container \
    USER=container \
    TZ=UTC \
    LANG=en_US.UTF-8 \
    BUN_INSTALL=/home/container/.bun

# ffmpeg from the Debian repos, no static build needed
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl wget git tar unzip xz-utils zip jq \
        iproute2 iptables sqlite3 locales tzdata \
        python3 build-essential make g++ cmake libtool autoconf automake \
        ffmpeg libopus0 \
        libnspr4 libnss3 \
        libatk1.0-0 libatk-bridge2.0-0 \
        libcups2 libatspi2.0-0 \
        libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
        libxkbcommon0 libgbm1 libdrm2 \
        libdbus-1-3 libasound2 \
        libpango-1.0-0 libcairo2 libxshmfence1 \
        fonts-liberation \
    && locale-gen en_US.UTF-8 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

# No Bun here, /home/container is a volume so the build would be hidden.
# entrypoint.sh handles install + updates.

RUN useradd -m -d /home/container container

USER container
WORKDIR /home/container

COPY --chmod=755 ./entrypoint.sh /entrypoint.sh

CMD ["/bin/bash", "/entrypoint.sh"]
