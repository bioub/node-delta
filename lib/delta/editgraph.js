/**
 * @file:   Implementation of Myers longest common subsequence algorithm using
 *          an edit graph.
 * @see:
 * * http://dx.doi.org/10.1007/BF01840446
 * * http://citeseer.ist.psu.edu/viewdoc/summary?doi=10.1.1.4.6927
 */

(function(exports){

    function Editgraph(a, b, x, y, M, N) {
        this.a = a;
        this.b = b;

        this.x = x || 0;
        this.y = y || 0;
        this.N = N || a.length;
        this.M = M || b.length;
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
     * @param a Sequence
     * @param b Sequence
     * @param dmax Integer <= a.length + b.length
     * @param onpath function(d, x, k, x0, k0)
     */
    Editgraph.prototype.forEachDpath = function (dmax, onpath) {
        var d, k;
        var V = {};
        var that = this;

        if (!dmax) dmax = this.N + this.M;

        V[1] = 0;
        for (d = 0; d <= dmax; d++) {
            for (k = -d; k <= d; k+=2) {
                var result = this.extendDpathFw(d, k, V, function(x, x0, k0) {
                    var y = x-k;

                    if (onpath) onpath(d, x, k, x0, k0);

                    // check if we are done
                    if (x >= that.N && y >= that.M) {
                        return d;
                    }
                });
                if (result) {
                    return result;
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
     * @param a Sequence
     * @param b Sequence
     * @param dmax Integer <= a.length + b.length
     * @param onpath function(d, x, k, x0, k0)
     */
    Editgraph.prototype.forEachReverseDpath = function (dmax, onpath) {
        var delta = this.N-this.M;
        var d, k;
        var V = {};

        if (!dmax) dmax = this.N + this.M;

        V[k+delta-1] = this.M;
        for (d = 0; d <= dmax; d++) {
            for (k = -d; k <= d; k+=2) {
                var result = this.extendDpathBw(d+delta, k, V, function(x, x0, k0) {
                    var y = x-(k+delta);

                    if (onpath) onpath(d, x, k+delta, x0, k0);

                    // check if we are done
                    if (x >= 0 && y >= 0) {
                        return d;
                    }
                });
                if (result) {
                    return result;
                }
            }
        }
    };

    Editgraph.prototype.extendDpathFw = function(d, k, V, onpath) {
        var k0, x0, x, y;

        // figure out if we have to move down or right from the previous
        // k-line.
        if (k === -d || (k !== d && V[k-1] < V[k+1])) {
            // down
            k0 = k+1;
            x = V[k0];
        }
        else {
            // right
            k0 = k-1;
            x = V[k0]+1;
        }

        x0 = x;
        y = x-k;

        // follow the diagonal
        while (x < this.N && y < this.M && this.equals(this.a[this.x + x], this.b[this.y + y])) {
            x++;
            y++;
        }

        // store endpoint
        V[k] = x;

        // invoke d-path callback
        if (onpath)
            return onpath(this.x + x, this.y + x0, k0);
    };


    Editgraph.prototype.extendDpathBw = function(d, k, V, onpath) {
        var k0, x0, x, y;

        // figure out if we have to move up or left from the previous
        // k-line.
        if (k === -d || (k !== d && V[k-1] > V[k+1])) {
            // up
            k0 = k-1;
            x = V[k0];
        }
        else {
            // left
            k0 = k+1;
            x = V[k0]-1;
        }

        x0 = x;
        y = x-k;

        // follow the diagonal
        while (x > 0 && y > 0 && this.equals(this.a[this.x + x], this.b[this.y + y])) {
            x--;
            y--;
        }

        // store endpoint
        V[k] = x;

        // invoke d-path callback
        if (onpath)
            return onpath(x, x0, k0);
    }


    /**
     * Middle snake
     */
    Editgraph.prototype.middleSnake = function (onpath) {
        var dmax = this.N + this.M;
        var delta = this.N - this.M;
        var d, k;
        var Vf = {'1': 0};
        var Vb = {'1': 0};
        var result;

        for (d = 0; d <= dmax/2; d++) {
            for (k = -d; k <= d; k+=2) {
                result = this.extendDpathFw(d, k, Vf, function(x, x0, k0) {
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
                result = this.extendDpathBw(d, k+delta, Vb, function(d, x, k, x0, k0) {
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
    Editgraph.prototype.editgraph_simple = function (builder, dmax) {
        var d;

        d = this.forEachDpath(dmax, function(d, x, k, x0, k0) {
            var vertical = (k0 > k);
            if (vertical) {
                builder.down(x0, x0-k);
            }
            else {
                builder.right(x0, x0-k);
            }

            while(x0++ < x) {
                builder.diag(x0, x0-k);
            }
        });

        return d;
    };


    /**
     * Calculates the longest common subsequence of a and b.
     */
    Editgraph.prototype.lcs_simple = function (dmax) {
        var paths = [];
        var last_path;
        var path;
        var result;
        var x;

        this.forEachDpath(dmax, function(d, x, k, x0, k0) {
            var prev_path = paths[k0];
            last_path = {
                'prev'  : prev_path,
                'x0'    : x0,
                'x'     : x,
            };
            paths[k] = last_path;
        });

        if (last_path.x !== this.a.length) {
            throw new Error('Programming error: end-point of last path must match the length of the input array.\n');
        }

        result = [];
        for (path = last_path; path; path = path.prev) {
            for (x=path.x; x > path.x0; x--) {
                result.unshift(this.a[x-1]);
            }
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
    Editgraph.prototype.ses_simple = function (editor, dmax) {
        var paths = [];
        var last_path;
        var path;

        this.forEachDpath(dmax, function(d, x, k, x0, k0) {
            var prev_path = paths[k0];
            last_path = {
                'prev'  : prev_path,
                'insert': (k0 > k),
                'x0'    : x0,
                'y0'    : x0-k,
            };
            paths[k] = last_path;
        });

        result = [];
        for (path = last_path; path.prev; path = path.prev) {
            if (path.insert) {
                editor.insert(path.x0, this.b[path.y0-1]);
            }
            else {
                editor.remove(path.x0-1);
            }
        }
    };

    // CommonJS exports
    exports.Editgraph = Editgraph;

}(typeof exports === 'undefined' ? (this.editgraph={}) : exports));
