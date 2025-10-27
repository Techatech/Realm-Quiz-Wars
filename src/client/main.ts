// Reddit Realm Quiz Wars - Client Application
import { loadConfig, getConfig } from './config';

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎮 Reddit Realm Quiz Wars - Enhanced Client Starting...');
  
  // Load configuration from server first
  console.log('📡 Loading configuration from server...');
  await loadConfig();
  const config = getConfig();
  
  // Set global configuration
  (window as any).GAME_CONFIG = config;
  
  // Import and create global game instance
  const { RedditRealmQuizWars } = await import('./game-logic');
  const game = new RedditRealmQuizWars();
  
  // Make game globally accessible for button clicks
  (window as any).game = game;
  
  console.log('🎯 Enhanced game loaded successfully with full feature set!');
  console.log('🔗 Game object available at window.game:', typeof (window as any).game);
  console.log('🔗 Game methods available:', Object.getOwnPropertyNames(Object.getPrototypeOf(game)).filter(name => name.startsWith('start')));
  
  // Test that window.game is accessible
  setTimeout(() => {
    console.log('🧪 Testing window.game access:', typeof (window as any).game);
    console.log('🧪 Testing startSinglePlayer method:', typeof (window as any).game?.startSinglePlayer);
  }, 1000);
  
  // Log configuration in debug mode
  if (config.DEBUG_MODE) {
    console.log('🔧 Game Configuration:', {
      aiEnabled: config.APPRENTICE_AI_ENABLED,
      multiplayerEnabled: config.ENABLE_MULTIPLAYER,
      realmBattlesEnabled: config.ENABLE_REALM_BATTLES,
      hasGeminiKey: config.hasGeminiKey
    });
  }
});

// Export config getter for potential external use
export { getConfig };