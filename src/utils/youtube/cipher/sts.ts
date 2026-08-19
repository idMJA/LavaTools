import type { StsRequest, StsResponse } from "#kiyomi/types";
import { fetchPlayerFile, getPlayerScript, stsCache } from "#kiyomi/utils";

function normalizePlayerUrl(playerUrl: string): string {
	try {
		return getPlayerScript(playerUrl).toUrl();
	} catch {
		if (playerUrl.startsWith("http")) {
			return playerUrl;
		}
		return `https://www.youtube.com${playerUrl}`;
	}
}

export async function getSts(
	request: StsRequest,
): Promise<StsResponse & { cacheHit?: boolean }> {
	const { player_url } = request;
	const cacheKey = normalizePlayerUrl(player_url);

	const cachedSts = stsCache.get(cacheKey);
	if (cachedSts) {
		return { sts: cachedSts, cacheHit: true };
	}

	const playerContent = await fetchPlayerFile(player_url);

	const stsPattern = /(signatureTimestamp|sts):(\d+)/;
	const match = playerContent.match(stsPattern);

	if (match?.[2]) {
		const sts = match[2];
		stsCache.set(cacheKey, sts);
		return { sts, cacheHit: false };
	} else {
		throw new Error("Timestamp not found in player script");
	}
}
