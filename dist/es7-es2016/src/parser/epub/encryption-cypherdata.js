"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const xml_js_mapper_1 = require("r2-utils-js/dist/es7-es2016/src/_utils/xml-js-mapper");
const encryption_cypherreference_1 = require("./encryption-cypherreference");
let CipherData = class CipherData {
};
tslib_1.__decorate([
    xml_js_mapper_1.XmlXPathSelector("enc:CipherReference"),
    tslib_1.__metadata("design:type", encryption_cypherreference_1.CipherReference)
], CipherData.prototype, "CipherReference", void 0);
CipherData = tslib_1.__decorate([
    xml_js_mapper_1.XmlObject({
        ds: "http://www.w3.org/2000/09/xmldsig#",
        enc: "http://www.w3.org/2001/04/xmlenc#",
        encryption: "urn:oasis:names:tc:opendocument:xmlns:container",
        ns: "http://www.idpf.org/2016/encryption#compression",
    })
], CipherData);
exports.CipherData = CipherData;
//# sourceMappingURL=encryption-cypherdata.js.map