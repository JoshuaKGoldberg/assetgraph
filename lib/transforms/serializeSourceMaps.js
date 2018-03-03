const estraverse = require('estraverse-fb');

module.exports = options => {
  options = options || {};
  return function serializeSourceMaps(assetGraph) {
    const potentiallyOrphanedAssets = new Set();

    for (const asset of assetGraph.findAssets({
      type: { $in: ['Css', 'JavaScript'] },
      isLoaded: true
    })) {
      // For now, don't attempt to attach source maps to data-bind attributes etc.:
      if (
        asset.isInline &&
        assetGraph.findRelations({
          type: {
            $in: [
              'HtmlDataBindAttribute',
              'HtmlKnockoutContainerless',
              'HtmlParamsAttribute',
              'HtmlStyleAttribute'
            ]
          },
          to: asset
        }).length > 0
      ) {
        continue;
      }

      const nonInlineAncestorUrl = asset.nonInlineAncestor.url;
      if (!asset.isDirty) {
        let hasLocationInformationPointingAtADifferentSourceFile = false;
        if (asset.type === 'JavaScript') {
          estraverse.traverse(asset.parseTree, {
            enter(node) {
              if (node.loc && node.loc.source !== nonInlineAncestorUrl) {
                hasLocationInformationPointingAtADifferentSourceFile = true;
                return this.break();
              }
            }
          });
        } else if (asset.type === 'Css') {
          asset.parseTree.walk(node => {
            if (node.source.input.file !== nonInlineAncestorUrl) {
              hasLocationInformationPointingAtADifferentSourceFile = true;
              return false;
            }
          });
        }

        if (!hasLocationInformationPointingAtADifferentSourceFile) {
          continue;
        }
      }
      const sourcesContentByUrl = options.sourcesContent && {};

      let hrefType = asset && asset.isInline ? 'inline' : undefined;

      for (const existingSourceMapRelation of assetGraph.findRelations({
        from: asset,
        type: { $regex: /SourceMappingUrl$/ }
      })) {
        hrefType = existingSourceMapRelation.hrefType;
        potentiallyOrphanedAssets.add(existingSourceMapRelation.to);
        const existingSourceMap = existingSourceMapRelation.to;
        if (
          existingSourceMap.isLoaded &&
          options.sourcesContent &&
          existingSourceMap.parseTree &&
          existingSourceMap.parseTree.sourcesContent &&
          existingSourceMap.parseTree.sources
        ) {
          for (
            let i = 0;
            i < existingSourceMap.parseTree.sources.length;
            i += 1
          ) {
            if (
              typeof existingSourceMap.parseTree.sourcesContent[i] === 'string'
            ) {
              const absoluteUrl = assetGraph.resolveUrl(
                existingSourceMap.nonInlineAncestor.url,
                existingSourceMap.parseTree.sources[i]
              );
              sourcesContentByUrl[absoluteUrl] =
                existingSourceMap.parseTree.sourcesContent[i];
            }
          }
        }
        existingSourceMapRelation.detach();
      }

      const sourceMap = asset.sourceMap;
      if (options.sourcesContent) {
        sourceMap.sourcesContent = sourceMap.sources.map(
          url => sourcesContentByUrl[url] || null
        );
      } else {
        sourceMap.sourcesContent = undefined;
      }

      asset.addRelation(
        {
          type: asset.type + 'SourceMappingUrl',
          hrefType,
          to: {
            type: 'SourceMap',
            url:
              (asset.isInline
                ? nonInlineAncestorUrl &&
                  nonInlineAncestorUrl.replace(/\..*$/, '-') + asset.id
                : asset.url) + '.map',
            parseTree: sourceMap
          }
        },
        'last'
      );
    }

    // Clean up old source maps:
    for (const asset of potentiallyOrphanedAssets) {
      if (asset.incomingRelations.length === 0) {
        assetGraph.removeAsset(asset);
      }
    }
  };
};
