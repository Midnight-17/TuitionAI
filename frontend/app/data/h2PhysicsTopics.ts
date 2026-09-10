export type H2PhysicsTopic = {
  section: string
  topicNumber: number
  topic: string
  subtopics: string[]
}

// Source: Singapore-Cambridge GCE A-Level H2 Physics syllabus 9478 (2027).
export const h2PhysicsTopics: H2PhysicsTopic[] = [
  {
    section: "Foundations of Physics",
    topicNumber: 1,
    topic: "Quantities and Measurement",
    subtopics: [
      "Physical quantities and SI units",
      "Errors and uncertainties",
      "Scalars and vectors",
    ],
  },
  {
    section: "Foundations of Physics",
    topicNumber: 2,
    topic: "Forces and Moments",
    subtopics: [
      "Types of force",
      "Moment and torque",
      "Translational and rotational equilibrium",
    ],
  },
  {
    section: "Foundations of Physics",
    topicNumber: 3,
    topic: "Motion and Forces",
    subtopics: [
      "Kinematics",
      "Uniformly accelerated linear motion",
      "Mass and linear momentum",
      "Laws of motion",
    ],
  },
  {
    section: "Foundations of Physics",
    topicNumber: 4,
    topic: "Energy and Fields",
    subtopics: [
      "Energy stores and transfers",
      "Work done by a force",
      "Kinetic energy",
      "Concept of a field",
      "Potential energy",
      "Power and efficiency",
    ],
  },
  {
    section: "Mechanics",
    topicNumber: 5,
    topic: "Projectile Motion",
    subtopics: [
      "Free fall",
      "Gravitational potential energy in a uniform field",
      "Effects of air resistance",
    ],
  },
  {
    section: "Mechanics",
    topicNumber: 6,
    topic: "Collisions",
    subtopics: [
      "Impulse",
      "Conservation of momentum and energy",
    ],
  },
  {
    section: "Mechanics",
    topicNumber: 7,
    topic: "Circular Motion",
    subtopics: [
      "Kinematics of uniform circular motion",
      "Centripetal acceleration",
      "Newton's laws of gravitation",
      "Circular orbits",
    ],
  },
  {
    section: "Mechanics",
    topicNumber: 8,
    topic: "Gravitational Fields",
    subtopics: [
      "Gravitational field strength",
      "Gravitational potential",
      "Gravitational potential and energy",
      "Escape velocity and circular orbits",
    ],
  },
  {
    section: "Mechanics",
    topicNumber: 9,
    topic: "Oscillations",
    subtopics: [
      "Simple harmonic motion",
      "Energy in simple harmonic motion",
    ],
  },
  {
    section: "Waves",
    topicNumber: 10,
    topic: "Wave Motion",
    subtopics: [
      "Properties of waves",
      "Energy transfer by progressive waves",
      "Polarisation",
    ],
  },
  {
    section: "Waves",
    topicNumber: 11,
    topic: "Superposition",
    subtopics: [
      "Principle of superposition",
      "Standing waves",
      "Interference of two or more point sources",
      "Diffraction through a finite-size gap",
    ],
  },
  {
    section: "Thermal Physics",
    topicNumber: 12,
    topic: "Temperature and Ideal Gases",
    subtopics: [
      "Empirical gas laws",
      "Kinetic theory of gases",
    ],
  },
  {
    section: "Thermal Physics",
    topicNumber: 13,
    topic: "Thermodynamic Systems",
    subtopics: [
      "Internal energy",
      "Heating and work done",
      "Laws of thermodynamics",
      "Specific heat capacity and specific latent heat",
    ],
  },
  {
    section: "Electricity and Magnetism",
    topicNumber: 14,
    topic: "Electric Fields",
    subtopics: [
      "Coulomb's law",
      "Electric field strength",
      "Electric potential and energy",
      "Uniform electric fields",
      "Capacitance",
    ],
  },
  {
    section: "Electricity and Magnetism",
    topicNumber: 15,
    topic: "Currents",
    subtopics: [
      "Current and drift velocity",
      "Potential difference and power",
      "Power supplies: d.c. and a.c.",
    ],
  },
  {
    section: "Electricity and Magnetism",
    topicNumber: 16,
    topic: "Circuits",
    subtopics: [
      "Circuit symbols and diagrams",
      "Resistance, resistivity and internal resistance",
      "Resistors in series and parallel",
      "RC circuits with d.c. source",
    ],
  },
  {
    section: "Electricity and Magnetism",
    topicNumber: 17,
    topic: "Electromagnetism",
    subtopics: [
      "Magnetic fields and magnetic flux density due to currents",
      "Force on a current-carrying conductor",
      "Force on a moving charge",
    ],
  },
  {
    section: "Electricity and Magnetism",
    topicNumber: 18,
    topic: "Electromagnetic Induction",
    subtopics: [
      "Magnetic flux",
      "Faraday's and Lenz's laws of electromagnetic induction",
      "Power transformers",
    ],
  },
  {
    section: "Modern Physics",
    topicNumber: 19,
    topic: "Quantum Physics",
    subtopics: [
      "The particulate nature of light",
      "The wave nature of particles",
      "Quantisation of energy in matter",
    ],
  },
  {
    section: "Modern Physics",
    topicNumber: 20,
    topic: "Nuclear Physics",
    subtopics: [
      "The nuclear atom",
      "Radioactive decay",
      "Nuclear reactions",
      "Nuclear fission and fusion",
    ],
  },
]
