// Proves rules.js is correct by counting every possible sequence of moves
// 1, 2, and 3 moves deep from the start position. These counts (20, 400,
// 8,902) are the well-known correct answer for standard chess — if our
// count differs, rules.js has a bug in move generation or legality.

import { createInitialState, getAllLegalMoves, applyMove } from '../public/rules.js';

function perft(state, depth) {
  if (depth === 0) return 1;
  const moves = getAllLegalMoves(state);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const move of moves) {
    nodes += perft(applyMove(state, move), depth - 1);
  }
  return nodes;
}

const expected = { 1: 20, 2: 400, 3: 8902 };
const start = createInitialState();
let allPassed = true;

for (const depth of [1, 2, 3]) {
  const result = perft(start, depth);
  const pass = result === expected[depth];
  allPassed = allPassed && pass;
  console.log(`perft(${depth}) = ${result} (expected ${expected[depth]}) ${pass ? 'PASS' : 'FAIL'}`);
}

if (!allPassed) {
  console.error('\nPerft test FAILED — rules.js has a bug.');
  process.exit(1);
}

console.log('\nAll perft tests passed.');
