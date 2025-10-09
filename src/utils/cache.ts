import { LRUCache } from "lru-cache";
import type { SolverFunctions } from "#kiyomi/types";

export const playerCache = new LRUCache<string, string>({
	max: 300,
	ttl: 1000 * 60 * 60,
	allowStale: false,
	updateAgeOnGet: false,
	updateAgeOnHas: false,
});

export const preprocessedCache = new LRUCache<string, string>({
	max: 300,
	ttl: 1000 * 60 * 60,
	allowStale: false,
	updateAgeOnGet: false,
	updateAgeOnHas: false,
});

export const solverCache = new LRUCache<string, SolverFunctions>({
	max: 150,
	ttl: 1000 * 60 * 60 * 24,
	allowStale: false,
	updateAgeOnGet: true,
	updateAgeOnHas: false,
});

export const inFlightCache = new LRUCache<string, Promise<string>>({
	max: 500,
	ttl: 1000 * 60 * 5,
	allowStale: false,
	updateAgeOnGet: false,
});

export function getCacheStats() {
	return {
		playerCache: {
			size: playerCache.size,
			max: playerCache.max,
			calculatedSize: playerCache.calculatedSize,
		},
		preprocessedCache: {
			size: preprocessedCache.size,
			max: preprocessedCache.max,
			calculatedSize: preprocessedCache.calculatedSize,
		},
		solverCache: {
			size: solverCache.size,
			max: solverCache.max,
			calculatedSize: solverCache.calculatedSize,
		},
		inFlightCache: {
			size: inFlightCache.size,
			max: inFlightCache.max,
		},
	};
}

export function clearAllCaches() {
	playerCache.clear();
	preprocessedCache.clear();
	solverCache.clear();
	inFlightCache.clear();
}
