"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const transformer_lcp_1 = require("./transformer-lcp");
const transformer_obf_adobe_1 = require("./transformer-obf-adobe");
const transformer_obf_idpf_1 = require("./transformer-obf-idpf");
class Transformers {
    constructor() {
        this.transformers = [];
    }
    static instance() {
        return Transformers._instance;
    }
    static tryStream(publication, link, stream, isPartialByteRangeRequest, partialByteBegin, partialByteEnd) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return Transformers.instance()._tryStream(publication, link, stream, isPartialByteRangeRequest, partialByteBegin, partialByteEnd);
        });
    }
    add(transformer) {
        if (this.transformers.indexOf(transformer) < 0) {
            this.transformers.push(transformer);
        }
    }
    _tryStream(publication, link, stream, isPartialByteRangeRequest, partialByteBegin, partialByteEnd) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let transformedData;
            let atLeastOne = false;
            let s = stream;
            for (const t of this.transformers) {
                if (t.supports(publication, link)) {
                    atLeastOne = true;
                    if (transformedData) {
                        try {
                            s = yield transformedData;
                        }
                        catch (err) {
                            transformedData = undefined;
                            break;
                        }
                    }
                    transformedData = t.transformStream(publication, link, s, isPartialByteRangeRequest, partialByteBegin, partialByteEnd);
                }
            }
            if (transformedData) {
                return transformedData;
            }
            return atLeastOne ? Promise.reject("transformers fail") : Promise.resolve(stream);
        });
    }
}
Transformers._instance = new Transformers();
exports.Transformers = Transformers;
Transformers.instance().add(new transformer_obf_adobe_1.TransformerObfAdobe());
Transformers.instance().add(new transformer_obf_idpf_1.TransformerObfIDPF());
Transformers.instance().add(new transformer_lcp_1.TransformerLCP());
//# sourceMappingURL=transformer.js.map