import ky, { HTTPError } from "ky";
import type {
	DeezerKeySet,
	KeyRotationConfig,
	LavalinkServerConfig,
	SpotifyKeySet,
} from "#kiyomi/types";
import { logs } from "#kiyomi/utils";

export class SpotifyKeyRotator {
	private config: KeyRotationConfig;
	private currentKeyIndex = 0;
	private rotationTimer?: NodeJS.Timeout;

	constructor(config: KeyRotationConfig) {
		this.config = {
			rotationInterval: 60, // default 60 minutes
			maxErrors: 3, // default max 3 errors
			autoRotate: true, // default auto rotate enabled
			...config,
		};

		const keys = this.getSpotifyKeys();
		const activeIndex = keys.findIndex((key) => key.isActive);
		if (activeIndex !== -1) {
			this.currentKeyIndex = activeIndex;
		} else if (keys.length > 0) {
			const firstKey = keys[0];
			if (firstKey) {
				firstKey.isActive = true;
			}
			this.currentKeyIndex = 0;
		}
	}

	private getSpotifyKeys(): SpotifyKeySet[] {
		return this.config.keys.spotify || [];
	}

	/**
	 * Get the currently active Spotify key set
	 */
	getCurrentKey(): SpotifyKeySet | null {
		const keys = this.getSpotifyKeys();
		if (keys.length === 0) return null;
		return keys[this.currentKeyIndex] || null;
	}

	/**
	 * Get all available key sets
	 */
	getAllKeys(): SpotifyKeySet[] {
		return this.getSpotifyKeys();
	}

	/**
	 * Rotate to the next available key set
	 */
	async rotateKey(): Promise<SpotifyKeySet | null> {
		const keys = this.getSpotifyKeys();
		if (keys.length <= 1) {
			logs("warn", "Key rotation skipped: only one key available");
			return this.getCurrentKey();
		}

		const currentKey = keys[this.currentKeyIndex];
		if (currentKey) {
			currentKey.isActive = false;
		}

		this.currentKeyIndex = (this.currentKeyIndex + 1) % keys.length;

		const newActiveKey = keys[this.currentKeyIndex];
		if (newActiveKey) {
			newActiveKey.isActive = true;
			newActiveKey.lastUsed = new Date();
		}

		const newKey = this.getCurrentKey();
		if (newKey) {
			logs(
				"info",
				`Rotated to new Spotify key: ${newKey.clientId.substring(0, 8)}...`,
			);

			// Update all Lavalink servers with new key
			const success = await this.updateAllLavalinkServers(newKey);
			if (!success) {
				logs(
					"error",
					"Failed to update one or more Lavalink servers with new key",
				);
				newKey.errors = (newKey.errors || 0) + 1;
			} else {
				newKey.errors = 0;
			}

			return newKey;
		}

		return null;
	}

	/**
	 * Update all Lavalink servers with new Spotify credentials
	 */
	private async updateAllLavalinkServers(
		keySet: SpotifyKeySet,
	): Promise<boolean> {
		const updatePromises = this.config.lavalinkServers.map((server) =>
			this.updateLavalinkConfig(server, keySet),
		);

		const results = await Promise.allSettled(updatePromises);

		// Check if all updates were successful
		const allSuccessful = results.every(
			(result) => result.status === "fulfilled" && result.value === true,
		);

		return allSuccessful;
	}

	/**
	 * Update a specific Lavalink server configuration with new Spotify credentials
	 */
	private async updateLavalinkConfig(
		server: LavalinkServerConfig,
		keySet: SpotifyKeySet,
	): Promise<boolean> {
		try {
			const spotifyConfig: Record<string, unknown> = {
				clientId: keySet.clientId,
				clientSecret: keySet.clientSecret,
			};
			if (keySet.spDc) {
				spotifyConfig.spDc = keySet.spDc;
			}

			const data = {
				plugins: {
					lavasrc: {
						spotify: spotifyConfig,
					},
				},
			};

			const protocol = server.secure ? "https" : "http";
			const port = server.port || 8080;
			const baseUrl = `${protocol}://${server.host}:${port}`;
			const serverName = server.name || "Lavalink server";

			const response = await ky.patch(`${baseUrl}/v4/lavasrc/config`, {
				json: data,
				headers: {
					Authorization: server.password,
					"Content-Type": "application/json",
				},
				timeout: 10000, // 10 second timeout
			});

			if (response.ok) {
				logs(
					"info",
					`Successfully updated ${serverName} (${baseUrl}) with new Spotify credentials`,
				);
				return true;
			}

			logs(
				"error",
				`${serverName} returned status ${response.status}: ${response.statusText}`,
			);
			return false;
		} catch (error) {
			const serverName = server.name || "Lavalink server";
			logs("error", `Failed to update ${serverName}:`, error);
			if (error instanceof HTTPError) {
				logs("error", "Response status:", error.response.status);
			}
			return false;
		}
	}

	/**
	 * Check if current key has exceeded error threshold
	 */
	shouldRotateKey(): boolean {
		const currentKey = this.getCurrentKey();
		if (!currentKey) return false;

		const errorCount = currentKey.errors || 0;
		return errorCount >= (this.config.maxErrors || 3);
	}

	/**
	 * Report an error for the current key
	 */
	async reportKeyError(): Promise<void> {
		const currentKey = this.getCurrentKey();
		if (currentKey) {
			currentKey.errors = (currentKey.errors || 0) + 1;
			logs(
				"warn",
				`Spotify key error count increased to ${currentKey.errors} for key ${currentKey.clientId.substring(0, 8)}...`,
			);

			// Auto-rotate if error threshold exceeded
			if (this.shouldRotateKey()) {
				logs("info", "Error threshold exceeded, rotating key...");
				await this.rotateKey();
			}
		}
	}

	/**
	 * Start automatic key rotation
	 */
	startAutoRotation(): void {
		if (!this.config.autoRotate) {
			logs("info", "Auto rotation is disabled");
			return;
		}

		if (this.rotationTimer) {
			this.stopAutoRotation();
		}

		const intervalMs = (this.config.rotationInterval || 60) * 60 * 1000;
		logs(
			"info",
			`Starting auto key rotation every ${this.config.rotationInterval || 60} minutes`,
		);

		this.rotationTimer = setInterval(async () => {
			logs("info", "Auto rotating Spotify keys...");
			await this.rotateKey();
		}, intervalMs);
	}

	/**
	 * Stop automatic key rotation
	 */
	stopAutoRotation(): void {
		if (this.rotationTimer) {
			clearInterval(this.rotationTimer);
			this.rotationTimer = undefined;
			logs("info", "Auto key rotation stopped");
		}
	}

	/**
	 * Get rotation status and statistics
	 */
	getStatus() {
		const currentKey = this.getCurrentKey();
		const lavalinkServers = this.config.lavalinkServers.map((server) => {
			const protocol = server.secure ? "https" : "http";
			const port = server.port || 8080;
			return {
				name: server.name || "Lavalink server",
				url: `${protocol}://${server.host}:${port}`,
			};
		});
		return {
			totalKeys: this.getSpotifyKeys().length,
			currentKeyIndex: this.currentKeyIndex,
			currentKey: currentKey
				? {
						clientId: `${currentKey.clientId.substring(0, 8)}...`,
						errors: currentKey.errors || 0,
						lastUsed: currentKey.lastUsed,
					}
				: null,
			autoRotationEnabled: this.config.autoRotate,
			rotationInterval: this.config.rotationInterval,
			lavalinkServers: lavalinkServers,
		};
	}

	/**
	 * Manually set a specific key as active
	 */
	async setActiveKey(keyIndex: number): Promise<boolean> {
		const keys = this.getSpotifyKeys();
		if (keyIndex < 0 || keyIndex >= keys.length) {
			logs("error", `Invalid key index: ${keyIndex}`);
			return false;
		}

		const currentKey = keys[this.currentKeyIndex];
		if (currentKey) {
			currentKey.isActive = false;
		}

		this.currentKeyIndex = keyIndex;
		const newKey = keys[keyIndex];
		if (!newKey) {
			logs("error", `Key at index ${keyIndex} not found`);
			return false;
		}

		newKey.isActive = true;
		newKey.lastUsed = new Date();

		logs(
			"info",
			`Manually set active key to: ${newKey.clientId.substring(0, 8)}...`,
		);

		const success = await this.updateAllLavalinkServers(newKey);
		if (success) {
			newKey.errors = 0; // reset error count
		} else {
			newKey.errors = (newKey.errors || 0) + 1;
		}

		return success;
	}

	/**
	 * Add a new key to the rotation pool
	 */
	addKey(keySet: SpotifyKeySet): void {
		if (!this.config.keys.spotify) {
			this.config.keys.spotify = [];
		}
		this.config.keys.spotify.push({
			...keySet,
			isActive: false,
			errors: 0,
		});
		logs(
			"info",
			`Added new Spotify key: ${keySet.clientId.substring(0, 8)}...`,
		);
	}

	/**
	 * Remove a key from the rotation pool
	 */
	removeKey(keyIndex: number): boolean {
		const keys = this.getSpotifyKeys();
		if (keyIndex < 0 || keyIndex >= keys.length) {
			logs("error", `Invalid key index: ${keyIndex}`);
			return false;
		}

		if (keys.length === 1) {
			logs("error", "Cannot remove the last remaining key");
			return false;
		}

		const removedKey = keys[keyIndex];
		if (!removedKey) {
			logs("error", `Key at index ${keyIndex} not found`);
			return false;
		}

		keys.splice(keyIndex, 1);

		if (keyIndex < this.currentKeyIndex) {
			this.currentKeyIndex--;
		} else if (keyIndex === this.currentKeyIndex) {
			// if we removed the current key, set the next one as active
			this.currentKeyIndex = this.currentKeyIndex % keys.length;
			const newActiveKey = keys[this.currentKeyIndex];
			if (newActiveKey) {
				newActiveKey.isActive = true;
			}
		}

		logs(
			"info",
			`Removed Spotify key: ${removedKey.clientId.substring(0, 8)}...`,
		);
		return true;
	}
}

export class DeezerKeyRotator {
	private config: KeyRotationConfig;
	private currentKeyIndex = 0;
	private rotationTimer?: NodeJS.Timeout;

	constructor(config: KeyRotationConfig) {
		this.config = {
			rotationInterval: 60,
			maxErrors: 3,
			autoRotate: true,
			...config,
		};

		const keys = this.getDeezerKeys();
		const activeIndex = keys.findIndex((key) => key.isActive);
		if (activeIndex !== -1) {
			this.currentKeyIndex = activeIndex;
		} else if (keys.length > 0) {
			const firstKey = keys[0];
			if (firstKey) {
				firstKey.isActive = true;
			}
			this.currentKeyIndex = 0;
		}
	}

	private getDeezerKeys(): DeezerKeySet[] {
		return this.config.keys.deezer || [];
	}

	getCurrentKey(): DeezerKeySet | null {
		const keys = this.getDeezerKeys();
		if (keys.length === 0) return null;
		return keys[this.currentKeyIndex] || null;
	}

	getAllKeys(): DeezerKeySet[] {
		return this.getDeezerKeys();
	}

	async rotateKey(): Promise<DeezerKeySet | null> {
		const keys = this.getDeezerKeys();
		if (keys.length <= 1) {
			logs("warn", "Deezer key rotation skipped: only one key available");
			return this.getCurrentKey();
		}

		const currentKey = keys[this.currentKeyIndex];
		if (currentKey) {
			currentKey.isActive = false;
		}

		this.currentKeyIndex = (this.currentKeyIndex + 1) % keys.length;

		const newActiveKey = keys[this.currentKeyIndex];
		if (newActiveKey) {
			newActiveKey.isActive = true;
			newActiveKey.lastUsed = new Date();
		}

		const newKey = this.getCurrentKey();
		if (newKey) {
			const keyIdentifier = newKey.arl
				? `ARL (${newKey.arl.substring(0, 8)}...)`
				: newKey.masterDecryptionKey
					? `MasterDecryptionKey (${newKey.masterDecryptionKey.substring(0, 8)}...)`
					: "Key";
			logs("info", `Rotated to new Deezer credentials: ${keyIdentifier}`);

			const success = await this.updateAllLavalinkServers(newKey);
			if (!success) {
				logs(
					"error",
					"Failed to update one or more Lavalink servers with new Deezer credentials",
				);
				newKey.errors = (newKey.errors || 0) + 1;
			} else {
				newKey.errors = 0;
			}

			return newKey;
		}

		return null;
	}

	private async updateAllLavalinkServers(
		keySet: DeezerKeySet,
	): Promise<boolean> {
		const updatePromises = this.config.lavalinkServers.map((server) =>
			this.updateLavalinkConfig(server, keySet),
		);

		const results = await Promise.allSettled(updatePromises);
		return results.every(
			(result) => result.status === "fulfilled" && result.value === true,
		);
	}

	private async updateLavalinkConfig(
		server: LavalinkServerConfig,
		keySet: DeezerKeySet,
	): Promise<boolean> {
		try {
			const deezerConfig: Record<string, unknown> = {
				arl: keySet.arl,
			};
			if (keySet.masterDecryptionKey) {
				deezerConfig.masterDecryptionKey = keySet.masterDecryptionKey;
			}
			if (keySet.formats && keySet.formats.length > 0) {
				deezerConfig.formats = keySet.formats;
			}

			const data = {
				plugins: {
					lavasrc: {
						deezer: deezerConfig,
					},
				},
			};

			const protocol = server.secure ? "https" : "http";
			const port = server.port || 8080;
			const baseUrl = `${protocol}://${server.host}:${port}`;
			const serverName = server.name || "Lavalink server";

			const response = await ky.patch(`${baseUrl}/v4/lavasrc/config`, {
				json: data,
				headers: {
					Authorization: server.password,
					"Content-Type": "application/json",
				},
				timeout: 10000,
			});

			if (response.ok) {
				logs(
					"info",
					`Successfully updated ${serverName} (${baseUrl}) with new Deezer credentials`,
				);
				return true;
			}

			logs(
				"error",
				`${serverName} returned status ${response.status}: ${response.statusText}`,
			);
			return false;
		} catch (error) {
			const serverName = server.name || "Lavalink server";
			logs("error", `Failed to update ${serverName}:`, error);
			if (error instanceof HTTPError) {
				logs("error", "Response status:", error.response.status);
			}
			return false;
		}
	}

	shouldRotateKey(): boolean {
		const currentKey = this.getCurrentKey();
		if (!currentKey) return false;
		return (currentKey.errors || 0) >= (this.config.maxErrors || 3);
	}

	async reportKeyError(): Promise<void> {
		const currentKey = this.getCurrentKey();
		if (currentKey) {
			currentKey.errors = (currentKey.errors || 0) + 1;
			const keyIdentifier = currentKey.arl
				? `ARL (${currentKey.arl.substring(0, 8)}...)`
				: currentKey.masterDecryptionKey
					? `MasterDecryptionKey (${currentKey.masterDecryptionKey.substring(0, 8)}...)`
					: "Key";
			logs(
				"warn",
				`Deezer key error count increased to ${currentKey.errors} for ${keyIdentifier}`,
			);

			if (this.shouldRotateKey()) {
				logs("info", "Deezer error threshold exceeded, rotating key...");
				await this.rotateKey();
			}
		}
	}

	startAutoRotation(): void {
		if (!this.config.autoRotate) {
			logs("info", "Deezer auto rotation is disabled");
			return;
		}

		if (this.rotationTimer) {
			this.stopAutoRotation();
		}

		const intervalMs = (this.config.rotationInterval || 60) * 60 * 1000;
		logs(
			"info",
			`Starting auto Deezer key rotation every ${this.config.rotationInterval || 60} minutes`,
		);

		this.rotationTimer = setInterval(async () => {
			logs("info", "Auto rotating Deezer keys...");
			await this.rotateKey();
		}, intervalMs);
	}

	stopAutoRotation(): void {
		if (this.rotationTimer) {
			clearInterval(this.rotationTimer);
			this.rotationTimer = undefined;
			logs("info", "Deezer auto key rotation stopped");
		}
	}

	getStatus() {
		const currentKey = this.getCurrentKey();
		const lavalinkServers = this.config.lavalinkServers.map((server) => {
			const protocol = server.secure ? "https" : "http";
			const port = server.port || 8080;
			return {
				name: server.name || "Lavalink server",
				url: `${protocol}://${server.host}:${port}`,
			};
		});
		return {
			totalKeys: this.getDeezerKeys().length,
			currentKeyIndex: this.currentKeyIndex,
			currentKey: currentKey
				? {
						masterDecryptionKey: currentKey.masterDecryptionKey
							? `${currentKey.masterDecryptionKey.substring(0, 8)}...`
							: undefined,
						arl: currentKey.arl
							? `${currentKey.arl.substring(0, 8)}...`
							: undefined,
						formats: currentKey.formats,
						errors: currentKey.errors || 0,
						lastUsed: currentKey.lastUsed,
					}
				: null,
			autoRotationEnabled: this.config.autoRotate,
			rotationInterval: this.config.rotationInterval,
			lavalinkServers: lavalinkServers,
		};
	}

	async setActiveKey(keyIndex: number): Promise<boolean> {
		const keys = this.getDeezerKeys();
		if (keyIndex < 0 || keyIndex >= keys.length) {
			logs("error", `Invalid Deezer key index: ${keyIndex}`);
			return false;
		}

		const currentKey = keys[this.currentKeyIndex];
		if (currentKey) {
			currentKey.isActive = false;
		}

		this.currentKeyIndex = keyIndex;
		const newKey = keys[keyIndex];
		if (!newKey) {
			logs("error", `Deezer Key at index ${keyIndex} not found`);
			return false;
		}

		newKey.isActive = true;
		newKey.lastUsed = new Date();

		const keyIdentifier = newKey.arl
			? `ARL (${newKey.arl.substring(0, 8)}...)`
			: newKey.masterDecryptionKey
				? `MasterDecryptionKey (${newKey.masterDecryptionKey.substring(0, 8)}...)`
				: "Key";
		logs("info", `Manually set active Deezer key to: ${keyIdentifier}`);

		const success = await this.updateAllLavalinkServers(newKey);
		if (success) {
			newKey.errors = 0;
		} else {
			newKey.errors = (newKey.errors || 0) + 1;
		}

		return success;
	}
}

let spotifyKeyRotator: SpotifyKeyRotator | null = null;
let deezerKeyRotator: DeezerKeyRotator | null = null;

/**
 * Initialize global key rotators for Spotify and Deezer
 */
export function initializeKeyRotator(config: KeyRotationConfig): void {
	if (spotifyKeyRotator) {
		spotifyKeyRotator.stopAutoRotation();
	}
	if (deezerKeyRotator) {
		deezerKeyRotator.stopAutoRotation();
	}

	const spotifyKeys = config.keys.spotify || [];
	const deezerKeys = config.keys.deezer || [];

	if (spotifyKeys.length > 0) {
		spotifyKeyRotator = new SpotifyKeyRotator(config);
		if (config.autoRotate !== false) {
			spotifyKeyRotator.startAutoRotation();
		}
		logs("info", "Spotify key rotator initialized");
	}

	if (deezerKeys.length > 0) {
		deezerKeyRotator = new DeezerKeyRotator(config);
		if (config.autoRotate !== false) {
			deezerKeyRotator.startAutoRotation();
		}
		logs("info", "Deezer key rotator initialized");
	}
}

/**
 * Get global Spotify key rotator instance
 */
export function getKeyRotator(): SpotifyKeyRotator | null {
	return spotifyKeyRotator;
}

/**
 * Get global Deezer key rotator instance
 */
export function getDeezerKeyRotator(): DeezerKeyRotator | null {
	return deezerKeyRotator;
}

/**
 * Shutdown all key rotators
 */
export function shutdownKeyRotator(): void {
	if (spotifyKeyRotator) {
		spotifyKeyRotator.stopAutoRotation();
		spotifyKeyRotator = null;
		logs("info", "Spotify key rotator shutdown");
	}
	if (deezerKeyRotator) {
		deezerKeyRotator.stopAutoRotation();
		deezerKeyRotator = null;
		logs("info", "Deezer key rotator shutdown");
	}
}
