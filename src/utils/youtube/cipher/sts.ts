import type { StsRequest, StsResponse } from "#kiyomi/types";
import {
	fetchPlayerFile,
	getPlayerScript,
	logs,
	stsCache,
} from "#kiyomi/utils";

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
		logs(
			"info",
			`Extracted STS (${cachedSts}) from cache for player: ${player_url}`,
		);
		return { sts: cachedSts, cacheHit: true };
	}

	const playerContent = await fetchPlayerFile(player_url);

	const stsPattern = /(signatureTimestamp|sts):(\d+)/;
	const match = playerContent.match(stsPattern);

	if (match?.[2]) {
		const sts = match[2];
		stsCache.set(cacheKey, sts);
		logs("info", `Extracted STS (${sts}) from player script: ${player_url}`);
		return { sts, cacheHit: false };
	} else {
		throw new Error("Timestamp not found in player script");
	}
}
