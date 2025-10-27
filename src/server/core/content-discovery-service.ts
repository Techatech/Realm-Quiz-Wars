import { redis } from '@devvit/web/server';
import { AIKnowledgeGenerator, QuizQuestion } from './ai-knowledge-generator';
import { ContentSafetyService } from './content-safety-service';

export class ContentDiscoveryService {
    private readonly scanInterval = 6 * 60 * 60 * 1000; // 6 hours
    private readonly batchSize = 100;
    private aiGenerator: AIKnowledgeGenerator;
    private safetyService: ContentSafetyService;
    private activeScanners = new Set<string>();

    constructor() {
        this.aiGenerator = new AIKnowledgeGenerator();
        this.safetyService = new ContentSafetyService();
    }

    /**
     * Start periodic content discovery for all active realms
     */
    async startContentDiscovery(): Promise<void> {
        console.log('🔍 Starting content discovery service...');
        
        // Get list of active realms from Redis
        const activeRealms = await this.getActiveRealms();
        
        // Start scanning each realm
        for (const realm of activeRealms) {
            this.scheduleRealmScan(realm);
        }
        
        // Schedule discovery of new trending subreddits
        this.scheduleTrendingDiscovery();
    }

    /**
     * Schedule periodic scanning for a specific realm
     */
    private scheduleRealmScan(realmName: string): void {
        if (this.activeScanners.has(realmName)) {
            return; // Already scanning this realm
        }

        this.activeScanners.add(realmName);
        
        const scanRealm = async () => {
            try {
                console.log(`🔍 Scanning ${realmName} for new content...`);
                await this.scanRealmContent(realmName);
                
                // Schedule next scan
                setTimeout(scanRealm, this.scanInterval);
            } catch (error) {
                console.error(`Failed to scan ${realmName}:`, error);
                // Retry with exponential backoff
                setTimeout(scanRealm, this.scanInterval * 2);
            }
        };

        // Start initial scan after a random delay to distribute load
        const initialDelay = Math.random() * 30000; // 0-30 seconds
        setTimeout(scanRealm, initialDelay);
    }

    /**
     * Scan a specific realm for new content and generate questions
     */
    private async scanRealmContent(realmName: string): Promise<void> {
        try {
            // Get recent hot posts from the subreddit
            // Note: Using mock data since reddit API access needs proper context
            const posts = { children: [] }; // Mock for now

            if (posts.children.length === 0) {
                console.log(`No new content found in ${realmName}`);
                return;
            }

            // Extract trending topics from posts
            const trendingTopics = await this.extractTrendingTopics(posts.children);
            
            // Filter topics for safety
            const safeTopics = [];
            for (const topic of trendingTopics) {
                const isSafe = await this.safetyService.filterContent(topic);
                if (isSafe) {
                    safeTopics.push(topic);
                } else {
                    console.log(`🚫 Filtered unsafe topic: ${topic}`);
                }
            }
            
            // Check if we have new topics not in our knowledge base
            const existingTopics = await this.getExistingTopics(realmName);
            const newTopics = safeTopics.filter(topic => !existingTopics.includes(topic));

            if (newTopics.length > 0) {
                console.log(`📚 Found ${newTopics.length} new topics in ${realmName}:`, newTopics);
                
                // Generate questions for new topics
                const newQuestions = await this.generateQuestionsForTopics(realmName, newTopics);
                
                // Store new questions in knowledge base
                await this.updateKnowledgeBase(realmName, newQuestions, newTopics);
                
                // Update realm activity metrics
                await this.updateRealmMetrics(realmName, posts.children.length, newTopics.length);
            }

            // Analyze post engagement to identify high-interest topics
            await this.analyzeEngagementPatterns(realmName, posts.children);

        } catch (error) {
            console.error(`Content scanning failed for ${realmName}:`, error);
            throw error;
        }
    }

    /**
     * Extract trending topics from Reddit posts using compliant analysis
     * COMPLIANCE: Not using Reddit data for LLM training, only for topic identification
     */
    private async extractTrendingTopics(posts: any[]): Promise<string[]> {
        // COMPLIANCE: Use keyword-based analysis instead of feeding Reddit data to LLMs
        // This avoids violating the "no Reddit data for LLM training" rule
        
        try {
            // Extract topics using keyword analysis (compliant approach)
            const topics = this.extractTopicsFromTitles(posts.map(p => p.title));
            
            // Only use LLM for general topic categorization, not Reddit content analysis
            if (topics.length > 0) {
                const prompt = `
                    Given these general topic keywords: ${topics.slice(0, 5).join(', ')}
                    
                    Generate 5 broader educational categories that would be suitable for quiz questions.
                    Do not reference the original keywords directly.
                    
                    Return only a JSON array of educational topic strings.
                    Example: ["Science & Technology", "History & Culture", "Arts & Entertainment"]
                `;

                const response = await this.aiGenerator.callAIModel(prompt, 'topic-categorization');
                const aiTopics = JSON.parse(response);
                
                // Combine keyword-based and AI-categorized topics
                return [...topics.slice(0, 5), ...aiTopics.slice(0, 5)];
            }
            
            return topics;
        } catch (error) {
            console.error('Topic extraction failed:', error);
            // Fallback: extract topics from post titles using keywords only
            return this.extractTopicsFromTitles(posts.map(p => p.title));
        }
    }

    /**
     * Fallback topic extraction from post titles
     */
    private extractTopicsFromTitles(titles: string[]): string[] {
        const keywords = new Map<string, number>();
        
        titles.forEach(title => {
            const words = title.toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 3);
            
            words.forEach(word => {
                keywords.set(word, (keywords.get(word) || 0) + 1);
            });
        });

        return Array.from(keywords.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
    }

    /**
     * Generate quiz questions for new topics
     */
    private async generateQuestionsForTopics(realmName: string, topics: string[]): Promise<QuizQuestion[]> {
        const allQuestions: QuizQuestion[] = [];

        for (const topic of topics) {
            try {
                const prompt = `
                    Create 3 high-quality multiple choice questions about "${topic}" 
                    that would be relevant to the r/${realmName} community.
                    
                    Requirements:
                    - Mix of easy, medium, and hard difficulty
                    - Questions should be factual and verifiable
                    - Avoid controversial or subjective topics
                    - Make them engaging for Reddit users
                    
                    Return as JSON array with QuizQuestion structure:
                    [
                        {
                            "question": "Question text",
                            "options": ["A", "B", "C", "D"],
                            "correct": 0,
                            "difficulty": "medium",
                            "topic": "${topic}",
                            "source": "Discovered from r/${realmName} content",
                            "sourceType": "content-discovery",
                            "sourceTitle": "Content Analysis: ${topic}",
                            "createdAt": "${new Date().toISOString()}"
                        }
                    ]
                `;

                const response = await this.aiGenerator.callAIModel(prompt, 'question-generation');
                const questions = JSON.parse(response);
                allQuestions.push(...questions);

                // Rate limit AI calls
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Failed to generate questions for topic ${topic}:`, error);
            }
        }

        return allQuestions;
    }

    /**
     * Update knowledge base with new questions
     */
    private async updateKnowledgeBase(realmName: string, questions: QuizQuestion[], topics: string[]): Promise<void> {
        // Store questions in Redis with expiration
        const questionKey = `realm_questions_${realmName}_discovered`;
        const existingQuestions = await redis.get(questionKey);
        
        let allQuestions = questions;
        if (existingQuestions) {
            const existing = JSON.parse(existingQuestions);
            allQuestions = [...existing, ...questions];
            
            // Keep only the most recent 200 questions to manage storage
            allQuestions = allQuestions
                .sort(() => Math.random() - 0.5)
                .slice(0, 200);
        }

        await redis.set(questionKey, JSON.stringify(allQuestions));
        
        // Update topics list
        const topicsKey = `realm_topics_${realmName}`;
        const existingTopics = await this.getExistingTopics(realmName);
        const updatedTopics = [...new Set([...existingTopics, ...topics])];
        await redis.set(topicsKey, JSON.stringify(updatedTopics));

        console.log(`📚 Updated knowledge base for ${realmName}: +${questions.length} questions, +${topics.length} topics`);
    }

    /**
     * Get existing topics for a realm
     */
    private async getExistingTopics(realmName: string): Promise<string[]> {
        const topicsKey = `realm_topics_${realmName}`;
        const topics = await redis.get(topicsKey);
        return topics ? JSON.parse(topics) : [];
    }

    /**
     * Update realm activity metrics
     */
    private async updateRealmMetrics(realmName: string, postsScanned: number, newTopics: number): Promise<void> {
        const metricsKey = `realm_metrics_${realmName}`;
        const metrics = {
            lastScan: new Date().toISOString(),
            postsScanned,
            newTopicsFound: newTopics,
            totalScans: 1
        };

        const existing = await redis.get(metricsKey);
        if (existing) {
            const existingMetrics = JSON.parse(existing);
            metrics.totalScans = existingMetrics.totalScans + 1;
        }

        await redis.set(metricsKey, JSON.stringify(metrics));
    }

    /**
     * Analyze engagement patterns to identify high-interest topics
     */
    private async analyzeEngagementPatterns(realmName: string, posts: any[]): Promise<void> {
        const highEngagementPosts = posts
            .filter(post => post.score > 100 || post.numComments > 50)
            .sort((a, b) => (b.score + b.numComments) - (a.score + a.numComments))
            .slice(0, 10);

        if (highEngagementPosts.length > 0) {
            const engagementKey = `realm_engagement_${realmName}`;
            const engagementData = {
                timestamp: new Date().toISOString(),
                hotTopics: highEngagementPosts.map(post => ({
                    title: post.title,
                    score: post.score,
                    comments: post.numComments,
                    engagement: post.score + post.numComments
                }))
            };

            await redis.set(engagementKey, JSON.stringify(engagementData));
        }
    }

    /**
     * Discover trending subreddits for new realm opportunities
     */
    private scheduleTrendingDiscovery(): void {
        const discoverTrending = async () => {
            try {
                console.log('🔥 Discovering trending subreddits...');
                
                // Use default safe realms since getSubreddits API is not available
                const defaultSafeRealms = [
                    'science', 'technology', 'history', 'books', 'todayilearned',
                    'explainlikeimfive', 'askscience', 'programming', 'math'
                ];

                // Add new realms to our active list
                for (const realmName of defaultSafeRealms) {
                    const activeRealms = await this.getActiveRealms();
                    
                    if (!activeRealms.includes(realmName)) {
                        await this.addActiveRealm(realmName);
                        this.scheduleRealmScan(realmName);
                        console.log(`🆕 Added new realm: ${realmName}`);
                    }
                }

                // Schedule next trending discovery (daily)
                setTimeout(discoverTrending, 24 * 60 * 60 * 1000);
            } catch (error) {
                console.error('Trending discovery failed:', error);
                setTimeout(discoverTrending, 6 * 60 * 60 * 1000); // Retry in 6 hours
            }
        };

        // Start after 1 hour
        setTimeout(discoverTrending, 60 * 60 * 1000);
    }

    /**
     * Get content safety statistics for monitoring
     */
    async getContentSafetyStats(): Promise<any> {
        return await this.safetyService.getSafetyStats();
    }

    /**
     * Manually block a subreddit
     */
    async blockSubreddit(subredditName: string): Promise<void> {
        await this.safetyService.blockSubreddit(subredditName);
        
        // Remove from active realms if present
        const activeRealms = await this.getActiveRealms();
        const updatedRealms = activeRealms.filter(realm => 
            realm.toLowerCase() !== subredditName.toLowerCase().replace(/^r\//, '')
        );
        
        if (updatedRealms.length !== activeRealms.length) {
            await redis.set('active_realms', JSON.stringify(updatedRealms));
            console.log(`🚫 Removed ${subredditName} from active realms`);
        }
    }

    /**
     * Manually allow a subreddit
     */
    async allowSubreddit(subredditName: string): Promise<void> {
        await this.safetyService.allowSubreddit(subredditName);
    }

    /**
     * Get list of active realms
     */
    private async getActiveRealms(): Promise<string[]> {
        const realms = await redis.get('active_realms');
        return realms ? JSON.parse(realms) : ['gaming', 'science', 'technology', 'movies', 'books'];
    }

    /**
     * Add a new active realm
     */
    private async addActiveRealm(realmName: string): Promise<void> {
        const activeRealms = await this.getActiveRealms();
        if (!activeRealms.includes(realmName)) {
            activeRealms.push(realmName);
            await redis.set('active_realms', JSON.stringify(activeRealms));
        }
    }

    /**
     * Get discovered questions for a realm
     */
    async getDiscoveredQuestions(realmName: string, limit: number = 10): Promise<QuizQuestion[]> {
        const questionKey = `realm_questions_${realmName}_discovered`;
        const questions = await redis.get(questionKey);
        
        if (!questions) return [];
        
        const allQuestions = JSON.parse(questions);
        return allQuestions
            .sort(() => Math.random() - 0.5) // Shuffle
            .slice(0, limit);
    }

    /**
     * Get realm metrics for admin dashboard
     */
    async getRealmMetrics(realmName: string): Promise<any> {
        const metricsKey = `realm_metrics_${realmName}`;
        const engagementKey = `realm_engagement_${realmName}`;
        
        const [metrics, engagement] = await Promise.all([
            redis.get(metricsKey),
            redis.get(engagementKey)
        ]);

        return {
            metrics: metrics ? JSON.parse(metrics) : null,
            engagement: engagement ? JSON.parse(engagement) : null
        };
    }
}