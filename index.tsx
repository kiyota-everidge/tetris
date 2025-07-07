// --- 定数 ---
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const DROP_INTERVAL = 1000; // 1秒ごとに落下

// テトリミノの形状と色（ネオンデザイン用）
const TETROMINOS = {
  'I': { shape: [[1, 1, 1, 1]], color: { base: '#00f0f0', highlight: '#a0ffff' } },
  'O': { shape: [[1, 1], [1, 1]], color: { base: '#f0f000', highlight: '#ffffa0' } },
  'T': { shape: [[0, 1, 0], [1, 1, 1]], color: { base: '#a000f0', highlight: '#e0a0ff' } },
  'S': { shape: [[0, 1, 1], [1, 1, 0]], color: { base: '#00f000', highlight: '#a0ffa0' } },
  'Z': { shape: [[1, 1, 0], [0, 1, 1]], color: { base: '#f00000', highlight: '#ffa0a0' } },
  'J': { shape: [[1, 0, 0], [1, 1, 1]], color: { base: '#0000f0', highlight: '#a0a0ff' } },
  'L': { shape: [[0, 0, 1], [1, 1, 1]], color: { base: '#f0a000', highlight: '#ffd0a0' } }
};
const PIECES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];


// --- DOM要素の取得 ---
const canvas = document.getElementById('tetris-board') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-piece-canvas') as HTMLCanvasElement;
const nextCtx = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const gameOverOverlay = document.getElementById('game-over-overlay');
const restartButton = document.getElementById('restart-button');


// --- キャンバスのサイズ設定 ---
if (ctx) {
  canvas.width = COLS * BLOCK_SIZE;
  canvas.height = ROWS * BLOCK_SIZE;
} else {
  console.error('メインCanvasのコンテキストを取得できませんでした。');
}
if (!nextCtx) {
    console.error('次のピース用Canvasのコンテキストを取得できませんでした。');
}


// --- ゲームの状態 ---
let board: (any)[][] = [];
let score = 0;
let isGameOver = false;

// 現在操作中のテトリミノと次のテトリミノ
let currentPiece: { shape: number[][]; color: { base: string, highlight: string }; };
let nextPieceType: keyof typeof TETROMINOS;
let currentX: number;
let currentY: number;

// ゲームループ用の変数
let dropCounter = 0;
let lastTime = 0;
let animationFrameId: number;


/**
 * 盤面を初期化する関数
 */
function resetBoard() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

/**
 * 新しいテトリミノを生成し、次のテトリミノを準備する関数
 */
function newPiece() {
  currentPiece = TETROMINOS[nextPieceType];
  const pieceType = PIECES[Math.floor(Math.random() * PIECES.length)] as keyof typeof TETROMINOS;
  nextPieceType = pieceType;
  
  // 中央の上部に出現
  currentX = Math.floor(COLS / 2) - Math.floor(currentPiece.shape[0].length / 2);
  currentY = 0;
}

/**
 * 盤面のグリッド線を描画する関数
 */
function drawGrid() {
  if (!ctx) return;
  ctx.strokeStyle = '#0f3460'; // ダークなグリッド色
  ctx.lineWidth = 1;

  for (let x = 1; x < COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK_SIZE, 0);
    ctx.lineTo(x * BLOCK_SIZE, ROWS * BLOCK_SIZE);
    ctx.stroke();
  }
  for (let y = 1; y < ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK_SIZE);
    ctx.lineTo(COLS * BLOCK_SIZE, y * BLOCK_SIZE);
    ctx.stroke();
  }
}

/**
 * 1つのブロックを描画する関数 (ネオンスタイル)
 */
function drawBlock(context: CanvasRenderingContext2D, x: number, y: number, color: { base: string, highlight: string }) {
    if (!context) return;
    const realX = x * BLOCK_SIZE;
    const realY = y * BLOCK_SIZE;
    
    // グラデーション
    const gradient = context.createLinearGradient(realX, realY, realX + BLOCK_SIZE, realY + BLOCK_SIZE);
    gradient.addColorStop(0, color.highlight);
    gradient.addColorStop(1, color.base);
    context.fillStyle = gradient;

    context.fillRect(realX, realY, BLOCK_SIZE, BLOCK_SIZE);
    
    // 内側のハイライト
    context.strokeStyle = color.highlight;
    context.lineWidth = 2;
    context.strokeRect(realX + 1, realY + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
}

/**
 * メインの描画関数
 */
function draw() {
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  board.forEach((row, y) => {
    row.forEach((value, x) => {
        if (value !== 0) {
            drawBlock(ctx, x, y, value as { base: string, highlight: string });
        }
    });
  });

  if (currentPiece) {
      currentPiece.shape.forEach((row, yOffset) => {
          row.forEach((value, xOffset) => {
              if (value === 1) {
                  drawBlock(ctx, currentX + xOffset, currentY + yOffset, currentPiece.color);
              }
          });
      });
  }

  drawNextPiece();
}

/**
 * 次のテトリミノを描画する関数
 */
function drawNextPiece() {
    if (!nextCtx || !nextPieceType) return;
    const piece = TETROMINOS[nextPieceType];
    const pSize = piece.shape.length > 2 || piece.shape[0].length > 2 ? 0.8 : 1.0;
    const blockSize = BLOCK_SIZE * pSize;
    const w = nextCanvas.width;
    const h = nextCanvas.height;

    nextCtx.clearRect(0, 0, w, h);
    
    const startX = (w - piece.shape[0].length * blockSize) / 2;
    const startY = (h - piece.shape.length * blockSize) / 2;

    piece.shape.forEach((row, y) => {
        row.forEach((val, x) => {
            if (val === 1) {
                // Draw block on next canvas (coordinates are relative to the piece, not grid)
                const realX = startX + x * blockSize;
                const realY = startY + y * blockSize;

                const gradient = nextCtx.createLinearGradient(realX, realY, realX + blockSize, realY + blockSize);
                gradient.addColorStop(0, piece.color.highlight);
                gradient.addColorStop(1, piece.color.base);
                nextCtx.fillStyle = gradient;
                nextCtx.fillRect(realX, realY, blockSize, blockSize);

                nextCtx.strokeStyle = piece.color.highlight;
                nextCtx.lineWidth = 2;
                nextCtx.strokeRect(realX + 1, realY + 1, blockSize - 2, blockSize - 2);
            }
        });
    });
}


function isValidMove(shape: number[][], x: number, y: number): boolean {
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col] === 1) {
        const newX = x + col;
        const newY = y + row;
        if (newX < 0 || newX >= COLS || newY >= ROWS || (newY >= 0 && board[newY][newX] !== 0)) {
          return false;
        }
      }
    }
  }
  return true;
}

function rotate(shape: number[][]): number[][] {
    const newShape = shape[0].map((_, colIndex) => shape.map(row => row[colIndex]).reverse());
    return newShape;
}

function lockPiece() {
    if (!currentPiece) return;
    currentPiece.shape.forEach((row, yOffset) => {
        row.forEach((value, xOffset) => {
            if (value === 1) {
                const boardX = currentX + xOffset;
                const boardY = currentY + yOffset;
                if (boardY >= 0) {
                    board[boardY][boardX] = currentPiece.color;
                }
            }
        });
    });
}

function updateScore() {
    if (scoreElement) {
        scoreElement.textContent = String(score);
    }
}

function clearLines() {
    let linesCleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
        if (board[y].every(cell => cell !== 0)) {
            linesCleared++;
            board.splice(y, 1);
            board.unshift(Array(COLS).fill(0));
            y++; // Check the new line at the same index
        }
    }
    if (linesCleared > 0) {
        const pointsMap: { [key: number]: number } = { 1: 100, 2: 300, 3: 500, 4: 800 };
        score += pointsMap[linesCleared] || 0;
        updateScore();
    }
}

function pieceDrop() {
    if (isGameOver || !currentPiece) return;

    if (isValidMove(currentPiece.shape, currentX, currentY + 1)) {
        currentY++;
    } else {
        lockPiece();
        clearLines();
        newPiece();
        if (!isValidMove(currentPiece.shape, currentX, currentY)) {
            isGameOver = true;
            if(gameOverOverlay) gameOverOverlay.classList.add('visible');
        }
    }
    dropCounter = 0;
}

function handleKeyPress(event: KeyboardEvent) {
  if (isGameOver || !currentPiece) return;

  let moved = false;
  switch (event.key) {
    case 'ArrowLeft':
      if (isValidMove(currentPiece.shape, currentX - 1, currentY)) {
        currentX--;
        moved = true;
      }
      break;
    case 'ArrowRight':
      if (isValidMove(currentPiece.shape, currentX + 1, currentY)) {
        currentX++;
        moved = true;
      }
      break;
    case 'ArrowUp':
      const rotated = rotate(currentPiece.shape);
      if (isValidMove(rotated, currentX, currentY)) {
        currentPiece.shape = rotated;
        moved = true;
      }
      break;
    case 'ArrowDown':
      if (isValidMove(currentPiece.shape, currentX, currentY + 1)) {
        currentY++;
        dropCounter = 0;
        moved = true;
      }
      break;
  }
  if (moved) draw();
}

function gameLoop(time = 0) {
    if (isGameOver) {
        cancelAnimationFrame(animationFrameId);
        return;
    }

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > DROP_INTERVAL) {
        pieceDrop();
    }
    
    draw();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function startGame() {
    resetBoard();
    score = 0;
    updateScore();
    isGameOver = false;
    if(gameOverOverlay) gameOverOverlay.classList.remove('visible');

    // 最初のピースと次のピースを準備
    nextPieceType = PIECES[Math.floor(Math.random() * PIECES.length)] as keyof typeof TETROMINOS;
    newPiece();

    lastTime = 0;
    dropCounter = 0;

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    gameLoop();
}


// --- ゲームの初期化と開始 ---
function main() {
  document.addEventListener('keydown', handleKeyPress);
  restartButton?.addEventListener('click', startGame);
  startGame();
}

window.addEventListener('DOMContentLoaded', main);
