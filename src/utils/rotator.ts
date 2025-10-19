import axios from "axios";
import type {
	LavalinkConfig,
	LavalinkServerConfig,
	SpotifyKeySet,
	KeyRotationConfig,
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

		const activeIndex = this.config.keys.findIndex((key) => key.isActive);
		if (activeIndex !== -1) {
			this.currentKeyIndex = activeIndex;
		} else if (this.config.keys.length > 0) {
			const firstKey = this.config.keys[0];
			if (firstKey) {
				firstKey.isActive = true;
			}
			this.currentKeyIndex = 0;
		}
	}

	/**
	 * Get the currently active Spotify key set
	 */
	getCurrentKey(): SpotifyKeySet | null {
		if (this.config.keys.length === 0) return null;
		return this.config.keys[this.currentKeyIndex] || null;
	}

	/**
	 * Get all available key sets
	 */
	getAllKeys(): SpotifyKeySet[] {
		return this.config.keys;
	}

	/**
	 * Rotate to the next available key set
	 */
	async rotateKey(): Promise<SpotifyKeySet | null> {
		if (this.config.keys.length <= 1) {
			logs("warn", "Key rotation skipped: only one key available");
			return this.getCurrentKey();
		}

		const currentKey = this.config.keys[this.currentKeyIndex];
		if (currentKey) {
			currentKey.isActive = false;
		}

		this.currentKeyIndex = (this.currentKeyIndex + 1) % this.config.keys.length;

		const newActiveKey = this.config.keys[this.currentKeyIndex];
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
			const data: LavalinkConfig = {
				spotify: {
					clientId: keySet.clientId,
					clientSecret: keySet.clientSecret,
					spDc: keySet.spDc,
				},
			};

			const protocol = server.secure ? "https" : "http";
			const port = server.port || 8080;
			const baseUrl = `${protocol}://${server.host}:${port}`;
			const serverName = server.name || "Lavalink server";

			const response = await axios.patch(`${baseUrl}/v4/lavasrc/config`, data, {
				headers: {
					Authorization: server.password,
					"Content-Type": "application/json",
				},
				timeout: 10000, // 10 second timeout
			});

			if (response.status === 200 || response.status === 204) {
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
			if (axios.isAxiosError(error)) {
				logs("error", "Response data:", error.response?.data);
				logs("error", "Response status:", error.response?.status);
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
			totalKeys: this.config.keys.length,
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
		if (keyIndex < 0 || keyIndex >= this.config.keys.length) {
			logs("error", `Invalid key index: ${keyIndex}`);
			return false;
		}

		const currentKey = this.config.keys[this.currentKeyIndex];
		if (currentKey) {
			currentKey.isActive = false;
		}

		this.currentKeyIndex = keyIndex;
		const newKey = this.config.keys[keyIndex];
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
		this.config.keys.push({
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
		if (keyIndex < 0 || keyIndex >= this.config.keys.length) {
			logs("error", `Invalid key index: ${keyIndex}`);
			return false;
		}

		if (this.config.keys.length === 1) {
			logs("error", "Cannot remove the last remaining key");
			return false;
		}

		const removedKey = this.config.keys[keyIndex];
		if (!removedKey) {
			logs("error", `Key at index ${keyIndex} not found`);
			return false;
		}

		this.config.keys.splice(keyIndex, 1);

		if (keyIndex < this.currentKeyIndex) {
			this.currentKeyIndex--;
		} else if (keyIndex === this.currentKeyIndex) {
			// if we removed the current key, set the next one as active
			this.currentKeyIndex = this.currentKeyIndex % this.config.keys.length;
			const newActiveKey = this.config.keys[this.currentKeyIndex];
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

let keyRotator: SpotifyKeyRotator | null = null;

/**
 * Initialize the global key rotator
 */
export function initializeKeyRotator(config: KeyRotationConfig): void {
	if (keyRotator) {
		keyRotator.stopAutoRotation();
	}

	keyRotator = new SpotifyKeyRotator(config);

	// Start auto rotation if enabled
	if (config.autoRotate !== false) {
		keyRotator.startAutoRotation();
	}

	logs("info", "Spotify key rotator initialized");
}

/**
 * Get the global key rotator instance
 */
export function getKeyRotator(): SpotifyKeyRotator | null {
	return keyRotator;
}

/**
 * Shutdown the key rotator
 */
export function shutdownKeyRotator(): void {
	if (keyRotator) {
		keyRotator.stopAutoRotation();
		keyRotator = null;
		logs("info", "Spotify key rotator shutdown");
	}
}
