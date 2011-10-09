/**
 * @file:   Implementation of Myers longest common subsequence algorithm using
 *          an edit graph.
 * @see:
 * * http://dx.doi.org/10.1007/BF01840446
 * * http://citeseer.ist.psu.edu/viewdoc/summary?doi=10.1.1.4.6927
 */

(function(exports){
    function Editgraph(a, b, x, y, N, M, dmax) {
        this.a = a;
        this.b = b;

        this.x = (typeof x === 'undefined') ? 0 : x;
        this.y = (typeof y === 'undefined') ? 0 : y;
        this.N = (typeof N === 'undefined') ? a.length : N;
        this.M = (typeof M === 'undefined') ? b.length : M;
        this.dmax = (typeof dmax === 'undefined') ? this.N + this.M : dmax;
    }

    Editgraph.prototype.equals = function(a, b) {
        return (a === b);
    };


    /**
     * Call a function for each D-Path identified using myers basic greedy lcs
     * algorithm.
     *
     * Returns the length of the shortest edit script, i.e. the minimal number
     * of insert and delete operations required to turn a into b.
     *
     * @param onpath function(dpath, precedessor)
     */
    Editgraph.prototype.forEachDpath = function (onpath, T) {
        var d, k, path, prev, end;
        var V = {};

        V[1] = new Dpath(Dpath.FORWARD, 1, 0);
        for (d = 0; d <= this.dmax; d++) {
            for (k = -d; k <= d; k+=2) {
                path = new Dpath(Dpath.FORWARD, k);
                prev = this.extendDpathFw(path, -d, d, V);
                if (onpath) {
                    onpath.call(T, path, prev, d);
                }

                // check if we are done
                end = path.getSnakeEnd();
                if (end.x >= this.N && end.y >= this.M) {
                    return d;
                }
            }
        }
    };

    /**
     * Call a function for each reverse D-Path identified using myers basic
     * greedy lcs algorithm.
     *
     * Returns the length of the shortest edit script, i.e. the minimal number
     * of insert and delete operations required to turn a into b.
     *
     * @param onpath function(dpath, precedessor)
     */
    Editgraph.prototype.forEachReverseDpath = function (onpath, T) {
        var delta = this.N - this.M;
        var d, k, path, prev, end;
        var V = {};

        V[delta-1] = new Dpath(Dpath.BACKWARD, delta-1, this.N);
        for (d = 0; d <= this.dmax; d++) {
            for (k = -d+delta; k <= d+delta; k+=2) {
                path = new Dpath(Dpath.BACKWARD, k);
                prev = this.extendDpathBw(path, -d+delta, d+delta, V);
                if (onpath) {
                    onpath.call(T, path, prev, d);
                }

                // check if we are done
                end = path.getSnakeEnd();
                if (end.x <= 0 && end.y <= 0) {
                    return d;
                }
            }
        }
    };

    Editgraph.prototype.extendDpathFw = function(path, kmin, kmax, V) {
        var prev;
        var k = path.k;

        // Determine the preceeding d-path segment. Pick the one whose furthest
        // reaching x value is greatest.
        if (k === kmin || (k !== kmax && V[k-1].x < V[k+1].x)) {
            // Furthest reaching d-path segment is above (k+1), move down.
            prev = V[k+1];
            path.xo = prev.x;
        }
        else {
            // Furthest reaching d-path segment is left (k-1), move right.
            prev = V[k-1];
            path.xo = prev.x+1;
        }

        // Compute the snake: Move along the diagonal as long as there are
        // common values in a and b.
        path.x = path.xo;
        while (path.x < this.N && path.x - k < this.M && this.equals(
                    this.a[this.x + path.x], this.b[this.y + path.x - k])) {
            path.x++;
        }

        // Memozie computed path
        V[k] = path;

        // Return preceeding path
        return prev;
    };


    Editgraph.prototype.extendDpathBw = function(path, kmin, kmax, V) {
        var prev;
        var k = path.k;

        // Determine the preceeding d-path segment. Pick the one whose furthest
        // reaching x value is greatest.
        if (k === kmax || (k !== kmin && V[k-1].x < V[k+1].x)) {
            // Furthest reaching d-path segment is underneath (k-1), move up.
            prev = V[k-1];
            path.xo = prev.x;
        }
        else {
            // Furthest reaching d-path segment is left (k-1), move right.
            prev = V[k+1];
            path.xo = prev.x-1;
        }

        // Compute the snake: Move along the diagonal as long as there are
        // common values in a and b.
        path.x = path.xo;
        while (path.x > 0 && path.x - k > 0 && this.equals(
                    this.a[this.x + path.x - 1], this.b[this.y + path.x - k - 1])) {
            path.x--;
        }

        // Memozie computed path
        V[k] = path;

        // Return preceeding path
        return prev;
    };


    /**
     * Middle snake
     */
    Editgraph.prototype.middleSnake = function (onpath) {
        var delta = this.N - this.M;
        var d, k;
        var Vf = {'1': 0};
        var Vb = {'1': 0};
        var result;

        for (d = 0; d <= this.dmax/2; d++) {
            for (k = -d; k <= d; k+=2) {
                result = this.extendDpathFw(k, -d, d, Vf, function(x, x0, k0) {
                    var y = x-k;
                    var y0 = x0-k;

                    if (onpath) onpath(d, x, k, x0, k0);

                    // check for overlap
                    if (delta % 2 === 1 && (k === delta - (d-1) || k === delta + (d+1))) {
                        if (Vf[k] >= Vb[k]) {
                            // return last forward snake
                            return [this.x + x, this.y + y, this.x + x0, this.y + y0]
                        }
                    }
                });
                if (result) {
                    return result;
                }
            }


            for (k = -d; k <= d; k+=2) {
                result = this.extendDpathBw(k+delta, -d+delta, d+delta, Vb, function(d, x, k, x0, k0) {
                    var y = x-k;
                    var y0 = x0-k;

                    if (onpath) onpath(d, x, k, x0, k0);

                    // check for overlap
                    if (delta % 2 === 0 && (k + delta === -d || k + delta === d)) {
                        if (Vf[k+delta] >= Vb[k+delta]) {
                            // return last forward snake
                            return [this.x + x, this.y + y, this.x + x0, this.y + y0]
                        }
                    }
                });
                if (result) {
                    return result;
                }
            }
        }
    }


    /**
     * Calculates the longest common subsequence from arrays a and b. Returns the
     * length of the shortest edit script, i.e. the minimal number of insert and
     * delete operations required to turn a into b.
     */
    Editgraph.prototype.editgraph_simple = function (builder) {
        var d;

        d = this.forEachDpath(function(path, prev) {
            var vertical = (prev.k > path.k);
            var start = path.getSnakeStart();
            if (vertical) {
                builder.down(start.x, start.y);
            }
            else {
                builder.right(start.x, start.y);
            }

            path.forEachCommonSymbolForward(function(x, y) {
                builder.diag(x+1, y+1);
            });
        });

        return d;
    };


    /**
     * Calculates the longest common subsequence of a and b.
     */
    Editgraph.prototype.lcs_simple = function () {
        var last_path;
        var path;
        var result;

        this.forEachDpath(function(path, prev) {
            if (prev) {
                path.prepend(prev);
            }
            last_path = path;
        });

        if (last_path.x !== this.a.length) {
            throw new Error('Programming error: end-point of last path must match the length of the input array.\n');
        }

        result = [];
        for (path = last_path; path; path = path.previous) {
            path.forEachCommonSymbolBackward(function(x,y) {
                result.unshift(this.a[x]);
            }, this);
        }

        return result;
    };


    /**
     * Create the shortest edit script turning a into b. Editor should be an
     * object with the following two methods:
     *
     * * insert(idx, symbol)
     * * remove(idx)
     */
    Editgraph.prototype.ses_simple = function (editor) {
        var last_path;
        var path;
        var pos;

        this.forEachDpath(function(dpath, prev) {
            if (prev) {
                dpath.prepend(prev);
            }
            last_path = dpath;
        });

        result = [];
        for (path = last_path; path.previous; path = path.previous) {
            if (path.hasEdit()) {
                pos = path.editPosition();
                if (path.editIsInsert()) {
                    editor.insert(pos.x, this.b[pos.y]);
                }
                else {
                    editor.remove(pos.x);
                }
            }
        }
    };


    /**
     * Dpath
     */
    function Dpath(dir, k, x, xo) {
        /**
         * The direction of this Dpath.
         */
        this.dir = dir;

        /**
         * The k-line on which the snake-part is located at.
         */
        this.k = k;

        /**
         * Furthest reaching x coordinate, when dir=FORWARD x >= xo otherwise
         * x <= xo. X marks the end of the snake.
         */
        this.x = x;

        /**
         * X coordinate of the operation and at the same time the other end of
         * the snake.
         */
        this.xo = (typeof xo === 'undefined') ? x : xo;

        /**
         * The precedessor of this Dpath.
         */
        this.previous = undefined;
    }

    Dpath.FORWARD = 1;
    Dpath.BACKWARD = -1;

    /**
     * Call appropriate editor commands in order to turn a into b.
     *
     * Editor should implement:
     * * insert(seq, idx, symbol);
     * * remove(seq, idx, symbol);
     */
    Dpath.prototype.edit = function(editor, a, b) {
    };

    /**
     * Return true if this d-path includes an insert or remove method.
     */
    Dpath.prototype.hasEdit = function() {
        return !!this.previous;
    };

    /**
     * Return the position of the edit operation.
     */
    Dpath.prototype.editPosition = function() {
        if (this.dir === Dpath.FORWARD) {
            return this.previous.getSnakeEnd();
        }
        else {
            return this.getSnakeStart();
        }
    };

    /**
     * Return for an insert operation (vertical) and false for a remove.
     */
    Dpath.prototype.editIsInsert = function() {
        if (this.dir === Dpath.FORWARD) {
            return this.previous.k > this.k;
        }
        else {
            return this.k > this.previous.k;
        }
    }

    /**
     * Call callback for each (x,y) representing a symbol which both of the
     * sequences have in common. Proceed from the point of the snake which is
     * nearest to (0,0) to the point of the snake which is nearest to (N,M).
     */
    Dpath.prototype.forEachCommonSymbolForward = function(callback, T) {
        var end = this.getSnakeHigh();
        var cur;

        for (cur = this.getSnakeLow(); cur.x < end.x && cur.y < end.y; cur.x++, cur.y++) {
            callback.call(T, cur.x, cur.y);
        }
    };

    /**
     * Call callback for each (x,y) representing a symbol which both of the
     * sequences have in common. Proceed from the point of the snake which is
     * nearest to (N,M) to the point of the snake which is nearest to (0,0).
     */
    Dpath.prototype.forEachCommonSymbolBackward = function(callback, T) {
        var end = this.getSnakeLow();
        var cur = this.getSnakeHigh();

        for (cur.x--, cur.y--; cur.x >= end.x && cur.y >= end.y; cur.x--, cur.y--) {
            callback.call(T, cur.x, cur.y);
        }
    };

    /**
     * Call appropriate plotting commands in order to visualize the Dpath.
     */
    Dpath.prototype.forEachEdge = function(callback, T) {
        // Orthogonal line (corresponds to insert/remove operations)
        if (this.previous) {
            callback.call(T, this.previous.getSnakeEnd(), this.getSnakeStart());
        }
        // Diagonal line (corresponds to skip operations/equal symbols)
        if (this.x !== this.xo) {
            callback.call(T, this.getSnakeStart(), this.getSnakeEnd());
        }
    };

    /**
     * Return the start of the snake of this d-path.
     *
     * This point also represents the point of action for operations.
     */
    Dpath.prototype.getSnakeStart = function() {
        return {
            'x': this.xo,
            'y': this.xo-this.k
        };
    };

    /**
     * Return the point of the d-path which is furthest away from the origin of
     * the current direction.
     *
     * For forward-paths this returns the point which is furthest away from
     * (0,0), for reverse-paths (N,M).
     */
    Dpath.prototype.getSnakeEnd = function() {
        return {
            'x': this.x,
            'y': this.x-this.k
        };
    };

    /**
     * Return the point of the d-path which is nearest to (0,0)
     */
    Dpath.prototype.getSnakeLow = function() {
        return (this.dir === Dpath.FORWARD) ? this.getSnakeStart() : this.getSnakeEnd();
    }

    /**
     * Return the point of the d-path which is furthest away from (0,0)
     */
    Dpath.prototype.getSnakeHigh = function() {
        return (this.dir === Dpath.FORWARD) ? this.getSnakeEnd() : this.getSnakeStart();
    }

    /**
     * Set the the given dpath as the predecessor of this one.
     */
    Dpath.prototype.prepend = function(predecessor) {
        if (predecessor.dir !== this.dir) {
            throw new Error('Directions must match');
        }
        this.previous = predecessor;
    };

    // CommonJS exports
    exports.Editgraph = Editgraph;
    exports.Dpath = Dpath;

}(typeof exports === 'undefined' ? (this.editgraph={}) : exports));
