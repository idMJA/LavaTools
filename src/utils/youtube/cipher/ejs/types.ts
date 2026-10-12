/*
Taken from https://github.com/yt-dlp/ejs
Auto-synced by scripts/update-ejs.ts
*/

type DP<T> = T extends (infer U)[]
	? DeepPartial<U>[]
	: T extends object
		? { [P in keyof T]?: DeepPartial<T[P]> }
		: T;

type ValueOf<T> = T extends (infer U)[]
	? U
	: T extends object
		? T[keyof T]
		: never;

export type DeepPartial<T> =
	| DP<T>
	| { or: DP<T>[] }
	| { anykey: DP<ValueOf<T>>[] };
