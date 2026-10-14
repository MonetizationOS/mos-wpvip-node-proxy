/* tslint:disable */
/* eslint-disable */

export interface ContentTypeOptions {
    html?: boolean;
}


export interface DocumentContentHandlers {
    doctype?: (doctype: Doctype) => void;
    comments?: (comment: Comment) => void;
    text?: (textChunk: TextChunk) => void;
    end?: (end: DocumentEnd) => void;
}


export interface ElementContentHandlers {
    element?: (element: Element) => void;
    comments?: (comment: Comment) => void;
    text?: (textChunk: TextChunk) => void;
}


export class Comment {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    after(content: string, content_type?: ContentTypeOptions | null): void;
    before(content: string, content_type?: ContentTypeOptions | null): void;
    remove(): void;
    replace(content: string, content_type?: ContentTypeOptions | null): void;
    readonly removed: boolean;
    /**
     * Returns a JS array `[start, end]` with byte offsets relative to the start of the document.
     *
     * The byte offsets are incompatible with JS's char code indices.
     */
    readonly sourceLocationBytes: [number, number];
    readonly text: string;
}

export class Doctype {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly name: string | undefined;
    readonly publicId: string | undefined;
    readonly systemId: string | undefined;
}

export class DocumentEnd {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    append(content: string, content_type?: ContentTypeOptions | null): void;
}

export class Element {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    after(content: string, content_type?: ContentTypeOptions | null): void;
    append(content: string, content_type?: ContentTypeOptions | null): void;
    before(content: string, content_type?: ContentTypeOptions | null): void;
    getAttribute(name: string): string | undefined;
    hasAttribute(name: string): boolean;
    onEndTag(handler: Function): void;
    prepend(content: string, content_type?: ContentTypeOptions | null): void;
    remove(): void;
    removeAndKeepContent(): void;
    removeAttribute(name: string): void;
    replace(content: string, content_type?: ContentTypeOptions | null): void;
    setAttribute(name: string, value: string): void;
    setInnerContent(content: string, content_type?: ContentTypeOptions | null): void;
    readonly attributes: any;
    readonly namespaceURI: any;
    readonly removed: boolean;
    tagName: string;
    /**
     * Returns a JS array `[start, end]` with byte offsets relative to the start of the document.
     * The location is for the start tag only.
     *
     * The byte offsets are incompatible with JS's char code indices.
     */
    readonly sourceLocationBytes: [number, number];
}

export class EndTag {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    after(content: string, content_type?: ContentTypeOptions | null): void;
    before(content: string, content_type?: ContentTypeOptions | null): void;
    remove(): void;
    replace(content: string, content_type?: ContentTypeOptions | null): void;
    readonly name: string;
    readonly removed: boolean;
    /**
     * Returns a JS array `[start, end]` with byte offsets relative to the start of the document.
     *
     * The byte offsets are incompatible with JS's char code indices.
     */
    readonly sourceLocationBytes: any;
}

export class HTMLRewriter {
    free(): void;
    [Symbol.dispose](): void;
    end(): void;
    constructor(encoding: string, output_sink: (chunk: Uint8Array) => void);
    on(selector: string, handlers: ElementContentHandlers): void;
    onDocument(handlers: DocumentContentHandlers): void;
    write(chunk: Uint8Array): void;
}

export class TextChunk {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    after(content: string, content_type?: ContentTypeOptions | null): void;
    before(content: string, content_type?: ContentTypeOptions | null): void;
    remove(): void;
    replace(content: string, content_type?: ContentTypeOptions | null): void;
    readonly lastInTextNode: boolean;
    readonly removed: boolean;
    /**
     * Returns a JS array `[start, end]` with byte offsets relative to the start of the document.
     *
     * The byte offsets are incompatible with JS's char code indices.
     */
    readonly sourceLocationBytes: [number, number];
    /**
     * The text may be an incomplete fragment of a text node
     */
    readonly text: string;
}
