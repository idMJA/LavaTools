import axios from "axios";
import { preprocessPlayer, getFromPrepared } from "#kiyomi/ejs/solvers";
import type { Solvers } from "#kiyomi/types";
import {
	playerCache,
	preprocessedCache,
	solverCache,
	inFlightCache,
} from "#kiyomi/utils";

async function fetchPlayerFile(playerUrl: string): Promise<string> {
	const cached = playerCache.get(playerUrl);
	if (cached !== undefined) {
		return cached;
	}

	const inFlight = inFlightCache.get(playerUrl);
	if (inFlight) {
		return inFlight;
	}

	const fetchPromise = (async () => {
		try {
			const fullUrl = playerUrl.startsWith("http")
				? playerUrl
				: `https://www.youtube.com${playerUrl}`;

			const response = await axios.get(fullUrl, { responseType: "text" });
			const playerContent = response.data;
			playerCache.set(playerUrl, playerContent);
			return playerContent;
		} catch (error) {
			throw new Error(
				`Error fetching player file: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			inFlightCache.delete(playerUrl);
		}
	})();

	inFlightCache.set(playerUrl, fetchPromise);
	return fetchPromise;
}

export async function getSolvers(player_url: string): Promise<Solvers | null> {
	const cachedSolvers = solverCache.get(player_url);
	if (cachedSolvers) {
		return cachedSolvers;
	}

	let preprocessedPlayer = preprocessedCache.get(player_url);
	if (!preprocessedPlayer) {
		const rawPlayer = await fetchPlayerFile(player_url);
		try {
			preprocessedPlayer = preprocessPlayer(rawPlayer);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			throw new Error(`Failed to preprocess player: ${message}`);
		}
		preprocessedCache.set(player_url, preprocessedPlayer);
	}

	const solvers = getFromPrepared(preprocessedPlayer);
	if (solvers) {
		solverCache.set(player_url, solvers);
		return solvers;
	}

	return null;
}
