var expect = require('../unexpected-with-plugins');
var sinon = require('sinon');
var AssetGraph = require('../../lib/AssetGraph');

describe('tranforms/inlineCriticalCss', function () {
    it('should not do anything on an empty page', function () {
        var relations;
        var assets;

        return new AssetGraph({ root: __dirname + '/../../testdata/transforms/inlineCriticalCss/' })
            .loadAssets('empty.html')
            .populate()
            .queue(function (assetGraph) {
                relations = assetGraph.findRelations();
                assets = assetGraph.findAssets();
            })
            .inlineCriticalCss()
            .queue(function (assetGraph) {
                expect(assetGraph.findRelations(), 'to satisfy', relations);
                expect(assetGraph.findAssets(), 'to satisfy', assets);
            });
    });

    it('should emit a warning when encountering broken html', async function () {
        const warnSpy = sinon.spy();

        const assetGraph = await new AssetGraph({ root: __dirname + '/../../testdata/transforms/inlineCriticalCss/' })
            .on('warn', warnSpy)
            .loadAssets('missing-structure.html')
            .populate();

        const relations = assetGraph.findRelations();
        const assets = assetGraph.findAssets();

        await assetGraph.inlineCriticalCss();

        expect(assetGraph.findRelations(), 'to satisfy', relations);
        expect(assetGraph.findAssets(), 'to satisfy', assets);

        expect(warnSpy, 'to have calls satisfying', () => {
            warnSpy({ message: /the page does not have an <html> element/ });
        });
    });

    it('should inline the heading style of a simple test case', function () {
        return new AssetGraph({ root: __dirname + '/../../testdata/transforms/inlineCriticalCss/' })
            .loadAssets('simple.html')
            .populate()
            .inlineCriticalCss()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relations', 'HtmlStyle', 2);
                expect(assetGraph, 'to contain relation', {
                    to: {
                        fileName: 'simple.css'
                    }
                });

                expect(assetGraph, 'to contain relation', {
                    to: {
                        isInline: true,
                        text: [
                            'h1 { color: red; }',
                            '',
                            'a { color: rebeccapurple; }'
                        ].join('\n')
                    },
                    node: node => node && node.parentNode && node.parentNode.tagName === 'HEAD'
                });
            });
    });

    it('should include the <html> node in critical nodes', function () {
        return new AssetGraph({ root: __dirname + '/../../testdata/transforms/inlineCriticalCss/' })
            .loadAssets('htmlnode.html')
            .populate()
            .inlineCriticalCss()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relations', 'HtmlStyle', 2);
                expect(assetGraph, 'to contain relation', {
                    type: 'HtmlStyle',
                    to: {
                        fileName: 'htmlnode.css'
                    }
                });
                expect(assetGraph, 'to contain relation', {
                    to: {
                        isInline: true,
                        text: 'html {\n    color:red;\n}'
                    },
                    node: node => node && node.parentNode && node.parentNode.tagName === 'HEAD'
                });
            });
    });

    it('should handle at-rule block nested CSS rules', function () {
        return new AssetGraph({ root: __dirname + '/../../testdata/transforms/inlineCriticalCss/' })
            .loadAssets('media.html')
            .populate()
            .inlineCriticalCss()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relations', 'HtmlStyle', 2);
                expect(assetGraph, 'to contain relation', {
                    type: 'HtmlStyle',
                    to: {
                        isInline: true,
                        text: [
                            '@media screen {',
                            '    h1 {',
                            '        color: red;',
                            '    }',
                            '',
                            '    p {',
                            '        color: green;',
                            '    }',
                            '}',
                            '',
                            '@media print {',
                            '    h1 {',
                            '        background: black;',
                            '    }',
                            '}'
                        ].join('\n')
                    },
                    node: node => node && node.parentNode && node.parentNode.tagName === 'HEAD'
                });
                expect(assetGraph, 'to contain relation', {
                    type: 'HtmlStyle',
                    to: {
                        fileName: 'media.css'
                    }
                });
            });
    });

    it('should handle pseudo-selectors', function () {
        return new AssetGraph({ root: __dirname + '/../../testdata/transforms/inlineCriticalCss/' })
            .loadAssets('pseudo.html')
            .populate()
            .inlineCriticalCss()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relations', 'HtmlStyle', 2);
                expect(assetGraph, 'to contain relation', {
                    type: 'HtmlStyle',
                    to: {
                        isInline: true,
                        text: [
                            'h1:not(.non-existent) {',
                            '    background: red;',
                            '}',
                            '',
                            'h1:after {',
                            '    border: 1px solid yellow;',
                            '}',
                            '',
                            'p:nth-child(2) {',
                            '    background: hotpink;',
                            '}'
                        ].join('\n')
                    },
                    node: node => node && node.parentNode && node.parentNode.tagName === 'HEAD'
                });
                expect(assetGraph, 'to contain relation', {
                    type: 'HtmlStyle',
                    to: {
                        fileName: 'pseudo.css'
                    }
                });
            });
    });

    it('should combine with other CSS transforms without throwing', async function () {
        const assetGraph = await new AssetGraph({ root: __dirname + '/../../testdata/transforms/inlineCriticalCss/' })
            .loadAssets('simple.html')
            .populate();

        for (const asset of assetGraph.findAssets({isLoaded: true, isInline: false})) {
            asset.minify();
        }

        await assetGraph
            .inlineHtmlTemplates()
            .bundleRelations({type: 'HtmlStyle', to: {type: 'Css', isLoaded: true}, node: function (node) {return !node.hasAttribute('nobundle');}})
            .inlineCriticalCss()
            .mergeIdenticalAssets({isLoaded: true, isInline: false, type: ['JavaScript', 'Css']}); // The bundling might produce several identical files, especially the 'oneBundlePerIncludingAsset' strategy.

        for (const asset of assetGraph.findAssets({isLoaded: true})) {
            asset.minify();
        }

        assetGraph
            .queue(function (assetGraph) {
                expect(assetGraph.findRelations({ type: 'HtmlStyle' }), 'to satisfy', [
                    {
                        to: {
                            isInline: true,
                            text: 'h1{color:red}a{color:#639}'
                        },
                        node: function (node) {
                            return node && node.parentNode && node.parentNode.tagName === 'HEAD';
                        }
                    },
                    {
                        to: {
                            fileName: 'simple.css'
                        }
                    }
                ]);
            });
    });
});
