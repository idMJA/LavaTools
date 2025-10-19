export interface LavalinkSpotifyConfig {
	clientId: string;
	clientSecret: string;
	spDc: string;
}

export interface LavalinkConfig {
	spotify: LavalinkSpotifyConfig;
}

export interface LavalinkServerConfig {
	/**
	 * Lavalink server name (for identification/logging)
	 */
	name?: string;
	/**
	 * Lavalink server hostname or IP address (e.g., "localhost" or "lavalink.example.com")
	 */
	host: string;
	/**
	 * Lavalink server port (default: 8080)
	 */
	port?: number;
	/**
	 * Use secure connection (HTTPS/WSS)
	 * - true: Uses HTTPS/secure connection
	 * - false: Uses HTTP/insecure connection
	 */
	secure: boolean;
	/**
	 * Lavalink server password for authentication
	 */
	password: string;
}

export interface SpotifyKeySet {
	clientId: string;
	clientSecret: string;
	spDc: string;
	isActive?: boolean;
	lastUsed?: Date;
	errors?: number;
}

export interface KeyRotationConfig {
	/**
	 * Array of Lavalink servers to update with rotated Spotify keys.
	 * The key rotation will update all servers in the list.
	 * Supports multiple Lavalink instances for load balancing or redundancy.
	 */
	lavalinkServers: LavalinkServerConfig[];
	keys: SpotifyKeySet[];
	rotationInterval?: number; // in minutes, default 60
	maxErrors?: number; // max errors before rotating, default 3
	autoRotate?: boolean; // default true
}
