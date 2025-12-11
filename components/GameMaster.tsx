
import React from 'react';
import { Bot } from 'lucide-react';
import { TrilingualText } from './Visuals';
import { TrilingualContent } from '../types';

interface GameMasterProps {
  commentary: TrilingualContent;
  isLoading?: boolean; // Prop kept for interface compatibility but unused visually
}

export const GameMaster: React.FC<GameMasterProps> = ({ commentary }) => {
  return (
    <div className="w-full glass-panel rounded-2xl p-8 border-l-8 border-neon-purple shadow-lg shadow-neon-purple/10">
      <div className="flex items-center gap-6 mb-6">
        <div className="p-4 rounded-full bg-neon-purple/20 text-neon-purple">
          <Bot size={48} />
        </div>
        <div className="flex flex-col">
            <h2 className="text-2xl font-bold text-white tracking-wider uppercase leading-none">Game Master System</h2>
            <span className="text-sm text-gray-500 mt-1">System Monitoring & Instructions</span>
        </div>
      </div>
      
      <div className="bg-black/30 rounded-xl p-8 min-h-[100px] flex items-center">
        <div className="text-2xl leading-relaxed text-gray-200 font-mono w-full">
            <span className="text-neon-purple text-4xl mr-4 float-left">❝</span>
            <TrilingualText content={commentary} size="lg" className="block" />
        </div>
      </div>
    </div>
  );
};
