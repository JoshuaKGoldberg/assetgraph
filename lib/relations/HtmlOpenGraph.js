const HtmlRelation = require('./HtmlRelation');

class HtmlOpenGraph extends HtmlRelation {
    constructor(config) {
        super(config);
        if (!this.to || !this.to.url) {
            throw new Error('HtmlOpenGraph: The `to` asset must have a url');
        }
    }

    get href() {
        return this.node.getAttribute('content');
    }

    set href(href) {
        this.node.setAttribute('content', href);
    }

    attach(asset, position, adjacentRelation) {
        this.node = asset.parseTree.createElement('meta');
        this.node.setAttribute('property', this.ogProperty);

        super.attach(asset, position, adjacentRelation);
    }

    inline() {
        throw new Error('HtmlOpenGraph: Inlining of open graph relations is not allowed');
    }
};

module.exports = HtmlOpenGraph;
