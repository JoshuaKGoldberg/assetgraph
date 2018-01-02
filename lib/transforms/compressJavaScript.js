var _ = require('lodash');
var os = require('os');
var Promise = require('bluebird');
var uglifyJs = require('uglify-js');
var errors = require('../errors');
var compressorByName = {};

compressorByName.uglifyJs = function (assetGraph, javaScript, compressorOptions) {
    compressorOptions = compressorOptions || {};
    var sourceMaps = compressorOptions.sourceMaps;
    compressorOptions = _.extend({}, _.omit(compressorOptions, 'sourceMaps'));
    var mangleOptions = compressorOptions.mangleOptions;
    delete compressorOptions.mangleOptions;
    _.defaults(compressorOptions, _.pick(javaScript.serializationOptions, ['side_effects']), this.assetGraph && _.pick(this.assetGraph.javaScriptSerializationOptions, ['side_effects']));

    var ie8;
    if (javaScript.serializationOptions && typeof javaScript.serializationOptions.ie8 !== 'undefined') {
        ie8 = !!javaScript.serializationOptions.ie8;
    } else if (javaScript.serializationOptions && typeof javaScript.serializationOptions.screw_ie8 !== 'undefined') {
        ie8 = !javaScript.serializationOptions.screw_ie8;
    } else if (assetGraph.javaScriptSerializationOptions && typeof assetGraph.javaScriptSerializationOptions.ie8 !== 'undefined') {
        ie8 = !!assetGraph.javaScriptSerializationOptions.ie8;
    } else if (assetGraph.javaScriptSerializationOptions && typeof assetGraph.javaScriptSerializationOptions.screw_ie8 !== 'undefined') {
        ie8 = !assetGraph.javaScriptSerializationOptions.screw_ie8;
    }

    var text,
        sourceMap;
    if (sourceMaps) {
        var textAndSourceMap = javaScript.textAndSourceMap;
        text = textAndSourceMap.text;
        sourceMap = textAndSourceMap.sourceMap;
    } else {
        text = javaScript.text;
    }

    var result = uglifyJs.minify(text, {
        sourceMap: { content: sourceMap },
        compress: compressorOptions,
        mangle: mangleOptions,
        output: { comments: true, source_map: true, ast: true },
        ie8
    });
    if (result.error) {
        return Promise.reject(new errors.ParseError({
            message: 'Parse error in ' + javaScript.urlOrDescription + '\n' + result.error.message + ' (line ' + result.error.line + ', column ' + (result.error.col + 1) + ')',
            line: result.error.line,
            column: result.error.col + 1,
            asset: javaScript
        }));
    }
    var compressedJavaScript = new assetGraph.JavaScript({
        lastKnownByteLength: javaScript.lastKnownByteLength, // I know, I know
        copyrightNoticeComments: javaScript.copyrightNoticeComments,
        text: result.code,
        isDirty: true,
        isMinified: javaScript.isMinified,
        isPretty: javaScript.isPretty,
        sourceMap: result.map
    });
    return Promise.resolve(compressedJavaScript);
};

compressorByName.yuicompressor = function (assetGraph, javaScript, compressorOptions) {
    var yuicompressor;
    try {
        yuicompressor = require('yui-compressor');
    } catch (e) {
        throw new Error('transforms.compressJavaScript: node-yui-compressor not found. Please run \'npm install yui-compressor\' and try again (tested with version 0.1.3).');
    }
    compressorOptions = compressorOptions || {};
    return Promise.fromNode(function (cb) {
        yuicompressor.compile(javaScript.text, compressorOptions);
    }).then(function (compressedText) {
        return new assetGraph.JavaScript({
            copyrightNoticeComments: javaScript.copyrightNoticeComments,
            text: compressedText
        });
    });
};

compressorByName.closurecompiler = function (assetGraph, javaScript, compressorOptions) {
    var closurecompiler;
    try {
        closurecompiler = require('closure-compiler');
    } catch (e) {
        throw new Error('transforms.compressJavaScript: node-closure-compiler not found. Please run \'npm install closure-compiler\' and try again (tested with version 0.1.1).');
    }
    compressorOptions = compressorOptions || {};
    return Promise.fromNode(function (cb) {
        closurecompiler.compile(javaScript.text, compressorOptions, cb);
    }).then(function (compressedText) {
        return new assetGraph.JavaScript({
            copyrightNoticeComments: javaScript.copyrightNoticeComments,
            text: compressedText
        });
    });
};

module.exports = function (queryObj, compressorName, compressorOptions) {
    if (!compressorName) {
        compressorName = 'uglifyJs';
    }
    if (!compressorByName[compressorName]) {
        throw new Error('transforms.compressJavaScript: Unknown compressor: ' + compressorName);
    }
    return function compressJavaScript(assetGraph) {
        return Promise.map(assetGraph.findAssets(_.extend({type: 'JavaScript'}, queryObj)), function (javaScript) {
            return compressorByName[compressorName](assetGraph, javaScript, compressorOptions).then(function (compressedJavaScript) {
                javaScript.replaceWith(compressedJavaScript);
                compressedJavaScript.serializationOptions = _.extend({}, javaScript.serializationOptions);
                compressedJavaScript.initialComments = javaScript.initialComments;
                javaScript.unload();
            }, function (err) {
                assetGraph.emit('warn', err);
            });
        }, {concurrency: os.cpus().length + 1});
    };
};
