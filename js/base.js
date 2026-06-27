
(function (global) {
    'use strict';
    var map = {};
    var pending = {};
    var config = {
        baseUrl: '',
        paths: {},
        bundles: {}
    };

    // Reverse mapping from module ID to bundle URL
    var bundleMap = {};

    var defaultCJSDeps = ["global", "requireModule", "requireDynamic", "requireLazy", "module", "exports"];

    var defaultESMDeps = ["global", "requireModule", "importDefault", "importNamespace", "requireLazy", "module", "exports"];

    var REQUIRE_WHEN_READY = 1;
    var ES_MODULE_IMPORTS = 32;
    var ES_MODULE_EXPORTS = 64;
    var EMPTY = {};

    var hasOwnProperty = Object.prototype.hasOwnProperty;

    /**
     * Configures the paths and bundles for the module loader.
     */
    function configModulePaths(options) {
        if (!options) return;

        if (options.baseUrl) {
            config.baseUrl = options.baseUrl;
        }

        // 1. Process standard 1-to-1 paths
        if (options.paths) {
            for (var moduleId in options.paths) {
                if (Object.prototype.hasOwnProperty.call(options.paths, moduleId)) {
                    config.paths[moduleId] = options.paths[moduleId];
                }
            }
        }

        // 🚀 2. Process the new 1-to-many bundles array
        if (options.bundles) {
            for (var bundlePath in options.bundles) {
                if (Object.prototype.hasOwnProperty.call(options.bundles, bundlePath)) {
                    var modulesInBundle = options.bundles[bundlePath];
                    
                    // Loop through the array and map each module to the bundle path
                    for (var i = 0; i < modulesInBundle.length; i++) {
                        var moduleName = modulesInBundle[i];
                        config.paths[moduleName] = bundlePath;
                    }
                }
            }
        }
    }

    // Resolve the URL for a module ID
    function resolveModuleUrl(id) {
        // Check if this module is in a bundle
        if (hasOwnProperty.call(bundleMap, id)) {
            return bundleMap[id];
        }

        // Check if this module has a custom path
        if (hasOwnProperty.call(config.paths, id)) {
            return config.paths[id];
        }

        // Use baseUrl with module ID
        return config.baseUrl + '/' + id + '.js';
    }

    function getOrInitializeModule(id, soft) {
        if (!hasOwnProperty.call(map, id)) {
            if (soft) {
                return null;
            }
            throw new Error("Module " + id + " has not been defined");
        }

        var module = map[id];
        if (module.resolved) {
            return module;
        }

        var _special = module.special;
        var length = module.factory.length;

        var deps = _special & ES_MODULE_IMPORTS ? defaultESMDeps.concat(module.deps) : defaultCJSDeps.concat(module.deps);

        var args = [];
        var dep;
        for (var i = 0; i < length; i++) {
            switch (deps[i]) {
                case "module":
                    dep = module;
                    break;
                case "exports":
                    dep = module.exports;
                    break;
                case "global":
                    dep = global;
                    break;
                case "requireModule":
                    dep = requireInterop;
                    break;
                case "requireDynamic":
                    dep = requireDynamic;
                    break;
                case "requireLazy":
                    dep = requireLazy;
                    break;
                case "importDefault":
                    dep = importDefault;
                    break;
                case "importNamespace":
                    dep = importNamespace;
                    break;
                default:
                    if (typeof deps[i] === "string") {
                        dep = requireInterop.call(null, deps[i]);
                    }
            }
            args.push(dep);
        }
        var ret = module.factory.apply(global, args);

        if (ret) {
            module.exports = ret;
        }

        if (_special & ES_MODULE_EXPORTS) {
            if (module.exports != null && hasOwnProperty.call(module.exports, "default")) {
                module.defaultExport = module.exports["default"];
            }
        } else {
            module.defaultExport = module.exports;
        }

        module.resolved = true;
        return module;
    }

    function requireInterop(id, soft) {
        var module = getOrInitializeModule(id, soft);

        if (module) {
            return module.defaultExport !== EMPTY ? module.defaultExport : module.exports;
        }
    }

    function importDefault(id) {
        var module = getOrInitializeModule(id);

        if (module) {
            return module.defaultExport !== EMPTY ? module.defaultExport : null;
        }
    }

    function importNamespace(id) {
        var module = getOrInitializeModule(id);

        if (module) {
            return module.exports;
        }
    }

    // Track loaded scripts to avoid duplicate loading
    var loadedScripts = {};

    // Load a script by URL
    function loadScript(url, callbacks) {
        // If this script is already being loaded
        if (hasOwnProperty.call(loadedScripts, url)) {
            if (loadedScripts[url] === true) {
                // Script is already loaded, call callbacks immediately
                for (var i = 0; i < callbacks.length; i++) {
                    callbacks[i]();
                }
            } else {
                // Script is loading, add callbacks to existing queue
                for (var i = 0; i < callbacks.length; i++) {
                    loadedScripts[url].push(callbacks[i]);
                }
            }
            return;
        }

        // Mark as loading and store callbacks
        loadedScripts[url] = callbacks;

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.src = url;

        script.onload = function() {
            // Mark as loaded
            var callbacksToExecute = loadedScripts[url];
            loadedScripts[url] = true;

            // Execute all callbacks
            for (var i = 0; i < callbacksToExecute.length; i++) {
                callbacksToExecute[i]();
            }
        };

        script.onerror = function() {
            console.error('Failed to load script: ' + url);
            // Execute callbacks anyway to avoid blocking
            var callbacksToExecute = loadedScripts[url];
            loadedScripts[url] = true;

            for (var i = 0; i < callbacksToExecute.length; i++) {
                callbacksToExecute[i]();
            }
        };

        document.head.appendChild(script);
    }

    // Lazy loading implementation
    function requireLazy(ids, callback) {
        var loadedModules = [];
        var remainingModules = ids.length;

        function onModuleLoaded() {
            remainingModules--;
            if (remainingModules === 0) {
                var modules = [];
                for (var i = 0; i < ids.length; i++) {
                    modules.push(requireInterop(ids[i]));
                }
                callback.apply(global, modules);
            }
        }

        for (var i = 0; i < ids.length; i++) {
            (function(idx) {
                var id = ids[idx];

                if (hasOwnProperty.call(map, id)) {
                    onModuleLoaded();
                    return;
                }

                // Module doesn't exist, we need to load it
                if (!hasOwnProperty.call(pending, id)) {
                    pending[id] = [];
                }

                pending[id].push(onModuleLoaded);

                // Check if this module is in a bundle
                var url = resolveModuleUrl(id);
                loadScript(url, [function() {
                    // If the module didn't self-register through define,
                    // we'll create an empty one to avoid errors
                    if (!hasOwnProperty.call(map, id) && !hasOwnProperty.call(pending, id)) {
                        define(id, [], function() {
                            console.warn('Module ' + id + ' did not register properly');
                            return {};
                        });
                    }
                }]);
            })(i);
        }
    }

    // Dynamic loading implementation
    function requireDynamic(id, callback) {
        
        // ✨ THE FIX: We removed `&& map[id].resolved`. 
        // If the module is in the map (whether resolved or asleep), 
        // requireInterop will automatically wake it up, resolve it, and return it.
        if (hasOwnProperty.call(map, id)) {
            if (callback) {
                callback(requireInterop(id));
            }
            return requireInterop(id);
        }

        // If the module is pending to be loaded
        if (hasOwnProperty.call(pending, id)) {
            if (callback) {
                pending[id].push(function() {
                    callback(requireInterop(id));
                });
            }
            return;
        }

        // Create a pending array for this module
        pending[id] = callback ? [function() { callback(requireInterop(id)); }] : [];

        // Resolve the URL for this module
        var url = resolveModuleUrl(id);

        // Load the script
        loadScript(url, [function() {
            // If the module didn't self-register through define,
            // we'll create an empty one to avoid errors
            if (!hasOwnProperty.call(map, id)) {
                define(id, [], function() {
                    console.warn('Module ' + id + ' did not register properly');
                    return {};
                });
            }

            // The pending callbacks will be handled by the define function
        }]);
    }

    function define(id, deps, factory, _special) {
        if (typeof factory === "function") {
            map[id] = {
                factory: factory,
                deps: deps,
                defaultExport: EMPTY,
                exports: {},
                special: _special || 0,
                resolved: false,
            };

            if (_special != null && _special & REQUIRE_WHEN_READY) {
                requireInterop.call(null, id);
            }

            // Notify any pending callbacks that the module has been defined
            if (hasOwnProperty.call(pending, id)) {
                var callbacks = pending[id];
                delete pending[id];
                for (var i = 0; i < callbacks.length; i++) {
                    callbacks[i]();
                }
            }
        } else {
            map[id] = {
                defaultExport: factory,
                exports: factory,
                resolved: true,
            };

            // Notify any pending callbacks
            if (hasOwnProperty.call(pending, id)) {
                var callbacks = pending[id];
                delete pending[id];
                for (var i = 0; i < callbacks.length; i++) {
                    callbacks[i]();
                }
            }
        }
    }

    global.defineModule = define;
    global.requireModule = requireInterop;
    global.requireLazy = requireLazy;
    global.requireDynamic = requireDynamic;
    global.configModulePaths = configModulePaths;
})(this);

defineModule("Env", [], (function(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';
}), 66);

defineModule("$", [], (function $selector(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';
    function $selector(selector) {
        return find(selector, typeof selector === "string" ? document.getElementById(selector) : selector);
    }
    /**
     * Get an element by the id or the element it self
     * @param {string} selector
     * @returns
     */
    function fromIDOrElement(selector) {
        return find(selector, typeof selector === "string" ? document.getElementById(selector) : selector);
    }

    function find(selector, element) {
        if (!element) {
            // TODO Throw error
        }
        return element;
    }
    $selector.fromIDOrElement = fromIDOrElement;
    module.exports = $selector;
}), null);

defineModule("Error", [], (function $err(global, require, requireDynamic, requireLazy, module, exports) {
    'use strict';

    function errorMsg(message) {
        throw new Error(message);
    }

    function throwError(e, type) {
        return errorMsg(e, type);
    }

    function throwIfTypeof(arg, type) {
        if (typeof arg !== type) {
            throw new TypeError(arg + " must be a " + type + " type");
        }
    }

    function throwErrorIf(expresion, message) {
        if (expresion) {
            return errorMsg(message);
        }
    }

    function throwIfInstanceOf(object, parent, expresion) {
        if (!(object instanceof parent)) {
            if (!expresion || typeof expresion === "undefined") {
                errorMsg(object.toString() + " must be an instance of " + parent.name.toString());
            }
        }
    }

    function throwIfOutOfRange(index, range) {
        if (index > range || index < 0) {
            throw new RangeError("");
        }
    }

    module.exports = {
        throw: throwError,
        throwIf: throwErrorIf,
        throwIfTypeof: throwIfTypeof,
        throwIfInstanceOf: throwIfInstanceOf,
        throwIfOutOfRange: throwIfOutOfRange
    };
}), null);

defineModule("CSSCore", [], (function $css_core(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    var h = 'hidden_ele';

    /**
     * Checks if the element contains a class name
     * @param {Element} element
     * @param {string} className
     */
    function hasClass(element, className) {
        if (element.classList) {
            return element.classList.contains(className);
        } else {
            return (' ' + element.className + ' ').indexOf(' ' + className + ' ') > -1;
        }
    };
    /**
     * Adds a new class to the element
     * @param {Element} element
     * @param {string} className
     */
    function addClass(element, className) {
        if (element.classList) {
            element.classList.add(className);
        } else {
            if (!hasClass(element, className)) {
                element.className = element.className + " " + className;
            }
        }
        return element;
    };
    /**
     * Removes a class from an element
     * @param {Element} element
     * @param {string} className
     */
    function removeClass(element, className) {
        if (element.classList) {
            element.classList.remove(className);
        } else {
            element.className = element.className.replace(new RegExp("(^|\\s)" + className + "(?:\\s|$)", "g"), "$1").replace(/\s+/g, " ").replace(/^\s*|\s*$/g, "");
        }
        return element;
    };
    /**
     * Toggles a class name on a given element
     * @param {Element} element
     * @param {string} className
     */
    function toggleClass(element, className) {
        return hasClass(element, className) ? removeClass(element, className) : addClass(element, className);
    };

    function conditionalClass(element, className, condition) {
        if (condition) {
            addClass(element, className);
        }
    }

    function conditionalToggleClass(element, className, condition) {
        if (condition) {
            addClass(element, className);
        } else {
            removeClass(element, className);
        }
    }

    /**
     * Adds a inline style to a given element
     * @param {Element} element
     * @param {Object} css_rules
     */
    function addInlineStyle(element, css_rules) {
        for (var i in css_rules) {
            element.style[i] = css_rules[i];
        }
        return element;
    }
    /**
     * Shows an element
     * @param {Element} element
     */
    function show(element) {
        return removeClass(element, h);
    }

    /**
     * Hides an element
     * @param {Element} element
     */
    function hide(element) {
        return addClass(element, h);
    }

    exports.hasClass = hasClass;
    exports.addClass = addClass;
    exports.removeClass = removeClass;
    exports.toggleClass = toggleClass;
    exports.conditionalClass = conditionalClass;
    exports.conditionalToggleClass = conditionalToggleClass;
    exports.addInlineStyle = addInlineStyle;
    exports.show = show;
    exports.hide = hide;
}), null);

defineModule("NodeUtils", ["CSSCore"], (function $nodeUtils(global, requireModule, requireDynamic, requireLazy, module, exports, CSSCore) {
    /**
     * Finds an element by a given tag name
     * @param {Element} node
     * @param {string} tagName
     */
    function byTag(node, tagName) {
        var find = this;
        tagName = tagName.toUpperCase();
        node = find(node, function(node) {
            return node.tagName === tagName;
        });
        return node instanceof Element ? node : null;
    }
    /**
     * Finds an element by a given class name
     * @param {Element} node
     * @param {string} className
     */
    function byClass(node, className) {
        var find = this;
        node = find(node, function(node) {
            return node instanceof Element && CSSCore.hasClass(node, className);
        });
        return node instanceof Element ? node : null;
    }
    /**
     * Finds an element by a given attribute
     * @param {Element} node
     * @param {string} attr
     * @param {string} value
     */
    function byAttribute(node, attr, value) {
        var find = this;
        node = find(node, function(node) {
            if (!value) {
                return node instanceof Element && node.hasAttribute(attr);
            }
            return node instanceof Element && node.hasAttribute(attr) && node.getAttribute(attr) == value;
        });
        return node instanceof Element ? node : null;
    }

    var finds = {
        byTag: byTag,
        byClass: byClass,
        byAttribute: byAttribute
    };

    var _default = {
        finds: finds
    };

    exports["default"] = _default;
}), 66);

defineModule("Sibling", ["NodeUtils"], (function $parent(global, requireModule, requireDynamic, requireLazy, module, exports, NodeUtils) {
    'use strict';

    /**
     * Finds the sibling node of the element
     * @param {Element} element
     * @param {Function} callback
     */
    function find(element, callback) {
        element = element;
        while (element) {
            if (callback(element)) {
                return element;
            }
            element = element.nextElementSibling;
        }
        return null;
    }

    exports.byTag = NodeUtils.finds.byTag.bind(find);
    exports.byClass = NodeUtils.finds.byClass.bind(find);
    exports.byAttribute = NodeUtils.finds.byAttribute.bind(find);
    exports.find = find;
}), null);

defineModule("Parent", ["NodeUtils"], (function $parent(global, requireModule, requireDynamic, requireLazy, module, exports, NodeUtils) {
    'use strict';

    /**
     * Finds the parent node of the element
     * @param {Element} element
     * @param {Function} callback
     */
    function find(element, callback) {
        element = element;
        while (element) {
            if (callback(element)) {
                return element;
            }
            element = element.parentNode;
        }
        return null;
    }

    exports.byTag = NodeUtils.finds.byTag.bind(find);
    exports.byClass = NodeUtils.finds.byClass.bind(find);
    exports.byAttribute = NodeUtils.finds.byAttribute.bind(find);
    exports.find = find;
}), null);

defineModule("Child", ["NodeUtils"], (function $child(global, requireModule, requireDynamic, requireLazy, module, exports, NodeUtils) {
    'use strict';

    /**
     *
     * @param {Element} element
     * @param {Function} callback
     */
    function find(element, callback) {
        var elements = element.children;
        for (var i = 0; i < elements.length; i++) {
            if (callback(elements[i])) {
                return elements[i];
            }
        }
        return null;
    }

    exports.byTag = NodeUtils.finds.byTag.bind(find);
    exports.byClass = NodeUtils.finds.byClass.bind(find);
    exports.byAttribute = NodeUtils.finds.byAttribute.bind(find);
    exports.find = find;

}), null);

defineModule("Children", [], (function $children(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    /**
     * Find all children element
     * @param {Element} node
     * @param {Function} callback
     * @returns Array<Element>
     */
    function find(node, callback) {
        var children = [];
        function traverseElementsNodes(child) {

            for (var i = 0; i < child.children.length; i++) {
                var currentChild = child.children[i];

                if (callback(currentChild)) {
                    children.push(currentChild);
                }

                if (currentChild.children.length) {
                    traverseElementsNodes(currentChild);
                }
            }

        }
        traverseElementsNodes(node);
        return children;
    }

    /**
     * Get all children elements from a given tag name
     * @param {Element} node
     * @param {string} tagName
     * @returns {Array<Element> | null}
     */
    function byTag(node, tagName) {
        tagName = tagName.toUpperCase();
        var nodes = find(node, function(node) {
            return node instanceof Element && node.tagName == tagName;
        });
        return nodes instanceof Array ? nodes : null;
    }

    /**
     *
     * @param {Element} node
     * @param {string} className
     * @returns {Array<Element> | null}
     */
    function byClass(node, className) {
        var nodes = find(node, function(node) {
            return node instanceof Element && requireModule("CSSCore").hasClass(node, className);
        });
        return nodes instanceof Array ? nodes : null
    }

    /**
     *
     * @param {Element} node
     * @param {string} attr
     * @param {string} value
     * @returns {Array<Element> | null}
     */
    function byAttribute(node, attr, value) {
        var nodes = find(node, function(node) {
             if (value) {
                return node instanceof Element && node.hasAttribute(attr) && node.getAttribute(attr) == value;
             }
             return node instanceof Element && !!node.hasAttribute(attr);
        });
        return nodes instanceof Array ? nodes : null;
    }

    exports.byTag = byTag;
    exports.byClass = byClass;
    exports.byAttribute = byAttribute;
    exports.find = find;
}), null);

defineModule("Number", [], (function $number(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    /**
     * Formats a given number into a readable currency format
     * @param {Number} d
     * @param {Object} formatConfig
     */
    function formatCurrency(d, formatConfig) {
        var hasPrefix         = Object.prototype.hasOwnProperty.call(formatConfig, "prefix");
        var hasCurrencyType   = Object.prototype.hasOwnProperty.call(formatConfig, "currency");
        var hasDigitDelimiter = Object.prototype.hasOwnProperty.call(formatConfig, "delimiter");

        var regex = /\B(?=(\d{3})+(?!\d))/g;
        var r = d.toString().replace(regex, hasDigitDelimiter ? formatConfig.delimiter : ",");
        var c;

        if (hasPrefix) {
            c = formatConfig.prefix + r;
        } else {
            c = r;
        }

        if (hasCurrencyType) {
            c = c + " " + formatConfig.currency;
        }

        return c;
    }

    /**
     * Returns a random integer  between min (incluse) and max (exclusie).
     * @param {Number} min
     * @param {Number} max
     * @returns {Number}
     */
    function generateRandom(min, max) {
        min = Math.ceil(min);
        max = Math.ceil(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    var currency = {
        format: formatCurrency
    };

    var random = {
        generate: generateRandom
    };

    var _default = {
        currency: currency,
        random: random
    };

    exports["default"] = _default;
}), 66);

defineModule("Cookie", [], (function $cookie(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    function setCookie(name, value, options = {}) {
        options = {
            path: "/",
            ...options
        }

        if (options.expires instanceof Date) {
            options.expires = options.expires.toUTCString();
        }
        var updatedCookie = encodeURIComponent(name) + "=" + encodeURIComponent(value);
        for (var optionKey in options) {
            updatedCookie += "; " + optionKey;
            var optionValue = options[optionKey];
            if (optionValue !== true) {
                updatedCookie += "=" + optionValue;
            }
        }
        document.cookie = updatedCookie;
    }
    function getCookie(name) {
        var matches = document.cookie.match(new RegExp(
            "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
        ));
        return matches ? decodeURIComponent(matches[1]) : null;
    }
    function deleteCookie(name) {
        setCookie(name, "", {
            "max-age": -1
        });
    }

    var cookie = {
        set: setCookie,
        get: getCookie,
        delete: deleteCookie
    };

    var _default = cookie;
    exports["default"] = _default;
}), 66);

defineModule("UserAgent", [], (function $ua(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    var uas = navigator.userAgent
    var devices = {
        iphone: /\b(iPhone|iP[ao]d)/.test(uas),
        ipad: /\b(iP[ao]d)/.test(uas),
        android: /Android/i.test(uas),
        nativeApp: /(XXX)/i.test(uas) && !/(XXX)/.test(uas),
        nativeAndroidApp: /XXX\/\w+;/i.test(uas),
        ucBrowser: /UCBrowser/i.test(uas)
    };

    var mobile = /Mobile/i.test(uas);

    var versions = {
        ie: NaN,
        firefox: NaN,
        chrome: NaN,
        webkit: NaN,
        osx: NaN,
        edge: NaN,
        operaMini: NaN,
        ucWeb: NaN
    };

    var agent =
        /(?:MSIE.(\d+\.\d+))|(?:(?:Firefox|GranParadiso|Iceweasel).(\d+\.\d+))|(?:AppleWebKit.(\d+(?:\.\d+)?))|(?:Trident\/\d+\.\d+.*rv:(\d+\.\d+))/.exec(
            uas);

    if (agent) {
        versions.ie = agent[1] ?
            parseFloat(agent[1]) :
            agent[4] ?
            parseFloat(agent[4]) :
            NaN;

        versions.firefox = agent[2] || "";
        versions.webkit = agent[3] || "";
        if (agent[3]) {
            var chromeAgent = /(?:Chrome\/(\d+\.\d+))/.exec(uas);
            versions.chrome = chromeAgent ? chromeAgent[1] : "";
            var edgeAgent = /(?:Edge\/(\d+\.\d+))/.exec(uas);
            versions.edge = edgeAgent ? edgeAgent[1] : "";
        }
    }


    var mac = /(?:Mac OS X (\d+(?:[._]\d+)?))/.exec(uas);
    if (mac) {
        versions.osx = mac[1];
    }

    var operaMini = /(?:Opera Mini\/(\d+(?:\.\d+)?))/.exec(uas);
    if (operaMini) {
        versions.operaMini = operaMini[1];
    }

    var ucWeb = /(?:UCWEB\/(\d+(?:\.\d+))?)/.exec(uas);
    if (ucWeb) {
        versions.ucWeb = ucWeb[1] || "2.0";
    }

    function getVersionParts(version) {
        return String(version).
        split(".").
        map(function map_$0(v) {
            return parseFloat(v);
        });
    }

    var UA = {};

    Object.keys(versions).map(function map_$0(key) {

        var getVersion = function getVersion() {
            return parseFloat(versions[key]);
        };
        getVersion.getVersionParts = function() {
            return getVersionParts(versions[key]);
        };

        UA[key] = getVersion;
    });

    Object.keys(devices).map(function map_$0(key) {
        UA[key] = function() {
            return devices[key];
        };
    });

    UA.mobile = function() {
        return devices.iphone || devices.ipad || devices.android || mobile;
    };

    UA.mTouch = function() {
        return devices.android || devices.iphone || devices.ipad;
    };
    UA.inAppBrowser = function() {
        return (
            devices.nativeApp || devices.nativeAndroidApp);
    };
    UA.mBasic = function() {
        return !!(versions.ucWeb || versions.operaMini);
    };
    var _default = UA;

    exports["default"] = _default;
}), 66);

defineModule("emptyFunction", [], (function $empty_function(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';
    function makeEmptyFunction(arg) {
        return function() {
            return arg;
        }
    }
    var emptyFunction = function emptyFunction() {};
    emptyFunction.thatReturns = makeEmptyFunction;
    emptyFunction.thatReturnsFalse = makeEmptyFunction(false);
    emptyFunction.thatReturnsTrue = makeEmptyFunction(true);
    emptyFunction.thatReturnsNull = makeEmptyFunction(null);
    emptyFunction.thatReturnsThis = function() {
        return this;
    };
    emptyFunction.thatReturnsArgument = function(arg) {
        return arg;
    };

    var _default = emptyFunction;
    exports["default"] = _default;
}), 66);

defineModule("Event", [], (function $event(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    let passiveSupported = false;

    try {
        const opts = Object.defineProperty({}, 'passive', { get: () => (passiveSupported = true) });
        window.addEventListener('test', null, opts);
        window.removeEventListener('test', null, opts);
    } catch (err) {
        passiveSupported = false;
    }

    function addListener(element, eventType, callback, isPassive) {
        var _passive = false;

        if (typeof isPassive !== "undefined") {
            if (!isPassive) {
                _passive = passiveSupported ? { passive : isPassive } : false;
            } else {
                if (["scroll", "wheel", "touchstart", "touchmove", "touchend"].indexOf(eventType) > -1) {
                    _passive = passiveSupported ? { passive : true } : false;
                }
            }
        }

        typeof element.addEventListener !== "undefined" ? (
            element.addEventListener(eventType, callback, _passive)
        ) : (
            element.attachEvent("on" + eventType, callback)
        );
    }
    function removeListener(element, eventType, callback) {
        var passive;
        if (["scroll", "wheel", "touchstart", "touchmove", "touchend"].indexOf(eventType) > -1) {
            passive = passiveSupported ? { passive : true } : false;
        } else {
            passive = false;
        }

        typeof element.removeEventListener !== "undefined" ? (
            element.removeEventListener(eventType, callback, passive)
        ) : (
            element.detachEvent("on" + eventType, callback)
        );
    }

    var $ = {
        addEventListener: addListener,
        removeEventListener: removeListener
    };

    module.exports = $;
}), null);

defineModule("EventType", [], (function $event(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    module.exports = {
        // Form / Input
        CHANGE: "change",
        INPUT: "input",
        INVALID: "invalid",
        RESET: "reset",
        SUBMIT: "submit",

        // Focus
        FOCUS: "focus",
        FOCUSIN: "focusin",
        FOCUSOUT: "focusout",
        BLUR: "blur",

        // Keyboard
        KEYBOARD: {
            KEYDOWN: "keydown",
            KEYUP: "keyup",
            KEYPRESS: "keypress" // deprecated but still used in legacy code
        },

        // Mouse
        MOUSE: {
            CLICK: "click",
            DBLCLICK: "dblclick",
            MOUSEDOWN: "mousedown",
            MOUSEUP: "mouseup",
            MOUSEMOVE: "mousemove",
            MOUSEENTER: "mouseenter",
            MOUSELEAVE: "mouseleave",
            MOUSEOVER: "mouseover",
            MOUSEOUT: "mouseout",
            CONTEXTMENU: "contextmenu",
            WHEEL: "wheel"
        },

        // Pointer (modern replacement for mouse + touch + pen)
        POINTER: {
            POINTERDOWN: "pointerdown",
            POINTERUP: "pointerup",
            POINTERMOVE: "pointermove",
            POINTERENTER: "pointerenter",
            POINTERLEAVE: "pointerleave",
            POINTEROVER: "pointerover",
            POINTEROUT: "pointerout",
            POINTERCANCEL: "pointercancel"
        },

        // Touch
        TOUCH: {
            TOUCHSTART: "touchstart",
            TOUCHMOVE: "touchmove",
            TOUCHEND: "touchend",
            TOUCHCANCEL: "touchcancel"
        },

        // Clipboard
        CLIPBOARD: {
            COPY: "copy",
            CUT: "cut",
            PASTE: "paste"
        },

        // Drag & Drop
        DRAG: {
            DRAG: "drag",
            DRAGSTART: "dragstart",
            DRAGEND: "dragend",
            DRAGENTER: "dragenter",
            DRAGLEAVE: "dragleave",
            DRAGOVER: "dragover",
            DROP: "drop"
        },

        // Composition (IME input)
        COMPOSITION: {
            COMPOSITIONSTART: "compositionstart",
            COMPOSITIONUPDATE: "compositionupdate",
            COMPOSITIONEND: "compositionend"
        },

        // Media (audio/video)
        MEDIA: {
            PLAY: "play",
            PAUSE: "pause",
            ENDED: "ended",
            TIMEUPDATE: "timeupdate",
            VOLUMECHANGE: "volumechange",
            SEEKED: "seeked",
            SEEKING: "seeking",
            CANPLAY: "canplay",
            CANPLAYTHROUGH: "canplaythrough",
            LOADEDDATA: "loadeddata",
            LOADEDMETADATA: "loadedmetadata",
            ERROR: "error"
        },

        // Window / Document
        WINDOW: {
            LOAD: "load",
            BEFOREUNLOAD: "beforeunload",
            UNLOAD: "unload",
            RESIZE: "resize",
            SCROLL: "scroll",
            HASHCHANGE: "hashchange",
            POPSTATE: "popstate"
        },

        // Selection
        SELECTION: {
            SELECT: "select",
            SELECTIONCHANGE: "selectionchange"
        }
    };
}), null);

defineModule("KeyboardEvent", [], (function $event(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    /**
     *
     * @param {Number} keyCode
     * @param {string} key
     * @param {KeyboardEvent} event
     */
    function matchKeys(keyCode, key, event) {
        var match = false;
        var supportsKeyCode = typeof event.keyCode !== undefined;

        if (supportsKeyCode && event.keyCode == keyCode) {
            match = true;
        } else if (!supportsKeyCode && (event.code == key || event.key == key)) {
            match = true;
        }
        return match;
    }

    var events = {
        matchKeys: matchKeys
    };

    module.exports = events;
}), null);

defineModule("DOMUtils", [], (function $event(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    async function copy(k, callback) {
        var success;
        try {
            // Check if the Clipboard API is supported by the browser
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(k.value);
            } else {
                console.warn('Clipboard API not supported by this browser.');
              // Fallback for older browsers (e.g., using document.execCommand)
              // This method is generally discouraged for new development
              // due to its limitations and deprecation in some contexts.
                if (typeof document.execCommand != "undefined") {
                    k.select();
                    success = document.execCommand("copy");
                }
            }
        } catch (err) {
        }
    }

    var events = {
        copy: copy
    };

    module.exports = events;
}), null);

defineModule("StringUtils", [], (function $event(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    /**
     * Capitalize the first letter of a given word
     * @param {string} str
     */
    function capitalize(str) {
        if (str.length == 0) return "";
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    function isValidEmail(email) {
        const emailRegex = new RegExp(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
        return emailRegex.test(email);
    }


    module.exports = {
        capitalize: capitalize,
        isValidEmail: isValidEmail
    };
}), null);

defineModule("DOMEvent", ["Event"], (function $dom_event(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';
    var a = (function () {
        function event(a) {
            (this.event = a || window.event);
            (this.target = this.event.target || this.event.srcElement);
            (this.type = this.event.type);
        }
        event.prototype.preventDefault = function() {
            var a = this.event;
            a.preventDefault ? (a.preventDefault(), "defaultPrevented" in a || (a.defaultPrevented = true)) : (a.returnValue = false);
            return this;
        };
        event.prototype.isDefaultPrevented = function() {
            var a = this.event;
            return "defaultPrevented" in a ? a.defaultPrevented : a.returnValue === false;
        };
        event.prototype.stopPropagation = function() {
            var a = this.event;
            a.stopPropagation ? a.stopPropagation() : (a.cancelBubble = true);
            return this;
        };
        event.prototype.kill = function() {
            this.stopPropagation().preventDefault();
            return this;
        };
        return event;
    })();
    module.exports = a;
}), null);

defineModule("TouchAdapter", ["EventType"], function(global, requireModule, requireDynamic, requireLazy, module, exports, EventType) {
    'use strict';

    var startX = 0, startY = 0, distX = 0, distY = 0,
        startTime = 0,
        swipeDirection = "none",
        longPressTimeout = 600,
        dragThreshold = 10,
        isDragging = false,
        timerForLongPress = null;

    function resetTimers() {
        if (timerForLongPress) { clearTimeout(timerForLongPress); timerForLongPress = null; }
    }

    function touchStart(evtRef, callback) {
        var touch = evtRef.event.changedTouches[0];
        startX = touch.pageX;
        startY = touch.pageY;
        startTime = Date.now();
        isDragging = false;
        swipeDirection = "none";

        var touchObject = {
            startX, startY,
            startTime,
            isTap: false,
            isLongPress: false,
            isDragging: false,
            blockScroll: false,
            target: evtRef.target
        };

        // Long press timer
        timerForLongPress = setTimeout(function() {
            touchObject.isLongPress = true;
            touchObject.blockScroll = true;
            callback.call(evtRef, touchObject);
        }, longPressTimeout);

        // do not callback yet, wait for long press / tap / swipe / drag
    }

    function touchMove(evtRef, callback) {
        var touch = evtRef.event.changedTouches[0];
        distX = touch.pageX - startX;
        distY = touch.pageY - startY;

        var touchObject = {
            distanceX: distX,
            distanceY: distY,
            isDragging: isDragging,
            blockScroll: false
        };

        // Cancel long press if moved
        if (Math.abs(distX) > 5 || Math.abs(distY) > 5) resetTimers();

        // Start dragging
        if (!isDragging && (Math.abs(distX) > dragThreshold || Math.abs(distY) > dragThreshold)) {
            isDragging = true;
            touchObject.isDragging = true;
            touchObject.blockScroll = true; // block scrolling when dragging
        }

        if (isDragging) callback.call(evtRef, touchObject);
    }

    function touchEnd(evtRef, callback) {
        var touch = evtRef.event.changedTouches[0];
        distX = touch.pageX - startX;
        distY = touch.pageY - startY;
        var elapsedTime = Date.now() - startTime;

        resetTimers();

        var touchObject = {
            startX, startY,
            distanceX: distX,
            distanceY: distY,
            elapsedTime,
            isTap: false,
            isDragRelease: isDragging,
            blockScroll: false,
            direction: null
        };

        // Tap detection
        if (elapsedTime < 200 && Math.abs(distX) < 5 && Math.abs(distY) < 5) {
            touchObject.isTap = true;
        }

        // Swipe detection
        if (elapsedTime <= 500) {
            if (Math.abs(distX) >= 50 && Math.abs(distY) <= 100) swipeDirection = distX < 0 ? "left" : "right";
            else if (Math.abs(distY) >= 50 && Math.abs(distX) <= 100) swipeDirection = distY < 0 ? "up" : "down";
        }

        // Edge swipe
        if (startY > window.innerHeight - 50 && distY < -50) swipeDirection = "bottom-to-top";
        else if (startY < 50 && distY > 50) swipeDirection = "top-to-bottom";

        touchObject.direction = swipeDirection;

        isDragging = false;
        callback.call(evtRef, touchObject);
    }

    function touchCancel(evtRef, callback) {
        resetTimers();
        isDragging = false;
        callback.call(evtRef, { cancelled: true });
    }

    function handleTouch(evtRef, type, callback) {
        switch (type) {
            case EventType.TOUCH.TOUCHSTART: return touchStart(evtRef, callback);
            case EventType.TOUCH.TOUCHMOVE: return touchMove(evtRef, callback);
            case EventType.TOUCH.TOUCHEND: return touchEnd(evtRef, callback);
            case EventType.TOUCH.TOUCHCANCEL: return touchCancel(evtRef, callback);
        }
    }

    module.exports = { handleTouch };
}, null);

defineModule("TouchEvent", ["EventType", "TouchAdapter"], function(global, requireModule, requireDynamic, requireLazy, module, exports, EventType, adapter) {
    'use strict';

    function TouchEventWrapper(event) {
        this.event = event;
        this.target = event.target || event.srcElement;
        this.type = event.type;

        // Gesture callbacks
        this.onTapCallback = null;
        this.onLongTapCallback = null;
        this.onSwipeCallback = null;
        this.onSwipeLeftCallback = null;
        this.onSwipeRightCallback = null;
        this.onSwipeUpCallback = null;
        this.onSwipeDownCallback = null;
        this.onSwipeTopToBottomCallback = null;
        this.onSwipeBottomToTopCallback = null;
        this.onDragStartCallback = null;
        this.onDragMoveCallback = null;
        this.onDropCallback = null;
        this.onDragCancelCallback = null;
    }

    TouchEventWrapper.prototype.preventDefault = function() {
        if (this.event.preventDefault) this.event.preventDefault();
        else this.event.returnValue = false;
        return this;
    };

    TouchEventWrapper.prototype.stopPropagation = function() {
        if (this.event.stopPropagation) this.event.stopPropagation();
        else this.event.cancelBubble = true;
        return this;
    };

    TouchEventWrapper.prototype.kill = function() {
        return this.preventDefault().stopPropagation();
    };
    
    TouchEventWrapper.prototype.onTap = function(callback) {
        this.onTapCallback = callback;
        return this;
    };

    // Gesture registration
    ['onLongTap', 'onSwipe', 'onSwipeLeft','onSwipeRight','onSwipeUp','onSwipeDown','onSwipeTopToBottom','onSwipeBottomToTop','onDragStart','onDragMove','onDrop','onDragCancel']
    .forEach(function(method) {
        TouchEventWrapper.prototype[method] = function(cb) {
            if (typeof cb !== "function") throw new TypeError("callback must be a function");
            this[method+'Callback'] = cb;
            return this;
        };
    });

    // InitHandler
    TouchEventWrapper.prototype.initHandler = function() {
        var self = this;
        adapter.handleTouch(this, this.type, function(touch) {

            // Prevent page scroll if needed
            if (touch.blockScroll) self.preventDefault();

            // Trigger gestures
            if (touch.isTap && self.onTapCallback) self.onTapCallback.call(self, touch);
            if (touch.isLongPress && self.onLongTapCallback) self.onLongTapCallback.call(self, touch);
            if (touch.isDragging && self.onDragMoveCallback) self.onDragMoveCallback.call(self, touch);
            if (touch.isDragRelease && self.onDropCallback) self.onDropCallback.call(self, touch);

            if (self.onSwipeCallback) self.onSwipeCallback.call(self, touch);
            switch(touch.direction) {
                case 'left': if(self.onSwipeLeftCallback) self.onSwipeLeftCallback.call(self, touch); break;
                case 'right': if(self.onSwipeRightCallback) self.onSwipeRightCallback.call(self, touch); break;
                case 'up': if(self.onSwipeUpCallback) self.onSwipeUpCallback.call(self, touch); break;
                case 'down': if(self.onSwipeDownCallback) self.onSwipeDownCallback.call(self, touch); break;
                case 'top-to-bottom': if(self.onSwipeTopToBottomCallback) self.onSwipeTopToBottomCallback.call(self, touch); break;
                case 'bottom-to-top': if(self.onSwipeBottomToTopCallback) self.onSwipeBottomToTopCallback.call(self, touch); break;
            }
        });
    };

    module.exports = TouchEventWrapper;
}, null);

defineModule("TouchBinder", ["$", "TouchEvent", "EventType"], function(global, requireModule, requireDynamic, requireLazy, module, exports, $, TouchEvent, EventType) {
    'use strict';

    function bind(selectorOrElement, setupCallback) {
        var element = $.fromIDOrElement(selectorOrElement);
        if (!element) throw new Error("Element not found: "+selectorOrElement);

        ['touchstart','touchmove','touchend','touchcancel'].forEach(function(type) {
            element.addEventListener(type, function(e) {
                var touchEvt = new TouchEvent(e);
                if (setupCallback) setupCallback(touchEvt);
                touchEvt.initHandler();
            }, { passive: false }); // important to allow preventDefault
        });

        return element;
    }

    module.exports = { bind };
}, null);

defineModule("QueryString", [], function(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    var hasOwn = Object.prototype.hasOwnProperty;

    /**
     * QueryString
     * A lightweight utility for parsing, manipulating, and serializing URL query strings.
     *
     * Supported input types:
     *  - String (full URL or query string)
     *  - URLSearchParams
     *  - Plain object
     *
     * @constructor
     * @param {string|Object|URLSearchParams} [input]
     */
    function QueryString(input) {
        /**
         * Internal parameter storage.
         * Values can be string or array (for repeated keys).
         * @type {Object.<string, string|Array<string>>}
         */
        this.params = {};

        if (!input) return;

        // String input (URL or query string)
        if (typeof input === "string") {
            this._fromString(input);
            return;
        }

        // URLSearchParams input
        if (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams) {
            var self = this;
            input.forEach(function(value, key) {
                self._append(key, value);
            });
            return;
        }

        // Object input
        if (typeof input === "object") {
            for (var key in input) {
                if (hasOwn.call(input, key)) {
                    this._append(key, input[key]);
                }
            }
        }
    }

    /**
     * Internal: Append value while preserving multiple entries.
     * @private
     * @param {string} key
     * @param {string} value
     */
    QueryString.prototype._append = function(key, value) {
        if (this.params[key] === undefined) {
            this.params[key] = value;
        } else if (Array.isArray(this.params[key])) {
            this.params[key].push(value);
        } else {
            this.params[key] = [this.params[key], value];
        }
    };

    /**
     * Internal: Parse string into params.
     * Supports full URLs and raw query strings.
     * @private
     * @param {string} str
     */
    QueryString.prototype._fromString = function(str) {
        var queryIndex = str.indexOf('?');

        if (queryIndex !== -1) {
            str = str.slice(queryIndex + 1);
        }

        if (!str) return;

        var pairs = str.split('&');

        for (var i = 0; i < pairs.length; i++) {
            var part = pairs[i];
            if (!part) continue;

            var eqIndex = part.indexOf('=');
            var key, value;

            if (eqIndex === -1) {
                key = decodeURIComponent(part);
                value = '';
            } else {
                key = decodeURIComponent(part.slice(0, eqIndex));
                value = decodeURIComponent(part.slice(eqIndex + 1));
            }

            this._append(key, value);
        }
    };

    /**
     * Encode parameters into query string.
     *
     * @returns {string} Example: "a=1&b=hello"
     */
    QueryString.prototype.encode = function() {
        var parts = [];

        for (var key in this.params) {
            if (!hasOwn.call(this.params, key)) continue;

            var value = this.params[key];
            var encodedKey = encodeURIComponent(key);

            if (Array.isArray(value)) {
                for (var i = 0; i < value.length; i++) {
                    parts.push(encodedKey + '=' + encodeURIComponent(value[i]));
                }
            } else {
                parts.push(encodedKey + '=' + encodeURIComponent(value));
            }
        }

        return parts.join('&');
    };

    /**
     * Returns query string prefixed with '?'.
     *
     * @returns {string}
     */
    QueryString.prototype.toString = function() {
        var str = this.encode();
        return str ? '?' + str : '';
    };

    /**
     * Check if a key exists.
     *
     * @param {string} key
     * @returns {boolean}
     */
    QueryString.prototype.has = function(key) {
        return hasOwn.call(this.params, key);
    };

    /**
     * Get first value for a key.
     *
     * @param {string} key
     * @returns {string|undefined}
     */
    QueryString.prototype.get = function(key) {
        var value = this.params[key];

        if (Array.isArray(value)) {
            return value[0];
        }

        return value;
    };

    /**
     * Get all values for a key.
     *
     * @param {string} key
     * @returns {Array<string>}
     */
    QueryString.prototype.getAll = function(key) {
        var value = this.params[key];

        if (value === undefined) return [];

        return Array.isArray(value) ? value.slice() : [value];
    };

    /**
     * Set a value (overwrites existing).
     *
     * @param {string} key
     * @param {string} value
     */
    QueryString.prototype.set = function(key, value) {
        this.params[key] = value;
    };

    /**
     * Append a value (keeps existing values).
     *
     * @param {string} key
     * @param {string} value
     */
    QueryString.prototype.append = function(key, value) {
        this._append(key, value);
    };

    /**
     * Delete a key and its values.
     *
     * @param {string} key
     */
    QueryString.prototype.delete = function(key) {
        delete this.params[key];
    };

    /**
     * Remove all parameters.
     */
    QueryString.prototype.clear = function() {
        this.params = {};
    };

    /**
     * Get all keys.
     *
     * @returns {Array<string>}
     */
    QueryString.prototype.keys = function() {
        return Object.keys(this.params);
    };

    /**
     * Get all values (first value per key).
     *
     * @returns {Array<string>}
     */
    QueryString.prototype.values = function() {
        var keys = Object.keys(this.params);
        var result = [];

        for (var i = 0; i < keys.length; i++) {
            result.push(this.get(keys[i]));
        }

        return result;
    };

    /**
     * Get all entries as [key, value].
     *
     * @returns {Array<Array>}
     */
    QueryString.prototype.entries = function() {
        var keys = Object.keys(this.params);
        var result = [];

        for (var i = 0; i < keys.length; i++) {
            result.push([keys[i], this.get(keys[i])]);
        }

        return result;
    };

    /**
     * Convert parameters to FormData.
     *
     * @returns {FormData}
     */
    QueryString.prototype.toFormData = function() {
        var formData = new FormData();

        for (var key in this.params) {
            if (!hasOwn.call(this.params, key)) continue;

            var value = this.params[key];

            if (Array.isArray(value)) {
                for (var i = 0; i < value.length; i++) {
                    formData.append(key, value[i]);
                }
            } else {
                formData.append(key, value);
            }
        }

        return formData;
    };

    /**
     * Convert parameters to JSON string.
     *
     * @param {string} [prefixKey] Optional wrapper key.
     * @returns {string}
     */
    QueryString.prototype.toJSON = function(prefixKey) {
        var json = JSON.stringify(this.params);

        if (typeof prefixKey === "string") {
            return prefixKey + '=' + json;
        }

        return json;
    };

    /**
     * Clone current instance.
     *
     * @returns {QueryString}
     */
    QueryString.prototype.clone = function() {
        return new QueryString(this.params);
    };

    module.exports = QueryString;

}, null);

defineModule("RequestBuilder", ["QueryString"], function (
    global,
    requireModule,
    requireDynamic,
    requireLazy,
    module,
    exports,
    QueryString
) {
    'use strict';

    var hasOwn = Object.prototype.hasOwnProperty;

    var DEFAULT_XHR_HEADER_NAME = "X-Requested-With";
    var DEFAULT_XHR_HEADER_VALUE = "XMLHttpRequest";

    function Builder(request) {
        this.request = request;
        this.xhr = Builder.getInstance();
        this.init();
    }

    /* =========================
       Core lifecycle
    ========================= */

    Builder.prototype.init = function () {
        this.prepareURL();
        this.open();
        this.attachEvents();
        this.setRequestHeaders();
        this.send();
    };

    /* =========================
       URL handling (QueryString integration)
    ========================= */

    Builder.prototype.prepareURL = function () {
        var method = this.request.getMethod();
        var data = this.request.getData();
        var uri = this.request.getURI();

        if (method === "GET" && data && typeof data === "object" && !(data instanceof FormData)) {
            var qs = new QueryString(data);
            var query = qs.encode();

            if (query) {
                if (uri instanceof URL) {
                    uri.search = query;
                } else {
                    uri += (uri.indexOf('?') === -1 ? '?' : '&') + query;
                }
            }

            // Prevent sending body in GET
            this.request.setData(null);
        }
    };

    /* =========================
       XHR setup
    ========================= */

    Builder.prototype.open = function () {
        var method = this.request.getMethod();
        var uri = this.request.getURI();

        requireModule("Error").throwIf(
            method === "GET" && this.request.getData() instanceof FormData,
            "FormData must be sent over POST method."
        );

        this.xhr.open(method, uri instanceof URL ? uri.href : uri, true);
    };

    Builder.prototype.attachEvents = function () {
        var self = this;

        // Ready state
        this.xhr.addEventListener("readystatechange", function () {
            if (self.xhr.readyState === self.xhr.DONE) {
                self.handleReadyState(self.xhr);
            }
        });

        // Network error
        this.xhr.addEventListener("error", function () {
            self.handleError(self.xhr);
        });

        // Upload events
        if (this.request.withFiles && this.xhr.upload) {
            var upload = this.xhr.upload;

            var events = [
                "loadstart",
                "progress",
                "load",
                "loadend",
                "abort",
                "error",
                "timeout"
            ];

            for (var i = 0; i < events.length; i++) {
                (function (eventType) {
                    upload.addEventListener(eventType, function (event) {
                        self.handleUpload(eventType, event);
                    });
                })(events[i]);
            }
        }
    };

    /* =========================
       Headers
    ========================= */

    Builder.prototype.setRequestHeaders = function () {
        var data = this.request.getData();

        if (!(data instanceof FormData)) {
            this.request.headers = this.request.headers || {};
            this.request.headers["Content-Type"] = "application/x-www-form-urlencoded";
        } else if (this.request.headers && this.request.headers["Content-Type"]) {
            delete this.request.headers["Content-Type"];
        }

        this.request.headers = this.request.headers || {};
        this.request.headers[DEFAULT_XHR_HEADER_NAME] = DEFAULT_XHR_HEADER_VALUE;

        var csrf = requireModule("$").fromIDOrElement("csrf_token");
        if (!this.request.defaultHeaders && csrf) {
            this.request.headers["X-CSRF-TOKEN"] = csrf.getAttribute("content");
        }

        var headers = this.request.headers;
        for (var key in headers) {
            if (hasOwn.call(headers, key)) {
                this.xhr.setRequestHeader(key, headers[key]);
            }
        }
    };

    /* =========================
       Payload (QueryString integration)
    ========================= */

    Builder.prototype.preparePayload = function () {
        var data = this.request.getData();

        if (!data) return null;

        if (data instanceof FormData) {
            return data;
        }

        if (typeof data === "object") {
            return new QueryString(data).encode();
        }

        return data;
    };

    Builder.prototype.send = function () {
        this.xhr.send(this.preparePayload());
    };

    /* =========================
       Handlers
    ========================= */

    Builder.prototype.handleReadyState = function (xhr) {
        if (xhr.status >= 200 && xhr.status < 300) {
            this.request.onSuccessCallback && this.request.onSuccessCallback(xhr);
        } else {
            this.request.onErrorCallback && this.request.onErrorCallback(xhr);
        }
    };

    Builder.prototype.handleError = function (xhr) {
        this.request.onErrorCallback && this.request.onErrorCallback(xhr);
    };

    Builder.prototype.handleUpload = function (type, event) {
        var response = {
            type: type,
            loaded: event.loaded || 0,
            total: event.total || 0,
            percent: event.lengthComputable
                ? Math.ceil((event.loaded / event.total) * 100)
                : null,
            timeStamp: Math.round(event.timeStamp)
        };

        switch (type) {
            case "progress":
                if (event.lengthComputable && this.request.onProgressCallback) {
                    this.request.onProgressCallback(response);
                }
                break;

            case "load":
                this.request.onUploadCompleteCallback &&
                    this.request.onUploadCompleteCallback(response);
                break;

            case "error":
                this.request.onUploadErrorCallback &&
                    this.request.onUploadErrorCallback(response);
                break;

            case "abort":
                this.request.onAbortCallback &&
                    this.request.onAbortCallback(response);
                break;

            case "timeout":
                this.request.onTimeoutCallback &&
                    this.request.onTimeoutCallback(response);
                break;

            case "loadstart":
            case "loadend":
                // Optional hooks if you want lifecycle tracking
                this.request.onUploadStateChangeCallback &&
                    this.request.onUploadStateChangeCallback(response);
                break;
        }
    };
    /* =========================
       Factory
    ========================= */

    Builder.getInstance = function () {
        var xhr;

        if (typeof XMLHttpRequest !== "function") {
            xhr = new ActiveXObject("Microsoft.XMLHTTP");
        } else {
            xhr = new XMLHttpRequest();
            xhr.withCredentials = true;
        }

        return xhr;
    };

    module.exports = {
        initAndSend: function (request) {
            return new Builder(request);
        }
    };

}, null);

defineModule("AsyncRequest", ["RequestBuilder"], function (global, requireModule, requireDynamic, requireLazy, module, exports, RequestBuilder) {
    'use strict';

    function Request(uri) {
        this.uri = uri;
        this.method = "GET";
        this.headers = {};
        this.data = null;
        this.withFiles = false;
        this.files = [];
        this.defaultHeaders = false;
    }

    Request.prototype.getURI = function () {
        return this.uri;
    };

    Request.prototype.setMethod = function (method) {
        method = method.toUpperCase();

        if (!["POST", "GET", "PUT", "PATCH", "DELETE"].includes(method)) {
            throw new TypeError("Invalid HTTP method");
        }

        this.method = method;
        return this;
    };

    Request.prototype.getMethod = function () {
        return this.method;
    };

    Request.prototype.setData = function (data) {
        this.data = data;
        return this;
    };

    Request.prototype.getData = function () {
        return this.data;
    };

    Request.prototype.setRequestHeaders = function (headers) {
        requireModule("Error").throwIfTypeof(headers, 'object');
        this.headers = headers;
        return this;
    };

    Request.prototype.addFiles = function (input) {
        requireModule("Error").throwIf(!(input instanceof HTMLInputElement && input.type === "file"));
        this.withFiles = true;
        this.files.push(input);
        return this;
    };

    Request.prototype.onSuccess = function (cb) {
        this.onSuccessCallback = cb;
        return this;
    };

    Request.prototype.onProgress = function (cb) {
        this.onProgressCallback = cb;
        return this;
    };

    Request.prototype.onError = function (cb) {
        this.onErrorCallback = cb;
        return this;
    };

    Request.prototype.send = function () {
        return RequestBuilder.initAndSend(this);
    };

    Request.prototype.onUploadComplete = function (cb) {
        this.onUploadCompleteCallback = cb;
        return this;
    };

    Request.prototype.onUploadError = function (cb) {
        this.onUploadErrorCallback = cb;
        return this;
    };

    Request.prototype.onTimeout = function (cb) {
        this.onTimeoutCallback = cb;
        return this;
    };

    Request.prototype.onUploadStateChange = function (cb) {
        this.onUploadStateChangeCallback = cb;
        return this;
    };

    module.exports = Request;

}, null);

defineModule("ResourceLoader", [], function (global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    var hasOwn = Object.prototype.hasOwnProperty;

    function waitForReady(cb) {
        if (document.head) return cb();
        setTimeout(function () { waitForReady(cb); }, 0);
    }

    function Loader() {
        this.queue = [];
        this.pending = 0;
        this.total = 0;

        this.started = false;
        this.completed = false;

        this.onReadyQueue = [];
        this.onProgressQueue = [];

        this.registry = {}; // dedupe by src
    }

    /* ================================
     * Public API
     * ================================ */

    /**
     * Register resources without loading them.
     * @param {...Object} resources
     */
    Loader.prototype.register = function () {
        var resources = arguments;

        for (var i = 0; i < resources.length; i++) {
            var cfg = resources[i];
            if (!cfg || !cfg.src) continue;

            // Deduplication
            if (hasOwn.call(this.registry, cfg.src)) continue;

            this.registry[cfg.src] = true;
            this.queue.push(cfg);
        }

        return this;
    };

    /**
     * Start loading all registered resources.
     */
    Loader.prototype.start = function () {
        if (this.started) return this;

        this.started = true;
        this.total = this.queue.length;

        if (this.total === 0) {
            this._complete();
            return this;
        }

        for (var i = 0; i < this.queue.length; i++) {
            this._loadResource(this.queue[i]);
        }

        return this;
    };

    /**
     * Callback when all resources are loaded.
     */
    Loader.prototype.onReady = function (cb) {
        if (this.completed) {
            cb();
        } else {
            this.onReadyQueue.push(cb);
        }
        return this;
    };

    /**
     * Progress callback (0 → 100)
     */
    Loader.prototype.onProgress = function (cb) {
        this.onProgressQueue.push(cb);
        return this;
    };

    /**
     * Convenience: register + start
     */
    Loader.prototype.load = function () {
        this.register.apply(this, arguments);
        return this.start();
    };

    /* ================================
     * Internal mechanics
     * ================================ */

    Loader.prototype._loadResource = function (cfg) {
        var resource = {
            done: false
        };

        var el;

        if (cfg.type === "script") {
            el = this._createScript(cfg, resource);
        } else if (cfg.type === "stylesheet") {
            el = this._createStyle(cfg, resource);
        } else {
            return;
        }

        resource.el = el;

        this.pending++;
        this._attach(el, resource);
    };

    Loader.prototype._applyAttributes = function (el, cfg) {
        if (!cfg.attrs) return;

        for (var key in cfg.attrs) {
            if (Object.prototype.hasOwnProperty.call(cfg.attrs, key)) {
                el.setAttribute(key, cfg.attrs[key]);
            }
        }
    };

    Loader.prototype._resourceDone = function (resource) {
        if (!resource) return;
        if (resource.done) return; // 🔥 critical guard

        resource.done = true;
        this.pending--;

        if (this.pending < 0) this.pending = 0; // safety clamp

        var loaded = this.total - this.pending;

        if (loaded > this.total) loaded = this.total; // clamp

        var percent = this.total === 0
            ? 100
            : Math.round((loaded / this.total) * 100);

        // Emit progress
        for (var i = 0; i < this.onProgressQueue.length; i++) {
            this.onProgressQueue[i](percent, loaded, this.total);
        }

        if (this.pending === 0) {
            this._complete();
        }
    };

    Loader.prototype._complete = function () {
        this.completed = true;

        for (var i = 0; i < this.onReadyQueue.length; i++) {
            this.onReadyQueue[i]();
        }

        this.onReadyQueue.length = 0;
    };

    /* ================================
     * DOM creation
     * ================================ */

    Loader.prototype._createScript = function (cfg, resource) {
        var self = this;
        var s = document.createElement("script");
        s.type = "text/javascript";
        s.src = cfg.src;

        if ("async" in cfg) s.async = cfg.async;
        if ("defer" in cfg) s.defer = cfg.defer;
        if (cfg.crossOrigin) s.crossOrigin = cfg.crossOrigin;

        this._applyAttributes(s, cfg);

        s.onload = function () {
            self._resourceDone(resource);
        };

        s.onerror = function () {
            self._resourceDone(resource);
        };

        return s;
    };

    Loader.prototype._createStyle = function (cfg, resource) {
        var self = this;

        var l = document.createElement("link");
        l.rel = "stylesheet";
        l.href = cfg.src;

        // Prevent render-blocking
        l.media = "none";

        if (cfg.crossOrigin) l.crossOrigin = cfg.crossOrigin;

        this._applyAttributes(l, cfg);

        var done = false;

        function finalize() {
            if (done) return;
            done = true;

            l.media = "all"; // critical: apply stylesheet
            self._resourceDone(resource);
        }

        // Standard onload
        l.onload = finalize;

        // Error fallback
        l.onerror = finalize;

        // Fallback for browsers where onload is unreliable
        var checkInterval = setInterval(function () {
            try {
                if (l.sheet && l.sheet.cssRules !== null) {
                    clearInterval(checkInterval);
                    finalize();
                }
            } catch (e) {
                // Accessing cssRules can throw (CORS), but still means it's loaded
                clearInterval(checkInterval);
                finalize();
            }
        }, 50);

        // Optional preload
        waitForReady(function () {
            if (cfg.preload) {
                var p = document.createElement("link");
                p.rel = "preload";
                p.as = "style";
                p.href = cfg.src;

                if (cfg.crossOrigin) p.crossOrigin = cfg.crossOrigin;

                self._applyAttributes(p, cfg);

                document.head.appendChild(p);
            }
        });

        return l;
    };

    /* ================================
     * DOM insertion
     * ================================ */

    Loader.prototype._attach = function (el) {
        waitForReady(function () {
            document.head.appendChild(el);
        });
    };

    /* ================================
     * Singleton
     * ================================ */

    var instance = new Loader();

    exports["default"] = instance;

}, 66);

defineModule("TemplateEngine", [], function (
    global,
    requireModule,
    requireDynamic,
    requireLazy,
    module,
    exports
) {
    'use strict';

    /* =========================
     * SAFE PATH RESOLVER
     ========================= */
    function get(obj, path) {
        if (!path) return "";

        var parts = path.split(".");
        var current = obj;

        for (var i = 0; i < parts.length; i++) {
            if (current == null) return "";
            current = current[parts[i]];
        }

        return current;
    }

    /* =========================
     * EXPRESSION EVALUATOR
     ========================= */
    function evalExpr(expr, data) {
        try {
            return Function("data", `
                try {
                    with (data || {}) {
                        return (${expr});
                    }
                } catch (e) {
                    return false;
                }
            `)(data);
        } catch (e) {
            console.warn("[TemplateEngine] Expression error:", expr, e);
            return false;
        }
    }

    /* =========================
     * CORE COMPILER
     ========================= */
    function compile(template) {

        return function render(data) {
            var output = template;

            /* =========================
             * IF / ELSE BLOCKS
             ========================= */
            output = output.replace(/\{\{#if\s+(.+?)\}\}([\s\S]*?)\{\{\/if\}\}/g, function (_, expr, content) {
                var parts = content.split(/\{\{else\}\}/);
                return evalExpr(expr.trim(), data)
                    ? parts[0]
                    : (parts[1] || "");
            });

            /* =========================
             * LOOPS {{#array}}
             ========================= */
            output = output.replace(/\{\{#([^\}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, function (_, key, content) {
                var value = get(data, key.trim());

                if (Array.isArray(value)) {
                    return value.map(function (item, index) {

                        var scope = Object.assign({}, data, item, {
                            $index: index,
                            $parent: data
                        });

                        return compile(content)(scope);

                    }).join("");
                }

                return value ? content : "";
            });

            /* =========================
             * INVERSE {{^key}}
             ========================= */
            output = output.replace(/\{\{\^([^\}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, function (_, key, content) {
                var value = get(data, key.trim());
                return !value ? content : "";
            });

            /* =========================
             * VARIABLES {{key}}
             ========================= */
            output = output.replace(/\{\{\s*([^\}]+)\s*\}\}/g, function (_, key) {
                var value = get(data, key.trim());
                return value != null ? value : "";
            });

            return output;
        };
    }

    /* =========================
     * ENGINE
     ========================= */
    function Engine() {
        this.templates = {};
        this.cache = {};
    }

    /**
     * Register template
     */
    Engine.prototype.register = function (name, template) {
        this.templates[name] = template;
        this.cache[name] = compile(template);
    };

    /**
     * Render to string
     */
    Engine.prototype.render = function (name, data) {

        if (!data || typeof data !== "object") {
            console.warn("[TemplateEngine] Invalid data, defaulting to {}", data);
            data = {};
        }

        var fn = this.cache[name];

        if (!fn) {
            var tpl = this.templates[name];

            if (!tpl) {
                throw new Error("[TemplateEngine] Template not found: " + name);
            }

            fn = this.cache[name] = compile(tpl);
        }

        return fn(data);
    };

    /**
     * Render to DOM element
     */
    Engine.prototype.renderToElement = function (name, data) {
        var html = this.render(name, data);

        var wrapper = document.createElement("div");
        wrapper.innerHTML = html.trim();

        return wrapper.firstElementChild;
    };

    /**
     * Append rendered element
     */
    Engine.prototype.append = function (name, data, container) {
        var el = this.renderToElement(name, data);
        container.appendChild(el);
        return el;
    };

    /**
     * Replace element
     */
    Engine.prototype.replace = function (targetEl, name, data) {
        var newEl = this.renderToElement(name, data);
        targetEl.replaceWith(newEl);
        return newEl;
    };

    /**
     * Render list helper
     */
    Engine.prototype.renderList = function (name, list, container) {
        if (!Array.isArray(list)) return;

        for (var i = 0; i < list.length; i++) {
            this.append(name, list[i], container);
        }
    };

    module.exports = new Engine();

}, null);

defineModule("JSEventController", ["EventType", "Parent"], (function $controller(global, requireModule, requireDynamic, requireLazy, module, exports, eventTypes) {
    'use strict';

    // TODO: Implement event cache

    var CONTROLLER_ATTRIBUTE = "data-jscontroller";
    var CONTROLLER_PARAMS = "data-jsparams";
    var CONTROLLER_NEW_INSTANCE = "data-jsinstance";
    var EVENT_TYPE_PREFIX = "data-js";

    var LOAD_MODULE_PREFIX = "data-load-module";

    function callEvent(evt, evtType) {
        var eventTypeWithPrefix = EVENT_TYPE_PREFIX + evtType;
        var parent = requireModule("Parent").byAttribute(evt.target, eventTypeWithPrefix);
        if (parent == null) return;
        var ctrlInstance = new getControllerInstance(parent, eventTypeWithPrefix);

        ctrlInstance.callMethod(evt);
        ctrlInstance = null;
    }

    function callTouchEvent(evt, evtType) {
        var eventTypeWithPrefix = EVENT_TYPE_PREFIX + evtType;
        var parent = requireModule("Parent").byAttribute(evt.target, eventTypeWithPrefix);
        if (parent == null) return;

        var eventController = $controller.getInstance(parent, eventTypeWithPrefix);
        $controller.callMethod(eventController, parent);
    }

    function createHandler(eventType) {
        return function(event, callback) {
            return callback(callEvent(event, eventType));
        };
    }

    const eventHandler = {
        // Form / Input
        handleChangeEvent: createHandler(eventTypes.CHANGE),
        handleInputEvent: createHandler(eventTypes.INPUT),
        handleInvalidEvent: createHandler(eventTypes.INVALID),
        handleResetEvent: createHandler(eventTypes.RESET),
        handleSubmitEvent: createHandler(eventTypes.SUBMIT),

        // Focus
        handleFocusEvent: createHandler(eventTypes.FOCUS),
        handleFocusInEvent: createHandler(eventTypes.FOCUSIN),
        handleFocusOutEvent: createHandler(eventTypes.FOCUSOUT),
        handleBlurEvent: createHandler(eventTypes.BLUR),

        // Mouse
        handleClickEvent: createHandler(eventTypes.MOUSE.CLICK),
        handleDblClickEvent: createHandler(eventTypes.MOUSE.DBLCLICK),
        handleMouseDownEvent: createHandler(eventTypes.MOUSE.MOUSEDOWN),
        handleMouseUpEvent: createHandler(eventTypes.MOUSE.MOUSEUP),
        handleMouseMoveEvent: createHandler(eventTypes.MOUSE.MOUSEMOVE),
        handleMouseEnterEvent: createHandler(eventTypes.MOUSE.MOUSEENTER),
        handleMouseLeaveEvent: createHandler(eventTypes.MOUSE.MOUSELEAVE),
        handleMouseOverEvent: createHandler(eventTypes.MOUSE.MOUSEOVER),
        handleMouseOutEvent: createHandler(eventTypes.MOUSE.MOUSEOUT),
        handleContextMenuEvent: createHandler(eventTypes.MOUSE.CONTEXTMENU),
        handleWheelEvent: createHandler(eventTypes.MOUSE.WHEEL),

        // Keyboard
        handleKeyboardDown: createHandler(eventTypes.KEYBOARD.KEYDOWN),
        handleKeyboardUp: createHandler(eventTypes.KEYBOARD.KEYUP),
        handleKeyboardPress: createHandler(eventTypes.KEYBOARD.KEYPRESS),

        // Pointer
        handlePointerDown: createHandler(eventTypes.POINTER.POINTERDOWN),
        handlePointerUp: createHandler(eventTypes.POINTER.POINTERUP),
        handlePointerMove: createHandler(eventTypes.POINTER.POINTERMOVE),
        handlePointerEnter: createHandler(eventTypes.POINTER.POINTERENTER),
        handlePointerLeave: createHandler(eventTypes.POINTER.POINTERLEAVE),
        handlePointerOver: createHandler(eventTypes.POINTER.POINTEROVER),
        handlePointerOut: createHandler(eventTypes.POINTER.POINTEROUT),
        handlePointerCancel: createHandler(eventTypes.POINTER.POINTERCANCEL),

        // Touch (kept special if you need custom normalization)
        handleTouchStart: createHandler(eventTypes.TOUCH.TOUCHSTART),
        handleTouchMove: createHandler(eventTypes.TOUCH.TOUCHMOVE),
        handleTouchEnd: createHandler(eventTypes.TOUCH.TOUCHEND),
        handleTouchCancel: createHandler(eventTypes.TOUCH.TOUCHCANCEL),

        // Clipboard
        handleCopyEvent: createHandler(eventTypes.CLIPBOARD.COPY),
        handleCutEvent: createHandler(eventTypes.CLIPBOARD.CUT),
        handlePasteEvent: createHandler(eventTypes.CLIPBOARD.PASTE),

        // Drag & Drop
        handleDragEvent: createHandler(eventTypes.DRAG.DRAG),
        handleDragStartEvent: createHandler(eventTypes.DRAG.DRAGSTART),
        handleDragEndEvent: createHandler(eventTypes.DRAG.DRAGEND),
        handleDragEnterEvent: createHandler(eventTypes.DRAG.DRAGENTER),
        handleDragLeaveEvent: createHandler(eventTypes.DRAG.DRAGLEAVE),
        handleDragOverEvent: createHandler(eventTypes.DRAG.DRAGOVER),
        handleDropEvent: createHandler(eventTypes.DRAG.DROP),

        // Composition
        handleCompositionStart: createHandler(eventTypes.COMPOSITION.COMPOSITIONSTART),
        handleCompositionUpdate: createHandler(eventTypes.COMPOSITION.COMPOSITIONUPDATE),
        handleCompositionEnd: createHandler(eventTypes.COMPOSITION.COMPOSITIONEND),

        // Media
        handlePlayEvent: createHandler(eventTypes.MEDIA.PLAY),
        handlePauseEvent: createHandler(eventTypes.MEDIA.PAUSE),
        handleEndedEvent: createHandler(eventTypes.MEDIA.ENDED),
        handleTimeUpdateEvent: createHandler(eventTypes.MEDIA.TIMEUPDATE),
        handleVolumeChangeEvent: createHandler(eventTypes.MEDIA.VOLUMECHANGE),
        handleSeekingEvent: createHandler(eventTypes.MEDIA.SEEKING),
        handleSeekedEvent: createHandler(eventTypes.MEDIA.SEEKED),
        handleCanPlayEvent: createHandler(eventTypes.MEDIA.CANPLAY),
        handleCanPlayThroughEvent: createHandler(eventTypes.MEDIA.CANPLAYTHROUGH),
        handleLoadedDataEvent: createHandler(eventTypes.MEDIA.LOADEDDATA),
        handleLoadedMetadataEvent: createHandler(eventTypes.MEDIA.LOADEDMETADATA),
        handleMediaErrorEvent: createHandler(eventTypes.MEDIA.ERROR),

        // Window
        handleLoadEvent: createHandler(eventTypes.WINDOW.LOAD),
        handleBeforeUnloadEvent: createHandler(eventTypes.WINDOW.BEFOREUNLOAD),
        handleUnloadEvent: createHandler(eventTypes.WINDOW.UNLOAD),
        handleResizeEvent: createHandler(eventTypes.WINDOW.RESIZE),
        handleScrollEvent: createHandler(eventTypes.WINDOW.SCROLL),
        handleHashChangeEvent: createHandler(eventTypes.WINDOW.HASHCHANGE),
        handlePopStateEvent: createHandler(eventTypes.WINDOW.POPSTATE),

        // Selection
        handleSelectEvent: createHandler(eventTypes.SELECTION.SELECT),
        handleSelectionChangeEvent: createHandler(eventTypes.SELECTION.SELECTIONCHANGE),

        // Legacy / special
        handleTouchEvent: function(event, callback) {
            return callback(callTouchEvent(event));
        },

        getInstance: getControllerInstance
    };

    /**
     *
     * @param {HTMLElement} parent
     * @param {string} eventType
     * @returns
     */
    function getControllerData(target, eventType) {
        var controller, method = null;
        var controllerName = "";
        var parent;
        var isNewInstance = false;

        parent = requireModule("Parent").byAttribute(target, CONTROLLER_ATTRIBUTE);

        isNewInstance = parent.hasAttribute(CONTROLLER_NEW_INSTANCE);
        controller = parent.getAttribute(CONTROLLER_ATTRIBUTE)

        method = target.getAttribute(eventType).replace(/^\@/, '');

        var params = target.hasAttribute(CONTROLLER_PARAMS) ?
            target.getAttribute(CONTROLLER_PARAMS) : null;;

        return {
            controller: controller,
            method: method,
            params: params,
            newInstance: isNewInstance
        }
    }

    /**
     *
     * @param {HTMLElement} parent
     * @param {string} eventType
     */
    function getControllerInstance(parent, eventType) {
        var controllerData = getControllerData(parent, eventType);
        this.controller = controllerData.controller;
        this.method = controllerData.method;
        this.params = controllerData.params;
        this.targetElement = parent;
        this.newInstance = controllerData.newInstance
        return this;
    }
    /**
     * Executes the requested method on the controller.
     * Upgraded to asynchronously fetch missing modules before executing.
     */
    getControllerInstance.prototype.callMethod = function(event) {
        var _this = this; // Preserve context for the async callback
        var params;
        
        try {
            var p = this.params ? this.params.toString().replace(/'/g, '"') : "{}";
            params = JSON.parse(p);
        } catch (e) {
            params = {};
        }

        // Prepare the helper instance passed to your controllers
        var ctrlInstance = {
            targetElement: this.targetElement,
            params: params,
            getParam: function(param) {
                if (typeof params[param] !== "undefined") {
                    return params[param];
                }
                return null;
            },
            hasParam: function(param) {
                return typeof params[param] !== "undefined";
            }
        };

        // ✨ THE FIX: Use requireDynamic to auto-fetch the file if it hasn't loaded yet!
        requireDynamic(this.controller, function(controllerModule) {
            var method = null;
            var executionContext = controllerModule;

            if (!controllerModule) {
                console.error("[JSEventController] Failed to load module: " + _this.controller);
                return;
            }

            // Should we create an instance?
            if (_this.newInstance) {
                executionContext = new controllerModule(params);
                var prototype = Object.getPrototypeOf(executionContext);
                
                if (prototype !== null && prototype.hasOwnProperty(_this.method) && prototype[_this.method] instanceof Function) {
                    method = prototype[_this.method];
                }
            } 
            // Do not create an instance, just map the method
            else {
                if (controllerModule[_this.method] instanceof Function) {
                    method = controllerModule[_this.method];
                }
            }

            // Execute the mapped method
            if (method instanceof Function) {
                method.call(executionContext, event, ctrlInstance);
            } else {
                console.warn("[JSEventController] Method '" + _this.method + "' not found in " + _this.controller);
            }
        });
    };

    /**
     * Parse the params into a new [key, value] object
     * @param {Array} params the array params to be parsed
     * @returns {Array}
     */
    getControllerInstance.prototype.parseParams = function(params) {
        var parsed = {};
        params.forEach(function(i) {
            var paramParts = i.split(':');
            parsed[paramParts[0]] = paramParts[1];
        });
        return parsed;
    };

    function setController(element, ctrlName, methodObj, newInstance, params) {
        if (element == null) return;

        if (ctrlName !== null) {
            element.setAttribute(CONTROLLER_ATTRIBUTE, ctrlName);
        }

        if (methodObj !== null) {
            console.log(methodObj);
            for (var method in methodObj) {
                element.setAttribute(EVENT_TYPE_PREFIX + method, methodObj[method]);
            }
        }

        if (newInstance) {
            element.setAttribute(CONTROLLER_NEW_INSTANCE, true);
        }

        if (params) {
            element.setAttribute(CONTROLLER_PARAMS, JSON.stringify(params));
        }
    }

    function removeController(element, ctrlName, methodObj, newInstance, params) {
        if (element == null) return;

        if (ctrlName !== null) {
            element.removeAttribute(CONTROLLER_ATTRIBUTE);
        }

        if (methodObj !== null) {
            element.removeAttribute(EVENT_TYPE_PREFIX + methodObj);
        }
    }

    eventHandler.set = setController;
    eventHandler.remove = removeController;

    module.exports = eventHandler;
}), null);

defineModule("JSEventDispatcher", ["JSEventController", "EventType"], function (
    global,
    requireModule,
    requireDynamic,
    requireLazy,
    module,
    exports,
    eventHandler,
    eventTypes
) {
    'use strict';

    function register(eventName, handler) {
        document.addEventListener(eventName, function (event) {
            handler(event, function () {});
        }, true); // use capture for delegation reliability
    }

    function init() {
        // Form
        register(eventTypes.CHANGE, eventHandler.handleChangeEvent);
        register(eventTypes.INPUT, eventHandler.handleInputEvent);
        register(eventTypes.SUBMIT, eventHandler.handleSubmitEvent);
        register(eventTypes.RESET, eventHandler.handleResetEvent);

        // Focus
        register(eventTypes.FOCUS, eventHandler.handleFocusEvent);
        register(eventTypes.FOCUSIN, eventHandler.handleFocusInEvent);
        register(eventTypes.FOCUSOUT, eventHandler.handleFocusOutEvent);
        register(eventTypes.BLUR, eventHandler.handleBlurEvent);

        // Mouse
        register(eventTypes.MOUSE.CLICK, eventHandler.handleClickEvent);
        register(eventTypes.MOUSE.DBLCLICK, eventHandler.handleDblClickEvent);
        register(eventTypes.MOUSE.MOUSEDOWN, eventHandler.handleMouseDownEvent);
        register(eventTypes.MOUSE.MOUSEUP, eventHandler.handleMouseUpEvent);
        register(eventTypes.MOUSE.MOUSEMOVE, eventHandler.handleMouseMoveEvent);
        register(eventTypes.MOUSE.MOUSEENTER, eventHandler.handleMouseEnterEvent);
        register(eventTypes.MOUSE.MOUSELEAVE, eventHandler.handleMouseLeaveEvent);
        register(eventTypes.MOUSE.CONTEXTMENU, eventHandler.handleContextMenuEvent);
        register(eventTypes.MOUSE.WHEEL, eventHandler.handleWheelEvent);

        // Keyboard
        register(eventTypes.KEYBOARD.KEYDOWN, eventHandler.handleKeyboardDown);
        register(eventTypes.KEYBOARD.KEYUP, eventHandler.handleKeyboardUp);

        // Pointer (recommended modern input layer)
        register(eventTypes.POINTER.POINTERDOWN, eventHandler.handlePointerDown);
        register(eventTypes.POINTER.POINTERUP, eventHandler.handlePointerUp);
        register(eventTypes.POINTER.POINTERMOVE, eventHandler.handlePointerMove);

        // Touch
        register(eventTypes.TOUCH.TOUCHSTART, eventHandler.handleTouchStart);
        register(eventTypes.TOUCH.TOUCHMOVE, eventHandler.handleTouchMove);
        register(eventTypes.TOUCH.TOUCHEND, eventHandler.handleTouchEnd);

        // Clipboard
        register(eventTypes.CLIPBOARD.COPY, eventHandler.handleCopyEvent);
        register(eventTypes.CLIPBOARD.PASTE, eventHandler.handlePasteEvent);

        // Drag & Drop
        register(eventTypes.DRAG.DRAGSTART, eventHandler.handleDragStartEvent);
        register(eventTypes.DRAG.DROP, eventHandler.handleDropEvent);

        // Window
        register(eventTypes.WINDOW.SCROLL, eventHandler.handleScrollEvent);
        register(eventTypes.WINDOW.RESIZE, eventHandler.handleResizeEvent);
    }

    module.exports = {
        init
    };
}, null);

defineModule("JSFormController", [], (function $handler(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    function getInstance(controller, event) {
        var instance = null;

        var controllerName = controller.form.getAttribute("data-jscontroller")
        if (controllerName == null) return;

        if (controller.form.hasAttribute("data-jsinstance")) {
            instance = new(requireModule(controllerName))(event, controller);
        } else {
            instance = requireModule(controllerName);
        }
        return instance;
    }

    /**
     * @param {SubmitEvent} event
     * @param {HTMLFormElement} form
     */
    function JSFormController(event, form) {
        this.form   = form;

        if (!form.hasAttribute("novalidate")) {
            form.setAttribute("novalidate", "true");
        }

        this.submitter = event.submitter;
        this.action = form.action || "/";
        this.method = form.method || "POST";
        this.elements = Array.from(form.elements);
        this.xhr = new(requireModule("AsyncRequest"))(this.action);
        this.elements.map(function(e) {
            // If the form has a file input
            if (e.type === "file" && e.files.length >= 1) {
                this.xhr.withFiles = true;
                this.xhr.addFiles(e);
            }
        }.bind(this));
        this.controller = getInstance(this, event);
    }
    JSFormController.prototype._getValidityState = function (element) {
        var v = element.validity;

        var errors = {};

        if (v.valueMissing) errors.required = true;
        if (v.typeMismatch) errors.type = true;
        if (v.patternMismatch) errors.pattern = true;
        if (v.tooShort) errors.minlength = true;
        if (v.tooLong) errors.maxlength = true;
        if (v.rangeUnderflow) errors.min = true;
        if (v.rangeOverflow) errors.max = true;
        if (v.stepMismatch) errors.step = true;
        if (v.badInput) errors.badInput = true;

        return {
            valid: v.valid,
            errors: errors,
            value: element.value,
            native: v
        };
    };
    JSFormController.prototype.validate = function () {
        return this.validateFormElements();
    };
    JSFormController.prototype.validateFormElements = function () {
        var valid = true;
        var elements = Array.from(this.form.elements);

        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];

            if (!el.name || el.disabled) continue;

            var validator = this.getValidator(el);

            var ctx = this._getValidityState(el);

            if (validator) {
                validator.call(this.controller, el, ctx);
            }

            if (!ctx.valid) {
                valid = false;
            }
        }

        return valid;
    };
    JSFormController.prototype.getControllerMethod = function(methodName) {
        var method = this.form.getAttribute("data-on-" + methodName);
        if (method) {
            return this.controller[method.replace(/^\@/g, "")];
        }
        return null;
    };
    JSFormController.prototype.callControllerMethod = function(methodName, params) {
        methodName.apply(this.controller, params);
    };
    JSFormController.prototype.getValidator = function(element) {
        var validatorMethod = element.dataset.jsvalidator;
        if (validatorMethod) {
            return this.controller[validatorMethod.replace(/^\@/g, "")];
        }
        return null;
    };
    JSFormController.prototype.setValidator = function(element, validatorMethod) {
        if (!element) return;
        if (typeof validatorMethod !== "string") return;

        element.setAttribute("data-jsvalidator", "@".concat(validatorMethod));
    };
    JSFormController.prototype.removeValidator = function(element, validatorMethod) {
        if (!element) return;
        if (typeof validatorMethod !== "string") return;

        element.removeAttribute("data-jsvalidator");
    };
    JSFormController.prototype.generatePayload = function() {
        return new FormData(this.form);
    };
    JSFormController.prototype.submitAsync = function() {
        var onErrorCallback       = this.getControllerMethod("error");
        var onSuccessCallback     = this.getControllerMethod("success");
        var onBeforeSubmitMethod  = this.getControllerMethod("beforesubmit");
        var onPostSubmitMethod    = this.getControllerMethod("postsubmit");
        var onProgressMethod      = this.getControllerMethod("progress");   

        var _this = this;

        this.xhr.setMethod(this.method);
        var payload = this.generatePayload();
        this.xhr.setData(payload);

        var csrf_token = requireModule("$").fromIDOrElement("csrf_token");
        if (csrf_token) {
            this.xhr.setRequestHeaders({
                "X-CSRF-TOKEN" : csrf_token.getAttribute("content")
            });
        }

        if (typeof onErrorCallback == "function") {
            this.xhr.onError(function(xhr, status) {
                _this.callControllerMethod(onErrorCallback, [xhr]);
            });
        }

        if (typeof onSuccessCallback == "function") {
            onSuccessCallback && this.xhr.onSuccess(function(xhr, status) {
                _this.callControllerMethod(onSuccessCallback, [payload, xhr]);
            });

        }

        if (onBeforeSubmitMethod !== null) {
            this.callControllerMethod(onBeforeSubmitMethod, [payload]);
        }

        if (typeof onProgressMethod == "function") {
            this.xhr.onProgress(function(response) {
                _this.callControllerMethod(onProgressMethod, [payload, response]);
            });
        }

        this.xhr.send();
        
        if (typeof onPostSubmitMethod == "function") {
            this.callControllerMethod(onPostSubmitMethod);
        }

    };

    JSFormController.prototype.submit = function() {
        this.form.submit();
    };

    module.exports = JSFormController;
}), null);

defineModule("SubmitNativeEvent", [], (function $handler(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    /**
     * @param {SubmitEvent} event
     * @param {HTMLFormElement} form
     * @param {string} mode
     */
    function submitNativeEvent(event, form, mode) {
        event.preventDefault();
        this.mode = mode || "async";
        this.formController = new(requireModule("JSFormController"))(event, form);

        if (this.formController.validateFormElements()) {
            this.submit();
        }
    }

    submitNativeEvent.prototype.submit = function() {
        switch (this.mode) {
            case "validate":
                return true;
            case "sync":
                this.formController.submit();
                break;
            case "async":
            default:
                this.formController.submitAsync();
                break;
        }
    };

    global.SubmitNativeEvent = submitNativeEvent;
    exports['default'] = submitNativeEvent;
}), 66);

defineModule("I18n", [], function (
    global,
    requireModule,
    requireDynamic,
    requireLazy,
    module,
    exports
) {
    'use strict';

    var dictionary = global.i18n || {};

    /* =========================
     * UTIL: GET NESTED KEY
     ========================= */
    function get(obj, path) {
        var parts = path.split(".");
        var current = obj;

        for (var i = 0; i < parts.length; i++) {
            if (current == null) return null;
            current = current[parts[i]];
        }

        return current;
    }

    /* =========================
     * UTIL: REPLACE PARAMETERS
     ========================= */
    function replaceParams(str, params) {
        if (!params) return str;

        return str.replace(/:([a-zA-Z_]+)/g, function (_, key) {
            return params[key] != null ? params[key] : ":" + key;
        });
    }

    /* =========================
     * UTIL: RESOLVE VALIDATION TYPES
     ========================= */
    function resolveValidation(value, params) {
        if (typeof value === "string") return value;

        // Laravel style: min.string, min.numeric, etc.
        if (typeof value === "object") {
            if (params && params.type && value[params.type]) {
                return value[params.type];
            }

            // fallback priority
            return value.string || value.numeric || value.array || value.file;
        }

        return "";
    }

    /* =========================
     * MAIN TRANSLATION FUNCTION
     ========================= */
    function translate(key, params) {
        var value = get(dictionary, key);

        if (!value) {
            console.warn("Missing translation:", key);
            return key;
        }

        // Handle Laravel validation structures
        value = resolveValidation(value, params);

        // Replace placeholders
        value = replaceParams(value, params);

        return value;
    }

    /* =========================
     * PUBLIC API
     ========================= */
    var I18n = {

        /**
         * Translate key
         * @param {string} key
         * @param {object} params
         * @returns {string}
         */
        t: function (key, params) {
            return translate(key, params);
        },

        /**
         * Set dictionary manually (optional)
         */
        set: function (data) {
            dictionary = data || {};
        },

        /**
         * Get raw value
         */
        get: function (key) {
            return get(dictionary, key);
        }

    };

    module.exports = I18n;

}, null);