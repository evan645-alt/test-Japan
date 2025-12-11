
export enum MetalType {
  Mg = 'Mg', // New
  Ag = 'Ag',
  Cu = 'Cu',
  Pb = 'Pb',
  Fe = 'Fe', // New
  Zn = 'Zn',
}

export const METAL_POTENTIALS: Record<MetalType, number> = {
  [MetalType.Mg]: -2.37,
  [MetalType.Ag]: 0.80,
  [MetalType.Cu]: 0.34,
  [MetalType.Pb]: -0.13,
  [MetalType.Fe]: -0.44,
  [MetalType.Zn]: -0.76,
};

// Shared Layout Coordinates for Wiring Visualization
export const CIRCUIT_NODES: Record<NodeId, { x: number, y: number, color: string }> = {
    'v_pos': { x: 42, y: 15, color: '#dc2626' }, // Red
    'v_neg': { x: 58, y: 15, color: '#000000' }, // Black
    'c1_L': { x: 25, y: 68, color: '#eab308' },
    'c1_R': { x: 35, y: 68, color: '#eab308' },
    'c2_L': { x: 65, y: 68, color: '#eab308' },
    'c2_R': { x: 75, y: 68, color: '#eab308' },
};

export enum GamePhase {
  SETUP = 'SETUP',
  
  // Phase 1: Draw Components
  A_DRAW = 'A_DRAW',
  B_DRAW = 'B_DRAW',
  
  // Phase 2: Assembly
  A_ASSEMBLE = 'A_ASSEMBLE',
  B_ASSEMBLE = 'B_ASSEMBLE',
  
  // Phase 3: Wiring
  A_WIRING = 'A_WIRING',
  B_WIRING = 'B_WIRING',
  
  // Phase 4: Joint Draw
  JOINT_DRAW_ANIMATION = 'JOINT_DRAW_ANIMATION',

  // Phase 5: Battle Sequence
  // Round 1: Mandatory Attack (Card 1)
  B_ACTION_1 = 'B_ACTION_1', 
  A_ACTION_1 = 'A_ACTION_1', 
  
  // Round 2: Mandatory Buff (Card 2)
  B_ACTION_2 = 'B_ACTION_2', 
  A_ACTION_2 = 'A_ACTION_2',
  
  // Round 3: Flexible / Optional (Card 3)
  B_ACTION_3 = 'B_ACTION_3',
  A_ACTION_3 = 'A_ACTION_3',
  
  ROUND_SUMMARY = 'ROUND_SUMMARY', // Intermediate round end
  GAME_OVER = 'GAME_OVER' // Final Championship end
}

export interface CellConfig {
  id: number;
  metalL: MetalType | null;
  metalR: MetalType | null;
  voltage: number; 
  polarityL: 'positive' | 'negative' | 'neutral';
  isBypassed?: boolean;
  isFlipped?: boolean; 
}

export type NodeId = 'c1_L' | 'c1_R' | 'c2_L' | 'c2_R' | 'v_pos' | 'v_neg';

export interface Wire {
  id: string;
  from: NodeId;
  to: NodeId;
}
export interface Probes {
  red: NodeId | null;
  black: NodeId | null;
}

export interface DraggableCard {
    id: string;
    metal: MetalType;
}

export enum ConnectionType {
    Series = 'Series',
    Parallel = 'Parallel',
    Broken = 'Broken',
    Complex = 'Complex',
    Custom = 'Custom'
}

export enum PolarityType {
    Standard = 'Standard',
    Reverse = 'Reverse'
}

export interface WorkbenchState {
    hand: DraggableCard[];
    slots: {
        c1Left: DraggableCard | null;
        c1Right: DraggableCard | null;
        c2Left: DraggableCard | null;
        c2Right: DraggableCard | null;
    };
    connection: ConnectionType;
    polarity: PolarityType;
}

export interface HistorySnapshot {
    stepName: string; // e.g., "Initial", "After Attack"
    cell1: CellConfig;
    cell2: CellConfig;
    wires: Wire[]; // Added wires to snapshot
    totalVoltage: number;
    actionDescription?: string;
    cardUsed?: ChanceCard;
}

export interface BattleSummary {
    initialVoltage?: number; // Snapshot before battles
    finalVoltage?: number;   // Snapshot after battles
    attackReceived?: ChanceCard;
    buffApplied?: ChanceCard;
}

export interface Team {
  id: string;
  name: string;
  hand: MetalType[];
  cell1: CellConfig;
  cell2: CellConfig;
  wires: Wire[];
  probes: Probes;
  totalVoltage: number;
  status: 'Active' | 'Eliminated' | 'Overload' | 'Winner' | 'Loser'; 
  wins: number; // New: Track Best of 3
  chanceHand: ChanceCard[];
  logs: string[];
  connectionType: ConnectionType;
  isPolarityReversed?: boolean; 
  battleSummary: BattleSummary; 
  history: HistorySnapshot[]; // New: Track state over time
}

export interface TrilingualContent {
    zh: string;
    en: string;
    ja: string;
}

export type SabotageType = 'SWAP_ELECTRODE' | 'REVERSE_POLARITY'; 

export interface ChanceCard {
  id: string;
  title: TrilingualContent;
  description: TrilingualContent;
  effectType: SabotageType;
  metalPayload?: MetalType; 
  targetCellId?: number; // For reverse polarity
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'attack' | 'system';
}
