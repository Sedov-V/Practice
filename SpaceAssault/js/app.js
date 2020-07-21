
// A cross-browser requestAnimationFrame
// See https://hacks.mozilla.org/2011/08/animating-with-javascript-from-setinterval-to-requestanimationframe/
var requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

// Create the canvas
var canvas = document.createElement("canvas");
var ctx = canvas.getContext("2d");
canvas.width = 512;
canvas.height = 480;
document.body.appendChild(canvas);

// The main game loop
var lastTime;
function main() {
    var now = Date.now();
    var dt = (now - lastTime) / 1000.0;

    update(dt);
    render();

    lastTime = now;
    requestAnimFrame(main);
};

function init() {
    terrainPattern = ctx.createPattern(resources.get('img/terrain.png'), 'repeat');

    document.getElementById('play-again').addEventListener('click', function () {
        reset();
    });

    reset();
    lastTime = Date.now();
    main();
}

resources.load([
    'img/sprites.png',
    'img/terrain.png'
]);
resources.onReady(init);

// Game state
var player = {
    pos: [0, 0],
    sprite: new Sprite('img/sprites.png', [0, 0], [39, 39], 16, [0, 1])
};

var bullets = [];
var enemies = [];
var explosions = [];
var megaliths = [];
var mannas = [];
var mannasExplosion = [];

var lastFire = Date.now();
var gameTime = 0;
var isGameOver;
var terrainPattern;

var score = 0;
var manna = 0;
var scoreEl = document.getElementById('score');
var mannaEl = document.getElementById('manna');

// Speed in pixels per second
var playerSpeed = 200;
var bulletSpeed = 500;
var enemySpeed = 100;

// Update game objects
function update(dt) {
    gameTime += dt;

    handleInput(dt);
    updateEntities(dt);

    // It gets harder over time by adding enemies using this
    // equation: 1-.993^gameTime
    if (Math.random() < 1 - Math.pow(.993, gameTime)) {
        enemies.push({
            pos: [canvas.width,
            Math.random() * (canvas.height - 39)],
            sprite: new Sprite('img/sprites.png', [0, 78], [80, 39],
                6, [0, 1, 2, 3, 2, 1])
        });
    }

    checkCollisions(dt);

    scoreEl.innerHTML = score;

    mannaEl.innerHTML = manna;
};

function handleInput(dt) {
    if (input.isDown('DOWN') || input.isDown('s')) {
        player.pos[1] += playerSpeed * dt;
    }

    if (input.isDown('UP') || input.isDown('w')) {
        player.pos[1] -= playerSpeed * dt;
    }

    if (input.isDown('LEFT') || input.isDown('a')) {
        player.pos[0] -= playerSpeed * dt;
    }

    if (input.isDown('RIGHT') || input.isDown('d')) {
        player.pos[0] += playerSpeed * dt;
    }

    if (input.isDown('SPACE') &&
        !isGameOver &&
        Date.now() - lastFire > 100) {
        var x = player.pos[0] + player.sprite.size[0] / 2;
        var y = player.pos[1] + player.sprite.size[1] / 2;

        bullets.push({
            pos: [x, y],
            dir: 'forward',
            sprite: new Sprite('img/sprites.png', [0, 39], [18, 8])
        });
        bullets.push({
            pos: [x, y],
            dir: 'up',
            sprite: new Sprite('img/sprites.png', [0, 50], [9, 5])
        });
        bullets.push({
            pos: [x, y],
            dir: 'down',
            sprite: new Sprite('img/sprites.png', [0, 60], [9, 5])
        });

        lastFire = Date.now();
    }
}

function updateEntities(dt) {
    // Update the player sprite animation
    player.sprite.update(dt);

    // Update all the bullets
    for (var i = 0; i < bullets.length; i++) {
        var bullet = bullets[i];

        switch (bullet.dir) {
            case 'up': bullet.pos[1] -= bulletSpeed * dt; break;
            case 'down': bullet.pos[1] += bulletSpeed * dt; break;
            default:
                bullet.pos[0] += bulletSpeed * dt;
        }

        // Remove the bullet if it goes offscreen
        if (bullet.pos[1] < 0 || bullet.pos[1] > canvas.height ||
            bullet.pos[0] > canvas.width) {
            bullets.splice(i, 1);
            i--;
        }
    }

    // Update all the mannas
    for (var i = 0; i < mannas.length; i++) {
        mannas[i].sprite.update(dt);
    }
    for (var i = 0; i < mannasExplosion.length; i++) {
        mannasExplosion[i].sprite.update(dt);

        // Remove if animation is done
        if (mannasExplosion[i].sprite.done) {
            mannasExplosion.splice(i, 1);
            i--;
        }
    }

    // Update all the enemies
    for (var i = 0; i < enemies.length; i++) {
        enemies[i].pos[0] -= enemySpeed * dt;
        enemies[i].sprite.update(dt);

        // Remove if offscreen
        if (enemies[i].pos[0] + enemies[i].sprite.size[0] < 0) {
            enemies.splice(i, 1);
            i--;
        }
    }

    // Update all the explosions
    for (var i = 0; i < explosions.length; i++) {
        explosions[i].sprite.update(dt);

        // Remove if animation is done
        if (explosions[i].sprite.done) {
            explosions.splice(i, 1);
            i--;
        }
    }
}

// Collisions

function collides(x, y, r, b, x2, y2, r2, b2) {
    return !(r <= x2 || x > r2 ||
        b <= y2 || y > b2);
}

function boxCollides(pos, size, pos2, size2) {
    return collides(pos[0], pos[1],
        pos[0] + size[0], pos[1] + size[1],
        pos2[0], pos2[1],
        pos2[0] + size2[0], pos2[1] + size2[1]);
}

function checkCollisions(dt) {
    checkPlayerBounds();

    for (var i = 0; i < megaliths.length; i++) {
        var pos = megaliths[i].pos;
        var size = megaliths[i].sprite.size;

        for (var j = 0; j < bullets.length; j++) {
            var pos2 = bullets[j].pos;
            var size2 = bullets[j].sprite.size;

            if (boxCollides(pos, size, pos2, size2)) {
                // Remove the bullet and stop this iteration
                bullets.splice(j, 1);
                j--;
            }
        }

        if (boxCollides(pos, size, player.pos, player.sprite.size)) {
            if (Math.abs(pos[0] - (player.pos[0] + player.sprite.size[0])) <= 4) {
                player.pos[0] = pos[0] - player.sprite.size[0];
            }
            else if (Math.abs(player.pos[0] - (pos[0] + size[0])) <= 4) {
                player.pos[0] = pos[0] + size[0];
            }
            if (Math.abs(pos[1] - (player.pos[1] + player.sprite.size[1])) <= 4) {
                player.pos[1] = pos[1] - player.sprite.size[1];
            }
            else if (Math.abs(player.pos[1] - (pos[1] + size[1])) <= 4) {
                player.pos[1] = pos[1] + size[1];
            }

        }
    }

    for (var i = 0; i < mannas.length; i++) {
        var pos = mannas[i].pos;
        var size = mannas[i].sprite.size;

        if (boxCollides(pos, size, player.pos, player.sprite.size)) {
            mannas.splice(i, 1);
            manna++;

            explosions.push({
                pos: pos,
                sprite: new Sprite('img/sprites.png', [2, 162], [59, 41], 8, [0, 1, 2, 3], null, true)
            });

            generateManna();
            break;
        }
    }

    // Run collision detection for all enemies and bullets
    for (var i = 0; i < enemies.length; i++) {
        var pos = enemies[i].pos;
        var size = enemies[i].sprite.size;


        var direction = 0;
        var maxMegalithPosition = -1;
        for (var j = 0; j < megaliths.length; j++) {
            var pos2 = megaliths[j].pos;
            var size2 = megaliths[j].sprite.size;

            var prePos = pos.slice();
            prePos[0] -= 45;
            prePos[1] -= 30;
            var preSize = size.slice();
            preSize[0] += 25;
            preSize[1] += + 60;

            if (boxCollides(pos2, size2, prePos, preSize)) {
                if (pos2[0] + size2[0] < pos[0] + size[0] / 2) {
                    if (pos2[0] + size2[0] >= maxMegalithPosition) {
                        maxMegalithPosition = pos2[0] + size2[0];

                        if (enemies[i].pos[1] <= pos2[1]) {
                            direction = -enemySpeed * dt;
                        }
                        else {
                            direction = enemySpeed * dt;
                        }
                    }
                }
            }
            if (boxCollides(pos, size, pos2, size2)) {
                //enemies[i].pos[0] += 2 * enemySpeed * dt;
            }
        }
        enemies[i].pos[1] += direction;       

        for (var j = 0; j < bullets.length; j++) {
            var pos2 = bullets[j].pos;
            var size2 = bullets[j].sprite.size;

            if (boxCollides(pos, size, pos2, size2)) {
                // Remove the enemy
                enemies.splice(i, 1);
                i--;

                // Add score
                score += 100;

                // Add an explosion
                explosions.push({
                    pos: pos,
                    sprite: new Sprite('img/sprites.png',
                        [0, 117],
                        [39, 39],
                        16,
                        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                        null,
                        true)
                });

                // Remove the bullet and stop this iteration
                bullets.splice(j, 1);
                break;
            }
        }

        if (boxCollides(pos, size, player.pos, player.sprite.size)) {
            gameOver();
        }
    }
}

function checkPlayerBounds() {
    // Check bounds
    if (player.pos[0] < 0) {
        player.pos[0] = 0;
    }
    else if (player.pos[0] > canvas.width - player.sprite.size[0]) {
        player.pos[0] = canvas.width - player.sprite.size[0];
    }

    if (player.pos[1] < 0) {
        player.pos[1] = 0;
    }
    else if (player.pos[1] > canvas.height - player.sprite.size[1]) {
        player.pos[1] = canvas.height - player.sprite.size[1];
    }
}

// Draw everything
function render() {
    ctx.fillStyle = terrainPattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render the player if the game isn't over
    if (!isGameOver) {
        renderEntity(player);
    }

    renderEntities(mannas);
    renderEntities(mannasExplosion);
    renderEntities(bullets);
    renderEntities(enemies);
    renderEntities(megaliths);
    renderEntities(explosions);
};

function renderEntities(list) {
    for (var i = 0; i < list.length; i++) {
        renderEntity(list[i]);
    }
}

function renderEntity(entity) {
    ctx.save();
    ctx.translate(entity.pos[0], entity.pos[1]);
    entity.sprite.render(ctx);
    ctx.restore();
}

function generateManna() {
    var mannaCount = 3 + Math.floor(Math.random() * 5) - mannas.length;
    for (var i = 0; i < mannaCount; i++) {
        mannas.push({
            pos: [Math.random() * (canvas.width - 55),
            Math.random() * (canvas.height - 41)],
            sprite: new Sprite('img/sprites.png', [2, 162], [59, 41], 2, [0, 1])
        });
        if (boxCollides(mannas[i].pos, mannas[i].sprite.size, [50, canvas.height / 2], player.sprite.size)) {
            mannas[i].pos[1] = canvas.height / 2 - mannas[i].sprite.size[1] - 10;
        }
        var hasCollides = true;
        while (hasCollides) {
            var pos = mannas[i].pos;
            var size = mannas[i].sprite.size;

            hasCollides = false;

            for (var j = 0; j < megaliths.length; j++) {
                var pos2 = megaliths[j].pos;
                var size2 = megaliths[j].sprite.size;

                if (boxCollides(pos, size, pos2, size2)) {
                    pos[1] = pos2[1] - size[1];
                    hasCollides = true;
                }
                if (pos[1] <= 0) {
                    pos = [Math.random() * (canvas.width - 55), Math.random() * (canvas.height - 41)]
                }
            }
        }
    }
}
function generateMegaliths() {

    var megalithsCount = 3 + Math.floor(Math.random() * 2);
    for (var i = 0; i < megalithsCount; i++) {
        if (Math.random() < 0.5) {
            megaliths.push({
                pos: [Math.random() * (canvas.width - 55),
                Math.random() * (canvas.height - 53)],
                sprite: new Sprite('img/sprites.png', [3, 213], [55, 53])
            });
        }
        else {
            megaliths.push({
                pos: [Math.random() * (canvas.width - 48),
                Math.random() * (canvas.height - 42)],
                sprite: new Sprite('img/sprites.png', [5, 274], [48, 42])
            });
        }
        if (boxCollides(megaliths[i].pos, megaliths[i].sprite.size, [50, canvas.height / 2], player.sprite.size)) {
            megaliths[i].pos[1] = canvas.height / 2 - megaliths[i].sprite.size[1] - 10;
        }
    }
}


// Game over
function gameOver() {
    document.getElementById('game-over').style.display = 'block';
    document.getElementById('game-over-overlay').style.display = 'block';
    isGameOver = true;
}

// Reset game to original state
function reset() {
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('game-over-overlay').style.display = 'none';
    isGameOver = false;
    gameTime = 0;
    score = 0;
    manna = 0;

    enemies = [];
    bullets = [];
    megaliths = [];
    mannas = [];

    generateMegaliths();
    generateManna();

    player.pos = [50, canvas.height / 2];
};
