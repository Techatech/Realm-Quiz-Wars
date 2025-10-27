# 🃏 Reddit Realm Quiz Wars

A knowledge-based multiplayer card game built for Reddit's Developer Platform using Devvit Web, where communities battle through quiz challenges powered by AI-generated questions.

## 🎮 Game Overview

Reddit Realm Quiz Wars transforms Reddit communities into knowledge-battling realms. Players represent their subreddits in epic quiz duels, testing expertise on community topics and general knowledge. Challenge "The Realm's Apprentice" in single-player mode, duel other champions in multiplayer battles, or engage in massive realm vs realm wars!

### Key Features

- **🤖 AI-Powered Content Discovery**: Automated scanning of Reddit content with Devvit-approved LLMs (OpenAI ChatGPT, Google Gemini)
- **🔍 Intelligent Question Generation**: Dynamic questions based on trending subreddit topics and discussions (compliant with Devvit data usage rules)
- **🎯 Advanced Matchmaking**: Smart opponent matching based on skill level, realm, and availability
- **⚔️ Multi-Modal Challenge System**: Direct challenges, quick matches, and realm vs realm battles
- **📱 Real-Time Player Status**: Online/offline tracking with challenge availability management
- **🏆 Dynamic Leaderboards**: Live realm rankings with master champion tracking
- **🧠 Adaptive Difficulty**: AI-analyzed content difficulty matching player skill levels
- **🏰 Periodic Content Updates**: Continuous discovery of new topics and trending discussions
- **📨 Challenge Notifications**: In-game and Reddit comment challenge system
- **🎮 Multiple Game Modes**: Single-player vs AI, quick matches, direct challenges, realm wars

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Devvit CLI installed (`npm install -g devvit`)
- Reddit Developer Account
- Claude API Key (optional, for AI features)


### Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. Start local development:
   ```bash
   npm run start  # Local server for testing
   devvit dev     # Devvit development mode
   ```

5. Upload to Reddit:
   ```bash
   devvit upload
   ```

### AI Model Setup

The game supports multiple AI providers for question generation:

**OpenAI ChatGPT Integration (Devvit-Approved):**
```bash
export OPENAI_API_KEY="your_openai_api_key"
```

**Google Gemini Integration (Devvit-Approved):**
```bash
export GEMINI_API_KEY="your_google_gemini_api_key"
```

The game now features advanced AI-powered question generation using Google Gemini:
- **Dynamic Content**: Fresh questions generated in real-time based on realm topics
- **Adaptive Difficulty**: AI adjusts question complexity based on player performance  
- **Realm-Specific Knowledge**: Questions tailored to specific subreddit communities
- **Fallback System**: Comprehensive offline question bank when AI is unavailable

**Fallback Mode:**
If no AI keys are provided, the game uses a comprehensive fallback knowledge base.


## 🏗️ Technical Architecture

### Devvit Integration
- **Interactive Posts**: Game embedded directly in Reddit posts
- **Redis Storage**: Persistent game state across sessions
- **Reddit API**: Player authentication and subreddit integration
- **Real-time Updates**: Live synchronization of game state


## 🎨 Kiro Integration Showcase

This project demonstrates creative Kiro usage throughout development:

1. **Rapid Prototyping**: Used Kiro to quickly scaffold the entire project structure
2. **Responsive Design**: Leveraged Kiro for CSS media queries and mobile optimization
3. **Game Balance**: Iterated on battle mechanics with Kiro's assistance
4. **Code Organization**: Structured modular architecture with Kiro's guidance
5. **Testing Strategy**: Developed comprehensive testing approach

## 📱 Responsive Features

- **Mobile-First**: Optimized touch controls for mobile Reddit users
- **Touch Gestures**: Intuitive territory selection on touch devices
- **Performance**: Optimized rendering for various device capabilities

## 🏆 Competition Criteria

### Community Play ✅
- **Massively Multiplayer**: Supports unlimited concurrent players
- **Synchronous Elements**: Real-time battles and territory updates
- **Asynchronous Strategy**: Long-term planning and coordination
- **Social Integration**: Deep Reddit community integration

### Polish Level ✅
- **Custom Splash Screen**: Branded loading experience
- **Responsive Design**: Works across all device sizes
- **Smooth Animations**: Polished visual feedback
- **Error Handling**: Graceful failure recovery
- **Performance Optimized**: Efficient rendering and updates

### Best Kiro Developer Experience ✅
- **Workflow Integration**: Kiro used throughout entire development cycle
- **Creative Problem Solving**: Leveraged AI for game balance and UX decisions
- **Rapid Iteration**: Quick prototyping and testing cycles
- **Code Quality**: Maintained high standards with AI assistance

## 🔧 Development Commands

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run test suite

# Devvit Commands
devvit dev           # Local development
devvit upload        # Deploy to Reddit
devvit logs          # View application logs
```


## 🤝 Contributing

This is a hackathon project, but contributions and feedback are welcome! Please feel free to:

- Report bugs or suggest improvements
- Share gameplay strategies
- Contribute to game balance discussions

## 📄 License

MIT License - Built for Reddit's Developer Platform Hackathon

---

**Ready for Beta Testing** 🚀

This game is production-ready and optimized for Reddit's platform. Join the battle and help your subreddit dominate the realm!