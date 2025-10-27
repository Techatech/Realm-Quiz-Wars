import express from "express";
import {
  InitResponse,
  GameCompleteResponse,
  LeaderboardResponse,
  ChallengeResponse,
  ErrorResponse,
  Question,
  LeaderboardEntry,
  GameResult
} from "../shared/types/api";
import {
  createServer,
  context,
  getServerPort,
  reddit,
  redis,
} from "@devvit/web/server";
import { createPost } from "./core/post";
import { AIKnowledgeGenerator } from "./core/ai-knowledge-generator";
import { PlayerChallengeSystem } from "./core/player-challenge-system";
import { ContentDiscoveryService } from "./core/content-discovery-service";
import { ContentSafetyService } from "./core/content-safety-service";
import { KnowledgeVerificationService } from "./core/knowledge-verification-service";
import { configService } from "./core/config-service";
import { QuestionDatabase } from "./core/question-database";

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

const router = express.Router();

// Configuration endpoint - provides client-safe config
router.get("/api/config", async (_req, res): Promise<void> => {
  try {
    const clientConfig = configService.getClientConfig();
    
    // Log configuration on first request (when context is available)
    console.log('🔧 Game Configuration Loaded:', {
      ...clientConfig,
      environment: clientConfig.NODE_ENV,
      port: clientConfig.PORT
    });
    
    res.json({
      success: true,
      config: clientConfig
    });
  } catch (error) {
    console.error('Config endpoint error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to load configuration"
    });
  }
});

// Configuration status endpoint - check Gemini API key and other settings
router.get("/api/config/status", async (_req, res): Promise<void> => {
  try {
    // Load config with async Devvit settings access
    const asyncConfig = await configService.loadConfigAsync();
    
    const status = {
      geminiApiKey: {
        configured: !!asyncConfig.GEMINI_API_KEY && asyncConfig.GEMINI_API_KEY.length > 0,
        source: asyncConfig.GEMINI_API_KEY === process.env.GEMINI_API_KEY ? 'environment' : 'devvit-settings',
        length: asyncConfig.GEMINI_API_KEY ? asyncConfig.GEMINI_API_KEY.length : 0
      },
      environment: asyncConfig.NODE_ENV,
      aiEnabled: !!asyncConfig.GEMINI_API_KEY && asyncConfig.APPRENTICE_AI_ENABLED,
      features: {
        multiplayer: asyncConfig.ENABLE_MULTIPLAYER,
        realmBattles: asyncConfig.ENABLE_REALM_BATTLES,
        debugMode: asyncConfig.DEBUG_MODE
      }
    };
    
    console.log('🔍 Configuration Status Check:', status);
    
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('Config status endpoint error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to check configuration status"
    });
  }
});

// Initialize game data endpoint
router.get<
  { postId: string },
  InitResponse | ErrorResponse
>("/api/init", async (_req, res): Promise<void> => {
  const { postId } = context;

  if (!postId) {
    console.error("API Init Error: postId not found in devvit context");
    res.status(400).json({
      type: "error",
      message: "postId is required but missing from context",
    });
    return;
  }

  try {
    const [username, subreddit] = await Promise.all([
      reddit.getCurrentUsername(),
      reddit.getCurrentSubreddit(),
    ]);

    const realm = subreddit?.name || 'unknown';
    const playerName = username ?? 'anonymous';

    // Generate fresh random questions for each session to prevent memorization
    let questions: Question[] = [];
    
    // Try to generate new questions using AI service first
    try {
      const aiGenerator = new AIKnowledgeGenerator();
      questions = await aiGenerator.generateQuestionsForRealm(realm);
      console.log(`✅ Generated ${questions.length} fresh AI questions for r/${realm}`);
    } catch (error) {
      console.error('AI question generation failed, using comprehensive fallback:', error);
      
      // Use comprehensive question database with fresh randomization each time
      const questionDB = QuestionDatabase.getInstance();
      const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      questions = questionDB.getRandomQuestions(realm, 50, sessionId); // Get 50 random questions with session-based variety
      console.log(`✅ Loaded ${questions.length} random fallback questions for r/${realm} from question database with session ${sessionId}`);
    }

    // Always ensure we have at least 6 questions for gameplay
    if (questions.length < 6) {
      console.warn(`⚠️ Only ${questions.length} questions available for r/${realm}, supplementing with general questions`);
      const questionDB = QuestionDatabase.getInstance();
      const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const additionalQuestions = questionDB.getRandomQuestions('general', 6 - questions.length, sessionId);
      questions = [...questions, ...additionalQuestions];
    }

    // Add timestamp to questions for debugging
    questions = questions.map(q => ({
      ...q,
      sessionId: Date.now() + Math.random() // Unique session identifier
    }));

    // Get leaderboard for this realm
    const leaderboardKey = `realm_leaderboard_${realm}`;
    const leaderboardData = await redis.get(leaderboardKey);
    const leaderboard: LeaderboardEntry[] = leaderboardData ? JSON.parse(leaderboardData) : [];

    // Get player stats
    const playerKey = `player_${playerName}_${realm}`;
    const playerData = await redis.get(playerKey);
    const playerStats = playerData ? JSON.parse(playerData) : {
      score: 0,
      battlesWon: 0,
      battlesLost: 0
    };

    res.json({
      type: "init",
      postId: postId,
      realm: realm,
      username: playerName,
      questions: questions,
      leaderboard: leaderboard,
      playerStats: playerStats
    });

  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    let errorMessage = "Unknown error during initialization";
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`;
    }
    res.status(500).json({
      type: "error",
      message: errorMessage
    });
  }
});

// Complete game endpoint
router.post<
  { postId: string },
  GameCompleteResponse | ErrorResponse,
  GameResult
>("/api/game-complete", async (req, res): Promise<void> => {
  const { postId } = context;
  const gameResult = req.body;

  if (!postId) {
    res.status(400).json({
      type: "error",
      message: "postId is required",
    });
    return;
  }

  try {
    const { player, realm, score, correctAnswers, totalQuestions, playerWon, opponentScore } = gameResult;

    // Update player stats
    const playerKey = `player_${player}_${realm}`;
    const existingPlayer = await redis.get(playerKey);
    const playerData = existingPlayer ? JSON.parse(existingPlayer) : {
      username: player,
      realm: realm,
      score: 0,
      battlesWon: 0,
      battlesLost: 0,
      questionsAnswered: 0,
      correctAnswers: 0
    };

    playerData.score += score;
    playerData.questionsAnswered += totalQuestions;
    playerData.correctAnswers += correctAnswers;

    // Only increment battle count if this was an actual battle (has opponent)
    if (opponentScore !== undefined) {
      if (playerWon) {
        playerData.battlesWon++;
      } else {
        playerData.battlesLost++;
      }
    }

    await redis.set(playerKey, JSON.stringify(playerData));

    // Update leaderboard
    const leaderboardKey = `realm_leaderboard_${realm}`;
    const leaderboardData = await redis.get(leaderboardKey);
    let leaderboard: LeaderboardEntry[] = leaderboardData ? JSON.parse(leaderboardData) : [];

    // Find or create player entry
    const existingEntry = leaderboard.find(entry => entry.username === player);
    if (existingEntry) {
      existingEntry.score += score;
      // Only increment battle count if this was an actual battle (has opponent)
      if (opponentScore !== undefined) {
        if (playerWon) {
          existingEntry.battlesWon++;
        } else {
          existingEntry.battlesLost++;
        }
      }
    } else {
      leaderboard.push({
        username: player,
        score: score,
        battlesWon: (opponentScore !== undefined && playerWon) ? 1 : 0,
        battlesLost: (opponentScore !== undefined && !playerWon) ? 1 : 0,
        realm: realm
      });
    }

    // Sort leaderboard by score
    leaderboard.sort((a, b) => b.score - a.score);

    // Keep only top 50 entries
    leaderboard = leaderboard.slice(0, 50);

    await redis.set(leaderboardKey, JSON.stringify(leaderboard));

    // Find player's new rank
    const newRank = leaderboard.findIndex(entry => entry.username === player) + 1;

    const accuracy = Math.round((correctAnswers / totalQuestions) * 100);

    res.json({
      type: "game_complete",
      finalScore: score,
      correctAnswers: correctAnswers,
      totalQuestions: totalQuestions,
      accuracy: accuracy,
      newRank: newRank > 0 ? newRank : undefined,
      pointsEarned: score
    });

    console.log(`🏆 Game completed for ${player} in r/${realm}: ${score} points (Rank #${newRank})`);

  } catch (error) {
    console.error(`Game completion error:`, error);
    res.status(500).json({
      type: "error",
      message: "Failed to save game results"
    });
  }
});

// Get leaderboard endpoint
router.get<
  { realm?: string },
  LeaderboardResponse | ErrorResponse
>("/api/leaderboard", async (req, res): Promise<void> => {
  try {
    const subreddit = await reddit.getCurrentSubreddit();
    const realm = req.query.realm as string || subreddit?.name || 'unknown';

    const leaderboardKey = `realm_leaderboard_${realm}`;
    const leaderboardData = await redis.get(leaderboardKey);
    const leaderboard: LeaderboardEntry[] = leaderboardData ? JSON.parse(leaderboardData) : [];

    // Get current player's rank if authenticated
    let playerRank: number | undefined;
    try {
      const username = await reddit.getCurrentUsername();
      if (username) {
        playerRank = leaderboard.findIndex(entry => entry.username === username) + 1;
        if (playerRank === 0) playerRank = undefined;
      }
    } catch (error) {
      // User not authenticated, that's fine
    }

    res.json({
      type: "leaderboard",
      realm: realm,
      leaderboard: leaderboard,
      playerRank: playerRank
    });

  } catch (error) {
    console.error(`Leaderboard error:`, error);
    res.status(500).json({
      type: "error",
      message: "Failed to fetch leaderboard"
    });
  }
});

// Forfeit game endpoint
router.post<
  { postId: string },
  { success: boolean; message: string } | ErrorResponse,
  { player: string; realm: string }
>("/api/forfeit", async (req, res): Promise<void> => {
  const { postId } = context;
  const { player, realm } = req.body;

  if (!postId) {
    res.status(400).json({
      type: "error",
      message: "postId is required",
    });
    return;
  }

  try {
    // Update player stats for forfeit
    const playerKey = `player_${player}_${realm}`;
    const existingPlayer = await redis.get(playerKey);
    const playerData = existingPlayer ? JSON.parse(existingPlayer) : {
      username: player,
      realm: realm,
      score: 0,
      battlesWon: 0,
      battlesLost: 0
    };

    playerData.battlesLost++;
    await redis.set(playerKey, JSON.stringify(playerData));

    res.json({
      success: true,
      message: "Game forfeited successfully"
    });

    console.log(`🏳️ Player ${player} forfeited game in r/${realm}`);

  } catch (error) {
    console.error(`Forfeit error:`, error);
    res.status(500).json({
      type: "error",
      message: "Failed to process forfeit"
    });
  }
});

// Challenge champion endpoint
router.post<
  { postId: string },
  ChallengeResponse | ErrorResponse,
  { player: string; realm: string }
>("/api/challenge-champion", async (req, res): Promise<void> => {
  const { postId } = context;
  const { player, realm } = req.body;

  if (!postId) {
    res.status(400).json({
      type: "error",
      message: "postId is required",
    });
    return;
  }

  try {
    const challengeSystem = new PlayerChallengeSystem();
    const challenge = await challengeSystem.challengeChampion(player, realm);

    if (challenge) {
      res.json({
        type: "challenge",
        challenge: challenge,
        success: true,
        message: "Champion challenge sent successfully"
      });
    } else {
      res.json({
        type: "challenge",
        challenge: {} as any,
        success: false,
        message: "No champion available or challenge failed"
      });
    }

  } catch (error) {
    console.error(`Champion challenge error:`, error);
    res.status(500).json({
      type: "error",
      message: "Failed to send champion challenge"
    });
  }
});

// Content discovery endpoint
router.get("/api/content-discovery/:realm", async (req, res): Promise<void> => {
  try {
    const { realm } = req.params;
    const contentDiscovery = new ContentDiscoveryService();

    const discoveredQuestions = await contentDiscovery.getDiscoveredQuestions(realm, 10);
    const realmMetrics = await contentDiscovery.getRealmMetrics(realm);

    res.json({
      success: true,
      realm: realm,
      questions: discoveredQuestions,
      metrics: realmMetrics
    });
  } catch (error) {
    console.error('Content discovery error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to get content discovery data"
    });
  }
});

// Content safety endpoint
router.post("/api/content-safety/check", async (req, res): Promise<void> => {
  try {
    const { subredditName, content } = req.body;
    const contentSafety = new ContentSafetyService();

    const isSubredditSafe = await contentSafety.isSubredditSafe(subredditName);
    const isContentSafe = content ? await contentSafety.filterContent(content) : true;

    res.json({
      success: true,
      subredditSafe: isSubredditSafe,
      contentSafe: isContentSafe,
      overallSafe: isSubredditSafe && isContentSafe
    });
  } catch (error) {
    console.error('Content safety check error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to check content safety"
    });
  }
});

// Knowledge verification endpoint
router.post("/api/knowledge-verification/generate", async (req, res): Promise<void> => {
  try {
    const { topics, subredditName, count } = req.body;
    const knowledgeVerification = new KnowledgeVerificationService();

    const verifiedQuestions = await knowledgeVerification.generateVerifiedQuestions(
      topics,
      subredditName,
      count || 5
    );

    res.json({
      success: true,
      questions: verifiedQuestions,
      count: verifiedQuestions.length
    });
  } catch (error) {
    console.error('Knowledge verification error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to generate verified questions"
    });
  }
});

// AI Apprentice answer endpoint
router.post("/api/apprentice-answer", async (req, res): Promise<void> => {
  try {
    const { options, prompt } = req.body;

    if (!configService.hasGeminiAPI()) {
      res.json({
        success: false,
        message: "AI service not available",
        fallback: true
      });
      return;
    }

    const aiGenerator = new AIKnowledgeGenerator();
    const aiResponse = await aiGenerator.callAIModel(prompt, 'apprentice_answer');

    // Parse AI response to get answer index
    const answerMatch = aiResponse.match(/\d/);
    const selectedAnswer = answerMatch ? parseInt(answerMatch[0]) : null;

    if (selectedAnswer === null || selectedAnswer < 0 || selectedAnswer >= options.length) {
      res.json({
        success: false,
        message: "Invalid AI response",
        fallback: true
      });
      return;
    }

    res.json({
      success: true,
      answer: selectedAnswer,
      reasoning: aiResponse,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('AI Apprentice answer error:', error);
    res.json({
      success: false,
      message: "AI request failed",
      fallback: true
    });
  }
});

// Find realm opponent endpoint
router.post("/api/find-realm-opponent", async (req, res): Promise<void> => {
  try {
    const { playerRealm, excludePlayer } = req.body;

    // Get all leaderboards to find players from other realms
    const realms = ['r/gaming', 'r/science', 'r/movies', 'r/technology', 'r/askreddit', 'r/worldnews'];
    const otherRealms = realms.filter(realm => realm !== playerRealm);

    let foundOpponent = null;

    // Try to find a real player from another realm
    for (const realm of otherRealms) {
      const leaderboardKey = `realm_leaderboard_${realm}`;
      const leaderboardData = await redis.get(leaderboardKey);

      if (leaderboardData) {
        const leaderboard: LeaderboardEntry[] = JSON.parse(leaderboardData);
        const availablePlayers = leaderboard.filter(player =>
          player.username !== excludePlayer &&
          player.battlesWon > 0 // Only active players
        );

        if (availablePlayers.length > 0) {
          // Pick a random opponent with similar skill level
          const randomOpponent = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
          foundOpponent = {
            username: randomOpponent.username,
            realm: realm,
            score: randomOpponent.score,
            battlesWon: randomOpponent.battlesWon
          };
          break;
        }
      }
    }

    if (foundOpponent) {
      res.json({
        success: true,
        opponent: foundOpponent,
        message: "Real opponent found"
      });
      console.log(`🏰 Realm battle: ${excludePlayer} (${playerRealm}) vs ${foundOpponent.username} (${foundOpponent.realm})`);
    } else {
      res.json({
        success: false,
        message: "No real opponents available",
        fallback: true
      });
    }

  } catch (error) {
    console.error('Find realm opponent error:', error);
    res.json({
      success: false,
      message: "Failed to find opponent",
      fallback: true
    });
  }
});

// App install handler
router.post("/internal/on-app-install", async (_req, res): Promise<void> => {
  try {
    console.log('🚀 App installation triggered');
    const post = await createPost();
    const subreddit = await reddit.getCurrentSubreddit();

    console.log(`✅ Successfully created post ${post.id} in r/${subreddit.name}`);
    res.json({
      status: "success",
      message: `Post created in subreddit ${subreddit.name} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`❌ Error in app install handler:`, error);
    res.status(200).json({
      status: "success",
      message: "App installed successfully",
    });
  }
});

// Menu post creation handler
router.post("/internal/menu/post-create", async (_req, res): Promise<void> => {
  try {
    console.log('🎮 Creating new Quiz Wars post via menu');
    const post = await createPost();
    const subreddit = await reddit.getCurrentSubreddit();

    console.log(`✅ Successfully created post ${post.id} in r/${subreddit.name}`);
    res.json({
      navigateTo: `https://reddit.com/r/${subreddit.name}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`❌ Error in menu post creation:`, error);
    res.status(500).json({
      status: "error",
      message: "Failed to create post",
    });
  }
});

app.use(router);

const server = createServer(app);
server.on("error", (err: any) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());

console.log('🚀 Reddit Realm Quiz Wars server started!');
// Configuration will be logged on first API request

// Question database statistics endpoint for monitoring
app.get('/api/question-stats', (req, res) => {
  try {
    const questionDB = QuestionDatabase.getInstance();
    const stats = questionDB.getQuestionStats();
    
    res.json({
      success: true,
      stats: stats,
      totalQuestions: Object.values(stats).reduce((sum, realm) => sum + realm.total, 0),
      totalRealms: Object.keys(stats).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting question stats:', error);
    res.status(500).json({
      success: false,
      message: "Failed to get question statistics"
    });
  }
});

// Clear recently used questions endpoint (for testing/admin)
router.post('/api/clear-question-cache', (req, res) => {
  try {
    const questionDB = QuestionDatabase.getInstance();
    const realm = req.body.realm;
    
    questionDB.clearRecentlyUsedQuestions(realm);
    
    res.json({
      success: true,
      message: realm ? `Cleared question cache for realm: ${realm}` : 'Cleared all question caches',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing question cache:', error);
    res.status(500).json({
      success: false,
      message: "Failed to clear question cache"
    });
  }
});

// Clear question cache for specific realm
router.post('/api/clear-question-cache/:realm', (req, res) => {
  try {
    const questionDB = QuestionDatabase.getInstance();
    const realm = req.params.realm;
    
    questionDB.clearRecentlyUsedQuestions(realm);
    
    res.json({
      success: true,
      message: `Cleared question cache for realm: ${realm}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing question cache:', error);
    res.status(500).json({
      success: false,
      message: "Failed to clear question cache"
    });
  }
});