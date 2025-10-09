import type { ESTree } from "meriyah";
import type { DeepPartial } from "#kiyomi/types";
import { matchesStructure } from "#kiyomi/utils";

const logicalExpression: DeepPartial<ESTree.ExpressionStatement> = {
	type: "ExpressionStatement",
	expression: {
		type: "LogicalExpression",
		left: {
			type: "Identifier",
		},
		right: {
			type: "SequenceExpression",
			expressions: [
				{
					type: "AssignmentExpression",
					left: {
						type: "Identifier",
					},
					operator: "=",
					right: {
						type: "CallExpression",
						callee: {
							type: "Identifier",
						},
						arguments: {
							or: [
								[
									{ type: "Literal" },
									{
										type: "CallExpression",
										callee: {
											type: "Identifier",
											name: "decodeURIComponent",
										},
										arguments: [{ type: "Identifier" }],
										optional: false,
									},
								],
								[
									{
										type: "CallExpression",
										callee: {
											type: "Identifier",
											name: "decodeURIComponent",
										},
										arguments: [{ type: "Identifier" }],
										optional: false,
									},
								],
							],
						},
						optional: false,
					},
				},
				{
					type: "CallExpression",
				},
			],
		},
		operator: "&&",
	},
};

const sigIdentifier = {
	or: [
		{
			type: "ExpressionStatement",
			expression: {
				type: "AssignmentExpression",
				operator: "=",
				left: {
					type: "Identifier",
				},
				right: {
					type: "FunctionExpression",
					params: [{}, {}, {}],
				},
			},
		},
		{
			type: "FunctionDeclaration",
			params: [{}, {}, {}],
		},
	],
} as const;

export function extractSig(
	node: ESTree.Node,
): ESTree.ArrowFunctionExpression | null {
	if (
		!matchesStructure(
			node,
			sigIdentifier as unknown as DeepPartial<ESTree.Node>,
		)
	) {
		return null;
	}
	const block =
		node.type === "ExpressionStatement" &&
		node.expression.type === "AssignmentExpression" &&
		node.expression.right.type === "FunctionExpression"
			? node.expression.right.body
			: node.type === "FunctionDeclaration"
				? node.body
				: null;
	const relevantExpression = block?.body.at(-2);
	if (
		!relevantExpression ||
		!matchesStructure(relevantExpression, logicalExpression)
	) {
		return null;
	}
	if (
		relevantExpression?.type !== "ExpressionStatement" ||
		relevantExpression.expression.type !== "LogicalExpression" ||
		relevantExpression.expression.right.type !== "SequenceExpression" ||
		!relevantExpression.expression.right.expressions[0] ||
		relevantExpression.expression.right.expressions[0].type !==
			"AssignmentExpression"
	) {
		return null;
	}
	const call = relevantExpression.expression.right.expressions[0].right;
	if (call.type !== "CallExpression" || call.callee.type !== "Identifier") {
		return null;
	}
	return {
		type: "ArrowFunctionExpression",
		params: [
			{
				type: "Identifier",
				name: "sig",
			},
		],
		body: {
			type: "CallExpression",
			callee: {
				type: "Identifier",
				name: call.callee.name,
			},
			arguments:
				call.arguments.length === 1
					? [
							{
								type: "Identifier",
								name: "sig",
							},
						]
					: call.arguments[0]
						? [
								call.arguments[0],
								{
									type: "Identifier",
									name: "sig",
								},
							]
						: [
								{
									type: "Identifier",
									name: "sig",
								},
							],
			optional: false,
		},
		async: false,
		expression: false,
		generator: false,
	};
}
