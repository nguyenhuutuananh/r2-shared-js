"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const path = require("path");
const metadata_1 = require("../models/metadata");
const metadata_contributor_1 = require("../models/metadata-contributor");
const publication_1 = require("../models/publication");
const publication_link_1 = require("../models/publication-link");
const BufferUtils_1 = require("r2-utils-js/dist/es7-es2016/src/_utils/stream/BufferUtils");
const xml_js_mapper_1 = require("r2-utils-js/dist/es7-es2016/src/_utils/xml-js-mapper");
const zipFactory_1 = require("r2-utils-js/dist/es7-es2016/src/_utils/zip/zipFactory");
const mime = require("mime-types");
const slugify = require("slugify");
const xmldom = require("xmldom");
const comicrack_1 = require("./comicrack/comicrack");
const epub_1 = require("./epub");
function CbzParsePromise(filePath) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        let zip;
        try {
            zip = yield zipFactory_1.zipLoadPromise(filePath);
        }
        catch (err) {
            return Promise.reject(err);
        }
        if (!zip.hasEntries()) {
            return Promise.reject("CBZ zip empty");
        }
        const publication = new publication_1.Publication();
        publication.Context = ["https://readium.org/webpub-manifest/context.jsonld"];
        publication.Metadata = new metadata_1.Metadata();
        publication.Metadata.RDFType = "http://schema.org/ComicIssue";
        publication.Metadata.Identifier = filePathToTitle(filePath);
        publication.AddToInternal("type", "cbz");
        publication.AddToInternal("zip", zip);
        let comicInfoEntryName;
        let entries;
        try {
            entries = yield zip.getEntries();
        }
        catch (err) {
            console.log(err);
            return Promise.reject("Problem getting CBZ zip entries");
        }
        if (entries) {
            for (const entryName of entries) {
                const link = new publication_link_1.Link();
                link.Href = entryName;
                const mediaType = mime.lookup(entryName);
                if (mediaType) {
                    link.TypeLink = mediaType;
                }
                else {
                    console.log("!!!!!! NO MEDIA TYPE?!");
                }
                if (link.TypeLink && link.TypeLink.startsWith("image/")) {
                    if (!publication.Spine) {
                        publication.Spine = [];
                    }
                    publication.Spine.push(link);
                }
                else if (entryName.endsWith("ComicInfo.xml")) {
                    comicInfoEntryName = entryName;
                }
            }
        }
        if (!publication.Metadata.Title) {
            publication.Metadata.Title = path.basename(filePath);
        }
        if (comicInfoEntryName) {
            try {
                const _b = yield comicRackMetadata(zip, comicInfoEntryName, publication);
                console.log(_b);
            }
            catch (err) {
                console.log(err);
            }
        }
        return publication;
    });
}
exports.CbzParsePromise = CbzParsePromise;
const filePathToTitle = (filePath) => {
    const fileName = path.basename(filePath);
    return slugify(fileName, "_").replace(/[\.]/g, "_");
};
const comicRackMetadata = (zip, entryName, publication) => tslib_1.__awaiter(this, void 0, void 0, function* () {
    let comicZipStream_;
    try {
        comicZipStream_ = yield zip.entryStreamPromise(entryName);
    }
    catch (err) {
        console.log(err);
        return;
    }
    const comicZipStream = comicZipStream_.stream;
    let comicZipData;
    try {
        comicZipData = yield BufferUtils_1.streamToBufferPromise(comicZipStream);
    }
    catch (err) {
        console.log(err);
        return;
    }
    const comicXmlStr = comicZipData.toString("utf8");
    const comicXmlDoc = new xmldom.DOMParser().parseFromString(comicXmlStr);
    const comicMeta = xml_js_mapper_1.XML.deserialize(comicXmlDoc, comicrack_1.ComicInfo);
    comicMeta.ZipPath = entryName;
    if (!publication.Metadata) {
        publication.Metadata = new metadata_1.Metadata();
    }
    if (comicMeta.Writer) {
        const cont = new metadata_contributor_1.Contributor();
        cont.Name = comicMeta.Writer;
        if (!publication.Metadata.Author) {
            publication.Metadata.Author = [];
        }
        publication.Metadata.Author.push(cont);
    }
    if (comicMeta.Penciller) {
        const cont = new metadata_contributor_1.Contributor();
        cont.Name = comicMeta.Writer;
        if (!publication.Metadata.Penciler) {
            publication.Metadata.Penciler = [];
        }
        publication.Metadata.Penciler.push(cont);
    }
    if (comicMeta.Colorist) {
        const cont = new metadata_contributor_1.Contributor();
        cont.Name = comicMeta.Writer;
        if (!publication.Metadata.Colorist) {
            publication.Metadata.Colorist = [];
        }
        publication.Metadata.Colorist.push(cont);
    }
    if (comicMeta.Inker) {
        const cont = new metadata_contributor_1.Contributor();
        cont.Name = comicMeta.Writer;
        if (!publication.Metadata.Inker) {
            publication.Metadata.Inker = [];
        }
        publication.Metadata.Inker.push(cont);
    }
    if (comicMeta.Title) {
        publication.Metadata.Title = comicMeta.Title;
    }
    if (!publication.Metadata.Title) {
        if (comicMeta.Series) {
            let title = comicMeta.Series;
            if (comicMeta.Number) {
                title = title + " - " + comicMeta.Number;
            }
            publication.Metadata.Title = title;
        }
    }
    if (comicMeta.Pages) {
        for (const p of comicMeta.Pages) {
            const l = new publication_link_1.Link();
            if (p.Type === "FrontCover") {
                l.AddRel("cover");
                yield epub_1.addCoverDimensions(publication, l);
            }
            if (publication.Spine) {
                l.Href = publication.Spine[p.Image].Href;
            }
            if (p.ImageHeight) {
                l.Height = p.ImageHeight;
            }
            if (p.ImageWidth) {
                l.Width = p.ImageWidth;
            }
            if (p.Bookmark) {
                l.Title = p.Bookmark;
            }
            if (!publication.TOC) {
                publication.TOC = [];
            }
            publication.TOC.push(l);
        }
    }
});
//# sourceMappingURL=cbz.js.map