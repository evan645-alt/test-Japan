
import React, { useState, useEffect, useRef } from 'react';
import { Layers, Timer, Zap, ArrowRight, Dna, Shuffle, RotateCcw, Link2, ArrowRightLeft } from 'lucide-react';
import { MetalType, DraggableCard, WorkbenchState, ConnectionType, PolarityType, Team, METAL_POTENTIALS } from '../types';
import { drawRandomHand, calculateCellVoltage } from '../utils';

interface PreparationStageProps {
    teamName: string;
    onComplete: (setupData: Partial<Team>) => void;
}

const DURATION_SECONDS = 180; // 3 Minutes

export const PreparationStage: React.FC<PreparationStageProps> = ({ teamName, onComplete }) => {
    const [phase, setPhase] = useState<'DRAW' | 'WORKBENCH'>('DRAW');
    const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS);
    
    // State
    const [state, setState] = useState<WorkbenchState>({
        hand: [],
        slots: { c1Left: null, c1Right: null, c2Left: null, c2Right: null },
        connection: ConnectionType.Series,
        polarity: PolarityType.Standard,
    });

    // Timer Logic
    useEffect(() => {
        if (phase === 'WORKBENCH' && timeLeft > 0) {
            const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
            return () => clearInterval(timer);
        } else if (phase === 'WORKBENCH' && timeLeft === 0) {
            handleSubmit(); // Auto-submit on timeout
        }
    }, [phase, timeLeft]);

    // Draw Phase Handler
    const handleDraw = () => {
        const drawnMetals = drawRandomHand(6);
        const cards: DraggableCard[] = drawnMetals.map((m, idx) => ({
            id: `card-${idx}-${Date.now()}`,
            metal: m
        }));
        setState(prev => ({ ...prev, hand: cards }));
        setPhase('WORKBENCH');
    };

    // Drag & Drop Handlers
    const handleDragStart = (e: React.DragEvent, card: DraggableCard, source: string) => {
        e.dataTransfer.setData("cardId", card.id);
        e.dataTransfer.setData("source", source); // 'hand' or slot key
    };

    const handleDrop = (e: React.DragEvent, targetSlot: string) => {
        e.preventDefault();
        const cardId = e.dataTransfer.getData("cardId");
        const source = e.dataTransfer.getData("source");
        
        // Find the card
        let card: DraggableCard | undefined;
        let newHand = [...state.hand];
        let newSlots = { ...state.slots };

        // Remove from source
        if (source === 'hand') {
            const idx = newHand.findIndex(c => c.id === cardId);
            if (idx > -1) {
                card = newHand[idx];
                newHand.splice(idx, 1);
            }
        } else {
            // Source was another slot
            card = newSlots[source as keyof typeof state.slots] as DraggableCard;
            newSlots[source as keyof typeof state.slots] = null;
        }

        if (!card) return;

        // Check if target is occupied
        const targetKey = targetSlot as keyof typeof state.slots;
        const existingCard = newSlots[targetKey];

        // If occupied, swap back to hand (simple swap logic)
        if (existingCard) {
            newHand.push(existingCard);
        }

        // Place card
        newSlots[targetKey] = card;

        setState(prev => ({ ...prev, hand: newHand, slots: newSlots }));
    };

    const handleReturnToHand = (e: React.DragEvent) => {
        e.preventDefault();
        const cardId = e.dataTransfer.getData("cardId");
        const source = e.dataTransfer.getData("source");

        if (source === 'hand') return; // Already in hand

        const newSlots = { ...state.slots };
        const card = newSlots[source as keyof typeof state.slots];
        newSlots[source as keyof typeof state.slots] = null;

        if (card) {
            setState(prev => ({
                ...prev,
                slots: newSlots,
                hand: [...prev.hand, card]
            }));
        }
    };

    const allowDrop = (e: React.DragEvent) => e.preventDefault();

    // Calculation Preview
    const getPreview = () => {
        const { slots, connection, polarity } = state;
        
        const getV = (c1: DraggableCard | null, c2: DraggableCard | null) => {
            if (!c1 || !c2) return 0;
            return calculateCellVoltage(c1.metal, c2.metal);
        };

        const v1 = getV(slots.c1Left, slots.c1Right);
        const v2 = getV(slots.c2Left, slots.c2Right);
        
        let total = 0;
        if (connection === ConnectionType.Series) {
            total = polarity === PolarityType.Standard ? v1 + v2 : Math.abs(v1 - v2);
        } else {
            const diff = Math.abs(v1 - v2);
            total = diff < 0.1 ? (v1 + v2) / 2 : Math.max(v1, v2) * 0.8;
        }
        return { v1, v2, total: Math.round(total * 100) / 100 };
    };

    const preview = getPreview();

    const handleSubmit = () => {
        const { slots, connection, polarity } = state;
        
        // Construct partial team data
        // If slots are empty, default to Zn (or handle as 0V in logic, here we just fill safely to avoid crash)
        // Ideally, empty slots = broken circuit (0V).
        
        const safeMetal = (c: DraggableCard | null): MetalType => c ? c.metal : MetalType.Zn; 
        const isBroken1 = !slots.c1Left || !slots.c1Right;
        const isBroken2 = !slots.c2Left || !slots.c2Right;

        const teamData: Partial<Team> = {
            cell1: { 
                id: 1, 
                metalL: safeMetal(slots.c1Left), 
                metalR: safeMetal(slots.c1Right), 
                isBypassed: isBroken1, // Empty slots count as bypassed/broken
                voltage: 0,
                polarityL: 'neutral'
            },
            cell2: { 
                id: 2, 
                metalL: safeMetal(slots.c2Left), 
                metalR: safeMetal(slots.c2Right), 
                isBypassed: isBroken2, 
                voltage: 0,
                polarityL: 'neutral'
            },
            connectionType: connection,
            isPolarityReversed: polarity === PolarityType.Reverse
        };
        onComplete(teamData);
    };

    // --- Renderers ---

    const renderCard = (card: DraggableCard, source: string) => (
        <div
            draggable
            onDragStart={(e) => handleDragStart(e, card, source)}
            className="w-20 h-28 bg-white text-black rounded-lg border-2 border-gray-300 shadow-lg flex flex-col items-center justify-center cursor-grab hover:scale-105 active:scale-95 transition-transform"
        >
            <span className="text-2xl font-bold">{card.metal}</span>
            <span className="text-xs text-gray-500 mt-1">{METAL_POTENTIALS[card.metal]}V</span>
            <div className="mt-2 text-[10px] text-gray-400 font-mono tracking-tighter truncate w-full text-center px-1">
                {card.id.split('-')[2]}
            </div>
        </div>
    );

    const renderSlot = (slotKey: keyof typeof state.slots, label: string) => {
        const card = state.slots[slotKey];
        return (
            <div 
                onDrop={(e) => handleDrop(e, slotKey)}
                onDragOver={allowDrop}
                className={`w-24 h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${
                    card ? 'border-neon-blue bg-neon-blue/10' : 'border-gray-600 bg-gray-900/50 hover:border-gray-400'
                }`}
            >
                {card ? renderCard(card, slotKey) : <span className="text-gray-600 text-xs font-bold uppercase">{label}</span>}
            </div>
        );
    };

    if (phase === 'DRAW') {
        return (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center space-y-8 animate-fade-in">
                <div className="p-4 bg-neon-blue/10 rounded-full mb-4">
                    <Shuffle size={64} className="text-neon-blue animate-pulse" />
                </div>
                <h2 className="text-4xl font-bold text-white">Team {teamName}</h2>
                <p className="text-gray-400 max-w-md">
                    Initiate the Quantum Materializer to receive 6 random Half-Cell components for your battery assembly.
                </p>
                <button 
                    onClick={handleDraw}
                    className="group relative px-8 py-4 bg-transparent overflow-hidden rounded-lg"
                >
                    <div className="absolute inset-0 w-3 bg-neon-blue transition-all duration-[250ms] ease-out group-hover:w-full opacity-20"></div>
                    <span className="relative flex items-center gap-3 text-2xl font-bold text-neon-blue group-hover:text-white">
                        <Dna size={24} /> DRAW COMPONENTS
                    </span>
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header: Timer & Submit */}
            <div className="flex justify-between items-center glass-panel p-4 rounded-xl">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-white">Workbench: {teamName}</h2>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded font-mono text-xl font-bold ${timeLeft < 30 ? 'bg-red-900/50 text-red-500 animate-pulse' : 'bg-gray-800 text-neon-green'}`}>
                        <Timer size={20} />
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                </div>
                <div className="flex items-center gap-6">
                     <div className="text-right">
                        <span className="text-xs text-gray-400 uppercase block">Projected Voltage</span>
                        <span className={`text-2xl font-mono font-bold ${preview.total > 2.5 ? 'text-red-500' : 'text-neon-blue'}`}>
                            {preview.total.toFixed(2)}V
                        </span>
                     </div>
                     <button 
                        onClick={handleSubmit}
                        className="bg-neon-green text-black font-bold px-6 py-2 rounded hover:bg-green-400 transition flex items-center gap-2"
                     >
                        DEPLOY <ArrowRight size={18} />
                     </button>
                </div>
            </div>

            {/* Main Workbench Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Battery 1 */}
                <div className="glass-panel p-6 rounded-xl flex flex-col items-center">
                    <h3 className="text-neon-blue font-bold mb-4 flex items-center gap-2">
                        <Zap size={16} /> CELL ALPHA
                    </h3>
                    <div className="flex gap-4 items-center">
                        {renderSlot('c1Left', 'Slot A')}
                        <div className="h-1 w-8 bg-gray-600"></div>
                        {renderSlot('c1Right', 'Slot B')}
                    </div>
                    <div className="mt-4 font-mono text-sm text-gray-400">
                        Potential: <span className="text-white">{preview.v1.toFixed(2)}V</span>
                    </div>
                </div>

                {/* Connection Hub */}
                <div className="flex flex-col justify-center space-y-4">
                    <div className="glass-panel p-4 rounded-xl border border-gray-700">
                        <label className="text-xs text-gray-400 uppercase mb-2 block">Connection Mode</label>
                        <div className="grid grid-cols-2 gap-2 bg-black/30 p-1 rounded">
                            <button 
                                onClick={() => setState(s => ({ ...s, connection: ConnectionType.Series }))}
                                className={`py-2 text-sm font-bold rounded flex flex-col items-center justify-center gap-1 ${state.connection === ConnectionType.Series ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                            >
                                <Link2 size={16} /> Series
                            </button>
                            <button 
                                onClick={() => setState(s => ({ ...s, connection: ConnectionType.Parallel }))}
                                className={`py-2 text-sm font-bold rounded flex flex-col items-center justify-center gap-1 ${state.connection === ConnectionType.Parallel ? 'bg-teal-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                            >
                                <Layers size={16} /> Parallel
                            </button>
                        </div>
                    </div>

                    {state.connection === ConnectionType.Series && (
                        <div className="glass-panel p-4 rounded-xl border border-indigo-500/30 animate-fade-in">
                            <label className="text-xs text-indigo-300 uppercase mb-2 block flex items-center gap-1">
                                <ArrowRightLeft size={12} /> Series Polarity
                            </label>
                            <div className="space-y-2">
                                <button 
                                    onClick={() => setState(s => ({ ...s, polarity: PolarityType.Standard }))}
                                    className={`w-full py-2 px-3 rounded text-left text-xs border ${state.polarity === PolarityType.Standard ? 'bg-indigo-900/50 border-indigo-500 text-white' : 'border-transparent text-gray-500 hover:bg-gray-800'}`}
                                >
                                    <div className="font-bold">Standard (+ to -)</div>
                                    <div className="opacity-70">Voltage Adds Up</div>
                                </button>
                                <button 
                                    onClick={() => setState(s => ({ ...s, polarity: PolarityType.Reverse }))}
                                    className={`w-full py-2 px-3 rounded text-left text-xs border ${state.polarity === PolarityType.Reverse ? 'bg-red-900/50 border-red-500 text-white' : 'border-transparent text-gray-500 hover:bg-gray-800'}`}
                                >
                                    <div className="font-bold">Reverse (+ to +)</div>
                                    <div className="opacity-70">Voltage Subtracts</div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Battery 2 */}
                <div className="glass-panel p-6 rounded-xl flex flex-col items-center">
                    <h3 className="text-neon-blue font-bold mb-4 flex items-center gap-2">
                        <Zap size={16} /> CELL BETA
                    </h3>
                    <div className="flex gap-4 items-center">
                        {renderSlot('c2Left', 'Slot A')}
                        <div className="h-1 w-8 bg-gray-600"></div>
                        {renderSlot('c2Right', 'Slot B')}
                    </div>
                    <div className="mt-4 font-mono text-sm text-gray-400">
                        Potential: <span className="text-white">{preview.v2.toFixed(2)}V</span>
                    </div>
                </div>

            </div>

            {/* Hand / Deck */}
            <div 
                className="glass-panel p-6 rounded-xl min-h-[160px] flex items-center justify-center border-t-2 border-neon-purple/50 bg-gradient-to-b from-gray-900 to-black"
                onDrop={handleReturnToHand}
                onDragOver={allowDrop}
                data-source="hand"
            >
                {state.hand.length === 0 ? (
                    <div className="text-gray-600 italic flex items-center gap-2">
                        <Zap size={16} /> No components remaining.
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-4 justify-center">
                        {state.hand.map(card => renderCard(card, 'hand'))}
                    </div>
                )}
            </div>
            <div className="text-center text-xs text-gray-500 mt-2">
                Drag components into slots above. Return them here to swap.
            </div>
        </div>
    );
};