type SpotifyFetchMethod = "api" | "browser";

/**
 * Spotify configuration settings.
 */
interface SpotifyConfig {
	/**
	 * Spotify data fetch method.
	 * - "api": Fetches data directly from Spotify using third-party secrets.
	 * - "browser": Fetches data directly from Spotify by opening a browser.
	 */
	fetchMethod: SpotifyFetchMethod;
}

/**
 * YouTube configuration settings.
 */
interface YouTubeConfig {
	/**
	 * Authorization token for YouTube API endpoints.
	 * Used as "Authorization: token" header (without Bearer prefix).
	 */
	auth: string;

	/**
	 * Forces all cipher requests to use a specific player variant (e.g. "IAS").
	 * Available variants: "IAS" | "IAS_TCC" | "IAS_TCE" | "ES5" | "ES6" | "ES6_TCC" | "ES6_TCE" | "TV" | "TV_ES6" | "PHONE" | "EMBED" | "EMBED_ES6" | "HOUSE"
	 * Set to null or undefined to follow the variant sent by Lavalink.
	 * Default / recommended is "IAS" for consistent playback stability.
	 */
	overridePlayerVariant?: string | null;

	/**
	 * Forces all cipher requests to use a specific YouTube player script ID (e.g. "44899b31").
	 * Set to null or undefined to use the player ID requested by Lavalink.
	 */
	overridePlayerId?: string | null;
}

/**
 * Server configuration settings.
 */
interface ServerConfig {
	host: string;
	port?: number;
}

export interface KiyomiConfiguration {
	server: ServerConfig;

	browserPath?: string | null;

	logging?: {
		level: "error" | "warn" | "info" | "debug";
		toFile: boolean;
		filePath?: string;
	};

	spotify: SpotifyConfig;

	youtube: YouTubeConfig;
}
