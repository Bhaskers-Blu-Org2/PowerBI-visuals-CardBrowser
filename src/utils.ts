/**
 * Copyright (c) 2017 Uncharted Software Inc.
 * http://www.uncharted.software/
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the 'Software'), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import DataView = powerbi.DataView;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;

/**
 * Finds and returns the dataview column(s) that matches the given data role name.
 *
 * @param  {DataView} dataView     A Powerbi dataView object.
 * @param  {string}   dataRoleName A name of the role for the columen.
 * @param  {boolean}  multi        A boolean flag indicating whether to find multiple matching columns.
 * @return {any}                   A dataview table column or an array of the columns.
 */
export function findColumn(dataView: DataView, dataRoleName: string, multi?: boolean): any {
    const columns = dataView.metadata.columns;
    const result = (columns || []).filter((col: any) => col && col.roles[dataRoleName]);
    return multi
        ? (result[0] && result)
        : result[0];
}

/**
 * Check if provided dataView has all the columns with given data role names.
 *
 * @export
 * @param   {DataView} dataView      A Powerbi dataView object.
 * @param   {string[]} dataRoleNames An array of the data role names for corresponding columns.
 * @returns {boolean}                A Boolean value indicating whether the dataView has all matching columns.
 */
export function hasColumns(dataView: DataView, dataRoleNames: string[]): boolean {
    return dataRoleNames.reduce((prev, dataRoleName) => prev && findColumn(dataView, dataRoleName) !== undefined, true);
}

/**
 * Check if given column has a given role.
 */
export function hasRole(column: DataViewMetadataColumn, roleName: string) {
    return Boolean(column  && column.roles[roleName]);
}

// https://stackoverflow.com/questions/35962586/javascript-remove-inline-event-handlers-attributes-of-a-node#35962814
export function removeScriptAttributes(el) {
    const attributes = [].slice.call(el.attributes);

    for (let i = 0; i < attributes.length; i++) {
        const att = attributes[i].name;

        if (att.indexOf('on') === 0) {
            el.attributes.removeNamedItem(att);
        }
    }
}

/**
 * Removes dangerous tags, such as scripts, from the given HTML content.
 * @param {String} html - HTML content to clean
 * @param {Array} whiteList - Array of HTML tag names to accept
 * @returns {String} HTML content, devoid of any tags not in the whitelist
 */
export function sanitizeHTML(html: string, whiteList: string[]): string {
    let cleanHTML = '';
    if (html && whiteList && whiteList.length) {
        // Stack Overflow is all like NEVER PARSE HTML WITH REGEX
        // http://stackoverflow.com/questions/1732348/regex-match-open-tags-except-xhtml-self-contained-tags/1732454#1732454
        // plus the C# whitelist regex I found didn't work in JS
        // http://stackoverflow.com/questions/307013/how-do-i-filter-all-html-tags-except-a-certain-whitelist#315851
        // So going with the innerHTML approach...
        // http://stackoverflow.com/questions/6659351/removing-all-script-tags-from-html-with-js-regular-expression

        let doomedNodeList = [];

        if (!document.createTreeWalker) {
            return ''; // in case someone's hax0ring us?
        }

        let div = $('<div/>');
        div.html(html);

        let filter: any = function (node) {
            removeScriptAttributes(node);
            if (whiteList.indexOf(node.nodeName.toUpperCase()) === -1) {
                return NodeFilter.FILTER_ACCEPT;
            }

            return NodeFilter.FILTER_SKIP;
        };

        filter.acceptNode = filter;

        // Create a tree walker (hierarchical iterator) that only exposes non-whitelisted nodes, which we'll delete.
        let treeWalker = document.createTreeWalker(
            div.get()[0],
            NodeFilter.SHOW_ELEMENT,
            filter,
            false
        );

        while (treeWalker.nextNode()) {
            doomedNodeList.push(treeWalker.currentNode);
        }

        let length = doomedNodeList.length;
        for (let i = 0; i < length; i++) {
            if (doomedNodeList[i].parentNode) {
                try {
                    doomedNodeList[i].parentNode.removeChild(doomedNodeList[i]);
                } catch (ex) { }
            }
        }

        // convert back to a string.
        cleanHTML = div.html().trim();
    }

    return cleanHTML;
}