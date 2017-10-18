/*global describe, it*/
var expect = require('../unexpected-with-plugins'),
    AssetGraph = require('../../lib/AssetGraph');

describe('relations/CssSourceMappingUrl', function () {
    it('should handle a test case with a Css asset that has @sourceMappingURL directive', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/relations/CssSourceMappingUrl/existingExternalSourceMap/'});
        await assetGraph.loadAssets('index.html', 'someMore.css')
            .populate();

        expect(assetGraph, 'to contain assets', 5);
        expect(assetGraph, 'to contain assets', 'Css', 2);
        expect(assetGraph, 'to contain asset', 'Html');
        expect(assetGraph, 'to contain asset', 'SourceMap');
        expect(assetGraph, 'to contain relation', 'CssSourceMappingUrl');
        expect(assetGraph, 'to contain relation', 'SourceMapFile');
        expect(assetGraph, 'to contain relation', 'SourceMapSource');
        assetGraph.findAssets({ fileName: 'foo.css' })[0].url = assetGraph.root + 'foo/somewhereelse.css';

        expect(assetGraph.findAssets({ fileName: 'somewhereelse.css' })[0].text, 'to match', /#\s*sourceMappingURL=..\/foo.map/);

        await assetGraph.applySourceMaps();

        expect(assetGraph.findRelations({ type: 'CssSourceMappingUrl', from: { fileName: 'somewhereelse.css' } })[0].from.sourceMap, 'to satisfy', {
            sources: [
                assetGraph.root + 'foo.less'
            ]
        });
        var css = assetGraph.findAssets({ fileName: 'somewhereelse.css' })[0];
        css.parseTree.append(
            assetGraph.findAssets({ fileName: 'someMore.css' })[0].parseTree.nodes
        );
        css.markDirty();

        await assetGraph.serializeSourceMaps();

        expect(assetGraph.findRelations({ type: 'CssSourceMappingUrl', from: { fileName: 'somewhereelse.css' } })[0].to.parseTree, 'to satisfy', {
            sources: [
                assetGraph.root + 'foo.less',
                assetGraph.root + 'someMore.css'
            ]
        });

        for (const relation of assetGraph.findRelations({ type: 'SourceMapSource' })) {
            relation.hrefType = 'rootRelative';
        }
    });
});
