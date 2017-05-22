var AssetGraph = require('../AssetGraph');
var estraverse = require('estraverse');

module.exports = function (options) {
    options = options || {};
    return function serializeSourceMaps(assetGraph) {
        var potentiallyOrphanedAssetsById = {};

        assetGraph.findAssets({ type: [ 'Css', 'JavaScript' ], isLoaded: true }).forEach(function (asset) {
            // For now, don't attempt to attach source maps to data-bind attributes etc.:
            if (asset.isInline && assetGraph.findRelations({ type: [ 'HtmlDataBindAttribute', 'HtmlKnockoutContainerless', 'HtmlParamsAttribute', 'HtmlStyleAttribute' ], to: asset }).length > 0) {
                return;
            }

            var nonInlineAncestorUrl = asset.nonInlineAncestor.url;
            if (!asset.isDirty) {
                var hasLocationInformationPointingAtADifferentSourceFile = false;
                if (asset.type === 'JavaScript') {
                    estraverse.traverse(asset.parseTree, {
                        enter: function (node) {
                            if (node.loc && node.loc.source !== nonInlineAncestorUrl) {
                                hasLocationInformationPointingAtADifferentSourceFile = true;
                                return this.break();
                            }
                        }
                    });
                } else if (asset.type === 'Css') {
                    asset.parseTree.walk(function (node) {
                        if (node.source.input.file !== nonInlineAncestorUrl) {
                            hasLocationInformationPointingAtADifferentSourceFile = true;
                            return false;
                        }
                    });
                }

                if (!hasLocationInformationPointingAtADifferentSourceFile) {
                    return;
                }
            }
            var sourcesContentByUrl = options.sourcesContent && {};
            assetGraph.findRelations({ from: asset, type: /SourceMappingUrl$/ }).forEach(function (existingSourceMapRelation) {
                potentiallyOrphanedAssetsById[existingSourceMapRelation.to.id] = existingSourceMapRelation.to;
                var existingSourceMap = existingSourceMapRelation.to;
                if (options.sourcesContent && existingSourceMap.parseTree && existingSourceMap.parseTree.sourcesContent && existingSourceMap.parseTree.sources) {
                    for (var i = 0 ; i < existingSourceMap.parseTree.sources.length ; i += 1) {
                        if (typeof existingSourceMap.parseTree.sourcesContent[i] === 'string') {
                            var absoluteUrl = assetGraph.resolveUrl(existingSourceMap.nonInlineAncestor.url, existingSourceMap.parseTree.sources[i]);
                            sourcesContentByUrl[absoluteUrl] = existingSourceMap.parseTree.sourcesContent[i];
                        }
                    }
                }
                existingSourceMapRelation.detach();
            });

            var sourceMap = asset.sourceMap;
            if (options.sourcesContent) {
                sourceMap.sourcesContent = sourceMap.sources.map(function (url) {
                    return sourcesContentByUrl[url] || null;
                });
            } else {
                sourceMap.sourcesContent = undefined;
            }

            var sourceMapAsset = new AssetGraph.SourceMap({
                url: (asset.isInline ? nonInlineAncestorUrl && nonInlineAncestorUrl.replace(/\..*$/, '-') + asset.id : asset.url) + '.map',
                parseTree: sourceMap
            });
            assetGraph.addAsset(sourceMapAsset);
            var sourceMappingUrl = new AssetGraph[asset.type + 'SourceMappingUrl']({ to: sourceMapAsset }).attach(asset, 'last');
            // This is a(nother) case where it'd be nice if an inline relation could be yet another hrefType (#208), because
            // then the logical thing would be that attaching the sourceMappingUrl relation would automatically inline the asset:
            if (sourceMapAsset.isInline) {
                sourceMappingUrl.inline();
            }
        });

        // Clean up old source maps:
        Object.keys(potentiallyOrphanedAssetsById).forEach(function (id) {
            var asset = potentiallyOrphanedAssetsById[id];
            if (asset.incomingRelations.length === 0) {
                assetGraph.removeAsset(asset);
            }
        });
    };
};
