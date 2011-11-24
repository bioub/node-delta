/**
 * @file:   Resolver class capable of identifying nodes in a given tree by
 *          pattern matching.
 *
 * @see:    * Sebastian Rönnau, Christian Pauli, and Uwe M. Borghoff. Merging
 *            changes in XML documents using reliable context fingerprints:
 *            http://dx.doi.org/10.1145/1410140.1410151
 *          * Original Sourcecode:
 *            https://launchpad.net/xcc
 */

(function(exports, tree) {
    var INSERT_TYPE = 1;
    var REMOVE_TYPE = 2;
    var UPDATE_TYPE = 3;


    /**
     * Create new patch instance.
     */
    function Delta() {
        this.operations = [];
        this.handlers = [];
    }


    /**
     * Apply the delta to a tree using the specified resolver to identify the
     * locations and the handler factory to instantiate operation handlers.
     *
     * @param resolver  A resolver capable of mapping paths to tree nodes.
     * @param handlerfactory Factory class for operations.
     */
    Delta.prototype.attach = function(resolver, treevalidx, nodevalidx, handlerfactory) {
        var fails = 0; 

        this.operations.forEach(function(op, i) {
            var body, nodes, depth, handler;

            // Calculate subtree hash values of tree nodes in op.oldvalue
            body = [];
            op.oldvalue.forEach(function(node) {
                body.push(treevalidx.get(node));
            });

            // Resolve anchor node
            nodes = resolver.find(op.path, body, op.head, op.tail, treevalidx, nodevalidx);

            // Check if we can accept the resolved location depending on the
            // operation type
            depth = op.path.length;
            if (!nodes || nodes[depth] === undefined || (
                        op.type === INSERT_TYPE &&
                        nodes[depth - 1] === undefined)) {
                // Path not found. Client code must handle failures afterwards.
                fails++;
                return;
            }

            handler = undefined;
            switch (op.type) {
                case INSERT_TYPE:
                    handler = handlerfactory.createSubtreeInsertOperationHandler(
                            nodes[depth - 1], nodes[depth], op.newvalue);
                    break;

                case REMOVE_TYPE:
                    handler = handlerfactory.createSubtreeRemoveOperationHandler(
                            nodes[depth - 1], nodes[depth].childidx,
                            body.length);
                    break;

                case UPDATE_TYPE:
                    handler = handlerfactory.createNodeUpdateOperationHandler(
                            nodes[depth], op.newvalue[0]);
                    break;
            }

            this.handlers[i] = handler;
        }, this);

        return fails;
    }


    /**
     * Add an operation to the delta. Optionally also provide a handler.
     *
     * @param operation An operation
     * @param handler   (optional) The corresponding operation handler.
     */
    Delta.prototype.add = function(operation, handler) {
        this.operations.push(operation);
        this.handlers.push(handler);
    };


    /**
     * Execute the callbac for each operation and its corresponding handler in
     * the delta.
     */
    Delta.prototype.forEach = function(callback, T) {
        var i;

        for (i = 0; i < this.operations.length; i++) {
            callback.call(T, this.operations[i], this.handlers[i]);
        }
    };


    /**
     * Construct a new operation instance.
     */
    function Operation(type, path, head, tail, oldvalue, newvalue) {
        /**
         * The operation type, one of INSERT_TYPE, REMOVE_TYPE, UPDATE_TYPE
         */
        this.type = type;


        /**
         * An array of integers representing the top-down path from the root
         * node to the anchor of this operation. The anchor point always is
         * the first position after the leading context values. For insert
         * operations it will must point to the first element of the tail
         * context.
         */
        this.path = path;


        /**
         * Fingerprint values for the content. For insert operations, this
         * array should be empty. For remove-operations, the array should
         * contain the fingerprint values of the nodes which should be removed,
         * for update operations, the only element should be the fingerprint
         * value of the original node.
         */
        this.head = head;
        this.tail = tail;


        /**
         * Null (insert), one tree.Node (update) or sequence of nodes (delete)
         */
        this.oldvalue = oldvalue;


        /**
         * Null (remove), one tree.Node (update) or sequence of nodes (insert)
         */
        this.newvalue = newvalue;
    }


    function Editor(delta, radius, nodeindex, valindex) {
        this.delta = delta;
        this.radius = radius;
        this.nodeindex = nodeindex;
        this.valindex = valindex;
    }


    Editor.prototype.fingerprint = function(anchor, offset) {
        var i, result = [], n = offset + this.radius;

        for (i = offset; i < n; i++) {
            result.push(this.valindex.get(this.nodeindex.get(anchor, i)));
        }

        return result;
    }


    Editor.prototype.update = function(path, a, b) {
        var head = this.fingerprint(a, -this.radius),
            tail = this.fingerprint(a, 1),
            op = new Operation(UPDATE_TYPE, path, head, tail, [a], [b]);
        this.delta.add(op);
    }


    Editor.prototype.insert = function(path, b_nodes) {
        var head = this.fingerprint(b_nodes[0], -this.radius),
            tail = this.fingerprint(b_nodes[0], b_nodes.length),
            op = new Operation(INSERT_TYPE, path, head, tail, null, b_nodes);
        this.delta.add(op);
    }


    Editor.prototype.remove = function(path, a_nodes) {
        var head = this.fingerprint(a_nodes[0], -this.radius),
            tail = this.fingerprint(a_nodes[0], a_nodes.length),
            op = new Operation(REMOVE_TYPE, path, head, tail, a_nodes, null);
        this.delta.add(op);
    }


    exports.Delta = Delta;
    exports.Operation = Operation;
    exports.Editor = Editor;

    exports.INSERT_TYPE = INSERT_TYPE;
    exports.REMOVE_TYPE = REMOVE_TYPE;
    exports.UPDATE_TYPE = UPDATE_TYPE;
}(
    typeof exports === 'undefined' ? (DeltaJS.patch={}) : exports,
    typeof require === 'undefined' ? DeltaJS.tree: require('./tree.js')
));
