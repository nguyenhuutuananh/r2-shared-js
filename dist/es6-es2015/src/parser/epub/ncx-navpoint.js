"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
var NavPoint_1;
"use strict";
const xml_js_mapper_1 = require("r2-utils-js/dist/es6-es2015/src/_utils/xml-js-mapper");
const ncx_content_1 = require("./ncx-content");
let NavPoint = NavPoint_1 = class NavPoint {
};
tslib_1.__decorate([
    xml_js_mapper_1.XmlXPathSelector("ncx:navPoint"),
    xml_js_mapper_1.XmlItemType(NavPoint_1),
    tslib_1.__metadata("design:type", Array)
], NavPoint.prototype, "Points", void 0);
tslib_1.__decorate([
    xml_js_mapper_1.XmlXPathSelector("ncx:navLabel/ncx:text/text()"),
    tslib_1.__metadata("design:type", String)
], NavPoint.prototype, "Text", void 0);
tslib_1.__decorate([
    xml_js_mapper_1.XmlXPathSelector("ncx:content"),
    tslib_1.__metadata("design:type", ncx_content_1.Content)
], NavPoint.prototype, "Content", void 0);
tslib_1.__decorate([
    xml_js_mapper_1.XmlXPathSelector("@playOrder"),
    tslib_1.__metadata("design:type", Number)
], NavPoint.prototype, "PlayerOrder", void 0);
tslib_1.__decorate([
    xml_js_mapper_1.XmlXPathSelector("@id | @xml:id"),
    tslib_1.__metadata("design:type", String)
], NavPoint.prototype, "ID", void 0);
NavPoint = NavPoint_1 = tslib_1.__decorate([
    xml_js_mapper_1.XmlObject({
        ncx: "http://www.daisy.org/z3986/2005/ncx/",
        xml: "http://www.w3.org/XML/1998/namespace",
    })
], NavPoint);
exports.NavPoint = NavPoint;
//# sourceMappingURL=ncx-navpoint.js.map