/**
 * @class Relation
 *
 * In graph terminology a relation represents a directed edge, a
 * reference from one asset to another. For the purpose of being able
 * to treat all relations equally, there's a subclass for each
 * supported relation type, encapsulating the details of how to
 * retrieve, update, and (optionally) inline the asset being pointed
 * to.
 *
 * These are some examples of included subclasses:
 *
 *    - `relations.HtmlAnchor`         An anchor tag in an HTML document `<a href='...'>`.
 *    - `relations.HtmlImage`          An `<img src='...'>` tag in an HTML document.
 *    - `relations.CssImport`          An `@import` declaration in a CSS asset.
 *    - `relations.CacheManifestEntry` A line in a cache manifest.
 */
const _ = require('lodash');
const extendDefined = require('../util/extendDefined');
const urlTools = require('urltools');
const urlModule = require('url');

/**
 * new Relation(options)
 * =====================
 *
 * Create a new Relation instance. For existing assets the
 * instantiation of relations happens automatically if you use the
 * `populate` transform. You only need to create relations manually
 * when you need to introduce new ones.
 *
 * Note that the base Relation class should be considered
 * abstract. Please instantiate the appropriate subclass.
 *
 * Options:
 *
 *  - `from` The source asset of the relation.
 *  - `to`   The target asset of the relation, or an asset configuration
 *           object if the target asset hasn't yet been resolved and created.
 */
class Relation {
    constructor(config) {
        if (config.hrefType) {
            this._hrefType = config.hrefType;
            config.hrefType = undefined;
        }
        extendDefined(this, config);
        this.id = '' + _.uniqueId();
    }

    /**
     * relation.from (Asset)
     * =====================
     *
     * The source asset of the relation.
     */

    /**
     * relation.to (Asset or asset config object)
     * ==========================================
     *
     * The target asset of the relation. If the relation hasn't yet
     * been resolved, it can also be a relative url string or an asset
     * configuration object.
     */

    /**
     * relation.href (getter/setter)
     * =============================
     *
     * Get or set the href of the relation. The relation must be
     * attached to an asset.
     *
     * What is actually retrieved or updated depends on the relation
     * type. For `HtmlImage` the `src` attribute of the HTML element
     * is changed, for `CssImport` the parsed representation of
     * the @import rule is updated, etc.
     *
     * Most of the time you don't need to think about this property,
     * as the href is automatically updated when the url of the source
     * or target asset is changed, or an intermediate asset is
     * inlined.
     *
     * @api public
     */

    /**
     * relation.refreshHref
     * ====================
     *
     * Update `href` of a relation to make sure it points at the
     * current url of its target asset.
     *
     * It's not necessary to call this function manually as long as
     * the source and target assets of the relation have only been
     * moved by having their `url` property changed (the recommended
     * way), but some transforms will need this after some low-level
     * surgery, such as attaching an existing relation to a different
     * asset.
     *
     * @return {Relation} The relation itself (chaining-friendly).
     * @api public
     */
    refreshHref() {
        // if (this.to.isInline) won't work because relation.to might be unresolved and thus not an Asset instance:
        const targetUrl = this.to && this.to.url;
        if (targetUrl) {
            const assetGraph = this.from && this.from.assetGraph;
            const currentHref = this.href;
            const canonical = this.canonical;
            const hrefType = this.hrefType;
            let href;
            if (hrefType === 'rootRelative' && !canonical) {
                href = urlTools.buildRootRelativeUrl(this.baseUrl, targetUrl, assetGraph && assetGraph.root);
            } else if (hrefType === 'relative' && !canonical) {
                href = urlTools.buildRelativeUrl(this.baseUrl, targetUrl);
            } else if (hrefType === 'protocolRelative') {
                href = urlTools.buildProtocolRelativeUrl(this.baseUrl, targetUrl);
            } else {
                // Absolute
                href = this.to.url;
            }
            // Hack: Avoid adding index.html to an href pointing at file://.../index.html if it's not already there:
            if (/^file:\/\/.*\/index\.html(?:[?#]|$)/.test(targetUrl) && !/(?:^|\/)index\.html(?:[?#]:|$)/.test(this.href)) {
                href = href.replace(/(^|\/)index\.html(?=[?#]|$)/, '$1');
            }
            if (canonical && assetGraph) {
                href = href.replace(assetGraph.root, assetGraph.canonicalRoot);
            }
            const matchCurrentFragment = currentHref && currentHref.match(/#.*$/);
            if (matchCurrentFragment) {
                href += matchCurrentFragment[0];
            }
            if (currentHref !== href) {
                this.href = href;
                this.from.markDirty();
            }
        }
        return this;
    }

    get crossorigin() {
        const fromUrl = this.from.nonInlineAncestor.url;
        const toUrl = this.to.url;
        if (!toUrl) {
            // Inline
            return false;
        }
        if (this.canonical) {
            return false;
        }
        const fromUrlObj = urlModule.parse(fromUrl);
        const toUrlObj = urlModule.parse(urlModule.resolve(fromUrl, toUrl));
        if (fromUrlObj.protocol !== toUrlObj.protocol || fromUrlObj.hostname !== toUrlObj.hostname) {
            return true;
        }
        const fromPort = fromUrlObj.port ? parseInt(fromUrlObj.port, 10) : {'http:': 80, 'https:': 443}[fromUrlObj.protocol];
        const toPort = toUrlObj.port ? parseInt(toUrlObj.port, 10) : {'http:': 80, 'https:': 443}[toUrlObj.protocol];
        return fromPort !== toPort;
    }

    get canonical() {
        if (typeof this._canonical === 'undefined') {
            let canonical = false;

            if (this.href && this.from && this.from.assetGraph && this.from.assetGraph.canonicalRoot) {
                const canonicalRootObj = urlModule.parse(this.from.assetGraph.canonicalRoot, false, true);
                const hrefObj = urlModule.parse(this.href, false, true);

                canonical = hrefObj.slashes === true &&
                    ['http:', 'https:', null].includes(hrefObj.protocol) &&
                    canonicalRootObj.host === hrefObj.host &&
                    hrefObj.path.startsWith(canonicalRootObj.path) &&
                    (canonicalRootObj.protocol === hrefObj.protocol || canonicalRootObj.protocol === null);
            }

            this._canonical = canonical;
        }

        return this._canonical;
    }

    set canonical(isCanonical) {
        if (this.from && this.from.assetGraph && this.from.assetGraph.canonicalRoot) {
            isCanonical = !!isCanonical;
            if (this._canonical !== isCanonical) {
                this._canonical = isCanonical;

                if (!isCanonical && (this._hrefType === 'absolute' || this._hrefType !== 'protocolRelative')) {
                    // We're switching to non-canonical mode. Degrade the href type
                    // to rootRelative so we won't issue absolute file:// urls
                    // This is based on guesswork, though.
                    this._hrefType = 'rootRelative';
                }
                this.refreshHref();
            }
        }
    }

    get baseUrl() {
        const nonInlineAncestor = this.from.nonInlineAncestor;
        return nonInlineAncestor && nonInlineAncestor.url;
    }

    /**
     * relation.hrefType (getter/setter)
     * =================================
     *
     * Either 'absolute', 'rootRelative', 'protocolRelative', or 'relative'. Decides what "degree" of
     * relative url refreshHref tries to issue.
     */

    get hrefType() {
        if (!this._hrefType) {
            const href = (this.href || '').trim();
            if (/^\/\//.test(href)) {
                this._hrefType = 'protocolRelative';
            } else if (/^\//.test(href)) {
                this._hrefType = 'rootRelative';
            } else if (/^[a-z\+]+:/i.test(href)) {
                this._hrefType = 'absolute';
            } else {
                this._hrefType = 'relative';
            }
        }
        return this._hrefType;
    }

    set hrefType(hrefType) {
        if (hrefType !== this._hrefType) {
            this._hrefType = hrefType;
            this.refreshHref();
        }
    }

    /**
     * relation.inline()
     * =================
     *
     * Inline the relation. This is only supported by certain relation
     * types and will produce different results depending on the type
     * (`data:` url, inline script, inline stylesheet...).
     *
     * Will make a clone of the target asset if it has more incoming
     * relations than this one.
     *
     * @return {Relation} The relation itself (chaining-friendly).
     * @api public
     */
    inline() {
        if (this.to.incomingRelations.length !== 1) {
            // This isn't the only incoming relation to the asset, clone before inlining.
            this.to.clone(this);
        }
        this.to.incomingInlineRelation = this;
        if (!this.to.isInline) {
            this.to.url = null;
        }
        return this;
    }

    /**
     * relation.attach(position[, adjacentRelation])
     * ====================================================
     *
     * Attaches the relation to an asset.
     *
     * The ordering of certain relation types is significant
     * (`HtmlScript`, for instance), so it's important that the order
     * isn't scrambled in the indices. Therefore the caller must
     * explicitly specify a position at which to insert the object.
     *
     * @param {Asset} asset The asset to attach the relation to.
     * @param {String} position "first", "last", "before", or "after".
     * @param {Relation} adjacentRelation The adjacent relation, mandatory if the position is "before" or "after".
     * @return {Relation} The relation itself (chaining-friendly).
     * @api public
     */
    attach(position, adjacentRelation) {
        this.from.markDirty();
        this.addToOutgoingRelations(position, adjacentRelation);
        if (this.to && this.to.url) {
            this.refreshHref();
        }
        return this;
    }

    addToOutgoingRelations(position, adjacentRelation) {
        const outgoingRelations = this.from.outgoingRelations;
        const existingIndex = outgoingRelations.indexOf(this);
        if (existingIndex !== -1) {
            outgoingRelations.splice(existingIndex, 1);
        }
        if (position === 'last') {
            outgoingRelations.push(this);
        } else if (position === 'first') {
            outgoingRelations.unshift(this);
        } else if (position === 'before' || position === 'after') { // Assume 'before' or 'after'
            if (!adjacentRelation || !adjacentRelation.isRelation) {
                throw new Error(`addRelation: Adjacent relation is not a relation: ${adjacentRelation}`);
            }
            const i = outgoingRelations.indexOf(adjacentRelation) + (position === 'after' ? 1 : 0);
            if (i === -1) {
                throw new Error(`addRelation: Adjacent relation ${adjacentRelation.toString()} is not among the outgoing relations of ${this.urlOrDescription}`);
            }
            outgoingRelations.splice(i, 0, this);
        } else {
            throw new Error(`addRelation: Illegal 'position' argument: ${position}`);
        }
    }

    /**
     * relation.detach()
     * =================
     *
     * Detaches the relation from the asset it is currently attached
     * to. If the relation is currently part of a graph, it will
     * removed from it.
     *
     * Detaching implies that the tag/statement/declaration
     * representing the relation is physically removed from the
     * referring asset. Not all relation types support this.
     *
     * @return {Relation} The relation itself (chaining-friendly).
     * @api public
     */
    detach() {
        this.from.markDirty();
        this.remove();
        return this;
    }

    /**
     * relation.remove()
     * =================
     *
     * Removes the relation from the graph it's currently part
     * of. Doesn't detach the relation (compare with
     * `relation.detach()`).
     *
     * @return {Relation} The relation itself (chaining-friendly).
     * @api public
     */
    remove() {
        this.from.removeRelation(this);
        return this;
    }

    /**
     * relation.toString()
     * ===================
     *
     * Get a brief text containing the type, id of the relation. Will
     * also contain the `.toString()` of the relation's source and
     * target assets if available.
     *
     * @return {String} The string, eg. "[HtmlAnchor/141: [Html/40 file:///foo/bar/index.html] => [Html/76 file:///foo/bar/otherpage.html]]"
     * @api public
     */
    toString() {
        return '[' + this.type + '/' + this.id + ': ' + ((this.from && this.to) ? this.from.toString() + ' => ' + (this.to.isAsset ? this.to.toString() : this.to.url || this.to.type || '?') : 'unattached') + ']';
    }
};

Object.assign(Relation.prototype, {
    /**
     * relation.isRelation (boolean)
     * =============================
     *
     * Property that's true for all relation instances. Avoids
     * reliance on the `instanceof` operator.
     */
    isRelation: true
});

module.exports = Relation;
