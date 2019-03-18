"use strict";
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var crypto = require("crypto");
var fs = require("fs");
var path = require("path");
var url_1 = require("url");
var util = require("util");
var publication_link_1 = require("../models/publication-link");
var epub_1 = require("../parser/epub");
var publication_parser_1 = require("../parser/publication-parser");
var lcp_1 = require("r2-lcp-js/dist/es5/src/parser/epub/lcp");
var UrlUtils_1 = require("r2-utils-js/dist/es5/src/_utils/http/UrlUtils");
var BufferUtils_1 = require("r2-utils-js/dist/es5/src/_utils/stream/BufferUtils");
var transformer_1 = require("../transform/transformer");
var ta_json_x_1 = require("ta-json-x");
var init_globals_1 = require("../init-globals");
init_globals_1.initGlobalConverters_SHARED();
init_globals_1.initGlobalConverters_GENERIC();
lcp_1.setLcpNativePluginPath(path.join(process.cwd(), "LCP", "lcp.node"));
console.log("process.cwd():");
console.log(process.cwd());
console.log("__dirname: ");
console.log(__dirname);
var args = process.argv.slice(2);
console.log("args:");
console.log(args);
if (!args[0]) {
    console.log("FILEPATH ARGUMENT IS MISSING.");
    process.exit(1);
}
var argPath = args[0].trim();
var filePath = argPath;
console.log(filePath);
if (!UrlUtils_1.isHTTP(filePath)) {
    if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, argPath);
        console.log(filePath);
        if (!fs.existsSync(filePath)) {
            filePath = path.join(process.cwd(), argPath);
            console.log(filePath);
            if (!fs.existsSync(filePath)) {
                console.log("FILEPATH DOES NOT EXIST.");
                process.exit(1);
            }
        }
    }
    var stats = fs.lstatSync(filePath);
    if (!stats.isFile() && !stats.isDirectory()) {
        console.log("FILEPATH MUST BE FILE OR DIRECTORY.");
        process.exit(1);
    }
}
var fileName = filePath;
if (UrlUtils_1.isHTTP(filePath)) {
    var url = new url_1.URL(filePath);
    fileName = url.pathname;
}
fileName = fileName.replace(/META-INF[\/|\\]container.xml$/, "");
fileName = path.basename(fileName);
var isAnEPUB = epub_1.isEPUBlication(filePath);
var outputDirPath;
if (args[1]) {
    var argDir = args[1].trim();
    var dirPath = argDir;
    console.log(dirPath);
    if (!fs.existsSync(dirPath)) {
        dirPath = path.join(__dirname, argDir);
        console.log(dirPath);
        if (!fs.existsSync(dirPath)) {
            dirPath = path.join(process.cwd(), argDir);
            console.log(dirPath);
            if (!fs.existsSync(dirPath)) {
                console.log("DIRPATH DOES NOT EXIST.");
                process.exit(1);
            }
            else {
                if (!fs.lstatSync(dirPath).isDirectory()) {
                    console.log("DIRPATH MUST BE DIRECTORY.");
                    process.exit(1);
                }
            }
        }
    }
    dirPath = fs.realpathSync(dirPath);
    var fileNameNoExt = fileName + "_R2_EXTRACTED";
    console.log(fileNameNoExt);
    outputDirPath = path.join(dirPath, fileNameNoExt);
    console.log(outputDirPath);
    if (fs.existsSync(outputDirPath)) {
        console.log("OUTPUT FOLDER ALREADY EXISTS!");
        process.exit(1);
    }
}
var decryptKeys;
if (args[2]) {
    decryptKeys = args[2].trim().split(";");
}
(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
    var publication, err_1, err_2;
    return tslib_1.__generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4, publication_parser_1.PublicationParsePromise(filePath)];
            case 1:
                publication = _a.sent();
                return [3, 3];
            case 2:
                err_1 = _a.sent();
                console.log("== Publication Parser: reject");
                console.log(err_1);
                return [2];
            case 3:
                if (!(isAnEPUB && outputDirPath)) return [3, 8];
                _a.label = 4;
            case 4:
                _a.trys.push([4, 6, , 7]);
                return [4, extractEPUB(publication, outputDirPath, decryptKeys)];
            case 5:
                _a.sent();
                return [3, 7];
            case 6:
                err_2 = _a.sent();
                console.log("== Publication extract FAIL");
                console.log(err_2);
                return [2];
            case 7: return [3, 9];
            case 8:
                dumpPublication(publication);
                _a.label = 9;
            case 9: return [2];
        }
    });
}); })();
function extractEPUB_ManifestJSON(pub, outDir, keys) {
    var manifestJson = ta_json_x_1.JSON.serialize(pub);
    var arrLinks = [];
    if (manifestJson.readingOrder) {
        arrLinks.push.apply(arrLinks, manifestJson.readingOrder);
    }
    if (manifestJson.resources) {
        arrLinks.push.apply(arrLinks, manifestJson.resources);
    }
    if (keys) {
        arrLinks.forEach(function (link) {
            if (link.properties && link.properties.encrypted &&
                link.properties.encrypted.scheme === "http://readium.org/2014/01/lcp") {
                delete link.properties.encrypted;
                var atLeastOne_1 = false;
                var jsonProps = Object.keys(link.properties);
                if (jsonProps) {
                    jsonProps.forEach(function (jsonProp) {
                        if (link.properties.hasOwnProperty(jsonProp)) {
                            atLeastOne_1 = true;
                            return false;
                        }
                        return true;
                    });
                }
                if (!atLeastOne_1) {
                    delete link.properties;
                }
            }
        });
        if (manifestJson.links) {
            var index = -1;
            for (var i = 0; i < manifestJson.links.length; i++) {
                var link = manifestJson.links[i];
                if (link.type === "application/vnd.readium.lcp.license.v1.0+json"
                    && link.rel === "license") {
                    index = i;
                    break;
                }
            }
            if (index >= 0) {
                manifestJson.links.splice(index, 1);
            }
            if (manifestJson.links.length === 0) {
                delete manifestJson.links;
            }
        }
    }
    arrLinks.forEach(function (link) {
        if (link.properties && link.properties.encrypted &&
            (link.properties.encrypted.algorithm === "http://www.idpf.org/2008/embedding" ||
                link.properties.encrypted.algorithm === "http://ns.adobe.com/pdf/enc#RC")) {
            delete link.properties.encrypted;
            var atLeastOne_2 = false;
            var jsonProps = Object.keys(link.properties);
            if (jsonProps) {
                jsonProps.forEach(function (jsonProp) {
                    if (link.properties.hasOwnProperty(jsonProp)) {
                        atLeastOne_2 = true;
                        return false;
                    }
                    return true;
                });
            }
            if (!atLeastOne_2) {
                delete link.properties;
            }
        }
    });
    var manifestJsonStr = JSON.stringify(manifestJson, null, "  ");
    var manifestJsonPath = path.join(outDir, "manifest.json");
    fs.writeFileSync(manifestJsonPath, manifestJsonStr, "utf8");
}
function extractEPUB_Check(zip, outDir) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var zipEntries, err_3, _i, zipEntries_1, zipEntry, expectedOutputPath;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4, zip.getEntries()];
                case 1:
                    zipEntries = _a.sent();
                    return [3, 3];
                case 2:
                    err_3 = _a.sent();
                    console.log(err_3);
                    return [3, 3];
                case 3:
                    if (zipEntries) {
                        for (_i = 0, zipEntries_1 = zipEntries; _i < zipEntries_1.length; _i++) {
                            zipEntry = zipEntries_1[_i];
                            if (zipEntry !== "mimetype" && !zipEntry.startsWith("META-INF/") && !zipEntry.endsWith(".opf") &&
                                zipEntry !== ".DS_Store") {
                                expectedOutputPath = path.join(outDir, zipEntry);
                                if (!fs.existsSync(expectedOutputPath)) {
                                    console.log("Zip entry not extracted??");
                                    console.log(expectedOutputPath);
                                }
                            }
                        }
                    }
                    return [2];
            }
        });
    });
}
function extractEPUB_ProcessKeys(pub, keys) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var keysSha256Hex, err_4;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!pub.LCP || !keys) {
                        return [2];
                    }
                    keysSha256Hex = keys.map(function (key) {
                        console.log("@@@");
                        console.log(key);
                        if (key.length === 64) {
                            var isHex = true;
                            for (var i = 0; i < key.length; i += 2) {
                                var hexByte = key.substr(i, 2).toLowerCase();
                                var parsedInt = parseInt(hexByte, 16);
                                if (isNaN(parsedInt)) {
                                    isHex = false;
                                    break;
                                }
                            }
                            if (isHex) {
                                return key;
                            }
                        }
                        var checkSum = crypto.createHash("sha256");
                        checkSum.update(key);
                        var keySha256Hex = checkSum.digest("hex");
                        console.log(keySha256Hex);
                        return keySha256Hex;
                    });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4, pub.LCP.tryUserKeys(keysSha256Hex)];
                case 2:
                    _a.sent();
                    return [3, 4];
                case 3:
                    err_4 = _a.sent();
                    console.log(err_4);
                    throw Error("FAIL publication.LCP.tryUserKeys()");
                case 4: return [2];
            }
        });
    });
}
function extractEPUB_Link(pub, zip, outDir, link) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var pathInZip, zipStream_, err_5, transformedStream, err_6, zipData, err_7, linkOutputPath;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    pathInZip = link.Href;
                    console.log("===== " + pathInZip);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4, zip.entryStreamPromise(pathInZip)];
                case 2:
                    zipStream_ = _a.sent();
                    return [3, 4];
                case 3:
                    err_5 = _a.sent();
                    console.log(pathInZip);
                    console.log(err_5);
                    return [2];
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    return [4, transformer_1.Transformers.tryStream(pub, link, zipStream_, false, 0, 0)];
                case 5:
                    transformedStream = _a.sent();
                    return [3, 7];
                case 6:
                    err_6 = _a.sent();
                    console.log(pathInZip);
                    console.log(err_6);
                    return [2];
                case 7:
                    zipStream_ = transformedStream;
                    _a.label = 8;
                case 8:
                    _a.trys.push([8, 10, , 11]);
                    return [4, BufferUtils_1.streamToBufferPromise(zipStream_.stream)];
                case 9:
                    zipData = _a.sent();
                    return [3, 11];
                case 10:
                    err_7 = _a.sent();
                    console.log(pathInZip);
                    console.log(err_7);
                    return [2];
                case 11:
                    linkOutputPath = path.join(outDir, pathInZip);
                    ensureDirs(linkOutputPath);
                    fs.writeFileSync(linkOutputPath, zipData);
                    return [2];
            }
        });
    });
}
function extractEPUB(pub, outDir, keys) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var zipInternal, zip, err_8, links, lic, has, err_9, l, _i, links_1, link, err_10, err_11;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    zipInternal = pub.findFromInternal("zip");
                    if (!zipInternal) {
                        console.log("No publication zip!?");
                        return [2];
                    }
                    zip = zipInternal.Value;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4, extractEPUB_ProcessKeys(pub, keys)];
                case 2:
                    _a.sent();
                    return [3, 4];
                case 3:
                    err_8 = _a.sent();
                    console.log(err_8);
                    throw err_8;
                case 4:
                    fs.mkdirSync(outDir);
                    extractEPUB_ManifestJSON(pub, outDir, keys);
                    links = [];
                    if (pub.Resources) {
                        links.push.apply(links, pub.Resources);
                    }
                    if (pub.Spine) {
                        links.push.apply(links, pub.Spine);
                    }
                    if (!!keys) return [3, 9];
                    lic = "META-INF/license.lcpl";
                    has = zip.hasEntry(lic);
                    if (!zip.hasEntryAsync) return [3, 8];
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    return [4, zip.hasEntryAsync(lic)];
                case 6:
                    has = _a.sent();
                    return [3, 8];
                case 7:
                    err_9 = _a.sent();
                    console.log(err_9);
                    return [3, 8];
                case 8:
                    if (has) {
                        l = new publication_link_1.Link();
                        l.Href = lic;
                        links.push(l);
                    }
                    _a.label = 9;
                case 9:
                    _i = 0, links_1 = links;
                    _a.label = 10;
                case 10:
                    if (!(_i < links_1.length)) return [3, 15];
                    link = links_1[_i];
                    _a.label = 11;
                case 11:
                    _a.trys.push([11, 13, , 14]);
                    return [4, extractEPUB_Link(pub, zip, outDir, link)];
                case 12:
                    _a.sent();
                    return [3, 14];
                case 13:
                    err_10 = _a.sent();
                    console.log(err_10);
                    return [3, 14];
                case 14:
                    _i++;
                    return [3, 10];
                case 15:
                    _a.trys.push([15, 17, , 18]);
                    return [4, extractEPUB_Check(zip, outDir)];
                case 16:
                    _a.sent();
                    return [3, 18];
                case 17:
                    err_11 = _a.sent();
                    console.log(err_11);
                    return [3, 18];
                case 18: return [2];
            }
        });
    });
}
function ensureDirs(fspath) {
    var dirname = path.dirname(fspath);
    if (!fs.existsSync(dirname)) {
        ensureDirs(dirname);
        fs.mkdirSync(dirname);
    }
}
function dumpPublication(publication) {
    console.log("#### RAW OBJECT:");
    console.log(util.inspect(publication, { showHidden: false, depth: 1000, colors: true, customInspect: true }));
}
//# sourceMappingURL=cli.js.map