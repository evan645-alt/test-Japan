
import React, { useState, useEffect } from 'react';
import { Zap, Activity, Trophy, Eye, Sword, Shield, ArrowRight, History, Calculator, Crown, RotateCcw, Timer } from 'lucide-react';
import { 
  Team, 
  GamePhase, 
  LogEntry, 
  MetalType, 
  CellConfig, 
  Wire, 
  Probes,
  ChanceCard,
  ConnectionType,
  TrilingualContent,
  HistorySnapshot,
  CIRCUIT_NODES
} from './types';
import { calculateCircuitVoltage, drawChanceCards, getMetalColor, generateCalculationLog, getPhaseInstruction, drawRandomHand } from './utils';
import { GameMaster } from './components/GameMaster';
import { AssemblyStage } from './components/AssemblyStage';
import { WiringStage } from './components/WiringStage';
import { BattleStage } from './components/BattleStage';
import { TrilingualText, HalfCellBeaker } from './components/Visuals';

// --- Templates ---
const INITIAL_TEAM: Omit<Team, 'id' | 'name'> = {
  hand: [],
  cell1: { id: 1, metalL: null, metalR: null, voltage: 0, polarityL: 'neutral', isFlipped: false },
  cell2: { id: 2, metalL: null, metalR: null, voltage: 0, polarityL: 'neutral', isFlipped: false },
  wires: [],
  probes: { red: null, black: null },
  totalVoltage: 0,
  status: 'Active',
  wins: 0, // Wins tracker
  chanceHand: [],
  logs: [],
  connectionType: ConnectionType.Broken,
  battleSummary: {},
  history: []
};

// --- Mini Circuit Component for History ---
const MiniCircuitSVG: React.FC<{ wires: Wire[], cell1: CellConfig, cell2: CellConfig }> = ({ wires, cell1, cell2 }) => {
    
    // Helper to determine what metal is physically at the Left/Right node
    // If flipped, the Left Node connects to the Right Metal
    const getPhysicalMetal = (cell: CellConfig, side: 'L' | 'R') => {
        if (cell.isFlipped) {
            return side === 'L' ? cell.metalR : cell.metalL;
        }
        return side === 'L' ? cell.metalL : cell.metalR;
    };

    const c1_MetalL = getPhysicalMetal(cell1, 'L');
    const c1_MetalR = getPhysicalMetal(cell1, 'R');
    const c2_MetalL = getPhysicalMetal(cell2, 'L');
    const c2_MetalR = getPhysicalMetal(cell2, 'R');

    // Draw an electrode at a specific node coordinate
    const renderElectrode = (nodeId: string, metal: MetalType | null, isFlipped: boolean) => {
        // @ts-ignore
        const node = CIRCUIT_NODES[nodeId];
        if (!node || !metal) return null;
        
        const color = getMetalColor(metal);
        
        return (
            <g key={nodeId}>
                {/* Electrode Body */}
                <rect 
                    x={node.x - 3} 
                    y={node.y} 
                    width={6} 
                    height={10} 
                    fill={color} 
                    stroke={isFlipped ? "#ef4444" : "#444"} // Red stroke if flipped
                    strokeWidth={isFlipped ? 1 : 0.5}
                    rx={1}
                />
                {/* Metal Label */}
                <text 
                    x={node.x} 
                    y={node.y + 8} 
                    fontSize="5" 
                    fill={['Mg', 'Ag'].includes(metal) ? 'black' : 'white'} 
                    textAnchor="middle" 
                    fontWeight="bold"
                    style={{ textShadow: '0px 0px 2px rgba(0,0,0,0.5)' }}
                >
                    {metal}
                </text>
                {/* Terminal Point (where wire connects) */}
                <circle cx={node.x} cy={node.y} r={1.5} fill="#000" stroke="#666" strokeWidth={0.5} />
            </g>
        );
    };

    return (
        <svg viewBox="0 0 100 85" className="w-full h-full pointer-events-none select-none bg-gray-900/50">
            {/* Voltmeter Terminals */}
            <circle cx={CIRCUIT_NODES.v_pos.x} cy={CIRCUIT_NODES.v_pos.y} r="2" fill="#dc2626" />
            <text x={CIRCUIT_NODES.v_pos.x} y={CIRCUIT_NODES.v_pos.y - 4} fontSize="6" fill="#dc2626" textAnchor="middle">+</text>
            
            <circle cx={CIRCUIT_NODES.v_neg.x} cy={CIRCUIT_NODES.v_neg.y} r="2" fill="#000" stroke="#444" strokeWidth="0.5" />
            <text x={CIRCUIT_NODES.v_neg.x} y={CIRCUIT_NODES.v_neg.y - 4} fontSize="6" fill="#888" textAnchor="middle">-</text>

            {/* Wires (Drawn first so they are behind electrodes slightly if overlapping) */}
            {wires.map(w => {
                const n1 = CIRCUIT_NODES[w.from];
                const n2 = CIRCUIT_NODES[w.to];
                if (!n1 || !n2) return null;
                
                // Color logic for wires
                let stroke = '#eab308';
                if (w.from.includes('pos') || w.to.includes('pos')) stroke = '#ef4444'; // Red
                if (w.from.includes('neg') || w.to.includes('neg')) stroke = '#555';    // Black

                return (
                    <path 
                        key={w.id} 
                        d={`M ${n1.x} ${n1.y} L ${n2.x} ${n2.y}`} 
                        stroke={stroke}
                        strokeWidth="1.5" 
                        strokeLinecap="round"
                        opacity="0.9"
                    />
                );
            })}

            {/* Electrodes */}
            {renderElectrode('c1_L', c1_MetalL, !!cell1.isFlipped)}
            {renderElectrode('c1_R', c1_MetalR, !!cell1.isFlipped)}
            {renderElectrode('c2_L', c2_MetalL, !!cell2.isFlipped)}
            {renderElectrode('c2_R', c2_MetalR, !!cell2.isFlipped)}

            {/* Cell Containers (Optional outlines to group them) */}
            <rect x="18" y="65" width="24" height="18" fill="none" stroke="#444" strokeWidth="0.5" strokeDasharray="2,2" rx="2" />
            <text x="30" y="82" fontSize="4" fill="#666" textAnchor="middle">CELL 1</text>
            
            <rect x="58" y="65" width="24" height="18" fill="none" stroke="#444" strokeWidth="0.5" strokeDasharray="2,2" rx="2" />
            <text x="70" y="82" fontSize="4" fill="#666" textAnchor="middle">CELL 2</text>
        </svg>
    );
};

export default function App() {
  const [phase, setPhase] = useState<GamePhase>(GamePhase.SETUP);
  const [teams, setTeams] = useState<Team[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const [commentary, setCommentary] = useState<TrilingualContent>(getPhaseInstruction(GamePhase.SETUP));
  
  const [name1, setName1] = useState('');
  const [name2, setName2] = useState('');

  // Timer State
  const ROUND_DURATION = 120; // 2 minutes
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION);

  // Draft State (for auto-submission from AssemblyStage)
  const [draftAssembly, setDraftAssembly] = useState<{hand: MetalType[], c1: CellConfig, c2: CellConfig} | null>(null);

  // --- Helpers ---
  const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      message: msg,
      type
    }, ...prev]);
    return msg;
  };

  const setPhaseWithInstruction = (newPhase: GamePhase, activeTeamName?: string) => {
    setPhase(newPhase);
    setCommentary(getPhaseInstruction(newPhase, activeTeamName));
    setTimeLeft(ROUND_DURATION); // Reset timer on phase change
    setDraftAssembly(null); // Reset draft
  };

  const updateTeam = (index: number, updates: Partial<Team>) => {
    setTeams(prev => {
        const newTeams = [...prev];
        newTeams[index] = { ...newTeams[index], ...updates };
        return newTeams;
    });
  };

  // Capture a snapshot of the current team state
  const captureSnapshot = (teamIndex: number, stepName: string, description?: string, card?: ChanceCard) => {
      setTeams(prev => {
          const newTeams = [...prev];
          const team = newTeams[teamIndex];
          
          const snapshot: HistorySnapshot = {
              stepName,
              cell1: JSON.parse(JSON.stringify(team.cell1)), // Deep copy
              cell2: JSON.parse(JSON.stringify(team.cell2)), // Deep copy
              wires: [...team.wires], // Copy wires for history visualization
              totalVoltage: team.totalVoltage,
              actionDescription: description,
              cardUsed: card
          };
          
          team.history = [...team.history, snapshot];
          return newTeams;
      });
  };

  // --- TIMER LOGIC ---
  useEffect(() => {
    // List of phases that have a timer
    const timedPhases = [
        GamePhase.A_DRAW, GamePhase.B_DRAW,
        GamePhase.A_ASSEMBLE, GamePhase.B_ASSEMBLE,
        GamePhase.A_WIRING, GamePhase.B_WIRING,
        GamePhase.A_ACTION_1, GamePhase.B_ACTION_1,
        GamePhase.A_ACTION_2, GamePhase.B_ACTION_2,
        GamePhase.A_ACTION_3, GamePhase.B_ACTION_3
    ];

    if (timedPhases.includes(phase) && timeLeft > 0) {
        const timerId = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearTimeout(timerId);
    } else if (timeLeft === 0 && timedPhases.includes(phase)) {
        handleTimeout();
    }
  }, [timeLeft, phase]);

  const handleTimeout = () => {
    addLog("Time limit reached! System forcing action.", 'system');
    
    // Auto-progress based on phase
    if (phase === GamePhase.A_DRAW || phase === GamePhase.B_DRAW) {
        const teamIdx = phase === GamePhase.A_DRAW ? 0 : 1;
        // If we have revealed cards (draft), use them. If not, random.
        if (draftAssembly && draftAssembly.hand.length > 0) {
             handleDrawComplete(teamIdx, draftAssembly.hand);
        } else {
             handleDrawComplete(teamIdx, drawRandomHand(6));
        }
    } else if (phase === GamePhase.A_ASSEMBLE || phase === GamePhase.B_ASSEMBLE) {
         const teamIdx = phase === GamePhase.A_ASSEMBLE ? 0 : 1;
         if (draftAssembly) {
             handleAssemblyComplete(teamIdx, draftAssembly.hand, draftAssembly.c1, draftAssembly.c2);
         } else {
             // Fallback: Just pass existing data
             const t = teams[teamIdx];
             handleAssemblyComplete(teamIdx, t.hand, t.cell1, t.cell2);
         }
    } else if (phase === GamePhase.A_WIRING || phase === GamePhase.B_WIRING) {
         const teamIdx = phase === GamePhase.A_WIRING ? 0 : 1;
         handleWiringConfirm(teamIdx);
    } else if (phase.includes('ACTION')) {
         handleSkip();
    }
  };

  // --- Phase Handlers ---

  const startGame = () => {
      if (!name1 || !name2) return alert("Names required");
      const initTeams = [
          { ...INITIAL_TEAM, id: 't1', name: name1, wins: 0 } as Team,
          { ...INITIAL_TEAM, id: 't2', name: name2, wins: 0 } as Team
      ];
      setTeams(initTeams);
      setPhaseWithInstruction(GamePhase.A_DRAW, name1);
  };

  const startNextRound = () => {
      setTeams(prevTeams => prevTeams.map(t => ({
          ...t,
          ...INITIAL_TEAM, // Reset round-specific data
          id: t.id,
          name: t.name,
          wins: t.wins // Preserve wins
      })));
      setPhaseWithInstruction(GamePhase.A_DRAW, teams[0].name);
  };

  const handleDraw = (teamIndex: number) => {
      if (teamIndex === 0) {
          setPhaseWithInstruction(GamePhase.B_DRAW, teams[1]?.name || name2);
      } else {
          setPhaseWithInstruction(GamePhase.A_ASSEMBLE, teams[0]?.name || name1);
      }
  };
  
  const handleDrawComplete = (teamIndex: number, hand: MetalType[]) => {
      updateTeam(teamIndex, { hand });
      handleDraw(teamIndex);
  }

  const handleAssemblyComplete = (teamIndex: number, hand: MetalType[], c1: CellConfig, c2: CellConfig) => {
      updateTeam(teamIndex, { hand, cell1: c1, cell2: c2 });
      if (teamIndex === 0) {
          setPhaseWithInstruction(GamePhase.B_ASSEMBLE, teams[1].name);
      } else {
          setPhaseWithInstruction(GamePhase.A_WIRING, teams[0].name);
      }
      addLog(`${teams[teamIndex].name} assembly locked.`);
  };

  const handleAssemblyUpdate = (hand: MetalType[], c1: CellConfig, c2: CellConfig) => {
      setDraftAssembly({ hand, c1, c2 });
  };

  const handleWiringUpdate = (teamIndex: number, wires: Wire[], probes: Probes, voltage: number, connectionType?: ConnectionType, cellUpdates?: any) => {
      const currentTeam = teams[teamIndex];
      const newCell1 = cellUpdates?.cell1 ? { ...currentTeam.cell1, ...cellUpdates.cell1 } : currentTeam.cell1;
      const newCell2 = cellUpdates?.cell2 ? { ...currentTeam.cell2, ...cellUpdates.cell2 } : currentTeam.cell2;
      
      updateTeam(teamIndex, { 
          wires, 
          probes, 
          totalVoltage: voltage, 
          connectionType: connectionType || ConnectionType.Broken,
          cell1: newCell1,
          cell2: newCell2
      });
  };

  const handleWiringConfirm = (teamIndex: number) => {
      const team = teams[teamIndex];
      // Capture Initial Voltage for Summary (Use raw value, sign matters!)
      updateTeam(teamIndex, { 
          battleSummary: { ...team.battleSummary, initialVoltage: team.totalVoltage } 
      });
      
      // SNAPSHOT: Initial State
      captureSnapshot(teamIndex, "Wiring Complete", "Initial Circuit Setup");

      addLog(`${team.name} wiring confirmed.`);
      
      if (phase === GamePhase.A_WIRING) {
          setPhaseWithInstruction(GamePhase.B_WIRING, teams[1].name);
      } else if (phase === GamePhase.B_WIRING) {
          // Wiring Complete. Start JOINT DRAW.
          setPhaseWithInstruction(GamePhase.JOINT_DRAW_ANIMATION);
      }
  };

  // --- NEW BATTLE LOGIC ---

  const handleJointDrawComplete = () => {
      // Distribute 3 cards to each team (updated count)
      updateTeam(0, { chanceHand: drawChanceCards() });
      updateTeam(1, { chanceHand: drawChanceCards() });
      
      // Start Battle Sequence: B Actions First
      setPhaseWithInstruction(GamePhase.B_ACTION_1, teams[1].name);
  };

  const handleCardPlay = (actorIndex: number, card: ChanceCard, data: any) => {
      const actor = teams[actorIndex];
      
      // Determine target based on phase logic rules or passed data
      const isAction1 = phase === GamePhase.A_ACTION_1 || phase === GamePhase.B_ACTION_1; // Mandatory Attack
      const isAction2 = phase === GamePhase.A_ACTION_2 || phase === GamePhase.B_ACTION_2; // Mandatory Self Buff
      
      let targetIndex;
      
      if (isAction1) {
          // Mandatory Opponent
          targetIndex = actorIndex === 0 ? 1 : 0;
      } else if (isAction2) {
          // Mandatory Self
          targetIndex = actorIndex;
      } else {
          // Phase 3 (Flexible): Rely on `data.targetScope` passed from UI
          const scope = data.targetScope; // 'SELF' or 'OPPONENT'
          if (scope === 'OPPONENT') {
              targetIndex = actorIndex === 0 ? 1 : 0;
          } else {
              targetIndex = actorIndex;
          }
      }
      
      // We must get the LATEST state of the target team from the teams array
      setTeams(currentTeams => {
          const targetTeam = JSON.parse(JSON.stringify(currentTeams[targetIndex])) as Team;
          const cardType = card.effectType;
          let logMsg = `${actor.name} used ${card.title.en} on ${targetTeam.name}.`;

          // Apply Effects
          if (cardType === 'SWAP_ELECTRODE') {
              const { cellId, slot, newMetal } = data;
              const cellKey = cellId === 1 ? 'cell1' : 'cell2';
              const slotKey = slot === 'L' ? 'metalL' : 'metalR';
              if (targetTeam[cellKey]) {
                 (targetTeam[cellKey] as any)[slotKey] = newMetal;
                 logMsg += ` Swapped Cell ${cellId} ${slot} to ${newMetal}.`;
              }
          } else if (cardType === 'REVERSE_POLARITY') {
              const { cellId } = data;
              const cellKey = cellId === 1 ? 'cell1' : 'cell2';
              if (targetTeam[cellKey]) {
                  targetTeam[cellKey].isFlipped = !targetTeam[cellKey].isFlipped;
                  logMsg += ` Reversed polarity of Cell ${cellId}.`;
              }
          }

          // Recalculate Voltage
          const newV = calculateCircuitVoltage(targetTeam);
          targetTeam.totalVoltage = newV;

          // Record Summary for Game Over Screen (Legacy)
          if (isAction1) targetTeam.battleSummary.attackReceived = card;
          else if (isAction2) targetTeam.battleSummary.buffApplied = card;

          const newTeams = [...currentTeams];
          newTeams[targetIndex] = targetTeam;
          
          // SNAPSHOT: After Card Effect
          const isAttack = targetIndex !== actorIndex;
          const snapshotName = isAttack ? `Attacked by ${actor.name}` : "Self Modification";
          const snapshot: HistorySnapshot = {
              stepName: snapshotName,
              cell1: JSON.parse(JSON.stringify(targetTeam.cell1)),
              cell2: JSON.parse(JSON.stringify(targetTeam.cell2)),
              wires: [...targetTeam.wires],
              totalVoltage: newV,
              actionDescription: logMsg,
              cardUsed: card
          };
          newTeams[targetIndex].history.push(snapshot);
          
          // Remove card from actor's hand
          const newActorHand = newTeams[actorIndex].chanceHand.filter(c => c.id !== card.id);
          newTeams[actorIndex].chanceHand = newActorHand;

          addLog(logMsg, 'attack');
          return newTeams;
      });

      // --- PHASE TRANSITIONS (6 Steps) ---
      // Sequence: B1 -> A1 -> B2 -> A2 -> B3 -> A3 -> End
      if (phase === GamePhase.B_ACTION_1) {
          setPhaseWithInstruction(GamePhase.A_ACTION_1, teams[0].name);
      } else if (phase === GamePhase.A_ACTION_1) {
          setPhaseWithInstruction(GamePhase.B_ACTION_2, teams[1].name); // Start Round 2 (Buff)
      } else if (phase === GamePhase.B_ACTION_2) {
          setPhaseWithInstruction(GamePhase.A_ACTION_2, teams[0].name);
      } else if (phase === GamePhase.A_ACTION_2) {
          setPhaseWithInstruction(GamePhase.B_ACTION_3, teams[1].name); // Start Round 3 (Flex)
      } else if (phase === GamePhase.B_ACTION_3) {
          setPhaseWithInstruction(GamePhase.A_ACTION_3, teams[0].name);
      } else if (phase === GamePhase.A_ACTION_3) {
          checkWinner();
      }
  };

  const handleSkip = () => {
      // Snapshot the "Skip" action (state doesn't change, but history should record it)
      const currentTeamIdx = (phase.startsWith('A_ACTION')) ? 0 : 1;
      captureSnapshot(currentTeamIdx, "Skipped Turn", "No changes made");

      // Phase transitions on Skip (same as playing a card but simpler)
      if (phase === GamePhase.B_ACTION_1) setPhaseWithInstruction(GamePhase.A_ACTION_1, teams[0].name);
      else if (phase === GamePhase.A_ACTION_1) setPhaseWithInstruction(GamePhase.B_ACTION_2, teams[1].name);
      else if (phase === GamePhase.B_ACTION_2) setPhaseWithInstruction(GamePhase.A_ACTION_2, teams[0].name);
      else if (phase === GamePhase.A_ACTION_2) setPhaseWithInstruction(GamePhase.B_ACTION_3, teams[1].name);
      else if (phase === GamePhase.B_ACTION_3) setPhaseWithInstruction(GamePhase.A_ACTION_3, teams[0].name);
      else if (phase === GamePhase.A_ACTION_3) checkWinner();
  };

  const checkWinner = () => {
     setTeams(currentTeams => {
        const t0 = currentTeams[0];
        const t1 = currentTeams[1];
        
        // NO Absolute Value. Sign matters!
        const v1 = calculateCircuitVoltage(t0);
        const v2 = calculateCircuitVoltage(t1);

        let s0 = t0.status;
        let s1 = t1.status;
        let w0 = t0.wins;
        let w1 = t1.wins;

        // Round Logic
        if (v1 > v2) {
            s0 = 'Winner'; s1 = 'Loser';
            w0 += 1;
        } else if (v2 > v1) {
            s1 = 'Winner'; s0 = 'Loser';
            w1 += 1;
        } else {
            // Draw - No points? Or split? Let's give no points to keep it simple or redo.
            // For now, simple draw = no wins increment
            s0 = 'Winner'; s1 = 'Winner';
        }
        
        const newTeams: Team[] = [
            { ...t0, status: s0, wins: w0, totalVoltage: v1, battleSummary: { ...t0.battleSummary, finalVoltage: v1 } },
            { ...t1, status: s1, wins: w1, totalVoltage: v2, battleSummary: { ...t1.battleSummary, finalVoltage: v2 } }
        ];

        // Check for Series Winner (First to 2)
        if (w0 >= 2 || w1 >= 2) {
             setPhase(GamePhase.GAME_OVER);
             setCommentary(getPhaseInstruction(GamePhase.GAME_OVER));
        } else {
             setPhase(GamePhase.ROUND_SUMMARY);
             setCommentary(getPhaseInstruction(GamePhase.ROUND_SUMMARY));
        }

        return newTeams;
     });
  };

  // --- Render ---

  const getActiveTeamName = () => {
      // Setup phases
      if (phase.includes('A_DRAW') || phase.includes('A_ASSEMBLE') || phase.includes('A_WIRING')) return teams[0]?.name;
      if (phase.includes('B_DRAW') || phase.includes('B_ASSEMBLE') || phase.includes('B_WIRING')) return teams[1]?.name;
      
      // Battle Phases (Updated for 3 cards)
      if (phase.startsWith('A_ACTION')) return teams[0]?.name;
      if (phase.startsWith('B_ACTION')) return teams[1]?.name;
      
      // Animations
      if (phase === GamePhase.JOINT_DRAW_ANIMATION) return "JOINT SESSION";
      
      return null;
  };
  const activeTeamName = getActiveTeamName();

  // Helper for Timeline
  const renderSnapshot = (snap: HistorySnapshot, idx: number) => {
      const mathLog = generateCalculationLog(snap.cell1, snap.cell2, snap.totalVoltage);

      return (
          <div key={idx} className="flex flex-col gap-2 bg-black/40 p-4 rounded-xl border border-gray-700 hover:bg-gray-800 transition">
              {/* Header Row */}
              <div className="flex items-center gap-4">
                  {/* Step Info */}
                  <div className="w-32 flex-shrink-0">
                      <div className="text-sm text-gray-500 uppercase font-bold mb-1">Step {idx + 1}</div>
                      <div className="text-xl font-bold text-white leading-tight">{snap.stepName}</div>
                      {snap.cardUsed && (
                          <div className="text-base text-neon-blue mt-1 flex items-center gap-1">
                              <Zap size={16} /> {snap.cardUsed.title.en}
                          </div>
                      )}
                  </div>

                  {/* Wiring Visualization (Mini) */}
                  <div className="w-40 h-28 bg-gray-900 rounded border border-gray-600 relative overflow-hidden">
                       <MiniCircuitSVG 
                            wires={snap.wires || []} 
                            cell1={snap.cell1} 
                            cell2={snap.cell2} 
                        />
                  </div>

                  {/* Voltage */}
                  <div className="flex-grow text-right">
                      <div className={`font-mono text-3xl font-bold ${snap.totalVoltage < 0 ? 'text-red-400' : 'text-neon-green'}`}>
                          {snap.totalVoltage.toFixed(2)}V
                      </div>
                  </div>
              </div>

              {/* Math Logic Section */}
              <div className="mt-3 bg-gray-900/60 rounded p-4 text-base font-mono border-l-4 border-gray-600">
                  <div className="flex items-center gap-2 mb-2 text-gray-400">
                      <Calculator size={16} />
                      <span className="uppercase tracking-wider">Calculation Logic</span>
                      <span className="ml-auto text-neon-blue font-bold">{mathLog.connectionType}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
                      <div>
                          <span className="text-gray-500 font-bold">Cell 1:</span> {mathLog.cell1Math}
                      </div>
                      <div>
                          <span className="text-gray-500 font-bold">Cell 2:</span> {mathLog.cell2Math}
                      </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-700 font-bold text-white">
                       Result: {mathLog.totalMath}
                  </div>
              </div>
          </div>
      );
  };

  const renderResultScreen = (isFinal: boolean) => {
      const title = isFinal ? {zh: "最終冠軍", en: "SERIES CHAMPION", ja: "シリーズチャンピオン"} : {zh: "回合結算", en: "ROUND SUMMARY", ja: "ラウンド結果"};
      
      return (
        <div className="text-center py-16 animate-fade-in space-y-12">
            <div>
                {isFinal ? (
                    <Trophy size={120} className="mx-auto text-yellow-500 mb-8 drop-shadow-lg" />
                ) : (
                    <Activity size={120} className="mx-auto text-neon-blue mb-8 drop-shadow-lg" />
                )}
                <h2 className="text-7xl font-black text-white mb-4">
                    <TrilingualText content={title} />
                </h2>
                {isFinal && (
                    <div className="text-3xl text-yellow-400 font-bold">Best of 3 Series</div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full max-w-[95%] mx-auto px-4">
                {teams.map(t => (
                    <div key={t.id} className={`p-8 rounded-3xl border-4 ${t.status === 'Winner' ? 'border-yellow-500 bg-yellow-900/10' : t.status === 'Loser' ? 'border-red-700 bg-red-900/10' : 'border-gray-700 bg-gray-900/30'}`}>
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-5xl font-bold text-white">{t.name}</h3>
                            <div className="flex flex-col items-end">
                                <div className={`text-2xl font-bold uppercase px-6 py-3 rounded-lg mb-2 ${t.status === 'Winner' ? 'bg-yellow-500 text-black' : t.status === 'Loser' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                                    <TrilingualText content={
                                        t.status === 'Winner' 
                                        ? {zh: "勝利", en: "WINNER", ja: "勝利"} 
                                        : t.status === 'Loser' ? {zh: "敗北", en: "DEFEAT", ja: "敗北"} : {zh: "平局", en: "DRAW", ja: "引き分け"}
                                    } size="lg" />
                                </div>
                                {/* Show Total Wins */}
                                <div className="flex gap-2">
                                    {[...Array(2)].map((_, i) => (
                                        <Crown key={i} size={28} className={i < t.wins ? "text-yellow-400 fill-yellow-400" : "text-gray-700"} />
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <div className="mb-8 bg-black/40 p-6 rounded-2xl border border-gray-700">
                            <div className="text-lg text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-3">
                                <History size={20} /> Evolution History
                            </div>
                            <div className="flex flex-col gap-6 mt-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                {t.history.length === 0 ? (
                                    <div className="text-gray-500 italic text-xl">No history recorded.</div>
                                ) : (
                                    t.history.map((snap, idx) => renderSnapshot(snap, idx))
                                )}
                                {/* Final Result */}
                                <div className="border-t border-gray-600 pt-6 mt-2">
                                    <div className={`flex justify-between items-center font-bold ${t.totalVoltage < 0 ? 'text-red-500' : 'text-neon-green'}`}>
                                        <span className="text-2xl">Round Voltage</span>
                                        <span className="text-5xl">{t.totalVoltage.toFixed(2)}V</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Read-Only Wiring Stage with Visible Voltage */}
                        <div className="scale-95 origin-top">
                            <WiringStage 
                                team={t} 
                                onUpdate={() => {}} 
                                onConfirm={() => {}} 
                                readOnly={true}
                                hideVoltage={false} 
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-center pb-20">
                {isFinal ? (
                    <button onClick={() => window.location.reload()} className="bg-gray-700 text-white px-12 py-6 rounded-2xl hover:bg-gray-600 flex items-center gap-4 active:scale-95 transition-transform text-2xl font-bold shadow-2xl">
                        <RotateCcw size={32} /> RESET SYSTEM
                    </button>
                ) : (
                    <button onClick={startNextRound} className="bg-neon-blue text-black font-black px-16 py-8 rounded-2xl hover:scale-105 transition flex items-center gap-5 shadow-[0_0_40px_rgba(0,243,255,0.4)] active:scale-95 text-3xl">
                        <TrilingualText content={{zh: "下一回合", en: "NEXT ROUND", ja: "次のラウンド"}} /> <ArrowRight size={36} />
                    </button>
                )}
            </div>
        </div>
      );
  };

  return (
    <div className="min-h-screen bg-dark-bg text-gray-100 p-6 font-sans pb-32 w-full overflow-x-hidden">
        
        {/* Top Bar */}
        <div className="w-full max-w-[98vw] mx-auto mb-8 flex justify-between items-center border-b border-gray-800 pb-6">
             <div className="flex items-center gap-4">
                 <Zap className="text-neon-blue w-10 h-10" />
                 <h1 className="font-bold tracking-widest text-3xl">VOLTAGE WARS</h1>
             </div>

             {/* Timer Display */}
             {phase !== GamePhase.SETUP && phase !== GamePhase.GAME_OVER && phase !== GamePhase.ROUND_SUMMARY && phase !== GamePhase.JOINT_DRAW_ANIMATION && (
                <div className={`flex items-center gap-4 px-8 py-4 rounded-full border-2 ${timeLeft < 30 ? 'bg-red-900/50 border-red-500 animate-pulse' : 'bg-gray-800 border-gray-700'}`}>
                    <Timer size={32} className={timeLeft < 30 ? 'text-red-400' : 'text-neon-green'} />
                    <span className={`font-mono font-bold text-4xl ${timeLeft < 30 ? 'text-red-400' : 'text-white'}`}>
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </span>
                </div>
             )}

             {phase !== GamePhase.SETUP && (
                <div className="flex gap-12 text-lg font-mono">
                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-3">
                            <span className="text-neon-blue font-bold text-2xl">{teams[0]?.name}</span>
                            <div className="flex gap-1">
                                {[...Array(teams[0].wins)].map((_, i) => <Crown key={i} size={20} className="text-yellow-400 fill-yellow-400" />)}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <span className={`text-2xl font-bold ${teams[0]?.totalVoltage < 0 ? 'text-red-500' : ''}`}>
                                {(phase === GamePhase.GAME_OVER || phase === GamePhase.ROUND_SUMMARY) ? teams[0]?.totalVoltage.toFixed(2) : '???'}V
                            </span>
                            <span className="text-sm px-3 py-1 bg-gray-800 rounded text-gray-400 font-bold">{teams[0]?.connectionType}</span>
                        </div>
                    </div>
                    <div className="text-gray-600 self-center text-3xl font-bold">VS</div>
                    <div className="flex flex-col items-start">
                        <div className="flex items-center gap-3">
                            <div className="flex gap-1">
                                {[...Array(teams[1].wins)].map((_, i) => <Crown key={i} size={20} className="text-yellow-400 fill-yellow-400" />)}
                            </div>
                            <span className="text-neon-purple font-bold text-2xl">{teams[1]?.name}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <span className={`text-2xl font-bold ${teams[1]?.totalVoltage < 0 ? 'text-red-500' : ''}`}>
                                {(phase === GamePhase.GAME_OVER || phase === GamePhase.ROUND_SUMMARY) ? teams[1]?.totalVoltage.toFixed(2) : '???'}V
                            </span>
                            <span className="text-sm px-3 py-1 bg-gray-800 rounded text-gray-400 font-bold">{teams[1]?.connectionType}</span>
                        </div>
                    </div>
                </div>
             )}
        </div>

        {/* Turn Indicator Banner */}
        {activeTeamName && phase !== GamePhase.GAME_OVER && phase !== GamePhase.ROUND_SUMMARY && (
            <div className="w-full max-w-[98vw] mx-auto mb-10 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-y-2 border-neon-blue/30 p-8 text-center shadow-[0_0_40px_rgba(0,243,255,0.1)]">
                <div className="text-lg text-neon-blue uppercase tracking-[0.3em] mb-2 font-bold">Current Turn / 當前回合 / ターン</div>
                <div className="text-6xl font-black text-white tracking-wider animate-pulse-fast">
                    {activeTeamName}
                </div>
            </div>
        )}

        {/* Game Master (Static) */}
        {phase !== GamePhase.SETUP && (
            <div className="w-full max-w-[98vw] mx-auto mb-10">
                <GameMaster commentary={commentary} />
            </div>
        )}

        {/* Main Content */}
        <main className="w-full max-w-[98vw] mx-auto min-h-[600px]">
             {phase === GamePhase.SETUP && (
                <div className="glass-panel p-20 max-w-4xl mx-auto text-center mt-20 rounded-[3rem] border-4 border-gray-700">
                    <Zap size={120} className="mx-auto text-neon-blue mb-10 animate-pulse" />
                    <h1 className="text-7xl font-black mb-12 text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple leading-tight">VOLTAGE WARS</h1>
                    <div className="text-3xl text-gray-400 mb-12 uppercase tracking-widest font-bold">Best of 3 Series</div>
                    <div className="space-y-8">
                        <input className="w-full bg-black/50 p-8 rounded-2xl border-2 border-gray-600 text-white text-3xl focus:border-neon-blue outline-none" placeholder="Team Alpha Name" value={name1} onChange={e => setName1(e.target.value)} />
                        <input className="w-full bg-black/50 p-8 rounded-2xl border-2 border-gray-600 text-white text-3xl focus:border-neon-purple outline-none" placeholder="Team Beta Name" value={name2} onChange={e => setName2(e.target.value)} />
                        <button onClick={startGame} className="w-full bg-neon-blue hover:bg-cyan-400 text-black font-black py-8 rounded-2xl tracking-widest transition-transform hover:scale-105 active:scale-95 text-3xl shadow-2xl mt-8">
                            INITIALIZE SYSTEM
                        </button>
                    </div>
                </div>
             )}

             {(phase === GamePhase.A_DRAW || phase === GamePhase.B_DRAW) && (
                 <AssemblyStage 
                    key={phase} 
                    teamName={phase === GamePhase.A_DRAW ? teams[0].name : teams[1].name} 
                    isDrawPhase={true} 
                    onComplete={(hand) => handleDrawComplete(phase === GamePhase.A_DRAW ? 0 : 1, hand)} 
                    onUpdate={handleAssemblyUpdate}
                 />
             )}

             {(phase === GamePhase.A_ASSEMBLE || phase === GamePhase.B_ASSEMBLE) && (
                 <AssemblyStage 
                    key={phase} 
                    teamName={phase === GamePhase.A_ASSEMBLE ? teams[0].name : teams[1].name} 
                    isDrawPhase={false} 
                    existingTeamData={phase === GamePhase.A_ASSEMBLE ? teams[0] : teams[1]} 
                    onComplete={(h, c1, c2) => handleAssemblyComplete(phase === GamePhase.A_ASSEMBLE ? 0 : 1, h, c1, c2)} 
                    onUpdate={handleAssemblyUpdate}
                 />
             )}

             {(phase === GamePhase.A_WIRING || phase === GamePhase.B_WIRING) && (
                 <div className="space-y-8">
                     <h2 className="text-5xl font-bold text-center text-neon-blue mb-6">
                         {phase === GamePhase.A_WIRING ? teams[0].name : teams[1].name}: Wiring Strategy
                     </h2>
                     <WiringStage 
                        key={phase}
                        team={phase === GamePhase.A_WIRING ? teams[0] : teams[1]} 
                        onUpdate={(w, p, v, c, u) => handleWiringUpdate(phase === GamePhase.A_WIRING ? 0 : 1, w, p, v, c, u)} 
                        onConfirm={() => handleWiringConfirm(phase === GamePhase.A_WIRING ? 0 : 1)} 
                        hideVoltage={true} // HIDDEN DURING GAMEPLAY
                     />
                 </div>
             )}

             {(phase === GamePhase.JOINT_DRAW_ANIMATION || phase.includes('ACTION')) && (
                 <BattleStage 
                    phase={phase} 
                    activeTeam={(phase.startsWith('A_ACTION')) ? teams[0] : teams[1]} 
                    opponentTeam={(phase.startsWith('A_ACTION')) ? teams[1] : teams[0]} 
                    onDrawCards={handleJointDrawComplete} 
                    onPlayCard={(c, d) => handleCardPlay(phase.startsWith('A_ACTION') ? 0 : 1, c, d)} 
                    onSkip={handleSkip} 
                 />
             )}

             {phase === GamePhase.ROUND_SUMMARY && renderResultScreen(false)}
             
             {phase === GamePhase.GAME_OVER && renderResultScreen(true)}
        </main>
    </div>
  );
}
