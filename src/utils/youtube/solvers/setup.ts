import { parse } from "meriyah";

export const setupNodes = parse(`
if (typeof globalThis.XMLHttpRequest === "undefined") {
    globalThis.XMLHttpRequest = { prototype: {} };
}
if (typeof globalThis.window === "undefined") {
    globalThis.window = Object.create(null);
}
if (typeof URL === "undefined") {
    globalThis.window.location = {
        hash: "",
        host: "www.youtube.com",
        hostname: "www.youtube.com",
        href: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        origin: "https://www.youtube.com",
        password: "",
        pathname: "/watch",
        port: "",
        protocol: "https:",
        search: "?v=dQw4w9WgXcQ",
        username: "",
    };
} else {
    globalThis.window.location = new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
}
if (typeof globalThis.document === "undefined") {
    globalThis.document = Object.create(null);
}
if (typeof globalThis.navigator === "undefined") {
    globalThis.navigator = Object.create(null);
}
if (typeof globalThis.self === "undefined") {
    globalThis.self = globalThis;
}
`).body;
