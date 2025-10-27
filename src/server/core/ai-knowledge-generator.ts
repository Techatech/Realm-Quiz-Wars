import { redis } from '@devvit/web/server';
import { configService } from './config-service';

export interface QuizQuestion {
    question: string;
    options: string[];
    correct: number;
    difficulty: 'easy' | 'medium' | 'hard';
    topic: string;
}

export class AIKnowledgeGenerator {
    private readonly apiEndpoints = {
        gemini: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
    };

    /**
     * Get API key from Devvit settings or environment variables (server-side)
     */
    private async getGeminiApiKey(): Promise<string | null> {
        try {
            // Try to get from Devvit settings first (async)
            const devvitKey = await configService.getDevvitSettingAsync('geminiApiKey');
            if (devvitKey) {
                console.log('🔑 Using Gemini API key from Devvit settings');
                return devvitKey;
            }

            // Fallback to config service (which checks env vars)
            const apiKey = configService.getGeminiAPIKey();
            if (apiKey) {
                console.log('🔑 Using Gemini API key from environment variables');
                return apiKey;
            }

            console.warn('⚠️ No Gemini API key found in Devvit settings or environment');
            return null;
        } catch (error) {
            console.error('Failed to get Gemini API key:', error);
            return null;
        }
    }

    /**
     * Generate quiz questions based on subreddit topic analysis
     */
    async generateQuestionsForRealm(subredditName: string, difficulty: 'easy' | 'medium' | 'hard' = 'medium'): Promise<QuizQuestion[]> {
        try {
            console.log(`🤖 Generating questions for r/${subredditName} (${difficulty})`);
            
            // Check if we have cached questions
            const cacheKey = `questions_${subredditName}_${difficulty}`;
            const cached = await redis.get(cacheKey);
            if (cached) {
                console.log('📚 Using cached questions');
                return JSON.parse(cached);
            }

            // Generate new questions
            const questions = await this.generateQuestionsFromTopics(
                this.getDefaultTopicsForRealm(subredditName), 
                difficulty
            );
            
            // Cache for 1 hour
            if (questions.length > 0) {
                await redis.set(cacheKey, JSON.stringify(questions), { expiration: new Date(Date.now() + 3600 * 1000) });
            }
            
            return questions.length > 0 ? questions : this.getFallbackQuestions(subredditName);
        } catch (error) {
            console.error(`Failed to generate questions for ${subredditName}:`, error);
            return this.getFallbackQuestions(subredditName);
        }
    }

    /**
     * Generate quiz questions from identified topics
     */
    private async generateQuestionsFromTopics(topics: string[], difficulty: string): Promise<QuizQuestion[]> {
        const prompt = `
            Create 5 multiple choice quiz questions based on these topics: ${topics.join(', ')}.
            
            Requirements:
            - Difficulty level: ${difficulty}
            - Each question should have 4 options
            - Questions should be engaging and test real knowledge
            - Include a mix of factual and conceptual questions
            - Make questions appropriate for Reddit users
            
            Return as JSON array with this exact structure:
            [
                {
                    "question": "Question text",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correct": 0,
                    "difficulty": "${difficulty}",
                    "topic": "relevant topic"
                }
            ]
        `;

        try {
            const response = await this.callGeminiModel(prompt);
            const questions = JSON.parse(response);
            return Array.isArray(questions) ? questions : [];
        } catch (error) {
            console.error('Question generation failed:', error);
            return [];
        }
    }

    /**
     * Call Google Gemini model using server-side fetch
     */
    private async callGeminiModel(prompt: string): Promise<string> {
        try {
            const apiKey = await this.getGeminiApiKey();
            
            if (!apiKey) {
                throw new Error('Gemini API key not configured');
            }

            const response = await fetch(this.apiEndpoints.gemini, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey,
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024,
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as any;
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Gemini API call failed:', error);
            throw error;
        }
    }

    /**
     * Get default topics for a realm
     */
    private getDefaultTopicsForRealm(subredditName: string): string[] {
        const defaultTopics: Record<string, string[]> = {
            'r/gaming': ['Video Games', 'Game Development', 'Gaming Hardware', 'Esports', 'Game Reviews'],
            'r/science': ['Physics', 'Biology', 'Chemistry', 'Research', 'Scientific Discovery'],
            'r/technology': ['Software', 'Hardware', 'AI', 'Programming', 'Tech News'],
            'r/movies': ['Film Industry', 'Directors', 'Actors', 'Movie Reviews', 'Cinema History'],
            'r/music': ['Artists', 'Albums', 'Music Theory', 'Instruments', 'Music History']
        };

        return defaultTopics[subredditName] || ['General Knowledge', 'Current Events', 'Science', 'Technology', 'Culture'];
    }

    /**
     * Fallback questions when AI generation fails
     */
    private getFallbackQuestions(subredditName: string): QuizQuestion[] {
        const fallbackQuestions: Record<string, QuizQuestion[]> = {
            'r/gaming': [
                {
                    question: "Which company developed the Unreal Engine?",
                    options: ["Unity Technologies", "Epic Games", "Valve Corporation", "id Software"],
                    correct: 1,
                    difficulty: "medium",
                    topic: "Game Development"
                },
                {
                    question: "What does 'RPG' stand for in gaming?",
                    options: ["Real Player Game", "Role Playing Game", "Rapid Progression Game", "Random Player Generator"],
                    correct: 1,
                    difficulty: "easy",
                    topic: "Gaming Terms"
                },
                {
                    question: "Which game popularized the battle royale genre?",
                    options: ["Fortnite", "PUBG", "Apex Legends", "Call of Duty"],
                    correct: 1,
                    difficulty: "medium",
                    topic: "Gaming History"
                }
            ],
            'r/science': [
                {
                    question: "What is the chemical symbol for gold?",
                    options: ["Go", "Gd", "Au", "Ag"],
                    correct: 2,
                    difficulty: "medium",
                    topic: "Chemistry"
                },
                {
                    question: "How many chambers does a human heart have?",
                    options: ["2", "3", "4", "5"],
                    correct: 2,
                    difficulty: "easy",
                    topic: "Biology"
                },
                {
                    question: "What is the speed of light in a vacuum?",
                    options: ["299,792,458 m/s", "300,000,000 m/s", "299,000,000 m/s", "301,000,000 m/s"],
                    correct: 0,
                    difficulty: "hard",
                    topic: "Physics"
                }
            ]
        };

        const questions = fallbackQuestions[subredditName] || fallbackQuestions['r/science'];
        return questions.slice(0, 5);
    }

    /**
     * Public method to call AI model for any purpose
     */
    async callAIModel(prompt: string, task: string = 'general'): Promise<string> {
        console.log(`🤖 AI task: ${task}`);
        return await this.callGeminiModel(prompt);
    }

    /**
     * Generate challenge questions for player vs player battles
     */
    async generateChallengeQuestions(playerRealm: string, opponentRealm: string): Promise<QuizQuestion[]> {
        try {
            const prompt = `
                Create 3 challenging quiz questions that would be fair for a battle between 
                r/${playerRealm} and r/${opponentRealm} communities.
                
                Mix topics from both realms and include some general knowledge.
                Make them engaging and competitive.
                
                Return as JSON array with the standard QuizQuestion structure.
            `;

            const response = await this.callGeminiModel(prompt);
            return JSON.parse(response);
        } catch (error) {
            console.error('Challenge generation failed:', error);
            return this.getFallbackQuestions(playerRealm).slice(0, 3);
        }
    }
}