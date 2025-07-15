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
    setTimeout(() => {
        wastedInner.style.display = "flex"
        wastedWrapper.addEventListener("click", () => wastedWrapper.style.display = "none");
    }, 1500);
}

function playerWin() {
    gameOver();
    troutDead();
}

function playerDraw() {
    troutImg.classList.add("trout-img-draw");
    gameOver();
}

const promoOverlay = document.getElementById("promo-pieces");
const promoElems = promoOverlay.children;

// chessground-chessjs conversion
const pieceFullname = {
    'p': 'pawn',
    'n': 'knight',
    'b': 'bishop',
    'r': 'rook',
    'q': 'queen',
    'k': 'king'
};
const colorFullname = {
    "w": "white",
    "b": "black"
};

function moveUpdate(chessjsMove) {
    const moverTurn = chess.turn();
    chess.move(chessjsMove);
    ground.set({ check: chess.inCheck() ? colorFullname[chess.turn()] : undefined });

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
        return false;
    } else {
        // edge cases
        if (chessjsMove.isEnPassant()) {
            // a little hacky or very nice depending on your perspective
            const capturedSq = chessjsMove.to.charAt(0) + chessjsMove.from.charAt(1);
            ground.setPieces(new Map().set(capturedSq, undefined));
        } else if (chessjsMove.isPromotion()) {
            const piece = {
                role: pieceFullname[chessjsMove.promotion],
                color: colorFullname[moverTurn],
                promoted: true
            };
            ground.setPieces(new Map().set(chessjsMove.to, piece));
        }

        const allPieces = ["p", "n", "b", "r", "q", "k"];
        worker.postMessage(["makeMove", chessjsMove.from, chessjsMove.to, allPieces.indexOf(chessjsMove.promotion)]);
        return true;
    }
}

function humanMove(moveFrom, moveTo) {
    // kinda gross because generates all moves to find one but
    // its not performance critical and isn't really any easier way because chessground
    const possibleMoves = chess.moves({ square: moveFrom, verbose: true }).filter((move) => move.to === moveTo);

    // no promo
    if (possibleMoves.length === 1) {
        if (moveUpdate(possibleMoves[0])) {
            troutThink();
            worker.postMessage(["bestMove", bestMoveTime]);
        }
    // promo
    } else {
        const findCorrectMove = (promo) => possibleMoves.filter((m) => m.promotion == promo)[0];
        const promoPieces = ["n", "b", "r", "q"];
        // this is messed up
        // why does js need the function ref?
        let promoHandlers = [];
        for (let i = 0; i < promoElems.length; i++) {
            promoElems[i].classList.add(colorFullname[chess.turn()]);
            let handler = () => {
                promoOverlay.style.display = "none";
                for (let j = 0; j < promoElems.length; j++) {
                    promoElems[j].removeEventListener("click", promoHandlers[j]);
                    promoElems[j].classList.remove(chess.turn());
                }
                if (moveUpdate(findCorrectMove(promoPieces[i]))) {
                    troutThink();
                    worker.postMessage(["bestMove", bestMoveTime]);
                }
            };
            promoHandlers.push(handler);
            promoElems[i].addEventListener("click", handler);
        }
        promoOverlay.style.display = "flex";
    }
}

function programmaticMove(moveFrom, moveTo, movePromo) {
    ground.move(moveFrom, moveTo);
    ground.set({ turnColor: playerColor });
    const chessjsMove = chess.moves({ square: moveFrom, verbose: true })
        .filter((move) => move.to === moveTo && (!movePromo || move.promotion == movePromo))[0];
    moveUpdate(chessjsMove);
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
            after: (orig, dest, metadata) => humanMove(orig, dest)
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

function tryStartEngine() {
    if (engineReady) {
        troutThink();
        worker.postMessage(["bestMove", bestMoveTime]);
    } else {
        queueEngineStart = true;
    }
}

document.getElementById("white-overlay").addEventListener("click", () => {
    chess.setHeader("White", "You");
    chess.setHeader("Black", "Trout");
    playerColor = "white";
    document.getElementById("color-chooser").style.display = "none";
    if (chess.turn() !== "w") {
        tryStartEngine();
    }
});
document.getElementById("black-overlay").addEventListener("click", () => {
    chess.setHeader("Black", "You");
    chess.setHeader("White", "Trout");
    playerColor = "black";
    document.getElementById("color-chooser").style.display = "none";
    ground.set({ orientation: "black" });
    if (chess.turn() !== "b") {
        tryStartEngine();
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

document.getElementById("pgn-button").addEventListener("click", () => {
    const check = document.getElementById("pgn-check");
    navigator.clipboard.writeText(chess.pgn())
        .then(
            () => {
                check.innerHTML = "✔️";
                check.classList.add("pgn-check-checked");
                setTimeout(() => check.classList.remove("pgn-check-checked"), 1000);
            },
            () => {
                check.innerHTML = "Couldn't copy!";
                check.classList.add("pgn-check-checked");
                setTimeout(() => check.classList.remove("pgn-check-checked"), 1000);
            }
        );
});
