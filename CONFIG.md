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

#### Service-Level Switches

Each service also exposes its own switch, evaluated only when the corresponding `[enabled]` key is **not** set:

| Switch | Service |
| :--- | :--- |
| `spotify.enabled` | Spotify token endpoints |
| `rotation.enabled` | Background credential rotation |
| `youtube.cipherEnabled` | YouTube cipher endpoints |
| `youtube.botguardEnabled` | YouTube BotGuard endpoints |

Precedence: `[enabled]` key → service-level switch → enabled by default. Because the `[enabled]` key wins, a service-level `enabled = false` has no effect while the matching `[enabled]` key is present — remove (or set to `false`) the `[enabled]` key when relying on service-level switches.

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
| `enabled` | boolean | `true` | Service-level switch for Spotify endpoints; only used when `[enabled].spotify` is omitted. |
| `fetchMethod` | string | `"browser"` | Method to fetch anonymous token: `"browser"` (headless Chrome) or `"api"` (direct API). |

---

### 5. `[youtube]`

YouTube cipher and authorization settings.

| Key | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `auth` | string | `""` | Authorization password for endpoints (sent via `Authorization: <password>` header). |
| `cipherEnabled` | boolean | `true` | Service-level switch for cipher endpoints; only used when `[enabled].cipher` is omitted. |
| `botguardEnabled` | boolean | `true` | Service-level switch for BotGuard endpoints; only used when `[enabled].botguard` is omitted. |
| `overridePlayerVariant` | string | `"IAS"` | Enforces a specific player variant. Options: `"IAS"`, `"IAS_TCC"`, `"IAS_TCE"`, `"IAS_TCL"`, `"ES5"`, `"ES6"`, `"ES6_TCC"`, `"ES6_TCE"`, `"ES6_TCL"`, `"TV"`, `"TV_ES6"`, `"TV_TCL"`, `"PHONE"`, `"EMBED"`, `"EMBED_ES6"`, `"EMBED_TCL"`, `"EMBED_ES6_TCL"`, `"HOUSE"`. |
| `overridePlayerId` | string | `""` | Enforces a specific YouTube player script ID (e.g. `"44899b31"`), or empty to follow requested player. |

> **Note:** `youtube.enabled` is accepted by the schema for compatibility but is not evaluated by the server. Use `cipherEnabled` / `botguardEnabled` or the `[enabled]` table instead.

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

These nodes apply globally. To use a different target list for rotation only, define `[[rotation.nodes]]` instead — when present, it overrides this section.

---

### 8. `[rotation]`

Key rotation scheduling and limits.

| Key | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `enabled` | boolean | `true` | Service-level switch for background rotation; only used when `[enabled].rotation` is omitted. |
| `interval` | integer | `60` | Rotation interval in minutes. |
| `rotationInterval` | integer | `60` | Legacy alias for `interval`; used only when `interval` is omitted. |
| `maxErrors` | integer | `3` | Maximum consecutive errors before forcing rotation. |
| `auto` | boolean | `true` | Enable automatic background rotation. |
| `autoRotate` | boolean | `true` | Legacy alias for `auto`; used only when `auto` is omitted. |
| `nodes` | array of tables | top-level `[[nodes]]` | Rotation-specific Lavalink targets (`[[rotation.nodes]]`, same keys as `[[nodes]]`). When present, overrides the top-level node list. |

#### Optional Key Pools:

Credentials consumed by the rotator; each table represents one key. The rotator stays idle with a startup warning when no keys are defined.

##### Spotify Pool (`[[rotation.keys.spotify]]`)

| Key | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `clientId` | string | — | Spotify application client ID. **Required.** |
| `clientSecret` | string | — | Spotify application client secret. **Required.** |
| `spDc` | string | — | Optional `sp_dc` cookie, forwarded to Lavalink for token generation. |

```toml
# Spotify Client Pool
[[rotation.keys.spotify]]
clientId = "your_client_id"
clientSecret = "your_client_secret"
spDc = "optional_sp_dc_cookie"
```

##### Deezer Pool (`[[rotation.keys.deezer]]`)

| Key | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `arl` | string | — | Deezer `arl` cookie. **Required.** |
| `masterDecryptionKey` | string | — | Optional Deezer Master Decryption Key (MDK). |
| `formats` | string[] | — | Optional preferred audio formats forwarded to Lavalink (e.g. `["FLAC", "MP3_320"]`). |

```toml
# Deezer Pool
[[rotation.keys.deezer]]
arl = "your_deezer_arl_cookie"
masterDecryptionKey = "optional_master_key"
formats = ["FLAC", "MP3_320"]
```

> **Note:** `isActive`, `lastUsed`, and `errors` exist in the schema but are managed by the rotator at runtime. Do not set them in `config.toml`.
