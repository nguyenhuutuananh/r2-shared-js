"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const xml_js_mapper_1 = require("r2-utils-js/dist/es8-es2017/src/_utils/xml-js-mapper");
const encryption_retrievalmethod_1 = require("./encryption-retrievalmethod");
let KeyInfo = class KeyInfo {
};
tslib_1.__decorate([
    xml_js_mapper_1.XmlXPathSelector("ds:RetrievalMethod"),
    tslib_1.__metadata("design:type", encryption_retrievalmethod_1.RetrievalMethod)
], KeyInfo.prototype, "RetrievalMethod", void 0);
KeyInfo = tslib_1.__decorate([
    xml_js_mapper_1.XmlObject({
        ds: "http://www.w3.org/2000/09/xmldsig#",
        enc: "http://www.w3.org/2001/04/xmlenc#",
        encryption: "urn:oasis:names:tc:opendocument:xmlns:container",
        ns: "http://www.idpf.org/2016/encryption#compression",
    })
], KeyInfo);
exports.KeyInfo = KeyInfo;
//# sourceMappingURL=encryption-keyinfo.js.map