// AI Apprentice - Migrated from webroot to TypeScript
interface AIApprenticeConfig {
    errorRate?: number;
    responseDelayMin?: number;
    responseDelayMax?: number;
    personality?: string;
    aiEnabled?: boolean;
}

interface AIApprenticeStats {
    questionsAnswered: number;
    correctAnswers: number;
    averageResponseTime: number;
    currentStreak: number;
    personality: string;
}

interface AIApprenticeResponse {
    selectedAnswer: number;
    isCorrect: boolean;
    responseTime: number;
    comment: string;
    confidence: number;
}

export class AIApprentice {
    private config: Required<AIApprenticeConfig>;
    private stats: AIApprenticeStats;
    private responses: {
        correct: string[];
        incorrect: string[];
        thinking: string[];
    };

    constructor(geminiService: any = null, config: AIApprenticeConfig = {}) {
        this.config = {
            errorRate: config.errorRate || 0.25,
            responseDelayMin: config.responseDelayMin || 2000,
            responseDelayMax: config.responseDelayMax || 5000,
            personality: config.personality || 'friendly',
            aiEnabled: config.aiEnabled || false
        };
        
        this.stats = {
            questionsAnswered: 0,
            correctAnswers: 0,
            averageResponseTime: 3000,
            currentStreak: 0,
            personality: 'The Realm\'s Apprentice'
        };
        
        this.responses = {
            correct: [
                "Excellent! I've been studying the ancient texts! 📚",
                "Ah yes, I remember reading about this! ✨",
                "My training serves me well! 🎯",
                "The knowledge flows through me! 🧠",
                "Another victory for wisdom! 🏆"
            ],
            incorrect: [
                "Hmm, perhaps I need more study time... 🤔",
                "The apprentice still has much to learn! 📖",
                "Even I make mistakes sometimes! 😅",
                "That was trickier than expected! 🎭",
                "My knowledge has gaps to fill! 🔍"
            ],
            thinking: [
                "Let me consult my vast knowledge...",
                "Searching through the archives...",
                "Analyzing the possibilities...",
                "Drawing upon my training...",
                "Contemplating the answer..."
            ]
        };
    }

    async answerQuestion(question: any): Promise<AIApprenticeResponse> {
        const questionText = typeof question === 'string' ? question : question.question;
        const options = typeof question === 'string' ? [] : question.options;
        const correctIndex = typeof question === 'string' ? 0 : question.correct;
        // Show thinking state
        this.showThinking();
        
        // Simulate thinking time
        const thinkingTime = this.getRandomDelay();
        await this.delay(thinkingTime);
        
        let selectedAnswer: number;
        
        if (this.config.aiEnabled) {
            // Use AI to answer the question
            selectedAnswer = await this.getAIAnswer(questionText, options, correctIndex);
        } else {
            // Use rule-based logic
            selectedAnswer = this.getRuleBasedAnswer(questionText, options, correctIndex);
        }
        
        const isCorrect = selectedAnswer === correctIndex;
        
        // Update stats
        this.updateStats(isCorrect, thinkingTime);
        
        return {
            selectedAnswer,
            isCorrect,
            responseTime: thinkingTime,
            comment: this.getResponseComment(isCorrect),
            confidence: this.calculateConfidence(questionText, options)
        };
    }

    private async getAIAnswer(question: string, options: string[], correctIndex: number): Promise<number> {
        try {
            // Create a prompt for the AI to answer as the Apprentice
            const prompt = `You are "The Realm's Apprentice", a friendly AI character in a quiz game. 
            
Answer this question, but remember:
- You should get about ${Math.round(this.config.errorRate * 100)}% of questions wrong to keep the game fair
- Sometimes make believable mistakes that a learning apprentice might make
- Consider the difficulty and your current performance
- Be a worthy but not unbeatable opponent

Question: ${question}
Options: ${options.map((opt, i) => `${i}: ${opt}`).join(', ')}

Respond with just the number (0, 1, 2, or 3) of your chosen answer.`;

            let aiChoice: number | undefined;

            // Try to use server AI endpoint first
            try {
                const response = await fetch('/api/apprentice-answer', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        question: question,
                        options: options,
                        prompt: prompt
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.answer !== undefined) {
                        aiChoice = data.answer;
                        console.log('🤖 AI Apprentice got server response:', data);
                    }
                }
            } catch (serverError) {
                console.warn('Server AI request failed, using rule-based fallback:', serverError);
            }
            
            if (aiChoice === undefined || isNaN(aiChoice) || aiChoice < 0 || aiChoice > 3) {
                // Fallback to rule-based if AI response is invalid
                return this.getRuleBasedAnswer(question, options, correctIndex);
            }
            
            // Apply error rate - sometimes override AI's correct answer for fair gameplay
            if (aiChoice === correctIndex && Math.random() < this.config.errorRate) {
                // Deliberately choose wrong answer to maintain challenge
                const wrongOptions = [0, 1, 2, 3].filter(i => i !== correctIndex);
                return wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
            }
            
            return aiChoice;
            
        } catch (error) {
            console.error('AI Apprentice error:', error);
            // Fallback to rule-based answer
            return this.getRuleBasedAnswer(question, options, correctIndex);
        }
    }

    private async requestAIAnswerFromBackend(prompt: string, question: string, options: string[]): Promise<any> {
        return new Promise((resolve, reject) => {
            const requestId = `apprentice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Set up response listener
            const responseHandler = (event: MessageEvent) => {
                if (event.data && event.data.type === 'apprentice_ai_response' && event.data.requestId === requestId) {
                    window.removeEventListener('message', responseHandler);
                    resolve(event.data);
                }
            };
            
            window.addEventListener('message', responseHandler);
            
            // Send request to Devvit backend
            (window as any).game.sendToDevvit({
                type: 'apprentice_ai_request',
                requestId: requestId,
                prompt: prompt,
                question: question,
                options: options,
                timestamp: Date.now()
            });
            
            // Timeout after 5 seconds
            setTimeout(() => {
                window.removeEventListener('message', responseHandler);
                reject(new Error('AI request timeout'));
            }, 5000);
        });
    }

    private getRuleBasedAnswer(question: string, options: string[], correctIndex: number): number {
        // Simulate apprentice intelligence with some mistakes
        const shouldMakeError = Math.random() < this.config.errorRate;
        
        if (shouldMakeError) {
            // Choose a wrong answer, but make it somewhat intelligent
            const wrongOptions = [0, 1, 2, 3].filter(i => i !== correctIndex);
            
            // Prefer answers that might be common mistakes
            if (question.toLowerCase().includes('not') || question.toLowerCase().includes('except')) {
                // For negative questions, often pick the "obvious" answer
                return wrongOptions[0];
            }
            
            // Otherwise random wrong answer
            return wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
        }
        
        return correctIndex;
    }

    private showThinking() {
        const thinkingMessage = this.responses.thinking[
            Math.floor(Math.random() * this.responses.thinking.length)
        ];
        
        // Dispatch event to show thinking state in UI
        window.dispatchEvent(new CustomEvent('apprenticeThinking', {
            detail: { message: thinkingMessage }
        }));
    }

    private getResponseComment(isCorrect: boolean): string {
        const responses = isCorrect ? this.responses.correct : this.responses.incorrect;
        return responses[Math.floor(Math.random() * responses.length)];
    }

    private calculateConfidence(question: string, options: string[]): number {
        // Simulate confidence based on question complexity and apprentice's knowledge
        let baseConfidence = 0.7;
        
        // Adjust based on question length (longer = more complex)
        if (question.length > 100) baseConfidence -= 0.1;
        if (question.length > 150) baseConfidence -= 0.1;
        
        // Adjust based on current streak
        baseConfidence += Math.min(this.stats.currentStreak * 0.05, 0.2);
        
        // Add some randomness
        baseConfidence += (Math.random() - 0.5) * 0.2;
        
        return Math.max(0.3, Math.min(0.95, baseConfidence));
    }

    private updateStats(isCorrect: boolean, responseTime: number) {
        this.stats.questionsAnswered++;
        
        if (isCorrect) {
            this.stats.correctAnswers++;
            this.stats.currentStreak++;
        } else {
            this.stats.currentStreak = 0;
        }
        
        // Update average response time
        this.stats.averageResponseTime = 
            (this.stats.averageResponseTime * (this.stats.questionsAnswered - 1) + responseTime) / 
            this.stats.questionsAnswered;
    }

    private getRandomDelay(): number {
        return Math.random() * 
            (this.config.responseDelayMax - this.config.responseDelayMin) + 
            this.config.responseDelayMin;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public getStats() {
        return {
            ...this.stats,
            accuracy: this.stats.questionsAnswered > 0 ? 
                Math.round((this.stats.correctAnswers / this.stats.questionsAnswered) * 100) : 0
        };
    }

    public reset() {
        this.stats = {
            questionsAnswered: 0,
            correctAnswers: 0,
            averageResponseTime: 3000,
            currentStreak: 0,
            personality: 'The Realm\'s Apprentice'
        };
    }

    public getGameCommentary(gameState: { playerScore: number; apprenticeScore: number; questionsRemaining: number }): string {
        const { playerScore, apprenticeScore } = gameState;
        
        if (playerScore > apprenticeScore) {
            return [
                "You're quite skilled! I must step up my game! 💪",
                "Impressive knowledge! The student challenges the apprentice! 🎓",
                "Your wisdom grows strong! This is exciting! ⚡"
            ][Math.floor(Math.random() * 3)];
        } else if (apprenticeScore > playerScore) {
            return [
                "My training is paying off! But don't give up! 🌟",
                "The ancient knowledge serves me well! Keep trying! 📚",
                "Experience has its advantages! You're learning fast! 🎯"
            ][Math.floor(Math.random() * 3)];
        } else {
            return [
                "We're evenly matched! This is a true test! ⚖️",
                "Neck and neck! The best battles are close ones! 🏁",
                "Equal wisdom! May the best scholar win! 🤝"
            ][Math.floor(Math.random() * 3)];
        }
    }
}