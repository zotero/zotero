export namespace Readerable {
    const isEnabledForParseOnLoad: any;
    /**
     * Decides whether or not a document is reader-able without parsing the whole thing.
     *
     * @param doc A document to parse.
     * @return boolean Whether or not we should show the reader mode button.
     */
    function isProbablyReaderable(doc: any): boolean;
    function _isNodeVisible(node: any): boolean;
    let _blockedHosts: string[];
    function shouldCheckUri(uri: any, isBaseUri?: boolean): boolean;
}
