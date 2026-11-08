#!/bin/bash

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
CYAN="\033[0;36m"
RED="\033[0;31m"
RESET="\033[0m"

info() { echo -e "${CYAN}→${RESET} $*"; }
ok()   { echo -e "${GREEN}✔${RESET} $*"; }
warn() { echo -e "${YELLOW}!${RESET} $*"; }
err()  { echo -e "${RED}✖${RESET} $*"; }

BUN_DIR="/home/container/.local/bin"
BUN_BIN="${BUN_DIR}/bun"
TMP_DIR="/home/container/tmp"

mkdir -p "${BUN_DIR}" "${TMP_DIR}"
export PATH="${BUN_DIR}:${PATH}"

cd /home/container || {
    err "Can't cd to /home/container"
    exit 1
}

echo -e "${CYAN}"
cat <<'BANNER'
 ██████╗ ██╗  ██╗██╗   ██╗██████╗ ███████╗    ██████╗  ██████╗ ████████╗███████╗
██╔═══██╗╚██╗██╔╝╚██╗ ██╔╝██╔══██╗██╔════╝    ██╔══██╗██╔═══██╗╚══██╔══╝██╔════╝
██║   ██║ ╚███╔╝  ╚████╔╝ ██║  ██║█████╗      ██████╔╝██║   ██║   ██║   ███████╗
██║   ██║ ██╔██╗   ╚██╔╝  ██║  ██║██╔══╝      ██╔══██╗██║   ██║   ██║   ╚════██║
╚██████╔╝██╔╝ ██╗   ██║   ██████╔╝███████╗    ██████╔╝╚██████╔╝   ██║   ███████║
 ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═════╝ ╚══════╝    ╚═════╝  ╚═════╝    ╚═╝   ╚══════╝
BANNER
echo -e "${RESET}"

info "Starting in 2s..."
sleep 2

# Pick the right Bun build for this machine
case "$(uname -m)" in
    x86_64)
        if grep -qi avx2 /proc/cpuinfo 2>/dev/null; then
            BUN_ASSET="bun-linux-x64.zip"
            NPM_PKG="@oven/bun-linux-x64"
        else
            warn "No AVX2, using the baseline build"
            BUN_ASSET="bun-linux-x64-baseline.zip"
            NPM_PKG="@oven/bun-linux-x64-baseline"
        fi
        ;;
    aarch64|arm64)
        BUN_ASSET="bun-linux-aarch64.zip"
        NPM_PKG="@oven/bun-linux-aarch64"
        ;;
    *)
        err "Unsupported architecture: $(uname -m)"
        exit 1
        ;;
esac

# GitHub first, npm if that fails
get_latest_version() {
    local v

    v="$(curl -fsSL --connect-timeout 10 https://api.github.com/repos/oven-sh/bun/releases/latest 2>/dev/null \
        | jq -r '.tag_name // empty' 2>/dev/null \
        | sed 's/^bun-v//')"

    if [ -z "$v" ]; then
        v="$(curl -fsSL --connect-timeout 10 https://registry.npmjs.org/bun/latest 2>/dev/null \
            | jq -r '.version // empty' 2>/dev/null)"
    fi

    echo "$v"
}

install_bun_github() {
    local work="$1"
    local url="https://github.com/oven-sh/bun/releases/latest/download/${BUN_ASSET}"

    info "[GitHub] Downloading ${BUN_ASSET}"
    if ! curl -fSL --retry 3 --connect-timeout 15 "$url" -o "${work}/bun.zip"; then
        warn "[GitHub] Download failed"
        return 1
    fi

    if ! unzip -qo "${work}/bun.zip" -d "${work}/gh"; then
        warn "[GitHub] Unzip failed"
        return 1
    fi

    EXTRACTED="$(find "${work}/gh" -type f -name bun | head -n1)"
    if [ -z "$EXTRACTED" ]; then
        warn "[GitHub] No bun binary in the archive"
        return 1
    fi

    return 0
}

# Pulls the binary package tarball straight from the registry, no npm needed
install_bun_npm() {
    local work="$1"
    local version tarball_url

    info "[npm] Looking up ${NPM_PKG}"

    version="${LATEST_VERSION}"
    if [ -z "$version" ]; then
        version="$(curl -fsSL --connect-timeout 10 "https://registry.npmjs.org/${NPM_PKG}/latest" 2>/dev/null \
            | jq -r '.version // empty' 2>/dev/null)"
    fi

    if [ -z "$version" ]; then
        warn "[npm] Couldn't get a version"
        return 1
    fi

    tarball_url="$(curl -fsSL --connect-timeout 10 "https://registry.npmjs.org/${NPM_PKG}/${version}" 2>/dev/null \
        | jq -r '.dist.tarball // empty' 2>/dev/null)"

    if [ -z "$tarball_url" ]; then
        warn "[npm] No tarball for ${NPM_PKG}@${version}"
        return 1
    fi

    info "[npm] Downloading ${NPM_PKG}@${version}"
    if ! curl -fSL --retry 3 --connect-timeout 15 "$tarball_url" -o "${work}/bun.tgz"; then
        warn "[npm] Download failed"
        return 1
    fi

    mkdir -p "${work}/npm"
    if ! tar -xzf "${work}/bun.tgz" -C "${work}/npm"; then
        warn "[npm] Extract failed"
        return 1
    fi

    EXTRACTED="$(find "${work}/npm" -type f -name bun | head -n1)"
    if [ -z "$EXTRACTED" ]; then
        warn "[npm] No bun binary in the tarball"
        return 1
    fi

    return 0
}

install_bun() {
    local work
    work="$(mktemp -d "${TMP_DIR}/bun.XXXXXX")" || return 1
    EXTRACTED=""

    if ! install_bun_github "$work"; then
        warn "Falling back to npm"
        EXTRACTED=""
        if ! install_bun_npm "$work"; then
            err "GitHub and npm both failed"
            rm -rf "$work"
            return 1
        fi
    fi

    chmod +x "$EXTRACTED"

    # don't replace the working binary with a broken one
    if ! "$EXTRACTED" --version >/dev/null 2>&1; then
        err "Downloaded binary won't run"
        rm -rf "$work"
        return 1
    fi

    mv -f "$EXTRACTED" "${BUN_BIN}.new" && mv -f "${BUN_BIN}.new" "${BUN_BIN}"
    local rc=$?
    rm -rf "$work"
    return $rc
}

if [ ! -x "${BUN_BIN}" ]; then
    warn "Bun not found, installing the latest version"
    LATEST_VERSION="$(get_latest_version)"
    if install_bun; then
        ok "Bun installed: $("${BUN_BIN}" --version)"
    else
        err "Couldn't install Bun, stopping"
        exit 1
    fi
else
    CURRENT_VERSION="$("${BUN_BIN}" --version 2>/dev/null)"
    LATEST_VERSION="$(get_latest_version)"

    info "Bun current: ${CURRENT_VERSION}"
    info "Bun latest:  ${LATEST_VERSION:-unknown}"

    if [ -n "$LATEST_VERSION" ] && [ "$CURRENT_VERSION" != "$LATEST_VERSION" ]; then
        warn "New version available, updating"
        if install_bun; then
            ok "Bun updated: $("${BUN_BIN}" --version)"
        else
            warn "Update failed, staying on ${CURRENT_VERSION}"
        fi
    else
        ok "Bun is up to date"
    fi
fi

# turn {{VAR}} into ${VAR}
MODIFIED_STARTUP=$(echo -e "${STARTUP}" | sed -e 's/{{/${/g' -e 's/}}/}/g')

echo -e "${CYAN}------------------------------------------${RESET}"
info "Running startup command"
echo -e "${YELLOW}:/home/container$ ${MODIFIED_STARTUP}${RESET}"

# eval so the ${VAR}s from the sed above get expanded
eval "${MODIFIED_STARTUP}"

echo -e "${CYAN}------------------------------------------${RESET}"
ok "Container stopped"
