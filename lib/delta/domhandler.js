define(function (require, exports, module) {/**
 * @fileoverview    Operation handler classes for XML/DOM based delta format
 */

/** @ignore */
var deltamod = require('./delta');

/**
 * Helper class for a memoizing the currently active DOM node during a patching
 * session. This mapping is necessary because DOMNodeReplaceOperationHandler
 * swaps dom nodes when toggled. Thus, any operation attached to a child node
 * needs to be capable of detecting the currently active parent in order to
 * prevent operations on inactive nodes which may lead to loss of data.
 *
 * @constructor
 */
function DOMOperationNodeDataMap(propname) {
    this.propname = propname || 'currentDOMNode';
}


/**
 * Return active DOM node for this tree.Node.
 */
DOMOperationNodeDataMap.prototype.getCurrentDOMNode = function(node) {
    return node && (node[this.propname] || node.data);
}


/**
 * Set active DOM node for this tree.Node.
 */
DOMOperationNodeDataMap.prototype.setCurrentDOMNode = function(node, domnode) {
    node[this.propname] = domnode;
}


/**
 * @constructor
 */
function DOMNodeReplaceOperationHandler(anchor, datamap, orignode, changednode) {
    this.anchor = anchor;
    this.datamap = datamap;
    this.orignode = orignode;
    this.changednode = changednode;

    // Changed node may not have any children
    while(this.changednode.firstChild) {
        this.changednode.removeChild(this.changednode.firstChild);
    }

    this.state = false;
}


/**
 * Toggle active state of this hunk.
 */
DOMNodeReplaceOperationHandler.prototype.toggle = function() {
    var fromnode = this.state ? this.changednode : this.orignode,
        tonode = this.state ? this.orignode : this.changednode,
        parent = (fromnode === fromnode.ownerDocument.documentElement) ?
            fromnode.ownerDocument : fromnode.parentNode;

    // Move children
    while (fromnode.firstChild) {
        tonode.appendChild(fromnode.firstChild);
    }

    // Replace node
    parent.replaceChild(tonode, fromnode);

    // Update node data map
    this.datamap.setCurrentDOMNode(this.anchor, tonode);

    this.state = !this.state;
};


/**
 * Return the currently activated node
 */
DOMNodeReplaceOperationHandler.prototype.getNode = function() {
    return this.state ? this.changednode : this.orignode;
}


/**
 * Return true if this hunk is active.
 */
DOMNodeReplaceOperationHandler.prototype.isActive = function() {
    return this.state;
};


/**
 * Activate this hunk, remove old attributes and insert new attributes if
 * necessary.
 */
DOMNodeReplaceOperationHandler.prototype.activate = function() {
    if (!this.state) {
        this.toggle();
    }
};


/**
 * Deactivate this hunk, remove inserted attributes and reinsert removed
 * attributes if necessary.
 */
DOMNodeReplaceOperationHandler.prototype.deactivate = function() {
    if (this.state) {
        this.toggle();
    }
};


/**
 * Construct a new DOM operation element capable of replacing the specified
 * subtrees.
 *
 * @param   par         The tree.Node whose children should be replaced
 * @param   before      The tree.Node where new nodes should be attached
 *                      before
 * @param   oldnodes    An array of the root DOM elements of the original
 *                      subtrees
 * @param   newnodes    An array of the root DOM elements of the changed
 *                      subtrees
 * @constructor
 */
function DOMTreeSequenceOperationHandler(par, before, datamap, oldnodes,
        newnodes) {
    this.parent = par;
    this.before = before;
    this.datamap = datamap;

    this.oldnodes = oldnodes;
    this.newnodes = newnodes;
}


/**
 * Toggle active state
 */
DOMTreeSequenceOperationHandler.prototype.toggle = function() {
    var remove = this.state ? this.newnodes : this.oldnodes,
        insert = this.state ? this.oldnodes : this.newnodes,
        node = this.datamap.getCurrentDOMNode(this.parent),
        before = this.datamap.getCurrentDOMNode(this.before),
        i;

    for (i = 0; i < remove.length; i++) {
        node.removeChild(remove[i]);
    }
    for (i = 0; i < insert.length; i++) {
        node.insertBefore(insert[i], before);
    }

    this.state = !this.state;
};


/**
 * Return true if the hunk is active
 */
DOMTreeSequenceOperationHandler.prototype.isActive = function() {
    return this.state;
};


/**
 * Activate this hunk, inserting new subtrees and removing old subtrees if
 * necessary.
 */
DOMTreeSequenceOperationHandler.prototype.activate = function() {
    if (!this.state) {
        this.toggle();
    }
};


/**
 * Deactivate this hunk, removing inserted nodes and inserting removed
 * nodes into if necessary.
 */
DOMTreeSequenceOperationHandler.prototype.deactivate = function() {
    if (this.state) {
        this.toggle();
    }
};


/**
 * Construct a DOM operation factory.
 * @constructor
 */
function DOMOperationHandlerFactory() {
    this.dataMap = new DOMOperationNodeDataMap();
}


/**
 * Return a new node update operation on the given node.
 *
 * @param anchor    A DeltaJS.tree.Anchor pointing to the node with old values
 * @param newnode   A DeltaJS.tree.node pointing to the node with the new values
 */
DOMOperationHandlerFactory.prototype.createNodeUpdateOperationHandler = function(
        anchor, newnode) {
    var oldnode;
    if (!anchor.target) {
        throw new Error('Parameter error: node update handler needs an anchor with a target');
    }
    oldnode = anchor.target;
    remove = oldnode.data;
    insert = oldnode.data.ownerDocument.importNode(newnode.data, false);
    return new DOMNodeReplaceOperationHandler(oldnode, this.dataMap, remove, insert);
};


/**
 * Return a new forest update operation for a sequence of children of the given
 * node. Remove all children from start through length and replace them with
 * the subtrees given in the replacement array.
 *
 * @param anchor    A DeltaJS.tree.Anchor pointing to the first node which
 *                  should be removed. Should point to the location before
 *                  which elements should be inserted if no nodes are to be
 *                  removed.
 * @param length    Number of tree nodes to be removed
 * @param replacement   Array of replacement tree nodes
 */
DOMOperationHandlerFactory.prototype.createForestUpdateOperationHandler = function(
        anchor, length, replacement, parenthandler) {
    var doc, oldnodes = [], newnodes = [], i,
        node = anchor.base,
        start = anchor.index;

    if (!node) {
        throw new Error('Parameter error: forest update handler needs an anchor with a base');
    }
    else if (typeof start === 'undefined') {
        throw new Error('Parameter error: forest update handler needs an anchor with an index');
    }
    else if (!length && !replacement.length) {
        throw new Error('Forest update operation requires at least one node');
    }

    doc = node.data.ownerDocument;

    for (i = start; i < start + length; i++) {
        oldnodes.push(node.children[i].data);
    }
    for (i = 0; i < replacement.length; i++) {
        newnodes.push(doc.importNode(replacement[i].data, true));
    }

    before = node.children[start + length];

    return new DOMTreeSequenceOperationHandler(node, before, this.dataMap,
            oldnodes, newnodes, parenthandler);
};


/**
 * Return a new operation handler for the given operation at the anchor.
 *
 * @param anchor    A DeltaJS.tree.Anchor
 * @param op        The operation to create a handler for
 */
DOMOperationHandlerFactory.prototype.createOperationHandler = function(anchor, type, path, remove, insert) {
    switch (type) {
        case deltamod.UPDATE_FOREST_TYPE:
            return this.createForestUpdateOperationHandler(anchor,
                    remove.length, insert);

        case deltamod.UPDATE_NODE_TYPE:
            return this.createNodeUpdateOperationHandler(anchor,
                    insert[0]);
    }

    throw new Error('Operation type not supported by this factory');
}


exports.DOMOperationNodeDataMap = DOMOperationNodeDataMap;
exports.DOMNodeReplaceOperationHandler = DOMNodeReplaceOperationHandler;
exports.DOMTreeSequenceOperationHandler = DOMTreeSequenceOperationHandler;
exports.DOMOperationHandlerFactory = DOMOperationHandlerFactory;

});
