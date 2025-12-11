
import React, { useState, useEffect } from 'react';
import { Shuffle, ArrowRight, Zap, Play } from 'lucide-react';
import { MetalType, Team, CellConfig, METAL_POTENTIALS } from '../types';
import { drawRandomHand } from '../utils';
import { HalfCellBeaker, TrilingualText } from './Visuals';

interface AssemblyStageProps {
  teamName: string;
  isDrawPhase: boolean;
  existingTeamData?: Team;
  onComplete: (hand: MetalType[], cell1: CellConfig, cell2: CellConfig) => void;
  onUpdate?: (hand: MetalType[], cell1: CellConfig, cell2: CellConfig) => void;
}

export const AssemblyStage: React.FC<AssemblyStageProps> = ({ 
  teamName, 
  isDrawPhase, 
  existingTeamData,
  onComplete,
  onUpdate
}) => {
  // State for Assemble Phase
  const [hand, setHand] = useState<MetalType[]>(existingTeamData?.hand || []);
  const [slots, setSlots] = useState<{
    c1L: MetalType | null;
    c1R: MetalType | null;
    c2L: MetalType | null;
    c2R: MetalType | null;
  }>({
    c1L: existingTeamData?.cell1.metalL || null,
    c1R: existingTeamData?.cell1.metalR || null,
    c2L: existingTeamData?.cell2.metalL || null,
    c2R: existingTeamData?.cell2.metalR || null,
  });

  // Report state changes to parent
  useEffect(() => {
      if (onUpdate) {
        const c1: CellConfig = {
            id: 1,
            metalL: slots.c1L,
            metalR: slots.c1R,
            voltage: 0, 
            polarityL: 'neutral',
            isFlipped: existingTeamData?.cell1.isFlipped // Preserve if exists, though assembly usually resets structure
        };
        const c2: CellConfig = {
            id: 2,
            metalL: slots.c2L,
            metalR: slots.c2R,
            voltage: 0,
            polarityL: 'neutral',
            isFlipped: existingTeamData?.cell2.isFlipped
        };
        onUpdate(hand, c1, c2);
      }
  }, [hand, slots, onUpdate, existingTeamData]);

  // State for Draw Phase Animation
  const [drawingState, setDrawingState] = useState<'IDLE' | 'REVEALING' | 'CONFIRM'>('IDLE');
  const [revealedCount, setRevealedCount] = useState(0);

  // Trigger the draw animation
  const handleStartDraw = () => {
    const newHand = drawRandomHand(6);
    setHand(newHand);
    setDrawingState('REVEALING');
    setRevealedCount(0);
  };

  // Effect to reveal cards one by one
  useEffect(() => {
    if (drawingState === 'REVEALING') {
        if (revealedCount < 6) {
            const timer = setTimeout(() => {
                setRevealedCount(prev => prev + 1);
            }, 600); // 0.6s per card
            return () => clearTimeout(timer);
        } else {
            setDrawingState('CONFIRM');
        }
    }
  }, [drawingState, revealedCount]);

  // Finish Draw Phase
  const handleConfirmDraw = () => {
    // Pass the hand back. The cells are empty at this stage.
    onComplete(hand, { id: 1, metalL: null, metalR: null, voltage: 0, polarityL: 'neutral' }, { id: 2, metalL: null, metalR: null, voltage: 0, polarityL: 'neutral' });
  };

  const handleDragStart = (e: React.DragEvent, metal: MetalType, index: number, source: 'hand' | string) => {
    e.dataTransfer.setData("metal", metal);
    e.dataTransfer.setData("index", index.toString());
    e.dataTransfer.setData("source", source);
  };

  const handleDrop = (e: React.DragEvent, targetSlot: keyof typeof slots) => {
    e.preventDefault();
    const metal = e.dataTransfer.getData("metal") as MetalType;
    const sourceIndex = parseInt(e.dataTransfer.getData("index"));
    const source = e.dataTransfer.getData("source");

    const newSlots = { ...slots };
    const newHand = [...hand];
    const existingInSlot = newSlots[targetSlot];

    // Remove from source logic
    if (source === 'hand') {
        newHand.splice(sourceIndex, 1);
    } else if (source !== targetSlot) {
        // If coming from another slot (and not the same slot)
        newSlots[source as keyof typeof slots] = null;
    } else {
        // Same slot drop, do nothing
        return;
    }

    // If target slot is occupied, move that card back to hand
    if (existingInSlot) {
        newHand.push(existingInSlot);
    }

    // Place new card
    newSlots[targetSlot] = metal;
    
    setSlots(newSlots);
    setHand(newHand);
  };

  const handleReturnToHand = (e: React.DragEvent) => {
      e.preventDefault();
      const metal = e.dataTransfer.getData("metal") as MetalType;
      const source = e.dataTransfer.getData("source");
      
      // If dropped on hand container but came from hand, do nothing (reordering not implemented for simplicity, or just ignore)
      if (source === 'hand') return;

      const newSlots = { ...slots };
      // Clear the slot it came from
      if (newSlots[source as keyof typeof slots] === metal) {
          newSlots[source as keyof typeof slots] = null;
      }
      
      setSlots(newSlots);
      setHand([...hand, metal]);
  };

  const allowDrop = (e: React.DragEvent) => e.preventDefault();

  const handleSubmitAssembly = () => {
    const c1: CellConfig = {
        id: 1,
        metalL: slots.c1L,
        metalR: slots.c1R,
        voltage: 0, 
        polarityL: 'neutral'
    };
    const c2: CellConfig = {
        id: 2,
        metalL: slots.c2L,
        metalR: slots.c2R,
        voltage: 0,
        polarityL: 'neutral'
    };
    onComplete(hand, c1, c2);
  };

  // --- RENDER HELPERS ---

  const renderCard = (metal: MetalType, idx: number, source: string, animated: boolean = false) => (
    <div
        key={`${metal}-${idx}-${source}`}
        draggable={!isDrawPhase} // Only draggable in Assemble phase
        onDragStart={(e) => handleDragStart(e, metal, idx, source)}
        className={`relative ${animated ? 'animate-bounce-in' : ''} ${!isDrawPhase ? 'cursor-grab hover:scale-110 active:scale-95' : ''} transition-all duration-300`}
    >
        <div className={`w-32 h-48 bg-gray-200 rounded-2xl border-4 border-gray-400 flex flex-col items-center justify-center shadow-lg relative overflow-hidden group`}>
             {/* Metal Gradient Background Hint */}
             <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-white to-black"></div>
             
             <div className="text-6xl font-bold text-gray-800 z-10">{metal}</div>
             <div className="text-lg text-gray-600 font-mono mt-3 z-10 font-bold">{METAL_POTENTIALS[metal]}V</div>
             
             {/* Shine Effect */}
             <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-40 group-hover:animate-shine" />
        </div>
    </div>
  );

  const renderSlot = (key: keyof typeof slots, label: string) => (
      <div 
        onDrop={(e) => handleDrop(e, key)}
        onDragOver={allowDrop}
        className={`p-3 rounded-3xl border-4 border-dashed transition-colors relative h-64 w-44 flex flex-col items-center justify-center ${slots[key] ? 'border-neon-green bg-green-900/10' : 'border-gray-600 bg-black/20 hover:border-gray-400'}`}
      >
          {slots[key] ? (
              <>
                <HalfCellBeaker 
                    metal={slots[key]} 
                    isEmpty={false} 
                    label={label}
                    className="scale-110"
                />
                <div 
                    draggable 
                    onDragStart={(e) => handleDragStart(e, slots[key]!, 0, key)}
                    className="absolute inset-0 cursor-grab z-10"
                    title="Drag to move or remove"
                />
              </>
          ) : (
              <span className="text-gray-500 text-base uppercase font-bold text-center px-2 leading-tight">{label}</span>
          )}
      </div>
  );

  // --- RENDER: DRAW PHASE ---

  if (isDrawPhase) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[700px] space-y-16 animate-fade-in text-center">
            <h2 className="text-7xl font-bold text-white mb-8">
                <TrilingualText content={{zh: `${teamName}: 獲取組件`, en: `${teamName}: Component Acquisition`, ja: `${teamName}: コンポーネント取得`}} size="xl" />
            </h2>
            
            {drawingState === 'IDLE' && (
                <button 
                    onClick={handleStartDraw}
                    className="group relative px-20 py-12 bg-neon-blue/10 border-4 border-neon-blue rounded-[2rem] hover:bg-neon-blue/20 transition overflow-hidden"
                >
                    <div className="absolute inset-0 bg-neon-blue/10 blur-xl opacity-0 group-hover:opacity-100 transition duration-500"></div>
                    <div className="relative flex flex-col items-center gap-6">
                        <Shuffle size={64} className="text-neon-blue animate-pulse" />
                        <TrilingualText content={{zh: "啟動抽取程序", en: "INITIATE DRAW SEQUENCE", ja: "ドローシーケンス開始"}} className="text-white" size="xl" />
                    </div>
                </button>
            )}

            {(drawingState === 'REVEALING' || drawingState === 'CONFIRM') && (
                <div className="w-full max-w-[95%]">
                    <div className="flex flex-wrap justify-center gap-10 min-h-[300px] perspective-1000">
                        {hand.slice(0, revealedCount).map((m, i) => renderCard(m, i, 'deck', true))}
                    </div>
                    
                    <div className="mt-20 h-24">
                        {drawingState === 'CONFIRM' ? (
                             <button 
                                onClick={handleConfirmDraw}
                                className="bg-neon-green text-black px-16 py-8 rounded-2xl font-bold text-4xl hover:scale-105 transition flex items-center gap-6 mx-auto animate-bounce-in shadow-2xl"
                            >
                                <TrilingualText content={{zh: "確認手牌", en: "CONFIRM HAND", ja: "手札を確認"}} />
                                <ArrowRight size={48} />
                            </button>
                        ) : (
                            <div className="flex items-center justify-center gap-6 text-neon-blue">
                                <Zap className="animate-spin w-10 h-10" />
                                <span className="font-mono text-3xl font-bold">MATERIALIZING...</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      );
  }

  // --- RENDER: ASSEMBLY PHASE ---

  return (
    <div className="w-full max-w-[95%] mx-auto space-y-10 animate-fade-in pb-24">
        <div className="flex justify-between items-center border-b-2 border-gray-700 pb-8">
            <h2 className="text-5xl font-bold text-white">
                <TrilingualText content={{zh: `${teamName}: 電池組裝`, en: `${teamName}: Cell Assembly`, ja: `${teamName}: 電池の組み立て`}} size="xl" />
            </h2>
            <button 
                onClick={handleSubmitAssembly}
                className="bg-neon-green text-black font-bold px-12 py-6 rounded-2xl hover:bg-green-400 transition flex items-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed text-2xl shadow-xl"
                disabled={!slots.c1L || !slots.c1R || !slots.c2L || !slots.c2R} 
            >
                <TrilingualText content={{zh: "確認設計", en: "CONFIRM DESIGN", ja: "設計を確認"}} className="font-bold" />
                <ArrowRight size={32} />
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            {/* Cell 1 */}
            <div className="glass-panel p-10 rounded-[2rem] flex flex-col items-center border-2 border-gray-700">
                <h3 className="text-neon-blue font-bold mb-8 flex items-center gap-4 text-3xl">
                    <Zap size={32} /> CELL 1
                </h3>
                <div className="flex gap-12 items-end relative justify-center w-full">
                    {/* Bridge Graphic */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-16 border-t-8 border-dashed border-gray-500 rounded-t-full z-0 opacity-50"></div>
                    
                    <div className="relative z-10">{renderSlot('c1L', 'Left Electrode')}</div>
                    <div className="relative z-10">{renderSlot('c1R', 'Right Electrode')}</div>
                </div>
            </div>

            {/* Cell 2 */}
            <div className="glass-panel p-10 rounded-[2rem] flex flex-col items-center border-2 border-gray-700">
                <h3 className="text-neon-blue font-bold mb-8 flex items-center gap-4 text-3xl">
                    <Zap size={32} /> CELL 2
                </h3>
                <div className="flex gap-12 items-end relative justify-center w-full">
                    {/* Bridge Graphic */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-16 border-t-8 border-dashed border-gray-500 rounded-t-full z-0 opacity-50"></div>
                    
                    <div className="relative z-10">{renderSlot('c2L', 'Left Electrode')}</div>
                    <div className="relative z-10">{renderSlot('c2R', 'Right Electrode')}</div>
                </div>
            </div>
        </div>

        {/* Hand */}
        <div className="glass-panel p-10 rounded-[2rem] border-t-4 border-gray-700">
            <h4 className="text-xl text-gray-400 mb-6 uppercase tracking-wider font-bold">
                <TrilingualText content={{zh: "可用組件 (拖曳至上方)", en: "Available Components (Drag to slots)", ja: "利用可能なコンポーネント"}} />
            </h4>
            <div 
                onDrop={handleReturnToHand}
                onDragOver={allowDrop}
                className="min-h-[240px] flex items-center justify-center bg-black/40 rounded-3xl p-8 border-4 border-dashed border-gray-700"
                data-source="hand"
            >
                <div className="flex flex-wrap gap-8 justify-center">
                    {hand.map((m, i) => renderCard(m, i, 'hand'))}
                    {hand.length === 0 && <span className="text-gray-500 italic text-2xl">No components in hand.</span>}
                </div>
            </div>
        </div>
    </div>
  );
};
