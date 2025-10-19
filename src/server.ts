import { Elysia, t } from "elysia";
import { openapi } from "@elysiajs/openapi";
import {
	logs,
	parseCookies,
	isForceEnabled,
	decryptSignature,
	resolveUrl,
	getSts,
	checkYouTubeAuth,
	getKeyRotator,
} from "#kiyomi/utils";
import type {
	SpotifyClient,
	SignatureRequest,
	ResolveUrlRequest,
	StsRequest,
} from "#kiyomi/types";
import { Configuration } from "./config/config";

function createApp(spotifyClient: SpotifyClient | null) {
	return new Elysia()
		.use(
			openapi({
				documentation: {
					info: {
						title: "LavaTools API",
						version: "1.0.0",
						description:
							"API for YouTube signature decryption and Spotify token management",
					},
					servers: [
						{
							url: `http://localhost:${Configuration.server.port || 3000}`,
							description: "Development server",
						},
					],
					tags: [
						{
							name: "General",
							description: "General endpoints",
						},
						{
							name: "YouTube",
							description:
								"YouTube signature and STS endpoints (requires authorization)",
						},
						{
							name: "Spotify",
							description: "Spotify token management endpoints",
						},
						{
							name: "Key Rotation",
							description: "Spotify key rotation management endpoints",
						},
					],
				},
			}),
		)
		.get("/", () => "hi :3", {
			detail: {
				summary: "Health Check",
				description: "Simple health check endpoint",
				tags: ["General"],
			},
		})
		.get(
			"/api/spotify/token",
			async ({ cookie, query }) => {
				try {
					if (!spotifyClient) {
						return { error: "Spotify client not initialized" };
					}

					const cookies = parseCookies(cookie);
					const isForce = isForceEnabled(query.force);

					const result = await spotifyClient.handleTokenRequest(
						isForce,
						cookies,
					);

					if (cookie?.lastTokenUrl && "accessToken" in result) {
						cookie.lastTokenUrl.value = new Date().toISOString();
					}

					return result;
				} catch (e) {
					logs("error", "Token request failed:", e);
					return { error: (e as Error).message };
				}
			},
			{
				query: t.Object({
					force: t.Optional(
						t.String({
							description: "Force refresh token (1, yes, true to enable)",
						}),
					),
				}),
				detail: {
					summary: "Get Spotify Access Token",
					description:
						"Retrieves or refreshes Spotify access token using configured method (API or browser)",
					tags: ["Spotify"],
				},
			},
		)
		.get(
			"/api/key-rotation/status",
			() => {
				try {
					const rotator = getKeyRotator();
					if (!rotator) {
						return { error: "Key rotator not initialized" };
					}

					return rotator.getStatus();
				} catch (e) {
					logs("error", "Failed to get key rotation status:", e);
					return { error: (e as Error).message };
				}
			},
			{
				detail: {
					summary: "Get Key Rotation Status",
					description: "Get current status of Spotify key rotation system",
					tags: ["Key Rotation"],
				},
			},
		)
		.post(
			"/api/key-rotation/rotate",
			async ({ headers, set }) => {
				try {
					if (!checkYouTubeAuth(headers)) {
						set.status = 401;
						return {
							error: "Unauthorized. Valid Authorization header required.",
						};
					}

					const rotator = getKeyRotator();
					if (!rotator) {
						return { error: "Key rotator not initialized" };
					}

					const newKey = await rotator.rotateKey();
					if (!newKey) {
						return { error: "Failed to rotate key" };
					}

					return {
						success: true,
						message: "Key rotated successfully",
						currentKey: {
							clientId: `${newKey.clientId.substring(0, 8)}...`,
							errors: newKey.errors || 0,
							lastUsed: newKey.lastUsed,
						},
					};
				} catch (e) {
					logs("error", "Manual key rotation failed:", e);
					return { error: (e as Error).message };
				}
			},
			{
				headers: t.Object({
					authorization: t.String({
						description: "Authorization token (without Bearer prefix)",
					}),
				}),
				response: {
					200: t.Object({
						success: t.Boolean(),
						message: t.String(),
						currentKey: t.Object({
							clientId: t.String(),
							errors: t.Number(),
							lastUsed: t.Optional(t.Date()),
						}),
					}),
					401: t.Object({
						error: t.String(),
					}),
					400: t.Object({
						error: t.String(),
					}),
				},
				detail: {
					summary: "Manually Rotate Spotify Key",
					description: "Manually trigger rotation to the next Spotify key",
					tags: ["Key Rotation"],
					security: [
						{
							Authorization: [],
						},
					],
				},
			},
		)
		.post(
			"/api/key-rotation/set-active",
			async ({ body, headers, set }) => {
				try {
					if (!checkYouTubeAuth(headers)) {
						set.status = 401;
						return {
							error: "Unauthorized. Valid Authorization header required.",
						};
					}

					const rotator = getKeyRotator();
					if (!rotator) {
						return { error: "Key rotator not initialized" };
					}

					const { keyIndex } = body as { keyIndex: number };
					const success = await rotator.setActiveKey(keyIndex);

					if (!success) {
						return { error: "Failed to set active key" };
					}

					const currentKey = rotator.getCurrentKey();
					return {
						success: true,
						message: "Active key set successfully",
						currentKey: currentKey
							? {
									clientId: `${currentKey.clientId.substring(0, 8)}...`,
									errors: currentKey.errors || 0,
									lastUsed: currentKey.lastUsed,
								}
							: undefined,
					};
				} catch (e) {
					logs("error", "Failed to set active key:", e);
					return { error: (e as Error).message };
				}
			},
			{
				body: t.Object({
					keyIndex: t.Number({
						description: "Index of the key to set as active (0-based)",
					}),
				}),
				headers: t.Object({
					authorization: t.String({
						description: "Authorization token (without Bearer prefix)",
					}),
				}),
				response: {
					200: t.Object({
						success: t.Boolean(),
						message: t.String(),
						currentKey: t.Optional(
							t.Object({
								clientId: t.String(),
								errors: t.Number(),
								lastUsed: t.Optional(t.Date()),
							}),
						),
					}),
					401: t.Object({
						error: t.String(),
					}),
					400: t.Object({
						error: t.String(),
					}),
				},
				detail: {
					summary: "Set Active Spotify Key",
					description: "Manually set a specific Spotify key as active by index",
					tags: ["Key Rotation"],
					security: [
						{
							Authorization: [],
						},
					],
				},
			},
		)
		.post(
			"/api/key-rotation/report-error",
			async ({ headers, set }) => {
				try {
					if (!checkYouTubeAuth(headers)) {
						set.status = 401;
						return {
							error: "Unauthorized. Valid Authorization header required.",
						};
					}

					const rotator = getKeyRotator();
					if (!rotator) {
						return { error: "Key rotator not initialized" };
					}

					await rotator.reportKeyError();

					const currentKey = rotator.getCurrentKey();
					return {
						success: true,
						message: "Key error reported",
						currentKey: currentKey
							? {
									clientId: `${currentKey.clientId.substring(0, 8)}...`,
									errors: currentKey.errors || 0,
									lastUsed: currentKey.lastUsed,
								}
							: undefined,
					};
				} catch (e) {
					logs("error", "Failed to report key error:", e);
					return { error: (e as Error).message };
				}
			},
			{
				headers: t.Object({
					authorization: t.String({
						description: "Authorization token (without Bearer prefix)",
					}),
				}),
				response: {
					200: t.Object({
						success: t.Boolean(),
						message: t.String(),
						currentKey: t.Optional(
							t.Object({
								clientId: t.String(),
								errors: t.Number(),
								lastUsed: t.Optional(t.Date()),
							}),
						),
					}),
					401: t.Object({
						error: t.String(),
					}),
					400: t.Object({
						error: t.String(),
					}),
				},
				detail: {
					summary: "Report Spotify Key Error",
					description:
						"Report an error for the current Spotify key, may trigger auto-rotation",
					tags: ["Key Rotation"],
					security: [
						{
							Authorization: [],
						},
					],
				},
			},
		)
		.post(
			"/api/youtube/decrypt_signature",
			async ({ body, headers, set }) => {
				try {
					if (!checkYouTubeAuth(headers)) {
						set.status = 401;
						return {
							error: "Unauthorized. Valid Authorization header required.",
						};
					}

					const request = body as SignatureRequest;

					if (!request.player_url) {
						return { error: "player_url is required" };
					}

					if (!request.encrypted_signature && !request.n_param) {
						return {
							error: "Either encrypted_signature or n_param is required",
						};
					}

					const result = await decryptSignature(request);
					return result;
				} catch (e) {
					logs("error", "YouTube signature decryption failed:", e);
					return { error: (e as Error).message };
				}
			},
			{
				body: t.Object({
					encrypted_signature: t.Optional(
						t.String({
							description: "Encrypted YouTube signature to decrypt",
						}),
					),
					n_param: t.Optional(
						t.String({
							description: "YouTube n parameter to decrypt",
						}),
					),
					player_url: t.String({
						description: "YouTube player URL containing decryption functions",
					}),
				}),
				headers: t.Object({
					authorization: t.String({
						description: "Authorization token (without Bearer prefix)",
					}),
				}),
				response: {
					200: t.Object({
						decrypted_signature: t.String({
							description: "Decrypted signature",
						}),
						decrypted_n_sig: t.String({
							description: "Decrypted n parameter",
						}),
					}),
					401: t.Object({
						error: t.String(),
					}),
					400: t.Object({
						error: t.String(),
					}),
				},
				detail: {
					summary: "Decrypt YouTube Signature",
					description:
						"Decrypts YouTube encrypted signatures and n parameters using the player URL",
					tags: ["YouTube"],
					security: [
						{
							Authorization: [],
						},
					],
				},
			},
		)
		.post(
			"/api/youtube/resolve_url",
			async ({ body, headers, set }) => {
				try {
					if (!checkYouTubeAuth(headers)) {
						set.status = 401;
						return {
							error: "Unauthorized. Valid Authorization header required.",
						};
					}

					const request = body as ResolveUrlRequest;

					if (!request.stream_url) {
						return { error: "stream_url is required" };
					}

					if (!request.player_url) {
						return { error: "player_url is required" };
					}

					const result = await resolveUrl(request);
					return result;
				} catch (e) {
					logs("error", "YouTube URL resolution failed:", e);
					return { error: (e as Error).message };
				}
			},
			{
				body: t.Object({
					stream_url: t.String({
						description: "YouTube stream URL to resolve",
					}),
					player_url: t.String({
						description: "YouTube player URL containing decryption functions",
					}),
					encrypted_signature: t.Optional(
						t.String({
							description: "Encrypted YouTube signature to decrypt",
						}),
					),
					signature_key: t.Optional(
						t.String({
							description: "Signature key parameter name (defaults to 'sig')",
						}),
					),
					n_param: t.Optional(
						t.String({
							description: "YouTube n parameter to decrypt",
						}),
					),
				}),
				headers: t.Object({
					authorization: t.String({
						description: "Authorization token (without Bearer prefix)",
					}),
				}),
				response: {
					200: t.Object({
						resolved_url: t.String({
							description: "Resolved YouTube stream URL",
						}),
					}),
					401: t.Object({
						error: t.String(),
					}),
					400: t.Object({
						error: t.String(),
					}),
				},
				detail: {
					summary: "Resolve YouTube Stream URL",
					description:
						"Resolves YouTube stream URLs by decrypting signatures and n parameters",
					tags: ["YouTube"],
					security: [
						{
							Authorization: [],
						},
					],
				},
			},
		)
		.post(
			"/api/youtube/get_sts",
			async ({ body, headers, set }) => {
				try {
					if (!checkYouTubeAuth(headers)) {
						set.status = 401;
						return {
							error: "Unauthorized. Valid Authorization header required.",
						};
					}

					const request = body as StsRequest;

					if (!request.player_url) {
						return { error: "player_url is required" };
					}

					const result = await getSts(request);

					if (result.cacheHit) {
						set.headers["X-Cache-Hit"] = "true";
					} else {
						set.headers["X-Cache-Hit"] = "false";
					}

					const { cacheHit, ...response } = result;

					void cacheHit;
					return response;
				} catch (e) {
					logs("error", "YouTube STS retrieval failed:", e);
					return { error: (e as Error).message };
				}
			},
			{
				body: t.Object({
					player_url: t.String({
						description:
							"YouTube player URL to extract STS (signature timestamp) from",
					}),
				}),
				headers: t.Object({
					authorization: t.String({
						description: "Authorization token (without Bearer prefix)",
					}),
				}),
				response: {
					200: t.Object({
						sts: t.String({
							description: "YouTube signature timestamp",
						}),
					}),
					401: t.Object({
						error: t.String(),
					}),
					400: t.Object({
						error: t.String(),
					}),
					404: t.Object({
						error: t.String(),
					}),
				},
				detail: {
					summary: "Get YouTube STS",
					description:
						"Extracts the signature timestamp (STS) from a YouTube player script",
					tags: ["YouTube"],
					security: [
						{
							Authorization: [],
						},
					],
				},
			},
		)
		.listen(Configuration.server.port || 3000);
}

export async function startServer(spotifyClient: SpotifyClient | null) {
	const app = createApp(spotifyClient);
	logs(
		"info",
		`API server is running at ${app.server?.hostname}:${app.server?.port}`,
	);
	return app;
}
