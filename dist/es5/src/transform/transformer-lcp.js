"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var transformer_lcp_1 = require("r2-lcp-js/dist/es5/src/transform/transformer-lcp");
var TransformerLCP = (function () {
    function TransformerLCP() {
    }
    TransformerLCP.prototype.supports = function (publication, link) {
        return (typeof publication.LCP !== "undefined") &&
            link.Properties && link.Properties.Encrypted &&
            transformer_lcp_1.supports(publication.LCP, link.Href, link.Properties.Encrypted);
    };
    TransformerLCP.prototype.transformStream = function (publication, link, stream, isPartialByteRangeRequest, partialByteBegin, partialByteEnd) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                return [2, transformer_lcp_1.transformStream(publication.LCP, link.Href, link.Properties.Encrypted, stream, isPartialByteRangeRequest, partialByteBegin, partialByteEnd)];
            });
        });
    };
    return TransformerLCP;
}());
exports.TransformerLCP = TransformerLCP;
//# sourceMappingURL=transformer-lcp.js.map