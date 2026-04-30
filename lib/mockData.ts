// =========================
// PLAYERS
// =========================
export const players = [
  {
    id: 1,
    rank: 1,
    name: "Guillaume",
    email: "guillaume.gillet@seenovate.com",
    elo: 1248,
    winRate: 42,
    games: 28,
    avgScore: 71,
    bestScore: 12,
    form: "5V",
    badge: "Champion actuel",
    status: "Champion actuel",
  },
  {
    id: 2,
    rank: 2,
    name: "Camille",
    email: "camille@seenovate.com",
    elo: 1216,
    winRate: 38,
    games: 24,
    avgScore: 76,
    bestScore: 18,
    form: "3V",
    badge: "Très régulière",
    status: "Très régulière",
  },
  {
    id: 3,
    rank: 3,
    name: "Thomas",
    email: "thomas@seenovate.com",
    elo: 1192,
    winRate: 35,
    games: 31,
    avgScore: 79,
    bestScore: 21,
    form: "2V",
    badge: "Joueur dangereux",
    status: "Joueur dangereux",
  },
  {
    id: 4,
    rank: 4,
    name: "Julie",
    email: "julie@seenovate.com",
    elo: 1168,
    winRate: 31,
    games: 22,
    avgScore: 84,
    bestScore: 25,
    form: "1V",
    badge: "En progression",
    status: "En progression",
  },
];

// =========================
// GAMES
// =========================
export const games = [
  {
    id: 1,
    date: "12/04/2026",
    location: "Bureau Lyon",
    players: 5,
    winner: "Guillaume",
    bestScore: 12,
    worstScore: 142,
    status: "Validée",
  },
  {
    id: 2,
    date: "09/04/2026",
    location: "Afterwork",
    players: 4,
    winner: "Camille",
    bestScore: 18,
    worstScore: 119,
    status: "Validée",
  },
  {
    id: 3,
    date: "04/04/2026",
    location: "Bureau Lyon",
    players: 6,
    winner: "Thomas",
    bestScore: 21,
    worstScore: 156,
    status: "Validée",
  },
  {
    id: 4,
    date: "28/03/2026",
    location: "Pause midi",
    players: 3,
    winner: "Julie",
    bestScore: 25,
    worstScore: 104,
    status: "À vérifier",
  },
];

// =========================
// RIVALRIES
// =========================
export const rivalries = [
  {
    playerA: "Guillaume",
    playerB: "Camille",
    games: 12,
    winsA: 7,
    winsB: 5,
    domination: "Guillaume",
    intensity: "Forte",
  },
  {
    playerA: "Thomas",
    playerB: "Julie",
    games: 9,
    winsA: 4,
    winsB: 5,
    domination: "Julie",
    intensity: "Équilibrée",
  },
  {
    playerA: "Guillaume",
    playerB: "Thomas",
    games: 15,
    winsA: 10,
    winsB: 5,
    domination: "Guillaume",
    intensity: "Dominée",
  },
];

// =========================
// SEASONS
// =========================
export const seasons = [
  {
    id: "V1",
    name: "Saison V1",
    period: "Mars 2026 — Juin 2026",
    games: 150,
    players: 55,
    leader: "Guillaume",
    status: "Active",
  },
  {
    id: "PRE",
    name: "Pré-saison",
    period: "Janvier 2026 — Février 2026",
    games: 42,
    players: 18,
    leader: "Camille",
    status: "Terminée",
  },
];