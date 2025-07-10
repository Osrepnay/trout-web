import { Chessground } from '@lichess-org/chessground';
import { Chess } from 'chess.js'

let chess;
let ground;
const worker = new Worker(new URL("worker.js", import.meta.url), { type: "module" });

function updateDests() {
    const moves = chess.moves({ verbose: true });
    let dests = new Map();
    for (const move of moves) {
        if (dests.has(move.from)) {
            dests.get(move.from).push(move.to);
        } else {
            dests.set(move.from, [move.to]);
        }
    }
    ground.set({ movable: { dests: dests } });
}

// TODO promotions!!!!!
// chessground use
async function externalMakeMove(moveFrom, moveTo, movePromo) {
    worker.postMessage(["makeMove", moveFrom, moveTo, 0]);
    chess.move(moveFrom + moveTo + movePromo);
}

// code use
function internalMakeMove(moveFrom, moveTo, movePromo) {
    externalMakeMove(moveFrom, moveTo);
    ground.move(moveFrom, moveTo);
    ground.set({ turnColor: "white", movable: { color: "white" } });
    updateDests();
}

const config = {
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    movable: {
        free: false,
        color: "white",
        events: {
            after: (orig, dest, metadata) => {
                externalMakeMove(orig, dest, '');
                worker.postMessage(["bestMove", 1000]);
            }
        }
    },
};

function resetState() {
    worker.postMessage(["reset"]);
    chess = new Chess();
    ground = Chessground(document.getElementById("board"), config);
}

worker.onmessage = (e) => {
    if (e.data == "init") {
        resetState();
        updateDests();
    } else {
        const [f, t, p] = e.data;
        internalMakeMove(f, t, p);
    }
};
