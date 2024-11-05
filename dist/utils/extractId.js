"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractId = void 0;
function extractId(input) {
    const masterRegex = /^MASTER:([a-zA-Z0-9]+)$/;
    const childRegex = /^CHILD:([a-zA-Z0-9]+)$/;
    let match = input.match(masterRegex);
    if (match) {
        return { type: "MASTER", id: match[1] };
    }
    match = input.match(childRegex);
    if (match) {
        return { type: "CHILD", id: match[1] };
    }
    return { type: null, id: null };
}
exports.extractId = extractId;
//# sourceMappingURL=extractId.js.map