import type {
	Browser,
	BrowserContext,
	LaunchOptions,
	Page,
	Response,
} from "playwright";
import playwright from "playwright";
import { Configuration } from "#kiyomi/config";
import type {
	SpotifyArtistTopTracksResult,
	SpotifyResolveResult,
	SpotifySearchResult,
	SpotifyToken,
} from "#kiyomi/types";
import { logs, Semaphore } from "#kiyomi/utils";
import { resolveSpotifyUrl } from "./resolver";
import { getArtistTopTracksMetadata, searchSpotifyTracks } from "./search";

export class SpotifyTokenHandler {
	private semaphore = new Semaphore();
	private accessToken: SpotifyToken | undefined;
	private refreshTimeout: NodeJS.Timeout | undefined;
	private refreshFailures = 0;

	private browser: Browser | undefined;
	private context: BrowserContext | undefined;
	private page: Page | undefined;
	private routesInitialized = false;

	constructor() {
		logs("info", "Initializing SpotifyTokenHandler with browser method...");
		const initStart = Date.now();
		const bootstrap = async (attempt = 1): Promise<void> => {
			try {
				logs(
					"info",
					`Attempting to fetch initial Spotify token (attempt ${attempt})...`,
				);
				await this.getAccessToken();
				logs(
					"info",
					`Initial Spotify token fetched in ${Date.now() - initStart}ms`,
				);
			} catch (err) {
				logs(
					"warn",
					`Failed to fetch initial Spotify token (attempt ${attempt})`,
					err,
				);
				if (attempt < 3) {
					logs("info", `Retrying in ${2000 * attempt}ms...`);
					setTimeout(() => void bootstrap(attempt + 1), 2000 * attempt);
				} else {
					logs(
						"error",
						"Failed to fetch initial Spotify token after 3 attempts",
					);
				}
			}
		};
		void bootstrap();
	}

	public async handleTokenRequest(
		isForce: boolean = false,
		cookies?: Array<{ name: string; value: string }>,
	): Promise<SpotifyToken | { error: string }> {
		const started = Date.now();
		if (cookies?.length) {
			// Never write cookie values to logs: they are authentication credentials.
			logs(
				"info",
				`Request with cookies: ${cookies.map((cookie) => cookie.name).join(", ")}`,
			);
		} else {
			logs("info", "Request without cookies");
		}

		if (cookies?.length) {
			const release = await this.semaphore.acquire();
			try {
				const token = await this.getAccessToken(cookies);
				return token;
			} catch (e) {
				logs("error", e);
				return { error: "Failed to fetch token with cookies" };
			} finally {
				release();
			}
		}

		if (!isForce && this.isValid(this.accessToken)) {
			const elapsed = Date.now() - started;
			logs(
				"info",
				`Handled Spotify Token request (force: ${isForce}) in ${elapsed}ms`,
			);
			return this.accessToken as SpotifyToken;
		}

		const release = await this.semaphore.acquire();
		try {
			if (!isForce && this.isValid(this.accessToken)) {
				return this.accessToken as SpotifyToken;
			}
			const token = await this.getAccessToken();
			return token;
		} catch (e) {
			logs("error", e);
			return { error: "Failed to refresh token" };
		} finally {
			release();
			const elapsed = Date.now() - started;
			logs(
				"info",
				`Handled Spotify Token request (force: ${isForce}) in ${elapsed}ms`,
			);
		}
	}

	public async resolveUrl(
		url: string,
	): Promise<SpotifyResolveResult | { error: string }> {
		try {
			const token = await this.getUsableAccessToken();
			return await resolveSpotifyUrl(url, token);
		} catch (error) {
			logs("error", `Failed to resolve Spotify URL ${url}:`, error);
			return { error: error instanceof Error ? error.message : String(error) };
		}
	}

	public async searchCatalog(
		query: string,
		limit = 10,
	): Promise<SpotifySearchResult | { error: string }> {
		try {
			const token = await this.getUsableAccessToken();
			return await searchSpotifyTracks(query, limit, token);
		} catch (error) {
			logs("error", `Failed to search Spotify catalog for ${query}:`, error);
			return { error: error instanceof Error ? error.message : String(error) };
		}
	}

	public async getArtistTopTracks(
		artistId: string,
	): Promise<SpotifyArtistTopTracksResult | { error: string }> {
		try {
			const token = await this.getUsableAccessToken();
			return await getArtistTopTracksMetadata(artistId, token);
		} catch (error) {
			logs(
				"error",
				`Failed to fetch artist top tracks for ${artistId}:`,
				error,
			);
			return { error: error instanceof Error ? error.message : String(error) };
		}
	}

	public async cleanup(): Promise<void> {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
			this.refreshTimeout = undefined;
		}
		await this.closeBrowser();
	}

	private isValid(token?: SpotifyToken): boolean {
		if (!token) return false;
		return token.accessTokenExpirationTimestampMs - 10000 > Date.now();
	}

	private async getUsableAccessToken(): Promise<string> {
		const result = await this.handleTokenRequest();
		if (!("accessToken" in result)) {
			throw new Error(result.error);
		}
		return result.accessToken;
	}

	private setRefreshTimer(): void {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
			this.refreshTimeout = undefined;
		}
		if (!this.accessToken) return;

		const delay = Math.max(
			this.accessToken.accessTokenExpirationTimestampMs - Date.now() + 100,
			1000,
		);

		const scheduleRefresh = (nextDelay: number): void => {
			this.refreshTimeout = setTimeout(async () => {
				const release = await this.semaphore.acquire();
				try {
					this.accessToken = await this.fetchToken();
					this.refreshFailures = 0;
					logs("info", "Spotify token auto-refreshed successfully");
				} catch (err) {
					this.refreshFailures++;
					const retryDelay = Math.min(
						5000 * 2 ** (this.refreshFailures - 1),
						60000,
					);
					logs(
						"warn",
						`Failed to auto-refresh Spotify token (attempt ${this.refreshFailures}). Retrying in ${retryDelay / 1000}s`,
						err,
					);
					scheduleRefresh(retryDelay);
					return;
				} finally {
					release();
				}
				this.setRefreshTimer();
			}, nextDelay);
		};

		scheduleRefresh(delay);
	}

	private async getAccessToken(
		cookies?: Array<{ name: string; value: string }>,
	): Promise<SpotifyToken> {
		const token = await this.fetchToken(cookies);
		this.accessToken = token;
        if(Configuration.logging?.level === "debug"){
			logs("log", "Spotify token fetched successfully:", {
				accessToken: `${token.accessToken.slice(0, 20)}...`,
				expiration: new Date(token.accessTokenExpirationTimestampMs).toISOString(),
			});
		}
		this.setRefreshTimer();
		return token;
	}

	private async ensureBrowser(): Promise<{
		context: BrowserContext;
		page: Page;
	}> {
		if (!this.browser || !this.context) {
			try {
				logs("info", "Launching browser...");
				const executablePath =
					Configuration.server.browserPath &&
					Configuration.server.browserPath.trim() !== ""
						? Configuration.server.browserPath
						: undefined;
				const launchOptions: LaunchOptions = {
					headless: true,
					args: [
						"--disable-gpu",
						"--disable-dev-shm-usage",
						"--disable-setuid-sandbox",
						"--no-sandbox",
						"--no-zygote",
						"--disable-extensions",
						"--disable-background-timer-throttling",
						"--disable-blink-features=AutomationControlled",
						"--disable-backgrounding-occluded-windows",
						"--disable-renderer-backgrounding",
						"--window-size=1920,1080",
                        "--disable-background-networking",
					],
				};
				if (executablePath) {
					launchOptions.executablePath = executablePath;
					logs("info", `Using custom browser path: ${executablePath}`);
				} else {
					logs("info", "Using default Playwright Chromium installation");
				}

				logs("info", "Attempting to launch Chromium browser...");
				this.browser = await playwright.chromium.launch(launchOptions);
				logs("info", "Browser launched successfully");

				logs("info", "Creating browser context...");
				this.context = await this.browser.newContext({
					userAgent:
						"Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
				});
				logs("info", "Browser context created successfully");

				logs("info", "Creating new page...");
				this.page = await this.context.newPage();
				this.routesInitialized = false;
				logs("info", "Persistent page created successfully");
			} catch (err) {
				this.browser = undefined;
				this.context = undefined;
				this.page = undefined;
				logs("error", "Failed to launch browser or context", err);
				logs(
					"error",
					`Error details: ${err instanceof Error ? err.message : String(err)}`,
				);
				logs(
					"error",
					`Error stack: ${err instanceof Error ? err.stack : "No stack trace"}`,
				);
				throw err;
			}
		} else {
			if (!this.browser.isConnected()) {
				logs("warn", "Browser is not connected, relaunching...");
				await this.closeBrowser();
				return this.ensureBrowser();
			}
			try {
				this.context.pages();
			} catch {
				logs("warn", "Context is closed, relaunching...");
				await this.closeBrowser();
				return this.ensureBrowser();
			}
			if (!this.page || this.page.isClosed()) {
				this.page = await this.context.newPage();
				this.routesInitialized = false;
			}
		}
		return { context: this.context, page: this.page };
	}

	private async closeBrowser(): Promise<void> {
		if (this.page && !this.page.isClosed()) {
			await this.page.close();
		}
		this.page = undefined;
		if (this.browser) {
			try {
				await this.browser.close();
			} finally {
				this.browser = undefined;
				this.context = undefined;
				this.routesInitialized = false;
			}
		}
	}

	private async initRoutesOnce(page: Page): Promise<void> {
		if (this.routesInitialized) return;
		this.routesInitialized = true;
		await page.route("**/*", async (route) => {
			const url = route.request().url();
			const type = route.request().resourceType();

			const blockedTypes = new Set([
				"image",
				"stylesheet",
				"font",
				"media",
				"websocket",
				"other",
			]);
			const blockedPatterns = [
				"google-analytics",
				"doubleclick.net",
				"googletagmanager.com",
				"https://open.spotifycdn.com/cdn/images/",
				"https://encore.scdn.co/fonts/",
			];
			const isBlockedUrl = (u: string) =>
				blockedPatterns.some((pat) => u.includes(pat));

			if (blockedTypes.has(type) || isBlockedUrl(url)) {
				await route.abort();
				return;
			}
			await route.continue();
		});
	}

	private async fetchToken(
		cookies?: Array<{ name: string; value: string }>,
	): Promise<SpotifyToken> {
		const { context, page } = await this.ensureBrowser();
		await this.initRoutesOnce(page);

		await context.clearCookies();
		if (cookies?.length) {
			const cookieObjects = cookies.map((cookie) => ({
				name: cookie.name,
				value: cookie.value,
				domain: ".spotify.com",
				path: "/",
				httpOnly: false,
				secure: true,
				sameSite: "Lax" as const,
			}));
			await context.addCookies(cookieObjects);
			logs(
				"info",
				"Cookies set for request",
				cookieObjects.map((cookie) => cookie.name),
			);
		}

		return new Promise<SpotifyToken>((resolve, reject) => {
			let settled = false;
			let timer: NodeJS.Timeout;

			const cleanup = (): void => {
				clearTimeout(timer);
				page.off("response", onResponse);
			};

			const fail = (error: Error): void => {
				if (settled) return;
				settled = true;
				cleanup();
				reject(error);
			};

			const onResponse = async (response: Response): Promise<void> => {
				if (!response.url().includes("/api/token") || settled) return;

				try {
					if (!response.ok()) {
						throw new Error(
							`Spotify token endpoint returned HTTP ${response.status()}`,
						);
					}

					// Read the response body immediately, before another navigation can invalidate it.
					const body = await response.text();
					const json: unknown = JSON.parse(body);

					if (
						!json ||
						typeof json !== "object" ||
						!("accessToken" in json) ||
						!("accessTokenExpirationTimestampMs" in json)
					) {
						throw new Error("Invalid Spotify token response");
					}

					const tokenData = json as Record<string, unknown>;
					delete tokenData._notes;

					if (settled) return;
					settled = true;
					cleanup();
					resolve(json as SpotifyToken);
				} catch (error) {
					logs("error", "Failed to process Spotify token response", error);
					fail(
						error instanceof Error
							? error
							: new Error(String(error)),
					);
				}
			};

			// Register the listener before starting the only navigation for this fetch.
			page.on("response", onResponse);
			timer = setTimeout(() => {
				fail(new Error("Token fetch exceeded deadline"));
			}, 15000);

			void page
				.goto("https://open.spotify.com/", {
					waitUntil: "domcontentloaded",
					timeout: 60000,
				})
				.catch((error: unknown) => {
					fail(
						new Error(
							`Spotify navigation failed: ${error instanceof Error ? error.message : String(error)}`,
						),
					);
				});
		});
	}
}
