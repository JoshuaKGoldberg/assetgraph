#!/usr/bin/env node

var util = require('util'),
    path = require('path'),
    fs = require('fs'),
    step = require('step'),
    _ = require('underscore'),
    fileUtils = require('./fileUtils'),
    transforms = require('./transforms'),
    SiteGraph = require('./SiteGraph'),
    error = require('./error'),
    commandLineOptions = require('./camelOptimist')({usage: 'FIXME', demand: ['root']}),
    siteGraph = new SiteGraph({root: commandLineOptions.root + '/'}),
    templates = [];

step(
    function () {
        transforms.registerLabelsAsCustomProtocols(siteGraph, commandLineOptions.label || [], this);
    },
    error.logAndExit(function () {
        var group = this.group();
        commandLineOptions._.forEach(function (templateUrl) {
            siteGraph.loadAsset(templateUrl, group());
        });
    }),
    error.logAndExit(function (loadedTemplates) {
        templates = loadedTemplates;
        var group = this.group();
        templates.forEach(function (template) {
            siteGraph.populate(template, function (relation) {
                return ['HTMLScript', 'JavaScriptStaticInclude', 'JavaScriptIfEnvironment',
                        'HTMLStyle', 'CSSBackgroundImage'].indexOf(relation.type) !== -1;
            }, group());
        });
    }),
    error.logAndExit(function () {
        templates.forEach(function (template) {
            transforms.flattenStaticIncludes(siteGraph, template, this.parallel());
        }, this);
    }),
    error.logAndExit(function () {
        transforms.executeJavaScriptIfEnvironment(siteGraph, templates[0], 'buildDevelopment', this);
    }),
    error.logAndExit(function inlineDirtyAssets() {
        var numCallbacks = 0;
        siteGraph.relations.forEach(function (relation) {
            if (relation.to.dirty) {
                numCallbacks += 1;
                siteGraph.inlineRelation(relation, this.parallel());
            } else if (!relation.isInline && relation.to.url) {
                relation._setRawUrlString(fileUtils.buildRelativeUrl(relation.from.url, relation.to.url));
            }
        }, this);
        if (!numCallbacks) {
            process.nextTick(this);
        }
    }),
    error.logAndExit(function () {
        templates.forEach(function (template) {
            var callback = this.parallel();
            template.serialize(error.throwException(function (src) {
                fs.writeFile(fileUtils.fileUrlToFsPath(template.url).replace(/\.template$/, ''), src, 'utf8', callback);
            }));
        }, this);
    })
);
