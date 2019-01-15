const pathModule = require('path');
/* global describe, it */
const expect = require('../unexpected-with-plugins');
const AssetGraph = require('../../lib/AssetGraph');

describe('transforms/inlineHtmlTemplates', function() {
  it('should handle a test case with a single Knockout.js template with a nested template loaded using the systemjs-tpl plugin', async function() {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '../../testdata/transforms/inlineHtmlTemplates/withNested/'
      )
    });
    await assetGraph
      .loadAssets('index.html')
      .populate({
        followRelations: { type: { $not: 'JavaScriptSourceMappingUrl' } }
      })
      .bundleSystemJs()
      .populate({
        followRelations: { type: { $not: 'JavaScriptSourceMappingUrl' } }
      })
      .inlineHtmlTemplates();

    expect(assetGraph, 'to contain relations', 'HtmlInlineScriptTemplate', 2);
    expect(
      assetGraph,
      'to contain relations',
      { type: 'HtmlInlineScriptTemplate', from: { fileName: 'index.html' } },
      2
    );
    expect(
      assetGraph.findAssets({ fileName: 'index.html' })[0].text,
      'to contain',
      '<script type="text/html" id="theEmbeddedTemplate" foo="bar">\n    <h1>This is an embedded template, which should also end up in the main document</h1>\n</script>' +
        '<script type="text/html" id="foo"><div></div>\n\n</script>'
    );
  });

  it('should handle a test case with several Knockout.js templates loaded using the systemjs-tpl plugin', async function() {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '../../testdata/transforms/inlineHtmlTemplates/multiple/'
      )
    });
    await assetGraph
      .loadAssets('index.html')
      .populate({
        followRelations: { type: { $not: 'JavaScriptSourceMappingUrl' } }
      })
      .bundleSystemJs()
      .populate({
        followRelations: { type: { $not: 'JavaScriptSourceMappingUrl' } }
      })
      .inlineHtmlTemplates();

    expect(assetGraph, 'to contain relations', 'HtmlInlineScriptTemplate', 6);
    expect(
      assetGraph,
      'to contain relations',
      { type: 'HtmlInlineScriptTemplate', from: { fileName: 'index.html' } },
      6
    );
    expect(
      assetGraph.findAssets({ fileName: 'index.html' })[0].text,
      'to contain',
      '<script type="text/html" id="theEmbeddedTemplate" foo="bar">\n    <h1>This is the embedded template, which should also end up in the main document</h1>\n</script>' +
        '<script type="text/html" foo="bar1">\n    <h1>This embedded template has no id. This too should end up in the main document, along with it\'s attributes</h1>\n</script>' +
        '<script type="text/html" foo="bar2">\n    <h1>This embedded template has no id. This too should end up in the main document, along with it\'s attributes</h1>\n</script>' +
        '<script type="text/html" id="foo"><img data-bind="attr: {src: \'/foo.png\'.toString(\'url\')}">\n</script><script type="text/html" id="bar"><div>\n    <h1>bar.ko</h1>\n</div>\n</script><script type="text/html" id="templateWithEmbeddedTemplate"><div data-bind="template: \'theEmbeddedTemplate\'"></div>\n\n\n\n</script></head>'
    );

    let relation = assetGraph.findRelations({
      type: 'HtmlInlineScriptTemplate',
      node(node) {
        return node.getAttribute('id') === 'foo';
      }
    })[0];
    expect(relation, 'to be ok');
    expect(
      relation.to.text,
      'to equal',
      "<img data-bind=\"attr: {src: '/foo.png'.toString('url')}\">\n"
    );

    relation = assetGraph.findRelations({
      type: 'HtmlInlineScriptTemplate',
      node(node) {
        return node.getAttribute('id') === 'bar';
      }
    })[0];
    expect(relation, 'to be ok');
    expect(
      relation.to.text,
      'to equal',
      '<div>\n    <h1>bar.ko</h1>\n</div>\n'
    );
  });

  it('should handle a test case with the same Knockout.js being loaded using the systemjs-tpl plugin in multiple .html pages', async function() {
    const assetGraph = new AssetGraph({
      root: pathModule.resolve(
        __dirname,
        '../../testdata/transforms/inlineHtmlTemplates/multipleInMultipleHtmlPages/'
      )
    });
    await assetGraph.loadAssets(['index1.html', 'index2.html']);
    await assetGraph.populate({
      followRelations: { type: { $not: 'JavaScriptSourceMappingUrl' } }
    });
    await assetGraph.bundleSystemJs();
    await assetGraph.populate({
      followRelations: { type: { $not: 'JavaScriptSourceMappingUrl' } }
    });
    await assetGraph.inlineHtmlTemplates();

    expect(assetGraph, 'to contain relations', 'HtmlInlineScriptTemplate', 12);
    expect(
      assetGraph,
      'to contain relations',
      { type: 'HtmlInlineScriptTemplate', from: { fileName: 'index1.html' } },
      6
    );
    expect(
      assetGraph.findAssets({ fileName: 'index1.html' })[0].text,
      'to contain',
      '<script type="text/html" id="theEmbeddedTemplate" foo="bar">\n    <h1>This is the embedded template, which should also end up in the main document</h1>\n</script>' +
        '<script type="text/html" foo="bar1">\n    <h1>This embedded template has no id. This too should end up in the main document, along with it\'s attributes</h1>\n</script>' +
        '<script type="text/html" foo="bar2">\n    <h1>This embedded template has no id. This too should end up in the main document, along with it\'s attributes</h1>\n</script>' +
        '<script type="text/html" id="foo"><img data-bind="attr: {src: \'/foo.png\'.toString(\'url\')}">\n</script><script type="text/html" id="bar"><div>\n    <h1>bar.ko</h1>\n</div>\n</script><script type="text/html" id="templateWithEmbeddedTemplate"><div data-bind="template: \'theEmbeddedTemplate\'"></div>\n\n\n\n</script></head>'
    );

    let relation = assetGraph.findRelations({
      type: 'HtmlInlineScriptTemplate',
      node(node) {
        return node.getAttribute('id') === 'foo';
      }
    })[0];
    expect(relation, 'to be ok');
    expect(
      relation.to.text,
      'to equal',
      "<img data-bind=\"attr: {src: '/foo.png'.toString('url')}\">\n"
    );

    relation = assetGraph.findRelations({
      type: 'HtmlInlineScriptTemplate',
      node(node) {
        return node.getAttribute('id') === 'bar';
      }
    })[0];
    expect(relation, 'to be ok');
    expect(
      relation.to.text,
      'to equal',
      '<div>\n    <h1>bar.ko</h1>\n</div>\n'
    );

    expect(
      assetGraph,
      'to contain relations',
      { type: 'HtmlInlineScriptTemplate', from: { fileName: 'index2.html' } },
      6
    );
    expect(
      assetGraph.findAssets({ fileName: 'index2.html' })[0].text,
      'to contain',
      '<script type="text/html" id="theEmbeddedTemplate" foo="bar">\n    <h1>This is the embedded template, which should also end up in the main document</h1>\n</script>' +
        '<script type="text/html" foo="bar1">\n    <h1>This embedded template has no id. This too should end up in the main document, along with it\'s attributes</h1>\n</script>' +
        '<script type="text/html" foo="bar2">\n    <h1>This embedded template has no id. This too should end up in the main document, along with it\'s attributes</h1>\n</script>' +
        '<script type="text/html" id="foo"><img data-bind="attr: {src: \'/foo.png\'.toString(\'url\')}">\n</script><script type="text/html" id="bar"><div>\n    <h1>bar.ko</h1>\n</div>\n</script><script type="text/html" id="templateWithEmbeddedTemplate"><div data-bind="template: \'theEmbeddedTemplate\'"></div>\n\n\n\n</script></head>'
    );

    relation = assetGraph.findRelations({
      type: 'HtmlInlineScriptTemplate',
      node(node) {
        return node.getAttribute('id') === 'foo';
      }
    })[0];
    expect(relation, 'to be ok');
    expect(
      relation.to.text,
      'to equal',
      "<img data-bind=\"attr: {src: '/foo.png'.toString('url')}\">\n"
    );

    relation = assetGraph.findRelations({
      type: 'HtmlInlineScriptTemplate',
      node(node) {
        return node.getAttribute('id') === 'bar';
      }
    })[0];
    expect(relation, 'to be ok');
    expect(
      relation.to.text,
      'to equal',
      '<div>\n    <h1>bar.ko</h1>\n</div>\n'
    );
  });
});
