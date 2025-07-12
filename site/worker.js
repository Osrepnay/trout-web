import { WASI, File, OpenFile, ConsoleStdout, PreopenDirectory } from "@bjorn3/browser_wasi_shim";

// wasm init
let args = [];
let env = [];
let fds = [
    new OpenFile(new File([])), // stdin
    ConsoleStdout.lineBuffered(msg => console.log(`[WASI stdout] ${msg}`)),
    ConsoleStdout.lineBuffered(msg => console.warn(`[WASI stderr] ${msg}`)),
];
let wasi = new WASI(args, env, fds);

let wasm = await WebAssembly.compileStreaming(fetch("trout-web-exe.wasm"));
let __exports = {};
let inst = await WebAssembly.instantiate(wasm, {
    "wasi_snapshot_preview1": wasi.wasiImport,
    "ghc_wasm_jsffi": (await import("./dist/ghc_wasm_jsffi.js")).default(__exports)
});
Object.assign(__exports, inst.exports);
wasi.initialize(inst);

await inst.exports.initialize();

self.postMessage("init");

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

let ffiEnv;
let ffiGame;

self.onmessage = (e) => {
    let msg = e.data;
    switch (msg[0]) {
        case "reset":
            ffiEnv = inst.exports.ffiNewEnv();
            ffiGame = inst.exports.ffiNewGame();
            break;
        case "fenGame":
            ffiGame = inst.exports.ffiFenGame(msg[1]);
            break;
        case "makeMove":
            inst.exports.ffiMakeMove(ffiGame, sqToInt(msg[1]), sqToInt(msg[2]), msg[3]);
            break;
        case "bestMove":
            let timePerDepth = msg[1];
            let moveRaw;
            let depth = 1;
            let lastTime = Date.now();
            let nowTime = Date.now();
            // limit depth to 50 for pathological cases like checkmate depth spam
            while (nowTime - lastTime < timePerDepth && depth < 50) {
                moveRaw = inst.exports.ffiBestMove(depth, ffiGame, ffiEnv);
                depth++;
                lastTime = nowTime;
                nowTime = Date.now();
            }
            const pieces = ['p', 'n', 'b', 'r', 'q', 'k'];
            // it's just how it is
            // can't really return as more than one int conveniently
            let movePromo = pieces[Math.floor(moveRaw / (64 * 64))];
            let moveFrom = intToSq(Math.floor((moveRaw % (64 * 64)) / 64));
            let moveTo = intToSq(moveRaw % 64);
            self.postMessage([moveFrom, moveTo, movePromo]);
            break;
    }
};
