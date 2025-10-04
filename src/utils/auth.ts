import { Configuration } from "#kiyomi/config";

export function checkYouTubeAuth(
	headers: Record<string, string | undefined>,
): boolean {
	const authHeader = headers.authorization;

	if (!authHeader) {
		return false;
	}

	return authHeader === Configuration.youtube.auth;
}
