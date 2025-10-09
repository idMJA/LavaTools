import axios from "axios";
import { generate } from "astring";
import { parse, type ESTree } from "meriyah";
import type { SolverFunctions } from "#kiyomi/types";
import {
	setupNodes,
	extractSig,
	extractN,
	playerCache,
	preprocessedCache,
	solverCache,
	inFlightCache,
} from "#kiyomi/utils";

async function fetchPlayerFile(playerUrl: string): Promise<string> {
	const key = playerUrl.trim();

	const cached = playerCache.get(key);
	if (cached !== undefined) return cached;

	const ongoing = inFlightCache.get(key);
	if (ongoing) return ongoing;

	const p = (async () => {
		try {
			const response = await axios.get(key, { responseType: "text" });
			const playerContent = response.data as string;
			playerCache.set(key, playerContent);
			return playerContent;
		} catch (error) {
			throw new Error(
				`Error fetching player file: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			inFlightCache.delete(key);
		}
	})();

	inFlightCache.set(key, p as Promise<string>);
	return p;
}

export async function getSolvers(
	playerUrl: string,
): Promise<SolverFunctions | null> {
	const key = playerUrl.trim();

	const cached = solverCache.get(key);
	if (cached) return cached;

	let preprocessedPlayer = preprocessedCache.get(key);
	if (!preprocessedPlayer) {
		try {
			const rawPlayer = await fetchPlayerFile(key);
			preprocessedPlayer = preprocessPlayer(rawPlayer);
			preprocessedCache.set(key, preprocessedPlayer);
		} catch {
			return null;
		}
	}

	const solvers = getFromPrepared(preprocessedPlayer);
	solverCache.set(key, solvers);
	return solvers;
}

function preprocessPlayer(data: string): string {
	const ast = parse(data);
	const body = ast.body;

	const block = (() => {
		switch (body.length) {
			case 1: {
				const func = body[0];
				if (
					func?.type === "ExpressionStatement" &&
					func.expression.type === "CallExpression" &&
					func.expression.callee.type === "MemberExpression" &&
					func.expression.callee.object.type === "FunctionExpression"
				) {
					return func.expression.callee.object.body;
				}
				break;
			}
			case 2: {
				const func = body[1];
				if (
					func?.type === "ExpressionStatement" &&
					func.expression.type === "CallExpression" &&
					func.expression.callee.type === "FunctionExpression"
				) {
					const block = func.expression.callee.body;

					block.body.splice(0, 1);
					return block;
				}
				break;
			}
		}
		throw new Error("unexpected structure");
	})();

	const found = {
		n: [] as ESTree.ArrowFunctionExpression[],
		sig: [] as ESTree.ArrowFunctionExpression[],
	};
	const plainExpressions = block.body.filter((node: ESTree.Node) => {
		const n = extractN(node);
		if (n) {
			found.n.push(n);
		}
		const sig = extractSig(node);
		if (sig) {
			found.sig.push(sig);
		}
		if (node.type === "ExpressionStatement") {
			if (node.expression.type === "AssignmentExpression") {
				return true;
			}
			return node.expression.type === "Literal";
		}
		return true;
	});
	block.body = plainExpressions;

	for (const [name, options] of Object.entries(found)) {
		const unique = new Set(options.map((x) => JSON.stringify(x)));
		if (unique.size !== 1) {
			const message = `found ${unique.size} ${name} function possibilities`;
			throw new Error(
				message +
					(unique.size
						? `: ${options.map((x) => generate(x)).join(", ")}`
						: ""),
			);
		}
		plainExpressions.push({
			type: "ExpressionStatement",
			expression: {
				type: "AssignmentExpression",
				operator: "=",
				left: {
					type: "MemberExpression",
					computed: false,
					object: {
						type: "Identifier",
						name: "_result",
					},
					property: {
						type: "Identifier",
						name: name,
					},
				},
				right: options[0],
			},
		});
	}

	ast.body.splice(0, 0, ...setupNodes);

	return generate(ast);
}

function getFromPrepared(code: string): SolverFunctions {
	const resultObj = { n: null, sig: null };
	Function("_result", code)(resultObj);
	return resultObj;
}
