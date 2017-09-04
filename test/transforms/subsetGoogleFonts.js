var expect = require('../unexpected-with-plugins');
var AssetGraph = require('../../lib');

var httpception = require('httpception');

describe('transforms/subsetGoogleFonts', function () {

    it('should handle HTML <link rel=stylesheet>', function () {
        httpception([
            {
                request: 'GET https://fonts.googleapis.com/css?family=Open+Sans',
                response: {
                    headers: {
                        'Content-Type': 'text/css'
                    },
                    body: [
                        '@font-face {',
                        '  font-family: \'Open Sans\';',
                        '  font-style: normal;',
                        '  font-weight: 400;',
                        '  src: local(\'Open Sans\'), local(\'OpenSans\'), url(https://fonts.gstatic.com/s/opensans/v13/cJZKeOuBrn4kERxqtaUH3T8E0i7KZn-EPnyo3HZu7kw.woff) format(\'woff\');',
                        '}'
                    ].join('\n')
                }
            },
            {
                request: 'GET https://fonts.googleapis.com/css?family=Open+Sans&text=Helo',
                response: {
                    headers: {
                        'Content-Type': 'text/css'
                    },
                    body: [
                        '@font-face {',
                        '  font-family: \'Open Sans\';',
                        '  font-style: normal;',
                        '  font-weight: 400;',
                        '  src: local(\'Open Sans\'), local(\'OpenSans\'), url(https://fonts.gstatic.com/l/font?kit=ZC3Pxff5o11SVa40-M1YDXY_vlID40_xbxWXk1HqQcs&skey=62c1cbfccc78b4b2&v=v13) format(\'woff\');',
                        '}'
                    ].join('\n')
                }
            },
            {
                request: 'GET https://fonts.gstatic.com/l/font?kit=ZC3Pxff5o11SVa40-M1YDXY_vlID40_xbxWXk1HqQcs&skey=62c1cbfccc78b4b2&v=v13',
                response: {
                    headers: {
                        'Content-Type': 'font/woff'
                    },
                    body: new Buffer('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', 'base64')
                }
            }
        ]);

        return new AssetGraph({root: __dirname + '/../../testdata/transforms/subsetGoogleFonts/html-link/'})
            .loadAssets('index.html')
            .populate({
                followRelations: {
                    crossorigin: false
                }
            })
            .subsetGoogleFonts()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relation', {
                    type: 'HtmlStyle',
                    from: {
                        type: 'Html',
                        fileName: 'index.html'
                    },
                    to: {
                        type: 'Css',
                        url: 'https://fonts.googleapis.com/css?family=Open+Sans&text=Helo',
                        isLoaded: true
                    }
                });

                expect(assetGraph, 'to contain relation', {
                    type: 'CssFontFaceSrc',
                    from: {
                        type: 'Css',
                        url: 'https://fonts.googleapis.com/css?family=Open+Sans&text=Helo'
                    },
                    to: {
                        type: 'Asset',
                        url: 'https://fonts.gstatic.com/l/font?kit=ZC3Pxff5o11SVa40-M1YDXY_vlID40_xbxWXk1HqQcs&skey=62c1cbfccc78b4b2&v=v13',
                        isLoaded: true
                    }
                });
            });
    });

    it('should handle CSS @import', function () {
        httpception([
            {
                request: 'GET https://fonts.googleapis.com/css?family=Open+Sans',
                response: {
                    headers: {
                        'Content-Type': 'text/css'
                    },
                    body: [
                        '@font-face {',
                        '  font-family: \'Open Sans\';',
                        '  font-style: normal;',
                        '  font-weight: 400;',
                        '  src: local(\'Open Sans\'), local(\'OpenSans\'), url(https://fonts.gstatic.com/s/opensans/v13/cJZKeOuBrn4kERxqtaUH3T8E0i7KZn-EPnyo3HZu7kw.woff) format(\'woff\');',
                        '}'
                    ].join('\n')
                }
            },
            {
                request: 'GET https://fonts.googleapis.com/css?family=Open+Sans&text=Helo',
                response: {
                    headers: {
                        'Content-Type': 'text/css'
                    },
                    body: [
                        '@font-face {',
                        '  font-family: \'Open Sans\';',
                        '  font-style: normal;',
                        '  font-weight: 400;',
                        '  src: local(\'Open Sans\'), local(\'OpenSans\'), url(https://fonts.gstatic.com/l/font?kit=ZC3Pxff5o11SVa40-M1YDXY_vlID40_xbxWXk1HqQcs&skey=62c1cbfccc78b4b2&v=v13) format(\'woff\');',
                        '}'
                    ].join('\n')
                }
            },
            {
                request: 'GET https://fonts.gstatic.com/l/font?kit=ZC3Pxff5o11SVa40-M1YDXY_vlID40_xbxWXk1HqQcs&skey=62c1cbfccc78b4b2&v=v13',
                response: {
                    headers: {
                        'Content-Type': 'font/woff'
                    },
                    body: new Buffer('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', 'base64')
                }
            }
        ]);

        return new AssetGraph({root: __dirname + '/../../testdata/transforms/subsetGoogleFonts/css-import/'})
            .loadAssets('index.html')
            .populate({
                followRelations: {
                    crossorigin: false
                }
            })
            .subsetGoogleFonts()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relation', {
                    type: 'CssImport',
                    from: {
                        type: 'Css',
                        isInline: true
                    },
                    to: {
                        type: 'Css',
                        url: 'https://fonts.googleapis.com/css?family=Open+Sans&text=Helo',
                        isLoaded: true
                    }
                });

                expect(assetGraph, 'to contain relation', {
                    type: 'CssFontFaceSrc',
                    from: {
                        type: 'Css',
                        url: 'https://fonts.googleapis.com/css?family=Open+Sans&text=Helo'
                    },
                    to: {
                        type: 'Asset',
                        url: 'https://fonts.gstatic.com/l/font?kit=ZC3Pxff5o11SVa40-M1YDXY_vlID40_xbxWXk1HqQcs&skey=62c1cbfccc78b4b2&v=v13',
                        isLoaded: true
                    }
                });
            });
    });

    it('should handle multiple font-families', function () {
        httpception([
            {
                request: 'GET https://fonts.googleapis.com/css?family=Jim+Nightshade',
                response: {
                    headers: {
                        'Content-Type': 'text/css'
                    },
                    body: [
                        '@font-face {',
                        '  font-family: "Jim Nightshade";',
                        '  font-style: normal;',
                        '  font-weight: 400;',
                        '  src: local("Jim Nightshade"), local("JimNightshade-Regular"), url(https://fonts.gstatic.com/s/jimnightshade/v4/_n43lYHXVWNgXegdYRIK9GeI2efzuxEXXKel_Sw2G4E.woff) format("woff");',
                        '}'
                    ].join('\n')
                }
            },
            {
                request: 'GET https://fonts.googleapis.com/css?family=Montserrat',
                response: {
                    headers: {
                        'Content-Type': 'text/css'
                    },
                    body: [
                        '@font-face {',
                        '  font-family: "Montserrat";',
                        '  font-style: normal;',
                        '  font-weight: 400;',
                        '  src: local("Montserrat Regular"), local("Montserrat-Regular"), url(https://fonts.gstatic.com/s/montserrat/v10/zhcz-_WihjSQC0oHJ9TCYBsxEYwM7FgeyaSgU71cLG0.woff) format("woff");',
                        '}'
                    ].join('\n')
                }
            },
            {
                request: 'GET https://fonts.googleapis.com/css?family=Space+Mono',
                response: {
                    headers: {
                        'Content-Type': 'text/css'
                    },
                    body: [
                        '@font-face {',
                        '  font-family: "Space Mono";',
                        '  font-style: normal;',
                        '  font-weight: 400;',
                        '  src: local("Space Mono"), local("SpaceMono-Regular"), url(https://fonts.gstatic.com/s/spacemono/v1/adVweg3BJhE6r8jYmXseHRsxEYwM7FgeyaSgU71cLG0.woff) format("woff");',
                        '}'
                    ].join('\n')
                }
            },
            {
                request: 'GET https://fonts.googleapis.com/css?family=Jim+Nightshade&text=Helo',
                response: {
                    headers: {
                        'Content-Type': 'text/css'
                    },
                    body: [
                        '@font-face {',
                        '  font-family: "Jim Nightshade";',
                        '  font-style: normal;',
                        '  font-weight: 400;',
                        '  src: local("Jim Nightshade"), local("JimNightshade-Regular"), url(https://fonts.gstatic.com/l/font?kit=_n43lYHXVWNgXegdYRIK9INhpK5NK1BotPe30q0xp6Q&skey=a1cdb4741ac7b833&v=v4) format("woff");',
                        '}'
                    ].join('\n')
                }
            },
            {
                request: 'GET https://fonts.googleapis.com/css?family=Montserrat&text=Dakr',
                response: {
                    headers: {
                        'Content-Type': 'text/css'
                    },
                    body: [
                        '@font-face {',
                        '  font-family: "Montserrat";',
                        '  font-style: normal;',
                        '  font-weight: 400;',
                        '  src: local("Montserrat Regular"), local("Montserrat-Regular"), url(https://fonts.gstatic.com/l/font?kit=dvTfUY0Ly8XsfmkactButUFqwElyQhIsO2Cvw-n5lNI&skey=7bc19f711c0de8f&v=v10) format("woff");',
                        '}'
                    ].join('\n')
                }
            },
            {
                request: 'GET https://fonts.googleapis.com/css?family=Space+Mono&text=Celru',
                response: {
                    headers: {
                        'Content-Type': 'text/css'
                    },
                    body: [
                        '@font-face {',
                        '  font-family: "Space Mono";',
                        '  font-style: normal;',
                        '  font-weight: 400;',
                        '  src: local("Space Mono"), local("SpaceMono-Regular"), url(https://fonts.gstatic.com/l/font?kit=bjPdZ9rVJBis0VL4JCoa7q88CPKkd5UnrKmO8Wvhwmw&skey=5e801b58db657470&v=v1) format("woff");',
                        '}'
                    ].join('\n')
                }
            },
            {
                request: 'GET https://fonts.gstatic.com/l/font?kit=_n43lYHXVWNgXegdYRIK9INhpK5NK1BotPe30q0xp6Q&skey=a1cdb4741ac7b833&v=v4',
                response: {
                    headers: {
                        'Content-Type': 'font/woff'
                    },
                    body: new Buffer('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', 'base64')
                }
            },
            {
                request: 'GET https://fonts.gstatic.com/l/font?kit=dvTfUY0Ly8XsfmkactButUFqwElyQhIsO2Cvw-n5lNI&skey=7bc19f711c0de8f&v=v10',
                response: {
                    headers: {
                        'Content-Type': 'font/woff'
                    },
                    body: new Buffer('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', 'base64')
                }
            },
            {
                request: 'GET https://fonts.gstatic.com/l/font?kit=bjPdZ9rVJBis0VL4JCoa7q88CPKkd5UnrKmO8Wvhwmw&skey=5e801b58db657470&v=v1',
                response: {
                    headers: {
                        'Content-Type': 'font/woff'
                    },
                    body: new Buffer('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', 'base64')
                }
            }
        ]);

        return new AssetGraph({root: __dirname + '/../../testdata/transforms/subsetGoogleFonts/multi-family/'})
            .loadAssets('index.html')
            .populate({
                followRelations: {
                    crossorigin: false
                }
            })
            .subsetGoogleFonts()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relation', {
                    type: 'HtmlStyle',
                    to: {
                        type: 'Css',
                        url: 'https://fonts.googleapis.com/css?family=Jim+Nightshade&text=Helo',
                        isLoaded: true
                    }
                });

                expect(assetGraph, 'to contain relation', {
                    type: 'HtmlStyle',
                    to: {
                        type: 'Css',
                        url: 'https://fonts.googleapis.com/css?family=Montserrat&text=Dakr',
                        isLoaded: true
                    }
                });

                expect(assetGraph, 'to contain relation', {
                    type: 'HtmlStyle',
                    to: {
                        type: 'Css',
                        url: 'https://fonts.googleapis.com/css?family=Space+Mono&text=Celru',
                        isLoaded: true
                    }
                });

                expect(assetGraph, 'to contain relation', {
                    type: 'CssFontFaceSrc',
                    from: {
                        type: 'Css',
                        url: 'https://fonts.googleapis.com/css?family=Jim+Nightshade&text=Helo'
                    },
                    to: {
                        type: 'Asset',
                        url: 'https://fonts.gstatic.com/l/font?kit=_n43lYHXVWNgXegdYRIK9INhpK5NK1BotPe30q0xp6Q&skey=a1cdb4741ac7b833&v=v4',
                        isLoaded: true
                    }
                });

                expect(assetGraph, 'to contain relation', {
                    type: 'CssFontFaceSrc',
                    from: {
                        type: 'Css',
                        url: 'https://fonts.googleapis.com/css?family=Montserrat&text=Dakr'
                    },
                    to: {
                        type: 'Asset',
                        url: 'https://fonts.gstatic.com/l/font?kit=dvTfUY0Ly8XsfmkactButUFqwElyQhIsO2Cvw-n5lNI&skey=7bc19f711c0de8f&v=v10',
                        isLoaded: true
                    }
                });

                expect(assetGraph, 'to contain relation', {
                    type: 'CssFontFaceSrc',
                    from: {
                        type: 'Css',
                        url: 'https://fonts.googleapis.com/css?family=Space+Mono&text=Celru'
                    },
                    to: {
                        type: 'Asset',
                        url: 'https://fonts.gstatic.com/l/font?kit=bjPdZ9rVJBis0VL4JCoa7q88CPKkd5UnrKmO8Wvhwmw&skey=5e801b58db657470&v=v1',
                        isLoaded: true
                    }
                });
            });
    });
});

