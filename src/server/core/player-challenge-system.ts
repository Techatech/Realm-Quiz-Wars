import { Challenge } from "../../shared/types/api";
import { redis } from "@devvit/web/server";

export class PlayerChallengeSystem {
  
  async challengeChampion(playerId: string, realm: string): Promise<Challenge | null> {
    try {
      // Find current champion
      const leaderboardKey = `realm_leaderboard_${realm}`;
      const leaderboardData = await redis.get(leaderboardKey);
      
      if (!leaderboardData) {
        console.log(`No leaderboard found for r/${realm}`);
        return null;
      }

      const leaderboard = JSON.parse(leaderboardData);
      if (leaderboard.length === 0) {
        console.log(`No players in r/${realm} leaderboard`);
        return null;
      }

      const champion = leaderboard[0]; // Top player is champion
      
      if (champion.username === playerId) {
        console.log(`Player ${playerId} is already the champion of r/${realm}`);
        return null;
      }

      // Create challenge
      const challengeId = `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const challenge: Challenge = {
        id: challengeId,
        challengerId: playerId,
        challengedId: champion.username,
        realm: realm,
        type: 'champion',
        stakes: {
          points: 500,
          realmHonor: 100
        },
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
      };

      // Store challenge
      const challengeKey = `challenge_${challengeId}`;
      await redis.set(challengeKey, JSON.stringify(challenge), { expiration: new Date(Date.now() + 600 * 1000) }); // 10 minutes expiration

      // Add to champion's pending challenges
      const championChallengesKey = `player_challenges_${champion.username}`;
      const existingChallenges = await redis.get(championChallengesKey);
      const challenges = existingChallenges ? JSON.parse(existingChallenges) : [];
      challenges.push(challengeId);
      await redis.set(championChallengesKey, JSON.stringify(challenges), { expiration: new Date(Date.now() + 600 * 1000) });

      console.log(`👑 Champion challenge created: ${challengeId} (${playerId} vs ${champion.username})`);
      return challenge;

    } catch (error) {
      console.error('Champion challenge creation failed:', error);
      return null;
    }
  }

  async sendChallenge(challengerId: string, challengedId: string, type: 'duel' | 'champion'): Promise<Challenge | null> {
    try {
      const challengeId = `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const challenge: Challenge = {
        id: challengeId,
        challengerId: challengerId,
        challengedId: challengedId,
        realm: 'general', // Will be updated based on context
        type: type,
        stakes: {
          points: type === 'champion' ? 500 : 100,
          realmHonor: type === 'champion' ? 100 : undefined
        },
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes for duel, 10 for champion
      };

      // Store challenge
      const challengeKey = `challenge_${challengeId}`;
      const expiration = type === 'champion' ? 600 : 300; // 10 or 5 minutes
      await redis.set(challengeKey, JSON.stringify(challenge), { expiration: new Date(Date.now() + expiration * 1000) });

      // Add to challenged player's pending challenges
      const playerChallengesKey = `player_challenges_${challengedId}`;
      const existingChallenges = await redis.get(playerChallengesKey);
      const challenges = existingChallenges ? JSON.parse(existingChallenges) : [];
      challenges.push(challengeId);
      await redis.set(playerChallengesKey, JSON.stringify(challenges), { expiration: new Date(Date.now() + expiration * 1000) });

      console.log(`⚔️ Challenge sent: ${challengeId} (${challengerId} vs ${challengedId})`);
      return challenge;

    } catch (error) {
      console.error('Challenge creation failed:', error);
      return null;
    }
  }

  async acceptChallenge(challengeId: string, playerId: string): Promise<any | null> {
    try {
      const challengeKey = `challenge_${challengeId}`;
      const challengeData = await redis.get(challengeKey);
      
      if (!challengeData) {
        console.log(`Challenge ${challengeId} not found or expired`);
        return null;
      }

      const challenge: Challenge = JSON.parse(challengeData);
      
      if (challenge.challengedId !== playerId) {
        console.log(`Player ${playerId} is not the target of challenge ${challengeId}`);
        return null;
      }

      if (challenge.status !== 'pending') {
        console.log(`Challenge ${challengeId} is not pending (status: ${challenge.status})`);
        return null;
      }

      // Update challenge status
      challenge.status = 'accepted';
      await redis.set(challengeKey, JSON.stringify(challenge), { expiration: new Date(Date.now() + 1800 * 1000) }); // 30 minutes for active game

      // Create game session (simplified)
      const gameSessionId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const gameSession = {
        id: gameSessionId,
        challengeId: challengeId,
        players: [challenge.challengerId, challenge.challengedId],
        status: 'active',
        createdAt: new Date().toISOString()
      };

      const gameKey = `game_session_${gameSessionId}`;
      await redis.set(gameKey, JSON.stringify(gameSession), { expiration: new Date(Date.now() + 1800 * 1000) });

      console.log(`✅ Challenge accepted: ${challengeId} -> Game: ${gameSessionId}`);
      return gameSession;

    } catch (error) {
      console.error('Challenge acceptance failed:', error);
      return null;
    }
  }

  async forfeitGame(gameSessionId: string, playerId: string): Promise<boolean> {
    try {
      const gameKey = `game_session_${gameSessionId}`;
      const gameData = await redis.get(gameKey);
      
      if (!gameData) {
        console.log(`Game session ${gameSessionId} not found`);
        return false;
      }

      const gameSession = JSON.parse(gameData);
      
      if (!gameSession.players.includes(playerId)) {
        console.log(`Player ${playerId} is not in game ${gameSessionId}`);
        return false;
      }

      // Mark game as forfeited
      gameSession.status = 'forfeited';
      gameSession.forfeitedBy = playerId;
      gameSession.completedAt = new Date().toISOString();

      await redis.set(gameKey, JSON.stringify(gameSession), { expiration: new Date(Date.now() + 3600 * 1000) }); // Keep for 1 hour for records

      console.log(`🏳️ Game forfeited: ${gameSessionId} by ${playerId}`);
      return true;

    } catch (error) {
      console.error('Game forfeit failed:', error);
      return false;
    }
  }

  async findQuickMatch(playerId: string, type: 'duel'): Promise<any | null> {
    try {
      // Add player to matchmaking queue
      const queueKey = `matchmaking_queue_${type}`;
      const queueData = await redis.get(queueKey);
      const queue = queueData ? JSON.parse(queueData) : [];

      // Check if player is already in queue
      if (queue.includes(playerId)) {
        console.log(`Player ${playerId} already in ${type} queue`);
        return null;
      }

      // If there's someone else in queue, match them
      if (queue.length > 0) {
        const opponentId = queue.shift(); // Get first player in queue
        await redis.set(queueKey, JSON.stringify(queue), { expiration: new Date(Date.now() + 300 * 1000) }); // Update queue

        // Create match
        const challenge = await this.sendChallenge(playerId, opponentId, type);
        if (challenge) {
          // Auto-accept for quick match
          return await this.acceptChallenge(challenge.id, opponentId);
        }
      } else {
        // Add player to queue
        queue.push(playerId);
        await redis.set(queueKey, JSON.stringify(queue), { expiration: new Date(Date.now() + 300 * 1000) }); // 5 minutes in queue
        console.log(`Player ${playerId} added to ${type} matchmaking queue`);
      }

      return null;

    } catch (error) {
      console.error('Quick match failed:', error);
      return null;
    }
  }
}