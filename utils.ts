
import { METAL_POTENTIALS, MetalType, Team, CellConfig, Wire, NodeId, ChanceCard, ConnectionType, TrilingualContent, GamePhase } from './types';

// --- Visual Helpers ---

export const getMetalColor = (m: MetalType | null): string => {
    switch (m) {
        case MetalType.Mg: return '#e2e8f0'; // Magnesium (White/Silver)
        case MetalType.Ag: return '#c0c0c0'; // Silver
        case MetalType.Cu: return '#b87333'; // Copper
        case MetalType.Fe: return '#5D4037'; // Iron (Rust/Brown)
        case MetalType.Zn: return '#7f8c8d'; // Zinc (Grey)
        case MetalType.Pb: return '#4a4a4a'; // Lead (Dark Grey)
        default: return '#2d3748'; // Empty
    }
};

export const getSolutionColor = (m: MetalType | null): string => {
    switch (m) {
        case MetalType.Cu: return 'rgba(52, 152, 219, 0.4)'; // Blue (Cu2+)
        case MetalType.Fe: return 'rgba(100, 200, 100, 0.2)'; // Greenish (Fe2+) or Yellow (Fe3+)
        default: return 'rgba(236, 240, 241, 0.2)'; // Clear for others
    }
};

// --- Basic Electrochemistry ---

export const getElectrodePotential = (m: MetalType | null): number => {
    return m ? METAL_POTENTIALS[m] : 0;
};

export const calculateCellVoltage = (metalL: MetalType | null, metalR: MetalType | null): number => {
    const eL = getElectrodePotential(metalL);
    const eR = getElectrodePotential(metalR);
    // Returns potential difference (Right - Left)
    return Math.round((eR - eL) * 100) / 100;
};

// --- Math Explanation Helper ---
export interface CalculationLog {
    cell1Math: string;
    cell2Math: string;
    totalMath: string;
    connectionType: string;
}

export const generateCalculationLog = (c1: CellConfig, c2: CellConfig, totalV: number): CalculationLog => {
    const getEffectiveMetal = (cell: CellConfig, side: 'L' | 'R') => {
        if (cell.isFlipped) {
            return side === 'L' ? cell.metalR : cell.metalL;
        }
        return side === 'L' ? cell.metalL : cell.metalR;
    };

    const c1L = getEffectiveMetal(c1, 'L');
    const c1R = getEffectiveMetal(c1, 'R');
    const c2L = getEffectiveMetal(c2, 'L');
    const c2R = getEffectiveMetal(c2, 'R');

    const v1 = calculateCellVoltage(c1L, c1R);
    const v2 = calculateCellVoltage(c2L, c2R);

    // Helper to format: "Cu(0.34) - Zn(-0.76) = 1.10V"
    const formatCellMath = (mR: MetalType | null, mL: MetalType | null, v: number, isFlipped: boolean) => {
        if (!mR || !mL) return "Empty";
        const eR = getElectrodePotential(mR);
        const eL = getElectrodePotential(mL);
        const flipText = isFlipped ? " [REVERSED]" : "";
        return `${mR}(${eR}) - ${mL}(${eL}) = ${v.toFixed(2)}V${flipText}`;
    };

    const cell1Math = formatCellMath(c1R, c1L, v1, !!c1.isFlipped);
    const cell2Math = formatCellMath(c2R, c2L, v2, !!c2.isFlipped);

    // 2. Infer connection type based on total voltage
    const sum = v1 + v2;
    const avg = (v1 + v2) / 2;
    const diff = v1 - v2; 
    const diff2 = v2 - v1;

    let connectionType = "Custom / Complex";
    let totalMath = `Circuit Result: ${totalV.toFixed(2)}V`;

    if (Math.abs(totalV) < 0.01) {
        connectionType = "Broken Circuit";
        totalMath = "No valid path (0V)";
    } 
    else if (Math.abs(totalV - sum) < 0.05) {
        connectionType = "Series (串聯)";
        totalMath = `${v1.toFixed(2)} + ${v2.toFixed(2)} = ${totalV.toFixed(2)}V`;
    }
    else if (Math.abs(totalV - avg) < 0.05) {
        connectionType = "Parallel (並聯)";
        totalMath = `(${v1.toFixed(2)} + ${v2.toFixed(2)}) ÷ 2 = ${totalV.toFixed(2)}V`;
    }
    else if (Math.abs(totalV - diff) < 0.05 || Math.abs(totalV - diff2) < 0.05) {
         connectionType = "Reverse Series (反接)";
         totalMath = `${v1.toFixed(2)} - ${v2.toFixed(2)} = ${totalV.toFixed(2)}V`;
    }

    return {
        cell1Math,
        cell2Math,
        totalMath,
        connectionType
    };
};

// --- Circuit Analysis ---

export const calculateCircuitVoltage = (team: Team): number => {
  const { cell1, cell2, wires } = team;
  
  // Define graph nodes
  const nodes: NodeId[] = ['v_pos', 'v_neg', 'c1_L', 'c1_R', 'c2_L', 'c2_R'];
  
  type Edge = { to: string, weight: number, type: 'WIRE' | 'BATTERY' };
  const adj: Record<string, Edge[]> = {};
  
  const addEdge = (u: string, v: string, weight: number, type: 'WIRE' | 'BATTERY') => {
      if (!adj[u]) adj[u] = [];
      if (!adj[v]) adj[v] = [];
      adj[u].push({ to: v, weight: weight, type });
      adj[v].push({ to: u, weight: -weight, type }); 
  };

  // 1. Add User Wires
  wires.forEach(w => {
      addEdge(w.from, w.to, 0, 'WIRE');
  });

  // 2. Add Internal Battery Connections
  const addCellEdge = (cell: CellConfig, nodeIdL: string, nodeIdR: string) => {
      if (!cell.metalL || !cell.metalR) return; // Broken cell
      
      const physicalMetalL = cell.isFlipped ? cell.metalR : cell.metalL;
      const physicalMetalR = cell.isFlipped ? cell.metalL : cell.metalR;
      
      const eL = getElectrodePotential(physicalMetalL);
      const eR = getElectrodePotential(physicalMetalR);
      
      const weight = eR - eL;
      addEdge(nodeIdL, nodeIdR, weight, 'BATTERY');
  };

  addCellEdge(cell1, 'c1_L', 'c1_R');
  addCellEdge(cell2, 'c2_L', 'c2_R');

  // 3. Find path from v_neg to v_pos
  const paths: number[] = [];
  const visited = new Set<string>();

  const dfs = (curr: string, currentVoltage: number) => {
      if (curr === 'v_pos') {
          paths.push(currentVoltage);
          return;
      }
      visited.add(curr);
      const neighbors = adj[curr] || [];
      for (const edge of neighbors) {
          if (!visited.has(edge.to)) {
              dfs(edge.to, currentVoltage + edge.weight);
          }
      }
      visited.delete(curr);
  };
  
  dfs('v_neg', 0);

  if (paths.length === 0) return 0; // Open circuit

  const sum = paths.reduce((a, b) => a + b, 0);
  const avg = sum / paths.length;

  return Math.round(avg * 100) / 100;
};


// --- Chance Cards DB ---

const ELEMENT_CARDS: ChanceCard[] = [
    {
        id: 'card_Mg',
        title: { zh: '鎂 (Mg)', en: 'Element: Magnesium', ja: 'マグネシウム (Mg)' },
        description: { zh: '將任意電極變為鎂', en: 'Change electrode to Mg', ja: '電極をMgに変更' },
        effectType: 'SWAP_ELECTRODE',
        metalPayload: MetalType.Mg
    },
    {
        id: 'card_Ag',
        title: { zh: '銀 (Ag)', en: 'Element: Silver', ja: '銀 (Ag)' },
        description: { zh: '將任意電極變為銀', en: 'Change electrode to Ag', ja: '電極をAgに変更' },
        effectType: 'SWAP_ELECTRODE',
        metalPayload: MetalType.Ag
    },
    {
        id: 'card_Cu',
        title: { zh: '銅 (Cu)', en: 'Element: Copper', ja: '銅 (Cu)' },
        description: { zh: '將任意電極變為銅', en: 'Change electrode to Cu', ja: '電極をCuに変更' },
        effectType: 'SWAP_ELECTRODE',
        metalPayload: MetalType.Cu
    },
    {
        id: 'card_Fe',
        title: { zh: '鐵 (Fe)', en: 'Element: Iron', ja: '鉄 (Fe)' },
        description: { zh: '將任意電極變為鐵', en: 'Change electrode to Fe', ja: '電極をFeに変更' },
        effectType: 'SWAP_ELECTRODE',
        metalPayload: MetalType.Fe
    },
    {
        id: 'card_Zn',
        title: { zh: '鋅 (Zn)', en: 'Element: Zinc', ja: '亜鉛 (Zn)' },
        description: { zh: '將任意電極變為鋅', en: 'Change electrode to Zn', ja: '電極をZnに変更' },
        effectType: 'SWAP_ELECTRODE',
        metalPayload: MetalType.Zn
    },
    {
        id: 'card_Pb',
        title: { zh: '鉛 (Pb)', en: 'Element: Lead', ja: '鉛 (Pb)' },
        description: { zh: '將任意電極變為鉛', en: 'Change electrode to Pb', ja: '電極をPbに変更' },
        effectType: 'SWAP_ELECTRODE',
        metalPayload: MetalType.Pb
    },
    // NEW CARD: Reverse Polarity
    {
        id: 'card_Reverse',
        title: { zh: '極性反轉', en: 'Reverse Polarity', ja: '極性反転' },
        description: { zh: '反轉單個電池的正負極 (交換電極)', en: 'Reverse Anode/Cathode of a cell', ja: '電池の極性を反転させる' },
        effectType: 'REVERSE_POLARITY'
    }
];

export const drawChanceCards = (): ChanceCard[] => {
  // Draw 3 Cards per team
  const cards: ChanceCard[] = [];
  for(let i=0; i<3; i++) {
      const c = ELEMENT_CARDS[Math.floor(Math.random() * ELEMENT_CARDS.length)];
      cards.push({ ...c, id: `${c.id}_${Date.now()}_${i}` });
  }
  return cards;
};

export const drawRandomHand = (count: number): MetalType[] => {
    const metals = Object.values(MetalType);
    let hand: MetalType[] = [];
    let isValid = false;

    // Retry logic to ensure distribution is fair (no 4 of same kind)
    while (!isValid) {
        hand = [];
        const counts: Record<string, number> = {};
        
        for (let i = 0; i < count; i++) {
            const m = metals[Math.floor(Math.random() * metals.length)];
            hand.push(m);
            counts[m] = (counts[m] || 0) + 1;
        }

        // Check validity
        isValid = true;
        for (const m of metals) {
            if (counts[m] >= 4) {
                isValid = false;
                break;
            }
        }
    }
    
    return hand;
};

// --- STATIC INSTRUCTIONS (No AI) ---

export const getPhaseInstruction = (phase: GamePhase, activeTeamName?: string): TrilingualContent => {
    const name = activeTeamName || "Player";
    
    switch (phase) {
        case GamePhase.SETUP:
            return {
                zh: "歡迎來到電壓戰爭！請輸入隊伍名稱以開始遊戲。",
                en: "Welcome to Voltage Wars! Please enter team names to start.",
                ja: "Voltage Warsへようこそ！チーム名を入力して開始してください。"
            };
        case GamePhase.A_DRAW:
            return {
                zh: `${name}，請點擊按鈕抽取您的 6 個半電池組件。`,
                en: `${name}, please click to draw your 6 half-cell components.`,
                ja: `${name}、ボタンをクリックして6つの半電池コンポーネントを引いてください。`
            };
        case GamePhase.B_DRAW:
            return {
                zh: `${name}，現在輪到你抽取組件了。`,
                en: `${name}, it is your turn to draw components.`,
                ja: `${name}、コンポーネントを引く番です。`
            };
        case GamePhase.A_ASSEMBLE:
            return {
                zh: `${name}，請將組件拖入電池槽中以組裝兩個電池。`,
                en: `${name}, drag components into slots to assemble two cells.`,
                ja: `${name}、コンポーネントをスロットにドラッグして2つの電池を組み立ててください。`
            };
        case GamePhase.B_ASSEMBLE:
            return {
                zh: `${name}，請進行電池組裝。選擇電位差最大的組合！`,
                en: `${name}, assemble your cells. Aim for the highest potential difference!`,
                ja: `${name}、電池を組み立ててください。最大の電位差を目指しましょう！`
            };
        case GamePhase.A_WIRING:
            return {
                zh: `${name}，請連接電線。記得：紅線接高電位(正極)，黑線接低電位(負極)。`,
                en: `${name}, connect the wires. Remember: Red to High Potential (+), Black to Low (-).`,
                ja: `${name}、配線を接続してください。赤は高電位（+）、黒は低電位（-）に接続します。`
            };
        case GamePhase.B_WIRING:
            return {
                zh: `${name}，請完成接線。串聯可以增加總電壓。`,
                en: `${name}, complete your wiring. Series connection increases total voltage.`,
                ja: `${name}、配線を完了してください。直列接続は総電圧を増加させます。`
            };
        case GamePhase.JOINT_DRAW_ANIMATION:
            return {
                zh: "雙方請抽取 3 張功能卡。第一張強制攻擊，第二張強制強化，第三張自由選擇。",
                en: "Both teams draw 3 Action Cards. Card 1: Attack, Card 2: Buff, Card 3: Flexible.",
                ja: "両チームがアクションカードを3枚引きます。1枚目は攻撃、2枚目は強化、3枚目は自由です。"
            };
        case GamePhase.B_ACTION_1:
            return {
                zh: `【第一張牌：強制攻擊】${name}，必須對對手使用此卡。`,
                en: `[Card 1: Mandatory Attack] ${name}, you MUST use this card on the opponent.`,
                ja: `【1枚目：強制攻撃】${name}、このカードを対戦相手に使用しなければなりません。`
            };
        case GamePhase.A_ACTION_1:
            return {
                zh: `【第一張牌：強制攻擊】${name}，你現在必須攻擊對手。`,
                en: `[Card 1: Mandatory Attack] ${name}, you must now ATTACK the opponent.`,
                ja: `【1枚目：強制攻撃】${name}、対戦相手を攻撃しなければなりません。`
            };
        case GamePhase.B_ACTION_2:
            return {
                zh: `【第二張牌：自我強化】${name}，必須對自己使用此卡。`,
                en: `[Card 2: Mandatory Buff] ${name}, you MUST use this card on YOURSELF.`,
                ja: `【2枚目：自己強化】${name}、このカードを自分自身に使用しなければなりません。`
            };
        case GamePhase.A_ACTION_2:
            return {
                zh: `【第二張牌：自我強化】${name}，必須對自己使用此卡。`,
                en: `[Card 2: Mandatory Buff] ${name}, you MUST use this card on YOURSELF.`,
                ja: `【2枚目：自己強化】${name}、このカードを自分自身に使用しなければなりません。`
            };
        case GamePhase.B_ACTION_3:
            return {
                zh: `【第三張牌：自由選擇】${name}，攻擊對手、強化自己或跳過。`,
                en: `[Card 3: Flexible] ${name}, Target Opponent, Self, or Skip.`,
                ja: `【3枚目：自由選択】${name}、対戦相手を攻撃、自分を強化、またはスキップできます。`
            };
        case GamePhase.A_ACTION_3:
            return {
                zh: `【第三張牌：自由選擇】${name}，這是最後的機會。攻擊、強化或跳過。`,
                en: `[Card 3: Flexible] ${name}, final chance. Attack, Buff, or Skip.`,
                ja: `【3枚目：自由選択】${name}、最後のチャンスです。攻撃、強化、またはスキップしてください。`
            };
        case GamePhase.ROUND_SUMMARY:
            return {
                zh: "本回合結束。請查看比分並準備下一回合。",
                en: "Round Over. Check scores and prepare for the next round.",
                ja: "ラウンド終了。スコアを確認し、次のラウンドの準備をしてください。"
            };
        case GamePhase.GAME_OVER:
            return {
                zh: "比賽結束！三戰兩勝制的冠軍已經誕生！",
                en: "Game Over! The Best of 3 Champion has been crowned!",
                ja: "ゲームオーバー！3戦2勝制のチャンピオンが決定しました！"
            };
        default:
            return { zh: "請繼續。", en: "Please proceed.", ja: "続けてください。" };
    }
};
