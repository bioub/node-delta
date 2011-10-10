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
        var d, k, path, k0, end;
        var V = {};

        V[1] = 0;
        path = new Dpath();
        for (d = 0; d <= this.dmax; d++) {
            for (k = -d; k <= d; k+=2) {
                path.k = k;
                k0 = this.extendDpathFw(path, -d, d, V);
                if (onpath) {
                    onpath.call(T, path, k0, d);
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
        var d, k, path, k0, end;
        var V = {};

        V[delta-1] = this.N;
        path = new Dpath();
        for (d = 0; d <= this.dmax; d++) {
            for (k = -d+delta; k <= d+delta; k+=2) {
                path.k = k;
                k0 = this.extendDpathBw(path, -d+delta, d+delta, V);
                if (onpath) {
                    onpath.call(T, path, k0, d);
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
        var k0, x, k = path.k;

        // Determine the preceeding d-path segment. Pick the one whose furthest
        // reaching x value is greatest.
        if (k === kmin || (k !== kmax && V[k-1] < V[k+1])) {
            // Furthest reaching d-path segment is above (k+1), move down.
            k0 = k+1;
            x = V[k0];
        }
        else {
            // Furthest reaching d-path segment is left (k-1), move right.
            k0 = k-1;
            x = V[k0] + 1;
        }

        path.xl = x;

        // Compute the snake: Move along the diagonal as long as there are
        // common values in a and b.
        while (x < this.N && x - k < this.M && this.equals(
                    this.a[this.x + x], this.b[this.y + x - k])) {
            x++;
        }
        path.xh = x;

        // Memozie computed path
        V[k] = x;

        // Return preceeding path
        return k0;
    };


    Editgraph.prototype.extendDpathBw = function(path, kmin, kmax, V) {
        var k0, x, k = path.k;

        // Determine the preceeding d-path segment. Pick the one whose furthest
        // reaching x value is greatest.
        if (k === kmax || (k !== kmin && V[k-1] < V[k+1])) {
            // Furthest reaching d-path segment is underneath (k-1), move up.
            k0 = k-1;
            x = V[k-1];
        }
        else {
            // Furthest reaching d-path segment is left (k-1), move right.
            k0 = k+1;
            x = V[k0]-1;
        }

        path.xh = x;

        // Compute the snake: Move along the diagonal as long as there are
        // common values in a and b.
        while (x > 0 && x - k > 0 && this.equals(
                    this.a[this.x + x - 1], this.b[this.y + x - k - 1])) {
            x--;
        }
        path.xl = x;

        // Memozie computed path
        V[k] = x;

        // Return preceeding path
        return k0;
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
     * Returns the edit position for the operation between the two snakes left
     * and right.
     */
    Editgraph.prototype.editPosition = function(left, right) {
        return left.getSnakeEnd();
    }


    /**
     * Returns true if the odit operation between the two snakes left and right
     * is an insert operation. Returns false for a delete operation.
     */
    Editgraph.prototype.editIsInsert = function(left, right) {
        return left.k > right.k;
    }


    /**
     * Calculates the longest common subsequence from arrays a and b. Returns the
     * length of the shortest edit script, i.e. the minimal number of insert and
     * delete operations required to turn a into b.
     */
    Editgraph.prototype.editgraph_simple = function (builder) {
        var path_heads = [];
        var d;

        d = this.forEachDpath(function(path, k0) {
            var prev = path_heads[k0];
            path = path.copy();
            path_heads[path.k] = path;

            var vertical = (k0 > path.k);
            var start = path.getSnakeStart();
            if (vertical) {
                builder.down(start.x, start.y);
            }
            else {
                builder.right(start.x, start.y);
            }

            if (prev) {
                Dpath.forEachCommonSymbolForward(prev, path, function(x, y) {
                    builder.diag(x+1, y+1);
                });
            }
        });

        return d;
    };


    /**
     * Calculates the longest common subsequence of a and b.
     */
    Editgraph.prototype.lcs_simple = function () {
        var path_heads = [];
        var last_path;
        var path;
        var result;

        this.forEachDpath(function(path, k0) {
            var prev = path_heads[k0];
            path = path.copy();

            if (prev) {
                path.previous = prev;
            }

            path_heads[path.k] = path;
            last_path = path;
        });

        if (last_path.xh !== this.a.length) {
            throw new Error('Programming error: end-point of last path must match the length of the input array.\n');
        }

        result = [];
        for (path = last_path; path.previous; path = path.previous) {
            Dpath.forEachCommonSymbolBackward(path.previous, path, function(x,y) {
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
        var path_heads = [];
        var last_path;
        var path;
        var pos;

        this.forEachDpath(function(path, k0) {
            var prev = path_heads[k0];
            path = path.copy();

            if (prev) {
                path.previous = prev;
            }

            path_heads[path.k] = path;
            last_path = path;
        });

        result = [];
        for (path = last_path; path.previous; path = path.previous) {
            pos = this.editPosition(path.previous, path);
            if (this.editIsInsert(path.previous, path)) {
                editor.insert(pos.x, this.b[pos.y]);
            }
            else {
                editor.remove(pos.x);
            }
        }
    };


    /**
     * Dpath
     */
    function Dpath(k, xl, xh) {
        /**
         * The k-line on which the snake-part is located at.
         */
        this.k = k;

        /**
         * The start of the snake nearest to (0,0)
         */
        this.xl = xl;

        /**
         * The end of the snake nearest to (N,M)
         */
        this.xh = (typeof xh === 'undefined') ? xl : xh;
    }


    Dpath.prototype.copy = function() {
        return new Dpath(this.k, this.xl, this.xh);
    }

    /**
     * Return the start of the snake of this d-path.
     *
     * This point also represents the point of action for operations.
     */
    Dpath.prototype.getSnakeStart = function() {
        return {
            'x': this.xl,
            'y': this.xl-this.k
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
            'x': this.xh,
            'y': this.xh-this.k
        };
    };


    /**
     * Calls callback for each common symbol encountered when traversing the
     * right snake bound by the left one from left to right.
     *
     * @param left Left snake head
     * @param right Right snake head
     */
    Dpath.forEachCommonSymbolForward = function(left, right, callback, T) {
        var k = right.k;
        var x = k > left.k ? left.xh + 1 : left.xh;
        var xmax = right.xh;

        while (x < xmax) {
            callback.call(T, x, x-k);
            x++;
        }
    }


    /**
     * Calls callback for each common symbol encountered when traversing the
     * right snake bound by the left one from right to left.
     *
     * @param left Left snake head
     * @param right Right snake head
     */
    Dpath.forEachCommonSymbolBackward = function(left, right, callback, T) {
        var k = right.k;
        var xmin = k > left.k ? left.xh + 1 : left.xh;
        var x = right.xh;

        while (x > xmin) {
            x--;
            callback.call(T, x, x-k);
        }
    }

    // CommonJS exports
    exports.Editgraph = Editgraph;
    exports.Dpath = Dpath;

}(typeof exports === 'undefined' ? (this.editgraph={}) : exports));
