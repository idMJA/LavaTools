import axios from "axios";
import type { StsRequest, StsResponse } from "#kiyomi/types";

const playerCache = new Map<string, string>();
const stsCache = new Map<string, string>();

async function fetchPlayerFile(playerUrl: string): Promise<string> {
	if (playerCache.has(playerUrl)) {
		const cached = playerCache.get(playerUrl);
		if (cached !== undefined) return cached;
	}

	try {
		const response = await axios.get(playerUrl, { responseType: "text" });
		const playerContent = response.data;
		playerCache.set(playerUrl, playerContent);
		return playerContent;
	} catch (error) {
		throw new Error(
			`Error fetching player file: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

export async function getSts(
	request: StsRequest,
): Promise<StsResponse & { cacheHit?: boolean }> {
	const { player_url } = request;

	const cachedSts = stsCache.get(player_url);
	if (cachedSts) {
		return { sts: cachedSts, cacheHit: true };
	}

	const playerContent = await fetchPlayerFile(player_url);

	const stsPattern = /(signatureTimestamp|sts):(\d+)/;
	const match = playerContent.match(stsPattern);

	if (match?.[2]) {
		const sts = match[2];
		stsCache.set(player_url, sts);
		return { sts, cacheHit: false };
	} else {
		throw new Error("Timestamp not found in player script");
	}
}
