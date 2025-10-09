# 🔥 LavaTools

> A comprehensive API toolkit for YouTube signature decryption and Spotify token management

[![Bun](https://img.shields.io/badge/Bun-000?style=for-the-badge&logo=bun&logoColor=fff)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=fff)](https://www.typescriptlang.org)
[![Elysia](https://img.shields.io/badge/Elysia-8B5FBF?style=for-the-badge&logo=elysiajs&logoColor=fff)](https://elysiajs.com)

## ✨ Features

- 🔐 **YouTube Signature Decryption** - Decrypt YouTube signatures and n-parameters
- 🕐 **STS Extraction** - Extract signature timestamps from YouTube player scripts
- 🎵 **Spotify Token Management** - Get Spotify access tokens via API or browser automation
- 📚 **OpenAPI Documentation** - Interactive API documentation with Swagger UI
- 🔒 **Authentication** - Secure YouTube endpoints with token-based auth
- ⚡ **High Performance** - Built with Bun runtime for maximum speed
- 🧩 **Modular Architecture** - Clean, maintainable codebase with separation of concerns

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.2.x or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/idMJA/LavaTools.git
cd LavaTools

# Install dependencies
bun install
```

### Configuration

Update the configuration in `src/config.ts`:

```typescript
export const Configuration: KiyomiConfiguration = {
	server: {
		host: "0.0.0.0",
		port: 3000,
	},
	spotify: {
		fetchMethod: "api", // "api" | "browser"
	},
	youtube: {
		authToken: "your_secret_token", // Set your auth token here
	},
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

**Query Parameters:**
- `force` (optional): Force refresh token (`1`, `yes`, `true` to enable)

### YouTube

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/youtube/decrypt_signature` | Decrypt YouTube signatures | ✅ |
| `POST` | `/api/youtube/get_sts` | Extract signature timestamp | ✅ |
| `POST` | `/api/youtube/resolve_url` | Resolve YouTube stream URL by decrypting signature and/or n parameter | ✅ |

**Authentication:**
YouTube endpoints require an `Authorization` header with your configured token (no "Bearer" prefix).

#### Decrypt Signature

```bash
curl -X POST http://localhost:3000/api/youtube/decrypt_signature \
  -H "Content-Type: application/json" \
  -H "Authorization: your_secret_token" \
  -d '{
    "encrypted_signature": "encrypted_sig_here",
    "n_param": "n_param_here",
    "player_url": "https://www.youtube.com/s/player/player_id/player.js"
  }'
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

## 🏗️ Architecture

```
src/
├── config.ts              # Application configuration
├── index.ts              # Application entry point
├── server.ts             # Elysia server setup
├── routes/               # API route handlers
├── types/                # TypeScript type definitions
└── utils/                # Utility functions
    ├── spotify/          # Spotify-related utilities
    │   ├── browser.ts    # Browser automation for tokens
    │   ├── direct.ts     # API-based token fetching
    │   └── index.ts      # Spotify client factory
    └── youtube/          # YouTube-related utilities
        ├── decrypt.ts    # Signature decryption logic
        ├── sts.ts        # STS extraction logic
        ├── solver.ts     # Main solver functions
        ├── auth.ts       # Authentication middleware
        └── types.ts      # YouTube-specific types
```

## 🛠️ Development

### Scripts

```bash
# Development with hot reload
bun run dev

# Format code
bun run format

# Type checking
bun run --check src/index.ts
```

### Adding New Features

1. Create new utility functions in `src/utils/`
2. Define types in `src/types/`
3. Add routes in `src/server.ts` with OpenAPI documentation
4. Update configuration if needed

## 🙏 Credits & Acknowledgments

This project builds upon the excellent work of several open-source projects:

### YouTube Cipher Implementation
- **[yt-cipher](https://github.com/kikkia/yt-cipher)** - Original Deno implementation of YouTube signature decryption
- **[ejs](https://github.com/yt-dlp/ejs)** - Core JavaScript implementation for YouTube signature solving

### Spotify Integration  
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
