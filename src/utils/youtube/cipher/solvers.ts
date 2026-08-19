import ky from "ky";
import { getFromPrepared, preprocessPlayer } from "#kiyomi/ejs/solvers";
import type { Solvers } from "#kiyomi/types";
import {
	getPlayerScript,
	inFlightCache,
	playerCache,
	preprocessedCache,
	solverCache,
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

export async function fetchPlayerFile(playerUrl: string): Promise<string> {
	const normalizedPlayerUrl = normalizePlayerUrl(playerUrl);

	const cached = playerCache.get(normalizedPlayerUrl);
	if (cached !== undefined) {
		return cached;
	}

	const inFlight = inFlightCache.get(normalizedPlayerUrl);
	if (inFlight) {
		return inFlight;
	}

	const fetchPromise = (async () => {
		try {
			const playerContent = await ky.get(normalizedPlayerUrl).text();
			playerCache.set(normalizedPlayerUrl, playerContent);
			return playerContent;
		} catch (error) {
			throw new Error(
				`Error fetching player file: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			inFlightCache.delete(normalizedPlayerUrl);
		}
	})();

	inFlightCache.set(normalizedPlayerUrl, fetchPromise);
	return fetchPromise;
}

export async function getSolvers(player_url: string): Promise<Solvers | null> {
	const cacheKey = normalizePlayerUrl(player_url);

	const cachedSolvers = solverCache.get(cacheKey);
	if (cachedSolvers) {
		return cachedSolvers;
	}

	let preprocessedPlayer = preprocessedCache.get(cacheKey);
	if (!preprocessedPlayer) {
		const rawPlayer = await fetchPlayerFile(player_url);
		try {
			preprocessedPlayer = preprocessPlayer(rawPlayer);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			throw new Error(`Failed to preprocess player: ${message}`);
		}
		preprocessedCache.set(cacheKey, preprocessedPlayer);
	}

	const solvers = getFromPrepared(preprocessedPlayer);
	if (solvers) {
		solverCache.set(cacheKey, solvers);
		return solvers;
	}

	return null;
}
