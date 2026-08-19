# 🔥 LavaTools

> A comprehensive API toolkit for YouTube signature decryption and Spotify token management

[![Bun](https://img.shields.io/badge/Bun-000?style=for-the-badge&logo=bun&logoColor=fff)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=fff)](https://www.typescriptlang.org)
[![Elysia](https://img.shields.io/badge/Elysia-8B5FBF?style=for-the-badge&logo=elysiajs&logoColor=fff)](https://elysiajs.com)

## ✨ Features

- 🔐 **YouTube Signature Decryption** - Decrypt YouTube signatures and n-parameters
- 🛡️ **BotGuard WebPO PO Token Solver** - Native Proof of Origin Token (PO Token / POT) generator for YouTube & Lavalink (`remotePot`)
- 🕐 **STS Extraction** - Extract signature timestamps from YouTube player scripts
- 🎵 **Spotify Token Management** - Get Spotify access tokens via API or browser automation
- 🔄 **Spotify & Deezer Key Rotation** - Automatic credential rotation with **multiple Lavalink server support** (`spotify` & `deezer`)
- 📡 **Parallel Server Updates** - Update all Lavalink instances simultaneously
- 📖 **OpenAPI Documentation** - Interactive API documentation with Swagger UI
- 🔒 **Authentication** - Secure YouTube endpoints with token-based auth
- ⚡ **High Performance** - Built with Bun runtime for maximum speed
- 🧩 **Modular Architecture** - Clean, maintainable codebase with separation of concerns

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.2.x or higher

### Installation

```bash
# Clone the repository with submodules
git clone --recurse-submodules https://github.com/idMJA/LavaTools.git
cd LavaTools

# If you already cloned without submodules, initialize them:
# git submodule update --init --recursive

# Install dependencies
bun install
```

## Chromium Installation

### For most environments (not Pterodactyl):
Install Playwright's bundled Chromium automatically:

```bash
bunx playwright install chromium
```

### For Pterodactyl (or restricted environments):
1. **Download Chromium**
   - Download a compatible Chromium build from [https://commondatastorage.googleapis.com/chromium-browser-snapshots/index.html](https://commondatastorage.googleapis.com/chromium-browser-snapshots/index.html) (choose your OS/arch, e.g. Linux x64).
2. **Extract the archive** and upload the `chrome`/`chromium` binary (and its folder) to your Pterodactyl server, e.g. `/home/container/chrome-linux/chrome`.
3. **Set the path in `.env`**:
   ```properties
   CHROME_PATH=/home/container/chrome-linux/chrome
   ```
4. **Restart your server/container**.

If `CHROME_PATH` is not set, Playwright will use its default browser (if installed).

## Build & Run

```bash
npm start
```
### Configuration

Update the configuration in `src/config.ts`:

```typescript
export const Configuration: KiyomiConfiguration = {
	server: {
		host: "0.0.0.0",
		port: 3000,
	},

	// Optional: Set custom browser path for Spotify token fetching
	// browserPath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",

	logging: {
		level: "info", // "error" | "warn" | "info" | "debug"
		toFile: false,
		filePath: "./logs/app.log",
	},

	spotify: {
		fetchMethod: "api", // "api" | "browser"
	},

	youtube: {
		auth: "your_secret_token", // Set your auth token here
	},
};

// Configure Spotify key rotation for Lavalink (see src/config/key.ts)
```

Update the key rotation configuration in `src/config/key.ts`:

```typescript
export const KeyRotationConfiguration: KeyRotationConfig = {
	lavalinkServers: [
		// Primary Lavalink server
		{
			name: "Primary Lavalink",
			host: "localhost",
			port: 8080,
			secure: false, // false for HTTP, true for HTTPS
			password: "your_lavalink_password",
		},
		// Add more Lavalink servers for load balancing or redundancy
		// {
		// 	name: "Secondary Lavalink",
		// 	host: "lavalink-2.example.com",
		// 	port: 8080,
		// 	secure: true,
		// 	password: "your_lavalink_password_2",
		// },
		// {
		// 	name: "Backup Lavalink",
		// 	host: "backup.example.com",
		// 	port: 2333,
		// 	secure: true,
		// 	password: "your_lavalink_password_3",
		// },
	],
	keys: [
		// Add your Spotify keys here
		// {
		// 	clientId: "your_client_id_1",
		// 	clientSecret: "your_client_secret_1",
		// 	spDc: "your_sp_dc_1",
		// },
		// Add more keys for rotation
		// {
		// 	clientId: "your_client_id_2",
		// 	clientSecret: "your_client_secret_2",
		// 	spDc: "your_sp_dc_2",
		// },
	],
	rotationInterval: 60, // Rotate every 60 minutes
	maxErrors: 3, // Rotate after 3 errors
	autoRotate: true, // Enable automatic rotation
};
```

### Running the Server

```bash
# Development mode (with hot reload)
bun dev

# Production mode
bun start
```

The server will start at `http://localhost:3000`

## 📖 API Documentation

Once the server is running, access the interactive API documentation:

- **Swagger UI**: [http://localhost:3000/openapi](http://localhost:3000/openapi)
- **OpenAPI JSON**: [http://localhost:3000/openapi/json](http://localhost:3000/openapi/json)

## 🔧 API Endpoints

### General

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check endpoint |

### Spotify

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/spotify/token` | Get Spotify access token | ❌ |

### Spotify Key Rotation (Multiple Server Support)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET`  | `/api/key-rotation/status` | Get key rotation status and all configured servers | ❌ |
| `POST` | `/api/key-rotation/rotate` | Manually rotate to next key (updates all servers) | ✅ |
| `POST` | `/api/key-rotation/set-active` | Set specific key as active (updates all servers) | ✅ |
| `POST` | `/api/key-rotation/report-error` | Report error for current key | ✅ |

**Query Parameters:**
- `force` (optional): Force refresh token (`1`, `yes`, `true` to enable)

### YouTube

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/youtube/decrypt_signature` | Decrypt YouTube signatures | ✅ |
| `POST` | `/api/youtube/get_sts` | Extract signature timestamp | ✅ |
| `POST` | `/api/youtube/resolve_url` | Resolve YouTube stream URL by decrypting signature and/or n parameter | ✅ |
| `POST` | `/api/youtube/generate` | Generate BotGuard PO Token (`content_binding` & optional `coldToken`) | 🔑 (If configured) |
| `POST` | `/api/youtube/decode_cold_start` | Decode cold start token to inspect timestamp and client state | 🔑 (If configured) |

**Authentication:**
YouTube endpoints enforce authentication if `youtube.auth` token is configured in your LavaTools configuration. Include the `Authorization` header with your token (or `pass` parameter in Lavalink `youtube.remotePot.pass`).

#### Lavalink Configuration Example

Attach this config in your Lavalink `application.yml` under the `youtube` plugin configuration:

```yaml
plugins:
  youtube:
    remotePot:
      url: "http://localhost:3000/api/youtube"
      pass: "your_secret_token" # Required if youtube.auth is configured in LavaTools
```

#### Generate BotGuard PO Token

```bash
curl -X POST http://localhost:3000/api/youtube/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: your_secret_token" \
  -d '{
    "content_binding": "dQw4w9WgXcQ",
    "coldToken": false
  }'
```

Response:
```json
{
  "poToken": "...",
  "contentBinding": "dQw4w9WgXcQ"
}
```

#### Get STS

```bash
curl -X POST http://localhost:3000/api/youtube/get_sts \
  -H "Content-Type: application/json" \
  -H "Authorization: your_secret_token" \
  -d '{
    "player_url": "https://www.youtube.com/s/player/player_id/player.js"
  }'
```

#### Resolve URL

This endpoint decrypts `s`/`sig` and `n` query parameters on a stream URL using the provided player script URL (or the provided encrypted signature) and returns a resolved URL ready to be used by your client.

Example:

```bash
curl -X POST http://localhost:3000/api/youtube/resolve_url \
  -H "Content-Type: application/json" \
  -H "Authorization: your_secret_token" \
  -d '{
    "stream_url": "https://rX---sn-abcxyz.googlevideo.com/videoplayback?expire=...&s=ENCRYPTED_S&n=ENCRYPTED_N",
    "player_url": "https://www.youtube.com/s/player/player_id/player.js",
    "encrypted_signature": "ENCRYPTED_S",
    "signature_key": "sig",    # optional, defaults to 'sig'
    "n_param": "ENCRYPTED_N"   # optional; if not provided, the endpoint will look for `n` in stream_url
  }'
```

## 🔄 Spotify & Deezer Key Rotation

LavaTools includes an advanced Spotify and Deezer key rotation system that automatically updates multiple Lavalink servers with fresh credentials.

### Features

- ✅ **Multiple Lavalink Support** - Update multiple Lavalink servers simultaneously
- ✅ **Spotify & Deezer Support** - Rotate Spotify keys (`clientId`, `clientSecret`, `spDc`) and Deezer keys (`arl`, `masterDecryptionKey`, `formats`)
- ✅ **Automatic Rotation** - Rotate keys at specified intervals
- ✅ **Error Handling** - Automatically rotate keys when errors are detected
- ✅ **Parallel Updates** - Update all servers concurrently for fast synchronization
- ✅ **Flexible Configuration** - Support for HTTP/HTTPS and custom ports

### Setup

1. Configure your Lavalink servers in `src/config/key.ts`:

```typescript
lavalinkServers: [
  {
    name: "Primary",
    host: "lavalink-1.example.com",
    port: 8080,
    secure: true,
    password: "PASSWORD1",
  },
  {
    name: "Secondary",
    host: "lavalink-2.example.com",
    port: 8080,
    secure: true,
    password: "PASSWORD2",
  },
]
```

2. Add your Spotify and Deezer credentials:

```typescript
keys: {
  spotify: [
    {
      clientId: "client_id_1",
      clientSecret: "client_secret_1",
      spDc: "sp_dc_1",
    },
  ],
  deezer: [
    {
      arl: "deezer_arl_cookie_1",
      masterDecryptionKey: "master_decryption_key_1",
      formats: ["FLAC", "MP3_320"],
    },
  ],
}
```

3. The system will automatically:
   - Rotate keys at specified intervals
   - Switch keys when errors are detected
   - Update all configured Lavalink servers with new credentials

### Key Rotation API Examples

```bash
# Check rotation status (shows all configured servers)
curl http://localhost:3000/api/key-rotation/status

# Manually rotate key (updates all servers)
curl -X POST http://localhost:3000/api/key-rotation/rotate \
  -H "Authorization: your_secret_token"

# Set specific key as active (updates all servers)
curl -X POST http://localhost:3000/api/key-rotation/set-active \
  -H "Authorization: your_secret_token" \
  -H "Content-Type: application/json" \
  -d '{"keyIndex": 0}'

# Report an error (may trigger auto-rotation if threshold exceeded)
curl -X POST http://localhost:3000/api/key-rotation/report-error \
  -H "Authorization: your_secret_token"
```

### Status Response

```json
{
  "totalKeys": 2,
  "currentKeyIndex": 0,
  "currentKey": {
    "clientId": "client_i...",
    "errors": 0,
    "lastUsed": "2024-10-19T10:30:00Z"
  },
  "autoRotationEnabled": true,
  "rotationInterval": 60,
  "lavalinkServers": [
    {
      "name": "Primary",
      "url": "https://lavalink-1.example.com:8080"
    },
    {
      "name": "Secondary",
      "url": "https://lavalink-2.example.com:8080"
    }
  ]
}
```

## 🏗️ Architecture

```
src/
├── config/                # Application & Key Rotation configuration
├── index.ts               # Application entry point
├── server.ts              # Elysia server setup
├── types/                 # TypeScript type definitions
└── utils/                 # Utility functions
    ├── rotator.ts         # Key rotator (Spotify & Deezer)
    ├── spotify/           # Spotify-related utilities
    │   ├── browser.ts     # Browser automation for tokens
    │   ├── direct.ts      # API-based token fetching
    │   └── index.ts       # Spotify client factory
    └── youtube/           # YouTube-related utilities
        ├── botguard/      # BotGuard PO Token solver (WebPO Generator)
        │   ├── constants.ts
        │   ├── helpers.ts
        │   ├── solver.ts
        │   └── visitor.ts
        ├── cipher/        # YouTube signature & player deciphering
        │   ├── decrypt.ts
        │   ├── player.ts
        │   ├── resolve.ts
        │   └── solvers.ts
        └── index.ts
```

## 🛠️ Development

### Scripts

```bash
# Development with hot reload
bun run dev

# Format code
bun run format

# Type checking
bun run typecheck:app

# Run unit tests
bun test
```

## 🙏 Credits & Acknowledgments

This project builds upon the excellent work of several open-source projects:

### YouTube BotGuard / WebPO Implementation
- **[ashton045/webpo-generator](https://github.com/ashton045/webpo-generator)** - Original implementation of remote HTTP service for generating PO Tokens by solving BotGuard challenges
- **[LuanRT/BgUtils](https://github.com/LuanRT/BgUtils)** - Core BotGuard attestation solver & research
- **[Deivu](https://github.com/Deivu)** - Contributions to BotGuard sources & research

### YouTube Cipher Implementation
- **[kikkia/yt-cipher](https://github.com/kikkia/yt-cipher)** - Original Deno implementation of YouTube signature decryption
- **[yt-dlp/ejs](https://github.com/yt-dlp/ejs)** - Core JavaScript implementation for YouTube signature solving

### Spotify & Deezer Integration  
- **[accessify](https://github.com/idMJA/accessify)** - Original browser-based Spotify token implementation
- **[spotify-secrets](https://github.com/Thereallo1026/spotify-secrets)** - Spotify API secrets for direct token access

### Special Thanks

- The **yt-dlp** team for their continuous work on YouTube extraction
- All contributors to the above projects for making this implementation possible
- The **Bun** and **Elysia** communities for amazing tooling

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

If you encounter any issues or have questions, please [open an issue](https://github.com/idMJA/LavaTools/issues) on GitHub.

---

<div align="center">

**[⬆ Back to Top](#-lavatools)**

Made with 🔪 by アーリャ

</div>
