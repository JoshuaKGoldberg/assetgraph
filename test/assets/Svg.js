/*global describe, it*/
var expect = require('../unexpected-with-plugins'),
    AssetGraph = require('../../lib');

describe('assets/Svg', function () {
    it('should handle a combo test case with an Svg asset', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/assets/Svg/combo/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 11);
                expect(assetGraph, 'to contain asset', 'Html');
                expect(assetGraph, 'to contain asset', 'Svg');
                expect(assetGraph, 'to contain assets', 'JavaScript', 2);
                expect(assetGraph, 'to contain assets', 'Png', 2);
                expect(assetGraph, 'to contain asset', 'Xslt');
                expect(assetGraph, 'to contain relation', 'SvgImage');
                expect(assetGraph, 'to contain relation', 'SvgScript');
                expect(assetGraph, 'to contain relation', 'SvgStyleAttribute');
                expect(assetGraph, 'to contain relation', 'CssImage');
                expect(assetGraph, 'to contain relation', 'SvgStyle');
                expect(assetGraph, 'to contain relation', 'SvgFontFaceUri');
                expect(assetGraph, 'to contain relations', 'XmlStylesheet', 2);
                expect(assetGraph, 'to contain relation', 'SvgInlineEventHandler');
                expect(assetGraph, 'to contain relation', 'SvgAnchor');

                var svgImage = assetGraph.findRelations({type: 'SvgImage'})[0];
                expect(svgImage.href, 'to equal', 'foo.png');
                svgImage.to.url = assetGraph.resolveUrl(assetGraph.root, 'bar.png');
                var svg = assetGraph.findAssets({type: 'Svg'})[0];
                expect(svg.text, 'to match', /<image[^>]* xlink:href="bar\.png"\/>/);

                var svgScript = assetGraph.findRelations({type: 'SvgScript'})[0];
                svgScript.to.url = assetGraph.resolveUrl(assetGraph.root, 'hey.js');
                expect(svg.text, 'to match', /<script[^>]* xlink:href="hey\.js"\/>/);
                svgScript.inline();
                expect(svg.text, 'not to match', /<script[^>]* xlink:href="hey\.js"/);

                var svgAnchor = assetGraph.findRelations({type: 'SvgAnchor'})[0];
                expect(svgAnchor.href, 'to equal', 'index.html');
                svgAnchor.to.url = assetGraph.resolveUrl(assetGraph.root, 'hello.html');
                expect(svg.text, 'to match', /<a[^>]* xlink:href="hello\.html"/);

                var svgFontFaceUri = assetGraph.findRelations({type: 'SvgFontFaceUri'})[0];
                expect(svgFontFaceUri.href, 'to equal', 'fontawesome-webfont.ttf');
                svgFontFaceUri.to.url = assetGraph.resolveUrl(assetGraph.root, 'notsoawesome.ttf');
                expect(svg.text, 'to match', /<font-face-uri[^>]* xlink:href="notsoawesome\.ttf"/);
            })
            .run(done);
    });

    it('should inline an Svg asset as a non-base64 data: url', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/assets/Svg/inline/'})
            .loadAssets('index.css')
            .populate()
            .inlineRelations({type: 'CssImage'})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {
                    type: 'Svg',
                    isText: true
                }, 2);

                expect(assetGraph.findRelations(), 'to satisfy', [
                    {
                        type: 'CssImage',
                        href: expect.it('to begin with', 'data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%20standalone%3D%22no%22%3F%3E%0A%3Csvg')
                    },
                    {
                        type: 'CssImage',
                        href: expect.it('to begin with', 'data:image/svg+xml;base64,')
                    }
                ]);
            })
            .run(done);
    });
});
