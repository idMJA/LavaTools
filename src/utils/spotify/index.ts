import playwright from "playwright";
import type {
	KiyomiConfiguration,
	SpotifyClient,
	SpotifyToken,
} from "#kiyomi/types";
import {
	generateTokenUrl,
	getArtistTopTracksMetadata,
	logs,
	resolveSpotifyUrl,
	SpotifyTokenHandler,
	searchSpotifyTracks,
} from "#kiyomi/utils";

class DirectSpotifyClient implements SpotifyClient {
	private cachedToken: SpotifyToken | null = null;

	private async getValidAccessToken(): Promise<string> {
		const now = Date.now();
		if (
			this.cachedToken &&
			this.cachedToken.accessTokenExpirationTimestampMs - 15000 > now
		) {
			return this.cachedToken.accessToken;
		}

		const token = (await generateTokenUrl(undefined, true)) as SpotifyToken;
		if (!token?.accessToken) {
			throw new Error("Failed to mint Spotify anonymous access token");
		}

		this.cachedToken = token;
		return token.accessToken;
	}

	async handleTokenRequest(
		isForce = false,
		cookies?: Array<{ name: string; value: string }>,
	): Promise<SpotifyToken | { error: string }> {
		try {
			if (
				!isForce &&
				!cookies?.length &&
				this.cachedToken &&
				this.cachedToken.accessTokenExpirationTimestampMs - 15000 > Date.now()
			) {
				return this.cachedToken;
			}

			const cookieHeader = cookies?.length
				? cookies.map((c) => `${c.name}=${c.value}`).join("; ")
				: undefined;

			const result = await generateTokenUrl(cookieHeader, true);

			if (!result) {
				return { error: "Failed to generate token from API" };
			}

			if (typeof result === "string") {
				return { error: "Unexpected string response from API" };
			}

			if (!cookies?.length) {
				this.cachedToken = result;
			}

			return result;
		} catch (error) {
			logs("error", "Direct API token fetch failed:", error);
			return { error: `Direct API failed: ${(error as Error).message}` };
		}
	}

	async resolveUrl(url: string) {
		try {
			const token = await this.getValidAccessToken();
			return await resolveSpotifyUrl(url, token);
		} catch (e) {
			logs("error", `Failed to resolve Spotify URL ${url}:`, e);
			return { error: (e as Error).message };
		}
	}

	async searchCatalog(query: string, limit = 10) {
		try {
			const token = await this.getValidAccessToken();
			return await searchSpotifyTracks(query, limit, token);
		} catch (e) {
			logs("error", `Failed to search Spotify catalog for ${query}:`, e);
			return { error: (e as Error).message };
		}
	}

	async getArtistTopTracks(artistId: string) {
		try {
			const token = await this.getValidAccessToken();
			return await getArtistTopTracksMetadata(artistId, token);
		} catch (e) {
			logs("error", `Failed to fetch artist top tracks for ${artistId}:`, e);
			return { error: (e as Error).message };
		}
	}
}

async function hasBrowser(executablePath?: string): Promise<boolean> {
	try {
		logs("info", "Checking browser availability...");
		const launchOptions: Parameters<typeof playwright.chromium.launch>[0] = {
			headless: true,
		};

		if (executablePath && executablePath.trim() !== "") {
			launchOptions.executablePath = executablePath;
			logs(
				"info",
				`Browser availability check using custom path: ${executablePath}`,
			);
		} else {
			logs("info", "Checking default Playwright Chromium installation");
		}

		logs("info", "Attempting to launch browser for availability check...");
		const browser = await playwright.chromium.launch(launchOptions);
		logs("info", "Browser launched successfully for availability check");
		await browser.close();
		logs("info", "Browser availability check passed");
		return true;
	} catch (error) {
		logs("error", "Browser availability check failed:", error);
		logs(
			"error",
			`Error details: ${error instanceof Error ? error.message : String(error)}`,
		);
		if (
			error instanceof Error &&
			error.message.includes("Executable doesn't exist")
		) {
			logs(
				"error",
				"Chromium browser is not installed. Run: bunx playwright install chromium",
			);
		}
		return false;
	}
}

export async function createSpotifyClient(
	config: KiyomiConfiguration,
): Promise<SpotifyClient> {
	const method = config.spotify.fetchMethod;

	if (method === "browser") {
		const browserAvailable = await hasBrowser(
			config.server.browserPath || undefined,
		);

		if (!browserAvailable) {
			logs(
				"error",
				'Browser method requested but Playwright browser not available. Please install browser dependencies or use "api" method instead.',
			);
			logs(
				"info",
				"To install browser: bun install && bunx playwright install chromium",
			);
			throw new Error('Browser not available. Use "api" fetch method instead.');
		}

		logs("info", "Using browser-based Spotify token fetching");
		return new SpotifyTokenHandler();
	}

	if (method === "api") {
		// logs(
		// 	"warn",
		// 	"API method - WARNING: Not working properly due to removed repository dependency. Please use browser method instead.",
		// );
		logs("info", "Using direct API Spotify token fetching");
		return new DirectSpotifyClient();
	}

	throw new Error(`Unsupported fetch method: ${method}`);
}

export async function initSpotify(
	config: KiyomiConfiguration,
): Promise<SpotifyClient> {
	try {
		const client = await createSpotifyClient(config);
		logs(
			"info",
			`Spotify client initialized with method: ${config.spotify.fetchMethod}`,
		);
		return client;
	} catch (error) {
		logs("error", "Failed to initialize Spotify client:", error);
		throw error;
	}
}
