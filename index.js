const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");

canvas.height = window.innerHeight;
canvas.width = window.innerWidth;

const centerX = canvas.width / 2;
const centerY = canvas.height / 2;

const SPEED = 3;
const PROJECTILE_SPEED = 3.5;
const ROTATIONAL_SPEED = 0.05;
const FRICTION = 0.995;
const POSSIBLE_SIDES = 4;
const HIT_DAMAGE = 20;

const projectiles = [];
const asteroids = [];
let isPaused = false;
let isGameOver = false;
let animationId = null;
let player = null;
let playerPoints = 0;
let lives = 3;

const MESSAGE_POINTS = "points";

const MESSAGE_GAME_OVER = "Game Over";
const MESSAGE_GAME_OVER_INSTRUCTIONS = "Press ENTER to start a new game";

const MESSAGE_PAUSE = "Paused";
const MESSAGE_PAUSE_INSTRUCTIONS = "Press P to continue";

const keys = {
  w: {
    pressed: false,
  },
  a: {
    pressed: false,
  },
  s: {
    pressed: false,
  },
  d: {
    pressed: false,
  },
  p: {
    pressed: false,
  },
  enter: {
    pressed: false,
  },
};

function updateBackground() {
  context.fillStyle = "black";
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function renderCenteredText({ text, x, y, font, color = "white" }) {
  renderText({ text, font, align: "center", color, x, y });
}

function renderText({
  text,
  x,
  y,
  font = "15px Verdana",
  align = "left",
  color = "white",
}) {
  context.beginPath();
  context.font = font;
  context.textAlign = align;
  context.fillStyle = color;
  context.fillText(text, x, y);
  context.closePath();
}

class Asteroid {
  constructor({ position, velocity, radius, damage = 0 }) {
    this.position = position;
    this.velocity = velocity;
    this.radius = radius;
    this.damage = damage;

    if (this.radius > HIT_DAMAGE) {
      console.log("Bigger", this.radius, " / ", this.damage);
    } else {
      console.warn("SMALLER", this.radius, " / ", this.damage);
    }
  }

  setDamage() {
    this.damage += HIT_DAMAGE;
  }

  getDamage() {
    return this.damage;
  }

  draw() {
    const percent = 100 - Math.floor((this.damage / this.radius) * 100);

    let color = "white";

    if (percent < 50) {
      color = "red";
    } else if (percent < 70) {
      color = "yellow";
    }

    // context.save();
    context.beginPath();
    context.arc(
      this.position.x,
      this.position.y,
      this.radius,
      0,
      Math.PI * 2,
      false
    );
    context.strokeStyle = color;
    context.stroke();
    context.closePath();

    // Add % for big asteroids
    if (this.radius > HIT_DAMAGE) {
      renderCenteredText({
        text: 100 - Math.floor((this.damage / this.radius) * 100) + "%",
        x: this.position.x,
        y: this.position.y,
        font: "12px Verdana",
        color,
      });
    }
  }

  update() {
    this.draw();
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;
    // console.log("Asteroid pos", this.position.x, this.position.y);
  }
}

class Projectile {
  constructor({ position, velocity }) {
    this.position = position;
    this.velocity = velocity;
    this.radius = 5;
  }

  draw() {
    context.beginPath();
    context.arc(
      this.position.x,
      this.position.y,
      this.radius,
      0,
      Math.PI * 2,
      false
    );
    context.fillStyle = "white";
    context.fill();
    context.closePath();
  }

  update() {
    this.draw();
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;
    // console.log("projectile pos", this.position.x, this.position.y);
  }
}

class Player {
  constructor({ position, velocity }) {
    this.position = position;
    this.velocity = velocity;
    this.rotation = 0;
  }

  draw() {
    context.save();
    context.translate(this.position.x, this.position.y);
    context.rotate(this.rotation);
    context.translate(-this.position.x, -this.position.y);

    context.beginPath();
    context.arc(this.position.x, this.position.y, 5, 0, Math.PI * 2, false);
    context.closePath();
    context.fillStyle = "red";
    context.fill();

    context.beginPath();
    context.moveTo(this.position.x + 30, this.position.y);
    context.lineTo(this.position.x - 10, this.position.y - 10);
    context.lineTo(this.position.x - 10, this.position.y + 10);

    context.closePath();
    context.strokeStyle = "white";
    context.stroke();
    context.restore();
  }

  update() {
    this.draw();
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    if (this.position.x > canvas.width) {
      this.position.x = 0;
    } else if (this.position.x < 0) {
      this.position.x = canvas.width;
    }

    if (this.position.y > canvas.height) {
      this.position.y = 0;
    } else if (this.position.y < 0) {
      this.position.y = canvas.height;
    }
  }

  getVertices() {
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);

    return [
      {
        x: this.position.x + cos * 30 - sin * 0,
        y: this.position.y + sin * 30 + cos * 0,
      },
      {
        x: this.position.x + cos * -10 - sin * 10,
        y: this.position.y + sin * -10 + cos * 10,
      },
      {
        x: this.position.x + cos * -10 - sin * -10,
        y: this.position.y + sin * -10 + cos * -10,
      },
    ];
  }
}

function circleTriangleCollision(circle, triangle) {
  // Check if the circle is colliding with any of the triangle's edges
  for (let i = 0; i < 3; i++) {
    let start = triangle[i];
    let end = triangle[(i + 1) % 3];

    let dx = end.x - start.x;
    let dy = end.y - start.y;
    let length = Math.sqrt(dx * dx + dy * dy);

    let dot =
      ((circle.position.x - start.x) * dx +
        (circle.position.y - start.y) * dy) /
      Math.pow(length, 2);

    let closestX = start.x + dot * dx;
    let closestY = start.y + dot * dy;

    if (!isPointOnLineSegment(closestX, closestY, start, end)) {
      closestX = closestX < start.x ? start.x : end.x;
      closestY = closestY < start.y ? start.y : end.y;
    }

    dx = closestX - circle.position.x;
    dy = closestY - circle.position.y;

    let distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= circle.radius) {
      return true;
    }
  }

  // No collision
  return false;
}

function isPointOnLineSegment(x, y, start, end) {
  return (
    x >= Math.min(start.x, end.x) &&
    x <= Math.max(start.x, end.x) &&
    y >= Math.min(start.y, end.y) &&
    y <= Math.max(start.y, end.y)
  );
}

function renderScore() {
  renderText({
    text: `${playerPoints} ${MESSAGE_POINTS}`,
    font: "30px Verdana",
    x: 50,
    y: 50,
  });
}

window.addEventListener("keydown", (e) => {
  switch (e.code) {
    case "KeyW":
      keys.w.pressed = true;
      break;
    case "KeyA":
      keys.a.pressed = true;
      break;
    case "KeyS":
      keys.s.pressed = true;
      break;
    case "KeyD":
      keys.d.pressed = true;
      break;
    case "KeyP":
      keys.p.pressed = !keys.p.pressed;
      break;
    case "Enter":
      window.cancelAnimationFrame(animationId);
      isPaused = false;
      isGameOver = false;
      startGame();
      break;
    case "Space":
      projectiles.push(
        new Projectile({
          position: {
            x: player.position.x + Math.cos(player.rotation) * 31,
            y: player.position.y + Math.sin(player.rotation) * 31,
          },
          velocity: {
            x: Math.cos(player.rotation) * PROJECTILE_SPEED,
            y: Math.sin(player.rotation) * PROJECTILE_SPEED,
          },
        })
      );
      break;
  }
});

window.addEventListener("keyup", (e) => {
  switch (e.code) {
    case "KeyW":
      keys.w.pressed = false;
      break;
    case "KeyA":
      keys.a.pressed = false;
      break;
    case "KeyS":
      keys.s.pressed = false;
      break;
    case "KeyD":
      keys.d.pressed = false;
      break;
    // case "Enter":
    //   keys.enter.pressed = false;
    //   break;

    default:
      break;
  }
});

function addAsteroid() {
  const minHeight = canvas.height * 0.1;
  const maxHeight = canvas.height * 0.9;

  const side = Math.floor(Math.random() * POSSIBLE_SIDES);
  const xRand = Math.random() * canvas.width;
  const yRand = Math.random() * (maxHeight - minHeight) + minHeight;
  const radius = 50 * Math.random() + 10;
  let x, y, vx, vy;

  const randSecondaryVelocity = Math.random() * (0.9 - -0.5) + -0.5;

  switch (side) {
    case 0: // left
      x = side - radius;
      y = yRand;
      vx = 1;
      vy = randSecondaryVelocity;
      break;

    case 1: // bottom
      x = xRand;
      y = canvas.height + radius;
      vx = randSecondaryVelocity;
      vy = -1;
      break;

    case 2: // right
      x = canvas.width + radius;
      y = yRand;
      vx = -1;
      vy = randSecondaryVelocity;
      break;

    case 3: // top
    default:
      x = xRand;
      y = 0 - radius;
      vx = randSecondaryVelocity;
      vy = 1;
      break;
  }

  asteroids.push(
    new Asteroid({
      position: {
        x,
        y,
      },
      velocity: {
        x: vx,
        y: vy,
      },
      radius,
    })
  );
}

const asteroidsAnimationId = window.setInterval(() => {
  if (isPaused || keys.p.pressed) {
    return;
  }

  addAsteroid();
}, 1200);

function circleCollision(item1, item2) {
  const xDiff = item2.position.x - item1.position.x;
  const yDiff = item2.position.y - item1.position.y;

  const distance = Math.sqrt(xDiff * xDiff + yDiff * yDiff);

  if (distance <= item1.radius + item2.radius) {
    console.log("Colision");
    return true;
  }

  return false;
}

function drawProjectiles() {
  if (projectiles.length > 0) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const projectile = projectiles[i];
      projectile.update();

      // Remove not visible projectiles
      if (
        projectile.position.x + projectile.radius < 0 ||
        projectile.position.x - projectile.radius > canvas.width ||
        projectile.position.y - projectile.radius > canvas.height ||
        projectile.position.y + projectile.radius < 0
      ) {
        projectiles.splice(i, 1);
      }
    }
  }
}

function drawAsteroids() {
  if (asteroids.length > 0) {
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const asteroid = asteroids[i];
      asteroid.update();

      if (circleTriangleCollision(asteroid, player.getVertices())) {
        isGameOver = true;
        return;
      }

      // Remove not visible projectiles
      if (
        asteroid.position.x + asteroid.radius < 0 ||
        asteroid.position.x - asteroid.radius > canvas.width ||
        asteroid.position.y - asteroid.radius > canvas.height ||
        asteroid.position.y + asteroid.radiusd < 0
      ) {
        asteroids.splice(i, 1);
      }

      // Hits
      for (let j = projectiles.length - 1; j >= 0; j--) {
        const projectile = projectiles[j];
        if (circleCollision(projectile, asteroid)) {
          //   asteroids.splice(i, 1);
          // remove projectile
          projectiles.splice(j, 1);

          asteroid.setDamage();

          if (asteroid.getDamage() >= asteroid.radius) {
            playerPoints += Math.floor(asteroid.radius / 10);
            asteroids.splice(i, 1);
          }

          return;
        }
      }
    }
  }
}

function handlePlayerControls() {
  if (isGameOver) return;

  if (keys.w.pressed) {
    player.velocity.x = Math.cos(player.rotation) * SPEED;
    player.velocity.y = Math.sin(player.rotation) * SPEED;
  } else {
    player.velocity.x *= FRICTION;
    player.velocity.y *= FRICTION;
  }

  if (keys.d.pressed) {
    player.rotation += ROTATIONAL_SPEED;
  } else if (keys.a.pressed) {
    player.rotation -= ROTATIONAL_SPEED;
  }
}

function drawGameOver() {
  context.beginPath();
  context.rect(centerX - 240, centerY - 120, 480, 240);
  context.closePath();
  context.fillStyle = "black";
  context.fill();
  context.strokeStyle = "white";
  context.stroke();

  renderCenteredText({
    text: MESSAGE_GAME_OVER.toUpperCase(),
    x: centerX,
    y: centerY - 10,
    font: "40px Verdana",
  });

  renderCenteredText({
    text: MESSAGE_GAME_OVER_INSTRUCTIONS,
    x: centerX,
    y: centerY + 50,
    font: "20px Verdana",
  });
}

function drawAlert(text, subtext = "") {
  context.beginPath();
  context.rect(centerX - 240, centerY - 120, 480, 240);
  context.closePath();
  context.fillStyle = "black";
  context.fill();
  context.strokeStyle = "white";
  context.stroke();

  renderCenteredText({
    text: text,
    x: centerX,
    y: centerY - 10,
    font: "40px Verdana",
  });

  if (subtext.length > 0) {
    renderCenteredText({
      text: subtext,
      x: centerX,
      y: centerY + 50,
      font: "20px Verdana",
    });
  }
}

function animate() {
  animationId = window.requestAnimationFrame(animate);

  if (!isGameOver && (isPaused || keys.p.pressed)) {
    drawAlert(MESSAGE_PAUSE.toUpperCase(), MESSAGE_PAUSE_INSTRUCTIONS);
    return;
  }

  handlePlayerControls();

  if (isGameOver) {
    drawGameOver();
    return;
  }

  updateBackground();
  renderScore();
  renderCenteredText({
    text: "Controls: A: Turn left / D: Turn right / W: Move Forward / SPACE: Shot / P: Pause",
    font: "15px Verdana",
    x: centerX, 
    y: canvas.height - 50,
  })

  player.update();

  // Projectiles management
  drawProjectiles();

  // Asteroids management
  drawAsteroids();
}

function startGame() {
  player = new Player({
    position: { x: centerX, y: centerY },
    velocity: { x: 0, y: 0 },
  });

  playerPoints = 0;

  projectiles.splice(0, projectiles.length - 1);
  asteroids.splice(0, asteroids.length - 1);

  addAsteroid();

  setTimeout(() => {
    addAsteroid();
  }, 50);

  setTimeout(() => {
    addAsteroid();
  }, 150);

  setTimeout(() => {
    addAsteroid();
  }, 250);

  animate();
}

window.onblur = function (e) {
  isPaused = true;
};

window.onfocus = function (e) {
  isPaused = false;
};

startGame();
