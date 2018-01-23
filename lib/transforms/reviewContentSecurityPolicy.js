var urlModule = require('url');
var _ = require('lodash');
var crypto = require('crypto');
var ContentSecurityPolicy = require('../assets/ContentSecurityPolicy');

var directiveByRelationType = {
    HtmlStyle: 'styleSrc',
    CssImport: 'styleSrc',
    HtmlScript: 'scriptSrc',
    CssFontFaceSrc: 'fontSrc',
    HtmlObject: 'objectSrc',
    HtmlApplet: 'objectSrc',
    HtmlImage: 'imgSrc',
    CssImage: 'imgSrc',
    HtmlShortcutIcon: 'imgSrc',
    HtmlPictureSource: 'imgSrc',
    HtmlFluidIcon: 'imgSrc',
    SrcSetEntry: 'imgSrc',
    HtmlLogo: 'imgSrc',
    HtmlAppleTouchStartupImage: 'imgSrc',
    HtmlVideoPoster: 'imgSrc',
    HtmlVideo: 'mediaSrc',
    HtmlAudio: 'mediaSrc',
    HtmlFrame: 'frameSrc',
    HtmlIFrame: 'frameSrc',
    HtmlApplicationManifest: 'manifestSrc',
    JavaScriptFetch: 'connectSrc'
};

function toCamelCase(str) {
    return str.replace(/-([a-z])/g, function ($0, ch) {
        return ch.toUpperCase();
    });
}

function fromCamelCase(str) {
    return str.replace(/[A-Z]/g, function ($0) {
        return '-' + $0.toLowerCase();
    });
}

function isNonceOrHash(sourceExpression) {
    return /^'nonce-|^'sha\d+-/.test(sourceExpression);
}

module.exports = function (queryObj, options) {
    options = options || {};
    return function reviewContentSecurityPolicy(assetGraph) {
        var includePathByDirective = {};
        if (options.includePath) {
            _.flatten(options.includePath).forEach(function (directive) {
                includePathByDirective[toCamelCase(directive)] = true;
            });
        }

        function originFromUrl(url, directive) {
            if (assetGraph.root && url.indexOf(assetGraph.root) === 0) {
                return '\'self\'';
            } else if (options.includePath === true || includePathByDirective[directive]) {
                return url.replace(/^https?:\/\//, '');
            } else {
                var urlObj = urlModule.parse(url);
                var host = urlObj.hostname;
                if (urlObj.port && parseInt(urlObj.port, 10) !== {'https:': 443, 'http:': 80}[urlObj.protocol]) {
                    host += ':' + urlObj.port;
                }
                return host;
            }
        }

        assetGraph.findAssets(queryObj || { type: 'Html', isInline: false, isFragment: false, isLoaded: true }).forEach(function (htmlAsset) {
            var htmlContentSecurityPolicies = assetGraph.findRelations({from: htmlAsset, type: 'HtmlContentSecurityPolicy'});
            htmlContentSecurityPolicies.forEach(function (htmlContentSecurityPolicy) {
                var contentSecurityPolicy = htmlContentSecurityPolicy.to;
                var defaultSrc = contentSecurityPolicy.parseTree.defaultSrc;

                function supportsUnsafeInline(directive) {
                    return (
                        contentSecurityPolicy.parseTree[directive] ?
                            contentSecurityPolicy.parseTree[directive].indexOf('\'unsafe-inline\'') !== -1 :
                            defaultSrc && ContentSecurityPolicy.directiveFallsBackToDefaultSrc(directive) && defaultSrc.indexOf('\'unsafe-inline\'') !== -1
                    );
                }

                function hasNonceOrHash(directive) {
                    return (
                        contentSecurityPolicy.parseTree[directive] ?
                            contentSecurityPolicy.parseTree[directive].some(isNonceOrHash) :
                            defaultSrc && ContentSecurityPolicy.directiveFallsBackToDefaultSrc(directive) && defaultSrc.some(isNonceOrHash)
                    );
                }

                var disallowedRelationsByDirectiveAndOrigin = {};
                var seenNoncesByDirective = {};

                function noteAsset(asset, incomingRelation, directive) {
                    directive = directive || (incomingRelation && directiveByRelationType[incomingRelation.type]);
                    if (directive) {
                        if (asset.isInline) {
                            if ((directive === 'styleSrc' || directive === 'scriptSrc') && (!supportsUnsafeInline(directive) || hasNonceOrHash(directive))) {
                                disallowedRelationsByDirectiveAndOrigin[directive] = disallowedRelationsByDirectiveAndOrigin[directive] || {};
                                var hashSource = '\'sha256-' + crypto.createHash('sha256').update(asset.rawSrc).digest('base64') + '\'';
                                (disallowedRelationsByDirectiveAndOrigin[directive][hashSource] = disallowedRelationsByDirectiveAndOrigin[directive][hashSource] || []).push(incomingRelation);
                            } else if (/^data:/.test(incomingRelation.href)) {
                                disallowedRelationsByDirectiveAndOrigin[directive] = disallowedRelationsByDirectiveAndOrigin[directive] || {};
                                (disallowedRelationsByDirectiveAndOrigin[directive]['data:'] = disallowedRelationsByDirectiveAndOrigin[directive]['data:'] || []).push(incomingRelation);
                            }
                        } else if (!contentSecurityPolicy.allows(directive, asset.url)) {
                            disallowedRelationsByDirectiveAndOrigin[directive] = disallowedRelationsByDirectiveAndOrigin[directive] || {};
                            var origin = originFromUrl(asset.url, directive);
                            (disallowedRelationsByDirectiveAndOrigin[directive][origin] = disallowedRelationsByDirectiveAndOrigin[directive][origin] || []).push(incomingRelation);
                        }
                        if (incomingRelation.from.type === 'Html') {
                            var nonce = incomingRelation.node.getAttribute('nonce');
                            if (nonce) {
                                (seenNoncesByDirective[directive] = seenNoncesByDirective[directive] || []).push('\'nonce-' + nonce + '\'');
                                if (options.update) {
                                    incomingRelation.node.removeAttribute('nonce');
                                    incomingRelation.from.markDirty();
                                }
                            }
                        }
                    }
                }

                var isSeenByAssetId = {};
                isSeenByAssetId[htmlAsset.id] = true;
                assetGraph._traverse(htmlAsset, {type: assetGraph.query.not(['HtmlAnchor', 'HtmlMetaRefresh', 'JavaScriptSourceUrl', 'JavaScriptSourceMappingUrl', 'CssSourceUrl', 'CssSourceMappingUrl'])}, function (asset, incomingRelation) {
                    isSeenByAssetId[asset.id] = true;
                    if (incomingRelation && incomingRelation.type === 'HttpRedirect') {
                        // Work backwards through all the seen assets to find all relevant paths through this redirect:
                        var isSeenByRelationId = {};
                        var queue = [].concat(incomingRelation.from.incomingRelations.filter(function (relation) {
                            return isSeenByAssetId[relation.from.id];
                        }));
                        while (queue.length > 0) {
                            var relation = queue.shift();
                            if (!isSeenByRelationId[relation.id]) {
                                isSeenByRelationId[relation.id] = true;
                                if (relation.type === 'HttpRedirect') {
                                    Array.prototype.push.apply(queue, relation.from.incomingRelations.filter(function (relation) {
                                        return isSeenByAssetId[relation.from.id] && !isSeenByRelationId[relation.id];
                                    }));
                                } else {
                                    noteAsset(asset, incomingRelation, directiveByRelationType[relation.type]);
                                }
                            }
                        }
                    } else {
                        noteAsset(asset, incomingRelation);
                    }
                });

                var directives = _.uniq(Object.keys(disallowedRelationsByDirectiveAndOrigin).concat(Object.keys(seenNoncesByDirective)).concat(Object.keys(contentSecurityPolicy.parseTree)));

                if (options.infoObject) {
                    options.infoObject[contentSecurityPolicy.id] = {
                        additions: disallowedRelationsByDirectiveAndOrigin
                    };
                }

                directives.forEach(function (directive) {
                    var origins = Object.keys(disallowedRelationsByDirectiveAndOrigin[directive] || {});
                    if (options.update) {
                        if (contentSecurityPolicy.parseTree[directive]) {
                            origins = _.uniq(origins.concat(contentSecurityPolicy.parseTree[directive]));
                        } else if (ContentSecurityPolicy.directiveFallsBackToDefaultSrc(directive) && contentSecurityPolicy.parseTree.defaultSrc) {
                            origins = _.uniq(origins.concat(contentSecurityPolicy.parseTree.defaultSrc));
                        }
                        var noncesWereRemoved = false;
                        var originsWithNoncesSubtracted = _.difference(origins, ["'nonce-developmentonly'"].concat(seenNoncesByDirective[directive]));
                        if (originsWithNoncesSubtracted.length < origins.length) {
                            noncesWereRemoved = true;
                        }
                        origins = originsWithNoncesSubtracted;

                        // If we're removing 'nonce-developmentonly' when 'unsafe-inline' is in effect and there are no other
                        // nonces or hashes whitelisted, add the sha256 hash of the empty string to the list of allowed origins.
                        // This prevents 'unsafe-inline' from taking effect in CSP2+ compliant browsers that would otherwise
                        // ignore 'unsafe-inline' when at least one nonce or hash is present for the directive.
                        // https://www.w3.org/TR/CSP3/#match-element-to-source-list
                        if (noncesWereRemoved && origins.indexOf("'unsafe-inline'") !== -1 && !origins.some(isNonceOrHash)) {
                            origins.push("'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='");
                        } else if (origins.some(isNonceOrHash) && origins.indexOf("'unsafe-inline'") === -1) {
                            origins.push("'unsafe-inline'");
                        }
                        if (options.level < 2) {
                            origins = origins.filter(function (origin) {
                                return !isNonceOrHash(origin);
                            });
                        }
                        if (origins.length > 1) {
                            var indexOfNoneToken = origins.indexOf('\'none\'');
                            if (indexOfNoneToken !== -1) {
                                origins.splice(indexOfNoneToken, 1);
                            }
                        }
                        if (directive !== 'defaultSrc' && defaultSrc && ContentSecurityPolicy.directiveFallsBackToDefaultSrc(directive) && _.difference(defaultSrc, origins).length === 0 && _.difference(origins, defaultSrc).length === 0) {
                            delete contentSecurityPolicy.parseTree[directive];
                        } else {
                            contentSecurityPolicy.parseTree[directive] = origins.sort();
                        }
                        contentSecurityPolicy.markDirty();
                    } else {
                        var allowedOrigins = contentSecurityPolicy.parseTree[directive];
                        var directiveInEffect = directive;
                        if (!allowedOrigins) {
                            if (directive !== 'frameAncestors' && contentSecurityPolicy.parseTree.defaultSrc) {
                                directiveInEffect = 'defaultSrc';
                                allowedOrigins = contentSecurityPolicy.parseTree.defaultSrc;
                            } else {
                                allowedOrigins = ['\'none\''];
                            }
                        }
                        origins.forEach(function (nonWhitelistedOrigin) {
                            var relations = disallowedRelationsByDirectiveAndOrigin[directive][nonWhitelistedOrigin];
                            if (relations) {
                                relations = relations.filter(function (relation) {
                                    var nonce;
                                    if (relation.from.type === 'Html') {
                                        nonce = relation.node.getAttribute('nonce');
                                    }
                                    return !nonce || allowedOrigins.indexOf('\'nonce-' + nonce + '\'') === -1;
                                });
                                if (relations.length > 0) {
                                    assetGraph.emit(
                                        'warn',
                                        new Error(
                                            htmlAsset.urlOrDescription + ': ' + (relations.length === 1 ? 'An asset violates' : relations.length + ' relations violate') + ' the ' + fromCamelCase(directiveInEffect) + ' ' + allowedOrigins.join(' ') + ' Content-Security-Policy directive:\n  ' +
                                            relations.map(function (asset) {
                                                return asset.to.urlOrDescription;
                                            }).join('\n  ')
                                        )
                                    );
                                }
                            }
                        });
                    }
                });
            });
        });
    };
};
