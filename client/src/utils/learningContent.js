export const experimentTemplates = [
  {
    id: 'pendulum',
    topic: 'Oscillations',
    name: 'Pendulum',
    description: 'A bob suspended from a fixed point to study periodic motion.',
    bodies: [
      {
        networkId: 'template-pendulum-bob',
        type: 'circle',
        x: 420,
        y: 280,
        radius: 28,
        mass: 3,
        friction: 0.02,
        restitution: 0.2,
        color: '#38bdf8'
      }
    ],
    constraints: [
      {
        id: 'template-pendulum-pivot',
        type: 'pivot',
        bodyA: 'template-pendulum-bob',
        pointA: { x: 400, y: 120 },
        pointB: { x: 0, y: 0 },
        length: 170
      }
    ]
  },
  {
    id: 'spring-mass',
    topic: 'Oscillations',
    name: 'Spring Mass',
    description: 'Two bodies connected by an elastic spring for observing restoring force.',
    bodies: [
      {
        networkId: 'template-spring-anchor',
        type: 'box',
        x: 300,
        y: 160,
        width: 70,
        height: 35,
        isStatic: true,
        color: '#64748b'
      },
      {
        networkId: 'template-spring-mass',
        type: 'circle',
        x: 520,
        y: 220,
        radius: 32,
        mass: 4,
        friction: 0.03,
        restitution: 0.35,
        color: '#a3e635'
      }
    ],
    constraints: [
      {
        id: 'template-spring-link',
        type: 'spring',
        bodyA: 'template-spring-anchor',
        bodyB: 'template-spring-mass'
      }
    ]
  },
  {
    id: 'collision',
    topic: 'Collisions',
    name: 'Collision Pair',
    description: 'Two bodies set up for comparing mass, restitution, and kinetic energy transfer.',
    bodies: [
      {
        networkId: 'template-collision-heavy',
        type: 'circle',
        x: 260,
        y: 160,
        radius: 34,
        mass: 6,
        friction: 0.02,
        restitution: 0.8,
        color: '#f97316'
      },
      {
        networkId: 'template-collision-light',
        type: 'circle',
        x: 540,
        y: 160,
        radius: 26,
        mass: 1.5,
        friction: 0.02,
        restitution: 0.8,
        color: '#f472b6'
      }
    ],
    constraints: []
  },
  {
    id: 'projectile',
    topic: 'Motion',
    name: 'Projectile Drop',
    description: 'A raised body for measuring falling motion, height, and speed.',
    bodies: [
      {
        networkId: 'template-projectile-platform',
        type: 'box',
        x: 220,
        y: 430,
        width: 180,
        height: 24,
        isStatic: true,
        color: '#64748b'
      },
      {
        networkId: 'template-projectile-body',
        type: 'circle',
        x: 220,
        y: 140,
        radius: 28,
        mass: 2,
        friction: 0.05,
        restitution: 0.55,
        color: '#38bdf8'
      }
    ],
    constraints: []
  },
  {
    id: 'spring-chain',
    topic: 'Waves',
    name: 'Spring Chain',
    description: 'Three masses linked by springs to compare coupled oscillations.',
    bodies: [
      {
        networkId: 'template-chain-a',
        type: 'circle',
        x: 270,
        y: 180,
        radius: 24,
        mass: 2,
        color: '#38bdf8'
      },
      {
        networkId: 'template-chain-b',
        type: 'circle',
        x: 400,
        y: 180,
        radius: 24,
        mass: 2,
        color: '#a3e635'
      },
      {
        networkId: 'template-chain-c',
        type: 'circle',
        x: 530,
        y: 180,
        radius: 24,
        mass: 2,
        color: '#f472b6'
      }
    ],
    constraints: [
      {
        id: 'template-chain-ab',
        type: 'spring',
        bodyA: 'template-chain-a',
        bodyB: 'template-chain-b'
      },
      {
        id: 'template-chain-bc',
        type: 'spring',
        bodyA: 'template-chain-b',
        bodyB: 'template-chain-c'
      }
    ]
  }
];

export const lessonChapters = [
  {
    id: 'pendulums',
    title: 'Pendulums',
    templateId: 'pendulum',
    summary: 'Explore how a constrained bob trades height for speed.',
    steps: [
      {
        goal: 'Load the pendulum setup.',
        hint: 'Use the setup button, then turn on the grid to measure the bob height.'
      },
      {
        goal: 'Pause, drag the bob sideways, and release.',
        hint: 'The pivot constrains distance from the support point, creating an arc.'
      },
      {
        goal: 'Watch kinetic energy rise near the bottom of the swing.',
        hint: 'Gravitational potential energy is converted into kinetic energy.'
      }
    ]
  },
  {
    id: 'springs',
    title: 'Springs',
    templateId: 'spring-mass',
    summary: 'See how restoring force creates repeated oscillation.',
    steps: [
      {
        goal: 'Load the spring mass setup.',
        hint: 'A spring pulls harder the farther it is stretched from rest length.'
      },
      {
        goal: 'Drag the mass away from the anchor and release it.',
        hint: 'The mass overshoots because it keeps momentum after crossing equilibrium.'
      },
      {
        goal: 'Increase mass in Object Properties and compare the motion.',
        hint: 'A heavier mass tends to change acceleration more slowly under the same force.'
      }
    ]
  },
  {
    id: 'collisions',
    title: 'Collisions',
    templateId: 'collision',
    summary: 'Compare momentum transfer and energy loss in impacts.',
    steps: [
      {
        goal: 'Load the collision pair and set both restitution values high.',
        hint: 'Restitution near 1 makes collisions bouncier.'
      },
      {
        goal: 'Drag one circle into the other and observe the flash point.',
        hint: 'The collision flash marks where the contact impulse happened.'
      },
      {
        goal: 'Lower restitution and repeat.',
        hint: 'Less bounce means more kinetic energy is dissipated during impact.'
      }
    ]
  }
];

export const predictionCards = [
  {
    id: 'pendulum-speed',
    lessonId: 'pendulums',
    prompt: 'When a pendulum bob passes the bottom of its arc, what should be largest?',
    options: [
      'Its kinetic energy',
      'Its height above the floor',
      'Its friction'
    ],
    answerIndex: 0,
    explanation: 'At the bottom, gravitational potential energy has mostly become kinetic energy, so speed and kinetic energy are highest.'
  },
  {
    id: 'spring-release',
    lessonId: 'springs',
    prompt: 'If a stretched spring mass is released, what happens first?',
    options: [
      'It accelerates back toward equilibrium',
      'It stops immediately',
      'It becomes static'
    ],
    answerIndex: 0,
    explanation: 'The spring applies a restoring force toward equilibrium, so the mass accelerates in that direction.'
  },
  {
    id: 'collision-restitution',
    lessonId: 'collisions',
    prompt: 'What does higher restitution usually make a collision do?',
    options: [
      'Bounce more',
      'Stick more',
      'Remove gravity'
    ],
    answerIndex: 0,
    explanation: 'Restitution controls how much normal velocity is preserved after impact; higher values make bodies rebound more.'
  }
];

export const quizQuestions = [
  {
    id: 'ke-formula',
    question: 'Which formula matches kinetic energy?',
    options: ['0.5 x mass x speed^2', 'mass x height', 'force / area'],
    answerIndex: 0
  },
  {
    id: 'spring-force',
    question: 'What does a spring constraint try to do?',
    options: ['Restore its rest length', 'Delete gravity', 'Make bodies static'],
    answerIndex: 0
  },
  {
    id: 'restitution',
    question: 'A restitution value closer to 1 means the body is...',
    options: ['Bouncier', 'Heavier', 'More transparent'],
    answerIndex: 0
  }
];

export const glossaryTerms = [
  {
    term: 'Kinetic energy',
    definition: 'Energy of motion. In the dashboard it is estimated with KE = 0.5 x mass x speed^2.'
  },
  {
    term: 'Restitution',
    definition: 'A bounciness value. Higher restitution preserves more velocity after collision.'
  },
  {
    term: 'Constraint',
    definition: 'A rule that restricts motion, such as a rod, string, spring, or pivot connection.'
  },
  {
    term: 'Gravity',
    definition: 'A constant acceleration downward in this lab, making unsupported bodies fall.'
  },
  {
    term: 'Friction',
    definition: 'A contact effect that resists sliding motion between surfaces.'
  },
  {
    term: 'Mass',
    definition: 'A measure of inertia. More mass needs more force to accelerate by the same amount.'
  }
];
