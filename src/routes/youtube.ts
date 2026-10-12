import { Elysia, t } from "elysia";
import {
	Configuration,
	isBotGuardEnabled,
	isCipherEnabled,
} from "#kiyomi/config";
import type {
	ResolveUrlRequest,
	SignatureRequest,
	StsRequest,
} from "#kiyomi/types";
import {
	checkYouTubeAuth,
	createColdToken,
	decodeColdToken,
	decryptSig,
	fetch_pot,
	getSts,
	getVisitorData,
	getWorkerPool,
	logs,
	resolveUrl,
} from "#kiyomi/utils";

const authHeaderSchema = t.Object({
	authorization: t.Optional(
		t.String({
			description:
				"Optional authorization token matching youtube.auth in config (required if youtube.auth is set)",
		}),
	),
});

const stsRouteSchema = {
	body: t.Object({
		player_url: t.String({
			description: "YouTube player URL to extract signature timestamp from",
		}),
	}),
	headers: authHeaderSchema,
	response: {
		200: t.Object({
			sts: t.String({
				description: "Signature timestamp (STS) value",
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
		summary: "Get YouTube STS",
		description:
			"Extracts the signature timestamp (STS) from a YouTube player script",
		tags: ["YouTube"],
	},
};

export const youtubeRoutes = new Elysia({ prefix: "/api/youtube" })
	.post(
		"/decrypt_signature",
		async ({ body, headers, set }) => {
			if (!isCipherEnabled()) {
				set.status = 503;
				return {
					error: "YouTube cipher deciphering is disabled in server config",
				};
			}
			try {
				if (!checkYouTubeAuth(headers)) {
					set.status = 401;
					return {
						error: "Unauthorized. Valid Authorization header required.",
					};
				}

				const request = body as SignatureRequest;

				if (!request.player_url) {
					set.status = 400;
					return { error: "player_url is required" };
				}

				if (!request.encrypted_signature && !request.n_param) {
					set.status = 400;
					return {
						error: "Either encrypted_signature or n_param is required",
					};
				}

				return await decryptSig(request);
			} catch (e) {
				logs("error", "YouTube signature decryption failed:", e);
				set.status = 500;
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
			headers: authHeaderSchema,
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
		"/resolve_url",
		async ({ body, headers, set }) => {
			if (!isCipherEnabled()) {
				set.status = 503;
				return {
					error: "YouTube cipher deciphering is disabled in server config",
				};
			}
			try {
				if (!checkYouTubeAuth(headers)) {
					set.status = 401;
					return {
						error: "Unauthorized. Valid Authorization header required.",
					};
				}

				const request = body as ResolveUrlRequest;

				if (!request.stream_url) {
					set.status = 400;
					return { error: "stream_url is required" };
				}

				if (!request.player_url) {
					set.status = 400;
					return { error: "player_url is required" };
				}

				return await resolveUrl(request);
			} catch (e) {
				logs("error", "YouTube URL resolution failed:", e);
				set.status = 500;
				return { error: (e as Error).message };
			}
		},
		{
			body: t.Object({
				stream_url: t.String({
					description: "YouTube stream URL with encrypted parameters",
				}),
				player_url: t.String({
					description: "YouTube player URL containing decryption functions",
				}),
				encrypted_signature: t.Optional(
					t.String({
						description: "Encrypted signature from s parameter",
					}),
				),
				n_param: t.Optional(
					t.String({
						description: "n parameter value to decrypt",
					}),
				),
				signature_key: t.Optional(
					t.String({
						description: "Signature parameter name (default: sp or sig)",
					}),
				),
			}),
			headers: authHeaderSchema,
			detail: {
				summary: "Resolve YouTube Stream URL",
				description:
					"Resolves encrypted signatures and n parameters in a stream URL, returning a playable URL",
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
		"/get_sts",
		async ({ body, headers, set }) => {
			if (!isCipherEnabled()) {
				set.status = 503;
				return {
					error: "YouTube cipher deciphering is disabled in server config",
				};
			}
			try {
				if (!checkYouTubeAuth(headers)) {
					set.status = 401;
					return {
						error: "Unauthorized. Valid Authorization header required.",
					};
				}

				const request = body as StsRequest;

				if (!request.player_url) {
					set.status = 400;
					return { error: "player_url is required" };
				}

				const result = await getSts(request);
				set.headers["X-Cache-Hit"] = result.cacheHit ? "true" : "false";

				return { sts: result.sts };
			} catch (e) {
				logs("error", "YouTube STS extraction failed:", e);
				set.status = 500;
				return { error: (e as Error).message };
			}
		},
		stsRouteSchema,
	)
	.post(
		"/generate",
		async ({ headers, body, set }) => {
			if (!isBotGuardEnabled()) {
				set.status = 503;
				return {
					error: "BotGuard is disabled in server config",
				};
			}
			if (!checkYouTubeAuth(headers)) {
				set.status = 401;
				return { error: "Unauthorized" };
			}

			try {
				const reqBody = (body || {}) as {
					content_binding?: string;
					coldToken?: boolean;
					ttl?: number;
				};

				const reqTtl =
					typeof reqBody.ttl === "number" &&
					Number.isFinite(reqBody.ttl) &&
					reqBody.ttl > 0
						? reqBody.ttl * 1000
						: null;

				const contentBinding =
					reqBody.content_binding || (await getVisitorData());

				const botguardConfig = Configuration.youtube.botguard || {};
				const executionMode = botguardConfig.mode || "auto";
				const useWorker =
					executionMode === "worker" ||
					(executionMode === "auto" && (botguardConfig.workers || 1) > 1);

				const result = useWorker
					? await getWorkerPool().run<{
							poToken: string;
							contentBinding: string;
							ttl: number;
						}>(contentBinding, reqTtl)
					: await fetch_pot(contentBinding, true, reqTtl);

				const response: Record<string, string | number | null> = {
					poToken: result.poToken,
					contentBinding: result.contentBinding,
					ttl: result.ttl,
				};

				if (reqBody.coldToken) {
					response.coldStartToken =
						createColdToken(result.contentBinding) || null;
				}

				logs(
					"info",
					`Generated PO Token for binding: ${result.contentBinding}`,
				);

				return response;
			} catch (e: unknown) {
				logs("error", "PO Token generation failed:", e);
				set.status = 500;
				return { error: (e as Error).message || "generation failed" };
			}
		},
		{
			body: t.Object({
				content_binding: t.Optional(t.String()),
				coldToken: t.Optional(t.Boolean()),
				ttl: t.Optional(
					t.Number({
						description: "Custom TTL for token in seconds",
					}),
				),
			}),
			headers: authHeaderSchema,
			detail: {
				summary: "Generate WebPO PO Token",
				description:
					"Generates a YouTube PO Token for a videoId or visitorData binding (WebPO Generator & Lavalink remotePot compatible)",
				tags: ["YouTube"],
			},
		},
	)
	.post(
		"/decode_cold_start",
		async ({ headers, body, set }) => {
			if (!isBotGuardEnabled()) {
				set.status = 503;
				return {
					error: "BotGuard is disabled in server config",
				};
			}
			if (!checkYouTubeAuth(headers)) {
				set.status = 401;
				return { error: "Unauthorized" };
			}

			try {
				const { token } = body as { token: string };

				if (!token) {
					set.status = 400;
					return { error: "token is required" };
				}

				const decoded = decodeColdToken(token);
				logs("info", "Successfully decoded cold start token");
				return decoded;
			} catch (e: unknown) {
				set.status = 400;
				return {
					error: (e as Error).message || "invalid cold-start token",
				};
			}
		},
		{
			body: t.Object({
				token: t.String(),
			}),
			headers: authHeaderSchema,
			detail: {
				summary: "Decode Cold Start Token",
				description:
					"Decodes a WebPO cold start token to inspect timestamp and client state",
				tags: ["YouTube"],
			},
		},
	);
