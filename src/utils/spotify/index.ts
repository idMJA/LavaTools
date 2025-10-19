import playwright from "playwright";
import type {
	SpotifyToken,
	KiyomiConfiguration,
	SpotifyClient,
} from "#kiyomi/types";
import { SpotifyTokenHandler, generateTokenUrl, logs } from "#kiyomi/utils";

class DirectSpotifyClient implements SpotifyClient {
	async handleTokenRequest(
		_isForce = false,
		cookies?: Array<{ name: string; value: string }>,
	): Promise<SpotifyToken | { error: string }> {
		try {
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

			return result;
		} catch (error) {
			logs("error", "Direct API token fetch failed:", error);
			return { error: `Direct API failed: ${(error as Error).message}` };
		}
	}
}

async function checkBrowserAvailability(
	executablePath?: string,
): Promise<boolean> {
	try {
		const launchOptions: Parameters<typeof playwright.chromium.launch>[0] = {
			headless: true,
		};

		if (executablePath && executablePath.trim() !== "") {
			launchOptions.executablePath = executablePath;
			logs(
				"info",
				`Browser availability check using custom path: ${executablePath}`,
			);
		}

		const browser = await playwright.chromium.launch(launchOptions);
		await browser.close();
		return true;
	} catch (error) {
		logs("warn", "Browser availability check failed:", error);
		return false;
	}
}

export async function createSpotifyClient(
	config: KiyomiConfiguration,
): Promise<SpotifyClient> {
	const method = config.spotify.fetchMethod;

	if (method === "browser") {
		const browserAvailable = await checkBrowserAvailability(
			config.browserPath || undefined,
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
		logs("info", "Using direct API Spotify token fetching");
		return new DirectSpotifyClient();
	}

	throw new Error(`Unsupported fetch method: ${method}`);
}

export async function initializeSpotifyClient(
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
