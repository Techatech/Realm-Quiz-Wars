// Server-side configuration service
// Loads environment variables and Devvit settings and provides them to both server and client

import { context, settings } from '@devvit/web/server';

export interface GameConfig {
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
    
    // API Keys (server-only, not exposed to client)
    GEMINI_API_KEY: string;
    
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

export interface ClientConfig extends Omit<GameConfig, 'GEMINI_API_KEY'> {
    // Client gets all config except sensitive API keys
    hasGeminiKey: boolean; // Just indicates if key is available
}

class ConfigService {
    private config: GameConfig | null = null;

    constructor() {
        // Don't load config immediately - wait for first request
        // This avoids trying to access Devvit context during module initialization
    }

    private loadConfig(): GameConfig {
        return {
            // AI Configuration
            APPRENTICE_AI_ENABLED: this.getBooleanEnv('APPRENTICE_AI_ENABLED', true),
            APPRENTICE_ERROR_RATE: this.getNumberEnv('APPRENTICE_ERROR_RATE', 0.3),
            APPRENTICE_RESPONSE_DELAY_MAX: this.getNumberEnv('APPRENTICE_RESPONSE_DELAY_MAX', 4000),
            APPRENTICE_RESPONSE_DELAY_MIN: this.getNumberEnv('APPRENTICE_RESPONSE_DELAY_MIN', 2000),
            
            // Game Features
            DEBUG_MODE: this.getBooleanEnv('DEBUG_MODE', true),
            ENABLE_MULTIPLAYER: this.getBooleanEnv('ENABLE_MULTIPLAYER', true),
            ENABLE_REALM_BATTLES: this.getBooleanEnv('ENABLE_REALM_BATTLES', true),
            
            // Environment - Use Devvit setting if available, fallback to env var
            NODE_ENV: this.getDevvitSetting('environment') || process.env.NODE_ENV || 'development',
            PORT: this.getNumberEnv('PORT', 3002),
            
            // API Keys - Use Devvit setting if available, fallback to env var
            GEMINI_API_KEY: this.getDevvitSetting('geminiApiKey') || process.env.GEMINI_API_KEY || '',
            
            // Game Settings
            DEFAULT_QUESTION_TIME: this.getNumberEnv('DEFAULT_QUESTION_TIME', 30),
            QUESTIONS_PER_BATTLE: this.getNumberEnv('QUESTIONS_PER_BATTLE', 6),
            CHAMPION_BATTLE_QUESTIONS: this.getNumberEnv('CHAMPION_BATTLE_QUESTIONS', 10),
            CHAMPION_BATTLE_TIME: this.getNumberEnv('CHAMPION_BATTLE_TIME', 45),
            
            // Audio Settings
            DEFAULT_VOLUME: this.getNumberEnv('DEFAULT_VOLUME', 0.7),
            DEFAULT_MUSIC_VOLUME: this.getNumberEnv('DEFAULT_MUSIC_VOLUME', 0.3),
            
            // Level System
            LEVEL_UP_BONUS_POINTS: this.getNumberEnv('LEVEL_UP_BONUS_POINTS', 100),
            ACCURACY_BONUS_THRESHOLD: this.getNumberEnv('ACCURACY_BONUS_THRESHOLD', 80),
            
            // Multiplayer
            MATCHMAKING_TIMEOUT: this.getNumberEnv('MATCHMAKING_TIMEOUT', 30000),
            CHALLENGE_EXPIRY_TIME: this.getNumberEnv('CHALLENGE_EXPIRY_TIME', 300000),
            CHAMPION_CHALLENGE_EXPIRY: this.getNumberEnv('CHAMPION_CHALLENGE_EXPIRY', 600000),
        };
    }

    private getBooleanEnv(key: string, defaultValue: boolean): boolean {
        const value = process.env[key];
        if (value === undefined) return defaultValue;
        return value.toLowerCase() === 'true';
    }

    private getNumberEnv(key: string, defaultValue: number): number {
        const value = process.env[key];
        if (value === undefined) return defaultValue;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    private getDevvitSetting(key: string): string | undefined {
        try {
            // Only try to access settings if we're in a proper request context
            // This prevents the "No context found" error during server startup
            return undefined; // Always use environment variables for now
        } catch (error) {
            console.warn(`Failed to get Devvit setting ${key}:`, error);
        }
        return undefined;
    }

    /**
     * Async method to get Devvit settings using the proper settings client
     */
    async getDevvitSettingAsync(key: string): Promise<string | undefined> {
        try {
            // Use the proper settings client for async access
            if (settings) {
                const value = await settings.get(key);
                console.log(`📋 Async Devvit setting ${key}:`, value ? '[SET]' : '[NOT SET]');
                return value as string;
            }
            
            // Fallback to sync method
            return this.getDevvitSetting(key);
        } catch (error) {
            console.warn(`Failed to get async Devvit setting ${key}:`, error);
        }
        return undefined;
    }

    /**
     * Async method to load configuration with proper Devvit settings access
     */
    async loadConfigAsync(): Promise<GameConfig> {
        const geminiApiKey = await this.getDevvitSettingAsync('geminiApiKey') || process.env.GEMINI_API_KEY || '';
        const environment = await this.getDevvitSettingAsync('environment') || process.env.NODE_ENV || 'development';
        
        return {
            // AI Configuration
            APPRENTICE_AI_ENABLED: this.getBooleanEnv('APPRENTICE_AI_ENABLED', true),
            APPRENTICE_ERROR_RATE: this.getNumberEnv('APPRENTICE_ERROR_RATE', 0.3),
            APPRENTICE_RESPONSE_DELAY_MAX: this.getNumberEnv('APPRENTICE_RESPONSE_DELAY_MAX', 4000),
            APPRENTICE_RESPONSE_DELAY_MIN: this.getNumberEnv('APPRENTICE_RESPONSE_DELAY_MIN', 2000),
            
            // Game Features
            DEBUG_MODE: this.getBooleanEnv('DEBUG_MODE', true),
            ENABLE_MULTIPLAYER: this.getBooleanEnv('ENABLE_MULTIPLAYER', true),
            ENABLE_REALM_BATTLES: this.getBooleanEnv('ENABLE_REALM_BATTLES', true),
            
            // Environment
            NODE_ENV: environment,
            PORT: this.getNumberEnv('PORT', 3002),
            
            // API Keys
            GEMINI_API_KEY: geminiApiKey,
            
            // Game Settings
            DEFAULT_QUESTION_TIME: this.getNumberEnv('DEFAULT_QUESTION_TIME', 30),
            QUESTIONS_PER_BATTLE: this.getNumberEnv('QUESTIONS_PER_BATTLE', 6),
            CHAMPION_BATTLE_QUESTIONS: this.getNumberEnv('CHAMPION_BATTLE_QUESTIONS', 10),
            CHAMPION_BATTLE_TIME: this.getNumberEnv('CHAMPION_BATTLE_TIME', 45),
            
            // Audio Settings
            DEFAULT_VOLUME: this.getNumberEnv('DEFAULT_VOLUME', 0.7),
            DEFAULT_MUSIC_VOLUME: this.getNumberEnv('DEFAULT_MUSIC_VOLUME', 0.3),
            
            // Level System
            LEVEL_UP_BONUS_POINTS: this.getNumberEnv('LEVEL_UP_BONUS_POINTS', 100),
            ACCURACY_BONUS_THRESHOLD: this.getNumberEnv('ACCURACY_BONUS_THRESHOLD', 80),
            
            // Multiplayer
            MATCHMAKING_TIMEOUT: this.getNumberEnv('MATCHMAKING_TIMEOUT', 30000),
            CHALLENGE_EXPIRY_TIME: this.getNumberEnv('CHALLENGE_EXPIRY_TIME', 300000),
            CHAMPION_CHALLENGE_EXPIRY: this.getNumberEnv('CHAMPION_CHALLENGE_EXPIRY', 600000),
        };
    }

    /**
     * Ensure config is loaded (lazy loading)
     */
    private ensureConfigLoaded(): void {
        if (!this.config) {
            this.config = this.loadConfig();
        }
    }

    /**
     * Get full server configuration (includes sensitive data)
     */
    getServerConfig(): GameConfig {
        this.ensureConfigLoaded();
        return { ...this.config! };
    }

    /**
     * Get client-safe configuration (excludes sensitive data)
     */
    getClientConfig(): ClientConfig {
        this.ensureConfigLoaded();
        const { GEMINI_API_KEY, ...clientConfig } = this.config!;
        return {
            ...clientConfig,
            hasGeminiKey: !!GEMINI_API_KEY && GEMINI_API_KEY.length > 0
        };
    }

    /**
     * Get specific configuration value
     */
    get<K extends keyof GameConfig>(key: K): GameConfig[K] {
        this.ensureConfigLoaded();
        return this.config![key];
    }

    /**
     * Check if Gemini API is available
     */
    hasGeminiAPI(): boolean {
        this.ensureConfigLoaded();
        return !!this.config!.GEMINI_API_KEY && this.config!.GEMINI_API_KEY.length > 0;
    }

    /**
     * Get Gemini API key (server-only)
     */
    getGeminiAPIKey(): string {
        this.ensureConfigLoaded();
        return this.config!.GEMINI_API_KEY;
    }

    /**
     * Check if AI features are enabled
     */
    isAIEnabled(): boolean {
        this.ensureConfigLoaded();
        return this.config!.APPRENTICE_AI_ENABLED && this.hasGeminiAPI();
    }

    /**
     * Check if debug mode is enabled
     */
    isDebugMode(): boolean {
        this.ensureConfigLoaded();
        return this.config!.DEBUG_MODE;
    }

    /**
     * Log configuration (safe for production)
     */
    logConfig(): void {
        const safeConfig = this.getClientConfig();
        console.log('🔧 Game Configuration Loaded:', {
            ...safeConfig,
            environment: this.config!.NODE_ENV,
            port: this.config!.PORT
        });
    }
}

// Export singleton instance
export const configService = new ConfigService();

// Export config for convenience
export const gameConfig = configService.getServerConfig();