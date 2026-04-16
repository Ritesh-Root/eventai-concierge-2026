/**
 * @fileoverview Rich fake event data for demo purposes.
 * Represents InnovateSphere 2026 — a full-day tech conference with sessions,
 * speakers, booths, food, parking, restrooms, accessibility features, and
 * map coordinates so the UI can render an interactive floor plan.
 * @module utils/eventData
 */

const eventData = {
  name: 'InnovateSphere 2026',
  tagline: 'Where Ideas Converge',
  date: '2026-05-17',
  doorsOpen: '08:00',
  doorsClose: '18:30',

  venue: {
    name: 'Meridian Convention Centre',
    address: '1200 Innovation Drive, Bengaluru, Karnataka 560100',
    floors: 3,
    totalCapacity: 2500,
    mapBox: { width: 1000, height: 600 },
  },

  wifi: {
    network: 'InnovateSphere-Guest',
    password: 'Sphere2026!',
    helpDesk: 'Visit the Info Kiosk near Gate A for connectivity issues.',
  },

  emergency: {
    securityDesk: 'Ground Floor, Gate B — available 24/7 during the event.',
    medicalRoom: 'Room G-04, Ground Floor (staffed paramedic on site).',
    emergencyNumber: '112',
    evacuationPoints: [
      'Gate A — Main Entrance (Ground Floor)',
      'Gate C — East Wing Exit (Ground Floor)',
      'Terrace Stairwell D (Floors 1-3)',
    ],
    assemblyPoint: 'Parking Lot P1 — marked with yellow flags.',
  },

  sessions: [
    {
      id: 'S1',
      time: '09:00–09:45',
      title: 'Opening Keynote: The Ambient AI Era',
      speaker: 'Dr. Kavitha Rajan',
      speakerTitle: 'Chief Scientist, NeuralWave Labs',
      room: 'Grand Hall A',
      floor: 1,
      track: 'Keynote',
      tags: ['ai', 'vision', 'keynote'],
      capacity: 800,
      description:
        'A keynote exploring how ambient intelligence — AI that fades into the background — is reshaping work, home, and cities.',
      accessibility:
        'Wheelchair-accessible seating in rows 1-3; live captions on screen; sign-language interpreter available.',
      map: { floor: 1, x: 180, y: 220, label: 'Grand Hall A' },
    },
    {
      id: 'S2',
      time: '10:00–10:45',
      title: 'Building Responsible LLM Applications',
      speaker: 'Arjun Mehta',
      speakerTitle: 'Principal Engineer, Anthropic Alumni',
      room: 'Room 201',
      floor: 2,
      track: 'AI & Ethics',
      tags: ['ai', 'llm', 'ethics', 'safety'],
      capacity: 150,
      description:
        'Practical patterns for evaluation, guardrails, observability, and policy compliance in LLM-powered products.',
      accessibility:
        'Elevator access from lobby; assistive listening devices at entrance.',
      map: { floor: 2, x: 200, y: 180, label: 'Room 201' },
    },
    {
      id: 'S3',
      time: '11:00–11:45',
      title: 'Edge Computing for Real-Time Analytics',
      speaker: 'Priya Nair',
      speakerTitle: 'Staff Engineer, Cloudflare',
      room: 'Room 202',
      floor: 2,
      track: 'Infrastructure',
      tags: ['edge', 'analytics', 'infra'],
      capacity: 150,
      description:
        'How to push inference and aggregation to the edge without sacrificing consistency — case studies from global rollouts.',
      accessibility: 'Step-free access; reserved front-row seating.',
      map: { floor: 2, x: 380, y: 180, label: 'Room 202' },
    },
    {
      id: 'S4',
      time: '12:00–13:00',
      title: 'Networking Lunch',
      speaker: 'All Attendees',
      speakerTitle: '',
      room: 'Garden Pavilion',
      floor: 1,
      track: 'Break',
      tags: ['lunch', 'networking', 'break'],
      capacity: 2500,
      description:
        'Buffet lunch in the Garden Pavilion. Vegan, vegetarian, and gluten-free options available. Allergy cards at every counter.',
      accessibility:
        'Step-free access; low-height counters at Station 4; braille menu available at Info Desk.',
      map: { floor: 1, x: 640, y: 220, label: 'Garden Pavilion' },
    },
    {
      id: 'S5',
      time: '13:00–13:45',
      title: 'Design Systems at Scale',
      speaker: 'Liam Chen',
      speakerTitle: 'Design Lead, Figma',
      room: 'Workshop Lab B',
      floor: 1,
      track: 'Design',
      tags: ['design', 'systems', 'frontend'],
      capacity: 80,
      description:
        'Building, versioning, and governing design systems across 100+ product teams — tooling, tokens, and governance models.',
      accessibility:
        'Adjustable-height tables; screen magnification on presenter display.',
      map: { floor: 1, x: 420, y: 220, label: 'Workshop Lab B' },
    },
    {
      id: 'S6',
      time: '14:00–14:45',
      title: 'Securing Cloud-Native Microservices',
      speaker: 'Fatima Al-Sayed',
      speakerTitle: 'Security Architect, Snyk',
      room: 'Room 301',
      floor: 3,
      track: 'Security',
      tags: ['security', 'cloud', 'microservices'],
      capacity: 120,
      description:
        'Zero-trust service mesh, workload identity, supply-chain scanning, and runtime policy — a hardened deployment walkthrough.',
      accessibility:
        'Elevator access; hearing loop installed; materials available in large print.',
      map: { floor: 3, x: 240, y: 200, label: 'Room 301' },
    },
    {
      id: 'S7',
      time: '15:00–15:30',
      title: 'Lightning Talks: Dev Tools of 2026',
      speaker: 'Community Panel',
      speakerTitle: '',
      room: 'Room 202',
      floor: 2,
      track: 'Developer Tools',
      tags: ['devtools', 'lightning'],
      capacity: 150,
      description:
        'Five 5-minute talks on the tools reshaping day-to-day development in 2026.',
      accessibility: 'Step-free access; live captions.',
      map: { floor: 2, x: 380, y: 180, label: 'Room 202' },
    },
    {
      id: 'S8',
      time: '15:30–16:30',
      title: 'Closing Panel: Tech for Social Good',
      speaker: 'Panel — moderated by Ravi Sharma',
      speakerTitle: 'Editor, TechPlus',
      room: 'Grand Hall A',
      floor: 1,
      track: 'Keynote',
      tags: ['social-good', 'keynote', 'panel'],
      capacity: 800,
      description:
        'Civic tech, climate, and accessibility leaders debate where AI should — and should not — go next.',
      accessibility:
        'Full wheelchair access; live captions; sign-language interpreter; quiet seating zone at rear.',
      map: { floor: 1, x: 180, y: 220, label: 'Grand Hall A' },
    },
    {
      id: 'S9',
      time: '16:45–17:30',
      title: 'Evening Reception',
      speaker: 'All Attendees',
      speakerTitle: '',
      room: 'Terrace Garden',
      floor: 3,
      track: 'Social',
      tags: ['reception', 'networking', 'social'],
      capacity: 600,
      description:
        'Drinks, canapés, and live acoustic music on the open-air terrace. Mocktail bar and allergen-safe station available.',
      accessibility:
        'Elevator access to Floor 3; covered section for weather; low-tables at east end.',
      map: { floor: 3, x: 620, y: 200, label: 'Terrace Garden' },
    },
  ],

  booths: [
    { id: 'B1', name: 'Google Cloud AI', location: 'Expo Hall, Aisle 1', category: 'Cloud & AI', perks: 'Live demos of Gemini; raffle for Pixel devices.', map: { floor: 1, x: 780, y: 120, label: 'Google Cloud' } },
    { id: 'B2', name: 'Vercel', location: 'Expo Hall, Aisle 1', category: 'Developer Tools', perks: 'On-site deploy challenge; free hoodies for first 100.', map: { floor: 1, x: 860, y: 120, label: 'Vercel' } },
    { id: 'B3', name: 'Figma', location: 'Expo Hall, Aisle 2', category: 'Design', perks: 'Portfolio reviews every 30 min.', map: { floor: 1, x: 780, y: 220, label: 'Figma' } },
    { id: 'B4', name: 'Snyk', location: 'Expo Hall, Aisle 2', category: 'Security', perks: 'Free supply-chain security audit for OSS maintainers.', map: { floor: 1, x: 860, y: 220, label: 'Snyk' } },
    { id: 'B5', name: 'MongoDB', location: 'Expo Hall, Aisle 3', category: 'Databases', perks: 'Vector search workshop at 11:30 and 14:30.', map: { floor: 1, x: 780, y: 320, label: 'MongoDB' } },
    { id: 'B6', name: 'Stripe', location: 'Expo Hall, Aisle 3', category: 'Fintech', perks: 'Stripe swag pack with live API demos.', map: { floor: 1, x: 860, y: 320, label: 'Stripe' } },
    { id: 'B7', name: 'Notion', location: 'Expo Hall, Aisle 4', category: 'Productivity', perks: '3-month Pro codes for students.', map: { floor: 1, x: 780, y: 420, label: 'Notion' } },
    { id: 'B8', name: 'Arduino', location: 'Expo Hall, Aisle 4', category: 'Hardware & IoT', perks: 'Hands-on robotics stations for all ages.', map: { floor: 1, x: 860, y: 420, label: 'Arduino' } },
    { id: 'B9', name: 'Hugging Face', location: 'Expo Hall, Aisle 5', category: 'ML & Models', perks: 'Model fine-tuning consults; sticker wall.', map: { floor: 1, x: 780, y: 500, label: 'Hugging Face' } },
    { id: 'B10', name: 'GitHub', location: 'Expo Hall, Aisle 5', category: 'Developer Tools', perks: 'Copilot hackathon bracket; Octocat plushies.', map: { floor: 1, x: 860, y: 500, label: 'GitHub' } },
  ],

  quietZones: [
    { name: 'Zen Lounge', floor: 1, location: 'West Wing — near the indoor garden.', amenities: 'Comfortable seating, dim lighting, phone-free zone.', map: { floor: 1, x: 80, y: 400, label: 'Zen Lounge' } },
    { name: 'Focus Pod Area', floor: 2, location: 'East Corridor — individual sound-dampened pods.', amenities: 'Power outlets, adjustable lighting, bookable in 30-min slots at Info Kiosk.', map: { floor: 2, x: 720, y: 380, label: 'Focus Pods' } },
    { name: 'Terrace Garden', floor: 3, location: 'Open-air terrace — covered section available.', amenities: 'Fresh air, bench seating, water station.', map: { floor: 3, x: 620, y: 200, label: 'Terrace Garden' } },
  ],

  foodAndDrink: [
    { name: 'Barista Bar', floor: 1, location: 'Main Lobby — opposite Info Kiosk.', hours: '08:00–17:30', dietary: 'Oat, soy, almond milk. Decaf and matcha available.' },
    { name: 'Street Food Court', floor: 1, location: 'Garden Pavilion — lunch hours.', hours: '12:00–14:30', dietary: 'Vegan, vegetarian, gluten-free, halal stations clearly marked.' },
    { name: 'Snack Island', floor: 2, location: 'Central atrium, opposite elevator bank.', hours: '10:00–17:00', dietary: 'Nut-free zone; allergen cards on each tray.' },
    { name: 'Hydration Stations', floor: 'All', location: 'Every floor near elevators.', hours: 'All day', dietary: 'Still and sparkling water; bring your own bottle.' },
  ],

  parkingAndTransit: [
    { type: 'Parking — P1', capacity: 400, location: 'Main lot, Gate A entrance.', accessible: '20 designated accessible bays, level access to Gate A.' },
    { type: 'Parking — P2', capacity: 250, location: 'Overflow lot, 3-min shuttle from Gate C.', accessible: 'Shuttle has ramp access; runs every 7 minutes.' },
    { type: 'EV Charging', capacity: 24, location: 'P1, rows 3-4. CCS2 and Type-2 connectors.', accessible: 'Two bays are wheelchair-accessible.' },
    { type: 'Metro', capacity: null, location: 'Meridian Metro (Purple Line) — 6-min covered walk via Skybridge from Gate A.', accessible: 'Skybridge is step-free with tactile paving.' },
    { type: 'Rideshare Pickup', capacity: null, location: 'Gate B curb, clearly signposted.', accessible: 'Dropped kerb and seating at pickup zone.' },
  ],

  restrooms: [
    { floor: 0, location: 'Ground Floor, near Gate A & Gate B. Accessible and all-gender facilities available.' },
    { floor: 1, location: 'Floor 1 — between Grand Hall A and Workshop Lab B. Baby-change room adjacent.' },
    { floor: 2, location: 'Floor 2 — opposite Room 201. All-gender accessible stall.' },
    { floor: 3, location: 'Floor 3 — opposite Room 301 and near Terrace Garden entrance.' },
  ],

  lostAndFound: {
    location: 'Info Kiosk near Gate A, Ground Floor.',
    hours: '08:00–18:30',
    note: 'Unclaimed items are held for 30 days — email lostfound@innovatesphere.example.',
  },

  wheelchairAccessibleRoutes: [
    { name: 'Main Concourse Route', description: 'From Gate A entrance, proceed straight through the ground-floor lobby. Take the central elevator bank to any floor. All session rooms on Floors 1-2 are reachable without stairs. Width ≥ 1.5 m throughout.' },
    { name: 'Expo Hall Loop', description: 'Enter the Expo Hall via the wide double doors near Gate B. All aisles are ≥ 2 m wide with smooth flooring. Accessible restrooms are located at both ends of the hall.' },
    { name: 'Terrace Route', description: 'From any floor, use the East Elevator to Floor 3. Exit right for the Terrace Garden — the threshold is level and the covered section has bench seating with arm rests.' },
  ],

  accessibility: {
    serviceAnimals: 'Fully welcome. Water bowls available at every Info Kiosk.',
    signLanguage: 'ISL and ASL interpreters for all keynote sessions — front-row reserved area.',
    sensoryRoom: 'Floor 1, near Zen Lounge — low stimulation space with adjustable lighting.',
    assistiveListening: 'Available at every main stage; ask at Info Kiosk.',
    largePrint: 'Printed programs in 18pt available at the Info Kiosk.',
    captioning: 'Live captions on-screen for all keynote and panel sessions.',
  },

  infoKiosks: [
    { id: 'K1', location: 'Ground Floor — Gate A Main Entrance', staffed: '08:00–18:30' },
    { id: 'K2', location: 'Floor 1 — Expo Hall entrance', staffed: '09:00–17:00' },
    { id: 'K3', location: 'Floor 2 — Central atrium', staffed: '09:00–17:00' },
  ],

  sponsors: ['Google Cloud', 'Vercel', 'Figma', 'Snyk', 'MongoDB', 'Stripe', 'GitHub', 'Hugging Face'],
};

module.exports = eventData;
