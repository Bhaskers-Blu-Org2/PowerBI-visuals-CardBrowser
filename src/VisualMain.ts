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

/// <reference path="../node_modules/powerbi-visuals/lib/powerbi-visuals.d.ts"/>

import IVisual = powerbi.extensibility.v110.IVisual;
import VisualConstructorOptions = powerbi.extensibility.v110.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.VisualUpdateOptions;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import IVisualHost = powerbi.extensibility.v110.IVisualHost;
import DataViewScopeIdentity = powerbi.DataViewScopeIdentity;
import IVisualHostServices = powerbi.IVisualHostServices;
import IColorInfo = powerbi.IColorInfo;
import DataView = powerbi.DataView;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;

import * as Promise from 'bluebird';
import * as $ from 'jquery';
import Thumbnails from '../lib/@uncharted/cards/src';
import * as _ from 'lodash';
import * as debounce from 'lodash/debounce';
import * as utils from './utils';
import {
    convertToDocumentData,
    countDocuments,
} from './dataConversion';
import {
    METADATA_FIELDS,
    REQUIRED_FIELDS,
    DEFAULT_VISUAL_SETTINGS,
} from './constants';

import {
    EVENTS,
} from '../lib/@uncharted/cards/src/components/constants';
const visualTemplate = require('./visual.handlebars');

export default class Cards8D7CFFDA2E7E400C9474F41B9EDBBA58 implements IVisual {

    private $element: JQuery;
    private dataView: DataView;
    private thumbnails: any;
    private documentData: any;
    private hostServices: IVisualHostServices;
    private isSandboxed: Boolean;
    private isDesktop: Boolean = true;
    private loadedDocumentCount = 0;
    private isLoadingMore = false;
    private hasMetaData = false;

    private settings = $.extend({}, DEFAULT_VISUAL_SETTINGS);

    /* init function for legacy api */
    constructor(options: VisualConstructorOptions) {
        this.hostServices = options.host.createSelectionManager()['hostServices'];

        // Start hacks to detect sandboxing & desktop...
        this.isSandboxed = this.hostServices['messageProxy'];
        // this.isSandboxed = (this.hostServices.constructor.name === "SandboxVisualHostServices");
        // this.isSandboxed = (this.hostServices.constructor.name.toLowerCase().indexOf('sandbox') !== -1);
        this.isDesktop = (powerbi.build === undefined);
        // ... end hacks
        console.log('build ', powerbi);
        setTimeout(() => console.log('build t', powerbi), 10);
        this.$element = $(visualTemplate({
            isDesktop: this.isDesktop,
        })).appendTo(options.element);

        this.thumbnails = new Thumbnails();
        this.$element.append(this.thumbnails.$element);

        this.thumbnails.on(EVENTS.THUMBNAIL_CLICK, (thumbnail) => {
            if (!thumbnail.isExpanded) {
                this.thumbnails.updateReaderContent(thumbnail, thumbnail.data);
                this.thumbnails.openReader(thumbnail);
            }
        });

        this.thumbnails.on(EVENTS.VERTICAL_READER_NAVIGATE_THUMBNAIL, (thumbnail) => {
            this.thumbnails.updateReaderContent(thumbnail, thumbnail.data);
        });

        this.thumbnails.on(`${EVENTS.READER_CONTENT_CLICK_CLOSE} ${EVENTS.THUMBNAILS_CLICK_BACKGROUND}`, () => {
            this.thumbnails.closeReader();
        });

        $('.flip-cards').click(() => {
            this.$element.addClass('animating');
            setTimeout(() => {
                this.thumbnails.thumbnailInstances.forEach(thumbnail => (thumbnail.isFlipped = !thumbnail.isFlipped));
                setTimeout(() => this.$element.removeClass('animating'), 600);
            }, 1000);
        });

        this.changeWrapMode({
            viewport: {
                width: options.element.offsetWidth,
                height: options.element.offsetHeight
            }
        });
    }

    public update(options: VisualUpdateOptions) {
        if (options['resizeMode']) {
            debounce(() => {
                this.thumbnails.verticalReader.reposition();
                this.changeWrapMode(options);
            }, 200)();
            return;
        }

        if (!options.dataViews || !(options.dataViews.length > 0)) { return; }
        if (!utils.hasColumns(options.dataViews[0], REQUIRED_FIELDS)) { return; }
        this.hasMetaData = utils.hasColumns(options.dataViews[0], METADATA_FIELDS);

        this.dataView = options.dataViews[0];
        const newObjects = this.dataView && this.dataView.metadata && this.dataView.metadata.objects;
        this.settings = $.extend(true, {}, DEFAULT_VISUAL_SETTINGS, newObjects);
        this.$element.toggleClass('enable-flipping', this.settings.flipState.enableFlipping);

        this.loadedDocumentCount = this.dataView ? countDocuments(this.dataView) : 0;
        this.isLoadingMore = (this.settings.loadMoreData.enabled &&
        this.loadedDocumentCount < this.settings.loadMoreData.limit &&
        !!this.dataView.metadata.segment);
        if (this.isLoadingMore) {
            // need to load more data
            this.isLoadingMore = true;
            this.hostServices.loadMoreData();
            return;
        }

        const anyOptions: any = options;
        this.documentData = convertToDocumentData(this.dataView, this.settings,
            anyOptions.dataTransforms && anyOptions.dataTransforms.roles);
        this.updateThumbnails();
    }

    private updateThumbnails() {
        this.thumbnails.reset({
            'inlineMode': this.thumbnails.inlineMode,
            'thumbnail.disableFlipping': !this.settings.flipState.enableFlipping,
            'thumbnail.displayBackCardByDefault': this.settings.flipState.backFaceDefault,
        });
        this.thumbnails.loadData(this.documentData.documentList);
        console.log("loaded " + this.loadedDocumentCount + " documents");
    }

    private changeWrapMode(options) {
        const thumbnailHeight = this.thumbnails.thumbnailInstances[0] && this.thumbnails.thumbnailInstances[0].$element.height();
        const viewport: any = options.viewport;
        const isViewPortHeightSmallEnoughForInlineThumbnails = thumbnailHeight && viewport.height <= thumbnailHeight * 1.5;
        this.thumbnails.toggleInlineDisplayMode(isViewPortHeightSmallEnoughForInlineThumbnails);
    }

    private sendSelectionToHost(identities: DataViewScopeIdentity[]) {
        const selectArgs = {
            data: identities.map((identity: DataViewScopeIdentity) => ({ data: [identity] })),
            visualObjects: [],
        };
        this.hostServices.onSelect(selectArgs);
    }

    /**
     * Enumerates the instances for the objects that appear in the PowerBI panel.
     *
     * @method enumerateObjectInstances
     * @param {EnumerateVisualObjectInstancesOptions} options - Options object containing the objects to enumerate, as provided by PowerBI.
     * @returns {VisualObjectInstance[]}
     */
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] {
        let instances: VisualObjectInstance[] = [{
            selector: null,
            objectName: options.objectName,
            properties: {}
        }];
        $.extend(true, instances[0].properties, this.settings[options.objectName]);
        return instances;
    }

    /**
     * Destroy method called by PowerBI.
     *
     * @method destroy
     */
    public destroy(): void {
        this.changeWrapMode['cancel']();
        this.thumbnails = null;
        this.hostServices = null;
    }
}
