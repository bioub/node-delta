/**
 * @file:   Subclass of LCS which allows to observe progress of the algorithm
 *          by intercepting function calls.
 */


DeltaJS.lcs.InstallLCSRecorder = function(lcs, recorder) {
    var orig = {};

    orig.compute = lcs.compute;
    lcs.compute = function(callback, T, limit) {
        if (typeof limit === 'undefined') {
            limit = this.defaultLimit();
        }
        recorder.onCompute.call(recorder, callback, T, limit);
        orig.compute.apply(this, arguments);
    }

    orig.nextSnakeHeadForward = lcs.nextSnakeHeadForward;
    lcs.nextSnakeHeadForward = function(head, k, kmin, kmax, limits, V) {
        var k0 = orig.nextSnakeHeadForward.apply(this, arguments);
        var d = kmax;
        recorder.onSnakeHead.call(recorder, head, k0, d, false);
        return k0;
    }

    orig.nextSnakeHeadBackward = lcs.nextSnakeHeadBackward;
    lcs.nextSnakeHeadBackward = function(head, k, kmin, kmax, limits, V) {
        var k0 = orig.nextSnakeHeadBackward.apply(this, arguments);
        var d = kmax-limits.delta;
        recorder.onSnakeHead.call(recorder, head, k0, d, true);
        return k0;
    }

    orig.middleSnake = lcs.middleSnake;
    lcs.middleSnake = function(lefthead, righthead) {
        var d = orig.middleSnake.apply(this, arguments);
        recorder.onMiddleSnake.call(recorder, lefthead, righthead, d);
        return d;
    }
}
