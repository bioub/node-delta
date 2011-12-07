#!/usr/bin/env node

var optparse = require('optparse');
var sys = require('sys');
var fs  = require('fs');
var path = require('path');
var mime = require('mime');
var deltajs = require('../lib/main');


/**
 * Ensure that the filepath is accessible and check its mime type.
 */
function checkfile(description, filepath, wantmime) {
    var filemime;

    if (!filepath || !path.existsSync(filepath)) {
        console.error('Path to ' + description + ' missing. Use the -h switch for help.');
        process.exit(1);
    }

    filemime = mime.lookup(filepath);
    if (wantmime && filemime !== wantmime) {
        console.error(description + ' is of the wrong type');
        process.exit(1);
    }
    return filemime;
}


/**
 * Parses and loads a file using the given adapter classes
 */
function loadFile(description, filepath, encoding, payloadhandler, dataadapter) {
    var data, doc, tree;
    data = fs.readFileSync(filepath, encoding);
    doc = payloadhandler.parseString(data);
    tree = dataadapter.adaptDocument(doc);
    return tree;
}


/**
 * Save data to a file using the given adapter and payload handler
 */
function saveFile(description, filepath, encoding, data, doc, payloadhandler, docadapter) {
    var buf;
    docadapter.createDocument(doc, data);
    buf = payloadhandler.serializeToString(doc);
    fs.writeFileSync(filepath, buf, encoding);
}


/**
 * Write serialized data to stdout
 */
function showFile(description, data, doc, payloadhandler, docadapter) {
    var buf;
    docadapter.createDocument(doc, data);
    buf = payloadhandler.serializeToString(doc);
    sys.puts(buf);
}


/**
 * Return the payload type for a given mimetype.
 */
function getPayloadType(mimetype) {
    if (mimetype === 'application/json') {
        return 'json';
    }
    else if (mimetype === 'application/xml' || mimetype.slice(-4) === '+xml') {
        return 'xml';
    }
}


/**
 * Return the proper payload handler for the given mime type. Return undefined
 * if no suitable payload handler is available.
 */
function createPayloadHandler(type) {
    var result;

    switch(type) {
        case 'json':
            result = new deltajs.jsonpayload.JSONPayloadHandler();
            break;
        case 'xml':
            result = new deltajs.xmlpayload.XMLPayloadHandler();
            break;
    }

    return result;
}


/**
 * Return the proper tree adapter for this payload type.
 */
function createTreeAdapter(type) {
    var result;

    switch(type) {
        case 'json':
            result = new deltajs.jsobjecttree.JSObjectTreeAdapter();
            break;
        case 'xml':
            result = new deltajs.domtree.DOMTreeAdapter();
            break;
    }

    return result;
}


/**
 * Return the proper tree adapter for this payload type.
 */
function createDeltaAdapter(type, fragadapter) {
    var result;

    switch (type) {
        case 'json':
            result = new deltajs.jsondelta.JSONDeltaAdapter(fragadapter);
            break;
        case 'xml':
            result = new deltajs.domdelta.DOMDeltaAdapter(fragadapter);
            break;
    }

    return result;
}

/**
 * Return proper tree value index for payload type.
 */
function createValueIndex(type, tree1, tree2) {
    var result;

    switch (type) {
        case 'xml':
            result = new deltajs.tree.NodeHashIndex(
                    new deltajs.domtree.DOMNodeHash(deltajs.fnv132.Hash));
            break;
        case 'json':
            // no index
            break;
    }

    return result;
}


/**
 * Setup diff options for given payload type
 */
function createXccOptions(type) {
    var result;

    function rejectUpdateOnXMLElementContainingSingleTextNode(node) {
        var result = false;
        var domnode = node.data;

        if (domnode.childNodes.length === 1 &&
                domnode.firstChild.nodeType === domnode.TEXT_NODE) {
            result = true;
        }

        return result;
    }

    switch (type) {
        case 'xml':
            result = {
                'ludRejectCallbacks': [
                    rejectUpdateOnXMLElementContainingSingleTextNode
                ],
                'detectLeafUpdates': true
            };
            break;
    }

    return result;
}


/**
 * Parse options and command line arguments and initialize the diff algorithm
 */
function main() {
    var options = {
        'origfile': undefined,
        'origenc': 'UTF-8',
        'changedfile': undefined,
        'changedenc': 'UTF-8',
        'filetype': undefined,
        'patchfile': undefined,
        'patchenc': 'UTF-8',
        'patchtype': 'xml',
        'debug': false,
        'xmldocopt': false
    }

    var switches = [
        ['-h', '--help',    'Show this help'],
        ['-p', '--payload STRING', 'Specify payload type (xml or json, default: detect)'],
        ['-x', '--xml',     'Use XML patch format (default)'],
        ['-j', '--json',    'Use JSON patch format'],
        ['--xmldocopt',     'Enable optimization for XML documents. Treat elements containing exactly one text node as a single unit.'],
        ['-d', '--debug',   'Log actions to console']
        ];

    var parser = new optparse.OptionParser(switches);
    parser.banner = 'Usage: djdiff [options] FILE1 FILE2';

    parser.on('help', function(name, value) {
        sys.puts(parser.toString());
    });

    parser.on('payload', function(name, value) {
        options.filetype=value;
    });

    parser.on('xml', function(name, value) {
        options.patchtype='xml';
    });

    parser.on('json', function(name, value) {
        options.patchtype='json';
    });

    parser.on('debug', function(name, value) {
        console.warn('debug enabled');
        options.debug=true;
    });

    parser.on('xmldocopt', function(name, value) {
        options.xmldocopt = true;
    });

    parser.on(2, function(value) {
        options.origfile=value
    });

    parser.on(3, function(value) {
        options.changedfile=value
    });

    parser.on(4, function(value) {
        options.patchfile=value
    });

    parser.parse(process.ARGV);


    // Check input files
    var documentMimetype, documentPayloadType, documentPayloadHandler,
        documentTreeAdapter;

    if (!options.filetype) {
        documentMimetype = checkfile('original file', options.origfile,
                documentMimetype);
        documentMimetype = checkfile('changed file', options.changedfile,
                documentMimetype);

        // Setup document payload handler and tree adapter
        documentPayloadType = getPayloadType(documentMimetype);
        if (!documentPayloadType) {
            console.error('This file type is not supported by djdiff');
        }
    }
    else {
        documentPayloadType = options.filetype;
    }

    documentPayloadHandler = createPayloadHandler(documentPayloadType);
    if (!documentPayloadHandler) {
        console.error('This file type is not supported by djdiff');
    }

    documentTreeAdapter = createTreeAdapter(documentPayloadType);


    // Setup delta payload handler
    var deltaPayloadHandler = createPayloadHandler(options.patchtype);
    if (!deltaPayloadHandler) {
        console.error('This delta type is not supported by djdiff');
    }


    // Match trees
    var tree1, tree2, valindex, diff, matching, diffopt;
    tree1 = loadFile('original file', options.origfile, options.origenc,
            documentPayloadHandler, documentTreeAdapter);
    tree2 = loadFile('changed file', options.changedfile, options.changedenc,
            documentPayloadHandler, documentTreeAdapter);

    valindex = createValueIndex(documentPayloadType, tree1, tree2);
    if (options.xmldocopt) {
        diffopt = createXccOptions(documentPayloadType);
    }

    matching = new deltajs.tree.Matching();
    diff = new deltajs.xcc.Diff(tree1, tree2, diffopt);

    if (valindex) {
        diff.equals = function(a, b) {
            return valindex.get(a) === valindex.get(b);
        };
    }

    var t1, t2;
    if (options.debug) {
        t1 = new Date();
        console.warn('begin match trees');
    }

    diff.matchTrees(matching);

    if (options.debug) {
        t2 = new Date();
        console.warn('match trees took', t2.getTime() - t1.getTime());
    }


    // Construct delta
    var delta, a_index, contextgen, updater;
    delta = new deltajs.delta.Delta();
    a_index = new deltajs.tree.DocumentOrderIndex(tree1);
    a_index.buildAll();

    contextgen = new deltajs.delta.ContextGenerator(4, a_index, valindex);
    updater = diff.createUpdater(matching);
    delta.collect(tree1, matching, contextgen, updater);


    // Serialize delta
    var doc = deltaPayloadHandler.createDocument();
    var fragadapter = documentPayloadHandler.createTreeFragmentAdapter(doc,
            documentTreeAdapter, options.patchtype);
    deltaAdapter = createDeltaAdapter(options.patchtype, fragadapter);

    showFile('patch file', delta, doc, deltaPayloadHandler, deltaAdapter);

    /*
    saveFile('patch file', options.patchfile, options.patchenc, delta, doc,
            deltaPayloadHandler, deltaAdapter);
            */
}

main();
