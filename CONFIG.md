# LavaTools Configuration Guide

LavaTools uses TOML (`config.toml`) for simple, readable, and native configuration under Bun.

Copy `config.example.toml` to get started:
```bash
cp config.example.toml config.toml
```

If updating from an older release using `src/config/config.ts`, migrate automatically:
```bash
bun run migrate:config
```

---

## Configuration Reference

### 1. `[enabled]` (Feature Toggles)

Enable or disable specific services independently.

| Key | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `cipher` | boolean | `true` | Enables YouTube signature/STS/n-parameter deciphering endpoints. |
| `botguard` | boolean | `true` | Enables YouTube BotGuard/WebPO poToken generation endpoints. |
| `spotify` | boolean | `true` | Enables Spotify anonymous token endpoints (`/api/spotify/token`). |
| `rotation` | boolean | `true` | Enables background credential rotation and Lavalink node sync. |

Disabled endpoints immediately respond with HTTP `503 Service Unavailable`.

---

### 2. `[server]`

Network bindings and process configuration.

| Key | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `host` | string | `"0.0.0.0"` | Hostname or IP address to bind. |
| `port` | integer | `3000` | Port to listen on (1–65535). |
| `browserPath` | string | `""` | Path to local Chrome/Chromium executable (used if `spotify.fetchMethod = "browser"`). |

---

### 3. `[logging]`

Application logging configuration.

| Key | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `level` | string | `"info"` | Minimum log level: `"error"`, `"warn"`, `"info"`, or `"debug"`. |
| `toFile` | boolean | `false` | Whether to persist log entries to disk. |
| `filePath` | string | `"./logs/app.log"` | Output path for log files. |

---

### 4. `[spotify]`

Spotify token generator settings.

| Key | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `fetchMethod` | string | `"browser"` | Method to fetch anonymous token: `"browser"` (headless Chrome) or `"api"` (direct API). |

---

### 5. `[youtube]`

YouTube cipher and authorization settings.

| Key | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `auth` | string | `""` | Authorization password for endpoints (sent via `Authorization: <password>` header). |
| `overridePlayerVariant` | string | `"IAS"` | Enforces a specific player variant. Options: `"IAS"`, `"IAS_TCC"`, `"IAS_TCE"`, `"IAS_TCL"`, `"ES5"`, `"ES6"`, `"ES6_TCC"`, `"ES6_TCE"`, `"ES6_TCL"`, `"TV"`, `"TV_ES6"`, `"TV_TCL"`, `"PHONE"`, `"EMBED"`, `"EMBED_ES6"`, `"EMBED_TCL"`, `"EMBED_ES6_TCL"`, `"HOUSE"`. |
| `overridePlayerId` | string | `""` | Enforces a specific YouTube player script ID (e.g. `"44899b31"`), or empty to follow requested player. |

#### YouTube Player Variants & TCL Support

YouTube continuously updates its player script obfuscation. LavaTools supports modern script families:

- **`IAS` (Recommended default)**: Standalone web player. Highly reliable and recommended by `yt-cipher` for general playback.
- **`TV_TCL` / `IAS_TCL`**: New-generation YouTube player scripts using dynamic XOR indexing tables (introduced late 2026). Required when pairing TVHTML5 clients with Cobalt User-Agent to bypass Proof-of-Origin Tokens (POT).
- **`TV` / `TV_ES6`**: Static living room player scripts without locale/region dependencies.
- **`EMBED` / `EMBED_ES6`**: Automatically remapped to standard `IAS`/`ES6` core solvers for maximal stability.

---

### 6. `[youtube.botguard]`

Google BotGuard challenge solver and execution sandbox settings.

| Key | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `mode` | string | `"auto"` | Execution mode: `"auto"`, `"worker"`, `"vm"`, or `"direct"`. |
| `timeout` | integer | `5000` | Execution timeout in milliseconds to prevent CPU lockups. |
| `workers` | integer | `1` | Dedicated worker threads (default `1` to prevent panel OOM). |
| `queueSize` | integer | `32` | Maximum concurrent request queue capacity. |

---

### 7. `[[nodes]]`

Array of Lavalink servers to receive rotated Spotify/Deezer credentials.

| Key | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `name` | string | `"Primary Lavalink"` | Display name for logs. |
| `host` | string | `"localhost"` | Lavalink server hostname or IP. |
| `port` | integer | `8080` | Lavalink HTTP port. |
| `secure` | boolean | `false` | Set `true` if using HTTPS/WSS. |
| `password` | string | `"PASSWORD"` | Lavalink server password (`server.password`). |

Repeat the `[[nodes]]` table for each additional Lavalink instance.

---

### 8. `[rotation]`

Key rotation scheduling and limits.

| Key | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `interval` | integer | `60` | Rotation interval in minutes. |
| `maxErrors` | integer | `3` | Maximum consecutive errors before forcing rotation. |
| `auto` | boolean | `true` | Enable automatic background rotation. |

#### Optional Key Pools:

```toml
# Spotify Client Pool
[[rotation.keys.spotify]]
clientId = "your_client_id"
clientSecret = "your_client_secret"
spDc = "optional_sp_dc_cookie"

# Deezer Pool
[[rotation.keys.deezer]]
arl = "your_deezer_arl_cookie"
masterDecryptionKey = "optional_master_key"
formats = ["FLAC", "MP3_320"]
```
