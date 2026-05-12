import { useEffect, useRef } from 'react';
import Matter from 'matter-js';
import { createWalls } from '../utils/physicsHelpers';

// Creates a Matter.js engine with a renderer attached to a wrapper div.
// Returns refs you can attach to a div and access the engine from.
export default function usePhysicsEngine(width = 800, height = 600) {
  const wrapperRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const runnerRef = useRef(null);
  const mouseConstraintRef = useRef(null);

  useEffect(() => {
    if (!wrapperRef.current) return undefined;

    // 1. Create the engine and tweak gravity
    const engine = Matter.Engine.create();
    engine.gravity.y = 1;
    engineRef.current = engine;

    // 2. Create the renderer
    const render = Matter.Render.create({
      element: wrapperRef.current,
      engine,
      options: {
        width,
        height,
        wireframes: false,
        background: '#0b0f1a'
      }
    });
    renderRef.current = render;
    render.canvas.style.touchAction = 'none';
    render.canvas.style.userSelect = 'none';
    render.canvas.style.webkitUserSelect = 'none';

    // 3. Add static walls so bodies stay inside the canvas
    Matter.World.add(engine.world, createWalls(width, height));

    // 4. Mouse drag interaction
    const mouse = Matter.Mouse.create(render.canvas);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse,
      constraint: {
        // Lower stiffness = softer spring between cursor and body.
        // This prevents the body from teleporting to the cursor instantly,
        // producing smoother, more controllable dragging.
        stiffness: 0.08,
        // Damping resists sudden velocity changes while dragging, removing
        // the jittery overshoot that high-stiffness constraints produce.
        damping: 0.12,
        render: { visible: false }
      }
    });
    Matter.World.add(engine.world, mouseConstraint);
    render.mouse = mouse;
    mouseConstraintRef.current = mouseConstraint;

    // 5. Run engine + render
    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);
    Matter.Render.run(render);
    runnerRef.current = runner;

    // 6. Cleanup on unmount
    return () => {
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.World.clear(engine.world, false);
      Matter.Engine.clear(engine);
      if (render.canvas && render.canvas.parentNode) {
        render.canvas.parentNode.removeChild(render.canvas);
      }
      render.textures = {};
    };
  }, [width, height]);

  return { wrapperRef, engineRef, renderRef, runnerRef, mouseConstraintRef };
}
