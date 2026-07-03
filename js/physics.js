// Matter.js engine + world + arena walls.
const { Engine, World, Bodies, Body, Composite } = Matter;

export function createPhysics() {
  // Sleeping lets settled balls stop integrating — kills idle jitter and saves CPU.
  const engine = Engine.create({ enableSleeping: true });
  engine.gravity.y = 1;
  engine.gravity.scale = 0.0011;

  // Positional iterations bumped up to prevent tunneling through walls.
  engine.positionIterations = 10;
  engine.velocityIterations = 8;
  engine.constraintIterations = 4;

  const world = engine.world;

  const walls = { left: null, right: null, floor: null, ceiling: null };
  const WALL = 60; // thick walls so fast balls never tunnel out

  function buildWalls(w, h) {
    for (const key of Object.keys(walls)) {
      if (walls[key]) World.remove(world, walls[key]);
    }
    const opts = { isStatic: true, restitution: 0.2, friction: 0.05, label: 'wall' };
    walls.left = Bodies.rectangle(-WALL / 2, h / 2, WALL, h * 3, opts);
    walls.right = Bodies.rectangle(w + WALL / 2, h / 2, WALL, h * 3, opts);
    walls.floor = Bodies.rectangle(w / 2, h + WALL / 2, w * 3, WALL, opts);
    // Ceiling sits well above so balls can arc high but never escape the top.
    walls.ceiling = Bodies.rectangle(w / 2, -WALL / 2 - 200, w * 3, WALL, opts);
    World.add(world, [walls.left, walls.right, walls.floor, walls.ceiling]);
  }

  function getBalls() {
    return Composite.allBodies(world).filter((b) => b.label === 'ball');
  }

  return { engine, world, buildWalls, getBalls };
}
