import type { KeyRotationConfig } from "#kiyomi/types";

export const KeyRotationConfiguration: KeyRotationConfig = {
	lavalinkServers: [
		{
			name: "Primary Lavalink", // Optional: Set a custom name for your Lavalink server
			host: "localhost", // Lavalink server hostname or IP
			port: 8080, // Lavalink server port (optional, default: 8080)
			secure: false, // false for HTTP, true for HTTPS
			password: "PASSWORD", // Your Lavalink password
		},
		// Add more Lavalink servers below (optional)
		// {
		// 	name: "Secondary Lavalink",
		// 	host: "lavalink-2.example.com",
		// 	port: 8080,
		// 	secure: true,
		// 	password: "PASSWORD2",
		// },
		// {
		// 	name: "Backup Lavalink",
		// 	host: "backup.example.com",
		// 	port: 2333,
		// 	secure: true,
		// 	password: "PASSWORD3",
		// },
	],
	keys: {
		spotify: [
			// Add your Spotify keys here
			// Example:
			// {
			// 	clientId: "your_client_id_1",     // Required: for spsearch
			// 	clientSecret: "your_client_secret_1", // Required: for spsearch
			// 	spDc: "your_sp_dc_1",             // Optional: for accessing spotify lyrics api
			// },
		],
		deezer: [
			// Add your Deezer keys here
			// Example:
			// {
			// 	arl: "your_deezer_arl_cookie_1",                    // Required: Deezer ARL cookie
			// 	masterDecryptionKey: "your_master_decryption_key",  // Optional: Master decryption key
			// 	formats: ["FLAC", "MP3_320", "MP3_256", "MP3_128"], // Optional: Preferred audio formats
			// },
		],
	},
	rotationInterval: 60, // Rotate every 60 minutes
	maxErrors: 3, // Rotate after 3 errors
	autoRotate: true, // Enable automatic rotation
};
