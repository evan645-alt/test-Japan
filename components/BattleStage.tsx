
import React, { useState, useEffect } from 'react';
import { ShieldAlert, Zap, Skull, ArrowRight, User, Swords, Layers, Shuffle, Target, UserPlus } from 'lucide-react';
import { Team, ChanceCard, GamePhase, MetalType } from '../types';
import { TrilingualText } from './Visuals';
import { WiringStage } from './WiringStage';

interface BattleStageProps {
  phase: string;
  activeTeam: Team;
  opponentTeam: Team;
  onDrawCards: () => void; // Trigger animation end
  onPlayCard: (card: ChanceCard, targetData?: any) => void;
  onSkip: () => void;
}

export const BattleStage: React.FC<BattleStageProps> = ({ 
  phase, 
  activeTeam, 
  opponentTeam, 
  onDrawCards, 
  onPlayCard,
  onSkip 
}) => {
  const [selectedCard, setSelectedCard] = useState<ChanceCard | null>(null);
  const [showZeroVoltageWarning, setShowZeroVoltageWarning] = useState(false);
  const [pendingActionData, setPendingActionData] = useState<any>(null);
  
  // New state for Flexible Phase Target Switching
  const [targetScope, setTargetScope] = useState<'SELF' | 'OPPONENT'>('OPPONENT');

  const isJointDraw = phase === GamePhase.JOINT_DRAW_ANIMATION;
  
  // Phase Logic
  const isAction1 = phase === GamePhase.A_ACTION_1 || phase === GamePhase.B_ACTION_1; // Mandatory Attack
  const isAction2 = phase === GamePhase.A_ACTION_2 || phase === GamePhase.B_ACTION_2; // Mandatory Self Buff
  const isAction3 = phase === GamePhase.A_ACTION_3 || phase === GamePhase.B_ACTION_3; // Optional Flexible

  // Effect to lock target scope based on phase rules
  useEffect(() => {
      if (isAction1) setTargetScope('OPPONENT');
      if (isAction2) setTargetScope('SELF');
      // For Action 3, default to Opponent but allow change, so we don't force reset on every render if user changed it
      if (isAction3 && !selectedCard) setTargetScope('OPPONENT'); 
  }, [phase, isAction1, isAction2, isAction3]);

  // Determine which board to show based on scope
  const targetTeam = targetScope === 'OPPONENT' ? opponentTeam : activeTeam;

  const handleCardSelect = (card: ChanceCard) => {
      setSelectedCard(card);
  };

  const handleSabotageAction = (actionData: any) => {
      if (!selectedCard) return;
      setPendingActionData({ ...actionData, targetScope }); // Include scope in data passed up
      setShowZeroVoltageWarning(true);
  };

  const confirmAction = () => {
      if (selectedCard && pendingActionData) {
          onPlayCard(selectedCard, pendingActionData);
          setSelectedCard(null);
          setShowZeroVoltageWarning(false);
          setPendingActionData(null);
      }
  };

  // --- JOINT DRAW ANIMATION SCREEN ---
  if (isJointDraw) {
      return (
          <div className="text-center py-24 animate-fade-in flex flex-col items-center">
              <h2 className="text-5xl font-bold text-white mb-12">
                  <TrilingualText content={{zh: "雙方同步抽牌 (3張)", en: "Joint Card Draw (3 Cards)", ja: "両チーム同時ドロー (3枚)"}} size="xl" />
              </h2>
              
              <div className="relative group cursor-pointer" onClick={onDrawCards}>
                   {/* Deck Graphic - Double Size/Stacked */}
                   <div className="flex gap-8 justify-center">
                       {/* Left Pile */}
                       <div className="w-60 h-96 bg-gradient-to-br from-purple-900 to-indigo-900 rounded-3xl border-8 border-neon-blue shadow-[0_0_50px_rgba(0,243,255,0.3)] flex items-center justify-center transform -rotate-6">
                           <Layers size={96} className="text-white opacity-50" />
                       </div>
                       {/* Right Pile */}
                       <div className="w-60 h-96 bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl border-8 border-neon-purple shadow-[0_0_50px_rgba(188,19,254,0.3)] flex items-center justify-center transform rotate-6">
                           <Layers size={96} className="text-white opacity-50" />
                       </div>
                   </div>
                   
                   <div className="mt-16 px-12 py-6 bg-neon-blue text-black font-bold rounded-full animate-pulse mx-auto w-fit cursor-pointer hover:scale-105 transition active:scale-95 text-2xl shadow-xl">
                       CLICK TO DISTRIBUTE CARDS
                   </div>
              </div>
          </div>
      );
  }

  // Helper text for instruction
  const getActionInstruction = (card: ChanceCard) => {
      if (card.effectType === 'REVERSE_POLARITY') {
          return {
              zh: `目標：${targetTeam.name} - 請點擊整個電池進行反轉`, 
              en: `Target: ${targetTeam.name} - Click Battery to Reverse Polarity`, 
              ja: `ターゲット: ${targetTeam.name} - 極性を反転させる電池をクリック`
          };
      }
      return {
          zh: `目標：${targetTeam.name} - 請點擊電極進行更換`, 
          en: `Target: ${targetTeam.name} - Click electrode to replace`, 
          ja: `ターゲット: ${targetTeam.name} - 電極をクリックして交換`
      };
  };

  // --- ACTION SCREEN ---
  return (
    <div className="w-full mx-auto space-y-8 animate-fade-in relative">
        {/* Warning Modal */}
        {showZeroVoltageWarning && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-gray-900 border-4 border-red-500 rounded-3xl p-12 max-w-2xl text-center shadow-2xl">
                    <Skull size={96} className="mx-auto text-red-500 mb-6 animate-pulse" />
                    <h3 className="text-4xl font-bold text-white mb-4">
                        <TrilingualText content={{zh: "確認執行操作？", en: "Confirm Action?", ja: "アクションを確認"}} size="xl" />
                    </h3>
                    <p className="text-gray-300 mb-10 text-xl">
                        <TrilingualText content={{
                            zh: `您確定要將 ${selectedCard?.title.zh} 使用在 ${targetTeam.name} 身上嗎？`, 
                            en: `Use ${selectedCard?.title.en} on ${targetTeam.name}?`, 
                            ja: `${targetTeam.name} に ${selectedCard?.title.ja} を使用しますか？`
                        }} size="lg" />
                    </p>
                    <div className="flex gap-8 justify-center">
                        <button onClick={() => setShowZeroVoltageWarning(false)} className="px-10 py-5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold active:scale-95 transition-transform text-xl">
                            CANCEL
                        </button>
                        <button onClick={confirmAction} className="px-10 py-5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold active:scale-95 transition-transform text-xl">
                            EXECUTE
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
            <h2 className="text-5xl font-bold text-white flex justify-center items-center gap-4">
                {isAction1 && <Swords className="text-red-500 w-12 h-12" />}
                {isAction2 && <ShieldAlert className="text-green-500 w-12 h-12" />}
                {isAction3 && <Target className="text-yellow-500 w-12 h-12" />}
                
                {isAction1 && <TrilingualText content={{zh: "第一階段：強制攻擊", en: "Phase 1: Mandatory Attack", ja: "第1フェーズ：強制攻撃"}} size="xl" />}
                {isAction2 && <TrilingualText content={{zh: "第二階段：自我強化", en: "Phase 2: Self Buff", ja: "第2フェーズ：自己強化"}} size="xl" />}
                {isAction3 && <TrilingualText content={{zh: "第三階段：自由戰略", en: "Phase 3: Flexible Strategy", ja: "第3フェーズ：自由戦略"}} size="xl" />}
            </h2>
            <div className="text-gray-400 mt-4 text-xl">
                {isAction1 && <TrilingualText content={{zh: "必須選擇一張牌使用在對手身上。", en: "You MUST use a card on the OPPONENT.", ja: "対戦相手にカードを使用しなければなりません。"}} size="lg" />}
                {isAction2 && <TrilingualText content={{zh: "必須選擇一張牌使用在自己身上。", en: "You MUST use a card on YOURSELF.", ja: "自分自身にカードを使用しなければなりません。"}} size="lg" />}
                {isAction3 && <TrilingualText content={{zh: "選擇攻擊對手、強化自己，或跳過。", en: "Target Opponent, Self, or Skip.", ja: "対戦相手を攻撃、自分を強化、またはスキップを選択してください。"}} size="lg" />}
            </div>
        </div>

        {/* Flexible Phase Target Toggle */}
        {isAction3 && !selectedCard && (
            <div className="flex justify-center mb-8">
                <div className="bg-gray-900 p-2 rounded-2xl flex border-2 border-gray-700">
                    <button 
                        onClick={() => setTargetScope('OPPONENT')}
                        className={`px-8 py-4 rounded-xl flex items-center gap-3 transition-all text-lg ${targetScope === 'OPPONENT' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                    >
                        <Swords size={24} /> <span className="font-bold">Target Opponent</span>
                    </button>
                    <button 
                        onClick={() => setTargetScope('SELF')}
                        className={`px-8 py-4 rounded-xl flex items-center gap-3 transition-all text-lg ${targetScope === 'SELF' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                    >
                        <UserPlus size={24} /> <span className="font-bold">Target Self</span>
                    </button>
                </div>
            </div>
        )}

        {/* Card Selection */}
        <div className="glass-panel p-10 rounded-3xl mb-10 min-h-[300px] flex flex-col justify-center">
             <div className="flex flex-wrap gap-8 justify-center">
                {activeTeam.chanceHand.length === 0 ? (
                    <div className="text-gray-500 italic flex items-center gap-3 text-2xl">
                        <Layers size={32} /> No cards remaining.
                    </div>
                ) : (
                    activeTeam.chanceHand.map(card => {
                        const isSelected = selectedCard?.id === card.id;
                        
                        return (
                            <div 
                                key={card.id}
                                onClick={() => handleCardSelect(card)}
                                className={`w-80 p-8 rounded-2xl border-4 transition-all duration-200 cursor-pointer hover:-translate-y-2 active:scale-95 active:translate-y-0 ${
                                    isSelected
                                    ? 'border-neon-blue bg-blue-900/40 shadow-xl scale-105' 
                                    : 'border-gray-600 bg-gray-900 hover:border-gray-400'
                                }`}
                            >
                                <div className="flex justify-between items-center mb-6 border-b border-gray-700/50 pb-4">
                                    <div className="flex items-center gap-3">
                                        <Shuffle size={24} className="text-neon-blue" />
                                        <span className="text-sm font-bold uppercase text-neon-blue">ELEMENT</span>
                                    </div>
                                </div>
                                <TrilingualText content={card.title} className="text-white font-bold mb-4" size="lg" />
                                <TrilingualText content={card.description} className="text-gray-500" size="md" />
                            </div>
                        );
                    })
                )}
                
                {isAction3 && (
                     <button 
                        onClick={onSkip}
                        className="w-48 p-4 rounded-2xl border-4 border-dashed border-gray-600 text-gray-500 hover:text-white hover:border-white flex flex-col items-center justify-center transition-all duration-200 ml-4 hover:-translate-y-1 active:scale-95 active:translate-y-0"
                    >
                        <ArrowRight size={48} className="mb-4" />
                        <TrilingualText content={{zh: "跳過", en: "SKIP", ja: "スキップ"}} size="lg" />
                    </button>
                )}
             </div>
        </div>

        {/* Interactive Board Area */}
        {selectedCard ? (
            <div className="animate-slide-up border-t-2 border-gray-700 pt-8">
                <div className={`p-6 mb-8 text-center text-white rounded-2xl flex items-center justify-center gap-4 ${targetScope === 'OPPONENT' ? 'bg-red-900/20 border-2 border-red-500/50' : 'bg-green-900/20 border-2 border-green-500/50'}`}>
                    <Zap size={32} className={targetScope === 'OPPONENT' ? 'text-red-400' : 'text-green-400'} />
                    <TrilingualText 
                        content={getActionInstruction(selectedCard)}
                        size="lg" 
                        className="font-bold"
                    />
                </div>
                
                {/* Change Selection Button (Only for Phase 3 if user wants to swap target) */}
                {isAction3 && (
                    <div className="flex justify-center mb-6">
                        <button onClick={() => setSelectedCard(null)} className="text-lg text-gray-400 hover:text-white underline">
                            Cancel Selection & Change Strategy
                        </button>
                    </div>
                )}
                
                {/* Board Render - Auto-renders the correct target based on phase */}
                <div className="scale-100">
                    <WiringStage 
                        team={targetTeam} 
                        onUpdate={() => {}} // Read-only physics
                        onConfirm={() => {}} 
                        isSabotageMode={true}
                        sabotageType={selectedCard.effectType}
                        sabotagePayload={selectedCard.metalPayload}
                        onSabotageAction={handleSabotageAction}
                        hideVoltage={true} // FORCE HIDE VOLTAGE DURING ACTION
                    />
                </div>
            </div>
        ) : (
            <div className="h-80 flex items-center justify-center border-4 border-dashed border-gray-800 rounded-3xl text-gray-600 bg-black/20">
                <TrilingualText content={{zh: "請選擇一張卡片", en: "Please select a card", ja: "カードを選択してください"}} size="xl" />
            </div>
        )}
    </div>
  );
};
