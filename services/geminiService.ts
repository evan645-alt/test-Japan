
import { GoogleGenAI } from "@google/genai";
import { Team, TrilingualContent } from '../types';

let aiClient: GoogleGenAI | null = null;

const getClient = () => {
    if (!aiClient && process.env.API_KEY) {
        aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return aiClient;
};

export const generateCommentary = async (
    teams: Team[],
    lastAction: string
): Promise<TrilingualContent> => {
    const client = getClient();
    
    // Default fallback if offline
    const fallback: TrilingualContent = {
        zh: "AI 裁判指令：請繼續進行遊戲步驟。",
        en: "AI Referee: Please proceed with the game steps.",
        ja: "AI審判：ゲームの手順を進めてください。"
    };

    if (!client) {
        return fallback;
    }

    const leaderboard = teams
        .sort((a, b) => Math.abs(b.totalVoltage) - Math.abs(a.totalVoltage))
        .map(t => `${t.name}: ${Math.abs(t.totalVoltage).toFixed(2)}V`)
        .join(', ');

    const prompt = `
    You are the "Voltage Wars" Game Instructor.
    
    Context:
    - Current Leaderboard (Magnitude): ${leaderboard}
    - Recent Event/Phase: ${lastAction}

    Task:
    - Provide a concise, clear instruction on what the players need to do NEXT in the game.
    - Do NOT be dramatic. Do NOT be a color commentator. Be a helpful rule guide.
    - Example: "Team A, please draw your components." or "Team B, you must now play your Attack card against the opponent."
    
    IMPORTANT: Return result strictly in JSON format with 'zh', 'en', 'ja' keys.
    `;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });
        
        const text = response.text;
        if (!text) return fallback;

        const parsed = JSON.parse(text);
        return {
            zh: parsed.zh || parsed.en,
            en: parsed.en,
            ja: parsed.ja || parsed.en
        };

    } catch (error) {
        console.error("Gemini API Error:", error);
        return fallback;
    }
};
