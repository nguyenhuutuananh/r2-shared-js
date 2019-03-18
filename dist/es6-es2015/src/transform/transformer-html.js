"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const BufferUtils_1 = require("r2-utils-js/dist/es6-es2015/src/_utils/stream/BufferUtils");
const mime = require("mime-types");
const debug_ = require("debug");
const debug = debug_("r2:shared#transform/transformer-html");
class TransformerHTML {
    constructor(transformerFunction) {
        this.transformString = transformerFunction;
    }
    supports(publication, link) {
        let mediaType = mime.lookup(link.Href);
        if (link && link.TypeLink) {
            mediaType = link.TypeLink;
        }
        if (mediaType === "text/html" || mediaType === "application/xhtml+xml") {
            const pubDefinesLayout = publication.Metadata && publication.Metadata.Rendition
                && publication.Metadata.Rendition.Layout;
            const pubIsFixed = pubDefinesLayout && publication.Metadata.Rendition.Layout === "fixed";
            const linkDefinesLayout = link.Properties && link.Properties.Layout;
            const linkIsFixed = linkDefinesLayout && link.Properties.Layout === "fixed";
            if (linkIsFixed || pubIsFixed) {
                return false;
            }
            return true;
        }
        return false;
    }
    transformStream(publication, link, stream, _isPartialByteRangeRequest, _partialByteBegin, _partialByteEnd) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let data;
            try {
                data = yield BufferUtils_1.streamToBufferPromise(stream.stream);
            }
            catch (err) {
                return Promise.reject(err);
            }
            let buff;
            try {
                buff = yield this.transformBuffer(publication, link, data);
            }
            catch (err) {
                return Promise.reject(err);
            }
            const sal = {
                length: buff.length,
                reset: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    return Promise.resolve(sal);
                }),
                stream: BufferUtils_1.bufferToStream(buff),
            };
            return Promise.resolve(sal);
        });
    }
    transformBuffer(publication, link, data) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                const str = data.toString("utf8");
                const str_ = this.transformString(publication, link, str);
                return Promise.resolve(Buffer.from(str_));
            }
            catch (err) {
                debug("TransformerHTML fail => no change");
                debug(err);
                return Promise.resolve(data);
            }
        });
    }
}
exports.TransformerHTML = TransformerHTML;
//# sourceMappingURL=transformer-html.js.map