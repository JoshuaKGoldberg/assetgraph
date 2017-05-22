/*global describe, it*/
var expect = require('../unexpected-with-plugins'),
    AssetGraph = require('../../lib/AssetGraph');

describe('relations/XmlStylesheet', function () {
    it('should handle a test case with inline elements', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/relations/XmlStylesheet/'})
            .loadAssets('logo.svg')
            .populate()
            .externalizeRelations({
                type: 'SvgStyle'
            })
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Svg', 1);
                expect(assetGraph, 'to contain relations', 'XmlStylesheet', 1);
                expect(assetGraph, 'to contain assets', 'Css', 1);

                expect(assetGraph.findRelations()[0].href, 'to be', assetGraph.findAssets({ type: 'Css' })[0].id + '.css');

                assetGraph.findAssets({
                    type: 'Css'
                })[0].url = 'external.css';

                var relation = assetGraph.findRelations()[0];

                expect(relation.href, 'to be', 'external.css');

                expect(relation.attach, 'to throw');

                relation.inline();

                expect(relation.href, 'to match', /^data:text\/css;base64/);

                relation.detach();

                expect(assetGraph, 'to contain no relations');
            })
            .run(done);
    });
});
