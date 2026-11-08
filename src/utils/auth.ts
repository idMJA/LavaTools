import { timingSafeEqual } from "node:crypto";
import { Configuration } from "#kiyomi/config";

export function checkYouTubeAuth(
	headers: Record<string, string | undefined>,
): boolean {
	const authHeader = headers.authorization;
	const configuredAuth = Configuration.youtube.auth.trim();

	if (!configuredAuth) {
		return true;
	}
	if (!authHeader) return false;

	const expected = Buffer.from(configuredAuth);
	const received = Buffer.from(authHeader);
	return (
		expected.length === received.length && timingSafeEqual(expected, received)
	);
}
