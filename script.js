// Game variables
let score = 0;
let isGameOver = false;
let isPaused = false;
let gameSpeed = 2; // Initial game speed
let initialScrollSpeed = 1; // Initial scroll speed
let scrollSpeed = initialScrollSpeed * 1.5; // Set to 50% faster than starting speed and keep constant
let playerPosition = { x: 0, y: 0 };
let pathSegments = []; // Array to store path segments
let obstacles = []; // Array to store obstacles
let bullets = []; // Array to store bullets
let animationFrameId = null;
let lastTimestamp = 0;
let playerDirection = { x: 0, y: 0 };
let touchStartX = 0;
let touchStartY = 0;
let segmentHeight = 0; // Height of each segment (will be calculated)
let totalSegments = 7; // Total number of segments visible on screen
let basePathWidth = 0.3; // Base width of the path as a percentage of canvas width
let minPathWidth = 0.2; // Minimum path width
let maxPathWidth = 0.4; // Maximum path width
let lastPathX = 0.5 - (basePathWidth / 2); // Center position of the last path segment
let lastPathWidth = basePathWidth; // Width of the last path segment
let playerMoveSensitivity = 0.5; // Reduced sensitivity for more precise control
let difficultyLevel = 1; // Current difficulty level (affects path width variation)
let pathPattern = 'random'; // Current path pattern (random, zigzag, curve, etc.)
let patternCounter = 0; // Counter for pattern generation
let patternDirection = 1; // Direction for patterns like zigzag
let lastPatternChange = 0; // Score at which the last pattern changed
let lastObstacleSpawn = 0; // Score at which the last obstacle was spawned
let lastBulletSpawn = 0; // Score at which the last bullet was spawned
let obstacleSpawnChance = 0.005; // Base chance to spawn an obstacle per frame
let bulletSpawnChance = 0.002; // Base chance to spawn a bullet per frame (reduced)
let playerColor = 'blue'; // Current player color (blue or green)
let colorIndicator = null; // Reference to the color indicator element

// DOM Elements
const gameCanvas = document.getElementById('gameCanvas');
const player = document.getElementById('player');
const scoreDisplay = document.getElementById('score');
const finalScoreDisplay = document.getElementById('finalScore');
const gameOverScreen = document.getElementById('gameOverScreen');
const pauseScreen = document.getElementById('pauseScreen');
const pauseButton = document.getElementById('pauseButton');
const resumeButton = document.getElementById('resumeButton');
const restartButton = document.getElementById('restartButton');
const restartFromPauseButton = document.getElementById('restartFromPauseButton');

// Initialize the game
function initGame() {
    score = 0;
    isGameOver = false;
    isPaused = false;
    gameSpeed = 2;
    scrollSpeed = initialScrollSpeed * 1.5; // Set to 50% faster than starting speed
    scoreDisplay.textContent = score;
    playerColor = 'blue'; // Reset player color to blue
    
    // Reset player direction to prevent cached movement from previous game
    playerDirection = { x: 0, y: 0 };
    
    // Calculate segment height based on canvas height
    const canvasRect = gameCanvas.getBoundingClientRect();
    segmentHeight = canvasRect.height / totalSegments;
    
    // Clear existing path segments, obstacles, and bullets
    clearPathSegments();
    clearObstacles();
    clearBullets();
    
    // Reset spawn tracking
    lastObstacleSpawn = 0;
    lastBulletSpawn = 0;
    
    // Generate initial path segments
    generateInitialPath();
    
    // Position player at the bottom center of the path
    const bottomSegment = pathSegments[pathSegments.length - 1];
    playerPosition = {
        x: canvasRect.width * (bottomSegment.x + (bottomSegment.width / 2)),
        y: canvasRect.height * 0.85 // Position near the bottom
    };
    
    updatePlayerPosition();
    
    // Create or update color indicator
    createColorIndicator();
    updatePlayerColor();
    
    // Start the game loop
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    lastTimestamp = performance.now();
    animationFrameId = requestAnimationFrame(gameLoop);
}

// Generate initial path segments to fill the screen
function generateInitialPath() {
    // Start with a centered path at the bottom
    lastPathX = 0.5 - (basePathWidth / 2);
    lastPathWidth = basePathWidth;
    
    // Generate segments from bottom to top
    for (let i = 0; i < totalSegments; i++) {
        addPathSegment(i);
    }
}

// Add a new path segment at the specified index (0 is top, totalSegments-1 is bottom)
function addPathSegment(index) {
    const canvasRect = gameCanvas.getBoundingClientRect();
    
    // Calculate new path position with smooth transition from previous segment
    // Ensure the path doesn't go off-screen
    const minX = 0.05;
    const maxX = 0.95;
    
    // Determine path width for this segment - varies based on score/difficulty
    let newPathWidth;
    
    // Calculate difficulty level based on score
    difficultyLevel = Math.min(5, Math.floor(score / 500) + 1);
    
    if (pathSegments.length === 0) {
        // First segment - use base width
        newPathWidth = basePathWidth;
    } else {
        // Vary the width gradually based on difficulty
        // Higher difficulty = more width variation
        const maxWidthChange = 0.02 * difficultyLevel; // Max 2% change per segment × difficulty
        
        // Random width change, but ensure it stays within min/max bounds
        const widthChange = (Math.random() * maxWidthChange * 2) - maxWidthChange;
        newPathWidth = Math.max(minPathWidth, Math.min(maxPathWidth, lastPathWidth + widthChange));
    }
    
    // Check if we should change the path pattern
    // Change pattern every 300-500 points
    if (score - lastPatternChange > 300 + Math.floor(Math.random() * 200)) {
        changePathPattern();
        lastPatternChange = score;
    }
    
    // Generate a new x position that ensures path continuity
    let newX;
    
    if (pathSegments.length === 0) {
        // First segment - center it
        newX = 0.5 - (newPathWidth / 2);
    } else {
        // Find the most recent segment that's above this one
        const adjacentSegments = pathSegments.filter(s => s.index === index + 1);
        
        if (adjacentSegments.length > 0) {
            // Get the segment that will connect to this new one
            const connectingSegment = adjacentSegments[0];
            
            // Calculate the center of the connecting segment
            const connectingSegmentCenter = connectingSegment.x + (connectingSegment.width / 2);
            
            // Apply different path patterns based on current pattern
            let shift = 0;
            
            switch (pathPattern) {
                case 'zigzag':
                    // Create a zigzag pattern with increasing amplitude based on difficulty
                    const zigzagAmplitude = Math.min(0.3, 0.1 + (difficultyLevel * 0.04));
                    patternCounter++;
                    if (patternCounter % 3 === 0) {
                        // Change direction every 3 segments
                        patternDirection *= -1;
                    }
                    shift = zigzagAmplitude * patternDirection;
                    break;
                    
                case 'curve':
                    // Create a smooth curve pattern
                    const curveAmplitude = Math.min(0.25, 0.1 + (difficultyLevel * 0.03));
                    patternCounter++;
                    // Use sine function to create smooth curves
                    shift = Math.sin(patternCounter * 0.5) * curveAmplitude;
                    break;
                    
                case 'snake':
                    // Create a snake-like pattern with varying frequency
                    const snakeAmplitude = Math.min(0.3, 0.15 + (difficultyLevel * 0.03));
                    patternCounter++;
                    // Use sine function with increasing frequency
                    shift = Math.sin(patternCounter * 0.3) * snakeAmplitude;
                    break;
                    
                case 'swerve':
                    // Create sudden swerves with straight sections
                    patternCounter++;
                    if (patternCounter % 5 === 0) {
                        // Sudden swerve every 5 segments
                        const swerveAmount = (Math.random() * 0.3 + 0.1) * (Math.random() > 0.5 ? 1 : -1);
                        shift = swerveAmount;
                    } else {
                        // Small random movement between swerves
                        shift = (Math.random() * 0.05 - 0.025);
                    }
                    break;
                    
                case 'random':
                default:
                    // Random movement with increasing randomness based on difficulty
                    const maxRandomShift = Math.min(0.2, 0.05 + (difficultyLevel * 0.03));
                    shift = (Math.random() * maxRandomShift * 2) - maxRandomShift;
                    break;
            }
            
            // Calculate new X position based on connecting segment's center and pattern shift
            newX = connectingSegmentCenter - (newPathWidth / 2) + shift;
            
            // Ensure the new segment has sufficient overlap with the connecting segment
            // Calculate overlap area
            const newSegmentRight = newX + newPathWidth;
            const connectingSegmentRight = connectingSegment.x + connectingSegment.width;
            
            const overlapLeft = Math.max(newX, connectingSegment.x);
            const overlapRight = Math.min(newSegmentRight, connectingSegmentRight);
            const overlapWidth = overlapRight - overlapLeft;
            
            // CRITICAL FIX: Ensure minimum overlap of 30% of the smaller segment width
            // This prevents dead ends where the player can't advance
            const minRequiredOverlap = Math.min(newPathWidth, connectingSegment.width) * 0.3;
            
            if (overlapWidth < minRequiredOverlap) {
                // Adjust position to ensure minimum overlap
                if (newX < connectingSegment.x) {
                    // New segment is more to the left, move it right
                    newX = connectingSegment.x + connectingSegment.width - minRequiredOverlap - newPathWidth;
                } else {
                    // New segment is more to the right, move it left
                    newX = connectingSegment.x + minRequiredOverlap;
                }
                
                // ADDITIONAL FIX: Double-check the overlap after adjustment
                const adjustedNewSegmentRight = newX + newPathWidth;
                const adjustedOverlapLeft = Math.max(newX, connectingSegment.x);
                const adjustedOverlapRight = Math.min(adjustedNewSegmentRight, connectingSegmentRight);
                const adjustedOverlapWidth = adjustedOverlapRight - adjustedOverlapLeft;
                
                // If we still don't have enough overlap, force center alignment
                if (adjustedOverlapWidth < minRequiredOverlap) {
                    // Force alignment with the connecting segment's center
                    newX = connectingSegmentCenter - (newPathWidth / 2);
                }
            }
            
            // Final bounds check
            newX = Math.max(minX, Math.min(maxX - newPathWidth, newX));
            
            // ADDITIONAL SAFETY CHECK: Ensure we're not creating a dead end
            // Recalculate overlap after bounds check
            const finalNewSegmentRight = newX + newPathWidth;
            const finalOverlapLeft = Math.max(newX, connectingSegment.x);
            const finalOverlapRight = Math.min(finalNewSegmentRight, connectingSegmentRight);
            const finalOverlapWidth = finalOverlapRight - finalOverlapLeft;
            
            // If we still don't have enough overlap after bounds check, adjust width
            if (finalOverlapWidth < minRequiredOverlap) {
                // Increase width to ensure overlap
                newPathWidth = Math.min(maxPathWidth, newPathWidth + (minRequiredOverlap - finalOverlapWidth) * 1.5);
                
                // Recenter with new width
                newX = connectingSegmentCenter - (newPathWidth / 2);
                
                // Final bounds check after width adjustment
                newX = Math.max(minX, Math.min(maxX - newPathWidth, newX));
            }
        } else {
            // No adjacent segment found, use the last created segment as reference
            // This happens when generating the initial path
            const lastSegment = pathSegments[pathSegments.length - 1];
            
            // Calculate the center of the last segment
            const lastSegmentCenter = lastSegment.x + (lastSegment.width / 2);
            
            // Calculate maximum shift that keeps the path on screen
            const maxLeftShift = lastSegmentCenter - (newPathWidth / 2) - minX;
            const maxRightShift = maxX - (lastSegmentCenter + (newPathWidth / 2));
            const maxShift = Math.min(maxLeftShift, maxRightShift, 0.05); // More restricted for initial path
            
            // Generate random shift
            const shift = (Math.random() * maxShift * 2) - maxShift;
            
            // Calculate new X position based on last segment's center
            newX = lastSegmentCenter - (newPathWidth / 2) + shift;
            
            // Ensure we stay within bounds
            newX = Math.max(minX, Math.min(maxX - newPathWidth, newX));
            
            // ADDITIONAL SAFETY CHECK: Ensure we're not creating a dead end in initial path
            // Calculate overlap with the last segment
            const newSegmentRight = newX + newPathWidth;
            const lastSegmentRight = lastSegment.x + lastSegment.width;
            
            const overlapLeft = Math.max(newX, lastSegment.x);
            const overlapRight = Math.min(newSegmentRight, lastSegmentRight);
            const overlapWidth = overlapRight - overlapLeft;
            
            // Ensure minimum overlap
            const minRequiredOverlap = Math.min(newPathWidth, lastSegment.width) * 0.3;
            
            if (overlapWidth < minRequiredOverlap) {
                // Force alignment with the last segment's center
                newX = lastSegmentCenter - (newPathWidth / 2);
            }
        }
    }
    
    // Update last path position and width for next segment
    lastPathX = newX;
    lastPathWidth = newPathWidth;
    
    // Create the path segment element
    const pathElement = document.createElement('div');
    pathElement.className = 'path';
    
    // Position the segment with a slight vertical overlap to prevent pixel leaks
    // Add a small overlap (0.5%) to prevent gaps between segments
    const verticalOverlap = 0.005; // 0.5% overlap
    const y = index / totalSegments - verticalOverlap;
    const height = (1 / totalSegments) + (verticalOverlap * 2); // Add overlap to both top and bottom
    
    pathElement.style.left = `${newX * 100}%`;
    pathElement.style.top = `${y * 100}%`;
    pathElement.style.width = `${newPathWidth * 100}%`;
    pathElement.style.height = `${height * 100}%`;
    
    gameCanvas.appendChild(pathElement);
    
    // Store the segment data
    pathSegments.push({
        element: pathElement,
        x: newX,
        y: y,
        width: newPathWidth,
        height: height,
        index: index
    });
}

// Change the path pattern
function changePathPattern() {
    const patterns = ['random', 'zigzag', 'curve', 'snake', 'swerve'];
    
    // Choose a new pattern that's different from the current one
    let newPattern;
    do {
        newPattern = patterns[Math.floor(Math.random() * patterns.length)];
    } while (newPattern === pathPattern && patterns.length > 1);
    
    pathPattern = newPattern;
    patternCounter = 0; // Reset the pattern counter
    
    // Show a notification about the pattern change
    showPatternChangeNotification(pathPattern);
}

// Show a notification about the pattern change
function showPatternChangeNotification(pattern) {
    const patternNames = {
        'random': 'Random Path',
        'zigzag': 'Zigzag Path',
        'curve': 'Curved Path',
        'snake': 'Snake Path',
        'swerve': 'Swerving Path'
    };
    
    const notification = document.createElement('div');
    notification.className = 'pattern-notification';
    notification.textContent = patternNames[pattern];
    
    // Position notification at the top of the game window
    notification.style.left = '50%';
    notification.style.top = '60px'; // Position below the header
    notification.style.transform = 'translateX(-50%)';
    
    gameCanvas.appendChild(notification);
    
    // Remove notification after animation completes
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 2000);
}

// Scroll all path segments down and generate new ones as needed
function scrollPathSegments(deltaTime) {
    const scrollAmount = (scrollSpeed * deltaTime) / 1000;
    const canvasRect = gameCanvas.getBoundingClientRect();
    
    // Move all segments down
    for (let i = 0; i < pathSegments.length; i++) {
        const segment = pathSegments[i];
        segment.y += scrollAmount / totalSegments;
        segment.element.style.top = `${segment.y * 100}%`;
        
        // Update segment index
        segment.index = Math.floor(segment.y * totalSegments);
    }
    
    // Remove segments that have moved off-screen
    pathSegments = pathSegments.filter(segment => {
        if (segment.y >= 1) {
            if (segment.element && segment.element.parentNode) {
                segment.element.parentNode.removeChild(segment.element);
            }
            return false;
        }
        return true;
    });
    
    // Add new segments at the top as needed
    if (pathSegments.length > 0) {
        // Find the topmost segment
        const topSegment = pathSegments.reduce((top, segment) => 
            segment.y < top.y ? segment : top, pathSegments[0]);
            
        // If the topmost segment has moved down, add new segments
        if (topSegment.y > 0) {
            // Calculate how many new segments we need
            const segmentsToAdd = Math.ceil(topSegment.y * totalSegments);
            
            for (let i = 0; i < segmentsToAdd; i++) {
                // Add new segment at the top, ensuring proper connection
                // The negative index ensures it's placed above the visible area
                const newIndex = -i - 1;
                addPathSegment(newIndex);
            }
            
            // Sort segments by y position for proper rendering and collision detection
            pathSegments.sort((a, b) => a.y - b.y);
        }
    }
}

// Clear all path segments
function clearPathSegments() {
    pathSegments.forEach(segment => {
        if (segment.element && segment.element.parentNode) {
            segment.element.parentNode.removeChild(segment.element);
        }
    });
    pathSegments = [];
}

// Update player position based on current coordinates
function updatePlayerPosition() {
    player.style.transform = `translate(${playerPosition.x - player.offsetWidth / 2}px, ${playerPosition.y - player.offsetHeight / 2}px)`;
}

// Check if player is on a path
function isPlayerOnPath() {
    const playerRadius = player.offsetWidth / 2;
    const canvasRect = gameCanvas.getBoundingClientRect();
    
    // Normalize player position and radius to 0-1 range
    const normalizedX = playerPosition.x / canvasRect.width;
    const normalizedY = playerPosition.y / canvasRect.height;
    const normalizedRadius = playerRadius / canvasRect.width;
    
    // Required percentage of the player that must be on the path
    const requiredOverlapPercentage = 0.6; // 60%
    
    // Check each path segment
    for (const segment of pathSegments) {
        // Calculate the closest point on the rectangle to the circle center
        let closestX = Math.max(segment.x, Math.min(normalizedX, segment.x + segment.width));
        let closestY = Math.max(segment.y, Math.min(normalizedY, segment.y + segment.height));
        
        // Calculate the distance from the circle center to this closest point
        const distanceX = normalizedX - closestX;
        const distanceY = normalizedY - closestY;
        const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
        
        // If the distance is less than the radius, the circle intersects the rectangle
        if (distanceSquared <= (normalizedRadius * normalizedRadius)) {
            // The player is at least partially on the path
            
            // Calculate how much of the player is on the path
            // If the player's center is inside the path, start with 100% overlap
            let overlapPercentage = 1.0;
            
            // If the player's center is outside the path, calculate the overlap
            if (distanceSquared > 0) {
                const distance = Math.sqrt(distanceSquared);
                // Calculate what percentage of the diameter is inside the path
                // 1.0 = fully inside, 0.0 = fully outside
                overlapPercentage = Math.max(0, 1.0 - (distance / normalizedRadius));
            }
            
            // Only consider the player on the path if enough of it overlaps
            if (overlapPercentage >= requiredOverlapPercentage) {
                return true;
            }
        }
    }
    
    // If we've checked all segments and haven't returned true, the player is not on a path
    return false;
}

// Clear all obstacles
function clearObstacles() {
    obstacles.forEach(obstacle => {
        if (obstacle.element && obstacle.element.parentNode) {
            obstacle.element.parentNode.removeChild(obstacle.element);
        }
    });
    obstacles = [];
}

// Clear all bullets
function clearBullets() {
    bullets.forEach(bullet => {
        if (bullet.element && bullet.element.parentNode) {
            bullet.element.parentNode.removeChild(bullet.element);
        }
    });
    bullets = [];
}

// Create a new obstacle on a random path segment
function spawnObstacle() {
    // Only spawn obstacles after a certain score
    if (score < 200) return;
    
    // Choose a random path segment in the top half of the screen
    const eligibleSegments = pathSegments.filter(segment => 
        segment.y >= 0 && segment.y <= 0.5 && segment.width >= 0.25);
    
    if (eligibleSegments.length === 0) return;
    
    const randomSegment = eligibleSegments[Math.floor(Math.random() * eligibleSegments.length)];
    
    // Define the row height - this determines what we consider a "row"
    const rowHeight = 0.1; // 10% of screen height
    
    // Check if there's already an obstacle in this row
    const rowStart = Math.floor(randomSegment.y / rowHeight) * rowHeight;
    const rowEnd = rowStart + rowHeight;
    
    // Check if any existing obstacle is in this row
    const obstacleInRow = obstacles.some(obstacle => 
        obstacle.y >= rowStart && obstacle.y < rowEnd
    );
    
    // If there's already an obstacle in this row, don't spawn another one
    if (obstacleInRow) return;
    
    // Create obstacle element
    const obstacleElement = document.createElement('div');
    obstacleElement.className = 'obstacle';
    
    // Determine obstacle size (smaller on narrower paths)
    const obstacleWidth = Math.min(0.05, randomSegment.width * 0.3);
    const obstacleHeight = Math.min(0.05, randomSegment.height * 0.7);
    
    // Position obstacle randomly within the path segment
    // But not too close to the edges to ensure there's always a way around
    const margin = obstacleWidth * 1.5;
    const minX = randomSegment.x + margin;
    const maxX = randomSegment.x + randomSegment.width - margin - obstacleWidth;
    
    // Only create obstacle if there's enough space
    if (maxX <= minX) return;
    
    const obstacleX = minX + Math.random() * (maxX - minX);
    const obstacleY = randomSegment.y + randomSegment.height * 0.2;
    
    // Set obstacle position and size
    obstacleElement.style.left = `${obstacleX * 100}%`;
    obstacleElement.style.top = `${obstacleY * 100}%`;
    obstacleElement.style.width = `${obstacleWidth * 100}%`;
    obstacleElement.style.height = `${obstacleHeight * 100}%`;
    
    // Randomly assign color to obstacle (blue or green only)
    const isBlue = Math.random() < 0.5;
    const obstacleColor = isBlue ? 'blue' : 'green';
    
    // Add the appropriate class
    obstacleElement.classList.add(obstacleColor);
    
    gameCanvas.appendChild(obstacleElement);
    
    // Store obstacle data
    obstacles.push({
        element: obstacleElement,
        x: obstacleX,
        y: obstacleY,
        width: obstacleWidth,
        height: obstacleHeight,
        color: obstacleColor,
        row: rowStart // Store the row this obstacle belongs to
    });
    
    // Update last spawn time
    lastObstacleSpawn = score;
}

// Create a new bullet at a random horizontal position
function spawnBullet() {
    // Only spawn bullets after a certain score
    if (score < 300) return;
    
    const canvasRect = gameCanvas.getBoundingClientRect();
    
    // Target the player's X position with some randomness
    // This makes bullets more challenging but still possible to dodge
    const playerNormalizedX = playerPosition.x / canvasRect.width;
    const randomOffset = (Math.random() - 0.5) * 0.2; // Random offset of ±10% of screen width
    const bulletX = Math.max(0.05, Math.min(0.95, playerNormalizedX + randomOffset));
    
    // First create the indicator to show where the bullet will fall
    const indicatorElement = document.createElement('div');
    indicatorElement.className = 'bullet-indicator';
    
    // Position indicator at the top of the screen at the bullet's X position
    indicatorElement.style.left = `calc(${bulletX * 100}% - 7.5px)`; // Center the indicator (half of 15px width)
    
    gameCanvas.appendChild(indicatorElement);
    
    // Create bottom indicator
    const bottomIndicatorElement = document.createElement('div');
    bottomIndicatorElement.className = 'bottom-bullet-indicator';
    
    // Position at the bottom of the screen at the bullet's X position
    bottomIndicatorElement.style.left = `calc(${bulletX * 100}% - 7.5px)`;
    
    // Add to game canvas
    gameCanvas.appendChild(bottomIndicatorElement);
    
    // Show indicator for a short time before spawning the bullet
    setTimeout(() => {
        // Create bullet element
        const bulletElement = document.createElement('div');
        bulletElement.className = 'bullet';
        
        // Position at the very top of the game view, just above the visible area
        const bulletY = -0.02; // Slightly above the top edge
        
        // Set bullet position
        bulletElement.style.left = `${bulletX * 100}%`;
        bulletElement.style.top = `${bulletY * 100}%`;
        
        gameCanvas.appendChild(bulletElement);
        
        // Calculate normalized bullet size
        const bulletSize = 15 / canvasRect.width;
        
        // Store bullet data
        bullets.push({
            element: bulletElement,
            x: bulletX,
            y: bulletY,
            width: bulletSize,
            height: bulletSize,
            speed: 0.0003 * (1 + Math.random() * 0.2) * difficultyLevel, // Further reduced speed with less variation
            bottomIndicator: null, // Set to null since we're removing it immediately
            passedPlayer: false // Track if bullet has passed the player
        });
        
        // Remove top indicator after bullet is spawned
        if (indicatorElement.parentNode) {
            indicatorElement.parentNode.removeChild(indicatorElement);
        }
        
        // Remove bottom indicator after bullet is spawned
        if (bottomIndicatorElement.parentNode) {
            bottomIndicatorElement.parentNode.removeChild(bottomIndicatorElement);
        }
        
        // Update last spawn time
        lastBulletSpawn = score;
        
        // Remove bullet after animation completes
        setTimeout(() => {
            if (bulletElement.parentNode) {
                bulletElement.parentNode.removeChild(bulletElement);
            }
            
            // Also remove from bullets array
            bullets = bullets.filter(b => b.element !== bulletElement);
        }, 4000); // Extended time to match slower speed
    }, 1000); // Show indicator for 1 second before spawning bullet
}

// Update obstacles position as the path scrolls
function updateObstacles(deltaTime) {
    const scrollAmount = (scrollSpeed * deltaTime) / 1000;
    
    obstacles.forEach(obstacle => {
        // Move obstacle down with the path
        obstacle.y += scrollAmount / totalSegments;
        obstacle.element.style.top = `${obstacle.y * 100}%`;
    });
    
    // Remove obstacles that have moved off-screen
    obstacles = obstacles.filter(obstacle => {
        if (obstacle.y >= 1) {
            if (obstacle.element && obstacle.element.parentNode) {
                obstacle.element.parentNode.removeChild(obstacle.element);
            }
            return false;
        }
        return true;
    });
}

// Update bullets position
function updateBullets(deltaTime) {
    const canvasRect = gameCanvas.getBoundingClientRect();
    
    bullets.forEach(bullet => {
        // Move bullet down
        bullet.y += bullet.speed * deltaTime;
        
        // Update visual position
        if (bullet.element) {
            bullet.element.style.top = `${bullet.y * 100}%`;
            
            // Calculate bullet center and radius
            const bulletCenterY = bullet.y + (bullet.height / 2);
            
            // Check if bullet has passed a certain threshold on the screen
            // Using an absolute position threshold (70% of screen height) instead of relative to player
            if (bulletCenterY > 0.7 && !bullet.passedPlayer) {
                bullet.passedPlayer = true;
                
                // Add a class to fade out the bullet
                bullet.element.classList.add('passed');
                
                // Remove the bullet element after a short delay
                setTimeout(() => {
                    if (bullet.element && bullet.element.parentNode) {
                        bullet.element.parentNode.removeChild(bullet.element);
                        bullet.element = null;
                    }
                }, 300); // Short delay for fade-out effect
            }
        }
    });
    
    // Clean up bullets that have been removed from the DOM
    bullets = bullets.filter(bullet => bullet.element !== null);
}

// Check if player collides with any obstacle or bullet
function checkCollisions() {
    const playerRadius = player.offsetWidth / 2;
    const canvasRect = gameCanvas.getBoundingClientRect();
    
    // Normalize player position and radius to 0-1 range
    const normalizedX = playerPosition.x / canvasRect.width;
    const normalizedY = playerPosition.y / canvasRect.height;
    const normalizedRadius = playerRadius / canvasRect.width;
    
    // Check collision with obstacles
    for (let i = 0; i < obstacles.length; i++) {
        const obstacle = obstacles[i];
        
        // Simple circle-rectangle collision check
        const closestX = Math.max(obstacle.x, Math.min(normalizedX, obstacle.x + obstacle.width));
        const closestY = Math.max(obstacle.y, Math.min(normalizedY, obstacle.y + obstacle.height));
        
        const distanceX = normalizedX - closestX;
        const distanceY = normalizedY - closestY;
        const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
        
        if (distanceSquared <= (normalizedRadius * normalizedRadius)) {
            // Collision detected!
            
            // Check if colors match
            if ((obstacle.color === 'blue' && playerColor === 'blue') || 
                (obstacle.color === 'green' && playerColor === 'green')) {
                
                // Colors match! Award bonus points
                const bonusPoints = 50;
                score += bonusPoints;
                
                // Remove the obstacle
                if (obstacle.element && obstacle.element.parentNode) {
                    obstacle.element.parentNode.removeChild(obstacle.element);
                }
                obstacles.splice(i, 1);
                i--; // Adjust index after removal
                
                // No game over, continue playing
                continue;
            } else {
                // Color mismatch, game over
                return true;
            }
        }
    }
    
    // Check collision with bullets
    for (let i = 0; i < bullets.length; i++) {
        const bullet = bullets[i];
        
        // Skip bullets that have no element or are marked as passed
        if (!bullet.element || bullet.passedPlayer) {
            continue;
        }
        
        // Calculate bullet center and radius
        const bulletCenterX = bullet.x + (bullet.width / 2);
        const bulletCenterY = bullet.y + (bullet.height / 2);
        const bulletRadius = bullet.width / 2; // Assuming bullet width and height are the same
        
        // Check if bullet has passed the player vertically
        // A bullet has passed if its center is below a certain threshold on the screen
        // Using an absolute position threshold (70% of screen height) instead of relative to player
        if (bulletCenterY > 0.7) {
            bullet.passedPlayer = true;
            continue;
        }
        
        // Calculate distance between centers
        const dx = normalizedX - bulletCenterX;
        const dy = normalizedY - bulletCenterY;
        const distanceSquared = dx * dx + dy * dy;
        
        // Calculate the sum of radii squared
        const radiiSum = normalizedRadius + bulletRadius;
        const radiiSumSquared = radiiSum * radiiSum;
        
        // Check for actual collision (circles touching)
        if (distanceSquared <= radiiSumSquared) {
            return true; // Collision detected - game over
        }
    }
    
    return false; // No collision
}

// Main game loop
function gameLoop(timestamp) {
    if (isGameOver || isPaused) {
        return;
    }
    
    const deltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    
    // Scroll the path segments
    scrollPathSegments(deltaTime);
    
    // Update obstacles and bullets
    updateObstacles(deltaTime);
    updateBullets(deltaTime);
    
    // Randomly spawn obstacles and bullets
    if (Math.random() < obstacleSpawnChance * (1 + difficultyLevel * 0.2) && 
        score - lastObstacleSpawn > 100) {
        spawnObstacle();
    }
    
    if (Math.random() < bulletSpawnChance * (1 + difficultyLevel * 0.2) && 
        score - lastBulletSpawn > 150) {
        spawnBullet();
    }
    
    // Move player based on direction and game speed, with reduced sensitivity
    playerPosition.x += playerDirection.x * gameSpeed * playerMoveSensitivity;
    playerPosition.y += playerDirection.y * gameSpeed * playerMoveSensitivity;
    
    // Keep player within bounds
    const canvasRect = gameCanvas.getBoundingClientRect();
    playerPosition.x = Math.max(0, Math.min(canvasRect.width, playerPosition.x));
    playerPosition.y = Math.max(0, Math.min(canvasRect.height, playerPosition.y));
    
    updatePlayerPosition();
    
    // Check if player is on path
    if (!isPlayerOnPath()) {
        gameOver();
        return;
    }
    
    // Check if player collides with obstacles or bullets
    if (checkCollisions()) {
        gameOver();
        return;
    }
    
    // Increase score
    score += 1;
    scoreDisplay.textContent = score;
    
    // Increase difficulty every 100 points - only increase player speed, not scroll speed
    if (score % 100 === 0) {
        gameSpeed += 0.1; // Only increase player movement speed
    }
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

// Game over function
function gameOver() {
    isGameOver = true;
    
    // Reset player direction to prevent movement after game over
    playerDirection = { x: 0, y: 0 };
    
    // Also reset mouse state to prevent movement after restart
    isMouseDown = false;
    
    finalScoreDisplay.textContent = score;
    gameOverScreen.classList.remove('hidden');
    
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// Pause the game
function pauseGame() {
    if (!isGameOver) {
        isPaused = true;
        pauseScreen.classList.remove('hidden');
    }
}

// Resume the game
function resumeGame() {
    isPaused = false;
    pauseScreen.classList.add('hidden');
    lastTimestamp = performance.now();
    animationFrameId = requestAnimationFrame(gameLoop);
}

// Event Listeners
pauseButton.addEventListener('click', pauseGame);
resumeButton.addEventListener('click', resumeGame);
restartButton.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    
    // Reset player direction before restarting
    playerDirection = { x: 0, y: 0 };
    
    initGame();
});
restartFromPauseButton.addEventListener('click', () => {
    pauseScreen.classList.add('hidden');
    
    // Reset player direction before restarting
    playerDirection = { x: 0, y: 0 };
    
    initGame();
});

// Touch and mouse controls
gameCanvas.addEventListener('touchstart', (e) => {
    if (isGameOver || isPaused) {
        // Ensure player doesn't move when game is over or paused
        playerDirection.x = 0;
        playerDirection.y = 0;
        return;
    }
    
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});

gameCanvas.addEventListener('touchmove', (e) => {
    if (isGameOver || isPaused) {
        // Ensure player doesn't move when game is over or paused
        playerDirection.x = 0;
        playerDirection.y = 0;
        return;
    }
    
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    
    const deltaX = touchX - touchStartX;
    const deltaY = touchY - touchStartY;
    
    // Use smaller thresholds for direction changes
    const minThreshold = 3; // Minimum pixel movement to register a direction change
    
    // Determine primary direction based on which delta is larger, with minimum threshold
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (Math.abs(deltaX) > minThreshold) {
            playerDirection.x = deltaX > 0 ? 1 : -1;
            playerDirection.y = 0;
        }
    } else {
        if (Math.abs(deltaY) > minThreshold) {
            playerDirection.x = 0;
            playerDirection.y = deltaY > 0 ? 1 : -1;
        }
    }
    
    // Update starting position for next move
    touchStartX = touchX;
    touchStartY = touchY;
    
    e.preventDefault(); // Prevent scrolling
});

gameCanvas.addEventListener('touchend', () => {
    // Always stop movement when touch ends, regardless of game state
    playerDirection.x = 0;
    playerDirection.y = 0;
});

// Mouse controls (for desktop)
let isMouseDown = false;
let lastMouseX = 0;

gameCanvas.addEventListener('mousedown', (e) => {
    if (isGameOver || isPaused) {
        // Ensure player doesn't move when game is over or paused
        playerDirection.x = 0;
        playerDirection.y = 0;
        return;
    }
    
    isMouseDown = true;
    lastMouseX = e.clientX;
    
    // Immediately stop any vertical movement when using mouse
    playerDirection.y = 0;
});

gameCanvas.addEventListener('mousemove', (e) => {
    if (!isMouseDown || isGameOver || isPaused) {
        // If not mouse down or game is over/paused, ensure no movement
        if (isGameOver || isPaused) {
            playerDirection.x = 0;
            playerDirection.y = 0;
        }
        return;
    }
    
    const mouseX = e.clientX;
    
    // Calculate horizontal movement only
    const deltaX = mouseX - lastMouseX;
    
    // Use smaller thresholds for direction changes
    const minThreshold = 3; // Minimum pixel movement to register a direction change
    
    // Set horizontal direction based on mouse movement
    if (Math.abs(deltaX) > minThreshold) {
        playerDirection.x = deltaX > 0 ? 1 : -1;
    } else {
        // For very small movements, reduce speed or stop
        playerDirection.x = 0;
    }
    
    // Always keep vertical direction at zero for mouse control
    playerDirection.y = 0;
    
    // Update starting position for next move
    lastMouseX = mouseX;
});

gameCanvas.addEventListener('mouseup', () => {
    isMouseDown = false;
    
    // Always stop movement when mouse is released, regardless of game state
    playerDirection.x = 0;
    playerDirection.y = 0;
});

// Also handle mouse leaving the canvas
gameCanvas.addEventListener('mouseleave', () => {
    if (isMouseDown) {
        isMouseDown = false;
        playerDirection.x = 0;
        playerDirection.y = 0;
    }
});

// Keyboard controls
window.addEventListener('keydown', (e) => {
    if (isGameOver || isPaused) {
        // Ensure player doesn't move when game is over or paused
        playerDirection.x = 0;
        playerDirection.y = 0;
        return;
    }
    
    // Toggle color with spacebar
    if (e.key === ' ' || e.code === 'Space') {
        togglePlayerColor();
        e.preventDefault(); // Prevent page scrolling
        return;
    }
    
    // Normal movement with arrow keys
    switch (e.key) {
        case 'ArrowUp':
            playerDirection.x = 0;
            playerDirection.y = -1;
            break;
        case 'ArrowDown':
            playerDirection.x = 0;
            playerDirection.y = 1;
            break;
        case 'ArrowLeft':
            playerDirection.x = -1;
            playerDirection.y = 0;
            break;
        case 'ArrowRight':
            playerDirection.x = 1;
            playerDirection.y = 0;
            break;
            
        // Fine-tuning with WASD for more precise control (half speed)
        case 'w':
            playerDirection.x = 0;
            playerDirection.y = -0.5;
            break;
        case 's':
            playerDirection.x = 0;
            playerDirection.y = 0.5;
            break;
        case 'a':
            playerDirection.x = -0.5;
            playerDirection.y = 0;
            break;
        case 'd':
            playerDirection.x = 0.5;
            playerDirection.y = 0;
            break;
    }
});

window.addEventListener('keyup', (e) => {
    // Only reset direction if it's the key that was setting that direction
    if (isGameOver || isPaused) {
        playerDirection.x = 0;
        playerDirection.y = 0;
        return;
    }
    
    // Reset for arrow keys
    if ((e.key === 'ArrowUp' && playerDirection.y === -1) ||
        (e.key === 'ArrowDown' && playerDirection.y === 1) ||
        (e.key === 'ArrowLeft' && playerDirection.x === -1) ||
        (e.key === 'ArrowRight' && playerDirection.x === 1) ||
        // Reset for WASD keys
        (e.key === 'w' && playerDirection.y === -0.5) ||
        (e.key === 's' && playerDirection.y === 0.5) ||
        (e.key === 'a' && playerDirection.x === -0.5) ||
        (e.key === 'd' && playerDirection.x === 0.5)) {
        playerDirection.x = 0;
        playerDirection.y = 0;
    }
});

// Additional global event listeners to ensure player direction is reset
window.addEventListener('blur', () => {
    // Reset player direction when window loses focus
    playerDirection.x = 0;
    playerDirection.y = 0;
});

// Reset player direction when user switches tabs
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        playerDirection.x = 0;
        playerDirection.y = 0;
    }
});

// Create color indicator
function createColorIndicator() {
    // Remove existing indicator if it exists
    if (colorIndicator && colorIndicator.parentNode) {
        colorIndicator.parentNode.removeChild(colorIndicator);
    }
    
    // Create new indicator
    colorIndicator = document.createElement('div');
    colorIndicator.className = 'color-indicator';
    document.querySelector('.game-container').appendChild(colorIndicator);
}

// Update player color
function updatePlayerColor() {
    // Update player element class
    if (playerColor === 'blue') {
        player.classList.remove('green');
        colorIndicator.classList.remove('green');
    } else {
        player.classList.add('green');
        colorIndicator.classList.add('green');
    }
}

// Toggle player color
function togglePlayerColor() {
    playerColor = playerColor === 'blue' ? 'green' : 'blue';
    updatePlayerColor();
    
    // Reset animation to make it pop again
    colorIndicator.style.animation = 'none';
    // Force reflow
    void colorIndicator.offsetWidth;
    // Restart animation
    colorIndicator.style.animation = 'popEffect 0.5s ease-out';
}

// Initialize the game when the page loads
window.addEventListener('load', initGame); 