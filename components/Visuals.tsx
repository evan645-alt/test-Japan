
import React from 'react';
import { MetalType, TrilingualContent } from '../types';
import { getMetalColor, getSolutionColor } from '../utils';

interface TrilingualTextProps {
    content: TrilingualContent | string; // Handle legacy string or new object
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const TrilingualText: React.FC<TrilingualTextProps> = ({ content, className = '', size = 'md' }) => {
    if (typeof content === 'string') return <span className={className}>{content}</span>;

    // SCALED UP FOR TABLET READABILITY
    const sizeClasses = {
        sm: { zh: 'text-xl', en: 'text-sm', ja: 'text-sm' },
        md: { zh: 'text-3xl', en: 'text-lg', ja: 'text-lg' },
        lg: { zh: 'text-5xl', en: 'text-2xl', ja: 'text-xl' },
        xl: { zh: 'text-7xl', en: 'text-4xl', ja: 'text-3xl' },
    };

    return (
        <div className={`flex flex-col leading-tight ${className}`}>
            <span className={`${sizeClasses[size].zh} font-bold`}>{content.zh}</span>
            <span className={`${sizeClasses[size].en} opacity-90 font-medium`}>{content.en}</span>
            <span className={`${sizeClasses[size].ja} opacity-70`}>{content.ja}</span>
        </div>
    );
};

interface HalfCellBeakerProps {
    metal: MetalType | null;
    label?: string;
    isEmpty?: boolean;
    onClick?: () => void;
    className?: string;
}

export const HalfCellBeaker: React.FC<HalfCellBeakerProps> = ({ metal, label, isEmpty, onClick, className = '' }) => {
    const metalColor = getMetalColor(metal);
    const liquidColor = getSolutionColor(metal);

    return (
        <div 
            className={`relative w-full h-full min-w-[100px] min-h-[140px] flex flex-col items-center select-none ${className}`} 
            onClick={onClick}
        >
            {/* Label */}
            {label && <div className="mb-2 text-sm text-gray-300 font-mono uppercase tracking-widest font-bold">{label}</div>}

            {/* SVG Beaker */}
            <svg width="100%" height="100%" viewBox="0 0 100 120" className="drop-shadow-lg">
                <defs>
                    <linearGradient id={`grad-${metal}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={metalColor} stopOpacity="0.8" />
                        <stop offset="50%" stopColor={metalColor} stopOpacity="1" />
                        <stop offset="100%" stopColor={metalColor} stopOpacity="0.8" />
                    </linearGradient>
                </defs>

                {/* Glass Container */}
                <path 
                    d="M10,10 L10,100 Q10,115 25,115 L75,115 Q90,115 90,100 L90,10" 
                    fill="none" 
                    stroke="rgba(255,255,255,0.3)" 
                    strokeWidth="3" 
                />
                
                {/* Liquid */}
                {!isEmpty && (
                    <path 
                        d="M12,40 L12,100 Q12,113 25,113 L75,113 Q88,113 88,100 L88,40 Z" 
                        fill={liquidColor} 
                    />
                )}

                {/* Electrode */}
                {!isEmpty && metal && (
                    <g>
                        {/* The Rod */}
                        <rect x="35" y="0" width="30" height="95" fill={`url(#grad-${metal})`} stroke="rgba(0,0,0,0.3)" />
                        {/* Metal Symbol Text */}
                        <text x="50" y="55" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold" style={{ textShadow: '2px 2px 3px black' }}>
                            {metal}
                        </text>
                    </g>
                )}

                {/* Empty State */}
                {isEmpty && (
                     <text x="50" y="70" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="14" fontWeight="bold">EMPTY</text>
                )}
            </svg>
        </div>
    );
};
