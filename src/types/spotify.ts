export interface SpotifyToken {
	accessToken: string;
	accessTokenExpirationTimestampMs: number;
	clientId?: string;
	isAnonymous?: boolean;
	[key: string]: unknown;
}

export interface TokenProxy {
	type: string;
	fetch: (
		cookies?: Array<{ name: string; value: string }>,
	) => Promise<SpotifyToken>;
	readonly data: SpotifyToken | undefined;
	valid(): boolean;
	refresh(): Promise<SpotifyToken>;
}

export interface SpotifyClient {
	handleTokenRequest(
		isForce?: boolean,
		cookies?: Array<{ name: string; value: string }>,
	): Promise<SpotifyToken | { error: string }>;
	resolveUrl?(url: string): Promise<SpotifyResolveResult | { error: string }>;
	searchCatalog?(
		query: string,
		limit?: number,
	): Promise<SpotifySearchResult | { error: string }>;
	getArtistTopTracks?(
		artistId: string,
	): Promise<SpotifyArtistTopTracksResult | { error: string }>;
	cleanup?(): Promise<void>;
}

export interface SpotifyItem {
	id: string;
	title: string;
	duration: number;
	artists: string[];
	artwork?: string;
	isrc?: string;
}

export interface SpotifyResolveResult {
	type: "track" | "playlist" | "album" | "artist";
	name: string;
	total: number;
	items: SpotifyItem[];
}

export interface SpotifySearchResult {
	total: number;
	items: SpotifyItem[];
}

export interface SpotifyArtistTopTracksResult {
	name: string;
	total: number;
	items: SpotifyItem[];
}
