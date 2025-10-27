// Reddit Realm Quiz Wars - Complete Game Logic (Enhanced Migration from webroot)
import { AudioService } from './audio-service';
import { AIApprentice } from './ai-apprentice';
import { GeminiQuestionGenerator } from './gemini-service';
import { getConfig } from './config';
import type { InitResponse, GameCompleteResponse, LeaderboardResponse, GameResult } from '../shared/types/api';
import type { Question } from '../shared/types/api';

interface GameState {
    currentPlayer: any;
    gameMode: string | null;
    currentQuestion: any;
    questionIndex: number;
    score: number;
    timeLeft: number;
    opponent: any;
    realm: string | null;
    realmTopic: string | null;
    leaderboard: Map<string, any>;
    gameStarted: boolean;
    questionsAnswered: number;
    correctAnswers: number;
    aiEnabled: boolean;
    generatingQuestions: boolean;
    // Turn-based system
    currentTurn: 'player' | 'apprentice';
    turnBased: boolean;
    apprenticeAnswering: boolean;
    apprenticeResponse: any;
    waitingForApprentice: boolean;
    // New screen system
    currentScreen: 'splash' | 'main-menu' | 'battle' | 'leaderboard' | 'profile' | 'settings';
}

interface GameConfig {
    aiEnabled: boolean;
    apprenticeAI: boolean;
    apprenticeConfig: {
        errorRate: number;
        responseDelayMin: number;
        responseDelayMax: number;
        personality: string;
    };
    environment: string;
    debugMode: boolean;
    multiplayerEnabled: boolean;
    realmBattlesEnabled: boolean;
    hasGeminiKey: boolean;
}

interface Level {
    name: string;
    minScore: number;
    minBattles: number;
    minAccuracy: number;
    icon: string;
    color: string;
}

// Question interface is imported from shared types

export class RedditRealmQuizWars {
    private gameState: GameState;
    private knowledgeBase: any;
    private timer: NodeJS.Timeout | null = null;
    private currentQuestionSet: Question[] = [];
    private isLocalMode: boolean = false;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private audioService!: AudioService;
    private aiApprentice: AIApprentice | null = null;
    private geminiService: GeminiQuestionGenerator | null = null;
    private gameConfig!: GameConfig;
    private levels!: Level[];
    private serverQuestions: Question[] = [];
    private realPlayerData: any = null;
    private availableOpponents: any[] = [];
    private playerLevel: any = null;

    constructor() {
        console.log('🚀 Initializing Reddit Realm Quiz Wars...');

        this.gameState = {
            currentPlayer: null,
            gameMode: null, // 'single', 'multiplayer', 'realm-battle'
            currentQuestion: null,
            questionIndex: 0,
            score: 0,
            timeLeft: 30,
            opponent: null,
            realm: null,
            realmTopic: null,
            leaderboard: new Map(),
            gameStarted: false,
            questionsAnswered: 0,
            correctAnswers: 0,
            aiEnabled: false,
            generatingQuestions: false,
            // Turn-based system
            currentTurn: 'player',
            turnBased: false,
            apprenticeAnswering: false,
            apprenticeResponse: null,
            waitingForApprentice: false,
            // New screen system
            currentScreen: 'splash'
        };

        try {
            this.knowledgeBase = this.initializeKnowledgeBase();
            this.audioService = new AudioService();
            this.gameConfig = this.initializeGameConfig();
            this.levels = this.initializeLevels();

            console.log('📚 Knowledge base initialized');

            // Initialize AI services asynchronously
            this.initializeAIServices().then(() => {
                console.log('🤖 AI services initialized');
            }).catch(error => {
                console.warn('⚠️ AI services initialization failed:', error);
            });

            // Start initialization
            this.init().catch(error => {
                console.error('❌ Game initialization failed:', error);
            });
        } catch (error) {
            console.error('❌ Constructor error:', error);
        }
    }

    private initializeGameConfig(): GameConfig {
        const config = getConfig();
        return {
            aiEnabled: config.hasGeminiKey,
            apprenticeAI: config.APPRENTICE_AI_ENABLED,
            apprenticeConfig: {
                errorRate: config.APPRENTICE_ERROR_RATE,
                responseDelayMin: config.APPRENTICE_RESPONSE_DELAY_MIN,
                responseDelayMax: config.APPRENTICE_RESPONSE_DELAY_MAX,
                personality: 'eager'
            },
            environment: config.NODE_ENV,
            debugMode: config.DEBUG_MODE,
            multiplayerEnabled: config.ENABLE_MULTIPLAYER,
            realmBattlesEnabled: config.ENABLE_REALM_BATTLES,
            hasGeminiKey: config.hasGeminiKey
        };
    }

    private async initializeAIServices() {
        try {
            // Initialize AI Apprentice if enabled
            if (this.gameConfig.apprenticeAI) {
                console.log('🤖 Initializing AI Apprentice...');
                this.aiApprentice = new AIApprentice(this.gameConfig.apprenticeConfig);
                console.log('✅ AI Apprentice initialized');
            }

            // Initialize Gemini Service if API key is available
            if (this.gameConfig.hasGeminiKey) {
                console.log('🧠 Initializing Gemini AI Service...');
                // The actual API key is handled server-side for security
                // We'll use a placeholder here and let the service handle the real key
                this.geminiService = new GeminiQuestionGenerator('server-managed');
                console.log('✅ Gemini AI Service initialized');
            }
        } catch (error) {
            console.error('❌ Error initializing AI services:', error);
        }
    }

    private initializeLevels(): Level[] {
        return [
            { name: 'Apprentice Scholar', minScore: 0, minBattles: 0, minAccuracy: 0, icon: '📚', color: '#8B4513' },
            { name: 'Knowledge Seeker', minScore: 500, minBattles: 3, minAccuracy: 60, icon: '🔍', color: '#4682B4' },
            { name: 'Realm Defender', minScore: 1200, minBattles: 8, minAccuracy: 65, icon: '🛡️', color: '#228B22' },
            { name: 'Quiz Warrior', minScore: 2000, minBattles: 15, minAccuracy: 70, icon: '⚔️', color: '#FF6347' },
            { name: 'Battle Master', minScore: 3500, minBattles: 25, minAccuracy: 75, icon: '🏆', color: '#FF8C00' },
            { name: 'Realm Champion', minScore: 5500, minBattles: 40, minAccuracy: 80, icon: '👑', color: '#9932CC' },
            { name: 'Knowledge Sage', minScore: 8000, minBattles: 60, minAccuracy: 85, icon: '🧙', color: '#4B0082' },
            { name: 'Grand Master', minScore: 12000, minBattles: 85, minAccuracy: 88, icon: '🌟', color: '#FFD700' },
            { name: 'Legendary Oracle', minScore: 18000, minBattles: 120, minAccuracy: 90, icon: '🔮', color: '#FF1493' },
            { name: 'Omniscient Being', minScore: 25000, minBattles: 150, minAccuracy: 95, icon: '✨', color: '#00CED1' }
        ];
    }

    async init() {
        console.log('🎯 Starting game initialization...');

        try {
            console.log('🎯 Step 1: Showing splash screen...');
            this.showSplashScreen();

            console.log('🎯 Step 2: Loading game data...');
            await this.loadGameData();

            console.log('🎯 Step 3: Initializing player...');
            await this.initializePlayer();

            console.log('🎯 Step 4: Setting up event listeners...');
            this.setupEventListeners();

            console.log('🎯 Step 5: Setting up backend communication...');
            this.setupBackendCommunication();

            console.log('✅ Game initialization complete - waiting for user to start');
        } catch (error) {
            console.error('❌ Game initialization failed:', error);
            // Show error message to user
            const app = document.getElementById('app');
            if (app) {
                app.innerHTML = `
                    <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: var(--dark-bg); color: white; text-align: center; padding: 2rem;">
                        <div>
                            <h1>🚨 Game Loading Error</h1>
                            <p>Something went wrong while loading the game.</p>
                            <p style="font-size: 0.9rem; color: #ccc; margin-top: 1rem;">Check the browser console for details.</p>
                            <button id="reload-btn" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                Reload Game
                            </button>
                        </div>
                    </div>
                `;

                // Add event listener for reload button
                const reloadBtn = document.getElementById('reload-btn');
                if (reloadBtn) {
                    reloadBtn.addEventListener('click', () => location.reload());
                }
            }
        }
    }

    setupBackendCommunication() {
        // Check if we're running in Devvit environment or locally
        this.isLocalMode = !window.parent || window.location.hostname === 'localhost';

        if (this.isLocalMode) {
            console.log('🏠 Running in local mode - backend features disabled');
            return;
        }

        // Notify backend that player is online
        this.sendMessageToBackend({
            type: 'playerOnline',
            playerId: this.gameState.currentPlayer.id,
            availableForChallenge: true
        });

        // Set up periodic heartbeat
        this.heartbeatInterval = setInterval(() => {
            this.sendMessageToBackend({
                type: 'playerOnline',
                playerId: this.gameState.currentPlayer.id,
                availableForChallenge: true
            });
        }, 30000); // Every 30 seconds

        // Handle page unload
        window.addEventListener('beforeunload', () => {
            this.clearHeartbeat();
            this.sendMessageToBackend({
                type: 'playerOffline',
                playerId: this.gameState.currentPlayer.id
            });
        });

        // Load player challenges
        this.loadPlayerChallenges();
    }

    sendMessageToBackend(message: any) {
        // Only send messages if not in local mode
        if (this.isLocalMode) {
            console.log('Local mode: Backend message ignored:', message.type);
            return;
        }

        // In a real Devvit app, this would use the webview messaging API
        if (window.parent && window.parent.postMessage) {
            window.parent.postMessage(message, '*');
        }
    }

    async loadPlayerChallenges() {
        if (this.isLocalMode) {
            // In local mode, show no challenges
            return;
        }

        this.sendMessageToBackend({
            type: 'getPlayerChallenges',
            playerId: this.gameState.currentPlayer.id
        });
    }

    showSplashScreen() {
        console.log('🎮 Showing splash screen...');
        const app = document.getElementById('app');
        if (!app) {
            console.error('❌ App element not found!');
            console.error('❌ Available elements:', document.querySelectorAll('*').length);
            console.error('❌ Document ready state:', document.readyState);
            return;
        }

        console.log('✅ App element found:', app);

        try {
            app.innerHTML = `
                <div class="splash-screen">
                    <div class="splash-logo">🃏 REALM QUIZ WARS</div>
                    <div class="splash-subtitle">
                        Battle through knowledge across Reddit realms!<br>
                        Challenge communities, master topics, become the ultimate Quiz Champion!
                    </div>
                    <button class="start-game-btn" id="start-game-btn">
                        🎮 Start Game
                    </button>
                </div>
            `;

            console.log('✅ Splash screen HTML set');

            // Add event listener for start button
            const startBtn = document.getElementById('start-game-btn');
            if (startBtn) {
                startBtn.addEventListener('click', () => this.startGame());
                console.log('✅ Start button event listener added');
            } else {
                console.error('❌ Start button not found after setting HTML');
            }
            console.log('✅ Splash screen rendered successfully');
        } catch (error) {
            console.error('❌ Error rendering splash screen:', error);
        }
    }

    async hideSplashScreen() {
        setTimeout(() => {
            const splash = document.querySelector('.splash-screen');
            splash?.classList.add('fade-out');

            setTimeout(async () => {
                // Ensure player is initialized before rendering main interface
                if (!this.gameState.currentPlayer) {
                    await this.initializePlayer();
                }
                this.renderMainInterface();
            }, 800);
        }, 2500);
    }

    async loadGameData() {
        console.log('📡 Loading game data from server...');
        try {
            // Load initial game data from server
            const response = await fetch('/api/init');
            if (response.ok) {
                const data: InitResponse = await response.json();
                console.log('✅ Server data loaded:', data);

                // Store server questions
                this.serverQuestions = data.questions;
                console.log('📚 Server questions loaded:', this.serverQuestions.length, 'questions');
                console.log('📚 First server question:', this.serverQuestions[0]);

                // Store real player data
                this.realPlayerData = {
                    username: data.username,
                    realm: data.realm,
                    stats: data.playerStats
                };

                // Load leaderboard
                await this.loadLeaderboard(data.realm);

                console.log('✅ Game data loaded successfully');
            } else {
                console.warn('⚠️ Failed to load from server, using fallback data');
                this.loadFallbackData();
            }
        } catch (error) {
            console.error('❌ Failed to load game data:', error);
            this.loadFallbackData();
        }
    }

    private loadFallbackData() {
        console.log('📦 Loading fallback data...');
        this.gameState.leaderboard = new Map([
            ['r/gaming', { master: 'GameMaster2024', score: 2850, battles: 45 }],
            ['r/science', { master: 'QuantumQuizzer', score: 2720, battles: 38 }],
            ['r/movies', { master: 'CinemaChamp', score: 2650, battles: 42 }],
            ['r/technology', { master: 'TechWizard', score: 2580, battles: 35 }],
            ['r/askreddit', { master: 'CuriousKnow', score: 2450, battles: 40 }],
            ['r/funny', { master: 'ComedyKing', score: 2380, battles: 33 }]
        ]);
    }

    private async loadLeaderboard(realm: string) {
        try {
            const response = await fetch(`/api/leaderboard?realm=${realm}`);
            if (response.ok) {
                const data: LeaderboardResponse = await response.json();

                // Convert leaderboard array to Map format
                const leaderboardMap = new Map();
                data.leaderboard.forEach(entry => {
                    leaderboardMap.set(entry.realm, {
                        master: entry.username,
                        score: entry.score,
                        battles: entry.battlesWon + entry.battlesLost
                    });
                });

                this.gameState.leaderboard = leaderboardMap;
                console.log('✅ Leaderboard loaded');
            }
        } catch (error) {
            console.error('❌ Failed to load leaderboard:', error);
        }
    }

    async initializePlayer() {
        console.log('👤 Initializing player...');

        if (this.realPlayerData) {
            // Use real player data from server
            this.gameState.currentPlayer = {
                id: 'user_' + Math.random().toString(36).substr(2, 9),
                username: this.realPlayerData.username,
                realm: this.realPlayerData.realm,
                score: this.realPlayerData.stats?.score || 0,
                level: this.calculatePlayerLevel(this.realPlayerData.stats?.score || 0),
                battlesWon: this.realPlayerData.stats?.battlesWon || 0,
                questionsAnswered: this.realPlayerData.stats?.questionsAnswered || 0,
                accuracy: this.calculateAccuracy(this.realPlayerData.stats)
            };
            console.log('✅ Real player data loaded:', this.gameState.currentPlayer.username);
        } else {
            // Fallback to demo data
            this.gameState.currentPlayer = {
                id: 'user_' + Math.random().toString(36).substr(2, 9),
                username: 'QuizWarrior',
                realm: 'r/gaming',
                score: 1250,
                level: 'Apprentice Scholar',
                battlesWon: 12,
                questionsAnswered: 156,
                accuracy: 78
            };
            console.log('⚠️ Using fallback player data');
        }
    }

    private calculatePlayerLevel(score: number): string {
        const level = this.levels.find(l => score >= l.minScore) || this.levels[0];
        return level.name;
    }

    private calculateAccuracy(stats: any): number {
        if (!stats || !stats.questionsAnswered) return 0;
        return Math.round((stats.correctAnswers / stats.questionsAnswered) * 100);
    }

    initializeKnowledgeBase() {
        // Fallback knowledge base for offline testing
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
            'apprentice': [
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
                }
            ]
        };
    }

    renderMainInterface() {
        this.gameState.currentScreen = 'main-menu';
        const app = document.getElementById('app');
        if (!app) return;

        // Safety check: ensure currentPlayer is initialized
        if (!this.gameState.currentPlayer) {
            console.error('❌ Cannot render main interface: currentPlayer is null');
            // Initialize with fallback data
            this.gameState.currentPlayer = {
                id: 'user_fallback',
                username: 'QuizWarrior',
                realm: 'r/gaming',
                score: 0,
                level: 'Knowledge Seeker',
                battlesWon: 0,
                questionsAnswered: 0,
                accuracy: 0
            };
        }

        app.innerHTML = `
            <div class="main-menu-container">
                <!-- Header with player info and navigation -->
                <div class="main-header">
                    <div class="player-info">
                        <div class="player-avatar-small">⚔️</div>
                        <div class="player-details">
                            <div class="player-name">${this.gameState.currentPlayer.username}</div>
                            <div class="player-realm">${this.gameState.currentPlayer.realm}</div>
                        </div>
                        <div class="player-score-badge">${this.gameState.currentPlayer.score}</div>
                    </div>
                    
                    <div class="nav-buttons">
                        <button class="nav-btn" data-action="showLeaderboard" title="Leaderboard">
                            🏆
                        </button>
                        <button class="nav-btn" data-action="showProfile" title="Profile">
                            👤
                        </button>
                        <button class="nav-btn" data-action="showSettings" title="Settings">
                            ⚙️
                        </button>
                        <button class="nav-btn quit-btn" data-action="quitToSplash" title="Quit">
                            ✕
                        </button>
                    </div>
                </div>

                <!-- Main battle selection -->
                <div class="battle-selection">
                    <h1 class="main-title">🃏 Choose Your Battle</h1>
                    <p class="main-subtitle">Select your path to knowledge supremacy</p>
                    
                    <div class="battle-modes">
                        <button class="battle-mode-card apprentice-mode" data-action="startSinglePlayer">
                            <div class="mode-icon">🤖</div>
                            <div class="mode-title">AI Apprentice</div>
                            <div class="mode-description">Challenge the realm's learning AI in turn-based combat</div>
                            <div class="mode-difficulty">Difficulty: ⭐⭐⭐</div>
                        </button>
                        
                        <button class="battle-mode-card multiplayer-mode" data-action="startMultiplayer">
                            <div class="mode-icon">⚔️</div>
                            <div class="mode-title">Quick Match</div>
                            <div class="mode-description">Face random opponents in fast-paced duels</div>
                            <div class="mode-difficulty">Difficulty: ⭐⭐⭐⭐</div>
                        </button>
                        
                        <button class="battle-mode-card realm-mode" data-action="startRealmBattle">
                            <div class="mode-icon">🏰</div>
                            <div class="mode-title">Realm Wars</div>
                            <div class="mode-description">Epic battles between different Reddit realms</div>
                            <div class="mode-difficulty">Difficulty: ⭐⭐⭐⭐⭐</div>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Set up event listeners
        this.setupMainInterfaceEventListeners();
    }

    updateLeaderboard() {
        const leaderboard = document.getElementById('leaderboard-content');
        if (!leaderboard) return;

        const sortedRealms = Array.from(this.gameState.leaderboard.entries())
            .sort((a, b) => b[1].score - a[1].score);

        leaderboard.innerHTML = sortedRealms.map(([realm, data], index) => `
            <div class="leaderboard-item">
                <div>
                    <div class="realm-name">${index + 1}. ${realm}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${data.master}</div>
                </div>
                <div class="realm-score">${data.score}</div>
            </div>
        `).join('');
    }

    setupMainInterfaceEventListeners() {
        console.log('🔧 Setting up event listeners...');

        // Set up event listeners for all buttons with data-action attributes
        const buttons = document.querySelectorAll('[data-action]');
        console.log(`🔧 Found ${buttons.length} buttons with data-action attributes`);

        buttons.forEach((button, index) => {
            const action = button.getAttribute('data-action');
            console.log(`🔧 Setting up button ${index}: action="${action}"`);

            // Remove any existing event listeners by cloning the element
            const newButton = button.cloneNode(true) as HTMLElement;
            button.parentNode?.replaceChild(newButton, button);

            // Add the event listener to the new button
            newButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log(`🎯 Button clicked: action="${action}"`);
                this.playButtonClickSound();

                switch (action) {
                    case 'startSinglePlayer':
                        console.log('🤖 Starting single player...');
                        this.startSinglePlayer();
                        break;
                    case 'startMultiplayer':
                        console.log('⚔️ Starting multiplayer...');
                        this.startMultiplayer();
                        break;
                    case 'startRealmBattle':
                        console.log('🏰 Starting realm battle...');
                        this.startRealmBattle();
                        break;
                    case 'showChallengeInterface':
                        console.log('📨 Showing challenge interface...');
                        this.showChallengeInterface();
                        break;
                    case 'quitToSplash':
                        console.log('🚪 Quitting to splash...');
                        this.quitToSplash();
                        break;
                    case 'renderMainInterface':
                        console.log('🏠 Rendering main interface...');
                        this.renderMainInterface();
                        break;
                    case 'quitBattle':
                        console.log('🚪 Quitting battle...');
                        this.quitBattle();
                        break;
                    case 'showOfflineMessage':
                        console.log('📨 Showing offline message...');
                        this.showNotification('📨 Challenge features require online mode', 'info');
                        break;
                    case 'showLeaderboard':
                        console.log('🏆 Showing leaderboard...');
                        this.showLeaderboardScreen();
                        break;
                    case 'showProfile':
                        console.log('👤 Showing profile...');
                        this.showProfileScreen();
                        break;
                    case 'showSettings':
                        console.log('⚙️ Showing settings...');
                        this.showSettingsScreen();
                        break;
                    case 'challengeOpponent':
                        console.log('⚔️ Challenging opponent...');
                        const opponentIndex = parseInt((button as HTMLElement).dataset.opponentIndex || '0');
                        this.challengeOpponent(opponentIndex);
                        break;
                    default:
                        console.warn('❌ Unknown action:', action);
                }
            });
        });

        console.log('✅ Event listeners setup complete');
    }

    showLeaderboardScreen() {
        this.gameState.currentScreen = 'leaderboard';
        const app = document.getElementById('app');
        if (!app) return;

        app.innerHTML = `
            <div class="screen-container leaderboard-screen">
                <div class="screen-header">
                    <button class="back-btn" data-action="renderMainInterface">← Back</button>
                    <h1 class="screen-title">🏆 Realm Masters</h1>
                    <div class="header-spacer"></div>
                </div>
                
                <div class="leaderboard-content">
                    <div class="leaderboard-stats">
                        <div class="stat-card">
                            <div class="stat-number">${Array.from(this.gameState.leaderboard.values()).length}</div>
                            <div class="stat-label">Active Realms</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${this.gameState.currentPlayer.battlesWon}</div>
                            <div class="stat-label">Your Victories</div>
                        </div>
                    </div>
                    
                    <div class="leaderboard-list" id="leaderboard-list">
                        <!-- Leaderboard items will be populated here -->
                    </div>
                </div>
            </div>
        `;

        this.updateLeaderboardScreen();
        this.setupMainInterfaceEventListeners();
    }

    showProfileScreen() {
        this.gameState.currentScreen = 'profile';
        const app = document.getElementById('app');
        if (!app) return;

        const level = this.calculatePlayerLevel(this.gameState.currentPlayer.score);
        const nextLevel = this.getNextLevel(this.gameState.currentPlayer.score);
        const progress = this.calculateLevelProgress(this.gameState.currentPlayer.score);

        app.innerHTML = `
            <div class="screen-container profile-screen">
                <div class="screen-header">
                    <button class="back-btn" data-action="renderMainInterface">← Back</button>
                    <h1 class="screen-title">👤 Your Realm Status</h1>
                    <div class="header-spacer"></div>
                </div>
                
                <div class="profile-content">
                    <div class="profile-hero">
                        <div class="profile-avatar">⚔️</div>
                        <div class="profile-info">
                            <h2 class="profile-name">${this.gameState.currentPlayer.username}</h2>
                            <div class="profile-realm">${this.gameState.currentPlayer.realm}</div>
                            <div class="profile-level">${level}</div>
                        </div>
                    </div>
                    
                    <div class="level-progress">
                        <div class="progress-header">
                            <span>Level Progress</span>
                            <span>${Math.round(progress)}%</span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${progress}%"></div>
                        </div>
                        <div class="progress-footer">
                            <span>${level}</span>
                            <span>${nextLevel || 'Max Level'}</span>
                        </div>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-icon">🏆</div>
                            <div class="stat-info">
                                <div class="stat-value">${this.gameState.currentPlayer.score}</div>
                                <div class="stat-label">Total Score</div>
                            </div>
                        </div>
                        
                        <div class="stat-item">
                            <div class="stat-icon">⚔️</div>
                            <div class="stat-info">
                                <div class="stat-value">${this.gameState.currentPlayer.battlesWon}</div>
                                <div class="stat-label">Battles Won</div>
                            </div>
                        </div>
                        
                        <div class="stat-item">
                            <div class="stat-icon">🎯</div>
                            <div class="stat-info">
                                <div class="stat-value">${this.gameState.currentPlayer.accuracy}%</div>
                                <div class="stat-label">Accuracy</div>
                            </div>
                        </div>
                        
                        <div class="stat-item">
                            <div class="stat-icon">📚</div>
                            <div class="stat-info">
                                <div class="stat-value">${this.gameState.currentPlayer.questionsAnswered}</div>
                                <div class="stat-label">Questions Answered</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupMainInterfaceEventListeners();
    }

    showSettingsScreen() {
        this.gameState.currentScreen = 'settings';
        const app = document.getElementById('app');
        if (!app) return;

        app.innerHTML = `
            <div class="screen-container settings-screen">
                <div class="screen-header">
                    <button class="back-btn" data-action="renderMainInterface">← Back</button>
                    <h1 class="screen-title">⚙️ Settings</h1>
                    <div class="header-spacer"></div>
                </div>
                
                <div class="settings-content">
                    <div class="settings-section">
                        <h3 class="section-title">🔊 Audio Settings</h3>
                        
                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Sound Effects</div>
                                <div class="setting-description">Game sounds and notifications</div>
                            </div>
                            <div class="setting-controls">
                                <button class="audio-btn" id="mute-toggle" title="Toggle Mute">🔊</button>
                                <input type="range" class="volume-slider" id="volume-slider" min="0" max="100" value="70">
                                <span class="volume-display" id="volume-display">70%</span>
                            </div>
                        </div>
                        
                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Background Music</div>
                                <div class="setting-description">Ambient game music</div>
                            </div>
                            <div class="setting-controls">
                                <button class="audio-btn" id="music-toggle" title="Toggle Music">🎵</button>
                                <input type="range" class="volume-slider" id="music-slider" min="0" max="100" value="30">
                                <span class="volume-display" id="music-display">30%</span>
                            </div>
                        </div>
                        
                        <div class="setting-item">
                            <button class="test-btn" id="audio-test">🎵 Test Audio</button>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h3 class="section-title">🎮 Game Settings</h3>
                        
                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Game Mode</div>
                                <div class="setting-description">${this.isLocalMode ? 'Local Mode - Offline gameplay' : 'Online Mode - Full features'}</div>
                            </div>
                        </div>
                        
                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">AI Features</div>
                                <div class="setting-description">${this.gameConfig.hasGeminiKey ? 'AI Enhanced - Smart opponents' : 'Basic AI - Rule-based opponents'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupAudioControls();
        this.setupMainInterfaceEventListeners();
    }

    private updateLeaderboardScreen() {
        const leaderboardList = document.getElementById('leaderboard-list');
        if (!leaderboardList) return;

        const sortedRealms = Array.from(this.gameState.leaderboard.entries())
            .sort((a, b) => b[1].score - a[1].score);

        leaderboardList.innerHTML = sortedRealms.map(([realm, data], index) => `
            <div class="leaderboard-item ${realm === this.gameState.currentPlayer.realm ? 'current-player' : ''}">
                <div class="rank">#${index + 1}</div>
                <div class="realm-info">
                    <div class="realm-name">${realm}</div>
                    <div class="realm-master">👑 ${data.master}</div>
                </div>
                <div class="realm-stats">
                    <div class="realm-score">${data.score}</div>
                    <div class="realm-battles">${data.battles} battles</div>
                </div>
            </div>
        `).join('');
    }

    private setupAudioControls() {
        console.log('🔊 Setting up audio controls');

        // Volume slider
        const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;
        const volumeDisplay = document.getElementById('volume-display');
        const muteToggle = document.getElementById('mute-toggle');

        // Music slider
        const musicSlider = document.getElementById('music-slider') as HTMLInputElement;
        const musicDisplay = document.getElementById('music-display');
        const musicToggle = document.getElementById('music-toggle');

        // Audio test button
        const audioTest = document.getElementById('audio-test');

        if (volumeSlider && volumeDisplay && muteToggle) {
            // Set initial values
            volumeSlider.value = (this.audioService.getVolume() * 100).toString();
            volumeDisplay.textContent = Math.round(this.audioService.getVolume() * 100) + '%';
            muteToggle.textContent = this.audioService.getMutedState() ? '🔇' : '🔊';

            // Volume slider event
            volumeSlider.addEventListener('input', (e) => {
                const volume = parseInt((e.target as HTMLInputElement).value) / 100;
                this.audioService.setVolume(volume);
                volumeDisplay.textContent = Math.round(volume * 100) + '%';
                console.log('🔊 Volume set to:', volume);
            });

            // Mute toggle event
            muteToggle.addEventListener('click', () => {
                const isMuted = this.audioService.toggleMute();
                muteToggle.textContent = isMuted ? '🔇' : '🔊';
                console.log('🔊 Mute toggled:', isMuted);
            });
        }

        if (musicSlider && musicDisplay && musicToggle) {
            // Set initial values
            musicSlider.value = (this.audioService.getMusicVolume() * 100).toString();
            musicDisplay.textContent = Math.round(this.audioService.getMusicVolume() * 100) + '%';
            musicToggle.textContent = this.audioService.getMusicMutedState() ? '🔇' : '🎵';

            // Music slider event
            musicSlider.addEventListener('input', (e) => {
                const volume = parseInt((e.target as HTMLInputElement).value) / 100;
                this.audioService.setMusicVolume(volume);
                musicDisplay.textContent = Math.round(volume * 100) + '%';
                console.log('🎵 Music volume set to:', volume);
            });

            // Music toggle event
            musicToggle.addEventListener('click', () => {
                const isMuted = this.audioService.toggleMusicMute();
                musicToggle.textContent = isMuted ? '🔇' : '🎵';
                console.log('🎵 Music mute toggled:', isMuted);
            });
        }

        if (audioTest) {
            audioTest.addEventListener('click', () => {
                console.log('🎵 Testing audio...');
                this.audioService.playButtonClick();
                setTimeout(() => {
                    this.audioService.playNotification();
                }, 500);
            });
        }
    }

    private getNextLevel(score: number): string | null {
        const currentLevelIndex = this.levels.findIndex(l => score >= l.minScore);
        if (currentLevelIndex > 0) {
            return this.levels[currentLevelIndex - 1].name;
        }
        return null;
    }

    private calculateLevelProgress(score: number): number {
        const currentLevel = this.levels.find(l => score >= l.minScore) || this.levels[this.levels.length - 1];
        const nextLevel = this.getNextLevel(score);

        if (!nextLevel) return 100; // Max level

        const nextLevelData = this.levels.find(l => l.name === nextLevel);
        if (!nextLevelData) return 100;

        const progressInLevel = score - currentLevel.minScore;
        const levelRange = nextLevelData.minScore - currentLevel.minScore;

        return Math.min(100, (progressInLevel / levelRange) * 100);
    }

    async startSinglePlayer() {
        try {
            console.log('🤖 startSinglePlayer() called');
            this.playDramaticModeSelectSound();

            console.log('🤖 Setting game mode to single');
            this.gameState.gameMode = 'single';
            this.gameState.turnBased = true; // Enable turn-based mode for AI Apprentice
            this.gameState.currentTurn = 'player'; // Player goes first
            this.gameState.opponent = {
                name: "The Realm's Apprentice",
                avatar: "🤖",
                realm: "Neutral",
                score: 0
            };
            this.gameState.realmTopic = "General Knowledge";

            console.log('🤖 Setting question set');
            // Try to get AI-generated questions first, fallback to local
            if (this.serverQuestions.length > 0) {
                this.currentQuestionSet = this.shuffleArray([...this.serverQuestions]).slice(0, getConfig().QUESTIONS_PER_BATTLE);
                console.log('🤖 Using server questions for apprentice battle');
            } else {
                this.currentQuestionSet = this.knowledgeBase.apprentice;
                console.log('🤖 Using fallback questions for apprentice battle');
            }
            console.log('🤖 Question set:', this.currentQuestionSet);

            console.log('🤖 Showing notification');
            this.showNotification("🤖 Facing The Realm's Apprentice! Prove your worth!", 'info');

            console.log('🤖 Starting quiz battle');
            await this.startQuizBattle();
            console.log('🤖 Quiz battle started successfully');
        } catch (error) {
            console.error('❌ Error in startSinglePlayer:', error);
            this.showNotification('❌ Error starting single player mode', 'error');
        }
    }

    async startMultiplayer() {
        this.playDramaticModeSelectSound();

        this.gameState.gameMode = 'multiplayer';

        // Show initial notification
        this.showNotification("🔍 Selecting a worthy opponent...", 'info');

        // Wait for notification to show, then display opponent selection
        setTimeout(() => {
            this.showOpponentSelection();
        }, 2000);
    }

    private showOpponentSelection() {
        const app = document.getElementById('app');
        if (!app) return;

        // Generate available opponents with levels and stats
        const availableOpponents = this.generateAvailableOpponents();

        app.innerHTML = `
            <div class="opponent-selection-screen">
                <div class="quiz-card">
                    <div class="opponent-selection-header">
                        <h2 style="font-family: 'Orbitron', monospace; margin-bottom: 0.5rem; color: var(--accent-blue); font-size: 1.5rem;">
                            ⚔️ Choose Your Opponent
                        </h2>
                        <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">
                            Select a worthy challenger for your quick duel
                        </p>
                    </div>
                    
                    <div class="opponent-selection-content">
                        <div class="opponents-grid">
                            ${availableOpponents.slice(0, 6).map((opponent, index) => `
                                <div class="opponent-card" data-opponent-index="${index}" data-action="challengeOpponent">
                                    <div class="opponent-avatar">${opponent.avatar}</div>
                                    <div class="opponent-info">
                                        <div class="opponent-name">${opponent.name}</div>
                                        <div class="opponent-level ${opponent.levelClass}">${opponent.level}</div>
                                        <div class="opponent-realm">${opponent.realm}</div>
                                        <div class="opponent-stats">
                                            <span>⚔️ ${opponent.battlesWon}W</span>
                                            <span>🏆 ${opponent.score}pts</span>
                                        </div>
                                    </div>
                                    <button class="challenge-btn" data-action="challengeOpponent" data-opponent-index="${index}">
                                        Challenge
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="opponent-selection-footer">
                        <button class="mode-btn" data-action="renderMainInterface" style="padding: 0.8rem 2rem; font-size: 0.9rem;">
                            🏠 Back to Realm
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Store opponents for later use
        this.availableOpponents = availableOpponents;

        // Set up event listeners
        this.setupMainInterfaceEventListeners();
    }

    private generateAvailableOpponents() {
        const levels = [
            { name: 'Knowledge Seeker', class: 'seeker', minScore: 0, maxScore: 500 },
            { name: 'Apprentice Scholar', class: 'apprentice', minScore: 500, maxScore: 1200 },
            { name: 'Realm Guardian', class: 'guardian', minScore: 1200, maxScore: 2500 },
            { name: 'Master Sage', class: 'sage', minScore: 2500, maxScore: 5000 },
            { name: 'Grand Champion', class: 'champion', minScore: 5000, maxScore: 10000 }
        ];

        const realms = ['r/gaming', 'r/science', 'r/technology', 'r/movies', 'r/askreddit', 'r/worldnews'];
        const avatars = ['🤖', '🧙‍♂️', '👑', '🦾', '🔮', '⚡', '🌟', '🎯'];

        return Array.from({ length: 6 }, (_, i) => {
            const level = levels[Math.floor(Math.random() * levels.length)];
            const realm = realms[Math.floor(Math.random() * realms.length)];
            const avatar = avatars[Math.floor(Math.random() * avatars.length)];
            const score = Math.floor(Math.random() * (level.maxScore - level.minScore)) + level.minScore;
            const battlesWon = Math.floor(score / 100) + Math.floor(Math.random() * 20);

            return {
                name: `${realm.replace('r/', '')}Master${Math.floor(Math.random() * 999)}`,
                avatar: avatar,
                realm: realm,
                level: level.name,
                levelClass: level.class,
                score: score,
                battlesWon: battlesWon,
                index: i
            };
        });
    }

    private challengeOpponent(opponentIndex: number) {
        if (!this.availableOpponents || !this.availableOpponents[opponentIndex]) {
            console.error('Invalid opponent index:', opponentIndex);
            return;
        }

        const selectedOpponent = this.availableOpponents[opponentIndex];
        
        // Set up the opponent for battle
        this.gameState.opponent = {
            name: selectedOpponent.name,
            avatar: selectedOpponent.avatar,
            realm: selectedOpponent.realm,
            score: 0 // Will be calculated during battle
        };

        this.gameState.realmTopic = `Quick Duel vs ${selectedOpponent.level}`;

        // Generate questions for the battle
        this.currentQuestionSet = this.generateMixedQuestions();

        // Show battle start notification
        this.showNotification(`⚔️ Challenging ${selectedOpponent.name}! Battle begins!`, 'success');

        // Start the quiz battle
        setTimeout(() => {
            this.startQuizBattle();
        }, 1500);
    }

    setupMatchmakingListener() {
        // Listen for messages from backend
        window.addEventListener('message', (event) => {
            if (event.data.type === 'quickMatchResponse') {
                if (event.data.gameSession) {
                    // Match found!
                    this.handleMatchFound(event.data.gameSession);
                } else {
                    // Added to queue
                    this.showNotification("⏳ Added to matchmaking queue. Searching for opponents...", 'info');
                    this.showMatchmakingInterface();
                }
            }
        });
    }

    handleMatchFound(gameSession: any) {
        // Set up opponent from game session
        this.gameState.opponent = {
            name: "Matched Opponent",
            avatar: "🎯",
            realm: "Unknown",
            score: 0
        };
        this.gameState.realmTopic = "Quick Match Challenge";

        this.currentQuestionSet = this.generateMixedQuestions();
        this.showNotification("⚔️ Opponent found! Battle begins!", 'success');
        this.startQuizBattle();
    }

    showMatchmakingInterface() {
        const quizInterface = document.getElementById('quiz-interface');
        if (!quizInterface) return;

        quizInterface.innerHTML = `
            <div class="quiz-card">
                <h2 style="font-family: 'Orbitron', monospace; margin-bottom: 2rem; color: var(--accent-blue);">
                    🔍 Finding Your Opponent
                </h2>
                <div style="text-align: center; margin-bottom: 2rem;">
                    <div class="loading-spinner" style="margin: 2rem auto;"></div>
                    <p style="font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 1rem;">
                        Searching for players with similar skill level...
                    </p>
                    <div id="queue-status" style="font-size: 0.9rem; color: var(--accent-blue);">
                        Position in queue: Calculating...
                    </div>
                </div>
                <div style="display: flex; justify-content: center; gap: 1rem;">
                    <button class="mode-btn single-player" data-action="renderMainInterface">
                        🏠 Cancel Search
                    </button>
                    <button class="mode-btn realm-battle" data-action="startRealmBattle">
                        🏰 Realm Battle Instead
                    </button>
                </div>
            </div>
        `;

        // Set up event listeners for matchmaking buttons
        this.setupMainInterfaceEventListeners();
    }

    async startRealmBattle() {
        this.playDramaticModeSelectSound();

        this.gameState.gameMode = 'realm-battle';
        this.gameState.turnBased = false; // Realm battles are NOT turn-based (user vs user)

        // Get a real opponent from another realm
        const opponent = await this.findRealmOpponent();

        this.gameState.opponent = opponent;
        this.gameState.realmTopic = `${this.gameState.currentPlayer.realm} vs ${opponent.realm}`;

        this.currentQuestionSet = this.generateRealmBattleQuestions(opponent.realm);
        this.showNotification(`🏰 Epic battle against ${opponent.name} from ${opponent.realm}! Defend your realm's honor!`, 'info');

        await this.startQuizBattle();
    }

    private async findRealmOpponent(): Promise<any> {
        try {
            // Try to get a real opponent from the server
            const response = await fetch('/api/find-realm-opponent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    playerRealm: this.gameState.currentPlayer.realm,
                    excludePlayer: this.gameState.currentPlayer.username
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.opponent) {
                    console.log('🏰 Found real realm opponent:', data.opponent);
                    return {
                        name: data.opponent.username,
                        avatar: "🛡️",
                        realm: data.opponent.realm,
                        score: 0,
                        isRealPlayer: true
                    };
                }
            }
        } catch (error) {
            console.warn('Failed to find real opponent, using simulated opponent:', error);
        }

        // Fallback: Create a simulated opponent from another realm
        const enemyRealms = ['r/science', 'r/movies', 'r/technology', 'r/askreddit', 'r/worldnews'];
        const playerRealm = this.gameState.currentPlayer.realm;
        const availableRealms = enemyRealms.filter(realm => realm !== playerRealm);
        const enemyRealm = availableRealms[Math.floor(Math.random() * availableRealms.length)];

        // Generate a realistic username for the simulated opponent
        const usernames = [
            'KnowledgeSeeker', 'QuizMaster', 'RealmDefender', 'WisdomWarrior', 'FactFinder',
            'BrainBattler', 'SmartScholar', 'QuickThinker', 'MindMaster', 'InfoHunter'
        ];
        const randomUsername = usernames[Math.floor(Math.random() * usernames.length)] +
            Math.floor(Math.random() * 1000);

        console.log('🏰 Using simulated realm opponent');
        return {
            name: randomUsername,
            avatar: "🛡️",
            realm: enemyRealm,
            score: 0,
            isRealPlayer: false
        };
    }

    generateMixedQuestions(): Question[] {
        // Use server questions if available, otherwise fallback
        if (this.serverQuestions.length > 0) {
            console.log('📚 Using server-generated questions');
            return this.shuffleArray([...this.serverQuestions]).slice(0, getConfig().QUESTIONS_PER_BATTLE);
        }

        console.log('📦 Using fallback questions');
        const allQuestions: Question[] = [];
        Object.values(this.knowledgeBase).forEach((questions: any) => {
            allQuestions.push(...questions);
        });

        return this.shuffleArray(allQuestions).slice(0, getConfig().QUESTIONS_PER_BATTLE);
    }

    generateRealmBattleQuestions(enemyRealm: string): Question[] {
        // Use server questions if available
        if (this.serverQuestions.length > 0) {
            console.log('📚 Using server questions for realm battle');
            return this.shuffleArray([...this.serverQuestions]).slice(0, getConfig().QUESTIONS_PER_BATTLE);
        }

        // Fallback to local questions
        console.log('📦 Using fallback questions for realm battle');
        const playerRealmQuestions = this.knowledgeBase[this.gameState.currentPlayer.realm] || [];
        const enemyRealmQuestions = this.knowledgeBase[enemyRealm] || [];

        const mixedQuestions = [
            ...playerRealmQuestions.slice(0, 2),
            ...enemyRealmQuestions.slice(0, 2),
            ...this.knowledgeBase.apprentice.slice(0, 1)
        ];

        return this.shuffleArray(mixedQuestions);
    }

    async startQuizBattle() {
        try {
            console.log('⚔️ startQuizBattle() called');
            console.log('⚔️ Current game state:', this.gameState);

            // Clear any existing timers
            this.clearTimer();

            // Reset game state
            this.gameState.gameStarted = true;
            this.gameState.questionIndex = 0;
            this.gameState.score = 0;
            this.gameState.questionsAnswered = 0;
            this.gameState.correctAnswers = 0;

            if (this.gameState.opponent) {
                this.gameState.opponent.score = 0;
            }

            console.log('⚔️ Rendering battle interface');
            this.renderBattleInterface();

            console.log('⚔️ Loading first question');
            await this.loadNextQuestion();
            console.log('⚔️ Quiz battle setup complete');
        } catch (error) {
            console.error('❌ Error in startQuizBattle:', error);
            this.showNotification('❌ Error starting quiz battle', 'error');
        }
    }

    renderBattleInterface() {
        console.log('🎮 renderBattleInterface() called');
        this.gameState.currentScreen = 'battle';
        const app = document.getElementById('app');
        if (!app) {
            console.error('❌ app element not found!');
            return;
        }
        console.log('🎮 Found app element');

        const turnIndicator = this.gameState.turnBased ? `
            <div class="turn-indicator ${this.gameState.currentTurn === 'player' ? 'player-turn' : 'apprentice-turn'}">
                ${this.gameState.currentTurn === 'player' ? '🎯 Your Turn' : '🤖 Apprentice\'s Turn'}
            </div>
        ` : '';

        app.innerHTML = `
            <div class="battle-container">
                <!-- Battle Header with Scores -->
                <div class="battle-header">
                    <button class="battle-quit-btn" data-action="quitBattle" title="Quit Battle">✕</button>
                    
                    <div class="battle-scores">
                        <div class="player-score-card ${this.gameState.currentTurn === 'player' ? 'active-player' : ''}">
                            <div class="player-avatar">⚔️</div>
                            <div class="player-name">${this.gameState.currentPlayer.username}</div>
                            <div class="player-realm">${this.gameState.currentPlayer.realm}</div>
                            <div class="player-score" id="player-score">${this.gameState.score}</div>
                        </div>
                        
                        <div class="vs-section">
                            <div class="vs-indicator">VS</div>
                            ${turnIndicator}
                        </div>
                        
                        <div class="player-score-card ${this.gameState.currentTurn === 'apprentice' ? 'active-player' : ''}">
                            <div class="player-avatar">${this.gameState.opponent.avatar}</div>
                            <div class="player-name">${this.gameState.opponent.name}</div>
                            <div class="player-realm">${this.gameState.opponent.realm}</div>
                            <div class="player-score" id="opponent-score">${this.gameState.opponent.score}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Quiz Interface -->
                <div class="quiz-interface-fullscreen" id="quiz-interface">
                    <div class="quiz-card" id="question-card">
                        <!-- Question content will be loaded here -->
                    </div>
                </div>
            </div>
        `;

        // Set up event listeners for battle interface
        this.setupMainInterfaceEventListeners();
    }

    async loadNextQuestion() {
        try {
            console.log('❓ loadNextQuestion() called');
            console.log('❓ Question index:', this.gameState.questionIndex);
            console.log('❓ Question set length:', this.currentQuestionSet.length);

            if (this.gameState.questionIndex >= this.currentQuestionSet.length) {
                console.log('❓ No more questions, ending battle');
                await this.endQuizBattle();
                return;
            }

            const question = this.currentQuestionSet[this.gameState.questionIndex];
            console.log('❓ Current question:', question);

            this.gameState.currentQuestion = question;
            this.gameState.currentQuestion.opponentAnswered = false; // Reset opponent answer flag
            this.gameState.timeLeft = 30;

            console.log('❓ Rendering question');
            this.renderQuestion(question);

            console.log('❓ Starting timer');
            this.startTimer();

            // Simulate opponent answering (for non-turn-based games)
            if (!this.gameState.turnBased) {
                console.log('❓ Simulating opponent answer for non-turn-based game');
                this.simulateOpponentAnswer();
            }

            console.log('❓ Question loaded successfully');
        } catch (error) {
            console.error('❌ Error in loadNextQuestion:', error);
            this.showNotification('❌ Error loading question', 'error');
        }
    }

    renderQuestion(question: Question) {
        console.log('📝 renderQuestion() called with:', question);
        const questionCard = document.getElementById('question-card');
        if (!questionCard) {
            console.error('❌ question-card element not found!');
            return;
        }
        console.log('📝 Found question-card element');

        questionCard.innerHTML = `
            <div class="question-header">
                <div class="question-number">Question ${this.gameState.questionIndex + 1}/${this.currentQuestionSet.length}</div>
                <div class="realm-topic">${this.gameState.realmTopic}</div>
                <div class="timer" id="timer">${this.gameState.timeLeft}s</div>
            </div>
            
            <div class="question-text">${question.question}</div>
            
            <div class="answer-options" id="answer-options">
                ${question.options.map((option, index) => `
                    <button class="answer-btn" data-answer-index="${index}">
                        ${option}
                    </button>
                `).join('')}
            </div>
            
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${((this.gameState.questionIndex + 1) / this.currentQuestionSet.length) * 100}%"></div>
            </div>
        `;

        // Set up event listeners for answer buttons
        const answerButtons = document.querySelectorAll('[data-answer-index]');
        console.log(`🔧 Setting up ${answerButtons.length} answer buttons`);

        answerButtons.forEach((button, buttonIndex) => {
            const index = parseInt(button.getAttribute('data-answer-index') || '0');
            console.log(`🔧 Setting up answer button ${buttonIndex}: index=${index}`);

            // Remove any existing event listeners by cloning the element
            const newButton = button.cloneNode(true) as HTMLElement;
            button.parentNode?.replaceChild(newButton, button);

            // Add the event listener to the new button
            newButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log(`🎯 Answer button clicked: index=${index}`);
                this.selectAnswer(index);
            });
        });
    }

    startTimer() {
        this.timer = setInterval(() => {
            this.gameState.timeLeft--;
            const timerEl = document.getElementById('timer');
            if (timerEl) {
                timerEl.textContent = `${this.gameState.timeLeft}s`;

                if (this.gameState.timeLeft <= 10) {
                    timerEl.style.background = 'var(--danger-gradient)';
                    timerEl.style.animation = 'pulse 1s infinite';
                }
            }

            if (this.gameState.timeLeft <= 0) {
                this.selectAnswer(-1); // Time's up
            }
        }, 1000);
    }

    selectAnswer(selectedIndex: number) {
        // Only allow player to answer on their turn
        if (this.gameState.turnBased && this.gameState.currentTurn !== 'player') {
            console.log('🚫 Not player\'s turn');
            return;
        }

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        const question = this.gameState.currentQuestion;
        const isCorrect = selectedIndex === question.correct;
        const answerButtons = document.querySelectorAll('.answer-btn');

        // Disable all buttons
        answerButtons.forEach(btn => (btn as HTMLButtonElement).style.pointerEvents = 'none');

        // Show correct/incorrect answers
        answerButtons.forEach((btn, index) => {
            if (index === question.correct) {
                btn.classList.add('correct');
            } else if (index === selectedIndex && !isCorrect) {
                btn.classList.add('incorrect');
            }
        });

        this.gameState.questionsAnswered++;

        if (isCorrect) {
            this.gameState.correctAnswers++;
            const points = this.calculatePoints(question.difficulty, this.gameState.timeLeft);
            this.gameState.score += points;
            this.audioService.play('correct'); // Play correct answer sound
            this.showNotification(`🎉 Correct! +${points} points`, 'success');
        } else if (selectedIndex === -1) {
            this.audioService.play('timeout'); // Play timeout sound
            this.showNotification("⏰ Time's up! No points awarded", 'error');
        } else {
            this.audioService.play('incorrect'); // Play incorrect answer sound
            this.showNotification("❌ Incorrect! Better luck next time", 'error');
        }

        this.updateScoreDisplay();

        // Handle turn-based progression
        if (this.gameState.turnBased) {
            this.handleTurnBasedProgression();
        } else {
            // Move to next question after delay (non-turn-based)
            setTimeout(() => {
                this.gameState.questionIndex++;
                this.loadNextQuestion();
            }, 2500);
        }
    }

    private async handleTurnBasedProgression() {
        console.log('🔄 Handling turn-based progression');

        if (this.gameState.currentTurn === 'player') {
            // Player just answered, now it's apprentice's turn
            this.gameState.currentTurn = 'apprentice';
            this.updateTurnIndicator();

            // Show apprentice thinking and get their answer
            await this.getApprenticeAnswer();

            // After both have answered, move to next question
            setTimeout(() => {
                this.gameState.currentTurn = 'player';
                this.updateTurnIndicator(); // Fix: Update turn indicator when switching back to player
                this.gameState.questionIndex++;
                this.loadNextQuestion();
            }, 3000);
        }
    }

    private async getApprenticeAnswer() {
        if (!this.aiApprentice) {
            console.log('🤖 No AI Apprentice available, using fallback');
            this.simulateApprenticeAnswer();
            return;
        }

        try {
            console.log('🤖 Getting AI Apprentice answer...');
            this.gameState.apprenticeAnswering = true;
            this.showApprenticeThinking();

            const response = await this.aiApprentice.answerQuestion(this.gameState.currentQuestion);
            console.log('🤖 AI Apprentice response:', response);

            this.gameState.apprenticeResponse = response;
            this.gameState.apprenticeAnswering = false;

            // Show apprentice's answer
            this.showApprenticeAnswer(response);

            // Update apprentice score
            if (response.isCorrect) {
                const points = this.calculatePoints(
                    this.gameState.currentQuestion.difficulty,
                    Math.max(5, 30 - Math.floor(response.responseTime / 1000))
                );
                this.gameState.opponent.score += points;
                this.updateScoreDisplay();
            }

        } catch (error) {
            console.error('❌ Error getting apprentice answer:', error);
            this.simulateApprenticeAnswer();
        }
    }

    private simulateApprenticeAnswer() {
        console.log('🤖 Simulating apprentice answer (fallback)');
        const accuracy = 0.7; // 70% accuracy for fair gameplay
        const isCorrect = Math.random() < accuracy;
        const selectedAnswer = isCorrect ?
            this.gameState.currentQuestion.correct :
            Math.floor(Math.random() * this.gameState.currentQuestion.options.length);

        const response = {
            selectedAnswer,
            isCorrect,
            responseTime: 2000 + Math.random() * 3000,
            comment: isCorrect ? "I believe this is correct! 🎯" : "Hmm, this is tricky... 🤔",
            confidence: 0.6 + Math.random() * 0.3
        };

        this.showApprenticeAnswer(response);

        if (isCorrect) {
            const points = this.calculatePoints(this.gameState.currentQuestion.difficulty, 15);
            this.gameState.opponent.score += points;
            this.updateScoreDisplay();
        }
    }

    private showApprenticeThinking() {
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'apprentice-thinking';
        thinkingDiv.innerHTML = `
            <div class="thinking-bubble">
                <span class="thinking-text">🤖 The Apprentice is thinking</span>
                <div class="thinking-dots">
                    <span>.</span><span>.</span><span>.</span>
                </div>
            </div>
        `;
        document.body.appendChild(thinkingDiv);

        // Remove after apprentice answers
        setTimeout(() => {
            thinkingDiv.remove();
        }, 5000);
    }

    private showApprenticeAnswer(response: any) {
        console.log('🤖 Showing apprentice answer:', response);

        // Highlight apprentice's choice
        const answerButtons = document.querySelectorAll('.answer-btn');
        answerButtons.forEach((btn, index) => {
            if (index === response.selectedAnswer) {
                if (response.isCorrect) {
                    btn.classList.add('apprentice-correct');
                } else {
                    btn.classList.add('apprentice-incorrect');
                }
            }
        });

        // Play sound for apprentice answer
        this.audioService.play(response.isCorrect ? 'correct' : 'incorrect');
        
        // Show apprentice comment
        this.showNotification(`🤖 ${response.comment}`, response.isCorrect ? 'success' : 'info');
    }

    private updateTurnIndicator() {
        const turnIndicator = document.querySelector('.turn-indicator');
        if (turnIndicator) {
            turnIndicator.className = `turn-indicator ${this.gameState.currentTurn === 'player' ? 'player-turn' : 'apprentice-turn'}`;
            turnIndicator.textContent = this.gameState.currentTurn === 'player' ? '🎯 Your Turn' : '🤖 Apprentice\'s Turn';
        }

        // Update active player highlighting
        const playerCards = document.querySelectorAll('.player-card');
        playerCards.forEach((card, index) => {
            card.classList.remove('active-player');
            if ((index === 0 && this.gameState.currentTurn === 'player') ||
                (index === 1 && this.gameState.currentTurn === 'apprentice')) {
                card.classList.add('active-player');
            }
        });
    }

    calculatePoints(difficulty: string, timeLeft: number): number {
        const basePoints: { [key: string]: number } = {
            'easy': 100,
            'medium': 150,
            'hard': 200
        };

        const timeBonus = Math.floor(timeLeft * 2);
        return basePoints[difficulty] + timeBonus;
    }

    simulateOpponentAnswer() {
        // Don't simulate for turn-based games (AI Apprentice handles its own answers)
        if (this.gameState.turnBased) {
            console.log('🤖 Turn-based mode: AI Apprentice will answer on its turn');
            return;
        }

        // Prevent multiple simulations for the same question
        if (this.gameState.currentQuestion && this.gameState.currentQuestion.opponentAnswered) {
            console.log('🚫 Opponent already answered this question');
            return;
        }

        // Mark question as having opponent simulation in progress
        if (this.gameState.currentQuestion) {
            this.gameState.currentQuestion.opponentAnswered = true;
        }

        // Simulate opponent answering with some delay and accuracy (for realm battles and multiplayer)
        const delay = Math.random() * 15000 + 5000; // 5-20 seconds

        setTimeout(() => {
            // Double-check we're still on the same question and game is still active
            if (!this.gameState.currentQuestion || !this.gameState.gameStarted ||
                this.gameState.questionIndex >= this.currentQuestionSet.length) {
                console.log('🚫 Game ended or moved to next question, skipping opponent simulation');
                return;
            }

            let accuracy: number;

            // Different accuracy based on game mode and opponent type
            if (this.gameState.gameMode === 'realm-battle') {
                // Real users are more skilled (80% accuracy)
                accuracy = this.gameState.opponent.isRealPlayer ? 0.8 : 0.75;
            } else {
                // Multiplayer opponents (75% accuracy)
                accuracy = 0.75;
            }

            const isCorrect = Math.random() < accuracy;

            if (isCorrect) {
                const points = this.calculatePoints(
                    this.gameState.currentQuestion.difficulty,
                    Math.floor(Math.random() * 20) + 5
                );
                this.gameState.opponent.score += points;
                this.updateScoreDisplay();

                // Show opponent success notification for realm battles (less frequent, only for high scores)
                if (this.gameState.gameMode === 'realm-battle' && points > 150 && Math.random() < 0.4) {
                    this.showNotification(`🛡️ ${this.gameState.opponent.name} scored ${points} points!`, 'info');
                }
            }
        }, delay);
    }

    updateScoreDisplay() {
        const playerScoreEl = document.getElementById('player-score');
        const opponentScoreEl = document.getElementById('opponent-score');

        if (playerScoreEl) playerScoreEl.textContent = this.gameState.score.toString();
        if (opponentScoreEl) opponentScoreEl.textContent = this.gameState.opponent.score.toString();
    }

    async endQuizBattle() {
        // Prevent multiple calls to endQuizBattle
        if (!this.gameState.gameStarted) {
            console.log('🚫 Game already ended');
            return;
        }

        // Mark game as ended
        this.gameState.gameStarted = false;

        const playerWon = this.gameState.score > this.gameState.opponent.score;
        const accuracy = Math.round((this.gameState.correctAnswers / this.gameState.questionsAnswered) * 100);

        // Clear any active timers
        this.clearTimer();

        // Show loading state first
        this.showBattleResultsLoading();

        // Save game results to server (in background) with minimum loading time
        await Promise.all([
            this.saveGameResults(playerWon, accuracy),
            new Promise(resolve => setTimeout(resolve, 1000)) // Minimum 1 second loading
        ]);

        // Update local player stats
        this.gameState.currentPlayer.score += this.gameState.score;
        this.gameState.currentPlayer.questionsAnswered += this.gameState.questionsAnswered;

        if (playerWon) {
            this.gameState.currentPlayer.battlesWon++;
        }

        // Check for level progression
        this.updatePlayerLevel();

        // Show results with animation
        this.showBattleResults(playerWon, accuracy);

        // Update leaderboard if player won
        if (playerWon && this.gameState.gameMode === 'realm-battle') {
            this.updateRealmLeaderboard();
        }

        // Play sound effect after scoreboard is displayed (with slight delay for better sync)
        setTimeout(() => {
            if (playerWon) {
                this.playVictorySound();
            } else {
                this.playDefeatSound();
            }

            // Show notification after sound starts
            setTimeout(() => {
                this.showNotification(
                    playerWon ? '🎉 Victory achieved! Your realm grows stronger!' : '💪 Defeat makes you wiser!',
                    playerWon ? 'success' : 'info'
                );
            }, 500);
        }, 300);

        // Set up event listeners for end battle buttons
        this.setupMainInterfaceEventListeners();
    }

    updateRealmLeaderboard() {
        const currentRealm = this.gameState.leaderboard.get(this.gameState.currentPlayer.realm);
        if (currentRealm) {
            currentRealm.score += this.gameState.score;
            currentRealm.battles++;
            if (this.gameState.score > 500) { // High score threshold
                currentRealm.master = this.gameState.currentPlayer.username;
            }
        }
    }

    private getChallengeAgainAction(): string {
        switch (this.gameState.gameMode) {
            case 'single':
                return 'startSinglePlayer';
            case 'realm-battle':
                return 'startRealmBattle';
            case 'multiplayer':
            default:
                return 'startMultiplayer';
        }
    }

    private getChallengeAgainText(): string {
        switch (this.gameState.gameMode) {
            case 'single':
                return '🤖 Face Apprentice Again';
            case 'realm-battle':
                return '🏰 Another Realm Battle';
            case 'multiplayer':
            default:
                return '⚔️ Challenge Again';
        }
    }

    private showBattleResultsLoading() {
        const quizInterface = document.getElementById('quiz-interface');
        if (!quizInterface) return;

        // Play a subtle notification sound for the loading state
        this.playNotificationSound();

        quizInterface.innerHTML = `
            <div class="quiz-card">
                <h2 style="font-family: 'Orbitron', monospace; margin-bottom: 2rem; color: var(--accent-blue); text-align: center;">
                    📊 Calculating Results...
                </h2>
                <div style="display: flex; justify-content: center; margin: 2rem 0;">
                    <div class="loading-spinner"></div>
                </div>
                <p style="text-align: center; color: var(--text-secondary);">
                    Analyzing your performance and updating rankings...
                </p>
            </div>
        `;
    }

    private showBattleResults(playerWon: boolean, accuracy: number) {
        const quizInterface = document.getElementById('quiz-interface');
        if (!quizInterface) return;

        // Clear any turn indicators from the battle interface
        const turnIndicator = document.querySelector('.turn-indicator');
        if (turnIndicator) {
            turnIndicator.remove();
        }

        // Also clear the battle contestants section that might show turn info
        const battleContestants = document.querySelector('.battle-contestants');
        if (battleContestants) {
            // Remove turn indicators from contestants display
            const turnTexts = battleContestants.querySelectorAll('.turn-indicator, .player-turn, .apprentice-turn');
            turnTexts.forEach(element => element.remove());
        }

        quizInterface.innerHTML = `
            <div class="quiz-card battle-results-card">
                <h2 style="font-family: 'Orbitron', monospace; margin-bottom: 2rem; color: ${playerWon ? 'var(--accent-blue)' : 'var(--accent-purple)'}; text-align: center; opacity: 0; animation: fadeInUp 0.8s ease-out 0.2s forwards;">
                    ${playerWon ? '🏆 VICTORY!' : '💪 VALIANT EFFORT!'}
                </h2>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; opacity: 0; animation: fadeInUp 0.8s ease-out 0.4s forwards;">
                    <div style="text-align: center;">
                        <h3>Your Performance</h3>
                        <div style="font-size: 2rem; font-weight: bold; color: var(--accent-blue); margin: 1rem 0;">
                            ${this.gameState.score}
                        </div>
                        <div>Accuracy: ${accuracy}%</div>
                        <div>Correct: ${this.gameState.correctAnswers}/${this.gameState.questionsAnswered}</div>
                    </div>
                    
                    <div style="text-align: center;">
                        <h3>Opponent</h3>
                        <div style="font-size: 2rem; font-weight: bold; color: var(--accent-purple); margin: 1rem 0;">
                            ${this.gameState.opponent.score}
                        </div>
                        <div>${this.gameState.opponent.name}</div>
                        <div>${this.gameState.opponent.realm}</div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-bottom: 2rem; opacity: 0; animation: fadeInUp 0.8s ease-out 0.6s forwards;">
                    <p style="font-size: 1.1rem; color: var(--text-secondary);">
                        ${playerWon ?
                `Excellent work! You've brought honor to ${this.gameState.currentPlayer.realm}!` :
                `Great effort! Keep practicing to master your realm's knowledge!`
            }
                    </p>
                </div>
                
                <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; opacity: 0; animation: fadeInUp 0.8s ease-out 0.8s forwards;">
                    <button class="mode-btn single-player" data-action="renderMainInterface">
                        🏠 Return to Realm
                    </button>
                    <button class="mode-btn multiplayer" data-action="${this.getChallengeAgainAction()}">
                        ${this.getChallengeAgainText()}
                    </button>
                </div>
            </div>
        `;
    }

    shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    showNotification(message: string, type: 'info' | 'success' | 'error' = 'info') {
        // Play notification sound
        this.playNotificationSound();

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.4s ease-in forwards';
            setTimeout(() => notification.remove(), 400);
        }, 3500);
    }

    setupEventListeners() {
        // Handle window resize for responsive design
        window.addEventListener('resize', () => {
            // Responsive adjustments if needed
        });

        // Handle visibility change to pause/resume timers
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.timer) {
                clearInterval(this.timer);
            } else if (!document.hidden && this.gameState.gameStarted && this.gameState.timeLeft > 0) {
                this.startTimer();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.gameState.gameStarted && this.gameState.currentQuestion) {
                const key = e.key;
                if (['1', '2', '3', '4'].includes(key)) {
                    const index = parseInt(key) - 1;
                    if (index < this.gameState.currentQuestion.options.length) {
                        this.selectAnswer(index);
                    }
                }
            }
        });
    }

    async startGame() {
        console.log('🎮 Starting game...');
        this.playButtonClickSound();

        // Start background music and handle autoplay
        this.startBackgroundMusic();

        // Show loading state
        const startBtn = document.querySelector('.start-game-btn') as HTMLButtonElement;
        if (startBtn) {
            startBtn.innerHTML = '⏳ Loading...';
            startBtn.disabled = true;
        }

        // Add loading spinner
        const splashScreen = document.querySelector('.splash-screen');
        if (splashScreen) {
            const loadingSpinner = document.createElement('div');
            loadingSpinner.className = 'loading-spinner';
            splashScreen.appendChild(loadingSpinner);
        }

        // Wait 2.5 seconds then transition to main game
        setTimeout(() => {
            this.hideSplashScreen();
        }, 2500);
    }

    quitToSplash() {
        console.log('🚪 Quitting to splash screen...');

        // Remove floating X button
        this.removeFloatingXButton();

        // Clear any active timers
        this.clearTimer();
        this.clearHeartbeat();

        // Reset game state
        this.gameState.gameStarted = false;
        this.gameState.gameMode = null;
        this.gameState.currentQuestion = null;
        this.gameState.questionIndex = 0;
        this.gameState.score = 0;
        this.gameState.opponent = null;
        this.gameState.questionsAnswered = 0;
        this.gameState.correctAnswers = 0;

        // Show splash screen
        this.showSplashScreen();

        // Stop background music after 8 seconds
        this.stopBackgroundMusicAfterDelay(8);

        this.showNotification('👋 Thanks for playing! Click Start Game to play again.', 'info');
    }

    quitBattle() {
        console.log('🚪 Quitting current battle...');

        // Clear any active timers
        this.clearTimer();

        // Check if in multiplayer mode to notify opponent
        if (this.gameState.gameMode === 'multiplayer' && this.gameState.opponent) {
            // In a real implementation, this would send a message to the opponent
            console.log('📨 Notifying opponent that player has quit...');

            // Simulate opponent notification (in real app, this would be sent via backend)
            this.simulateOpponentQuitNotification();
        }

        // Reset battle state
        this.gameState.gameStarted = false;
        this.gameState.gameMode = null;
        this.gameState.currentQuestion = null;
        this.gameState.questionIndex = 0;
        this.gameState.score = 0;
        this.gameState.opponent = null;
        this.gameState.questionsAnswered = 0;
        this.gameState.correctAnswers = 0;

        // Return to main interface (which will add its own floating X button)
        this.renderMainInterface();

        this.showNotification('🚪 Battle ended. You have returned to the main realm.', 'info');
    }

    simulateOpponentQuitNotification() {
        // This simulates what the opponent would see when a player quits
        // In a real implementation, this would be handled by the backend
        console.log('🔔 Opponent would receive: "Your opponent has left the battle. You win by default!"');

        // For demonstration, we'll show what would happen
        setTimeout(() => {
            console.log('🏆 Opponent receives victory notification and returns to main menu');
        }, 1000);
    }

    addFloatingXButton(isMainScreen: boolean = false) {
        // Remove existing floating button if any
        this.removeFloatingXButton();

        const floatingButton = document.createElement('button');
        floatingButton.className = 'floating-x-button animate-in';
        floatingButton.innerHTML = '✕';
        floatingButton.title = isMainScreen ? 'Quit to Start Screen' : 'Quit Battle';

        // Set the appropriate click handler based on screen type
        if (isMainScreen) {
            floatingButton.onclick = () => {
                this.playButtonClickSound();
                this.quitToSplash();
            };
        } else {
            floatingButton.onclick = () => {
                this.playButtonClickSound();
                this.quitBattle();
            };
        }

        document.body.appendChild(floatingButton);
    }

    removeFloatingXButton() {
        const existingButton = document.querySelector('.floating-x-button');
        if (existingButton) {
            existingButton.remove();
        }
    }

    showChallengeInterface() {
        // Check if in local mode
        if (this.isLocalMode) {
            this.showNotification('📨 Challenge features require online mode', 'info');
            return;
        }

        const quizInterface = document.getElementById('quiz-interface');
        if (!quizInterface) return;

        quizInterface.innerHTML = `
            <div class="quiz-card">
                <h2 style="font-family: 'Orbitron', monospace; margin-bottom: 2rem; color: var(--accent-blue);">
                    📨 Challenge a Player
                </h2>
                
                <div style="margin-bottom: 2rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                        Enter Reddit Username:
                    </label>
                    <input 
                        type="text" 
                        id="challenge-username" 
                        placeholder="e.g. RedditUser123"
                        style="width: 100%; padding: 1rem; border: 2px solid var(--glass-border); border-radius: 8px; background: rgba(255,255,255,0.1); color: white; font-size: 1rem;"
                    />
                </div>

                <div style="display: flex; justify-content: center; gap: 1rem;">
                    <button class="mode-btn single-player" data-action="renderMainInterface">
                        🏠 Cancel
                    </button>
                    <button class="mode-btn multiplayer" data-action="showOfflineMessage">
                        📨 Send Challenge (Offline)
                    </button>
                </div>
            </div>
        `;

        // Set up event listeners for challenge interface
        this.setupMainInterfaceEventListeners();
    }

    private clearTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private clearHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    // Audio methods
    playVictorySound() {
        this.audioService.playVictory();
    }

    playDefeatSound() {
        this.audioService.playDefeat();
    }

    playLevelUpSound() {
        this.audioService.play('levelUp');
    }

    playModeSelectSound() {
        this.audioService.playModeSelect();
    }

    playDramaticModeSelectSound() {
        console.log('🔊 Playing dramatic mode select sound');
        this.audioService.playModeSelect();
    }

    stopBackgroundMusicAfterDelay(delaySeconds: number = 8) {
        setTimeout(() => {
            this.audioService.stopBackgroundMusic();
        }, delaySeconds * 1000);
    }

    playButtonClickSound() {
        console.log('🔊 Playing button click sound');
        this.audioService.playButtonClick();
    }

    playNotificationSound() {
        console.log('🔊 Playing notification sound');
        this.audioService.playNotification();
    }

    startBackgroundMusic() {
        this.audioService.startBackgroundMusic();
    }

    private async saveGameResults(playerWon: boolean, accuracy: number) {
        try {
            console.log('💾 Saving game results to server...');

            const gameResult: GameResult = {
                player: this.gameState.currentPlayer.username,
                realm: this.gameState.currentPlayer.realm,
                score: this.gameState.score,
                correctAnswers: this.gameState.correctAnswers,
                totalQuestions: this.gameState.questionsAnswered,
                completedAt: new Date().toISOString(),
                playerWon: playerWon,
                opponentScore: this.gameState.opponent?.score || 0
            };

            const response = await fetch('/api/game-complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(gameResult)
            });

            if (response.ok) {
                const data: GameCompleteResponse = await response.json();
                console.log('✅ Game results saved:', data);

                // Show rank improvement if available
                if (data.newRank) {
                    this.showNotification(`🏆 New rank: #${data.newRank}!`, 'success');
                }

                // Reload leaderboard to show updated rankings
                await this.loadLeaderboard(this.gameState.currentPlayer.realm);
                this.updateLeaderboardScreen();
            } else {
                console.warn('⚠️ Failed to save game results to server');
            }
        } catch (error) {
            console.error('❌ Error saving game results:', error);
        }
    }


    private async getAIApprenticeResponse(question: Question): Promise<number> {
        if (!this.aiApprentice) {
            // Fallback to random response with some intelligence
            return Math.random() < 0.7 ? question.correct : Math.floor(Math.random() * question.options.length);
        }

        try {
            const response = await this.aiApprentice.answerQuestion(question);
            return response.selectedAnswer;
        } catch (error) {
            console.error('❌ Error getting AI apprentice response:', error);
            // Fallback to random response
            return Math.random() < 0.6 ? question.correct : Math.floor(Math.random() * question.options.length);
        }
    }

    private getQuestionSourceStats() {
        const sourceTypes = {
            'reddit-post': { name: 'Reddit Posts', icon: '📝', color: '#FF4500', description: 'Questions from real Reddit discussions' },
            'gemini-ai': { name: 'AI Generated', icon: '🤖', color: '#4285F4', description: 'Questions created by Gemini AI' },
            'fallback': { name: 'Built-in Knowledge', icon: '📚', color: '#6B7280', description: 'Curated trivia questions' },
            'content-discovery': { name: 'Content Discovery', icon: '🔍', color: '#10B981', description: 'Questions from content analysis' }
        };

        // Count questions by source type from current session
        const sourceCounts: { [key: string]: number } = {};

        // Initialize counts
        Object.keys(sourceTypes).forEach(type => {
            sourceCounts[type] = 0;
        });

        // Count from current question set if available
        if (this.currentQuestionSet) {
            this.currentQuestionSet.forEach(question => {
                const sourceType = question.sourceType || 'fallback';
                sourceCounts[sourceType] = (sourceCounts[sourceType] || 0) + 1;
            });
        }

        const stats = Object.keys(sourceTypes).map(type => ({
            ...sourceTypes[type as keyof typeof sourceTypes],
            count: sourceCounts[type] || 0
        }));

        return stats.sort((a, b) => b.count - a.count);
    }

    // Level progression system
    private calculateDetailedPlayerLevel(score: number, battlesWon: number): any {
        const levels = [
            { name: 'Knowledge Seeker', minScore: 0, minBattles: 0, icon: '🔍', color: '#4facfe' },
            { name: 'Apprentice Scholar', minScore: 500, minBattles: 3, icon: '📚', color: '#667eea' },
            { name: 'Realm Guardian', minScore: 1200, minBattles: 8, icon: '🛡️', color: '#f093fb' },
            { name: 'Master Sage', minScore: 2500, minBattles: 15, icon: '🧙‍♂️', color: '#ffecd2' },
            { name: 'Grand Champion', minScore: 5000, minBattles: 25, icon: '👑', color: '#ffd89b' },
            { name: 'Legendary Master', minScore: 10000, minBattles: 50, icon: '⭐', color: '#ff9a9e' }
        ];

        // Find the highest level the player qualifies for
        let currentLevel = levels[0];
        for (let i = levels.length - 1; i >= 0; i--) {
            if (score >= levels[i].minScore && battlesWon >= levels[i].minBattles) {
                currentLevel = levels[i];
                break;
            }
        }

        // Calculate progress to next level
        const nextLevelIndex = levels.findIndex(l => l.name === currentLevel.name) + 1;
        const nextLevel = nextLevelIndex < levels.length ? levels[nextLevelIndex] : null;
        
        let progress = 100; // Default to 100% if at max level
        if (nextLevel) {
            const scoreProgress = Math.min(100, ((score - currentLevel.minScore) / (nextLevel.minScore - currentLevel.minScore)) * 100);
            const battleProgress = Math.min(100, ((battlesWon - currentLevel.minBattles) / (nextLevel.minBattles - currentLevel.minBattles)) * 100);
            progress = Math.min(scoreProgress, battleProgress);
        }

        return {
            current: currentLevel,
            next: nextLevel,
            progress: Math.round(progress),
            scoreToNext: nextLevel ? nextLevel.minScore - score : 0,
            battlesToNext: nextLevel ? nextLevel.minBattles - battlesWon : 0
        };
    }

    private checkLevelUp(oldLevel: any, newLevel: any): boolean {
        if (!oldLevel || !newLevel) return false;
        return oldLevel.current.name !== newLevel.current.name;
    }

    private showRankUpNotification(newLevel: any) {
        const notification = document.createElement('div');
        notification.className = 'rank-notification';
        notification.innerHTML = `
            <h3>${newLevel.current.icon} RANK UP!</h3>
            <div class="new-rank">${newLevel.current.name}</div>
            <div class="rank-description">
                ${newLevel.next ? 
                    `Next: ${newLevel.next.name} (${newLevel.scoreToNext} points, ${newLevel.battlesToNext} battles)` : 
                    'Maximum rank achieved!'
                }
            </div>
        `;

        document.body.appendChild(notification);

        // Play level up sound
        this.playLevelUpSound();

        // Remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.5s ease-in forwards';
            setTimeout(() => notification.remove(), 500);
        }, 4000);
    }

    private updatePlayerLevel() {
        const oldLevel = this.playerLevel;
        this.playerLevel = this.calculateDetailedPlayerLevel(
            this.gameState.currentPlayer.score,
            this.gameState.currentPlayer.battlesWon
        );

        // Check for level up
        if (this.checkLevelUp(oldLevel, this.playerLevel)) {
            setTimeout(() => {
                this.showRankUpNotification(this.playerLevel);
            }, 2000); // Show after battle results
        }
    }
}

// Initialize game when page loads
console.log('🎮 Loading Reddit Realm Quiz Wars...');
const game = new RedditRealmQuizWars();

// Make game globally accessible
(window as any).game = game;

console.log('🎯 Game loaded successfully!');