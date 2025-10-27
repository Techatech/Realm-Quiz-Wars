// Gemini Question Generator - Migrated from webroot to TypeScript
import type { Question } from '../shared/types/api';

interface PlayerStats {
    accuracy: number;
    averageTime: number;
    preferredDifficulty: string;
}

export class GeminiQuestionGenerator {
    private apiKey: string;
    private model: any = null;
    private isInitialized: boolean = false;
    private fallbackQuestions: { [key: string]: Question[] };

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.fallbackQuestions = this.initializeFallbackQuestions();
    }

    async initialize(): Promise<boolean> {
        try {
            // Import Gemini SDK dynamically (will be loaded from CDN in production)
            const GoogleGenerativeAI = (window as any).GoogleGenerativeAI;

            if (!this.apiKey || !GoogleGenerativeAI) {
                console.warn('🔑 No Gemini API key or SDK provided, using fallback questions');
                return false;
            }

            const genAI = new GoogleGenerativeAI(this.apiKey);
            this.model = genAI.getGenerativeModel({ model: "gemini-pro" });
            this.isInitialized = true;

            console.log('✅ Gemini AI initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Gemini AI:', error);
            return false;
        }
    }

    async generateQuestions(realm: string, difficulty: string = 'medium', count: number = 6): Promise<Question[]> {
        if (!this.isInitialized || !this.model) {
            console.log('🔄 Using fallback questions - Gemini not available');
            return this.getFallbackQuestions(realm, count);
        }

        try {
            const prompt = this.createPrompt(realm, difficulty, count);
            console.log('🤖 Generating questions with Gemini for:', realm);

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const questions = this.parseGeminiResponse(text);

            if (questions.length === 0) {
                console.warn('⚠️ No valid questions generated, using fallback');
                return this.getFallbackQuestions(realm, count);
            }

            console.log(`✅ Generated ${questions.length} questions for ${realm}`);
            return questions;

        } catch (error) {
            console.error('❌ Error generating questions with Gemini:', error);
            return this.getFallbackQuestions(realm, count);
        }
    }

    private createPrompt(realm: string, difficulty: string, count: number): string {
        const difficultyDescriptions = {
            easy: 'basic knowledge that most people familiar with the topic would know',
            medium: 'intermediate knowledge requiring some expertise or experience',
            hard: 'advanced knowledge that only experts or enthusiasts would know'
        };

        return `Generate ${count} multiple choice quiz questions about ${realm} with ${difficulty} difficulty (${difficultyDescriptions[difficulty as keyof typeof difficultyDescriptions]}).

Requirements:
- Each question should have exactly 4 answer options
- Only one correct answer per question
- Questions should be engaging and test real knowledge
- Avoid overly obscure trivia unless difficulty is "hard"
- Make questions relevant to the ${realm} community
- Include a mix of factual, conceptual, and application-based questions

Format your response as a JSON array with this exact structure:
[
  {
    "question": "Your question here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "difficulty": "${difficulty}",
    "explanation": "Brief explanation of the correct answer"
  }
]

Important: Return ONLY the JSON array, no additional text or formatting.`;
    }

    private parseGeminiResponse(text: string): Question[] {
        try {
            // Clean up the response text
            let cleanText = text.trim();

            // Remove markdown code blocks if present
            cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

            // Try to find JSON array in the response
            const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                cleanText = jsonMatch[0];
            }

            const questions = JSON.parse(cleanText);

            // Validate and clean questions
            return questions.filter((q: any) =>
                q.question &&
                Array.isArray(q.options) &&
                q.options.length === 4 &&
                typeof q.correct === 'number' &&
                q.correct >= 0 &&
                q.correct < 4
            ).map((q: any) => ({
                question: q.question,
                options: q.options,
                correct: q.correct,
                difficulty: q.difficulty || 'medium',
                explanation: q.explanation || '',
                source: 'gemini'
            }));

        } catch (error) {
            console.error('❌ Error parsing Gemini response:', error);
            console.log('Raw response:', text);
            return [];
        }
    }

    private getFallbackQuestions(realm: string, count: number): Question[] {
        const realmQuestions = this.fallbackQuestions[realm] || this.fallbackQuestions['general'];
        return this.shuffleArray(realmQuestions).slice(0, count);
    }

    private shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    private initializeFallbackQuestions(): { [key: string]: Question[] } {
        return {
            'r/gaming': [
                {
                    question: "Which game popularized the battle royale genre?",
                    options: ["Fortnite", "PUBG", "Apex Legends", "Call of Duty"],
                    correct: 1,
                    difficulty: "medium" as const,
                    topic: "Gaming History"
                },
                {
                    question: "What does 'RPG' stand for in gaming?",
                    options: ["Real Player Game", "Role Playing Game", "Rapid Play Gaming", "Random Player Generator"],
                    correct: 1,
                    difficulty: "easy" as const,
                    topic: "Gaming Terminology"
                },
                {
                    question: "Which company developed the Half-Life series?",
                    options: ["Blizzard", "Valve", "EA", "Ubisoft"],
                    correct: 1,
                    difficulty: "medium" as const,
                    topic: "Game Developers"
                },
                {
                    question: "What year was the original Super Mario Bros. released?",
                    options: ["1983", "1985", "1987", "1989"],
                    correct: 1,
                    difficulty: "medium" as const,
                    topic: "Gaming History"
                },
                {
                    question: "Which gaming console introduced the concept of achievements/trophies?",
                    options: ["PlayStation 2", "Xbox 360", "Nintendo Wii", "PlayStation 3"],
                    correct: 1,
                    difficulty: "hard" as const,
                    topic: "Gaming Technology"
                }
            ],
            'r/science': [
                {
                    question: "What is the speed of light in a vacuum?",
                    options: ["299,792,458 m/s", "300,000,000 m/s", "299,000,000 m/s", "301,000,000 m/s"],
                    correct: 0,
                    difficulty: "hard" as const,
                    topic: "Physics"
                },
                {
                    question: "Which element has the chemical symbol 'Au'?",
                    options: ["Silver", "Gold", "Aluminum", "Argon"],
                    correct: 1,
                    difficulty: "medium" as const,
                    topic: "Chemistry"
                },
                {
                    question: "What is the powerhouse of the cell?",
                    options: ["Nucleus", "Mitochondria", "Ribosome", "Endoplasmic Reticulum"],
                    correct: 1,
                    difficulty: "easy" as const,
                    topic: "Biology"
                }
            ],
            'r/movies': [
                {
                    question: "Who directed the movie 'Inception'?",
                    options: ["Steven Spielberg", "Christopher Nolan", "Martin Scorsese", "Quentin Tarantino"],
                    correct: 1,
                    difficulty: "medium" as const,
                    topic: "Film Directors"
                },
                {
                    question: "Which movie won the Academy Award for Best Picture in 2020?",
                    options: ["1917", "Joker", "Parasite", "Once Upon a Time in Hollywood"],
                    correct: 2,
                    difficulty: "hard" as const,
                    topic: "Academy Awards"
                }
            ],
            'general': [
                {
                    question: "What is the largest planet in our solar system?",
                    options: ["Saturn", "Jupiter", "Neptune", "Earth"],
                    correct: 1,
                    difficulty: "easy" as const,
                    topic: "Astronomy"
                },
                {
                    question: "Which programming language is known as the 'language of the web'?",
                    options: ["Python", "Java", "JavaScript", "C++"],
                    correct: 2,
                    difficulty: "medium" as const,
                    topic: "Programming"
                },
                {
                    question: "What is the capital of Australia?",
                    options: ["Sydney", "Melbourne", "Canberra", "Perth"],
                    correct: 2,
                    difficulty: "medium" as const,
                    topic: "Geography"
                }
            ]
        };
    }

    // Method to generate questions for specific topics within a realm
    async generateTopicQuestions(realm: string, topic: string, difficulty: string = 'medium', count: number = 3): Promise<Question[]> {
        if (!this.isInitialized || !this.model) {
            return this.getFallbackQuestions(realm, count);
        }

        try {
            const prompt = `Generate ${count} multiple choice quiz questions specifically about "${topic}" within the context of ${realm}.

Make the questions ${difficulty} difficulty and highly relevant to "${topic}".

Format as JSON array:
[
  {
    "question": "Question about ${topic}?",
    "options": ["A", "B", "C", "D"],
    "correct": 0,
    "difficulty": "${difficulty}",
    "explanation": "Why this answer is correct"
  }
]

Return ONLY the JSON array.`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const questions = this.parseGeminiResponse(text);
            return questions.length > 0 ? questions : this.getFallbackQuestions(realm, count);

        } catch (error) {
            console.error('❌ Error generating topic questions:', error);
            return this.getFallbackQuestions(realm, count);
        }
    }

    // Method to generate adaptive questions based on player performance
    async generateAdaptiveQuestions(realm: string, playerStats: PlayerStats, count: number = 6): Promise<Question[]> {
        const { accuracy, averageTime, preferredDifficulty } = playerStats;

        let targetDifficulty = 'medium';
        if (accuracy > 80) targetDifficulty = 'hard';
        else if (accuracy < 50) targetDifficulty = 'easy';

        return await this.generateQuestions(realm, targetDifficulty, count);
    }
}