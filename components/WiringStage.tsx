
import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Activity, Zap, EyeOff, Spline, GitMerge, GitCommitHorizontal } from 'lucide-react';
import { Team, Wire, Probes, SabotageType, MetalType, ConnectionType, NodeId, CIRCUIT_NODES } from '../types';
import { calculateCircuitVoltage } from '../utils';
import { HalfCellBeaker, TrilingualText } from './Visuals';

interface WiringStageProps {
  team: Team;
  onUpdate: (wires: Wire[], probes: Probes, voltage: number, connectionType?: ConnectionType, cellUpdates?: any) => void;
  onConfirm: () => void;
  // Sabotage Props
  isSabotageMode?: boolean;
  sabotageType?: SabotageType;
  sabotagePayload?: MetalType;
  onSabotageAction?: (actionData: any) => void;
  // Visual Props
  hideVoltage?: boolean;
  readOnly?: boolean;
}

// Reuse shared nodes
const NODES = CIRCUIT_NODES;

// --- GHOST GUIDES FOR WIRING ---
const GUIDE_PATHS: Record<'series' | 'parallel', [NodeId, NodeId][]> = {
    series: [
        ['v_neg', 'c1_L'],
        ['c1_R', 'c2_L'],
        ['c2_R', 'v_pos']
    ],
    parallel: [
        ['v_neg', 'c1_L'],
        ['v_neg', 'c2_L'],
        ['c1_R', 'v_pos'],
        ['c2_R', 'v_pos']
    ]
};

// --- Terminal Component ---
const TerminalNode: React.FC<{
    id: NodeId;
    x: number;
    y: number;
    color?: string;
    onMouseDown: (e: React.MouseEvent, id: NodeId) => void;
    onMouseUp: (e: React.MouseEvent, id: NodeId) => void;
    label?: string; // Main label (e.g., Metal Symbol)
    subLabel?: string; // Secondary label (e.g., Pos/Neg)
    isActive: boolean;
    connections: number; // Current number of wires connected
}> = ({ id, x, y, color = 'bg-gray-300', onMouseDown, onMouseUp, label, subLabel, isActive, connections }) => {
    
    // Capacity Indicators (Dots)
    const renderCapacityDots = () => {
        return (
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none bg-black/40 px-3 py-2 rounded-full backdrop-blur-sm border border-gray-700/50">
                <div className={`w-3 h-3 rounded-full transition-all duration-300 ${connections >= 1 ? 'bg-neon-green shadow-[0_0_6px_#0aff00]' : 'bg-gray-600'}`}></div>
                <div className={`w-3 h-3 rounded-full transition-all duration-300 ${connections >= 2 ? 'bg-neon-green shadow-[0_0_6px_#0aff00]' : 'bg-gray-600'}`}></div>
            </div>
        );
    };

    return (
        <div
            className="absolute z-30 group"
            style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
            onMouseDown={(e) => onMouseDown(e, id)}
            onMouseUp={(e) => onMouseUp(e, id)}
        >
            <div className={`relative w-14 h-14 rounded-full border-[6px] ${isActive ? 'border-neon-green scale-125' : 'border-gray-700'} ${color} shadow-lg flex items-center justify-center transition-all cursor-crosshair hover:scale-110 hover:border-white z-10`}>
                <div className="w-4 h-4 bg-black/50 rounded-full"></div>
            </div>
            
            {/* Connection Capacity Dots */}
            {renderCapacityDots()}

            {/* Always visible Label (Metal Symbol) */}
            {label && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900/90 border-2 border-gray-600 text-lg font-bold text-white px-4 py-1.5 rounded-lg shadow-lg pointer-events-none whitespace-nowrap z-20">
                    {label}
                </div>
            )}
            
            {/* Hover Tooltip (SubLabel) */}
            {subLabel && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-gray-900/95 border border-neon-blue/50 text-sm text-neon-blue px-4 py-2 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none z-30 transform translate-y-2 group-hover:translate-y-0 tracking-wider font-semibold">
                    {subLabel}
                </div>
            )}
        </div>
    );
};

export const WiringStage: React.FC<WiringStageProps> = ({ 
    team, 
    onUpdate, 
    onConfirm, 
    isSabotageMode = false,
    sabotageType,
    sabotagePayload,
    onSabotageAction,
    hideVoltage = false,
    readOnly = false
}) => {
  const [wires, setWires] = useState<Wire[]>(team.wires || []);
  const [drawingWire, setDrawingWire] = useState<{ start: NodeId, startX: number, startY: number, currX: number, currY: number } | null>(null);
  const [guideMode, setGuideMode] = useState<'none' | 'series'>('none');
  const containerRef = useRef<HTMLDivElement>(null);

  // Real-time Calculation
  const [displayVoltage, setDisplayVoltage] = useState(team.totalVoltage);

  // Helper: check if we are in reverse polarity mode
  const isReverseMode = isSabotageMode && sabotageType === 'REVERSE_POLARITY';

  // --- LOGIC ---
  useEffect(() => {
    if (isSabotageMode && !readOnly) return;

    // Use passed-in team state, but we need to respect the temporary view for sabotage
    // If sabotage mode, we might be previewing a swap, but here we just show current.
    
    // Note: 'isFlipped' is part of the cell state in Team. 
    // calculateCircuitVoltage respects it.
    const voltage = calculateCircuitVoltage(team);
    setDisplayVoltage(voltage);

    if (!readOnly && !isSabotageMode) {
        onUpdate(wires, { red: null, black: null }, voltage, ConnectionType.Custom, {});
    }
  }, [wires, team.cell1, team.cell2, isSabotageMode, readOnly]);

  // Sync props
  useEffect(() => {
      setWires(team.wires || []);
  }, [team.wires]);

  // --- INTERACTIONS ---
  const getRelativeCoords = (e: React.MouseEvent | MouseEvent) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
          x: ((e.clientX - rect.left) / rect.width) * 100,
          y: ((e.clientY - rect.top) / rect.height) * 100
      };
  };

  const handleMouseDown = (e: React.MouseEvent, id: NodeId) => {
      if (readOnly || isSabotageMode) return;
      e.stopPropagation();
      e.preventDefault();
      
      const connectedWiresCount = wires.filter(w => w.from === id || w.to === id).length;
      if (connectedWiresCount >= 2) return;

      const startNode = NODES[id]; 
      setDrawingWire({ 
          start: id, 
          startX: startNode.x, 
          startY: startNode.y, 
          currX: startNode.x, 
          currY: startNode.y 
      });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (drawingWire) {
          const coords = getRelativeCoords(e);
          setDrawingWire(prev => prev ? { ...prev, currX: coords.x, currY: coords.y } : null);
      }
  };

  const handleMouseUpNode = (e: React.MouseEvent, id: NodeId) => {
      if (drawingWire) {
          if (drawingWire.start !== id) {
              const newWire: Wire = {
                  id: `w_${Date.now()}`,
                  from: drawingWire.start,
                  to: id
              };
              
              const targetConnections = wires.filter(w => w.from === id || w.to === id).length;
              if (targetConnections >= 2) {
                   setDrawingWire(null);
                   return;
              }

              const exists = wires.some(w => 
                  (w.from === newWire.from && w.to === newWire.to) ||
                  (w.from === newWire.to && w.to === newWire.from)
              );
              if (!exists) {
                  setWires(prev => [...prev, newWire]);
              }
          }
          setDrawingWire(null);
      }
  };

  const handleGlobalMouseUp = () => {
      setDrawingWire(null);
  };

  const handleWireClick = (id: string) => {
      if (!readOnly && !isSabotageMode) {
          setWires(prev => prev.filter(w => w.id !== id));
      }
  };

  // Handle clicking the specific beaker (for SWAP_ELECTRODE)
  const handleBeakerClick = (cellId: number, slot: 'L' | 'R') => {
      if (isReverseMode) return; // Ignore in reverse mode, container handles it

      if (readOnly && !isSabotageMode) return;
      if (isSabotageMode && onSabotageAction) {
           if (sabotageType === 'SWAP_ELECTRODE' && sabotagePayload) {
              onSabotageAction({ type: 'SWAP_ELECTRODE', cellId, slot, newMetal: sabotagePayload });
           }
      }
  };

  // Handle clicking the entire cell container (for REVERSE_POLARITY)
  const handleCellContainerClick = (cellId: number) => {
      if (readOnly && !isSabotageMode) return;
      
      if (isSabotageMode && onSabotageAction && sabotageType === 'REVERSE_POLARITY') {
           onSabotageAction({ type: 'REVERSE_POLARITY', cellId });
      }
  };

  const clearWires = () => setWires([]);

  // --- RENDERERS ---
  const renderWire = (x1: number, y1: number, x2: number, y2: number, color: string = '#fbbf24', isGhost: boolean = false) => {
      const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      const sag = Math.min(dist * 0.3, 15);
      
      const path = `M ${x1} ${y1} Q ${(x1+x2)/2} ${(y1+y2)/2 + sag} ${x2} ${y2}`;
      const strokeWidth = isGhost ? 0.8 : 1.5;
      const hitAreaWidth = 16; 

      return (
          <>
             <path d={path} stroke="rgba(0,0,0,0.5)" strokeWidth={strokeWidth * 2} fill="none" />
             <path d={path} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeDasharray={isGhost ? '3,3' : ''} />
             <path d={path} stroke="transparent" strokeWidth={hitAreaWidth} fill="none" className="cursor-pointer hover:stroke-white/20" />
          </>
      );
  };

  // Helper to determine metal based on flipped state
  const getPhysicalMetal = (cellId: 1 | 2, side: 'L' | 'R') => {
      const cell = cellId === 1 ? team.cell1 : team.cell2;
      const isFlipped = cell.isFlipped;
      
      // If flipped, L shows R's metal, R shows L's metal
      const effectiveSide = isFlipped 
          ? (side === 'L' ? 'R' : 'L')
          : side;
          
      if (effectiveSide === 'L') return cell.metalL || '?';
      return cell.metalR || '?';
  };

  const getNodeConnections = (id: NodeId) => {
      return wires.filter(w => w.from === id || w.to === id).length;
  };

  return (
    <div className="w-full flex flex-col gap-8 animate-fade-in select-none">
      
      {/* --- HEADER --- */}
      {!readOnly && (
      <div className="flex justify-between items-center px-8 bg-gray-800/50 p-8 rounded-3xl border-2 border-gray-700">
          <div>
              <h2 className="text-4xl font-bold text-white flex items-center gap-4">
                  <Spline className="text-neon-blue w-10 h-10" />
                  <TrilingualText content={{zh: "自由接線區", en: "Laboratory Wiring", ja: "配線実験室"}} />
              </h2>
              <div className="flex gap-6 mt-4">
                   {/* Guide Toggles */}
                   <button 
                       onClick={() => setGuideMode(guideMode === 'series' ? 'none' : 'series')}
                       className={`text-lg px-6 py-3 rounded-xl border-2 flex items-center gap-3 font-bold ${guideMode === 'series' ? 'bg-neon-blue/20 border-neon-blue text-white' : 'border-gray-600 text-gray-400 hover:text-white'}`}
                   >
                       <GitCommitHorizontal size={24} /> Series Guide
                   </button>
              </div>
          </div>
          
          <div className="flex gap-8">
               {!isSabotageMode && (
                   <button 
                        onClick={clearWires}
                        className="px-8 py-4 bg-red-900/50 border-2 border-red-500 rounded-xl text-red-300 hover:bg-red-900 flex items-center gap-3 active:scale-95 transition-transform text-xl font-bold"
                   >
                       <Trash2 size={28} /> Reset
                   </button>
               )}
               
               {!isSabotageMode && (
                   <button 
                        onClick={onConfirm} 
                        className="px-12 py-4 bg-neon-green text-black font-bold rounded-xl hover:scale-105 transition shadow-lg flex items-center gap-4 active:scale-95 text-xl"
                   >
                       <TrilingualText content={{zh: "啟動電路", en: "ENERGIZE", ja: "回路を起動"}} /> <Zap size={28} fill="black" />
                   </button>
               )}
          </div>
      </div>
      )}

      {/* --- BOARD --- */}
      <div 
        ref={containerRef}
        className={`relative w-full aspect-[16/9] bg-[#1e293b] rounded-[3rem] overflow-hidden border-[12px] shadow-2xl ${readOnly ? 'border-yellow-500/50' : 'border-gray-600'}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleGlobalMouseUp}
        onMouseLeave={handleGlobalMouseUp}
      >
        {/* Background Grid */}
        <div className="absolute inset-0 opacity-5 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:5%_5%]"></div>

        {/* --- WIRES SVG --- */}
        <svg 
            className="absolute inset-0 w-full h-full z-20 pointer-events-none overflow-visible"
            viewBox="0 0 100 100" 
            preserveAspectRatio="none"
        >
            {/* Ghost Guides */}
            {guideMode !== 'none' && GUIDE_PATHS[guideMode].map(([from, to], i) => {
                const n1 = NODES[from];
                const n2 = NODES[to];
                return (
                    <g key={`ghost-${i}`} className="opacity-30">
                        {renderWire(n1.x, n1.y, n2.x, n2.y, '#00f3ff', true)}
                    </g>
                );
            })}

            {/* Actual Wires */}
            {wires.map(w => {
                const n1 = NODES[w.from];
                const n2 = NODES[w.to];
                let color = '#fbbf24'; 
                if (w.from.includes('v_pos') || w.to.includes('v_pos')) color = '#ef4444';
                if (w.from.includes('v_neg') || w.to.includes('v_neg')) color = '#374151';

                return (
                    <g key={w.id} onClick={() => handleWireClick(w.id)} className="pointer-events-auto">
                        {renderWire(n1.x, n1.y, n2.x, n2.y, color)}
                    </g>
                );
            })}
            
            {/* Drawing Wire */}
            {drawingWire && (
                <g>
                    {renderWire(drawingWire.startX, drawingWire.startY, drawingWire.currX, drawingWire.currY, '#fff', true)}
                </g>
            )}
        </svg>

        {/* --- COMPONENTS --- */}
        
        {/* VOLTMETER */}
        <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-96 h-48 bg-gray-900 border-8 border-gray-600 rounded-3xl shadow-2xl flex flex-col items-center justify-center z-10">
             <div className="w-80 h-28 bg-[#0f1a0f] rounded-2xl border-2 border-gray-700 flex items-center justify-center px-6 relative overflow-hidden shadow-inner">
                 {hideVoltage ? (
                     <div className="flex items-center gap-4 text-gray-500 font-mono text-5xl animate-pulse">
                         <EyeOff size={48} />
                         <span>---- V</span>
                     </div>
                 ) : (
                     <span className={`font-mono text-6xl font-bold tracking-widest ${displayVoltage > 0 ? 'text-neon-green' : displayVoltage < 0 ? 'text-red-500' : 'text-gray-600'}`} style={{ textShadow: displayVoltage > 0 ? '0 0 15px rgba(10, 255, 0, 0.5)' : 'none' }}>
                         {displayVoltage.toFixed(2)}<span className="text-3xl ml-2">V</span>
                     </span>
                 )}
             </div>
             <div className="flex gap-4 text-sm text-gray-500 mt-3 font-mono">
                 V = V(red) - V(black)
             </div>
        </div>

        {/* CELL 1 */}
        <div className="absolute bottom-[20%] left-[30%] -translate-x-1/2 flex flex-col items-center group z-10">
             {/* Extended Hit Area for Reverse Mode */}
             {isReverseMode && (
                 <div 
                    className="absolute -top-16 -left-12 -right-12 -bottom-12 z-50 cursor-pointer rounded-[3rem] hover:bg-neon-blue/10 transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleCellContainerClick(1);
                    }}
                 />
             )}
        
             <div className="w-56 h-8 bg-gray-700 rounded-t-xl shadow-md absolute -top-8 border-b-2 border-black"></div>
             
             <div className="relative">
                <div 
                    className={`w-56 bg-gray-800/90 p-2 rounded-b-[2rem] border-x-2 border-b-2 border-gray-500 shadow-xl flex justify-center transition-transform duration-500 ${team.cell1.isFlipped ? 'rotate-y-180' : ''} ${isReverseMode ? 'cursor-pointer ring-8 ring-neon-blue ring-offset-8 ring-offset-gray-900 hover:scale-105' : ''}`}
                    style={{ transformStyle: 'preserve-3d' }}
                    onClick={() => !isReverseMode && handleCellContainerClick(1)}
                >
                     <div 
                        className={`p-2 cursor-pointer transition-colors ${!isReverseMode && isSabotageMode ? 'hover:bg-red-500/20' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleBeakerClick(1, 'L'); }}
                     >
                         <HalfCellBeaker metal={team.cell1.metalL} className="scale-90 origin-bottom" label="Left" />
                     </div>
                     <div 
                        className={`p-2 cursor-pointer transition-colors ${!isReverseMode && isSabotageMode ? 'hover:bg-red-500/20' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleBeakerClick(1, 'R'); }}
                     >
                        <HalfCellBeaker metal={team.cell1.metalR} className="scale-90 origin-bottom" label="Right" />
                     </div>
                </div>
             </div>
             <div className="mt-4 font-bold text-gray-500 text-lg flex items-center gap-3">
                 CELL 1 
                 {team.cell1.isFlipped && <span className="text-red-500 text-sm border-2 border-red-500 px-2 rounded-lg font-bold">REVERSED</span>}
             </div>
        </div>

        {/* CELL 2 */}
        <div className="absolute bottom-[20%] left-[70%] -translate-x-1/2 flex flex-col items-center group z-10">
             {/* Extended Hit Area for Reverse Mode */}
             {isReverseMode && (
                 <div 
                    className="absolute -top-16 -left-12 -right-12 -bottom-12 z-50 cursor-pointer rounded-[3rem] hover:bg-neon-blue/10 transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleCellContainerClick(2);
                    }}
                 />
             )}
        
             <div className="w-56 h-8 bg-gray-700 rounded-t-xl shadow-md absolute -top-8 border-b-2 border-black"></div>
             
             <div className="relative">
                <div 
                    className={`w-56 bg-gray-800/90 p-2 rounded-b-[2rem] border-x-2 border-b-2 border-gray-500 shadow-xl flex justify-center transition-transform duration-500 ${team.cell2.isFlipped ? 'rotate-y-180' : ''} ${isReverseMode ? 'cursor-pointer ring-8 ring-neon-blue ring-offset-8 ring-offset-gray-900 hover:scale-105' : ''}`}
                    onClick={() => !isReverseMode && handleCellContainerClick(2)}
                >
                     <div 
                        className={`p-2 cursor-pointer transition-colors ${!isReverseMode && isSabotageMode ? 'hover:bg-red-500/20' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleBeakerClick(2, 'L'); }}
                     >
                         <HalfCellBeaker metal={team.cell2.metalL} className="scale-90 origin-bottom" label="Left" />
                     </div>
                     <div 
                        className={`p-2 cursor-pointer transition-colors ${!isReverseMode && isSabotageMode ? 'hover:bg-red-500/20' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleBeakerClick(2, 'R'); }}
                     >
                        <HalfCellBeaker metal={team.cell2.metalR} className="scale-90 origin-bottom" label="Right" />
                     </div>
                </div>
             </div>
             <div className="mt-4 font-bold text-gray-500 text-lg flex items-center gap-3">
                 CELL 2
                 {team.cell2.isFlipped && <span className="text-red-500 text-sm border-2 border-red-500 px-2 rounded-lg font-bold">REVERSED</span>}
             </div>
        </div>

        {/* --- TERMINALS --- */}
        <TerminalNode id="v_pos" x={42} y={15} color="bg-red-600" onMouseDown={handleMouseDown} onMouseUp={handleMouseUpNode} label="Red (+)" subLabel="Voltmeter (+)" isActive={drawingWire?.start === 'v_pos'} connections={getNodeConnections('v_pos')} />
        <TerminalNode id="v_neg" x={58} y={15} color="bg-black" onMouseDown={handleMouseDown} onMouseUp={handleMouseUpNode} label="Black (-)" subLabel="Voltmeter (-)" isActive={drawingWire?.start === 'v_neg'} connections={getNodeConnections('v_neg')} />
        
        <TerminalNode id="c1_L" x={25} y={68} onMouseDown={handleMouseDown} onMouseUp={handleMouseUpNode} label={getPhysicalMetal(1, 'L')} subLabel="Cell 1 (Left)" isActive={drawingWire?.start === 'c1_L'} connections={getNodeConnections('c1_L')} />
        <TerminalNode id="c1_R" x={35} y={68} onMouseDown={handleMouseDown} onMouseUp={handleMouseUpNode} label={getPhysicalMetal(1, 'R')} subLabel="Cell 1 (Right)" isActive={drawingWire?.start === 'c1_R'} connections={getNodeConnections('c1_R')} />

        <TerminalNode id="c2_L" x={65} y={68} onMouseDown={handleMouseDown} onMouseUp={handleMouseUpNode} label={getPhysicalMetal(2, 'L')} subLabel="Cell 2 (Left)" isActive={drawingWire?.start === 'c2_L'} connections={getNodeConnections('c2_L')} />
        <TerminalNode id="c2_R" x={75} y={68} onMouseDown={handleMouseDown} onMouseUp={handleMouseUpNode} label={getPhysicalMetal(2, 'R')} subLabel="Cell 2 (Right)" isActive={drawingWire?.start === 'c2_R'} connections={getNodeConnections('c2_R')} />

      </div>
    </div>
  );
};
