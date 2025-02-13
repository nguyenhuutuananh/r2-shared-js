import { Publication } from "../models/publication";
import { Link } from "../models/publication-link";
import { IStreamAndLength } from "r2-utils-js/dist/es8-es2017/src/_utils/zip/zip";
import { ITransformer } from "./transformer";
export declare class TransformerObfIDPF implements ITransformer {
    supports(_publication: Publication, link: Link): boolean;
    transformStream(publication: Publication, link: Link, stream: IStreamAndLength, _isPartialByteRangeRequest: boolean, _partialByteBegin: number, _partialByteEnd: number): Promise<IStreamAndLength>;
    private transformBuffer;
}
