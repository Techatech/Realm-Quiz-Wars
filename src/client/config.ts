// Client Configuration - Loaded from server
export interface ClientConfig {
    // AI Configuration
    APPRENTICE_AI_ENABLED: boolean;
    APPRENTICE_ERROR_RATE: number;
    APPRENTICE_RESPONSE_DELAY_MAX: number;
    APPRENTICE_RESPONSE_DELAY_MIN: number;
    
    // Game Features
    DEBUG_MODE: boolean;
    ENABLE_MULTIPLAYER: boolean;
    ENABLE_REALM_BATTLES: boolean;
    
    // Environment
    NODE_ENV: string;
    PORT: number;
    
    // API Keys (server indicates availability without exposing key)
    hasGeminiKey: boolean;
    
    // Game Settings
    DEFAULT_QUESTION_TIME: number;
    QUESTIONS_PER_BATTLE: number;
    CHAMPION_BATTLE_QUESTIONS: number;
    CHAMPION_BATTLE_TIME: number;
    
    // Audio Settings
    DEFAULT_VOLUME: number;
    DEFAULT_MUSIC_VOLUME: number;
    
    // Level System
    LEVEL_UP_BONUS_POINTS: number;
    ACCURACY_BONUS_THRESHOLD: number;
    
    // Multiplayer
    MATCHMAKING_TIMEOUT: number;
    CHALLENGE_EXPIRY_TIME: number;
    CHAMPION_CHALLENGE_EXPIRY: number;
}

// Default configuration (fallback if server is unavailable)
const defaultConfig: ClientConfig = {
    // AI Configuration
    APPRENTICE_AI_ENABLED: true,
    APPRENTICE_ERROR_RATE: 0.3,
    APPRENTICE_RESPONSE_DELAY_MAX: 4000,
    APPRENTICE_RESPONSE_DELAY_MIN: 2000,
    
    // Game Features
    DEBUG_MODE: true,
    ENABLE_MULTIPLAYER: true,
    ENABLE_REALM_BATTLES: true,
    
    // Environment
    NODE_ENV: 'development',
    PORT: 3002,
    
    // API Keys
    hasGeminiKey: false,
    
    // Game Settings
    DEFAULT_QUESTION_TIME: 30,
    QUESTIONS_PER_BATTLE: 6,
    CHAMPION_BATTLE_QUESTIONS: 10,
    CHAMPION_BATTLE_TIME: 45,
    
    // Audio Settings
    DEFAULT_VOLUME: 0.7,
    DEFAULT_MUSIC_VOLUME: 0.3,
    
    // Level System
    LEVEL_UP_BONUS_POINTS: 100,
    ACCURACY_BONUS_THRESHOLD: 80,
    
    // Multiplayer
    MATCHMAKING_TIMEOUT: 30000, // 30 seconds
    CHALLENGE_EXPIRY_TIME: 300000, // 5 minutes
    CHAMPION_CHALLENGE_EXPIRY: 600000, // 10 minutes
};

// Global config object that will be loaded from server
export let config: ClientConfig = { ...defaultConfig };

/**
 * Load configuration from server
 */
export async function loadConfig(): Promise<ClientConfig> {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.config) {
                config = { ...defaultConfig, ...data.config };
                console.log('✅ Configuration loaded from server');
                return config;
            }
        }
        console.warn('⚠️ Failed to load config from server, using defaults');
        return defaultConfig;
    } catch (error) {
        console.error('❌ Error loading config from server:', error);
        return defaultConfig;
    }
}

/**
 * Get current configuration
 */
export function getConfig(): ClientConfig {
    return config;
}

// Export individual settings for convenience (will be updated after config loads)
export const getApprenticeConfig = () => ({
    APPRENTICE_AI_ENABLED: config.APPRENTICE_AI_ENABLED,
    APPRENTICE_ERROR_RATE: config.APPRENTICE_ERROR_RATE,
    APPRENTICE_RESPONSE_DELAY_MAX: config.APPRENTICE_RESPONSE_DELAY_MAX,
    APPRENTICE_RESPONSE_DELAY_MIN: config.APPRENTICE_RESPONSE_DELAY_MIN,
});

export const getGameConfig = () => ({
    DEBUG_MODE: config.DEBUG_MODE,
    ENABLE_MULTIPLAYER: config.ENABLE_MULTIPLAYER,
    ENABLE_REALM_BATTLES: config.ENABLE_REALM_BATTLES,
    DEFAULT_QUESTION_TIME: config.DEFAULT_QUESTION_TIME,
    QUESTIONS_PER_BATTLE: config.QUESTIONS_PER_BATTLE,
});

export const getAudioConfig = () => ({
    DEFAULT_VOLUME: config.DEFAULT_VOLUME,
    DEFAULT_MUSIC_VOLUME: config.DEFAULT_MUSIC_VOLUME,
});

// Legacy exports for backward compatibility
export const DEBUG_MODE = () => config.DEBUG_MODE;
export const ENABLE_MULTIPLAYER = () => config.ENABLE_MULTIPLAYER;
export const ENABLE_REALM_BATTLES = () => config.ENABLE_REALM_BATTLES;
export const hasGeminiKey = () => config.hasGeminiKey;