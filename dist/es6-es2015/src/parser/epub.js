"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs = require("fs");
const path = require("path");
const querystring = require("querystring");
const url_1 = require("url");
const media_overlay_1 = require("../models/media-overlay");
const metadata_1 = require("../models/metadata");
const metadata_belongsto_1 = require("../models/metadata-belongsto");
const metadata_contributor_1 = require("../models/metadata-contributor");
const metadata_media_overlay_1 = require("../models/metadata-media-overlay");
const metadata_properties_1 = require("../models/metadata-properties");
const metadata_subject_1 = require("../models/metadata-subject");
const publication_1 = require("../models/publication");
const publication_link_1 = require("../models/publication-link");
const metadata_encrypted_1 = require("r2-lcp-js/dist/es6-es2015/src/models/metadata-encrypted");
const lcp_1 = require("r2-lcp-js/dist/es6-es2015/src/parser/epub/lcp");
const UrlUtils_1 = require("r2-utils-js/dist/es6-es2015/src/_utils/http/UrlUtils");
const BufferUtils_1 = require("r2-utils-js/dist/es6-es2015/src/_utils/stream/BufferUtils");
const xml_js_mapper_1 = require("r2-utils-js/dist/es6-es2015/src/_utils/xml-js-mapper");
const zipFactory_1 = require("r2-utils-js/dist/es6-es2015/src/_utils/zip/zipFactory");
const transformer_1 = require("../transform/transformer");
const debug_ = require("debug");
const sizeOf = require("image-size");
const moment = require("moment");
const ta_json_x_1 = require("ta-json-x");
const xmldom = require("xmldom");
const xpath = require("xpath");
const container_1 = require("./epub/container");
const encryption_1 = require("./epub/encryption");
const ncx_1 = require("./epub/ncx");
const opf_1 = require("./epub/opf");
const opf_author_1 = require("./epub/opf-author");
const smil_1 = require("./epub/smil");
const smil_seq_1 = require("./epub/smil-seq");
const debug = debug_("r2:shared#parser/epub");
const epub3 = "3.0";
const epub301 = "3.0.1";
const epub31 = "3.1";
const autoMeta = "auto";
const noneMeta = "none";
const reflowableMeta = "reflowable";
exports.mediaOverlayURLPath = "media-overlay.json";
exports.mediaOverlayURLParam = "resource";
exports.addCoverDimensions = (publication, coverLink) => tslib_1.__awaiter(this, void 0, void 0, function* () {
    const zipInternal = publication.findFromInternal("zip");
    if (zipInternal) {
        const zip = zipInternal.Value;
        let has = zip.hasEntry(coverLink.Href);
        if (zip.hasEntryAsync) {
            try {
                has = yield zip.hasEntryAsync(coverLink.Href);
            }
            catch (err) {
                console.log(err);
            }
        }
        if (has) {
            let zipStream;
            try {
                zipStream = yield zip.entryStreamPromise(coverLink.Href);
            }
            catch (err) {
                debug(coverLink.Href);
                debug(coverLink.TypeLink);
                debug(err);
                return;
            }
            let zipData;
            try {
                zipData = yield BufferUtils_1.streamToBufferPromise(zipStream.stream);
                const imageInfo = sizeOf(zipData);
                if (imageInfo) {
                    coverLink.Width = imageInfo.width;
                    coverLink.Height = imageInfo.height;
                    if (coverLink.TypeLink &&
                        coverLink.TypeLink.replace("jpeg", "jpg").replace("+xml", "")
                            !== ("image/" + imageInfo.type)) {
                        debug(`Wrong image type? ${coverLink.TypeLink} -- ${imageInfo.type}`);
                    }
                }
            }
            catch (err) {
                debug(coverLink.Href);
                debug(coverLink.TypeLink);
                debug(err);
            }
        }
    }
});
var EPUBis;
(function (EPUBis) {
    EPUBis["LocalExploded"] = "LocalExploded";
    EPUBis["LocalPacked"] = "LocalPacked";
    EPUBis["RemoteExploded"] = "RemoteExploded";
    EPUBis["RemotePacked"] = "RemotePacked";
})(EPUBis = exports.EPUBis || (exports.EPUBis = {}));
function isEPUBlication(urlOrPath) {
    let p = urlOrPath;
    const http = UrlUtils_1.isHTTP(urlOrPath);
    if (http) {
        const url = new url_1.URL(urlOrPath);
        p = url.pathname;
    }
    else if (fs.existsSync(path.join(urlOrPath, "META-INF", "container.xml"))) {
        return EPUBis.LocalExploded;
    }
    const fileName = path.basename(p);
    const ext = path.extname(fileName).toLowerCase();
    const epub = /\.epub[3]?$/.test(ext);
    if (epub) {
        return http ? EPUBis.RemotePacked : EPUBis.LocalPacked;
    }
    if (/META-INF[\/|\\]container.xml$/.test(p)) {
        return http ? EPUBis.RemoteExploded : EPUBis.LocalExploded;
    }
    return undefined;
}
exports.isEPUBlication = isEPUBlication;
function EpubParsePromise(filePath) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const isAnEPUB = isEPUBlication(filePath);
        let filePathToLoad = filePath;
        if (isAnEPUB === EPUBis.LocalExploded) {
            filePathToLoad = filePathToLoad.replace(/META-INF[\/|\\]container.xml$/, "");
        }
        else if (isAnEPUB === EPUBis.RemoteExploded) {
            const url = new url_1.URL(filePathToLoad);
            url.pathname = url.pathname.replace(/META-INF[\/|\\]container.xml$/, "");
            filePathToLoad = url.toString();
        }
        let zip;
        try {
            zip = yield zipFactory_1.zipLoadPromise(filePathToLoad);
        }
        catch (err) {
            debug(err);
            return Promise.reject(err);
        }
        if (!zip.hasEntries()) {
            return Promise.reject("EPUB zip empty");
        }
        const publication = new publication_1.Publication();
        publication.Context = ["https://readium.org/webpub-manifest/context.jsonld"];
        publication.Metadata = new metadata_1.Metadata();
        publication.Metadata.RDFType = "http://schema.org/Book";
        publication.Metadata.Modified = moment(Date.now()).toDate();
        publication.AddToInternal("filename", path.basename(filePath));
        publication.AddToInternal("type", "epub");
        publication.AddToInternal("zip", zip);
        let lcpl;
        const lcplZipPath = "META-INF/license.lcpl";
        let has = zip.hasEntry(lcplZipPath);
        if (zip.hasEntryAsync) {
            try {
                has = yield zip.hasEntryAsync(lcplZipPath);
            }
            catch (err) {
                console.log(err);
            }
        }
        if (has) {
            let lcplZipStream_;
            try {
                lcplZipStream_ = yield zip.entryStreamPromise(lcplZipPath);
            }
            catch (err) {
                debug(err);
                return Promise.reject(err);
            }
            const lcplZipStream = lcplZipStream_.stream;
            let lcplZipData;
            try {
                lcplZipData = yield BufferUtils_1.streamToBufferPromise(lcplZipStream);
            }
            catch (err) {
                debug(err);
                return Promise.reject(err);
            }
            const lcplStr = lcplZipData.toString("utf8");
            const lcplJson = global.JSON.parse(lcplStr);
            lcpl = ta_json_x_1.JSON.deserialize(lcplJson, lcp_1.LCP);
            lcpl.ZipPath = lcplZipPath;
            lcpl.JsonSource = lcplStr;
            lcpl.init();
            publication.LCP = lcpl;
            const mime = "application/vnd.readium.lcp.license.v1.0+json";
            publication.AddLink(mime, ["license"], lcpl.ZipPath, undefined);
        }
        let encryption;
        const encZipPath = "META-INF/encryption.xml";
        has = zip.hasEntry(encZipPath);
        if (zip.hasEntryAsync) {
            try {
                has = yield zip.hasEntryAsync(encZipPath);
            }
            catch (err) {
                console.log(err);
            }
        }
        if (has) {
            let encryptionXmlZipStream_;
            try {
                encryptionXmlZipStream_ = yield zip.entryStreamPromise(encZipPath);
            }
            catch (err) {
                debug(err);
                return Promise.reject(err);
            }
            const encryptionXmlZipStream = encryptionXmlZipStream_.stream;
            let encryptionXmlZipData;
            try {
                encryptionXmlZipData = yield BufferUtils_1.streamToBufferPromise(encryptionXmlZipStream);
            }
            catch (err) {
                debug(err);
                return Promise.reject(err);
            }
            const encryptionXmlStr = encryptionXmlZipData.toString("utf8");
            const encryptionXmlDoc = new xmldom.DOMParser().parseFromString(encryptionXmlStr);
            encryption = xml_js_mapper_1.XML.deserialize(encryptionXmlDoc, encryption_1.Encryption);
            encryption.ZipPath = encZipPath;
        }
        const containerZipPath = "META-INF/container.xml";
        let containerXmlZipStream_;
        try {
            containerXmlZipStream_ = yield zip.entryStreamPromise(containerZipPath);
        }
        catch (err) {
            debug(err);
            return Promise.reject(err);
        }
        const containerXmlZipStream = containerXmlZipStream_.stream;
        let containerXmlZipData;
        try {
            containerXmlZipData = yield BufferUtils_1.streamToBufferPromise(containerXmlZipStream);
        }
        catch (err) {
            debug(err);
            return Promise.reject(err);
        }
        const containerXmlStr = containerXmlZipData.toString("utf8");
        const containerXmlDoc = new xmldom.DOMParser().parseFromString(containerXmlStr);
        const container = xml_js_mapper_1.XML.deserialize(containerXmlDoc, container_1.Container);
        container.ZipPath = containerZipPath;
        const rootfile = container.Rootfile[0];
        let opfZipStream_;
        try {
            opfZipStream_ = yield zip.entryStreamPromise(rootfile.Path);
        }
        catch (err) {
            debug(err);
            return Promise.reject(err);
        }
        const opfZipStream = opfZipStream_.stream;
        let opfZipData;
        try {
            opfZipData = yield BufferUtils_1.streamToBufferPromise(opfZipStream);
        }
        catch (err) {
            debug(err);
            return Promise.reject(err);
        }
        const opfStr = opfZipData.toString("utf8");
        const opfDoc = new xmldom.DOMParser().parseFromString(opfStr);
        const opf = xml_js_mapper_1.XML.deserialize(opfDoc, opf_1.OPF);
        opf.ZipPath = rootfile.Path;
        let ncx;
        if (opf.Spine.Toc) {
            const ncxManItem = opf.Manifest.find((manifestItem) => {
                return manifestItem.ID === opf.Spine.Toc;
            });
            if (ncxManItem) {
                const ncxFilePath = path.join(path.dirname(opf.ZipPath), ncxManItem.Href)
                    .replace(/\\/g, "/");
                let ncxZipStream_;
                try {
                    ncxZipStream_ = yield zip.entryStreamPromise(ncxFilePath);
                }
                catch (err) {
                    debug(err);
                    return Promise.reject(err);
                }
                const ncxZipStream = ncxZipStream_.stream;
                let ncxZipData;
                try {
                    ncxZipData = yield BufferUtils_1.streamToBufferPromise(ncxZipStream);
                }
                catch (err) {
                    debug(err);
                    return Promise.reject(err);
                }
                const ncxStr = ncxZipData.toString("utf8");
                const ncxDoc = new xmldom.DOMParser().parseFromString(ncxStr);
                ncx = xml_js_mapper_1.XML.deserialize(ncxDoc, ncx_1.NCX);
                ncx.ZipPath = ncxFilePath;
            }
        }
        addTitle(publication, rootfile, opf);
        addIdentifier(publication, rootfile, opf);
        if (opf.Metadata) {
            if (opf.Metadata.Language) {
                publication.Metadata.Language = opf.Metadata.Language;
            }
            if (opf.Metadata.Rights && opf.Metadata.Rights.length) {
                publication.Metadata.Rights = opf.Metadata.Rights.join(" ");
            }
            if (opf.Metadata.Description && opf.Metadata.Description.length) {
                publication.Metadata.Description = opf.Metadata.Description[0];
            }
            if (opf.Metadata.Publisher && opf.Metadata.Publisher.length) {
                publication.Metadata.Publisher = [];
                opf.Metadata.Publisher.forEach((pub) => {
                    const contrib = new metadata_contributor_1.Contributor();
                    contrib.Name = pub;
                    publication.Metadata.Publisher.push(contrib);
                });
            }
            if (opf.Metadata.Source && opf.Metadata.Source.length) {
                publication.Metadata.Source = opf.Metadata.Source[0];
            }
            if (opf.Metadata.Contributor && opf.Metadata.Contributor.length) {
                opf.Metadata.Contributor.forEach((cont) => {
                    addContributor(publication, rootfile, opf, cont, undefined);
                });
            }
            if (opf.Metadata.Creator && opf.Metadata.Creator.length) {
                opf.Metadata.Creator.forEach((cont) => {
                    addContributor(publication, rootfile, opf, cont, "aut");
                });
            }
            if (opf.Metadata.Meta) {
                const metasDuration = [];
                const metasNarrator = [];
                const metasActiveClass = [];
                const metasPlaybackActiveClass = [];
                opf.Metadata.Meta.forEach((metaTag) => {
                    if (metaTag.Property === "media:duration") {
                        metasDuration.push(metaTag);
                    }
                    if (metaTag.Property === "media:narrator") {
                        metasNarrator.push(metaTag);
                    }
                    if (metaTag.Property === "media:active-class") {
                        metasActiveClass.push(metaTag);
                    }
                    if (metaTag.Property === "media:playback-active-class") {
                        metasPlaybackActiveClass.push(metaTag);
                    }
                });
                if (metasDuration.length) {
                    publication.Metadata.Duration = media_overlay_1.timeStrToSeconds(metasDuration[0].Data);
                }
                if (metasNarrator.length) {
                    if (!publication.Metadata.Narrator) {
                        publication.Metadata.Narrator = [];
                    }
                    metasNarrator.forEach((metaNarrator) => {
                        const cont = new metadata_contributor_1.Contributor();
                        cont.Name = metaNarrator.Data;
                        publication.Metadata.Narrator.push(cont);
                    });
                }
                if (metasActiveClass.length) {
                    if (!publication.Metadata.MediaOverlay) {
                        publication.Metadata.MediaOverlay = new metadata_media_overlay_1.MediaOverlay();
                    }
                    publication.Metadata.MediaOverlay.ActiveClass = metasActiveClass[0].Data;
                }
                if (metasPlaybackActiveClass.length) {
                    if (!publication.Metadata.MediaOverlay) {
                        publication.Metadata.MediaOverlay = new metadata_media_overlay_1.MediaOverlay();
                    }
                    publication.Metadata.MediaOverlay.PlaybackActiveClass = metasPlaybackActiveClass[0].Data;
                }
            }
        }
        if (opf.Spine && opf.Spine.PageProgression) {
            publication.Metadata.Direction = opf.Spine.PageProgression;
        }
        if (isEpub3OrMore(rootfile, opf)) {
            findContributorInMeta(publication, rootfile, opf);
        }
        yield fillSpineAndResource(publication, rootfile, opf);
        addRendition(publication, rootfile, opf);
        yield addCoverRel(publication, rootfile, opf);
        if (encryption) {
            fillEncryptionInfo(publication, rootfile, opf, encryption, lcpl);
        }
        yield fillTOCFromNavDoc(publication, rootfile, opf, zip);
        if (!publication.TOC || !publication.TOC.length) {
            if (ncx) {
                fillTOCFromNCX(publication, rootfile, opf, ncx);
                fillPageListFromNCX(publication, rootfile, opf, ncx);
            }
            fillLandmarksFromGuide(publication, rootfile, opf);
        }
        fillCalibreSerieInfo(publication, rootfile, opf);
        fillSubject(publication, rootfile, opf);
        fillPublicationDate(publication, rootfile, opf);
        yield fillMediaOverlay(publication, rootfile, opf, zip);
        return publication;
    });
}
exports.EpubParsePromise = EpubParsePromise;
function getAllMediaOverlays(publication) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const mos = [];
        if (publication.Spine) {
            for (const link of publication.Spine) {
                if (link.MediaOverlays) {
                    for (const mo of link.MediaOverlays) {
                        try {
                            yield fillMediaOverlayParse(publication, mo);
                        }
                        catch (err) {
                            return Promise.reject(err);
                        }
                        mos.push(mo);
                    }
                }
            }
        }
        return Promise.resolve(mos);
    });
}
exports.getAllMediaOverlays = getAllMediaOverlays;
function getMediaOverlay(publication, spineHref) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const mos = [];
        if (publication.Spine) {
            for (const link of publication.Spine) {
                if (link.MediaOverlays && link.Href.indexOf(spineHref) >= 0) {
                    for (const mo of link.MediaOverlays) {
                        try {
                            yield fillMediaOverlayParse(publication, mo);
                        }
                        catch (err) {
                            return Promise.reject(err);
                        }
                        mos.push(mo);
                    }
                }
            }
        }
        return Promise.resolve(mos);
    });
}
exports.getMediaOverlay = getMediaOverlay;
const fillMediaOverlayParse = (publication, mo) => tslib_1.__awaiter(this, void 0, void 0, function* () {
    if (mo.initialized || !mo.SmilPathInZip) {
        return;
    }
    let link;
    if (publication.Resources) {
        const relativePath = mo.SmilPathInZip;
        if (publication.Resources) {
            link = publication.Resources.find((l) => {
                if (l.Href === relativePath) {
                    return true;
                }
                return false;
            });
        }
        if (!link) {
            if (publication.Spine) {
                link = publication.Spine.find((l) => {
                    if (l.Href === relativePath) {
                        return true;
                    }
                    return false;
                });
            }
        }
        if (!link) {
            const err = "Asset not declared in publication spine/resources! " + relativePath;
            debug(err);
            return Promise.reject(err);
        }
    }
    const zipInternal = publication.findFromInternal("zip");
    if (!zipInternal) {
        return;
    }
    const zip = zipInternal.Value;
    let smilZipStream_;
    try {
        smilZipStream_ = yield zip.entryStreamPromise(mo.SmilPathInZip);
    }
    catch (err) {
        debug(err);
        return Promise.reject(err);
    }
    if (link && link.Properties && link.Properties.Encrypted) {
        let decryptFail = false;
        let transformedStream;
        try {
            transformedStream = yield transformer_1.Transformers.tryStream(publication, link, smilZipStream_, false, 0, 0);
        }
        catch (err) {
            debug(err);
            return Promise.reject(err);
        }
        if (transformedStream) {
            smilZipStream_ = transformedStream;
        }
        else {
            decryptFail = true;
        }
        if (decryptFail) {
            const err = "Encryption scheme not supported.";
            debug(err);
            return Promise.reject(err);
        }
    }
    const smilZipStream = smilZipStream_.stream;
    let smilZipData;
    try {
        smilZipData = yield BufferUtils_1.streamToBufferPromise(smilZipStream);
    }
    catch (err) {
        debug(err);
        return Promise.reject(err);
    }
    const smilStr = smilZipData.toString("utf8");
    const smilXmlDoc = new xmldom.DOMParser().parseFromString(smilStr);
    const smil = xml_js_mapper_1.XML.deserialize(smilXmlDoc, smil_1.SMIL);
    smil.ZipPath = mo.SmilPathInZip;
    mo.initialized = true;
    debug("PARSED SMIL: " + mo.SmilPathInZip);
    mo.Role = [];
    mo.Role.push("section");
    if (smil.Body) {
        if (smil.Body.EpubType) {
            smil.Body.EpubType.trim().split(" ").forEach((role) => {
                if (!role.length) {
                    return;
                }
                if (mo.Role.indexOf(role) < 0) {
                    mo.Role.push(role);
                }
            });
        }
        if (smil.Body.TextRef) {
            const zipPath = path.join(path.dirname(smil.ZipPath), smil.Body.TextRef)
                .replace(/\\/g, "/");
            mo.Text = zipPath;
        }
        if (smil.Body.Children && smil.Body.Children.length) {
            smil.Body.Children.forEach((seqChild) => {
                if (!mo.Children) {
                    mo.Children = [];
                }
                addSeqToMediaOverlay(smil, publication, mo, mo.Children, seqChild);
            });
        }
    }
    return;
});
const fillMediaOverlay = (publication, rootfile, opf, zip) => tslib_1.__awaiter(this, void 0, void 0, function* () {
    if (!publication.Resources) {
        return;
    }
    for (const item of publication.Resources) {
        if (item.TypeLink !== "application/smil+xml") {
            continue;
        }
        let has = zip.hasEntry(item.Href);
        if (zip.hasEntryAsync) {
            try {
                has = yield zip.hasEntryAsync(item.Href);
            }
            catch (err) {
                console.log(err);
            }
        }
        if (!has) {
            continue;
        }
        const manItemsHtmlWithSmil = [];
        opf.Manifest.forEach((manItemHtmlWithSmil) => {
            if (manItemHtmlWithSmil.MediaOverlay) {
                const manItemSmil = opf.Manifest.find((mi) => {
                    if (mi.ID === manItemHtmlWithSmil.MediaOverlay) {
                        return true;
                    }
                    return false;
                });
                if (manItemSmil && opf.ZipPath) {
                    const smilFilePath2 = path.join(path.dirname(opf.ZipPath), manItemSmil.Href)
                        .replace(/\\/g, "/");
                    if (smilFilePath2 === item.Href) {
                        manItemsHtmlWithSmil.push(manItemHtmlWithSmil);
                    }
                }
            }
        });
        const mo = new media_overlay_1.MediaOverlayNode();
        mo.SmilPathInZip = item.Href;
        mo.initialized = false;
        manItemsHtmlWithSmil.forEach((manItemHtmlWithSmil) => {
            if (!opf.ZipPath) {
                return;
            }
            const htmlPathInZip = path.join(path.dirname(opf.ZipPath), manItemHtmlWithSmil.Href)
                .replace(/\\/g, "/");
            const link = findLinKByHref(publication, rootfile, opf, htmlPathInZip);
            if (link) {
                if (!link.MediaOverlays) {
                    link.MediaOverlays = [];
                }
                const alreadyExists = link.MediaOverlays.find((moo) => {
                    if (item.Href === moo.SmilPathInZip) {
                        return true;
                    }
                    return false;
                });
                if (!alreadyExists) {
                    link.MediaOverlays.push(mo);
                }
                if (!link.Properties) {
                    link.Properties = new metadata_properties_1.Properties();
                }
                link.Properties.MediaOverlay = exports.mediaOverlayURLPath + "?" +
                    exports.mediaOverlayURLParam + "=" + querystring.escape(link.Href);
            }
        });
        if (item.Properties && item.Properties.Encrypted) {
            debug("ENCRYPTED SMIL MEDIA OVERLAY: " + item.Href);
            continue;
        }
    }
    return;
});
const addSeqToMediaOverlay = (smil, publication, rootMO, mo, seqChild) => {
    if (!smil.ZipPath) {
        return;
    }
    const moc = new media_overlay_1.MediaOverlayNode();
    moc.initialized = rootMO.initialized;
    mo.push(moc);
    if (seqChild instanceof smil_seq_1.Seq) {
        moc.Role = [];
        moc.Role.push("section");
        const seq = seqChild;
        if (seq.EpubType) {
            seq.EpubType.trim().split(" ").forEach((role) => {
                if (!role.length) {
                    return;
                }
                if (moc.Role.indexOf(role) < 0) {
                    moc.Role.push(role);
                }
            });
        }
        if (seq.TextRef) {
            const zipPath = path.join(path.dirname(smil.ZipPath), seq.TextRef)
                .replace(/\\/g, "/");
            moc.Text = zipPath;
        }
        if (seq.Children && seq.Children.length) {
            seq.Children.forEach((child) => {
                if (!moc.Children) {
                    moc.Children = [];
                }
                addSeqToMediaOverlay(smil, publication, rootMO, moc.Children, child);
            });
        }
    }
    else {
        const par = seqChild;
        if (par.EpubType) {
            par.EpubType.trim().split(" ").forEach((role) => {
                if (!role.length) {
                    return;
                }
                if (!moc.Role) {
                    moc.Role = [];
                }
                if (moc.Role.indexOf(role) < 0) {
                    moc.Role.push(role);
                }
            });
        }
        if (par.Text && par.Text.Src) {
            const zipPath = path.join(path.dirname(smil.ZipPath), par.Text.Src)
                .replace(/\\/g, "/");
            moc.Text = zipPath;
        }
        if (par.Audio && par.Audio.Src) {
            const zipPath = path.join(path.dirname(smil.ZipPath), par.Audio.Src)
                .replace(/\\/g, "/");
            moc.Audio = zipPath;
            moc.Audio += "#t=";
            moc.Audio += par.Audio.ClipBegin ? media_overlay_1.timeStrToSeconds(par.Audio.ClipBegin) : "0";
            if (par.Audio.ClipEnd) {
                moc.Audio += ",";
                moc.Audio += media_overlay_1.timeStrToSeconds(par.Audio.ClipEnd);
            }
        }
    }
};
const fillPublicationDate = (publication, rootfile, opf) => {
    if (opf.Metadata && opf.Metadata.Date && opf.Metadata.Date.length) {
        if (isEpub3OrMore(rootfile, opf) && opf.Metadata.Date[0] && opf.Metadata.Date[0].Data) {
            const token = opf.Metadata.Date[0].Data;
            try {
                const mom = moment(token);
                if (mom.isValid()) {
                    publication.Metadata.PublicationDate = mom.toDate();
                }
            }
            catch (err) {
                console.log("INVALID DATE/TIME? " + token);
            }
            return;
        }
        opf.Metadata.Date.forEach((date) => {
            if (date.Data && date.Event && date.Event.indexOf("publication") >= 0) {
                const token = date.Data;
                try {
                    const mom = moment(token);
                    if (mom.isValid()) {
                        publication.Metadata.PublicationDate = mom.toDate();
                    }
                }
                catch (err) {
                    console.log("INVALID DATE/TIME? " + token);
                }
            }
        });
    }
};
const findContributorInMeta = (publication, rootfile, opf) => {
    if (opf.Metadata && opf.Metadata.Meta) {
        opf.Metadata.Meta.forEach((meta) => {
            if (meta.Property === "dcterms:creator" || meta.Property === "dcterms:contributor") {
                const cont = new opf_author_1.Author();
                cont.Data = meta.Data;
                cont.ID = meta.ID;
                addContributor(publication, rootfile, opf, cont, undefined);
            }
        });
    }
};
const addContributor = (publication, rootfile, opf, cont, forcedRole) => {
    const contributor = new metadata_contributor_1.Contributor();
    let role;
    if (isEpub3OrMore(rootfile, opf)) {
        const meta = findMetaByRefineAndProperty(rootfile, opf, cont.ID, "role");
        if (meta && meta.Property === "role") {
            role = meta.Data;
        }
        if (!role && forcedRole) {
            role = forcedRole;
        }
        const metaAlt = findAllMetaByRefineAndProperty(rootfile, opf, cont.ID, "alternate-script");
        if (metaAlt && metaAlt.length) {
            contributor.Name = {};
            if (publication.Metadata &&
                publication.Metadata.Language &&
                publication.Metadata.Language.length) {
                contributor.Name[publication.Metadata.Language[0].toLowerCase()] = cont.Data;
            }
            metaAlt.forEach((m) => {
                if (m.Lang) {
                    contributor.Name[m.Lang] = m.Data;
                }
            });
        }
        else {
            contributor.Name = cont.Data;
        }
    }
    else {
        contributor.Name = cont.Data;
        role = cont.Role;
        if (!role && forcedRole) {
            role = forcedRole;
        }
    }
    if (role) {
        switch (role) {
            case "aut": {
                if (!publication.Metadata.Author) {
                    publication.Metadata.Author = [];
                }
                publication.Metadata.Author.push(contributor);
                break;
            }
            case "trl": {
                if (!publication.Metadata.Translator) {
                    publication.Metadata.Translator = [];
                }
                publication.Metadata.Translator.push(contributor);
                break;
            }
            case "art": {
                if (!publication.Metadata.Artist) {
                    publication.Metadata.Artist = [];
                }
                publication.Metadata.Artist.push(contributor);
                break;
            }
            case "edt": {
                if (!publication.Metadata.Editor) {
                    publication.Metadata.Editor = [];
                }
                publication.Metadata.Editor.push(contributor);
                break;
            }
            case "ill": {
                if (!publication.Metadata.Illustrator) {
                    publication.Metadata.Illustrator = [];
                }
                publication.Metadata.Illustrator.push(contributor);
                break;
            }
            case "ltr": {
                if (!publication.Metadata.Letterer) {
                    publication.Metadata.Letterer = [];
                }
                publication.Metadata.Letterer.push(contributor);
                break;
            }
            case "pen": {
                if (!publication.Metadata.Penciler) {
                    publication.Metadata.Penciler = [];
                }
                publication.Metadata.Penciler.push(contributor);
                break;
            }
            case "clr": {
                if (!publication.Metadata.Colorist) {
                    publication.Metadata.Colorist = [];
                }
                publication.Metadata.Colorist.push(contributor);
                break;
            }
            case "ink": {
                if (!publication.Metadata.Inker) {
                    publication.Metadata.Inker = [];
                }
                publication.Metadata.Inker.push(contributor);
                break;
            }
            case "nrt": {
                if (!publication.Metadata.Narrator) {
                    publication.Metadata.Narrator = [];
                }
                publication.Metadata.Narrator.push(contributor);
                break;
            }
            case "pbl": {
                if (!publication.Metadata.Publisher) {
                    publication.Metadata.Publisher = [];
                }
                publication.Metadata.Publisher.push(contributor);
                break;
            }
            default: {
                contributor.Role = [role];
                if (!publication.Metadata.Contributor) {
                    publication.Metadata.Contributor = [];
                }
                publication.Metadata.Contributor.push(contributor);
            }
        }
    }
};
const addIdentifier = (publication, _rootfile, opf) => {
    if (opf.Metadata && opf.Metadata.Identifier) {
        if (opf.UniqueIdentifier && opf.Metadata.Identifier.length > 1) {
            opf.Metadata.Identifier.forEach((iden) => {
                if (iden.ID === opf.UniqueIdentifier) {
                    publication.Metadata.Identifier = iden.Data;
                }
            });
        }
        else if (opf.Metadata.Identifier.length > 0) {
            publication.Metadata.Identifier = opf.Metadata.Identifier[0].Data;
        }
    }
};
const addTitle = (publication, rootfile, opf) => {
    if (isEpub3OrMore(rootfile, opf)) {
        let mainTitle;
        if (opf.Metadata &&
            opf.Metadata.Title &&
            opf.Metadata.Title.length) {
            if (opf.Metadata.Meta) {
                const tt = opf.Metadata.Title.find((title) => {
                    const refineID = "#" + title.ID;
                    const m = opf.Metadata.Meta.find((meta) => {
                        if (meta.Data === "main" && meta.Refine === refineID) {
                            return true;
                        }
                        return false;
                    });
                    if (m) {
                        return true;
                    }
                    return false;
                });
                if (tt) {
                    mainTitle = tt;
                }
            }
            if (!mainTitle) {
                mainTitle = opf.Metadata.Title[0];
            }
        }
        if (mainTitle) {
            const metaAlt = findAllMetaByRefineAndProperty(rootfile, opf, mainTitle.ID, "alternate-script");
            if (metaAlt && metaAlt.length) {
                publication.Metadata.Title = {};
                if (mainTitle.Lang) {
                    publication.Metadata.Title[mainTitle.Lang.toLowerCase()] = mainTitle.Data;
                }
                metaAlt.forEach((m) => {
                    if (m.Lang) {
                        publication.Metadata.Title[m.Lang.toLowerCase()] = m.Data;
                    }
                });
            }
            else {
                publication.Metadata.Title = mainTitle.Data;
            }
        }
    }
    else {
        if (opf.Metadata &&
            opf.Metadata.Title &&
            opf.Metadata.Title.length) {
            publication.Metadata.Title = opf.Metadata.Title[0].Data;
        }
    }
};
const addRelAndPropertiesToLink = (publication, link, linkEpub, rootfile, opf) => tslib_1.__awaiter(this, void 0, void 0, function* () {
    if (linkEpub.Properties) {
        yield addToLinkFromProperties(publication, link, linkEpub.Properties);
    }
    const spineProperties = findPropertiesInSpineForManifest(linkEpub, rootfile, opf);
    if (spineProperties) {
        yield addToLinkFromProperties(publication, link, spineProperties);
    }
});
const addToLinkFromProperties = (publication, link, propertiesString) => tslib_1.__awaiter(this, void 0, void 0, function* () {
    const properties = propertiesString.trim().split(" ");
    const propertiesStruct = new metadata_properties_1.Properties();
    for (const p of properties) {
        switch (p) {
            case "cover-image": {
                link.AddRel("cover");
                yield exports.addCoverDimensions(publication, link);
                break;
            }
            case "nav": {
                link.AddRel("contents");
                break;
            }
            case "scripted": {
                if (!propertiesStruct.Contains) {
                    propertiesStruct.Contains = [];
                }
                propertiesStruct.Contains.push("js");
                break;
            }
            case "mathml": {
                if (!propertiesStruct.Contains) {
                    propertiesStruct.Contains = [];
                }
                propertiesStruct.Contains.push("mathml");
                break;
            }
            case "onix-record": {
                if (!propertiesStruct.Contains) {
                    propertiesStruct.Contains = [];
                }
                propertiesStruct.Contains.push("onix");
                break;
            }
            case "svg": {
                if (!propertiesStruct.Contains) {
                    propertiesStruct.Contains = [];
                }
                propertiesStruct.Contains.push("svg");
                break;
            }
            case "xmp-record": {
                if (!propertiesStruct.Contains) {
                    propertiesStruct.Contains = [];
                }
                propertiesStruct.Contains.push("xmp");
                break;
            }
            case "remote-resources": {
                if (!propertiesStruct.Contains) {
                    propertiesStruct.Contains = [];
                }
                propertiesStruct.Contains.push("remote-resources");
                break;
            }
            case "page-spread-left": {
                propertiesStruct.Page = "left";
                break;
            }
            case "page-spread-right": {
                propertiesStruct.Page = "right";
                break;
            }
            case "page-spread-center": {
                propertiesStruct.Page = "center";
                break;
            }
            case "rendition:spread-none": {
                propertiesStruct.Spread = noneMeta;
                break;
            }
            case "rendition:spread-auto": {
                propertiesStruct.Spread = autoMeta;
                break;
            }
            case "rendition:spread-landscape": {
                propertiesStruct.Spread = "landscape";
                break;
            }
            case "rendition:spread-portrait": {
                propertiesStruct.Spread = "both";
                break;
            }
            case "rendition:spread-both": {
                propertiesStruct.Spread = "both";
                break;
            }
            case "rendition:layout-reflowable": {
                propertiesStruct.Layout = reflowableMeta;
                break;
            }
            case "rendition:layout-pre-paginated": {
                propertiesStruct.Layout = "fixed";
                break;
            }
            case "rendition:orientation-auto": {
                propertiesStruct.Orientation = "auto";
                break;
            }
            case "rendition:orientation-landscape": {
                propertiesStruct.Orientation = "landscape";
                break;
            }
            case "rendition:orientation-portrait": {
                propertiesStruct.Orientation = "portrait";
                break;
            }
            case "rendition:flow-auto": {
                propertiesStruct.Overflow = autoMeta;
                break;
            }
            case "rendition:flow-paginated": {
                propertiesStruct.Overflow = "paginated";
                break;
            }
            case "rendition:flow-scrolled-continuous": {
                propertiesStruct.Overflow = "scrolled-continuous";
                break;
            }
            case "rendition:flow-scrolled-doc": {
                propertiesStruct.Overflow = "scrolled";
                break;
            }
            default: {
                break;
            }
        }
        if (propertiesStruct.Layout ||
            propertiesStruct.Orientation ||
            propertiesStruct.Overflow ||
            propertiesStruct.Page ||
            propertiesStruct.Spread ||
            (propertiesStruct.Contains && propertiesStruct.Contains.length)) {
            link.Properties = propertiesStruct;
        }
    }
});
const addMediaOverlay = (link, linkEpub, rootfile, opf) => {
    if (linkEpub.MediaOverlay) {
        const meta = findMetaByRefineAndProperty(rootfile, opf, linkEpub.MediaOverlay, "media:duration");
        if (meta) {
            link.Duration = media_overlay_1.timeStrToSeconds(meta.Data);
        }
    }
};
const findInManifestByID = (publication, rootfile, opf, ID) => tslib_1.__awaiter(this, void 0, void 0, function* () {
    if (opf.Manifest && opf.Manifest.length) {
        const item = opf.Manifest.find((manItem) => {
            if (manItem.ID === ID) {
                return true;
            }
            return false;
        });
        if (item && opf.ZipPath) {
            const linkItem = new publication_link_1.Link();
            linkItem.TypeLink = item.MediaType;
            const zipPath = path.join(path.dirname(opf.ZipPath), item.Href)
                .replace(/\\/g, "/");
            linkItem.Href = zipPath;
            yield addRelAndPropertiesToLink(publication, linkItem, item, rootfile, opf);
            addMediaOverlay(linkItem, item, rootfile, opf);
            return linkItem;
        }
    }
    return Promise.reject(`ID ${ID} not found`);
});
const addRendition = (publication, _rootfile, opf) => {
    if (opf.Metadata && opf.Metadata.Meta && opf.Metadata.Meta.length) {
        const rendition = new metadata_properties_1.Properties();
        opf.Metadata.Meta.forEach((meta) => {
            switch (meta.Property) {
                case "rendition:layout": {
                    if (meta.Data === "pre-paginated") {
                        rendition.Layout = "fixed";
                    }
                    else if (meta.Data === "reflowable") {
                        rendition.Layout = "reflowable";
                    }
                    break;
                }
                case "rendition:orientation": {
                    rendition.Orientation = meta.Data;
                    break;
                }
                case "rendition:spread": {
                    rendition.Spread = meta.Data;
                    if (rendition.Spread === "portrait") {
                        rendition.Spread = "both";
                    }
                    break;
                }
                case "rendition:flow": {
                    rendition.Overflow = meta.Data;
                    break;
                }
                default: {
                    break;
                }
            }
        });
        if (rendition.Layout || rendition.Orientation || rendition.Overflow || rendition.Page || rendition.Spread) {
            publication.Metadata.Rendition = rendition;
        }
    }
};
const fillSpineAndResource = (publication, rootfile, opf) => tslib_1.__awaiter(this, void 0, void 0, function* () {
    if (!opf.ZipPath) {
        return;
    }
    if (opf.Spine && opf.Spine.Items && opf.Spine.Items.length) {
        for (const item of opf.Spine.Items) {
            if (!item.Linear || item.Linear === "yes") {
                let linkItem;
                try {
                    linkItem = yield findInManifestByID(publication, rootfile, opf, item.IDref);
                }
                catch (err) {
                    debug(err);
                    continue;
                }
                if (linkItem && linkItem.Href) {
                    if (!publication.Spine) {
                        publication.Spine = [];
                    }
                    publication.Spine.push(linkItem);
                }
            }
        }
    }
    if (opf.Manifest && opf.Manifest.length) {
        for (const item of opf.Manifest) {
            const zipPath = path.join(path.dirname(opf.ZipPath), item.Href)
                .replace(/\\/g, "/");
            const linkSpine = findInSpineByHref(publication, zipPath);
            if (!linkSpine || !linkSpine.Href) {
                const linkItem = new publication_link_1.Link();
                linkItem.TypeLink = item.MediaType;
                linkItem.Href = zipPath;
                yield addRelAndPropertiesToLink(publication, linkItem, item, rootfile, opf);
                addMediaOverlay(linkItem, item, rootfile, opf);
                if (!publication.Resources) {
                    publication.Resources = [];
                }
                publication.Resources.push(linkItem);
            }
        }
    }
});
const fillEncryptionInfo = (publication, _rootfile, _opf, encryption, lcp) => {
    encryption.EncryptedData.forEach((encInfo) => {
        const encrypted = new metadata_encrypted_1.Encrypted();
        encrypted.Algorithm = encInfo.EncryptionMethod.Algorithm;
        if (lcp &&
            encrypted.Algorithm !== "http://www.idpf.org/2008/embedding" &&
            encrypted.Algorithm !== "http://ns.adobe.com/pdf/enc#RC") {
            encrypted.Profile = lcp.Encryption.Profile;
            encrypted.Scheme = "http://readium.org/2014/01/lcp";
        }
        if (encInfo.EncryptionProperties && encInfo.EncryptionProperties.length) {
            encInfo.EncryptionProperties.forEach((prop) => {
                if (prop.Compression) {
                    if (prop.Compression.OriginalLength) {
                        encrypted.OriginalLength = parseFloat(prop.Compression.OriginalLength);
                    }
                    if (prop.Compression.Method === "8") {
                        encrypted.Compression = "deflate";
                    }
                    else {
                        encrypted.Compression = "none";
                    }
                }
            });
        }
        publication.Resources.forEach((l, _i, _arr) => {
            const filePath = l.Href;
            if (filePath === encInfo.CipherData.CipherReference.URI) {
                if (!l.Properties) {
                    l.Properties = new metadata_properties_1.Properties();
                }
                l.Properties.Encrypted = encrypted;
            }
        });
        if (publication.Spine) {
            publication.Spine.forEach((l, _i, _arr) => {
                const filePath = l.Href;
                if (filePath === encInfo.CipherData.CipherReference.URI) {
                    if (!l.Properties) {
                        l.Properties = new metadata_properties_1.Properties();
                    }
                    l.Properties.Encrypted = encrypted;
                }
            });
        }
    });
};
const fillPageListFromNCX = (publication, _rootfile, _opf, ncx) => {
    if (ncx.PageList && ncx.PageList.PageTarget && ncx.PageList.PageTarget.length) {
        ncx.PageList.PageTarget.forEach((pageTarget) => {
            const link = new publication_link_1.Link();
            const zipPath = path.join(path.dirname(ncx.ZipPath), pageTarget.Content.Src)
                .replace(/\\/g, "/");
            link.Href = zipPath;
            link.Title = pageTarget.Text;
            if (!publication.PageList) {
                publication.PageList = [];
            }
            publication.PageList.push(link);
        });
    }
};
const fillTOCFromNCX = (publication, rootfile, opf, ncx) => {
    if (ncx.Points && ncx.Points.length) {
        ncx.Points.forEach((point) => {
            if (!publication.TOC) {
                publication.TOC = [];
            }
            fillTOCFromNavPoint(publication, rootfile, opf, ncx, point, publication.TOC);
        });
    }
};
const fillLandmarksFromGuide = (publication, _rootfile, opf) => {
    if (opf.Guide && opf.Guide.length) {
        opf.Guide.forEach((ref) => {
            if (ref.Href && opf.ZipPath) {
                const link = new publication_link_1.Link();
                const zipPath = path.join(path.dirname(opf.ZipPath), ref.Href)
                    .replace(/\\/g, "/");
                link.Href = zipPath;
                link.Title = ref.Title;
                if (!publication.Landmarks) {
                    publication.Landmarks = [];
                }
                publication.Landmarks.push(link);
            }
        });
    }
};
const fillTOCFromNavPoint = (publication, rootfile, opf, ncx, point, node) => {
    const link = new publication_link_1.Link();
    const zipPath = path.join(path.dirname(ncx.ZipPath), point.Content.Src)
        .replace(/\\/g, "/");
    link.Href = zipPath;
    link.Title = point.Text;
    if (point.Points && point.Points.length) {
        point.Points.forEach((p) => {
            if (!link.Children) {
                link.Children = [];
            }
            fillTOCFromNavPoint(publication, rootfile, opf, ncx, p, link.Children);
        });
    }
    node.push(link);
};
const fillSubject = (publication, _rootfile, opf) => {
    if (opf.Metadata && opf.Metadata.Subject && opf.Metadata.Subject.length) {
        opf.Metadata.Subject.forEach((s) => {
            const sub = new metadata_subject_1.Subject();
            sub.Name = s.Data;
            sub.Code = s.Term;
            sub.Scheme = s.Authority;
            if (!publication.Metadata.Subject) {
                publication.Metadata.Subject = [];
            }
            publication.Metadata.Subject.push(sub);
        });
    }
};
const fillCalibreSerieInfo = (publication, _rootfile, opf) => {
    let serie;
    let seriePosition;
    if (opf.Metadata && opf.Metadata.Meta && opf.Metadata.Meta.length) {
        opf.Metadata.Meta.forEach((m) => {
            if (m.Name === "calibre:series") {
                serie = m.Content;
            }
            if (m.Name === "calibre:series_index") {
                seriePosition = parseFloat(m.Content);
            }
        });
    }
    if (serie) {
        const contributor = new metadata_contributor_1.Contributor();
        contributor.Name = serie;
        if (seriePosition) {
            contributor.Position = seriePosition;
        }
        if (!publication.Metadata.BelongsTo) {
            publication.Metadata.BelongsTo = new metadata_belongsto_1.BelongsTo();
        }
        if (!publication.Metadata.BelongsTo.Series) {
            publication.Metadata.BelongsTo.Series = [];
        }
        publication.Metadata.BelongsTo.Series.push(contributor);
    }
};
const fillTOCFromNavDoc = (publication, _rootfile, _opf, zip) => tslib_1.__awaiter(this, void 0, void 0, function* () {
    const navLink = publication.GetNavDoc();
    if (!navLink) {
        return;
    }
    const navDocFilePath = navLink.Href;
    let has = zip.hasEntry(navDocFilePath);
    if (zip.hasEntryAsync) {
        try {
            has = yield zip.hasEntryAsync(navDocFilePath);
        }
        catch (err) {
            console.log(err);
        }
    }
    if (!has) {
        return;
    }
    let navDocZipStream_;
    try {
        navDocZipStream_ = yield zip.entryStreamPromise(navDocFilePath);
    }
    catch (err) {
        debug(err);
        return Promise.reject(err);
    }
    const navDocZipStream = navDocZipStream_.stream;
    let navDocZipData;
    try {
        navDocZipData = yield BufferUtils_1.streamToBufferPromise(navDocZipStream);
    }
    catch (err) {
        debug(err);
        return Promise.reject(err);
    }
    const navDocStr = navDocZipData.toString("utf8");
    const navXmlDoc = new xmldom.DOMParser().parseFromString(navDocStr);
    const select = xpath.useNamespaces({
        epub: "http://www.idpf.org/2007/ops",
        xhtml: "http://www.w3.org/1999/xhtml",
    });
    const navs = select("/xhtml:html/xhtml:body//xhtml:nav", navXmlDoc);
    if (navs && navs.length) {
        navs.forEach((navElement) => {
            const typeNav = select("@epub:type", navElement);
            if (typeNav && typeNav.length) {
                const olElem = select("xhtml:ol", navElement);
                const roles = typeNav[0].value;
                const role = roles.trim().split(" ")[0];
                switch (role) {
                    case "toc": {
                        publication.TOC = [];
                        fillTOCFromNavDocWithOL(select, olElem, publication.TOC, navLink.Href);
                        break;
                    }
                    case "page-list": {
                        publication.PageList = [];
                        fillTOCFromNavDocWithOL(select, olElem, publication.PageList, navLink.Href);
                        break;
                    }
                    case "landmarks": {
                        publication.Landmarks = [];
                        fillTOCFromNavDocWithOL(select, olElem, publication.Landmarks, navLink.Href);
                        break;
                    }
                    case "lot": {
                        publication.LOT = [];
                        fillTOCFromNavDocWithOL(select, olElem, publication.LOT, navLink.Href);
                        break;
                    }
                    case "loa": {
                        publication.LOA = [];
                        fillTOCFromNavDocWithOL(select, olElem, publication.LOA, navLink.Href);
                        break;
                    }
                    case "loi": {
                        publication.LOI = [];
                        fillTOCFromNavDocWithOL(select, olElem, publication.LOI, navLink.Href);
                        break;
                    }
                    case "lov": {
                        publication.LOV = [];
                        fillTOCFromNavDocWithOL(select, olElem, publication.LOV, navLink.Href);
                        break;
                    }
                    default: {
                        break;
                    }
                }
            }
        });
    }
});
const fillTOCFromNavDocWithOL = (select, olElems, node, navDocPath) => {
    olElems.forEach((olElem) => {
        const liElems = select("xhtml:li", olElem);
        if (liElems && liElems.length) {
            liElems.forEach((liElem) => {
                const link = new publication_link_1.Link();
                node.push(link);
                const aElems = select("xhtml:a", liElem);
                if (aElems && aElems.length > 0) {
                    const aHref = select("@href", aElems[0]);
                    if (aHref && aHref.length) {
                        let val = aHref[0].value;
                        if (val[0] === "#") {
                            val = path.basename(navDocPath) + val;
                        }
                        const zipPath = path.join(path.dirname(navDocPath), val)
                            .replace(/\\/g, "/");
                        link.Href = zipPath;
                    }
                    let aText = aElems[0].textContent;
                    if (aText && aText.length) {
                        aText = aText.trim();
                        aText = aText.replace(/\s\s+/g, " ");
                        link.Title = aText;
                    }
                }
                else {
                    const liFirstChild = select("xhtml:*[1]", liElem);
                    if (liFirstChild && liFirstChild.length && liFirstChild[0].textContent) {
                        link.Title = liFirstChild[0].textContent.trim();
                    }
                }
                const olElemsNext = select("xhtml:ol", liElem);
                if (olElemsNext && olElemsNext.length) {
                    if (!link.Children) {
                        link.Children = [];
                    }
                    fillTOCFromNavDocWithOL(select, olElemsNext, link.Children, navDocPath);
                }
            });
        }
    });
};
const addCoverRel = (publication, rootfile, opf) => tslib_1.__awaiter(this, void 0, void 0, function* () {
    let coverID;
    if (opf.Metadata && opf.Metadata.Meta && opf.Metadata.Meta.length) {
        opf.Metadata.Meta.find((meta) => {
            if (meta.Name === "cover") {
                coverID = meta.Content;
                return true;
            }
            return false;
        });
    }
    if (coverID) {
        let manifestInfo;
        try {
            manifestInfo = yield findInManifestByID(publication, rootfile, opf, coverID);
        }
        catch (err) {
            debug(err);
            return;
        }
        if (manifestInfo && manifestInfo.Href && publication.Resources && publication.Resources.length) {
            const href = manifestInfo.Href;
            const linky = publication.Resources.find((item, _i, _arr) => {
                if (item.Href === href) {
                    return true;
                }
                return false;
            });
            if (linky) {
                linky.AddRel("cover");
                yield exports.addCoverDimensions(publication, linky);
            }
        }
    }
});
const findPropertiesInSpineForManifest = (linkEpub, _rootfile, opf) => {
    if (opf.Spine && opf.Spine.Items && opf.Spine.Items.length) {
        const it = opf.Spine.Items.find((item) => {
            if (item.IDref === linkEpub.ID) {
                return true;
            }
            return false;
        });
        if (it && it.Properties) {
            return it.Properties;
        }
    }
    return undefined;
};
const findInSpineByHref = (publication, href) => {
    if (publication.Spine && publication.Spine.length) {
        const ll = publication.Spine.find((l) => {
            if (l.Href === href) {
                return true;
            }
            return false;
        });
        if (ll) {
            return ll;
        }
    }
    return undefined;
};
const findMetaByRefineAndProperty = (rootfile, opf, ID, property) => {
    const ret = findAllMetaByRefineAndProperty(rootfile, opf, ID, property);
    if (ret.length) {
        return ret[0];
    }
    return undefined;
};
const findAllMetaByRefineAndProperty = (_rootfile, opf, ID, property) => {
    const metas = [];
    const refineID = "#" + ID;
    if (opf.Metadata && opf.Metadata.Meta) {
        opf.Metadata.Meta.forEach((metaTag) => {
            if (metaTag.Refine === refineID && metaTag.Property === property) {
                metas.push(metaTag);
            }
        });
    }
    return metas;
};
const getEpubVersion = (rootfile, opf) => {
    if (rootfile.Version) {
        return rootfile.Version;
    }
    else if (opf.Version) {
        return opf.Version;
    }
    return undefined;
};
const isEpub3OrMore = (rootfile, opf) => {
    const version = getEpubVersion(rootfile, opf);
    return (version === epub3 || version === epub301 || version === epub31);
};
const findLinKByHref = (publication, _rootfile, _opf, href) => {
    if (publication.Spine && publication.Spine.length) {
        const ll = publication.Spine.find((l) => {
            const pathInZip = l.Href;
            if (href === pathInZip) {
                return true;
            }
            return false;
        });
        if (ll) {
            return ll;
        }
    }
    return undefined;
};
//# sourceMappingURL=epub.js.map