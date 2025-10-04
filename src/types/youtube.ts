import type { ESTree } from "meriyah";

export interface SignatureRequest {
	encrypted_signature: string;
	n_param: string;
	player_url: string;
}

export interface SignatureResponse {
	decrypted_signature: string;
	decrypted_n_sig: string;
}

export interface Solvers {
	n: ((val: string) => string) | null;
	sig: ((val: string) => string) | null;
}

export interface StsRequest {
	player_url: string;
}

export interface StsResponse {
	sts: string;
}

export type DeepPartial<T> = T extends object
	? Or<{
			[P in keyof T]?: DeepPartial<T[P]>;
		}>
	: Or<T>;

export type Or<T> = T | { or: T[] };

export interface SolverFunctions {
	n: ((val: string) => string) | null;
	sig: ((val: string) => string) | null;
}

export interface ExtractorResult {
	n: ESTree.ArrowFunctionExpression[];
	sig: ESTree.ArrowFunctionExpression[];
}
