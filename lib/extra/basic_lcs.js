/**
 * @file:   Extra methods for myers LCS algorithm implementing the basic
 *          version without linear space optimization.
 * @see:
 * * http://dx.doi.org/10.1007/BF01840446
 * * http://citeseer.ist.psu.edu/viewdoc/summary?doi=10.1.1.4.6927
 */

/**
 * Call a function for each D-Path identified using myers basic greedy lcs
 * algorithm.
 *
 * Returns the length of the shortest edit script, i.e. the minimal number
 * of insert and delete operations required to turn a into b.
 *
 * @param callback function(head, k0)
 */
DeltaJS.lcs.LCS.prototype.forEachCommonSymbolForward = function (callback, T) {
    var d, k, head, k0;
    var delta = this.right.k - this.left.k;
    var dmax = 2 * this.right.x - 2 * this.left.x - delta;
    var V = {};
    var snake_heads = {};

    V[1] = 0;
    head = new DeltaJS.lcs.KPoint();
    for (d = 0; d <= dmax; d++) {
        for (k = -d; k <= d; k+=2) {
            k0 = this.nextSnakeHeadForward(head, k, -d, d, V);
            snake_heads[k] = head.copy();
            snake_heads[k].prev = snake_heads[k0];

            // Take another round if head is still inside the region
            if (head.x < Math.max(this.right.x, this.right.x - this.right.k + head.k)) {
                continue;
            }

            // Done. Output common symbols by followng the prev-pointers until
            // (0,0)
            for (head = snake_heads[k]; head && head.prev; head = head.prev) {
                this.forEachPositionInSnake(head.prev, head, callback, T);
            }
            this.forEachPositionInSnake(this.left, head, callback, T);

            return d;
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
 * @param callback function(head, k0)
 */
DeltaJS.lcs.LCS.prototype.forEachCommonSymbolBackward = function (callback, T) {
    var d, k, head, k0;
    var delta = this.right.k - this.left.k;
    var dmax = 2 * this.right.x - 2 * this.left.x - delta;
    var V = {};
    var snake_heads = {};

    V[delta-1] = this.N;
    head = new DeltaJS.lcs.KPoint();
    for (d = 0; d <= dmax; d++) {
        for (k = -d+delta; k <= d+delta; k+=2) {
            k0 = this.nextSnakeHeadBackward(head, k, -d+delta, d+delta, V);
            snake_heads[k] = head.copy();
            snake_heads[k].prev = snake_heads[k0];

            // Take another round if head is still inside the region
            if (head.x > Math.min(this.left.x, this.left.x - this.left.k + head.k)) {
                continue;
            }

            // Done. Output common symbols by followng the prev-pointers until
            // (N,M)
            for (head = snake_heads[k]; head && head.prev; head = head.prev) {
                this.forEachPositionInSnake(head, head.prev, callback, T);
            }
            this.forEachPositionInSnake(head, this.right, callback, T);

            return d;
        }
    }
};
