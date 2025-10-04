export function parseCookies(
	cookie: Record<string, unknown>,
): Array<{ name: string; value: string }> {
	const cookies: Array<{ name: string; value: string }> = [];
	Object.entries(cookie).forEach(([name, cookieObj]) => {
		if (
			cookieObj &&
			typeof cookieObj === "object" &&
			"value" in cookieObj &&
			typeof cookieObj.value === "string"
		) {
			cookies.push({ name, value: cookieObj.value });
		}
	});
	return cookies;
}

export function isForceEnabled(force?: string): boolean {
	return ["1", "yes", "true"].includes((force || "").toLowerCase());
}
