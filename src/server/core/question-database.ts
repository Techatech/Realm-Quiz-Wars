// Reddit Realm Quiz Wars - Comprehensive Question Database
import { Question } from "../../shared/types/api";
import { COMPREHENSIVE_QUESTIONS } from "./comprehensive-questions";

export class QuestionDatabase {
  private static instance: QuestionDatabase;
  private questionBank: Map<string, Question[]> = new Map();
  private recentlyUsedQuestions: Map<string, Set<string>> = new Map(); // Track recently used questions per realm
  private questionCooldownPeriod: number = 10; // Number of questions before a question can be reused

  private constructor() {
    this.initializeQuestionBank();
  }

  public static getInstance(): QuestionDatabase {
    if (!QuestionDatabase.instance) {
      QuestionDatabase.instance = new QuestionDatabase();
    }
    return QuestionDatabase.instance;
  }

  /**
   * Get random questions for a specific realm/subreddit with enhanced anti-cheating measures
   * @param realm - The subreddit name (e.g., 'gaming', 'science')
   * @param count - Number of questions to return (default: 6)
   * @param sessionId - Optional session ID for additional randomization
   * @returns Array of randomly selected questions with maximum variety
   */
  public getRandomQuestions(realm: string, count: number = 6, sessionId?: string): Question[] {
    const normalizedRealm = this.normalizeRealmName(realm);
    let realmQuestions = this.questionBank.get(normalizedRealm);
    
    // If no specific realm questions, try general categories
    if (!realmQuestions || realmQuestions.length === 0) {
      realmQuestions = this.questionBank.get('general') || [];
      console.warn(`No questions found for realm: ${realm}, using general questions`);
    }

    // If still no questions, create some basic fallback
    if (realmQuestions.length === 0) {
      realmQuestions = this.getBasicFallbackQuestions();
    }

    // Enhanced anti-cheating: Mix questions from multiple difficulty levels
    const questions = this.getBalancedQuestionMix([...realmQuestions], count, sessionId);
    
    // Shuffle answer options to prevent memorizing positions
    const questionsWithShuffledOptions = this.shuffleQuestionOptions(questions);
    
    // Final shuffle with session-based seed for unpredictability
    return this.advancedShuffle(questionsWithShuffledOptions, sessionId);
  }

  /**
   * Get a balanced mix of questions across different difficulty levels
   * This prevents players from memorizing question patterns
   */
  private getBalancedQuestionMix(questions: Question[], count: number, sessionId?: string): Question[] {
    const realm = this.getCurrentRealm(questions);
    
    // Filter out recently used questions to prevent repetition
    const availableQuestions = this.filterRecentlyUsedQuestions(questions, realm);
    
    // Separate questions by difficulty
    const easyQuestions = availableQuestions.filter(q => q.difficulty === 'easy');
    const mediumQuestions = availableQuestions.filter(q => q.difficulty === 'medium');
    const hardQuestions = availableQuestions.filter(q => q.difficulty === 'hard');
    
    // Calculate balanced distribution (roughly 40% easy, 40% medium, 20% hard)
    const easyCount = Math.ceil(count * 0.4);
    const mediumCount = Math.ceil(count * 0.4);
    const hardCount = count - easyCount - mediumCount;
    
    const selectedQuestions: Question[] = [];
    
    // Select questions from each difficulty level
    if (easyQuestions.length > 0) {
      selectedQuestions.push(...this.shuffleArray(easyQuestions).slice(0, Math.min(easyCount, easyQuestions.length)));
    }
    
    if (mediumQuestions.length > 0) {
      selectedQuestions.push(...this.shuffleArray(mediumQuestions).slice(0, Math.min(mediumCount, mediumQuestions.length)));
    }
    
    if (hardQuestions.length > 0) {
      selectedQuestions.push(...this.shuffleArray(hardQuestions).slice(0, Math.min(hardCount, hardQuestions.length)));
    }
    
    // If we don't have enough questions from balanced selection, fill with random ones
    if (selectedQuestions.length < count) {
      const remaining = this.shuffleArray(availableQuestions.filter(q => !selectedQuestions.includes(q)));
      selectedQuestions.push(...remaining.slice(0, count - selectedQuestions.length));
    }
    
    // Track the selected questions as recently used
    this.trackRecentlyUsedQuestions(selectedQuestions, realm);
    
    return selectedQuestions.slice(0, count);
  }

  /**
   * Filter out recently used questions to prevent immediate repetition
   */
  private filterRecentlyUsedQuestions(questions: Question[], realm: string): Question[] {
    const recentlyUsed = this.recentlyUsedQuestions.get(realm) || new Set();
    
    // If we have enough non-recently-used questions, filter them out
    const availableQuestions = questions.filter(q => !recentlyUsed.has(this.getQuestionId(q)));
    
    // If filtering would leave us with too few questions, use all questions
    if (availableQuestions.length < 6) {
      console.log(`🔄 Resetting question cooldown for realm ${realm} - not enough fresh questions`);
      this.recentlyUsedQuestions.set(realm, new Set());
      return questions;
    }
    
    return availableQuestions;
  }

  /**
   * Track recently used questions for cooldown period
   */
  private trackRecentlyUsedQuestions(questions: Question[], realm: string): void {
    if (!this.recentlyUsedQuestions.has(realm)) {
      this.recentlyUsedQuestions.set(realm, new Set());
    }
    
    const recentlyUsed = this.recentlyUsedQuestions.get(realm)!;
    
    // Add new questions to recently used
    questions.forEach(q => {
      recentlyUsed.add(this.getQuestionId(q));
    });
    
    // If we have too many tracked questions, remove the oldest ones
    if (recentlyUsed.size > this.questionCooldownPeriod * 6) {
      const questionsArray = Array.from(recentlyUsed);
      const toKeep = questionsArray.slice(-this.questionCooldownPeriod * 3);
      this.recentlyUsedQuestions.set(realm, new Set(toKeep));
    }
  }

  /**
   * Generate a unique ID for a question based on its content
   */
  private getQuestionId(question: Question): string {
    return `${question.question}-${question.correct}`;
  }

  /**
   * Get the realm from a set of questions (for tracking purposes)
   */
  private getCurrentRealm(questions: Question[]): string {
    if (questions.length > 0 && questions[0].topic) {
      return questions[0].topic.toLowerCase();
    }
    return 'general';
  }

  /**
   * Advanced shuffle algorithm with session-based seeding for maximum unpredictability
   */
  private advancedShuffle<T>(array: T[], sessionId?: string): T[] {
    const shuffled = [...array];
    
    // Use session ID and timestamp for additional randomness
    const seed = sessionId ? this.hashCode(sessionId) : Date.now();
    const random = this.seededRandom(seed);
    
    // Fisher-Yates shuffle with seeded random
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Additional randomization pass
    for (let i = 0; i < shuffled.length; i++) {
      const j = Math.floor(Math.random() * shuffled.length);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
  }

  /**
   * Generate a hash code from a string for seeded randomization
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Seeded random number generator for reproducible but unpredictable sequences
   */
  private seededRandom(seed: number): () => number {
    let x = seed;
    return function() {
      x = Math.sin(x) * 10000;
      return x - Math.floor(x);
    };
  }

  /**
   * Get all available realms/subreddits
   */
  public getAvailableRealms(): string[] {
    return Array.from(this.questionBank.keys());
  }

  /**
   * Get total question count for a realm
   */
  public getQuestionCount(realm: string): number {
    const normalizedRealm = this.normalizeRealmName(realm);
    return this.questionBank.get(normalizedRealm)?.length || 0;
  }

  private normalizeRealmName(realm: string): string {
    // Remove 'r/' prefix if present and convert to lowercase
    return realm.replace(/^r\//, '').toLowerCase();
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private initializeQuestionBank(): void {
    // Load questions from comprehensive question sets and generate additional ones
    this.questionBank.set('gaming', [...COMPREHENSIVE_QUESTIONS.gaming, ...this.generateAdditionalGamingQuestions(), ...this.generateDynamicGamingQuestions()]);
    this.questionBank.set('science', [...COMPREHENSIVE_QUESTIONS.science, ...this.generateAdditionalScienceQuestions(), ...this.generateDynamicScienceQuestions()]);
    this.questionBank.set('technology', [...COMPREHENSIVE_QUESTIONS.technology, ...this.generateAdditionalTechnologyQuestions(), ...this.generateDynamicTechnologyQuestions()]);
    
    // Create expanded questions for other popular subreddits
    this.questionBank.set('movies', [...this.getMoviesQuestions(), ...this.generateDynamicMoviesQuestions()]);
    this.questionBank.set('askreddit', [...this.getAskRedditQuestions(), ...this.generateDynamicRedditQuestions()]);
    this.questionBank.set('worldnews', [...this.getWorldNewsQuestions(), ...this.generateDynamicWorldNewsQuestions()]);
    this.questionBank.set('general', [...this.getGeneralRedditQuestions(), ...this.generateDynamicGeneralQuestions()]);
    this.questionBank.set('programming', [...this.getProgrammingQuestions(), ...this.generateDynamicProgrammingQuestions()]);
    this.questionBank.set('history', [...this.getHistoryQuestions(), ...this.generateDynamicHistoryQuestions()]);
    this.questionBank.set('sports', [...this.getSportsQuestions(), ...this.generateDynamicSportsQuestions()]);

    console.log(`📚 Question database initialized with ${this.getTotalQuestionCount()} questions across ${this.questionBank.size} realms`);
    
    // Log question counts per realm for debugging
    this.questionBank.forEach((questions, realm) => {
      console.log(`📊 ${realm}: ${questions.length} questions available`);
    });
  }

  private getTotalQuestionCount(): number {
    return Array.from(this.questionBank.values()).reduce((total, questions) => total + questions.length, 0);
  }

  private getBasicFallbackQuestions(): Question[] {
    return [
      {
        question: "What does 'OP' stand for on Reddit?",
        options: ["Original Poster", "Online Person", "Open Post", "Other People"],
        correct: 0,
        difficulty: "easy",
        topic: "Reddit",
        source: "fallback"
      },
      {
        question: "What is the purpose of upvoting on Reddit?",
        options: ["To like a post", "To show agreement", "To increase visibility", "All of the above"],
        correct: 3,
        difficulty: "easy",
        topic: "Reddit",
        source: "fallback"
      },
      {
        question: "What is a subreddit?",
        options: ["A user profile", "A topic-specific community", "A type of post", "A Reddit feature"],
        correct: 1,
        difficulty: "easy",
        topic: "Reddit",
        source: "fallback"
      },
      {
        question: "What does 'karma' represent on Reddit?",
        options: ["Points from upvotes/downvotes", "Time spent on Reddit", "Number of posts", "Account age"],
        correct: 0,
        difficulty: "easy",
        topic: "Reddit",
        source: "fallback"
      },
      {
        question: "What is Reddit's slogan?",
        options: ["The Front Page of the Internet", "Where Communities Thrive", "Social News Aggregation", "The Voice of the Internet"],
        correct: 0,
        difficulty: "easy",
        topic: "Reddit",
        source: "fallback"
      },
      {
        question: "What does 'AMA' stand for?",
        options: ["Ask Me Anything", "Always Make Answers", "All My Answers", "Ask More Again"],
        correct: 0,
        difficulty: "easy",
        topic: "Reddit",
        source: "fallback"
      }
    ];
  }

  private generateAdditionalGamingQuestions(): Question[] {
    return [
      // Additional gaming questions to reach ~100 total
      {
        question: "What is the name of the main character in the Assassin's Creed series?",
        options: ["Ezio Auditore", "Altair Ibn-La'Ahad", "Varies by game", "Desmond Miles"],
        correct: 2,
        difficulty: "medium",
        topic: "Gaming",
        source: "fallback"
      },
      {
        question: "Which game engine powers Half-Life 2?",
        options: ["Unreal Engine", "Source Engine", "id Tech", "CryEngine"],
        correct: 1,
        difficulty: "medium",
        topic: "Gaming",
        source: "fallback"
      },
      {
        question: "What is the maximum level cap in World of Warcraft Classic?",
        options: ["50", "60", "70", "80"],
        correct: 1,
        difficulty: "medium",
        topic: "Gaming",
        source: "fallback"
      },
      {
        question: "Which game popularized the battle royale genre?",
        options: ["PUBG", "Fortnite", "Apex Legends", "H1Z1"],
        correct: 0,
        difficulty: "medium",
        topic: "Gaming",
        source: "fallback"
      },
      {
        question: "What year was the original Legend of Zelda released?",
        options: ["1985", "1986", "1987", "1988"],
        correct: 1,
        difficulty: "medium",
        topic: "Gaming",
        source: "fallback"
      }
    ];
  }

  private generateAdditionalScienceQuestions(): Question[] {
    return [
      // Additional science questions to reach ~100 total
      {
        question: "What is the atomic number of carbon?",
        options: ["4", "6", "8", "12"],
        correct: 1,
        difficulty: "medium",
        topic: "Science",
        source: "fallback"
      },
      {
        question: "Which scientist developed the theory of evolution?",
        options: ["Isaac Newton", "Albert Einstein", "Charles Darwin", "Galileo Galilei"],
        correct: 2,
        difficulty: "medium",
        topic: "Science",
        source: "fallback"
      },
      {
        question: "What is the pH of pure water?",
        options: ["6", "7", "8", "9"],
        correct: 1,
        difficulty: "medium",
        topic: "Science",
        source: "fallback"
      },
      {
        question: "How many chromosomes do humans have?",
        options: ["44", "46", "48", "50"],
        correct: 1,
        difficulty: "medium",
        topic: "Science",
        source: "fallback"
      },
      {
        question: "What is the most abundant gas in the universe?",
        options: ["Oxygen", "Nitrogen", "Hydrogen", "Helium"],
        correct: 2,
        difficulty: "medium",
        topic: "Science",
        source: "fallback"
      }
    ];
  }

  private generateAdditionalTechnologyQuestions(): Question[] {
    return [
      // Additional technology questions to reach ~100 total
      {
        question: "What does 'API' stand for?",
        options: ["Application Programming Interface", "Advanced Programming Interface", "Automated Programming Interface", "Application Process Interface"],
        correct: 0,
        difficulty: "medium",
        topic: "Technology",
        source: "fallback"
      },
      {
        question: "Which company created the Git version control system?",
        options: ["Microsoft", "Google", "Linus Torvalds", "GitHub"],
        correct: 2,
        difficulty: "medium",
        topic: "Technology",
        source: "fallback"
      },
      {
        question: "What does 'SQL' stand for?",
        options: ["Structured Query Language", "Simple Query Language", "Standard Query Language", "System Query Language"],
        correct: 0,
        difficulty: "medium",
        topic: "Technology",
        source: "fallback"
      },
      {
        question: "What is the time complexity of binary search?",
        options: ["O(n)", "O(log n)", "O(n²)", "O(1)"],
        correct: 1,
        difficulty: "hard",
        topic: "Technology",
        source: "fallback"
      },
      {
        question: "Which design pattern ensures a class has only one instance?",
        options: ["Factory", "Observer", "Singleton", "Strategy"],
        correct: 2,
        difficulty: "hard",
        topic: "Technology",
        source: "fallback"
      }
    ];
  }

  private getMoviesQuestions(): Question[] {
    return [
      {
        question: "Who directed the movie 'Jaws'?",
        options: ["George Lucas", "Steven Spielberg", "Martin Scorsese", "Francis Ford Coppola"],
        correct: 1,
        difficulty: "easy",
        topic: "Movies",
        source: "fallback"
      },
      {
        question: "Which movie won the Academy Award for Best Picture in 2020?",
        options: ["1917", "Joker", "Parasite", "Once Upon a Time in Hollywood"],
        correct: 2,
        difficulty: "easy",
        topic: "Movies",
        source: "fallback"
      },
      {
        question: "What is the highest-grossing film of all time?",
        options: ["Avatar", "Avengers: Endgame", "Titanic", "Star Wars: The Force Awakens"],
        correct: 1,
        difficulty: "easy",
        topic: "Movies",
        source: "fallback"
      },
      {
        question: "Who played the character of Jack Sparrow in Pirates of the Caribbean?",
        options: ["Orlando Bloom", "Johnny Depp", "Geoffrey Rush", "Keira Knightley"],
        correct: 1,
        difficulty: "easy",
        topic: "Movies",
        source: "fallback"
      },
      {
        question: "Which animated movie features the song 'Let It Go'?",
        options: ["Moana", "Tangled", "Frozen", "The Little Mermaid"],
        correct: 2,
        difficulty: "easy",
        topic: "Movies",
        source: "fallback"
      }
    ];
  }

  private getAskRedditQuestions(): Question[] {
    return [
      {
        question: "What is the most common question type on r/AskReddit?",
        options: ["Personal experiences", "Hypothetical scenarios", "Advice requests", "All of the above"],
        correct: 3,
        difficulty: "easy",
        topic: "Reddit Culture",
        source: "fallback"
      },
      {
        question: "What does 'TL;DR' mean on Reddit?",
        options: ["Too Long; Didn't Read", "Too Late; Don't Reply", "Top Level; Direct Response", "Time Limit; Delete Reply"],
        correct: 0,
        difficulty: "easy",
        topic: "Reddit Culture",
        source: "fallback"
      },
      {
        question: "What is Reddit Gold?",
        options: ["A premium membership", "A type of award", "Virtual currency", "All of the above"],
        correct: 3,
        difficulty: "easy",
        topic: "Reddit Culture",
        source: "fallback"
      },
      {
        question: "What does 'AMA' stand for?",
        options: ["Ask Me Anything", "Always Make Answers", "All My Answers", "Ask More Again"],
        correct: 0,
        difficulty: "easy",
        topic: "Reddit Culture",
        source: "fallback"
      },
      {
        question: "What is the Reddit mascot called?",
        options: ["Snoo", "Reddy", "Alien", "Bob"],
        correct: 0,
        difficulty: "easy",
        topic: "Reddit Culture",
        source: "fallback"
      }
    ];
  }

  private getWorldNewsQuestions(): Question[] {
    return [
      {
        question: "What is the capital of Australia?",
        options: ["Sydney", "Melbourne", "Canberra", "Perth"],
        correct: 2,
        difficulty: "easy",
        topic: "Geography",
        source: "fallback"
      },
      {
        question: "Which country has the largest population?",
        options: ["India", "China", "United States", "Indonesia"],
        correct: 1,
        difficulty: "easy",
        topic: "Geography",
        source: "fallback"
      },
      {
        question: "What is the smallest country in the world?",
        options: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"],
        correct: 1,
        difficulty: "easy",
        topic: "Geography",
        source: "fallback"
      },
      {
        question: "Which continent is known as the 'Dark Continent'?",
        options: ["Asia", "South America", "Africa", "Australia"],
        correct: 2,
        difficulty: "easy",
        topic: "Geography",
        source: "fallback"
      },
      {
        question: "What is the longest river in the world?",
        options: ["Amazon River", "Nile River", "Mississippi River", "Yangtze River"],
        correct: 1,
        difficulty: "easy",
        topic: "Geography",
        source: "fallback"
      }
    ];
  }

  private getGeneralRedditQuestions(): Question[] {
    return [
      {
        question: "What does 'OP' stand for on Reddit?",
        options: ["Original Poster", "Online Person", "Open Post", "Other People"],
        correct: 0,
        difficulty: "easy",
        topic: "Reddit",
        source: "fallback"
      },
      {
        question: "What is the purpose of upvoting on Reddit?",
        options: ["To like a post", "To show agreement", "To increase visibility", "All of the above"],
        correct: 3,
        difficulty: "easy",
        topic: "Reddit",
        source: "fallback"
      },
      {
        question: "What is a subreddit?",
        options: ["A user profile", "A topic-specific community", "A type of post", "A Reddit feature"],
        correct: 1,
        difficulty: "easy",
        topic: "Reddit",
        source: "fallback"
      },
      {
        question: "What does 'karma' represent on Reddit?",
        options: ["Points from upvotes/downvotes", "Time spent on Reddit", "Number of posts", "Account age"],
        correct: 0,
        difficulty: "easy",
        topic: "Reddit",
        source: "fallback"
      },
      {
        question: "What is Reddit's slogan?",
        options: ["The Front Page of the Internet", "Where Communities Thrive", "Social News Aggregation", "The Voice of the Internet"],
        correct: 0,
        difficulty: "easy",
        topic: "Reddit",
        source: "fallback"
      }
    ];
  }

  private getProgrammingQuestions(): Question[] {
    return [
      {
        question: "Which programming language is known as the 'language of the web'?",
        options: ["Python", "JavaScript", "Java", "C++"],
        correct: 1,
        difficulty: "easy",
        topic: "Programming",
        source: "fallback"
      },
      {
        question: "What does 'HTML' stand for?",
        options: ["HyperText Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyperlink and Text Markup Language"],
        correct: 0,
        difficulty: "easy",
        topic: "Programming",
        source: "fallback"
      },
      {
        question: "Which symbol is used for comments in Python?",
        options: ["//", "/*", "#", "<!--"],
        correct: 2,
        difficulty: "easy",
        topic: "Programming",
        source: "fallback"
      },
      {
        question: "What is Git primarily used for?",
        options: ["Database management", "Version control", "Web hosting", "Code compilation"],
        correct: 1,
        difficulty: "easy",
        topic: "Programming",
        source: "fallback"
      },
      {
        question: "Which company developed the Java programming language?",
        options: ["Microsoft", "Apple", "Sun Microsystems", "Google"],
        correct: 2,
        difficulty: "easy",
        topic: "Programming",
        source: "fallback"
      }
    ];
  }

  private getHistoryQuestions(): Question[] {
    return [
      {
        question: "In which year did World War II end?",
        options: ["1944", "1945", "1946", "1947"],
        correct: 1,
        difficulty: "easy",
        topic: "History",
        source: "fallback"
      },
      {
        question: "Who was the first person to walk on the moon?",
        options: ["Buzz Aldrin", "Neil Armstrong", "John Glenn", "Alan Shepard"],
        correct: 1,
        difficulty: "easy",
        topic: "History",
        source: "fallback"
      },
      {
        question: "Which ancient wonder of the world was located in Alexandria?",
        options: ["Hanging Gardens", "Lighthouse of Alexandria", "Colossus of Rhodes", "Temple of Artemis"],
        correct: 1,
        difficulty: "easy",
        topic: "History",
        source: "fallback"
      },
      {
        question: "Who painted the Mona Lisa?",
        options: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Michelangelo"],
        correct: 2,
        difficulty: "easy",
        topic: "History",
        source: "fallback"
      },
      {
        question: "Which empire was ruled by Julius Caesar?",
        options: ["Greek Empire", "Roman Empire", "Byzantine Empire", "Persian Empire"],
        correct: 1,
        difficulty: "easy",
        topic: "History",
        source: "fallback"
      }
    ];
  }

  private getSportsQuestions(): Question[] {
    return [
      {
        question: "How many players are on a basketball team on the court at one time?",
        options: ["4", "5", "6", "7"],
        correct: 1,
        difficulty: "easy",
        topic: "Sports",
        source: "fallback"
      },
      {
        question: "Which sport is known as 'America's Pastime'?",
        options: ["Football", "Basketball", "Baseball", "Hockey"],
        correct: 2,
        difficulty: "easy",
        topic: "Sports",
        source: "fallback"
      },
      {
        question: "How often are the Summer Olympic Games held?",
        options: ["Every 2 years", "Every 3 years", "Every 4 years", "Every 5 years"],
        correct: 2,
        difficulty: "easy",
        topic: "Sports",
        source: "fallback"
      },
      {
        question: "In which sport would you perform a slam dunk?",
        options: ["Volleyball", "Basketball", "Tennis", "Badminton"],
        correct: 1,
        difficulty: "easy",
        topic: "Sports",
        source: "fallback"
      },
      {
        question: "What is the maximum score possible in ten-pin bowling?",
        options: ["200", "250", "300", "350"],
        correct: 2,
        difficulty: "easy",
        topic: "Sports",
        source: "fallback"
      }
    ];
  }

  // Dynamic question generators for enhanced variety and anti-cheating
  private generateDynamicGamingQuestions(): Question[] {
    return [
      {
        question: "Which game series features the character Lara Croft?",
        options: ["Uncharted", "Tomb Raider", "Assassin's Creed", "Far Cry"],
        correct: 1,
        difficulty: "easy",
        topic: "Gaming",
        source: "dynamic"
      },
      {
        question: "What is the name of the main character in the Witcher series?",
        options: ["Geralt of Rivia", "Triss Merigold", "Yennefer", "Dandelion"],
        correct: 0,
        difficulty: "medium",
        topic: "Gaming",
        source: "dynamic"
      },
      {
        question: "Which game popularized the 'souls-like' genre?",
        options: ["Dark Souls", "Demon's Souls", "Bloodborne", "Sekiro"],
        correct: 1,
        difficulty: "hard",
        topic: "Gaming",
        source: "dynamic"
      },
      {
        question: "What does 'FPS' stand for in gaming?",
        options: ["First Person Shooter", "Frames Per Second", "Both A and B", "Fast Paced Strategy"],
        correct: 2,
        difficulty: "medium",
        topic: "Gaming",
        source: "dynamic"
      },
      {
        question: "Which company developed Minecraft?",
        options: ["Microsoft", "Mojang", "Notch", "Both B and C"],
        correct: 3,
        difficulty: "medium",
        topic: "Gaming",
        source: "dynamic"
      },
      {
        question: "What is the maximum level in Pokemon Red/Blue?",
        options: ["99", "100", "255", "No limit"],
        correct: 1,
        difficulty: "medium",
        topic: "Gaming",
        source: "dynamic"
      },
      {
        question: "Which game engine powers Genshin Impact?",
        options: ["Unity", "Unreal Engine", "Custom Engine", "CryEngine"],
        correct: 0,
        difficulty: "hard",
        topic: "Gaming",
        source: "dynamic"
      },
      {
        question: "What year was Steam launched?",
        options: ["2002", "2003", "2004", "2005"],
        correct: 1,
        difficulty: "hard",
        topic: "Gaming",
        source: "dynamic"
      }
    ];
  }

  private generateDynamicScienceQuestions(): Question[] {
    return [
      {
        question: "What is the powerhouse of the cell?",
        options: ["Nucleus", "Mitochondria", "Ribosome", "Endoplasmic Reticulum"],
        correct: 1,
        difficulty: "easy",
        topic: "Science",
        source: "dynamic"
      },
      {
        question: "What is the study of earthquakes called?",
        options: ["Geology", "Seismology", "Meteorology", "Oceanography"],
        correct: 1,
        difficulty: "medium",
        topic: "Science",
        source: "dynamic"
      },
      {
        question: "What is the Higgs boson also known as?",
        options: ["God particle", "Dark matter", "Antimatter", "Quantum particle"],
        correct: 0,
        difficulty: "hard",
        topic: "Science",
        source: "dynamic"
      },
      {
        question: "What is the chemical symbol for gold?",
        options: ["Go", "Gd", "Au", "Ag"],
        correct: 2,
        difficulty: "medium",
        topic: "Science",
        source: "dynamic"
      },
      {
        question: "How many bones are in an adult human body?",
        options: ["206", "208", "210", "212"],
        correct: 0,
        difficulty: "medium",
        topic: "Science",
        source: "dynamic"
      },
      {
        question: "What is the speed of light in a vacuum?",
        options: ["299,792,458 m/s", "300,000,000 m/s", "299,000,000 m/s", "301,000,000 m/s"],
        correct: 0,
        difficulty: "hard",
        topic: "Science",
        source: "dynamic"
      }
    ];
  }

  private generateDynamicTechnologyQuestions(): Question[] {
    return [
      {
        question: "What does 'IoT' stand for?",
        options: ["Internet of Things", "Input Output Technology", "Integrated Online Technology", "Interactive Object Technology"],
        correct: 0,
        difficulty: "easy",
        topic: "Technology",
        source: "dynamic"
      },
      {
        question: "Which company developed the React JavaScript library?",
        options: ["Google", "Facebook", "Microsoft", "Twitter"],
        correct: 1,
        difficulty: "medium",
        topic: "Technology",
        source: "dynamic"
      },
      {
        question: "What is the maximum theoretical speed of USB 3.0?",
        options: ["480 Mbps", "5 Gbps", "10 Gbps", "20 Gbps"],
        correct: 1,
        difficulty: "hard",
        topic: "Technology",
        source: "dynamic"
      },
      {
        question: "What does 'AI' stand for?",
        options: ["Artificial Intelligence", "Automated Intelligence", "Advanced Intelligence", "Algorithmic Intelligence"],
        correct: 0,
        difficulty: "easy",
        topic: "Technology",
        source: "dynamic"
      },
      {
        question: "Which programming language is known for its use in machine learning?",
        options: ["JavaScript", "Python", "C++", "Java"],
        correct: 1,
        difficulty: "medium",
        topic: "Technology",
        source: "dynamic"
      },
      {
        question: "What does 'VPN' stand for?",
        options: ["Virtual Private Network", "Very Private Network", "Verified Private Network", "Variable Private Network"],
        correct: 0,
        difficulty: "easy",
        topic: "Technology",
        source: "dynamic"
      }
    ];
  }

  private generateDynamicMoviesQuestions(): Question[] {
    return [
      {
        question: "Which movie features the line 'May the Force be with you'?",
        options: ["Star Trek", "Star Wars", "Guardians of the Galaxy", "Interstellar"],
        correct: 1,
        difficulty: "easy",
        topic: "Movies",
        source: "dynamic"
      },
      {
        question: "Who directed the movie 'Inception'?",
        options: ["Steven Spielberg", "Christopher Nolan", "Martin Scorsese", "Quentin Tarantino"],
        correct: 1,
        difficulty: "medium",
        topic: "Movies",
        source: "dynamic"
      },
      {
        question: "Which movie won the Academy Award for Best Picture in 2019?",
        options: ["Green Book", "Roma", "Black Panther", "A Star Is Born"],
        correct: 0,
        difficulty: "hard",
        topic: "Movies",
        source: "dynamic"
      },
      {
        question: "What is the highest-grossing R-rated movie of all time?",
        options: ["Deadpool", "Joker", "The Matrix", "John Wick"],
        correct: 1,
        difficulty: "hard",
        topic: "Movies",
        source: "dynamic"
      }
    ];
  }

  private generateDynamicRedditQuestions(): Question[] {
    return [
      {
        question: "What does 'ELI5' mean on Reddit?",
        options: ["Explain Like I'm 5", "Everyone Loves Internet 5", "Easy Learning In 5", "Elaborate Like It's 5"],
        correct: 0,
        difficulty: "easy",
        topic: "Reddit Culture",
        source: "dynamic"
      },
      {
        question: "What does 'FTFY' mean on Reddit?",
        options: ["Fixed That For You", "For The First Year", "From The Future You", "Find The Final Year"],
        correct: 0,
        difficulty: "medium",
        topic: "Reddit Culture",
        source: "dynamic"
      },
      {
        question: "What is Reddit Premium?",
        options: ["Ad-free browsing", "Special features", "Monthly coins", "All of the above"],
        correct: 3,
        difficulty: "easy",
        topic: "Reddit Culture",
        source: "dynamic"
      }
    ];
  }

  private generateDynamicWorldNewsQuestions(): Question[] {
    return [
      {
        question: "Which country has the most time zones?",
        options: ["Russia", "United States", "China", "France"],
        correct: 0,
        difficulty: "medium",
        topic: "Geography",
        source: "dynamic"
      },
      {
        question: "What is the most spoken language in the world?",
        options: ["English", "Mandarin Chinese", "Spanish", "Hindi"],
        correct: 1,
        difficulty: "medium",
        topic: "Geography",
        source: "dynamic"
      },
      {
        question: "Which country is both in Europe and Asia?",
        options: ["Russia", "Turkey", "Kazakhstan", "All of the above"],
        correct: 3,
        difficulty: "medium",
        topic: "Geography",
        source: "dynamic"
      }
    ];
  }

  private generateDynamicGeneralQuestions(): Question[] {
    return [
      {
        question: "What does 'TIL' mean on Reddit?",
        options: ["Today I Learned", "This Is Life", "Time Is Limited", "Take It Literally"],
        correct: 0,
        difficulty: "easy",
        topic: "Reddit",
        source: "dynamic"
      },
      {
        question: "What is the Reddit cake day?",
        options: ["Birthday", "Account anniversary", "Cake recipe day", "Special event"],
        correct: 1,
        difficulty: "easy",
        topic: "Reddit",
        source: "dynamic"
      },
      {
        question: "What does 'NSFW' stand for?",
        options: ["Not Safe For Work", "Not Suitable For Watching", "New Safe For Web", "Never Safe For Workers"],
        correct: 0,
        difficulty: "easy",
        topic: "Reddit",
        source: "dynamic"
      }
    ];
  }

  private generateDynamicProgrammingQuestions(): Question[] {
    return [
      {
        question: "What does 'DRY' principle stand for in programming?",
        options: ["Don't Repeat Yourself", "Do Repeat Yourself", "Don't Run Yet", "Data Retrieval Yearly"],
        correct: 0,
        difficulty: "medium",
        topic: "Programming",
        source: "dynamic"
      },
      {
        question: "What is the time complexity of bubble sort?",
        options: ["O(n)", "O(n log n)", "O(n²)", "O(log n)"],
        correct: 2,
        difficulty: "hard",
        topic: "Programming",
        source: "dynamic"
      },
      {
        question: "Which of these is not a programming paradigm?",
        options: ["Object-oriented", "Functional", "Procedural", "Circular"],
        correct: 3,
        difficulty: "medium",
        topic: "Programming",
        source: "dynamic"
      }
    ];
  }

  private generateDynamicHistoryQuestions(): Question[] {
    return [
      {
        question: "In which year did the Berlin Wall fall?",
        options: ["1987", "1989", "1991", "1993"],
        correct: 1,
        difficulty: "medium",
        topic: "History",
        source: "dynamic"
      },
      {
        question: "Who was the first President of the United States?",
        options: ["Thomas Jefferson", "George Washington", "John Adams", "Benjamin Franklin"],
        correct: 1,
        difficulty: "easy",
        topic: "History",
        source: "dynamic"
      },
      {
        question: "Which empire was known for building Machu Picchu?",
        options: ["Aztec", "Maya", "Inca", "Olmec"],
        correct: 2,
        difficulty: "medium",
        topic: "History",
        source: "dynamic"
      }
    ];
  }

  private generateDynamicSportsQuestions(): Question[] {
    return [
      {
        question: "How many points is a touchdown worth in American football?",
        options: ["3", "6", "7", "8"],
        correct: 1,
        difficulty: "easy",
        topic: "Sports",
        source: "dynamic"
      },
      {
        question: "Which country has won the most FIFA World Cups?",
        options: ["Germany", "Argentina", "Brazil", "Italy"],
        correct: 2,
        difficulty: "medium",
        topic: "Sports",
        source: "dynamic"
      },
      {
        question: "How many players are on a volleyball team on the court?",
        options: ["5", "6", "7", "8"],
        correct: 1,
        difficulty: "easy",
        topic: "Sports",
        source: "dynamic"
      }
    ];
  }  /**
   *
 Shuffle the answer options for each question to prevent memorizing answer positions
   */
  private shuffleQuestionOptions(questions: Question[]): Question[] {
    return questions.map(question => {
      const originalOptions = [...question.options];
      const correctAnswer = originalOptions[question.correct];
      
      // Shuffle the options
      const shuffledOptions = this.shuffleArray([...originalOptions]);
      
      // Find the new position of the correct answer
      const newCorrectIndex = shuffledOptions.indexOf(correctAnswer);
      
      return {
        ...question,
        options: shuffledOptions,
        correct: newCorrectIndex,
        originalOrder: false // Flag to indicate options were shuffled
      };
    });
  }

  /**
   * Get statistics about the question database for monitoring
   */
  public getQuestionStats(): { [realm: string]: { total: number, easy: number, medium: number, hard: number } } {
    const stats: { [realm: string]: { total: number, easy: number, medium: number, hard: number } } = {};
    
    this.questionBank.forEach((questions, realm) => {
      stats[realm] = {
        total: questions.length,
        easy: questions.filter(q => q.difficulty === 'easy').length,
        medium: questions.filter(q => q.difficulty === 'medium').length,
        hard: questions.filter(q => q.difficulty === 'hard').length
      };
    });
    
    return stats;
  }

  /**
   * Clear recently used questions for a specific realm (admin function)
   */
  public clearRecentlyUsedQuestions(realm?: string): void {
    if (realm) {
      this.recentlyUsedQuestions.delete(realm);
      console.log(`🧹 Cleared recently used questions for realm: ${realm}`);
    } else {
      this.recentlyUsedQuestions.clear();
      console.log(`🧹 Cleared all recently used questions`);
    }
  }
}