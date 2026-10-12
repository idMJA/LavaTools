import { Elysia, t } from "elysia";
import { isRotationEnabled } from "#kiyomi/config";
import { checkYouTubeAuth, getRotator, logs } from "#kiyomi/utils";

const authHeaderSchema = t.Object({
	authorization: t.Optional(
		t.String({
			description: "Authorization token",
		}),
	),
});

export const keyRotationRoutes = new Elysia({ prefix: "/api/key-rotation" })
	.onBeforeHandle(({ set }) => {
		if (!isRotationEnabled()) {
			set.status = 503;
			return { error: "Key rotation service is disabled in server config" };
		}
	})
	.get(
		"/status",
		() => {
			try {
				const rotator = getRotator();
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
		"/rotate",
		async ({ headers, set }) => {
			try {
				if (!checkYouTubeAuth(headers)) {
					set.status = 401;
					return {
						error: "Unauthorized. Valid Authorization header required.",
					};
				}

				const rotator = getRotator();
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
			headers: authHeaderSchema,
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
		"/set-active",
		async ({ body, headers, set }) => {
			try {
				if (!checkYouTubeAuth(headers)) {
					set.status = 401;
					return {
						error: "Unauthorized. Valid Authorization header required.",
					};
				}

				const rotator = getRotator();
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
			headers: authHeaderSchema,
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
		"/report-error",
		async ({ headers, set }) => {
			try {
				if (!checkYouTubeAuth(headers)) {
					set.status = 401;
					return {
						error: "Unauthorized. Valid Authorization header required.",
					};
				}

				const rotator = getRotator();
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
			headers: authHeaderSchema,
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
	);
