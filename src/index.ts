import {
	Configuration,
	isSpotifyEnabled,
	KeyRotationConfiguration,
} from "#kiyomi/config";
import type { SpotifyClient } from "#kiyomi/types";
import {
	initRotator,
	initSpotify,
	logs,
	purgeStaleCaches,
	stopRotator,
} from "#kiyomi/utils";
import { startServer } from "./server";

let spotifyClient: SpotifyClient | null = null;

async function main() {
	try {
		if (isSpotifyEnabled()) {
			spotifyClient = await initSpotify(Configuration);
		} else {
			logs("info", "Spotify service disabled in config.toml");
		}

		const hasSpotifyKeys =
			(KeyRotationConfiguration.keys.spotify?.length ?? 0) > 0;
		const hasDeezerKeys =
			(KeyRotationConfiguration.keys.deezer?.length ?? 0) > 0;

		if (KeyRotationConfiguration.enabled === false) {
			logs("info", "Key rotation service disabled in config.toml");
		} else if (hasSpotifyKeys || hasDeezerKeys) {
			initRotator(KeyRotationConfiguration);
			if (hasSpotifyKeys) {
				logs(
					"info",
					`Spotify key rotator initialized with ${KeyRotationConfiguration.keys.spotify?.length} keys`,
				);
			}
			if (hasDeezerKeys) {
				logs(
					"info",
					`Deezer key rotator initialized with ${KeyRotationConfiguration.keys.deezer?.length} keys`,
				);
			}
		} else {
			logs(
				"warn",
				"No Spotify or Deezer keys configured for rotation. Add keys to [rotation.keys] in config.toml",
			);
		}
	} catch (error) {
		logs("error", "Application startup failed:", error);
		process.exit(1);
	}

	await startServer(spotifyClient);

	const gcInterval = setInterval(
		() => {
			try {
				purgeStaleCaches();
				if (typeof Bun !== "undefined" && typeof Bun.gc === "function") {
					Bun.gc(true);
				}
			} catch (_) {}
		},
		1000 * 60 * 30,
	);

	async function shutdown() {
		logs("info", "Shutting down server...");

		try {
			clearInterval(gcInterval);
			stopRotator();

			if (spotifyClient?.cleanup) {
				await spotifyClient.cleanup();
				logs("info", "Spotify client cleaned up successfully");
			}
		} catch (error) {
			logs("error", "Error during cleanup:", error);
		}

		process.exit(0);
	}

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}

void main();
