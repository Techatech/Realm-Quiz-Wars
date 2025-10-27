import { redis } from '@devvit/web/server';

export class ContentSafetyService {
    private blockedSubreddits: Set<string> = new Set();
    private allowedSubreddits: Set<string> = new Set();

    constructor() {
        this.initializeDefaultLists();
        this.loadBlocklists();
    }

    /**
     * Load blocked and allowed subreddits from Redis
     */
    private async loadBlocklists(): Promise<void> {
        try {
            const blocked = await redis.get('blocked_subreddits');
            const allowed = await redis.get('allowed_subreddits');
            
            if (blocked) {
                this.blockedSubreddits = new Set(JSON.parse(blocked));
            }
            
            if (allowed) {
                this.allowedSubreddits = new Set(JSON.parse(allowed));
            }
        } catch (error) {
            console.error('Failed to load blocklists:', error);
        }
    }

    /**
     * Initialize default safe and unsafe subreddit lists
     */
    private initializeDefaultLists(): void {
        // Default safe subreddits for educational content
        const defaultSafe = [
            'science', 'askscience', 'explainlikeimfive', 'todayilearned',
            'history', 'books', 'technology', 'programming', 'learnprogramming',
            'math', 'physics', 'chemistry', 'biology', 'space', 'astronomy',
            'education', 'studytips', 'getmotivated', 'lifeprotips'
        ];

        // Default blocked patterns (offensive content)
        const defaultBlocked = [
            'nsfw', 'gonewild', 'porn', 'sex', 'adult', 'xxx'
        ];

        defaultSafe.forEach(sub => this.allowedSubreddits.add(sub));
        defaultBlocked.forEach(sub => this.blockedSubreddits.add(sub));
    }

    /**
     * Comprehensive subreddit safety check
     */
    async isSubredditSafe(subredditName: string, subredditData?: any): Promise<boolean> {
        const normalizedName = subredditName.toLowerCase().replace(/^r\//, '');
        
        // Check explicit blocklist first
        if (this.blockedSubreddits.has(normalizedName)) {
            return false;
        }
        
        // Check if explicitly allowed
        if (this.allowedSubreddits.has(normalizedName)) {
            return true;
        }
        
        // Multi-layer safety checks
        const checks = [
            this.checkOffensivePatterns(normalizedName),
            this.checkAdultContent(subredditData),
            this.checkHateSpeechPatterns(normalizedName),
            this.checkViolencePatterns(normalizedName),
            this.checkEducationalValue(normalizedName),
            this.checkCommunitySize(subredditData),
            this.checkSubredditMetadata(subredditData)
        ];

        // Subreddit is safe if it passes all checks
        const passedChecks = checks.filter(check => check).length;
        const safetyThreshold = 0.7; // 70% of checks must pass
        
        const isSafe = (passedChecks / checks.length) >= safetyThreshold;
        
        if (isSafe) {
            console.log(`✅ Subreddit ${normalizedName} passed safety checks (${passedChecks}/${checks.length})`);
        } else {
            console.log(`❌ Subreddit ${normalizedName} failed safety checks (${passedChecks}/${checks.length})`);
        }
        
        return isSafe;
    }

    /**
     * Check for offensive patterns in subreddit name
     */
    private checkOffensivePatterns(subredditName: string): boolean {
        const offensivePatterns = [
            /nsfw/i, /porn/i, /sex/i, /adult/i, /xxx/i, /nude/i, /naked/i,
            /gore/i, /death/i, /kill/i, /murder/i, /violence/i,
            /hate/i, /nazi/i, /racist/i, /supremacist/i,
            /drug/i, /cocaine/i, /heroin/i, /meth/i,
            /gambling/i, /casino/i, /betting/i,
            /illegal/i, /piracy/i, /torrent/i, /crack/i,
            /suicide/i, /selfharm/i, /cutting/i,
            /conspiracy/i, /qanon/i, /antivax/i,
            /incel/i, /redpill/i, /mgtow/i,
            /troll/i, /brigade/i, /doxx/i, /harassment/i
        ];

        const hasOffensiveContent = offensivePatterns.some(pattern => 
            pattern.test(subredditName)
        );

        return !hasOffensiveContent; // Return true if NO offensive content
    }

    /**
     * Check for adult content indicators
     */
    private checkAdultContent(subredditData?: any): boolean {
        if (!subredditData) return true; // Assume safe if no data
        
        // Check if subreddit is marked as NSFW
        if (subredditData.over18 === true) {
            return false;
        }
        
        return true;
    }

    /**
     * Check for hate speech patterns
     */
    private checkHateSpeechPatterns(subredditName: string): boolean {
        const hateSpeechPatterns = [
            /hate/i, /nazi/i, /fascist/i, /supremacist/i, /kkk/i,
            /racist/i, /bigot/i, /xenophob/i, /homophob/i, /transphob/i,
            /antisemit/i, /islamophob/i, /misogyn/i, /incel/i,
            /genocide/i, /holocaust/i, /ethnic.*cleans/i,
            /white.*power/i, /black.*power/i, /race.*war/i,
            /jew.*hate/i, /muslim.*hate/i, /gay.*hate/i,
            /lynch/i, /hang.*them/i, /kill.*all/i,
            /pure.*blood/i, /master.*race/i, /inferior.*race/i,
            /deportation/i, /concentration.*camp/i,
            /final.*solution/i, /racial.*purity/i
        ];

        const hasHateSpeech = hateSpeechPatterns.some(pattern => 
            pattern.test(subredditName)
        );

        return !hasHateSpeech; // Return true if NO hate speech
    }

    /**
     * Check for violence-related patterns
     */
    private checkViolencePatterns(subredditName: string): boolean {
        const violencePatterns = [
            /kill/i, /murder/i, /death/i, /gore/i, /blood/i,
            /torture/i, /abuse/i, /violence/i, /fight/i, /beat/i,
            /stab/i, /shoot/i, /gun/i, /weapon/i, /bomb/i,
            /terror/i, /attack/i, /assault/i, /rape/i, /molest/i,
            /harm/i, /hurt/i, /pain/i, /suffer/i, /agony/i,
            /war/i, /battle/i, /combat/i, /conflict/i, /revenge/i
        ];

        const hasViolence = violencePatterns.some(pattern => 
            pattern.test(subredditName)
        );

        return !hasViolence; // Return true if NO violence
    }

    /**
     * Check if subreddit has educational value
     */
    private checkEducationalValue(subredditName: string): boolean {
        const educationalPatterns = [
            /learn/i, /study/i, /education/i, /school/i, /university/i,
            /science/i, /math/i, /physics/i, /chemistry/i, /biology/i,
            /history/i, /geography/i, /literature/i, /philosophy/i,
            /technology/i, /programming/i, /coding/i, /computer/i,
            /language/i, /culture/i, /art/i, /music/i, /book/i,
            /knowledge/i, /fact/i, /explain/i, /howto/i, /tutorial/i,
            /skill/i, /craft/i, /diy/i, /maker/i, /create/i,
            /research/i, /academic/i, /scholar/i, /intellectual/i,
            /documentary/i, /informative/i, /educational/i
        ];

        const hasEducationalValue = educationalPatterns.some(pattern => 
            pattern.test(subredditName)
        );

        return hasEducationalValue;
    }

    /**
     * Check community size (larger communities tend to be safer)
     */
    private checkCommunitySize(subredditData?: any): boolean {
        if (!subredditData || !subredditData.subscribers) {
            return true; // Assume safe if no data
        }
        
        // Communities with at least 1000 subscribers are generally safer
        return subredditData.subscribers >= 1000;
    }

    /**
     * Check subreddit metadata for safety indicators
     */
    private checkSubredditMetadata(subredditData?: any): boolean {
        if (!subredditData) return true; // Assume safe if no data
        
        // Check if subreddit is quarantined
        if (subredditData.quarantine === true) {
            return false;
        }
        
        // Check if subreddit allows user reports
        if (subredditData.user_can_flair_in_sr === false) {
            return false; // Heavily moderated subreddits might be problematic
        }
        
        return true;
    }

    /**
     * Filter content for offensive material
     */
    async filterContent(content: string): Promise<boolean> {
        const normalizedContent = content.toLowerCase();
        
        const offensiveContent = [
            /fuck/gi, /shit/gi, /damn/gi, /hell/gi, /ass/gi,
            /bitch/gi, /bastard/gi, /crap/gi, /piss/gi,
            /nazi/gi, /hitler/gi, /genocide/gi, /holocaust/gi,
            /kill.*yourself/gi, /suicide/gi, /self.*harm/gi,
            /rape/gi, /molest/gi, /abuse/gi, /violence/gi,
            /drug/gi, /cocaine/gi, /heroin/gi, /meth/gi,
            /porn/gi, /sex/gi, /nude/gi, /naked/gi,
            /hate/gi, /racist/gi, /bigot/gi, /supremacist/gi,
            /terrorist/gi, /bomb/gi, /weapon/gi, /gun/gi
        ];
        
        return !offensiveContent.some(pattern => pattern.test(normalizedContent));
    }

    /**
     * Save blocked subreddits to Redis
     */
    private async saveBlockedSubreddits(): Promise<void> {
        try {
            const blocked = Array.from(this.blockedSubreddits);
            await redis.set('blocked_subreddits', JSON.stringify(blocked));
        } catch (error) {
            console.error('Failed to save blocked subreddits:', error);
        }
    }

    /**
     * Save allowed subreddits to Redis
     */
    private async saveAllowedSubreddits(): Promise<void> {
        try {
            const allowed = Array.from(this.allowedSubreddits);
            await redis.set('allowed_subreddits', JSON.stringify(allowed));
        } catch (error) {
            console.error('Failed to save allowed subreddits:', error);
        }
    }

    /**
     * Block a subreddit
     */
    async blockSubreddit(subredditName: string): Promise<void> {
        const normalized = subredditName.toLowerCase().replace(/^r\//, '');
        this.blockedSubreddits.add(normalized);
        this.allowedSubreddits.delete(normalized);
        
        await Promise.all([
            this.saveBlockedSubreddits(),
            this.saveAllowedSubreddits()
        ]);
        
        console.log(`🚫 Blocked subreddit: ${normalized}`);
    }

    /**
     * Allow a subreddit
     */
    async allowSubreddit(subredditName: string): Promise<void> {
        const normalized = subredditName.toLowerCase().replace(/^r\//, '');
        this.allowedSubreddits.add(normalized);
        this.blockedSubreddits.delete(normalized);
        
        await Promise.all([
            this.saveAllowedSubreddits(),
            this.saveBlockedSubreddits()
        ]);
        
        console.log(`✅ Allowed subreddit: ${normalized}`);
    }

    /**
     * Get safety statistics
     */
    async getSafetyStats(): Promise<{
        blockedCount: number;
        allowedCount: number;
        totalChecked: number;
    }> {
        return {
            blockedCount: this.blockedSubreddits.size,
            allowedCount: this.allowedSubreddits.size,
            totalChecked: this.blockedSubreddits.size + this.allowedSubreddits.size
        };
    }
}