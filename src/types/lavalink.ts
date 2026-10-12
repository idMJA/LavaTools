export interface LavalinkSpotifyConfig {
	clientId: string;
	clientSecret: string;
	spDc?: string;
}

export interface LavalinkDeezerConfig {
	masterDecryptionKey?: string;
	arl: string;
	formats?: string[];
}

export interface LavalinkConfig {
	spotify?: LavalinkSpotifyConfig;
	deezer?: LavalinkDeezerConfig;
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
	spDc?: string;
	isActive?: boolean;
	lastUsed?: Date;
	errors?: number;
}

export interface DeezerKeySet {
	masterDecryptionKey?: string;
	arl: string;
	formats?: string[];
	isActive?: boolean;
	lastUsed?: Date;
	errors?: number;
}

export interface KeyRotationConfig {
	enabled?: boolean;
	nodes?: LavalinkServerConfig[];
	keys: {
		spotify?: SpotifyKeySet[];
		deezer?: DeezerKeySet[];
	};
	interval?: number; // in minutes, alias for rotationInterval
	rotationInterval?: number; // in minutes, default 60
	maxErrors?: number; // max errors before rotating, default 3
	auto?: boolean; // alias for autoRotate
	autoRotate?: boolean; // default true
}
