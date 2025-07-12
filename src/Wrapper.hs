module Wrapper (ffiNewEnv, ffiNewGame, ffiFenGame, ffiMakeMove, ffiBestMove) where

import Control.Monad.ST (RealWorld, stToIO)
import Control.Monad.Trans.Reader (ReaderT (runReaderT))
import Data.Either (fromRight)
import Data.Int (Int16)
import Data.Maybe (fromJust)
import Foreign (StablePtr, deRefStablePtr, freeStablePtr, newStablePtr)
import GHC.Wasm.Prim (JSString, fromJSString)
import Trout.Fen.Parse (fenToGame, readFen)
import Trout.Game (Game (..), allMoves, makeMove, startingGame)
import Trout.Game.Move (Move (..), SpecialMove (..))
import Trout.Search (SearchEnv, bestMove, newEnv)

ffiNewEnv :: IO (StablePtr (SearchEnv RealWorld))
ffiNewEnv = stToIO (newEnv (16 * 1000000)) >>= newStablePtr

ffiNewGame :: IO (StablePtr Game)
ffiNewGame = newStablePtr startingGame

-- super dirty and breakable but...
ffiFenGame :: JSString -> IO (StablePtr Game)
ffiFenGame = newStablePtr . fenToGame . fromRight undefined . readFen . fromJSString

ffiMakeMove :: StablePtr Game -> Int -> Int -> Int -> IO (StablePtr Game)
ffiMakeMove gamePtr from to promo = do
  game <- deRefStablePtr gamePtr
  case filter moveGood (allMoves (gameBoard game)) of
    (move : _) -> do
      let newGame = fromJust (makeMove game move)
      freeStablePtr gamePtr
      newStablePtr newGame
    [] -> error "invalid move"
  where
    moveGood move =
      moveFrom move == from && moveTo move == to && case moveSpecial move of
        Promotion movePromo -> fromEnum movePromo == promo
        _ -> True

ffiBestMove :: Int16 -> StablePtr Game -> StablePtr (SearchEnv RealWorld) -> IO Int
ffiBestMove depth gamePtr envPtr = do
  game <- deRefStablePtr gamePtr
  env <- deRefStablePtr envPtr
  (_, move) <- stToIO (runReaderT (bestMove depth game) env)
  let promo =
        case moveSpecial move of
          Promotion p -> fromEnum p
          -- promotion should never be pawn
          _ -> 0
  pure (promo * 64 * 64 + moveFrom move * 64 + moveTo move)
