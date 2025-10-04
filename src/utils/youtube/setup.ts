import { parse } from "meriyah";

export const setupNodes = parse(`
globalThis.XMLHttpRequest = { prototype: {} };
const window = Object.assign(Object.create(null), globalThis);
window.location = new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
const document = {};
let self = globalThis;
`).body;
