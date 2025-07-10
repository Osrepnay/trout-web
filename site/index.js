import { WASI, File, OpenFile, ConsoleStdout, PreopenDirectory } from "@bjorn3/browser_wasi_shim";
import { Chessground } from '@lichess-org/chessground';
import { Chess } from 'chess.js'

// wasm init
let args = [];
let env = [];
let fds = [
    new OpenFile(new File([])), // stdin
    ConsoleStdout.lineBuffered(msg => console.log(`[WASI stdout] ${msg}`)),
    ConsoleStdout.lineBuffered(msg => console.warn(`[WASI stderr] ${msg}`)),
];
let wasi = new WASI(args, env, fds);

let wasm = await WebAssembly.compileStreaming(fetch("dist/trout-web-exe.wasm"));
let __exports = {};
let inst = await WebAssembly.instantiate(wasm, {
    "wasi_snapshot_preview1": wasi.wasiImport,
    "ghc_wasm_jsffi": (await import("./dist/ghc_wasm_jsffi.js")).default(__exports)
});
Object.assign(__exports, inst.exports);
wasi.initialize(inst);

await inst.exports.initialize();

let ffiEnv;
let ffiGame;
let chess;
let ground;

// for wasm interop
function sqToInt(sq) {
    const col = sq.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = sq.charCodeAt(1) - '1'.charCodeAt(0);
    return row * 8 + col;
}

function intToSq(x) {
    const colInt = x % 8;
    const rowInt = Math.floor(x / 8);
    const col = String.fromCharCode('a'.charCodeAt(0) + colInt);
    const row = String.fromCharCode('1'.charCodeAt(0) + rowInt);
    return col + row;
}

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
    ffiGame = inst.exports.ffiMakeMove(ffiGame, sqToInt(moveFrom), sqToInt(moveTo), 0);
    chess.move(moveFrom + moveTo + movePromo);
}

// code use
function internalMakeMove(moveFrom, moveTo, movePromo) {
    externalMakeMove(moveFrom, moveTo);
    ground.move(moveFrom, moveTo);
    ground.set({ turnColor: "white", movable: { color: "white" } });
    updateDests();
}

function bestMove() {
    let moveRaw = inst.exports.ffiBestMove(7, ffiGame, ffiEnv);
    const pieces = ['p', 'n', 'b', 'r', 'q', 'k']
    // it's just how it is
    // can't really return as more than one int conveniently
    let movePromo = pieces[Math.floor(moveRaw / (64 * 64))];
    let moveFrom = intToSq(Math.floor((moveRaw % (64 * 64)) / 64));
    let moveTo = intToSq(moveRaw % 64);
    return [moveFrom, moveTo, movePromo];
}

const config = {
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    movable: {
        free: false,
        color: "white",
        events: {
            after: (orig, dest, metadata) => {
                externalMakeMove(orig, dest, '');
                const [f, t, p] = bestMove();
                internalMakeMove(f, t, p);
                console.log(ground.config);
            }
        }
    },
};

function resetState() {
    ffiEnv = inst.exports.ffiNewEnv();
    ffiGame = inst.exports.ffiNewGame();
    chess = new Chess();
    ground = Chessground(document.getElementById("board"), config);
}
resetState();
updateDests();
