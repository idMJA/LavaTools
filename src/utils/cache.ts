import { LRUCache } from "lru-cache";
import type { SolverFunctions } from "#kiyomi/types";

export const playerCache = new LRUCache<string, string>({
	max: 15,
	maxSize: 50 * 1024 * 1024,
	sizeCalculation: (value) => value.length * 2,
	ttl: 1000 * 60 * 60,
	allowStale: false,
	updateAgeOnGet: false,
	updateAgeOnHas: false,
});

export const preprocessedCache = new LRUCache<string, string>({
	max: 15,
	maxSize: 50 * 1024 * 1024,
	sizeCalculation: (value) => value.length * 2,
	ttl: 1000 * 60 * 60,
	allowStale: false,
	updateAgeOnGet: false,
	updateAgeOnHas: false,
});

export const solverCache = new LRUCache<string, SolverFunctions>({
	max: 50,
	ttl: 1000 * 60 * 60 * 24,
	allowStale: false,
	updateAgeOnGet: true,
	updateAgeOnHas: false,
});

export const inFlightCache = new LRUCache<string, Promise<string>>({
	max: 100,
	ttl: 1000 * 60 * 5,
	allowStale: false,
	updateAgeOnGet: false,
});

export const stsCache = new LRUCache<string, string>({
	max: 50,
	ttl: 1000 * 60 * 60 * 24,
	allowStale: false,
	updateAgeOnGet: true,
	updateAgeOnHas: false,
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
		stsCache: {
			size: stsCache.size,
			max: stsCache.max,
			calculatedSize: stsCache.calculatedSize,
		},
	};
}

export function clearAllCaches() {
	playerCache.clear();
	preprocessedCache.clear();
	solverCache.clear();
	inFlightCache.clear();
	stsCache.clear();
}

export function purgeStaleCaches() {
	playerCache.purgeStale();
	preprocessedCache.purgeStale();
	solverCache.purgeStale();
	inFlightCache.purgeStale();
	stsCache.purgeStale();
}
