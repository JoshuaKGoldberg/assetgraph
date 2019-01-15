const pathModule = require('path');
/* global describe, it */
const expect = require('../unexpected-with-plugins');
const AssetGraph = require('../../lib/AssetGraph');

describe('assets/Rss', function() {
  it('should find an Rss asset', async function() {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(__dirname, '../../testdata/assets/Rss/')
    });
    await assetGraph.loadAssets('feed.rss').populate();

    expect(assetGraph, 'to contain asset', 'Rss');
    expect(assetGraph, 'to contain asset', 'Png');
    expect(
      assetGraph,
      'to contain assets',
      { type: 'Html', isInline: true },
      2
    );
    expect(
      assetGraph,
      'to contain assets',
      { type: 'Html', isInline: false },
      1
    );
    expect(assetGraph, 'to contain relation', 'RssChannelLink');

    assetGraph.findAssets({ fileName: 'bar.html' })[0].url =
      'http://example.com/bar.html';
    assetGraph.findRelations({ type: 'RssChannelLink' })[0].hrefType =
      'absolute';

    expect(assetGraph, 'to contain asset', {
      type: 'Rss',
      text: { $regex: /<link>http:\/\/example.com\/bar.html<\/link>/ }
    });
  });
});
