const pathModule = require('path');
/* global describe, it */
const expect = require('../unexpected-with-plugins');
const _ = require('lodash');
const urlTools = require('urltools');
const AssetGraph = require('../../lib/AssetGraph');
const sinon = require('sinon');

describe('transforms/addCacheManifest', function() {
  it('should handle a single page with an existing cache manifest', async function() {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '../../testdata/transforms/addCacheManifest/existingCacheManifest/'
      )
    });
    await assetGraph.loadAssets('index.html');
    await assetGraph.populate();

    expect(assetGraph, 'to contain relations', 4);
    expect(assetGraph, 'to contain assets', 4);
    expect(assetGraph, 'to contain assets', 'CacheManifest', 1);

    const outgoingRelations = assetGraph.findRelations({
      from: assetGraph.findAssets({ type: 'CacheManifest' })[0]
    });
    expect(outgoingRelations, 'to have length', 1);
    expect(outgoingRelations[0].to.type, 'to equal', 'Png');
    expect(outgoingRelations[0].sectionName, 'to equal', 'FALLBACK');

    await assetGraph.addCacheManifest({ isInitial: true });

    expect(assetGraph, 'to contain asset', 'CacheManifest');
    const cacheManifest = assetGraph.findAssets({ type: 'CacheManifest' })[0];
    const barPng = assetGraph.findAssets({
      url: urlTools.resolveUrl(assetGraph.root, 'bar.png')
    })[0];
    expect(assetGraph, 'to contain relation', {
      from: cacheManifest,
      to: barPng
    });

    const fooPngMatches = cacheManifest.text.match(/\bfoo.png/gm);
    expect(fooPngMatches, 'to be an array');
    expect(fooPngMatches, 'to have length', 1);

    expect(
      cacheManifest.text,
      'to contain',
      'NETWORK:\n# I am a comment\n/helloworld.php\n'
    );
    expect(
      cacheManifest.text,
      'to contain',
      'FALLBACK:\nheresthething.asp foo.png\n'
    );

    assetGraph.findAssets({ fileName: 'foo.png' })[0].url = urlTools.resolveUrl(
      assetGraph.root,
      'somewhere/else/quux.png'
    );

    expect(cacheManifest.text, 'not to match', /\bfoo.png/);
    expect(
      cacheManifest.text,
      'to contain',
      'FALLBACK:\nheresthething.asp somewhere/else/quux.png\n'
    );
  });

  it('should add a cache manifest to a page that does not already have one', async function() {
    const warnSpy = sinon.spy().named('warn');
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '../../testdata/transforms/addCacheManifest/noCacheManifest/'
      )
    });
    await assetGraph.on('warn', warnSpy);
    await assetGraph.loadAssets('index.html');
    await assetGraph.populate({
      followRelations: { to: { protocol: 'file:' } }
    });

    expect(warnSpy, 'to have calls satisfying', () =>
      warnSpy(/^ENOENT.*notFound\.js/)
    );

    expect(assetGraph, 'to contain assets', 9);
    expect(assetGraph, 'to contain relations', 9);
    expect(assetGraph, 'to contain asset', 'Png');
    expect(assetGraph, 'to contain assets', 'Html', 2);
    expect(assetGraph, 'to contain asset', { type: 'Html', isInline: true });
    expect(assetGraph, 'to contain asset', 'Css');
    expect(assetGraph, 'to contain assets', 'JavaScript', 3);
    expect(assetGraph, 'to contain asset', {
      type: 'JavaScript',
      isLoaded: false,
      fileName: 'notFound.js'
    });

    await assetGraph.addCacheManifest({ isInitial: true });

    expect(assetGraph, 'to contain asset', 'CacheManifest');
    expect(
      _.map(
        assetGraph.findRelations({ from: { type: 'CacheManifest' } }),
        'href'
      ),
      'to equal',
      ['foo.png', 'style.css', 'modernBrowsers.js']
    );
  });

  it('should add cache manifest to multiple pages', async function() {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '../../testdata/transforms/addCacheManifest/noCacheManifestMultiPage/'
      )
    });
    await assetGraph.loadAssets('*.html');
    await assetGraph.populate();

    expect(assetGraph, 'to contain assets', 3);
    expect(assetGraph, 'to contain relations', 4);
    expect(assetGraph, 'to contain asset', 'Png');
    expect(assetGraph, 'to contain assets', 'Html', 2);
    expect(assetGraph, 'to contain relations', 'HtmlIFrame');
    expect(assetGraph, 'to contain relations', 'HtmlImage', 2);

    await assetGraph.addCacheManifest({ isInitial: true });

    expect(assetGraph, 'to contain assets', 'CacheManifest', 2);

    const cacheManifest = assetGraph.findAssets({
      type: 'CacheManifest',
      incomingRelations: { $elemMatch: { from: { fileName: 'index.html' } } }
    })[0];
    expect(assetGraph, 'to contain relations', { from: cacheManifest }, 2);
    expect(assetGraph, 'to contain relation', {
      from: cacheManifest,
      to: { fileName: 'foo.png' }
    });
    expect(assetGraph, 'to contain relation', {
      from: cacheManifest,
      to: { fileName: 'otherpage.html' }
    });

    const otherCacheManifest = assetGraph.findAssets({
      type: 'CacheManifest',
      incomingRelations: {
        $elemMatch: { from: { fileName: 'otherpage.html' } }
      }
    })[0];
    expect(assetGraph, 'to contain relation', { from: otherCacheManifest });
    expect(
      assetGraph.findRelations({ from: cacheManifest })[0].to,
      'to equal',
      assetGraph.findAssets({ fileName: 'foo.png' })[0]
    );
  });

  it('should add a cache manifest and update the existing one in a multi-page test case with one existing manifest', async function() {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '../../testdata/transforms/addCacheManifest/existingCacheManifestMultiPage/'
      )
    });
    await assetGraph.loadAssets('*.html');
    await assetGraph.populate();

    expect(assetGraph, 'to contain assets', 'Html', 2);
    expect(assetGraph, 'to contain assets', 'Png', 2);
    expect(assetGraph, 'to contain asset', 'CacheManifest');
    expect(assetGraph, 'to contain asset', 'Css');

    await assetGraph.addCacheManifest({ isInitial: true });

    expect(assetGraph, 'to contain assets', 'CacheManifest', 2);

    const cacheManifest = assetGraph.findAssets({
      type: 'CacheManifest',
      incomingRelations: { $elemMatch: { from: { fileName: 'pageone.html' } } }
    })[0];
    expect(assetGraph, 'to contain relations', { from: cacheManifest }, 3);
    expect(assetGraph, 'to contain relation', {
      from: cacheManifest,
      to: { fileName: 'style.css' }
    });
    expect(assetGraph, 'to contain relation', {
      from: cacheManifest,
      to: { fileName: 'quux.png' }
    });
    expect(assetGraph, 'to contain relation', {
      from: cacheManifest,
      to: { fileName: 'foo.png' }
    });

    const pageTwoCacheManifest = assetGraph.findAssets({
      type: 'CacheManifest',
      incomingRelations: { $elemMatch: { from: { fileName: 'pagetwo.html' } } }
    })[0];
    expect(
      assetGraph,
      'to contain relations',
      { from: pageTwoCacheManifest },
      2
    );
    expect(assetGraph, 'to contain relation', {
      from: pageTwoCacheManifest,
      to: { fileName: 'style.css' }
    });
    expect(assetGraph, 'to contain relation', {
      from: pageTwoCacheManifest,
      to: { fileName: 'quux.png' }
    });
  });
});
