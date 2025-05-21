const canvas = document.getElementById('pongCanvas');
const context = canvas.getContext('2d');

// Game constants
const PADDLE_WIDTH = 25; // Slightly wider for rounded edges
const PADDLE_HEIGHT = 150;
const BALL_RADIUS = 15; // Increased for visibility
const PADDLE_SPEED = 10;
const COMPUTER_PADDLE_SPEED = 7;
const PADDLE_BORDER_RADIUS = 10;

// Constants for Ball Trail
const MAX_TRAIL_LENGTH = 30;
const MIN_SPEED_FOR_TRAIL_EFFECT = 7;
const MAX_SPEED_FOR_TRAIL_EFFECT = 25;

// Game state
let playerScore = 0;
let computerScore = 0;
const playerScoreElem = document.getElementById('player-score');
const computerScoreElem = document.getElementById('computer-score');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const pickupMessageElem = document.getElementById('pickupMessage');
const ballStatsElem = document.getElementById('ballStats');
const pauseButton = document.getElementById('pauseButton'); // Get pause button
let gameOver = false; // Added: Tracks if the game has ended
let winner = null; // Added: Stores the winner ('Player' or 'Computer')

// Paddle objects
const player = {
    x: PADDLE_WIDTH * 2, // A bit of an offset from the left wall
    y: canvas.height / 2 - PADDLE_HEIGHT / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    color: '#ff6b6b', // Coral red
    dy: 0, // Movement direction and speed
    borderRadius: PADDLE_BORDER_RADIUS,
    shakeIntensity: 0,
    shakeDuration: 0,
    originalX: 0 // To store X before shake for player
};

const computer = {
    x: canvas.width - PADDLE_WIDTH * 3, // A bit of an offset from the right wall
    y: canvas.height / 2 - PADDLE_HEIGHT / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    color: '#4ecdc4', // Turquoise
    dy: 0,
    borderRadius: PADDLE_BORDER_RADIUS,
    shakeIntensity: 0,
    shakeDuration: 0,
    originalX: 0 // To store X before shake for computer
};

// Ball object
const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: BALL_RADIUS,
    speed: 7,
    dx: 5, // Movement direction and speed on x-axis
    dy: 5, // Movement direction and speed on y-axis
    color: '#ffffff', // White
    history: [] // For ball trail
};

// Mouse control state
let mouseControlActive = false;
let gamePaused = true; // Game starts paused
let gameStartedOnce = false; // To differentiate initial start from restart

// Pickups
const PICKUP_TYPES = {
    SPEED_BOOST: 'SPEED_BOOST',
    BALL_SIZE_INCREASE: 'BALL_SIZE_INCREASE',
    TRAJECTORY_CHANGE: 'TRAJECTORY_CHANGE',
    DRUNKEN_BALL: 'DRUNKEN_BALL',
    PADDLE_SIZE_INCREASE: 'PADDLE_SIZE_INCREASE' // New pickup type
};
const PICKUP_DURATION = 5000; // 5 seconds in milliseconds
const PICKUP_SPAWN_INTERVAL = 20000; // 20 seconds
const PICKUP_RADIUS = 30; // Increased size
let activePickups = [];
let pickupSpawnTimer = null;

const pickupColors = {
    [PICKUP_TYPES.SPEED_BOOST]: '#7a9d96', // Soft teal
    [PICKUP_TYPES.BALL_SIZE_INCREASE]: '#9bc1c1', // Lighter teal
    [PICKUP_TYPES.TRAJECTORY_CHANGE]: '#d4a5a5', // Soft rose
    [PICKUP_TYPES.DRUNKEN_BALL]: '#c8a5a5', // Lighter rose
    [PICKUP_TYPES.PADDLE_SIZE_INCREASE]: '#a8c8c8' // Medium teal
};

// Store original paddle heights for PADDLE_SIZE_INCREASE pickup
const originalPaddleHeight = PADDLE_HEIGHT;

// Add new state variable for countdown
let countdownActive = false;
let countdownTime = 0;

// Set canvas dimensions (making it big)
function resizeCanvas() {
    canvas.width = Math.min(window.innerWidth * 0.8, 1000); // 80% of window width, max 1000px
    canvas.height = Math.min(window.innerHeight * 0.7, 600); // 70% of window height, max 600px

    // Recalculate positions based on new canvas size
    player.y = canvas.height / 2 - PADDLE_HEIGHT / 2;
    player.x = PADDLE_WIDTH * 2;
    computer.y = canvas.height / 2 - PADDLE_HEIGHT / 2;
    computer.x = canvas.width - PADDLE_WIDTH * 3;
    if (gameStartedOnce) resetBall(true); // Reset ball to center if game has started
}

// Helper function to get current ball radius considering pickups
function getCurrentBallRadius() {
    let r = ball.radius; // ball.radius is the base radius
    const sizeIncrease = activePickups.find(p => p.type === PICKUP_TYPES.BALL_SIZE_INCREASE && p.isActive);
    if (sizeIncrease) {
        r *= 1.5;
    }
    return r;
}

// Draw functions
function drawRect(x, y, w, h, color) { // Standard rectangle for general use (e.g. background clear)
    context.fillStyle = color;
    context.fillRect(x, y, w, h);
}

function drawRoundedRect(x, y, w, h, radius, color) {
    // Add outer shadow for depth
    context.shadowColor = 'rgba(0, 0, 0, 0.5)';
    context.shadowBlur = 10;
    context.shadowOffsetX = 2;
    context.shadowOffsetY = 2;

    // Draw main paddle
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + w - radius, y);
    context.quadraticCurveTo(x + w, y, x + w, y + radius);
    context.lineTo(x + w, y + h - radius);
    context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    context.lineTo(x + radius, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    context.fill();

    // Reset shadow for inner effects
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;

    // Add inner shadow gradient for volume
    const gradient = context.createLinearGradient(x, y, x + w, y + h);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');

    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + w - radius, y);
    context.quadraticCurveTo(x + w, y, x + w, y + radius);
    context.lineTo(x + w, y + h - radius);
    context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    context.lineTo(x + radius, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    context.fill();

    // Add edge highlight
    context.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + w - radius, y);
    context.quadraticCurveTo(x + w, y, x + w, y + radius);
    context.lineTo(x + w, y + h - radius);
    context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    context.lineTo(x + radius, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    context.stroke();

    // Add top highlight
    const topGradient = context.createLinearGradient(x, y, x, y + h * 0.3);
    topGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    topGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    context.fillStyle = topGradient;
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + w - radius, y);
    context.quadraticCurveTo(x + w, y, x + w, y + radius);
    context.lineTo(x + w, y + h * 0.3);
    context.lineTo(x, y + h * 0.3);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    context.fill();
}

function drawArc(x, y, r, color, hasHighlight = true) {
    // Add shadow for depth
    context.shadowColor = 'rgba(0, 0, 0, 0.5)';
    context.shadowBlur = 10;
    context.shadowOffsetX = 2;
    context.shadowOffsetY = 2;

    // Main circle
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2, false);
    context.closePath();
    context.fill();

    // Reset shadow for inner effects
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;

    // Add inner shadow for volume
    if (hasHighlight && r > 3) {
        // Inner shadow gradient
        const gradient = context.createRadialGradient(
            x - r * 0.3, y - r * 0.3, r * 0.1,  // Inner circle (highlight)
            x, y, r                              // Outer circle
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');

        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, r, 0, Math.PI * 2, false);
        context.closePath();
        context.fill();

        // Add a small bright highlight
        const highlightRadius = r * 0.4;
        const highlightX = x - r * 0.25;
        const highlightY = y - r * 0.25;
        
        context.fillStyle = 'rgba(255, 255, 255, 0.9)';
        context.beginPath();
        context.arc(highlightX, highlightY, highlightRadius, 0, Math.PI * 2, false);
        context.closePath();
        context.fill();

        // Add a subtle edge highlight
        context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(x, y, r, 0, Math.PI * 2, false);
        context.stroke();
    }
}

function drawNet() {
    context.beginPath();
    context.setLineDash([10, 10]); // Dashed line
    context.moveTo(canvas.width / 2, 0);
    context.lineTo(canvas.width / 2, canvas.height);
    context.strokeStyle = "#555"; // Dimmer color for the net
    context.lineWidth = 5;
    context.stroke();
    context.setLineDash([]); // Reset line dash
}

// AI for computer paddle
function moveComputerPaddle() {
    if (gamePaused) return;

    if (computer.shakeDuration > 0) {
        const shakeOffset = (Math.random() - 0.5) * computer.shakeIntensity;
        computer.x = computer.originalX + shakeOffset;
        computer.shakeDuration--;
        if (computer.shakeDuration <= 0) {
            computer.x = computer.originalX; 
            computer.shakeIntensity = 0;
        }
    } else {
        // If shake just ended, originalX is set. If not shaking, ensure computer.x is the static one.
        if(computer.shakeDuration <= 0) computer.x = canvas.width - PADDLE_WIDTH * 3;

        const paddleCenter = computer.y + computer.height / 2;
        if (paddleCenter < ball.y - 35 && computer.y < canvas.height - computer.height) {
            computer.y += COMPUTER_PADDLE_SPEED;
        } else if (paddleCenter > ball.y + 35 && computer.y > 0) {
            computer.y -= COMPUTER_PADDLE_SPEED;
        }
    }
}

// Update ball position
function moveBall() {
    if (gamePaused || countdownActive) return;

    let currentSpeedFactor = 1.0;
    const speedBoost = activePickups.find(p => p.type === PICKUP_TYPES.SPEED_BOOST && p.isActive);
    if (speedBoost) {
        // Speed boost is applied at collision, not continuously here for dx/dy.
        // Ball.speed itself is the base speed. dx/dy are derived from it.
    }

    ball.x += ball.dx;
    ball.y += ball.dy;

    const drunkenBall = activePickups.find(p => p.type === PICKUP_TYPES.DRUNKEN_BALL && p.isActive);
    if (drunkenBall) {
        ball.x += (Math.random() - 0.5) * 4; 
        ball.y += (Math.random() - 0.5) * 4;
    }

    // Wall collision (top/bottom)
    if (ball.y + getCurrentBallRadius() > canvas.height) {
        ball.y = canvas.height - getCurrentBallRadius();
        ball.dy *= -1;
        playSound(wallHitSound);
    } else if (ball.y - getCurrentBallRadius() < 0) {
        ball.y = getCurrentBallRadius();
        ball.dy *= -1;
        playSound(wallHitSound);
    }

    // Paddle collision
    if (collides(ball, player)) {
        handlePaddleCollision(player);
        playSound(paddleHitSound);
    } else if (collides(ball, computer)) {
        handlePaddleCollision(computer);
        playSound(paddleHitSound);
    }

    // Score points
    if (ball.x - ball.radius < 0) {
        computerScore++;
        updateScore();
        triggerScoreEffect();
        startCountdown(1, () => resetBall(false));
        playSound(scoreSound);
    } else if (ball.x + ball.radius > canvas.width) {
        playerScore++;
        updateScore();
        triggerScoreEffect();
        startCountdown(1, () => resetBall(true));
        playSound(scoreSound);
    }

    // After all position updates, calculate momentary speed and add to history
    const momentarySpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    ball.history.push({ x: ball.x, y: ball.y, speed: momentarySpeed });
    if (ball.history.length > MAX_TRAIL_LENGTH) {
        ball.history.shift(); // Keep the history to a max length
    }
}

// Collision detection function (AABB for paddles)
function collides(b, p) {
    const ballTop = b.y - b.radius;
    const ballBottom = b.y + b.radius;
    const ballLeft = b.x - b.radius;
    const ballRight = b.x + b.radius;

    const paddleTop = p.y;
    const paddleBottom = p.y + p.height;
    const paddleLeft = p.x;
    const paddleRight = p.x + p.width;

    return ballRight > paddleLeft && ballLeft < paddleRight && ballBottom > paddleTop && ballTop < paddleBottom;
}

// Handle paddle collision physics
function handlePaddleCollision(paddle) {
    let collidePoint = (ball.y - (paddle.y + paddle.height / 2));
    collidePoint = collidePoint / (paddle.height / 2);
    let angleRad = collidePoint * (Math.PI / 3);
    const randomFactor = (Math.random() - 0.5) * 0.1; 
    angleRad += randomFactor;
    let direction = (ball.x + ball.radius < canvas.width / 2) ? 1 : -1;
    let currentSpeed = ball.speed;
    const speedBoost = activePickups.find(p => p.type === PICKUP_TYPES.SPEED_BOOST && p.isActive);
    if (speedBoost) {
        currentSpeed *= 1.5; 
    }

    ball.dx = direction * currentSpeed * Math.cos(angleRad);
    ball.dy = currentSpeed * Math.sin(angleRad);
    
    if (!speedBoost) { 
        ball.speed += 0.3;
    }

    // Trigger paddle shake
    paddle.shakeIntensity = Math.min(currentSpeed / 1.5, 12); // Increased intensity cap and sensitivity
    paddle.shakeDuration = 15; // Slightly longer duration
    paddle.originalX = paddle.x; 

    if (paddle === player) {
        player.color = getRandomNeonColor();
        setTimeout(() => player.color = '#ff6b6b', 100); // Revert to coral red
    } else {
        computer.color = getRandomNeonColor();
        setTimeout(() => computer.color = '#4ecdc4', 100); // Revert to turquoise
    }
}

function getRandomNeonColor() {
    const paddleColors = ['#ff6b6b', '#4ecdc4', '#ff9f43', '#0abde3']; // Coral red, Turquoise, Orange, Blue
    return paddleColors[Math.floor(Math.random() * paddleColors.length)];
}

function resetBall(toPlayer, initialGameStart = false) {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speed = 7;
    if (initialGameStart) {
        ball.dx = (Math.random() > 0.5 ? 1 : -1) * 5; // Random initial direction on X
    } else {
        ball.dx = toPlayer ? 5 : -5; // Direction based on who scored
    }
    ball.dy = (Math.random() > 0.5 ? 1 : -1) * 5;
}

function updateScore() {
    if (gameOver) return; // Do not update score if game is over

    playerScoreElem.textContent = playerScore;
    computerScoreElem.textContent = computerScore;

    triggerScoreEffect(); // Trigger visual effect on score change

    if (playerScore >= 5) {
        gameOver = true;
        winner = "Player";
        // displayWinner(); // This will be called in render
        if (pickupSpawnTimer) clearInterval(pickupSpawnTimer); // Stop spawning pickups
        pauseButton.disabled = true; // Disable pause when game is over
        startButton.disabled = true; // Disable start when game is over
    } else if (computerScore >= 5) {
        gameOver = true;
        winner = "Computer";
        // displayWinner(); // This will be called in render
        if (pickupSpawnTimer) clearInterval(pickupSpawnTimer); // Stop spawning pickups
        pauseButton.disabled = true; // Disable pause when game is over
        startButton.disabled = true; // Disable start when game is over
    }
}

// Keyboard input handling
const keys = {};
document.addEventListener('keydown', (event) => {
    keys[event.code] = true;

    if (event.code === 'Space') {
        event.preventDefault(); // Prevent page scrolling
        if (gameStartedOnce) {
            togglePauseGame();
        }
    }
    if (event.code === 'KeyR') {
        if (gameStartedOnce) {
            restartGame();
        }
    }
});

document.addEventListener('keyup', (event) => {
    keys[event.code] = false;
});

function updatePlayerPaddle() {
    if (gamePaused) { // If game is paused, no paddle updates at all
        // If paddle was shaking when paused, reset its x position to originalX
        if (player.shakeDuration > 0) {
            player.x = player.originalX;
            player.shakeDuration = 0; // Stop the shake
            player.shakeIntensity = 0;
        }
        return;
    }

    // Apply vertical movement first
    if (touchControlActive || mouseControlActive) {
        let targetY = lastMouseY - player.height / 2;
        if (targetY < 0) targetY = 0;
        if (targetY > canvas.height - player.height) targetY = canvas.height - player.height;
        player.y = targetY;
    } else {
        if (keys['KeyW'] && player.y > 0) {
            player.y -= PADDLE_SPEED;
        }
        if (keys['KeyS'] && player.y < canvas.height - player.height) {
            player.y += PADDLE_SPEED;
        }
        if (keys['ArrowUp'] && player.y > 0) {
            player.y -= PADDLE_SPEED;
        }
        if (keys['ArrowDown'] && player.y < canvas.height - player.height) {
            player.y += PADDLE_SPEED;
        }
    }

    // Then, handle horizontal position and shake effect
    let currentX = PADDLE_WIDTH * 2; // Default X position for player

    if (player.shakeDuration > 0) {
        const shakeOffset = (Math.random() - 0.5) * player.shakeIntensity;
        player.x = player.originalX + shakeOffset; // Shake around the originalX stored at collision
        player.shakeDuration--;
        if (player.shakeDuration <= 0) {
            player.x = player.originalX; // Reset to exact originalX when shake ends
            player.shakeIntensity = 0;
        }
    } else {
        // If not shaking, set to the standard X position
        player.x = currentX;
        // Ensure originalX is also up-to-date if we are not shaking,
        // so the next shake starts from the correct base.
        player.originalX = currentX;
    }
}

function update() {
    updatePlayerPaddle();
    moveComputerPaddle();
    moveBall();
    updatePickups();
}

function render() {
    // Clear the canvas with a transparent trail effect
    context.fillStyle = 'rgba(30, 76, 100, 0.35)'; // Soft dark blue with transparency for trail
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Net
    drawNet();

    // Draw Paddles
    drawRoundedRect(player.x, player.y, player.width, player.height, player.borderRadius, player.color);
    drawRoundedRect(computer.x, computer.y, computer.width, computer.height, computer.borderRadius, computer.color);

    // Draw Ball Trail
    drawBallTrail();

    // Draw Ball
    drawArc(ball.x, ball.y, getCurrentBallRadius(), ball.color);

    // Draw Active Pickups
    drawActivePickups();

    // Display countdown if active
    if (countdownActive) {
        context.font = "bold 80px 'Arial Black', Gadget, sans-serif";
        context.fillStyle = "rgba(255, 255, 255, 0.9)";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(countdownTime > 0 ? countdownTime : "GO!", canvas.width / 2, canvas.height / 2);
    }

    // Display Pause Message if game is paused and not in countdown
    if (gamePaused && !countdownActive && gameStartedOnce && !gameOver) {
        context.font = "bold 60px 'Arial Black', Gadget, sans-serif";
        context.fillStyle = "rgba(0,0,0,0.7)"; // Darker overlay when paused
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "white";
        context.textAlign = "center";
        context.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
    }

    // Display Winner Message if game is over
    if (gameOver && winner) {
        context.font = "bold 70px 'Arial Black', Gadget, sans-serif";
        context.fillStyle = "rgba(0,0,0,0.75)"; // Dark overlay
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = winner === "Player" ? player.color : computer.color;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(winner + " Win!", canvas.width / 2, canvas.height / 2 - 40);
        context.font = "30px 'Arial', sans-serif";
        context.fillStyle = "#fffdf5";
        context.fillText("Restart to Play Again", canvas.width / 2, canvas.height / 2 + 40);
    }
}

const paddleHitSound = new Audio();
const wallHitSound = new Audio();
const scoreSound = new Audio();

function playSound(sound) {
    // sound.currentTime = 0;
    // sound.play().catch(error => console.log("Sound play error: " + error));
}

function updateBallStatsDisplay() {
    let currentBallRadius = getCurrentBallRadius();

    let currentSpeed = ball.speed;
    const speedBoost = activePickups.find(p => p.type === PICKUP_TYPES.SPEED_BOOST && p.isActive);
    // Note: The actual dx/dy speed is derived from ball.speed * cos/sin(angle) and boosted at collision.
    // Displaying ball.speed gives the base speed, which is more stable for display.
    // If a speed boost is active, we can indicate that.
    let speedDisplay = currentSpeed.toFixed(1);
    if (speedBoost) {
        speedDisplay += " (BOOSTED)";
    }

    ballStatsElem.innerHTML = `Ball Speed: ${speedDisplay}<br>Ball Size: ${currentBallRadius.toFixed(1)}`;
}

function enhancedGameLoop() {
    if (gameOver) {
        render(); // Keep rendering the game over screen
        requestAnimationFrame(enhancedGameLoop);
        return;
    }

    if (gamePaused || countdownActive) {
        render(); // Render the paused state or countdown
        requestAnimationFrame(enhancedGameLoop);
        return;
    }

    update();
    render();
    if (!gamePaused) { // Only update stats if game is running to avoid showing stale data on pause
        updateBallStatsDisplay();
    }
    requestAnimationFrame(enhancedGameLoop);
}

let lastMouseY = canvas.height / 2;
document.addEventListener('mousemove', (event) => {
    if (!mouseControlActive) return;
    
    // Get mouse position relative to the viewport
    const mouseY = event.clientY;
    
    // Convert viewport coordinates to canvas coordinates
    const rect = canvas.getBoundingClientRect();
    const canvasY = mouseY - rect.top;
    
    // Update lastMouseY regardless of whether the mouse is over the canvas
    lastMouseY = canvasY;
});

// Touch control for player paddle
let touchControlActive = false;
canvas.addEventListener('touchstart', (event) => {
    event.preventDefault(); 
    touchControlActive = true;
    mouseControlActive = false; 
    canvas.style.cursor = 'none'; 
    
    if (gamePaused) return; // Don't process touch for paddle movement if paused

    const touch = event.touches[0];
    const rect = canvas.getBoundingClientRect();
    lastMouseY = touch.clientY - rect.top; 
    // updatePlayerPaddle(); // Removed immediate update, game loop handles it and checks pause
}, { passive: false });

canvas.addEventListener('touchmove', (event) => {
    event.preventDefault();
    if (gamePaused || !touchControlActive) return; // Don't process if paused or touch not active

    const touch = event.touches[0];
    const rect = canvas.getBoundingClientRect();
    lastMouseY = touch.clientY - rect.top;
}, { passive: false });

// Double tap to pause logic
let lastTapTime = 0;
const DOUBLE_TAP_DELAY = 300; // milliseconds

canvas.addEventListener('touchend', (event) => {
    // This touchend listener is separate for clarity for double tap,
    // but could be merged with the one above if desired.
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;
    if (tapLength < DOUBLE_TAP_DELAY && tapLength > 0) {
        // Double tap detected
        event.preventDefault(); // Prevent any other actions like zoom
        if (gameStartedOnce) { // Only allow pause if game has started
            togglePauseGame();
        }
    }
    lastTapTime = currentTime;
});

canvas.addEventListener('click', () => {
    if (gamePaused && !gameStartedOnce) return; 
    if (touchControlActive) return; 

    if (!gamePaused || gameStartedOnce) { 
        mouseControlActive = !mouseControlActive;
        if (mouseControlActive) {
            console.log("Mouse control ON");
            canvas.style.cursor = 'crosshair';
        } else {
            console.log("Mouse control OFF");
            canvas.style.cursor = 'default';
        }
    }
});

// Game control functions
function startGame() {
    if (!gameStartedOnce) {
        gameStartedOnce = true;
    }
    gamePaused = false;
    startButton.style.display = 'none';
    pauseButton.style.display = 'inline-block';
    pauseButton.textContent = 'Pause (Space)';
    restartButton.style.display = 'inline-block';
    
    // Start with a countdown
    startCountdown(1, () => {
        resetBall(true, true);
        startPickupSpawner();
    });
    console.log("Game Started");
}

function startCountdown(seconds, callback) {
    countdownActive = true;
    countdownTime = seconds;
    gamePaused = true; // Pause the game during countdown
    
    // Show countdown message
    const countdownMessage = document.createElement('div');
    countdownMessage.id = 'countdownMessage';
    countdownMessage.style.position = 'absolute';
    countdownMessage.style.top = '50%';
    countdownMessage.style.left = '50%';
    countdownMessage.style.transform = 'translate(-50%, -50%)';
    countdownMessage.style.fontSize = '4em';
    countdownMessage.style.color = '#b8d8d8';
    countdownMessage.style.fontFamily = 'Arial Black, Arial Bold, Gadget, sans-serif';
    countdownMessage.style.zIndex = '100';
    document.querySelector('.game-container').appendChild(countdownMessage);

    const countdownInterval = setInterval(() => {
        countdownTime--;
        if (countdownTime > 0) {
            countdownMessage.textContent = countdownTime;
        } else {
            clearInterval(countdownInterval);
            countdownMessage.remove();
            countdownActive = false;
            gamePaused = false;
            if (callback) callback();
        }
    }, 1000);
}

function togglePauseGame() {
    if (!gameStartedOnce) return; 

    gamePaused = !gamePaused;
    if (gamePaused) {
        pauseButton.textContent = 'Resume (Space)';
        console.log("Game Paused");
        if (pickupSpawnTimer) clearInterval(pickupSpawnTimer); 
        activePickups.forEach(p => {
            if (p.isActive && p.timeoutId) {
                p.remainingTime = p.durationEndTime - Date.now();
                clearTimeout(p.timeoutId);
            }
        });
        // Reset paddle shake states on pause
        if (player.shakeDuration > 0) {
            player.x = player.originalX;
            player.shakeDuration = 0;
            player.shakeIntensity = 0;
        }
        if (computer.shakeDuration > 0) {
            computer.x = computer.originalX;
            computer.shakeDuration = 0;
            computer.shakeIntensity = 0;
        }
    } else {
        pauseButton.textContent = 'Pause (Space)';
        console.log("Game Resumed");
        startPickupSpawner(true); // Resume pickup spawning (pass true to indicate it's a resume)
        // Resume active pickup timers
        activePickups.forEach(p => {
            if (p.isActive && p.remainingTime > 0) {
                p.timeoutId = setTimeout(() => {
                    deactivatePickup(p);
                }, p.remainingTime);
                p.durationEndTime = Date.now() + p.remainingTime; // Update end time
            }
        });
    }
}

function restartGame() {
    if (countdownActive) return; // Don't restart if a countdown is active

    playerScore = 0;
    computerScore = 0;
    // updateScore will be called after countdown to reflect 0-0 properly before game action

    // Reset game state variables
    gameOver = false;
    winner = null;
    gamePaused = true; // Game is paused, countdown will unpause it.
    gameStartedOnce = true; // A new game is starting
    mouseControlActive = false; // Reset mouse control

    // Clear active pickups and effects
    activePickups.forEach(p => {
        if (p.deactivateTimeout) clearTimeout(p.deactivateTimeout);
        if (p.type === PICKUP_TYPES.PADDLE_SIZE_INCREASE) {
            player.height = originalPaddleHeight;
            // computer.height = originalPaddleHeight; // If computer paddle size can also change
        }
    });
    activePickups = [];
    if (pickupSpawnTimer) clearInterval(pickupSpawnTimer);
    pickupSpawnTimer = null; // Ensure timer is reset

    // Reset paddles (ball is reset in countdown callback)
    player.y = canvas.height / 2 - player.height / 2;
    player.dy = 0;
    player.shakeIntensity = 0; 
    player.shakeDuration = 0;
    player.originalX = PADDLE_WIDTH * 2; // Reset originalX for player
    player.x = player.originalX;

    computer.y = canvas.height / 2 - computer.height / 2;
    computer.dy = 0;
    computer.shakeIntensity = 0; 
    computer.shakeDuration = 0;
    computer.originalX = canvas.width - PADDLE_WIDTH * 3; // Reset originalX for computer
    computer.x = computer.originalX;

    // Reset UI elements
    pickupMessageElem.style.opacity = '0';
    pickupMessageElem.textContent = '';
    
    startButton.style.display = 'none'; // Start button remains hidden

    pauseButton.textContent = 'Pause Game'; // Or 'Pause (Space)'
    pauseButton.style.display = 'inline-block';
    pauseButton.disabled = true; // Will be enabled after countdown

    restartButton.disabled = false; // Restart button remains enabled

    // Clear canvas and render the reset state before countdown
    context.clearRect(0, 0, canvas.width, canvas.height);
    updateScore(); // Update score display to 0-0 immediately
    render();      // Render the reset state (paddles, net etc.)
    
    console.log("Restart sequence initiated. Starting countdown...");

    startCountdown(1, () => {
        resetBall(true, true); // Reset ball to center, for player, initial random direction
        startPickupSpawner();    // Start spawning pickups for the new game
        updateBallStatsDisplay(); // Update ball stats for the new game
        updateScore(); // Ensure score display is 0-0 (belt and braces)
        // gamePaused is now false (set by startCountdown completion)
        pauseButton.disabled = false; // Enable pause button now that game is truly starting
        console.log("Game restarted: Countdown finished, new game active.");
    });
}

startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', restartGame);
pauseButton.addEventListener('click', togglePauseGame); // Listener for the pause button

window.addEventListener('resize', resizeCanvas);

// Initial setup
resizeCanvas();
updateScore();
updateBallStatsDisplay(); // Initial call to show stats before game starts
enhancedGameLoop();
console.log('Cool Pong Initialized! Click Start Button.');

// Pickup System Functions
function spawnPickup() {
    if (gamePaused) return;

    const randomTypeKey = Object.keys(PICKUP_TYPES)[Math.floor(Math.random() * Object.keys(PICKUP_TYPES).length)];
    const type = PICKUP_TYPES[randomTypeKey];

    // Spawn pickups in the central 50% of the canvas width and height
    const centralZoneXStart = canvas.width * 0.25;
    const centralZoneWidth = canvas.width * 0.5;
    const centralZoneYStart = canvas.height * 0.25;
    const centralZoneHeight = canvas.height * 0.5;

    const newPickup = {
        x: Math.random() * (centralZoneWidth - PICKUP_RADIUS * 2) + centralZoneXStart + PICKUP_RADIUS,
        y: Math.random() * (centralZoneHeight - PICKUP_RADIUS * 2) + centralZoneYStart + PICKUP_RADIUS,
        radius: PICKUP_RADIUS,
        type: type,
        color: pickupColors[type],
        isActive: false, // Becomes true on collection
        isSpawned: true, // To indicate it is on the canvas
        timeoutId: null // For duration timer
    };

    // Avoid spawning on paddles or too close to ball (simple check)
    // This could be more robust
    if (collidesWithAnyPaddle(newPickup) || distance(newPickup, ball) < ball.radius + newPickup.radius + 50) {
        console.log("Pickup spawn conflict, trying again next interval.");
        return; // Don't spawn this time, wait for next interval
    }

    activePickups.push(newPickup);
    console.log(`Spawned pickup: ${type} at (${newPickup.x.toFixed(0)}, ${newPickup.y.toFixed(0)})`);
}

function collidesWithAnyPaddle(pickup) {
    const pickupAsBall = { x: pickup.x, y: pickup.y, radius: pickup.radius }; // Treat pickup as a ball for collision
    return collides(pickupAsBall, player) || collides(pickupAsBall, computer);
}

function distance(obj1, obj2) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function startPickupSpawner(isResuming = false) {
    if (pickupSpawnTimer) clearInterval(pickupSpawnTimer);
    // If not resuming, or if the timer was never set, spawn one immediately
    if (!isResuming || !pickupSpawnTimer) {
        spawnPickup(); 
    }
    pickupSpawnTimer = setInterval(spawnPickup, PICKUP_SPAWN_INTERVAL);
}

function drawActivePickups() {
    activePickups.forEach(pickup => {
        if (pickup.isSpawned && !pickup.isActive) { // Only draw if spawned and not yet collected
            drawArc(pickup.x, pickup.y, pickup.radius, pickup.color);
            
            // Text styling
            context.font = "bold 12px Arial"; // Slightly bolder and larger for clarity
            context.textAlign = "center";
            context.textBaseline = "middle"; // Align text vertically to center

            let text = '';
            switch(pickup.type) {
                case PICKUP_TYPES.SPEED_BOOST: text = 'SPD'; break;
                case PICKUP_TYPES.BALL_SIZE_INCREASE: text = 'BIG'; break;
                case PICKUP_TYPES.TRAJECTORY_CHANGE: text = 'TRJ'; break;
                case PICKUP_TYPES.DRUNKEN_BALL: text = 'DRK'; break;
                case PICKUP_TYPES.PADDLE_SIZE_INCREASE: text = 'PAD+'; break; 
            }
            
            // Draw text stroke (outline) for better visibility
            context.strokeStyle = 'black';
            context.lineWidth = 2; // Adjust stroke width as needed
            context.strokeText(text, pickup.x, pickup.y);

            // Draw main text fill
            context.fillStyle = pickup.color; // Use pickup's color for the text
            context.fillText(text, pickup.x, pickup.y);
        }
    });
}

function updatePickups() {
    if (gamePaused) return;
    const currentBallRadius = getCurrentBallRadius();

    for (let i = activePickups.length - 1; i >= 0; i--) {
        let pickup = activePickups[i];
        if (pickup.isSpawned && !pickup.isActive) {
            const dist = distance(ball, pickup);
            if (dist < currentBallRadius + pickup.radius) {
                activatePickup(pickup);
            }
        }
    }
}

function activatePickup(pickup) {
    console.log(`Collected pickup: ${pickup.type}`);
    pickup.isActive = true;
    pickup.isSpawned = false; 

    const existingActiveSameType = activePickups.find(p => p.type === pickup.type && p.isActive && p !== pickup);
    if (existingActiveSameType) {
        console.log(`Stacking ${pickup.type}: Refreshing duration.`);
        clearTimeout(existingActiveSameType.timeoutId);
        existingActiveSameType.durationEndTime = Date.now() + PICKUP_DURATION;
        existingActiveSameType.timeoutId = setTimeout(() => deactivatePickup(existingActiveSameType), PICKUP_DURATION);
        activePickups = activePickups.filter(p => p !== pickup);
        return; 
    }

    applyPickupEffect(pickup);
    pickup.durationEndTime = Date.now() + PICKUP_DURATION;
    pickup.timeoutId = setTimeout(() => {
        deactivatePickup(pickup);
    }, PICKUP_DURATION);
}

function showPickupMessage(message) {
    pickupMessageElem.textContent = message;
    pickupMessageElem.style.opacity = '1';
    setTimeout(() => {
        pickupMessageElem.style.opacity = '0';
    }, 2500); // Display message for 2.5 seconds
}

function applyPickupEffect(pickup) {
    let message = '';
    switch (pickup.type) {
        case PICKUP_TYPES.SPEED_BOOST:
            message = "Ball Speed Boost!";
            console.log("Speed Boost Activated!");
            break;
        case PICKUP_TYPES.BALL_SIZE_INCREASE:
            message = "MEGA BALL!";
            console.log("Ball Size Increase Activated!");
            break;
        case PICKUP_TYPES.TRAJECTORY_CHANGE:
            message = "Trajectory Shift!";
            console.log("Trajectory Change Activated!");
            ball.dx += (Math.random() - 0.5) * 10; // Increased magnitude from 5 to 10
            ball.dy += (Math.random() - 0.5) * 10; // Increased magnitude from 5 to 10
            // Ensure the ball still moves at a reasonable minimum speed after trajectory change
            const minSpeedComponent = 2;
            if (Math.abs(ball.dx) < minSpeedComponent && ball.dx !== 0) ball.dx = ball.dx > 0 ? minSpeedComponent : -minSpeedComponent;
            if (Math.abs(ball.dy) < minSpeedComponent && ball.dy !== 0) ball.dy = ball.dy > 0 ? minSpeedComponent : -minSpeedComponent;
            // If dx or dy became zero, give it a small nudge
            if (ball.dx === 0) ball.dx = (Math.random() > 0.5 ? minSpeedComponent : -minSpeedComponent);
            if (ball.dy === 0) ball.dy = (Math.random() > 0.5 ? minSpeedComponent : -minSpeedComponent);
            break;
        case PICKUP_TYPES.DRUNKEN_BALL:
            message = "Drunken Ball! Woozy!";
            console.log("Drunken Ball Activated!");
            break;
        case PICKUP_TYPES.PADDLE_SIZE_INCREASE:
            message = "Super Paddle!";
            console.log("Player Paddle Size Increase Activated!");
            // Increase height for player paddle only
            const alreadyActivePaddleSize = activePickups.find(p => p.type === PICKUP_TYPES.PADDLE_SIZE_INCREASE && p.isActive && p !== pickup);
            if (!alreadyActivePaddleSize) { 
                player.height = originalPaddleHeight * 1.5;
            }
            // Ensure player paddle doesn't go out of bounds after resizing
            if (player.y + player.height > canvas.height) player.y = canvas.height - player.height;
            break;
    }
    if (message) showPickupMessage(message);
}

function deactivatePickup(pickupToDeactivate) {
    console.log(`Deactivating pickup: ${pickupToDeactivate.type}`);
    // Check if there are other active pickups of the same type before reverting effect fully.
    // This is important for proper stacking behavior where reverting only happens when the LAST stacked pickup expires.
    const stillActiveSameType = activePickups.find(p => 
        p.type === pickupToDeactivate.type && 
        p.isActive && 
        p !== pickupToDeactivate && // Exclude the one being deactivated from the check
        p.timeoutId // Ensure it has an active timer (might be redundant with isActive)
    );

    pickupToDeactivate.isActive = false;
    activePickups = activePickups.filter(p => p !== pickupToDeactivate);

    if (!stillActiveSameType) { // Only revert if no other instances of this pickup type are active
        switch (pickupToDeactivate.type) {
            case PICKUP_TYPES.SPEED_BOOST:
                console.log("Speed Boost Deactivated (last one).");
                break;
            case PICKUP_TYPES.BALL_SIZE_INCREASE:
                console.log("Ball Size Increase Deactivated (last one).");
                break;
            case PICKUP_TYPES.TRAJECTORY_CHANGE:
                console.log("Trajectory Change (effect was one-shot) Deactivated.");
                break;
            case PICKUP_TYPES.DRUNKEN_BALL:
                console.log("Drunken Ball Deactivated (last one).");
                break;
            case PICKUP_TYPES.PADDLE_SIZE_INCREASE:
                console.log("Player Paddle Size Increase Deactivated (last one).");
                player.height = originalPaddleHeight;
                // Ensure player paddle is within bounds after reverting size
                if (player.y + player.height > canvas.height) player.y = canvas.height - player.height;
                if (player.y < 0) player.y = 0; 
                break;
        }
    } else {
        console.log(`Deactivating one instance of ${pickupToDeactivate.type}, but others are still active.`);
    }
}

// Function to draw the ball trail
function drawBallTrail() {
    const currentRadius = getCurrentBallRadius();
    for (let i = 0; i < ball.history.length; i++) {
        const pos = ball.history[i];
        const age = ball.history.length - i;
        const opacity = 1 - (age / MAX_TRAIL_LENGTH);
        
        // Calculate speed ratio for color and size
        let speedRatio = 0;
        if (pos.speed > MIN_SPEED_FOR_TRAIL_EFFECT) {
            speedRatio = Math.min((pos.speed - MIN_SPEED_FOR_TRAIL_EFFECT) / (MAX_SPEED_FOR_TRAIL_EFFECT - MIN_SPEED_FOR_TRAIL_EFFECT), 1);
        }

        // Dynamic trail length based on speed
        const trailLength = Math.floor(MAX_TRAIL_LENGTH * (0.5 + speedRatio * 0.5));
        const trailRadius = currentRadius * (1 - (age / (trailLength * 1.2)));

        if (trailRadius < 1) continue;

        // Fire effect colors
        const colors = [
            { r: 255, g: 255, b: 255 }, // White
            { r: 255, g: 255, b: 200 }, // Light yellow
            { r: 255, g: 200, b: 100 }, // Orange
            { r: 255, g: 100, b: 50 },  // Red-orange
            { r: 255, g: 50, b: 0 }     // Bright red
        ];

        // Calculate color based on speed and age
        const colorIndex = Math.min(Math.floor(speedRatio * (colors.length - 1)), colors.length - 1);
        const nextColorIndex = Math.min(colorIndex + 1, colors.length - 1);
        const colorBlend = (speedRatio * (colors.length - 1)) % 1;

        const r = Math.floor(colors[colorIndex].r + (colors[nextColorIndex].r - colors[colorIndex].r) * colorBlend);
        const g = Math.floor(colors[colorIndex].g + (colors[nextColorIndex].g - colors[colorIndex].g) * colorBlend);
        const b = Math.floor(colors[colorIndex].b + (colors[nextColorIndex].b - colors[colorIndex].b) * colorBlend);

        // Add some randomness to the trail for a more dynamic fire effect
        const randomOffset = (Math.random() - 0.5) * 2;
        const trailColor = `rgba(${r}, ${g}, ${b}, ${opacity * 0.8})`;

        // Draw multiple trail segments for a more dynamic effect
        const numSegments = Math.floor(3 + speedRatio * 2);
        for (let j = 0; j < numSegments; j++) {
            const segmentOffset = (Math.random() - 0.5) * 4 * speedRatio;
            const segmentRadius = trailRadius * (0.8 + Math.random() * 0.4);
            drawArc(
                pos.x + randomOffset + segmentOffset,
                pos.y + randomOffset + segmentOffset,
                segmentRadius,
                trailColor,
                false
            );
        }
    }
}

function triggerScoreEffect() {
    const gameContainer = document.querySelector('.game-container');
    const scoreDisplay = document.querySelector('.score');
    
    // Add the effect class
    gameContainer.classList.add('score-effect');
    scoreDisplay.classList.add('score-effect');
    
    // Remove the effect class after animation completes
    setTimeout(() => {
        gameContainer.classList.remove('score-effect');
        scoreDisplay.classList.remove('score-effect');
    }, 500); // Match the animation duration
} 