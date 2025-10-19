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
	keys: [
		// Add your Spotify keys here
		// Example:
		// {
		// 	clientId: "your_client_id_1",
		// 	clientSecret: "your_client_secret_1",
		// 	spDc: "your_sp_dc_1",
		// },
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
