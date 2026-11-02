import ky from "ky";
import type {
	SpotifyArtistTopTracksResult,
	SpotifyItem,
	SpotifySearchResult,
} from "#kiyomi/types";
import { base62ToHex, resolveTrackMetadata } from "#kiyomi/utils";
import type { SpArtistMeta, SpSearchTrackData } from "./types";

export async function searchSpotifyTracks(
	query: string,
	limit = 10,
	accessToken: string,
): Promise<SpotifySearchResult> {
	const url = `https://api-partner.spotify.com/pathfinder/v1/query?operationName=searchTracks&variables=${encodeURIComponent(
		JSON.stringify({ searchTerm: query, offset: 0, limit }),
	)}&extensions=${encodeURIComponent(
		JSON.stringify({
			persistedQuery: {
				version: 1,
				sha256Hash:
					"1d388657053e192ffb5305a415ff6c8789547d2f9d5c41cc1a966ba0236a6e5b",
			},
		}),
	)}`;

	try {
		const res = await ky
			.get(url, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
					Accept: "application/json",
				},
				timeout: 5000,
			})
			.json<{
				data?: {
					searchV2?: {
						tracksV2?: {
							items?: Array<{ item?: { data?: SpSearchTrackData } }>;
						};
					};
				};
			}>();

		const trackList =
			res.data?.searchV2?.tracksV2?.items?.map((item) => item.item?.data) || [];
		const items: SpotifyItem[] = [];

		for (const tr of trackList) {
			if (!tr?.id) continue;
			const artists =
				tr.artists?.items?.map((a) => a.profile?.name).filter(Boolean) || [];
			const cover = tr.albumOfTrack?.coverArt?.sources?.[0]?.url;
			items.push({
				id: tr.id,
				title: tr.name || "Unknown Track",
				duration: tr.duration?.totalMilliseconds || 0,
				artists:
					artists.length > 0 ? (artists as string[]) : ["Unknown Artist"],
				artwork: cover,
			});
		}

		return { total: items.length, items };
	} catch (_) {
		return { total: 0, items: [] };
	}
}

export async function getArtistTopTracksMetadata(
	artistId: string,
	accessToken: string,
): Promise<SpotifyArtistTopTracksResult> {
	const gid = base62ToHex(artistId);
	const url = `https://spclient.wg.spotify.com/metadata/4/artist/${gid}`;

	const res = await ky
		.get(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/json",
			},
			timeout: 5000,
		})
		.json<SpArtistMeta>();

	const artistName = res.name || "Unknown Artist";
	const topTracks = res.top_track?.[0]?.track || [];

	const items: SpotifyItem[] = [];
	for (const tr of topTracks.slice(0, 10)) {
		const trackGid = tr.gid;
		if (!trackGid) continue;
		try {
			const trackMeta = await resolveTrackMetadata(trackGid, accessToken);
			items.push(trackMeta);
		} catch (_) {}
	}

	return {
		name: artistName,
		total: items.length,
		items,
	};
}
