import type { ESTree } from "meriyah";
import type { DeepPartial } from "#kiyomi/types";

export function matchesStructure<T extends ESTree.Node>(
	obj: ESTree.Node | ESTree.Node[],
	structure: DeepPartial<T> | readonly DeepPartial<T>[],
): boolean {
	if (Array.isArray(structure)) {
		if (!Array.isArray(obj)) {
			return false;
		}
		return (
			structure.length === obj.length &&
			structure.every((value, index) => {
				const objAtIndex = obj[index];
				return objAtIndex ? matchesStructure(objAtIndex, value) : false;
			})
		);
	}
	if (typeof structure === "object") {
		if (!obj) {
			return !structure;
		}
		if ("or" in structure) {
			// handle `{ or: [a, b] }`
			return structure.or.some((node) => matchesStructure(obj, node));
		}
		for (const [key, value] of Object.entries(structure)) {
			if (!matchesStructure(obj[key as keyof typeof obj], value)) {
				return false;
			}
		}
		return true;
	}
	return structure === obj;
}
