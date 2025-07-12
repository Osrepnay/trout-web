import { Chessground } from '@lichess-org/chessground';
import { Chess } from 'chess.js'

let playerColor = "white";
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

let troutImg = document.getElementById("trout-img");

function troutNeutral() {
    troutImg.src = "trout.png";
    troutImg.alt = "trout neutral";
}

function troutThink() {
    troutImg.src = "trout_think.png";
    troutImg.alt = "trout thinking";
}

function troutDead() {
    troutNeutral();
    troutImg.style = "transform: scale(1, -1)";
}

function gameOver() {
    ground.set({ viewOnly: true });
}

let wastedWrapper = document.getElementById("wasted-wrapper");

function playerLose() {
    gameOver();
    let wastedInner = document.getElementById("wasted");
    wastedInner.style.display = "none";
    wastedWrapper.style.zIndex = "999";
    wastedWrapper.classList.add("wasted-wrapper-darken");
    setTimeout(() => wastedInner.style.display = "flex", 1500);
}

function playerWin() {
    gameOver();
    troutDead();
}

function playerDraw() {
    gameOver();
    troutImg.src = "draw.png";
}

// TODO promotions!!!!!
function moveUpdate(moveFrom, moveTo, movePromo) {
    worker.postMessage(["makeMove", moveFrom, moveTo, movePromo]);

    // kinda gross because generates all moves to find one but
    // its not performance critical and isn't really any easier way because chessground
    const chessjsMove = chess.moves({ square: moveFrom, verbose: true })
        .filter((move) => move.to === moveTo && (movePromo ? move.promotion === movePromo : !move.promotion))[0];

    // edge cases
    if (chessjsMove.isEnPassant()) {
        // a little hacky or very nice depending on your perspective
        const capturedSq = moveFrom.charAt(0) + moveTo.charAt(1);
        ground.setPieces(new Map().set(capturedSq, undefined));
    } else if (chessjsMove.isPromotion()) {
        const pieceFullname = {
            'p': 'pawn',
            'n': 'knight',
            'b': 'bishop',
            'r': 'rook',
            'q': 'queen',
            'k': 'king'
        };
        const piece = {
            role: pieceFullname[movePromo],
            color: chess.turn(),
            promoted: true
        };
        ground.setPieces(new Map().set(moveTo, piece));
    }

    // do this after because above depends on it being the mover's turn
    chess.move(chessjsMove);
    ground.set({ check: chess.inCheck() });

    if (chess.isGameOver()) {
        if (chess.isCheckmate()) {
            // player got mated
            if (chess.turn() === playerColor.charAt(0)) {
                playerLose();
            } else {
                playerWin();
            }
        // draw
        } else {
            playerDraw();
        }
    }
}

function programmaticMove(moveFrom, moveTo, movePromo) {
    ground.move(moveFrom, moveTo);
    ground.set({ turnColor: playerColor });
    moveUpdate(moveFrom, moveTo);
    updateDests();
}

let maxDepthTimeElem = document.getElementById("max-depth-time");
let bestMoveTime = maxDepthTimeElem.value;

maxDepthTimeElem.addEventListener("change", () => {
    bestMoveTime = maxDepthTimeElem.value;
});

const config = {
    fen: "r1bqkbnr/ppp1pppp/2n5/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3",
    movable: {
        free: false,
        events: {
            after: (orig, dest, metadata) => {
                moveUpdate(orig, dest, '');
                troutThink();
                worker.postMessage(["bestMove", bestMoveTime]);
            }
        }
    },
    premovable: {
        // too much extra code for little benefit (it's not even timed!)
        enabled: false
    }
};

chess = new Chess(config.fen);
ground = Chessground(document.getElementById("board"), config);
let engineReady = false;
let queueEngineStart = false;

document.getElementById("white-overlay").addEventListener("click", () => {
    playerColor = "white";
    document.getElementById("color-chooser").style = "display: none";
});
document.getElementById("black-overlay").addEventListener("click", () => {
    playerColor = "black";
    document.getElementById("color-chooser").style = "display: none";
    ground.set({ orientation: "black" });
    if (engineReady) {
        troutThink();
        worker.postMessage(["bestMove", bestMoveTime]);
    } else {
        queueEngineStart = true;
    }
});

updateDests();

worker.onmessage = (e) => {
    if (e.data === "init") {
        worker.postMessage(["reset"]);
        worker.postMessage(["fenGame", config.fen]);
        engineReady = true;
        if (queueEngineStart) {
            troutThink();
            worker.postMessage(["bestMove", bestMoveTime]);
        }
    } else {
        const [f, t, p] = e.data;
        programmaticMove(f, t, p);
        troutNeutral();
    }
};
