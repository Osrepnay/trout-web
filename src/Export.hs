module Export () where

import Control.Monad.ST (RealWorld)
import Data.Int (Int16)
import Foreign (StablePtr)
import GHC.Wasm.Prim (JSString (..))
import Trout.Game (Game)
import Trout.Search (SearchEnv)
import Wrapper (ffiBestMove, ffiFenGame, ffiMakeMove, ffiNewEnv, ffiNewGame)

-- ???????????????????????
-- RTS error unless something is awaited first
initialize :: IO ()
initialize = pure ()

foreign export javascript "initialize" initialize :: IO ()

foreign export javascript "ffiNewEnv sync" ffiNewEnv :: IO (StablePtr (SearchEnv RealWorld))

foreign export javascript "ffiNewGame sync" ffiNewGame :: IO (StablePtr Game)

foreign export javascript "ffiFenGame sync" ffiFenGame :: JSString -> IO (StablePtr Game)

foreign export javascript "ffiMakeMove sync" ffiMakeMove :: StablePtr Game -> Int -> Int -> Int -> IO (StablePtr Game)

foreign export javascript "ffiBestMove sync"
  ffiBestMove :: Int16 -> StablePtr Game -> StablePtr (SearchEnv RealWorld) -> IO Int
