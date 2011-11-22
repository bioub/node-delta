(function(exports, domdelta, domtree, tree, platform){
    exports['Simple subtree operation'] = function(test) {
        var original_doc = platform.parseXML('<r><c1/><c2/><c3/><c4/></r>');
        var r = original_doc.firstChild;
        var c1= r.firstChild;
        var c2 = c1.nextSibling;
        var c3 = c2.nextSibling;
        var c4 = c3.nextSibling;
        var original_nodes = [c2, c3];
        var before = c4;

        var replacement_doc = platform.parseXML('<d><c2x/></d>');
        var c2xr = replacement_doc.firstChild.firstChild;
        var c2xo = original_doc.importNode(c2xr, true);
        var replacement_nodes = [c2xo];

        var op = new domdelta.DOMTreeSequenceOperationHandler(r, before, original_nodes, replacement_nodes);

        var expect_siblings;
        var actual_siblings;

        // replace original nodes with replacement nodes
        op.toggle();

        expect_siblings = [c1, c2xo, c4];
        actual_siblings = Array.prototype.slice.call(r.childNodes);
        test.deepEqual(actual_siblings, expect_siblings);

        // switch back from replacement nodes to original nodes
        op.toggle();

        expect_siblings = [c1, c2, c3, c4];
        actual_siblings = Array.prototype.slice.call(r.childNodes);
        test.deepEqual(actual_siblings, expect_siblings);

        test.done();
    }

    exports['Simple node replace operation'] = function(test) {
        var original_doc = platform.parseXML('<n id="1" name="test" value="3"><a/><b/></n>');
        var original_node = original_doc.firstChild;
        var original_attrs = [
            original_node.getAttributeNode('id'),
            original_node.getAttributeNode('name'),
            original_node.getAttributeNode('value'),
        ];
        var original_children = [
            original_node.firstChild,
            original_node.firstChild.nextSibling,
        ];

        var replacement_doc = platform.parseXML('<nx name="changed" value="2"/>');
        var replacement_node = original_doc.importNode(replacement_doc.firstChild, true);
        var replacement_attrs = [
            replacement_node.getAttributeNode('name'),
            replacement_node.getAttributeNode('value'),
        ];

        var op = new domdelta.DOMNodeReplaceOperationHandler(original_node, replacement_node);

        var expect_attributes;
        var actual_attributes;

        // replace original attrs with replacement attrs
        op.toggle();

        expect_attributes = replacement_attrs;
        actual_attributes = platform.attributesArray(original_doc.firstChild);
        test.deepEqual(actual_attributes, expect_attributes);

        expect_children = original_children;
        actual_children = Array.prototype.slice.call(original_doc.firstChild.childNodes);
        test.deepEqual(actual_children, expect_children);

        // switch back from replacement attrs to original attrs
        op.toggle();

        expect_attributes = original_attrs;
        actual_attributes = platform.attributesArray(original_doc.firstChild);
        test.deepEqual(actual_attributes, expect_attributes);

        expect_children = original_children;
        actual_children = Array.prototype.slice.call(original_doc.firstChild.childNodes);
        test.deepEqual(actual_children, expect_children);

        test.done();
    }

    exports['Insert operation using operation factory'] = function(test) {
        var original_doc = platform.parseXML('<r><c1/><c2/><c3/><c4/></r>');
        var treeAdapter = new domtree.DOMTreeAdapter();
        var original_tree = treeAdapter.adaptDocument(original_doc);

        var replacement_doc = platform.parseXML('<insert><c2x/></insert>');
        var replacement_tree = treeAdapter.adaptDocument(replacement_doc);

        var factory = new domdelta.DOMOperationHandlerFactory();
        var insert_op = factory.createSubtreeInsertOperationHandler(
                original_tree, 3, replacement_tree.children);

        var r = original_doc.firstChild;
        var expect_nodes;
        var actual_nodes;

        // replace original nodes with replacement nodes
        insert_op.toggle();
        expect_nodes = ['c1','c2','c3','c2x','c4'];
        actual_nodes = Array.prototype.slice.call(r.childNodes).map(
            function(n) {return n.tagName});
        test.deepEqual(actual_nodes, expect_nodes);

        // switch back from replacement nodes to original nodes
        insert_op.toggle();
        expect_nodes = ['c1','c2','c3','c4'];
        actual_nodes = Array.prototype.slice.call(r.childNodes).map(
            function(n) {return n.tagName});
        test.deepEqual(actual_nodes, expect_nodes);

        test.done();
    }

    exports['Remove operation using operation factory'] = function(test) {
        var original_doc = platform.parseXML('<r><c1/><c2/><c3/><c4/></r>');
        var treeAdapter = new domtree.DOMTreeAdapter();
        var original_tree = treeAdapter.adaptDocument(original_doc);

        var factory = new domdelta.DOMOperationHandlerFactory();
        var remove_op = factory.createSubtreeRemoveOperationHandler(
                original_tree, 1, 2);

        var r = original_doc.firstChild;
        var expect_nodes;
        var actual_nodes;

        // replace original nodes with replacement nodes
        remove_op.toggle();
        expect_nodes = ['c1','c4'];
        actual_nodes = Array.prototype.slice.call(r.childNodes).map(
            function(n) {return n.tagName});
        test.deepEqual(actual_nodes, expect_nodes);

        // switch back from replacement nodes to original nodes
        remove_op.toggle();
        expect_nodes = ['c1','c2','c3','c4'];
        actual_nodes = Array.prototype.slice.call(r.childNodes).map(
            function(n) {return n.tagName});
        test.deepEqual(actual_nodes, expect_nodes);

        test.done();
    }
}(
    typeof exports === 'undefined' ? (DeltaJS.domdeltaTest={}) : exports,
    typeof require === 'undefined' ? DeltaJS.domdelta : require('../lib/delta/domdelta.js'),
    typeof require === 'undefined' ? DeltaJS.domtree : require('../lib/delta/domtree.js'),
    typeof require === 'undefined' ? DeltaJS.tree : require('../lib/delta/tree.js'),
    typeof require === 'undefined' ? DeltaJS.platform : require('../lib/delta/platform.js')
));
