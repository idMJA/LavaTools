import ky from "ky";
import type { SpotifyItem, SpotifyResolveResult } from "#kiyomi/types";
import { Semaphore } from "#kiyomi/utils";
import type { SpAlbumMeta, SpPlaylistMeta, SpTrackMeta } from "./types";

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function base62ToHex(s: string): string {
	let n = 0n;
	for (let i = 0; i < s.length; i++) {
		const char = s[i];
		if (!char) continue;
		const idx = BigInt(BASE62.indexOf(char));
		n = n * 62n + idx;
	}
	let hex = n.toString(16);
	while (hex.length < 32) hex = `0${hex}`;
	return hex;
}

const TRACK_CACHE = new Map<string, SpotifyItem>();
const IN_FLIGHT_TRACKS = new Map<string, Promise<SpotifyItem>>();
const MAX_CACHE_SIZE = 10000;
const GLOBAL_RESOLVE_SEMAPHORE = new Semaphore(64);

function setTrackCache(id: string, item: SpotifyItem) {
	if (TRACK_CACHE.size >= MAX_CACHE_SIZE) {
		const firstKey = TRACK_CACHE.keys().next().value;
		if (firstKey) TRACK_CACHE.delete(firstKey);
	}
	TRACK_CACHE.set(id, item);
}

export async function resolveTrackMetadata(
	trackId: string,
	accessToken: string,
): Promise<SpotifyItem> {
	const cached = TRACK_CACHE.get(trackId);
	if (cached) return cached;

	const pending = IN_FLIGHT_TRACKS.get(trackId);
	if (pending) return pending;

	const fetchPromise = (async () => {
		const release = await GLOBAL_RESOLVE_SEMAPHORE.acquire();
		try {
			const gid = base62ToHex(trackId);
			const url = `https://spclient.wg.spotify.com/metadata/4/track/${gid}`;

			const res = await ky
				.get(url, {
					headers: {
						Authorization: `Bearer ${accessToken}`,
						Accept: "application/json",
						"User-Agent":
							"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
					},
					timeout: 5000,
				})
				.json<SpTrackMeta>();

			const artists = (res.artist || []).map((a) => a.name);
			const images = res.album?.cover_group?.image || [];
			const lastImage =
				images.length > 0 ? images[images.length - 1] : undefined;
			const coverId = lastImage ? lastImage.file_id : null;
			const artwork = coverId
				? `https://i.scdn.co/image/${coverId}`
				: undefined;
			const isrcItem = (res.external_id || []).find((x) => x.type === "isrc");

			const item: SpotifyItem = {
				id: trackId,
				title: res.name || "Unknown Title",
				duration: res.duration || 0,
				artists: artists.length > 0 ? artists : ["Unknown Artist"],
				artwork,
				isrc: isrcItem?.id,
			};

			setTrackCache(trackId, item);
			return item;
		} finally {
			release();
			IN_FLIGHT_TRACKS.delete(trackId);
		}
	})();

	IN_FLIGHT_TRACKS.set(trackId, fetchPromise);
	return fetchPromise;
}

export async function resolveSpotifyUrl(
	targetUrl: string,
	accessToken: string,
): Promise<SpotifyResolveResult> {
	const urlObj = new URL(targetUrl);
	const parts = urlObj.pathname.split("/").filter(Boolean);
	const typeIndex = parts.findIndex((p) =>
		["track", "playlist", "album", "artist"].includes(p),
	);
	const targetType = typeIndex !== -1 ? parts[typeIndex] : undefined;
	const targetParam = typeIndex !== -1 ? parts[typeIndex + 1] : undefined;

	if (!targetType || !targetParam) {
		throw new Error(`Unsupported or invalid Spotify URL: ${targetUrl}`);
	}

	const type = targetType as "track" | "playlist" | "album" | "artist";
	const id = targetParam.split("?")[0] as string;

	if (type === "track") {
		const track = await resolveTrackMetadata(id, accessToken);
		return {
			type: "track",
			name: track.title,
			total: 1,
			items: [track],
		};
	}

	if (type === "playlist") {
		const plUrl = `https://spclient.wg.spotify.com/playlist/v2/playlist/${id}?decorate=attributes,client_metadata`;
		const pl = await ky
			.get(plUrl, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
					Accept: "application/json",
				},
				timeout: 7000,
			})
			.json<SpPlaylistMeta>();

		const playlistName = pl.attributes?.name || "Spotify Playlist";
		const rawItems = pl.contents?.items || [];
		const trackIds = rawItems
			.map((item) => item.uri?.split(":").pop())
			.filter(Boolean) as string[];

		const items: SpotifyItem[] = [];
		const BATCH_SIZE = 20;
		for (let i = 0; i < trackIds.length; i += BATCH_SIZE) {
			const batch = trackIds.slice(i, i + BATCH_SIZE);
			const batchResults = await Promise.all(
				batch.map((tid) =>
					resolveTrackMetadata(tid, accessToken).catch(() => null),
				),
			);
			for (const r of batchResults) {
				if (r) items.push(r);
			}
		}

		return {
			type: "playlist",
			name: playlistName,
			total: items.length,
			items,
		};
	}

	if (type === "album") {
		const hexGid = base62ToHex(id);
		const albumUrl = `https://spclient.wg.spotify.com/metadata/4/album/${hexGid}`;
		const alb = await ky
			.get(albumUrl, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
					Accept: "application/json",
				},
				timeout: 7000,
			})
			.json<SpAlbumMeta>();

		const albumName = alb.name || "Spotify Album";
		const trackGids: string[] = [];
		for (const disc of alb.disc || []) {
			for (const tr of disc.track || []) {
				if (tr.gid) trackGids.push(tr.gid);
			}
		}

		const items: SpotifyItem[] = [];
		const BATCH_SIZE = 20;
		for (let i = 0; i < trackGids.length; i += BATCH_SIZE) {
			const batch = trackGids.slice(i, i + BATCH_SIZE);
			const batchResults = await Promise.all(
				batch.map(async (gid) => {
					try {
						const res = await ky
							.get(`https://spclient.wg.spotify.com/metadata/4/track/${gid}`, {
								headers: {
									Authorization: `Bearer ${accessToken}`,
									Accept: "application/json",
								},
								timeout: 5000,
							})
							.json<SpTrackMeta>();
						const artists = (res.artist || []).map((a) => a.name);
						const images = alb.cover_group?.image || [];
						const lastImg =
							images.length > 0 ? images[images.length - 1] : undefined;
						const coverId = lastImg ? lastImg.file_id : null;
						const isrcItem = (res.external_id || []).find(
							(x) => x.type === "isrc",
						);
						return {
							id: gid,
							title: res.name || "Unknown Track",
							duration: res.duration || 0,
							artists: artists.length > 0 ? artists : ["Unknown Artist"],
							artwork: coverId
								? `https://i.scdn.co/image/${coverId}`
								: undefined,
							isrc: isrcItem?.id,
						} as SpotifyItem;
					} catch (_) {
						return null;
					}
				}),
			);
			for (const r of batchResults) {
				if (r) items.push(r);
			}
		}

		return {
			type: "album",
			name: albumName,
			total: items.length,
			items,
		};
	}

	throw new Error(`Resolve type ${type} is not yet supported`);
}
