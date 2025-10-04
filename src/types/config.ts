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
