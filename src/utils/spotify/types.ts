export interface SpImage {
	file_id: string;
	width?: number;
	height?: number;
}

export interface SpArtist {
	gid?: string;
	name: string;
}

export interface SpExternalId {
	type: string;
	id: string;
}

export interface SpTrackMeta {
	gid?: string;
	name?: string;
	duration?: number;
	artist?: SpArtist[];
	album?: {
		name?: string;
		cover_group?: {
			image?: SpImage[];
		};
	};
	external_id?: SpExternalId[];
}

export interface SpPlaylistMeta {
	attributes?: {
		name?: string;
	};
	contents?: {
		items?: Array<{ uri?: string }>;
	};
}

export interface SpAlbumMeta {
	name?: string;
	cover_group?: {
		image?: SpImage[];
	};
	disc?: Array<{
		track?: Array<{ gid?: string }>;
	}>;
}

export interface SpSearchTrackData {
	id?: string;
	name?: string;
	duration?: {
		totalMilliseconds?: number;
	};
	artists?: {
		items?: Array<{
			profile?: { name?: string };
		}>;
	};
	albumOfTrack?: {
		coverArt?: {
			sources?: Array<{ url?: string }>;
		};
	};
}

export interface SpArtistMeta {
	name?: string;
	top_track?: Array<{
		track?: Array<{ gid?: string }>;
	}>;
}
