import playwright from "playwright";
import type {
	Browser,
	LaunchOptions,
	BrowserContext,
	Response,
	Page,
} from "playwright";
import type { SpotifyToken } from "#kiyomi/types";
import { Semaphore, logs } from "#kiyomi/utils";
import { Configuration } from "#kiyomi/config";

export class SpotifyTokenHandler {
	private semaphore = new Semaphore();
	private accessToken: SpotifyToken | undefined;
	private refreshTimeout: NodeJS.Timeout | undefined;

	private browser: Browser | undefined;
	private context: BrowserContext | undefined;
	private page: Page | undefined;
	private routesInitialized = false;

	constructor() {
		const initStart = Date.now();
		const bootstrap = async (attempt = 1): Promise<void> => {
			try {
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
				if (attempt < 3)
					setTimeout(() => void bootstrap(attempt + 1), 2000 * attempt);
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
			logs(
				"info",
				`Request with cookies: ${cookies.map((c) => `${c.name}=${c.value}`).join(", ")}`,
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

	private setRefreshTimer(): void {
		if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
		if (!this.accessToken) return;
		const delay = Math.max(
			this.accessToken.accessTokenExpirationTimestampMs - Date.now() + 100,
			0,
		);
		this.refreshTimeout = setTimeout(async () => {
			try {
				const release = await this.semaphore.acquire();
				try {
					this.accessToken = await this.fetchToken();
					logs("info", "Spotify token auto-refreshed (timeout)");
				} finally {
					release();
				}
			} catch (err) {
				logs("warn", "Failed to auto-refresh Spotify token", err);
			}
			this.setRefreshTimer();
		}, delay);
	}

	private async getAccessToken(
		cookies?: Array<{ name: string; value: string }>,
	): Promise<SpotifyToken> {
		const token = await this.fetchToken(cookies);
		this.accessToken = token;
		this.setRefreshTimer();
		return token;
	}

	private async ensureBrowser(): Promise<{
		context: BrowserContext;
		page: Page;
	}> {
		if (!this.browser || !this.context) {
			try {
				const executablePath =
					Configuration.browserPath && Configuration.browserPath.trim() !== ""
						? Configuration.browserPath
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
					],
				};
				if (executablePath) {
					launchOptions.executablePath = executablePath;
					logs("info", `Using custom browser path: ${executablePath}`);
				}

				this.browser = await playwright.chromium.launch(launchOptions);
				this.context = await this.browser.newContext({
					userAgent:
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
				});

				this.page = await this.context.newPage();
				void this.page.goto("https://open.spotify.com/");
				this.routesInitialized = false;
				logs("info", "Persistent page created and navigated to Spotify");
			} catch (err) {
				this.browser = undefined;
				this.context = undefined;
				this.page = undefined;
				logs("error", "Failed to launch browser or context", err);
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
				void this.page.goto("https://open.spotify.com/");
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
		await page.route("**/*", (route) => {
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

			if (blockedTypes.has(type) || isBlockedUrl(url)) return route.abort();
			route.continue();
		});
	}

	private async fetchToken(
		cookies?: Array<{ name: string; value: string }>,
	): Promise<SpotifyToken> {
		const { context, page } = await this.ensureBrowser();
		await this.initRoutesOnce(page);

		await context.clearCookies();
		if (cookies?.length) {
			const cookieObjects = cookies.map((c) => ({
				name: c.name,
				value: c.value,
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
				cookieObjects.map((c) => ({
					name: c.name,
					value: `${c.value.slice(0, 20)}...`,
				})),
			);
		}

		let timer: NodeJS.Timeout | undefined;
		const tokenPromise = new Promise<SpotifyToken>((resolve, reject) => {
			const onResponse = async (response: Response) => {
				if (!response.url().includes("/api/token")) return;
				page.off("response", onResponse);
				if (timer) clearTimeout(timer);
				try {
					if (!response.ok())
						return reject(new Error("Invalid response from Spotify"));
					const body = await response.text();
					let json: unknown;
					try {
						json = JSON.parse(body);
					} catch {
						logs("error", "Failed to parse response JSON");
						return reject(new Error("Failed to parse response JSON"));
					}
					if (
						json &&
						typeof json === "object" &&
						json !== null &&
						"_notes" in json
					) {
						delete (json as Record<string, unknown>)._notes;
					}
					resolve(json as SpotifyToken);
				} catch (err) {
					logs("error", `Failed to process token response: ${err}`);
					reject(new Error(`Failed to process token response: ${err}`));
				}
			};
			page.on("response", onResponse);
			timer = setTimeout(() => {
				page.off("response", onResponse);
				reject(new Error("Token fetch exceeded deadline"));
			}, 15000);
		});

		try {
			await page.goto("https://open.spotify.com/");
			return await tokenPromise;
		} catch (err) {
			logs("error", `Navigation failed: ${err}`);
			throw err;
		}
	}
}
