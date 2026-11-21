import test from "node:test";
import assert from "node:assert/strict";
import { capturedCount, lastCapture, createGame, play, targets } from "../src/lib/morris.ts";

function placeSequence(points) {
  let game = createGame();
  for (const at of points) game = play(game, game.turn, { type: "place", at });
  return game;
}

test("a mill requires a capture before handing over the turn", () => {
  const game = placeSequence([0, 8, 1, 9, 2]);
  assert.equal(game.capture, true);
  assert.equal(game.turn, "mint");
  assert.throws(() => play(game, "rose", { type: "place", at: 3 }));
  const next = play(game, "mint", { type: "capture", at: 8 });
  assert.equal(next.board[8], null);
  assert.equal(next.turn, "rose");
  assert.equal(capturedCount(game, "mint"), 0);
  assert.equal(capturedCount(next, "mint"), 1);
  assert.equal(capturedCount(next, "rose"), 0);
  assert.equal(lastCapture(game), null);
  assert.deepEqual(lastCapture(next), { at: 8, by: "mint" });
  const placed = play(next, "rose", { type: "place", at: 10 });
  assert.equal(capturedCount(placed, "mint"), 1);
  assert.equal(lastCapture(placed), null);
});

test("a piece inside a mill is protected while other pieces can be captured", () => {
  const game = placeSequence([0, 8, 1, 9, 4, 10]);
  const next = play(game, "rose", { type: "capture", at: 4 });
  const capture = placeSequence([0, 8, 1, 9, 2]);
  capture.board[10] = "rose";
  capture.board[16] = "rose";
  assert.throws(() => play(capture, "mint", { type: "capture", at: 8 }));
  assert.equal(play(capture, "mint", { type: "capture", at: 16 }).board[16], null);
  assert.equal(next.turn, "mint");
});

test("three pieces can fly and taking a third remaining piece wins the game", () => {
  const game = createGame();
  game.reserve = { mint: 0, rose: 0 };
  for (const at of [0, 1, 16]) game.board[at] = "mint";
  for (const at of [8, 9, 10]) game.board[at] = "rose";
  assert.ok(targets(game, 16).includes(2));
  const mill = play(game, "mint", { type: "move", from: 16, at: 2 });
  const finish = play(mill, "mint", { type: "capture", at: 9 });
  assert.equal(finish.winner, "mint");
  assert.deepEqual(lastCapture(finish), { at: 9, by: "mint" });
});

test("players with four pieces can only slide to an adjacent point", () => {
  const game = createGame();
  game.reserve = { mint: 0, rose: 0 };
  for (const at of [0, 2, 4, 6]) game.board[at] = "mint";
  for (const at of [8, 10, 12, 14]) game.board[at] = "rose";
  assert.deepEqual(targets(game, 0), [1, 7]);
  assert.throws(() => play(game, "mint", { type: "move", from: 0, at: 23 }));
});
