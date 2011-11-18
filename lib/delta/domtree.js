/**
 * @file:   Adapter class converting an XML DOM document into a simple tree
 *          structure suitable for comparison using the XCC tree diff
 *          algorithm.
 */

(function(exports, tree, platform) {
    function DOMTreeAdapter() {
    }


    DOMTreeAdapter.prototype.hash = function(node) {
        // FIXME
        return node.tagName;
    };


    /**
     * Create node wrappers for the specified element or text node and all its
     * descentants and return toplevel wrapper.
     **/
    DOMTreeAdapter.prototype.adaptElement = function(element) {
        return mapdom(element, function(node, wrappedParent) {
            var wrappedNode;

            if (node.nodeType === 1 || node.nodeType === 3) {
                wrappedNode = new tree.Node(this.hash(node), node);
                if (wrappedParent) {
                    wrappedParent.append(wrappedNode);
                }
            }

            return wrappedNode;
        }, this);
    };


    /**
     * Create node wrappers for all element and text nodes in the specified
     * document and return the root wrapper.
     */
    DOMTreeAdapter.prototype.adaptDocument = function(doc) {
        return this.adaptElement(doc.documentElement);
    };


    /**
     * A function that visits every node of a DOM tree in document order. Calls
     * a callback with the visited node and the result of the callback from
     * visitting the parent node.
     *
     * This function is a modified version of Douglas Crockfords walk_the_DOM
     * function from his book "Javascript: The Good Parts".
     *
     * @param node      The DOM node representing the starting point for the
     *                  mapping operation
     * @param callback  function(node, parents_result)
     * @param T         context parameter bound to "this" when invoking the
     *                  callback 
     * @param presult   Internal use.
     */
    function mapdom(node, callback, T, presult) {
        var result = callback.call(T, node, presult);
        node = node.firstChild;
        while (node) {
            mapdom(node, callback, T, result);
            node = node.nextSibling;
        }
        return result;
    }

    function DOMHash() {
    }


    // FIXME: CDATA sections
    DOMHash.prototype.ELEMENT_PREFIX = '\0\0\0\1';
    DOMHash.prototype.ATTRIBUTE_PREFIX = '\0\0\0\2';
    DOMHash.prototype.TEXT_PREFIX = '\0\0\0\3';
    DOMHash.prototype.PI_PREFIX = '\0\0\0\7';
    DOMHash.prototype.SEPARATOR = '\0\0';

    DOMHash.prototype.process = function(domnode, hash) {
        switch(domnode.nodeType) {
            case (domnode.ELEMENT_NODE):
                this.processElement(domnode, hash);
                break;

            case (domnode.ATTRIBUTE_NODE):
                this.processAttribute(domnode, hash);
                break;

            case (domnode.TEXT_NODE):
                this.processText(domnode, hash);
                break;

            default:
                console.log('DOMHash: node-type ' + domnode.nodeType + ' not supported');
                break;
        }

        return hash;
    }


    /**
     * Helper method: Return qualified name of a DOM element or attribute node
     */
    DOMHash.prototype.qualifiedName = function(domnode) {
        var ns = '';
        if (domnode.namespaceURI) {
            ns = domnode.namespaceURI + ':';
        }
        return ns + domnode.nodeName.split(':').slice(-1)[0];
    }


    DOMHash.prototype.processElement = function(domnode, hash) {
        var attrqns, attrnodes;

        // Process tag
        hash.update(this.ELEMENT_PREFIX);
        hash.update(this.qualifiedName(domnode));
        hash.update(this.SEPARATOR);

        // Process attributes
        if (domnode.hasAttributes()) {
            attrqns = [];
            attrnodes = {};
            platform.attributesArray(domnode).forEach(function(n) {
                if (n.name !== 'xmlns' && n.prefix !== 'xmlns') {
                    var qn = this.qualifiedName(n);
                    attrqns.push(qn);
                    attrnodes[qn] = n;
                }
            }, this);
            attrqns = attrqns.sort();
            attrqns.forEach(function(qn) {
                this.processAttribute(attrnodes[qn], hash, qn);
            }, this);
        }
    }


    DOMHash.prototype.processAttribute = function(domnode, hash, qn) {
        qn = qn || this.qualifiedName(domnode);
        hash.update(this.ATTRIBUTE_PREFIX);
        hash.update(qn);
        hash.update(this.SEPARATOR);
        hash.update(domnode.nodeValue);
    }


    DOMHash.prototype.processText = function(domnode, hash) {
        hash.update(this.TEXT_PREFIX);
        hash.update(domnode.nodeValue);
    }

    /**
     * Construct a new DOM operation element capable of changing the attributes
     * of a single node.
     *
     * @param   oldnode     A DOM element representing the original node
     * @param   newnode     A DOM element representing the changed node
     */
    function DOMNodeAttributeOperation(oldnode, newnode) {
        var i, oldattrs, newattrs;

        this.node = oldnode;

        oldattrs = platform.attributesArray(oldnode);
        newattrs = platform.attributesArray(newnode);
        for (i = newattrs.length - 1; i >= 0; i--) {
            newnode.removeAttributeNode(newattrs[i]);
        }

        this.oldattrs = oldattrs;
        this.newattrs = newattrs;

        this.state = false;
    }


    /**
     * Toggle active state of this hunk.
     */
    DOMNodeAttributeOperation.prototype.toggle = function() {
        var remove = this.state ? this.newattrs : this.oldattrs,
            insert = this.state ? this.oldattrs : this.newattrs,
            i;
        for (i = 0; i < remove.length; i++) {
            this.node.removeAttributeNode(remove[i]);
        }
        for (i = 0; i < insert.length; i++) {
            this.node.setAttributeNode(insert[i]);
        }
        this.state = !this.state;
    };


    /**
     * Return true if this hunk is active.
     */
    DOMNodeAttributeOperation.prototype.isActive = function() {
        return this.state;
    };


    /**
     * Activate this hunk, remove old attributes and insert new attributes if
     * necessary.
     */
    DOMNodeAttributeOperation.prototype.activate = function() {
        if (!this.state) {
            this.toggle();
        }
    };


    /**
     * Deactivate this hunk, remove inserted attributes and reinsert removed
     * attributes if necessary.
     */
    DOMNodeAttributeOperation.prototype.deactivate = function() {
        if (this.state) {
            this.toggle();
        }
    };


    /**
     * Construct a new DOM operation element capable of replacing the specified
     * subtrees.
     *
     * @param   node        The DOM element whose children should be replaced
     * @param   before      The sibling where new nodes should be attached
     *                      before
     * @param   oldnodes    An array of the root DOM elements of the original
     *                      subtrees
     * @param   newnodes    An array of the root DOM elements of the changed 
     *                      subtrees
     */
    function DOMTreeSequenceOperation(node, before, oldnodes, newnodes) {
        this.node = node;
        this.before = before;

        this.oldnodes = oldnodes;
        this.newnodes = newnodes;
    }


    /**
     * Toggle active state
     */
    DOMTreeSequenceOperation.prototype.toggle = function() {
        var remove = this.state ? this.newnodes : this.oldnodes,
            insert = this.state ? this.oldnodes : this.newnodes,
            node = this.node,
            before = this.before,
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
    DOMTreeSequenceOperation.prototype.isActive = function() {
        return this.state;
    };


    /**
     * Activate this hunk, inserting new subtrees and removing old subtrees if
     * necessary.
     */
    DOMTreeSequenceOperation.prototype.activate = function() {
        if (!this.state) {
            this.toggle();
        }
    };


    /**
     * Deactivate this hunk, removing inserted nodes and inserting removed
     * nodes into if necessary.
     */
    DOMTreeSequenceOperation.prototype.deactivate = function() {
        if (this.state) {
            this.toggle();
        }
    };


    /**
     * Construct a DOM operation factory.
     */
    function DOMOperationFactory() {
    }


    /**
     * Return a new node update operation on the given node.
     *
     * @param oldnode   A DeltaJS.tree.node pointing to the node with old values
     * @param newnode   A DeltaJS.tree.node pointing to the node with the new values
     */
    DOMOperationFactory.prototype.createNodeUpdateOperation = function(oldnode,
            newnode) {
        oldvalue = oldnode.data;
        newvalue = oldnode.data.ownerDocument.importNode(newnode.data, false);
        return new DOMNodeAttributeOperation(oldnode, oldvalue, newvalue);
    };


    /**
     * Return a new insert operation for a sequence of children of the given
     * node.
     *
     * @param node      A DeltaJS.tree.node
     * @param before    Index of the child node before which the new nodes will
     *                  be inserted.
     * @param newnodes  Sequence of DeltaJS.tree.node to insert
     */
    DOMOperationFactory.prototype.createSubtreeInsertOperation = function(node,
            before, newnodes) {
        var doc = node.data.ownerDocument,
            domnodes = [], i, n;

        before = node.children[before] && node.children[before].data;

        if (newnodes.length > 0) {
            for (i = 0; i < newnodes.length; i++) {
                domnodes.push(doc.importNode(newnodes[i].data));
            }
        }
        return new DOMTreeSequenceOperation(node.data, before, [], domnodes);
    };


    /**
     * Return a new remove operation for a sequence of children of the given
     * node.
     *
     * @param node      A DeltaJS.tree.node
     * @param begin     Index of the first child node affected by the remove
     *                  operation.
     * @param length    Number of child nodes to be removed.
     */
    DOMOperationFactory.prototype.createSubtreeRemoveOperation = function(node, begin, length) {
        var oldnodes = [], before, i, n;

        if (length) {
            n = begin + length;
            for (i = begin; i < n; i++) {
                oldnodes.push(node.children[i].data);
            }
            before = oldnodes[oldnodes.length - 1].nextSibling;

            return new DOMTreeSequenceOperation(node.data, before, oldnodes, []);
        }
    };


    exports.DOMTreeAdapter = DOMTreeAdapter;
    exports.DOMHash = DOMHash;
    exports.DOMNodeAttributeOperation = DOMNodeAttributeOperation;
    exports.DOMTreeSequenceOperation = DOMTreeSequenceOperation;
    exports.DOMOperationFactory = DOMOperationFactory;
}(
    typeof exports === 'undefined' ? (DeltaJS.domtree={}) : exports,
    typeof require === 'undefined' ? DeltaJS.tree : require('./tree.js'),
    typeof require === 'undefined' ? DeltaJS.platform : require('./platform.js')
));
