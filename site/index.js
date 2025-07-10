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
    worker.postMessage(["makeMove", moveFrom, moveTo, 0]);
    chess.move(moveFrom + moveTo + movePromo);
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
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
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

chess = new Chess();
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
