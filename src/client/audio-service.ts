export class AudioService {
    private sounds: { [key: string]: HTMLAudioElement } = {};
    private backgroundMusic: HTMLAudioElement | null = null;
    private isMuted: boolean = false;
    private volume: number = 0.7;
    private musicVolume: number = 0.3; // Background music at 30% of main volume
    private isInitialized: boolean = false;
    private isMusicPlaying: boolean = false;
    private isMusicMuted: boolean = false;
    private wasMusicPlayingBeforeMute: boolean = false;
    
    constructor() {
        // Load preferences from localStorage
        const savedMuteState = localStorage.getItem('quiz_wars_muted');
        this.isMuted = savedMuteState === 'true';
        
        const savedMusicMuteState = localStorage.getItem('quiz_wars_music_muted');
        this.isMusicMuted = savedMusicMuteState === 'true';
        
        const savedVolume = localStorage.getItem('quiz_wars_volume');
        this.volume = savedVolume ? parseFloat(savedVolume) : 0.7;
        
        const savedMusicVolume = localStorage.getItem('quiz_wars_music_volume');
        this.musicVolume = savedMusicVolume ? parseFloat(savedMusicVolume) : 0.3;
        
        this.initializeAudio();
    }

    async initializeAudio() {
        try {
            // Define sound effects with their file paths (Client bundled assets)
            const soundFiles = {
                // Answer feedback sounds
                correct: '/sounds/correct-answer.mp3',
                incorrect: '/sounds/incorrect-answer.mp3',
                timeout: '/sounds/time-up.mp3',
                
                // Battle outcome sounds
                victory: '/sounds/victory.mp3',
                defeat: '/sounds/defeat.mp3',
                tie: '/sounds/tie.mp3',
                
                // Game mode selection
                modeSelect: '/sounds/mode-select.mp3',
                battleStart: '/sounds/battle-start.mp3',
                
                // UI interactions
                buttonClick: '/sounds/button-click.mp3',
                notification: '/sounds/notification.mp3',
                levelUp: '/sounds/level-up.mp3',
                
                // Turn-based gameplay
                playerTurn: '/sounds/player-turn.mp3',
                apprenticeTurn: '/sounds/apprentice-turn.mp3',
                apprenticeThinking: '/sounds/apprentice-thinking.mp3',
                
                // Special events
                challenge: '/sounds/challenge.mp3',
                matchFound: '/sounds/match-found.mp3',
                countdown: '/sounds/countdown.mp3'
            };

            // Initialize background music (separate from sound effects)
            try {
                this.backgroundMusic = new Audio('/sounds/background-music.mp3');
                this.backgroundMusic.loop = true;
                this.backgroundMusic.volume = this.calculateMusicVolume();
                this.backgroundMusic.preload = 'auto';
                
                // Handle music loading errors gracefully
                this.backgroundMusic.addEventListener('error', () => {
                    console.warn('Failed to load background music');
                    this.backgroundMusic = null;
                });
                
                // Handle music events
                this.backgroundMusic.addEventListener('canplaythrough', () => {
                    console.log('🎵 Background music loaded and ready');
                });
                
                this.backgroundMusic.addEventListener('ended', () => {
                    // This shouldn't happen with loop=true, but just in case
                    if (this.isMusicPlaying && !this.isMuted) {
                        this.backgroundMusic?.play().catch(console.warn);
                    }
                });
                
            } catch (error) {
                console.warn('Error initializing background music:', error);
                this.backgroundMusic = null;
            }

            // Load all sound files
            for (const [key, path] of Object.entries(soundFiles)) {
                try {
                    console.log(`🔊 Loading sound: ${key} from ${path}`);
                    const audio = new Audio(path);
                    audio.volume = this.volume;
                    audio.preload = 'metadata'; // Changed from 'auto' to reduce cache issues
                    
                    // Add cache-busting and error handling
                    audio.crossOrigin = 'anonymous';
                    
                    // Handle loading errors gracefully
                    audio.addEventListener('error', (e) => {
                        console.log(`❌ Failed to load sound: ${key} from ${path}`, e);
                        // Create a silent fallback
                        const silentAudio = new Audio();
                        silentAudio.volume = 0;
                        this.sounds[key] = silentAudio;
                    });
                    
                    // Handle successful loading
                    audio.addEventListener('canplaythrough', () => {
                        console.log(`✅ Sound loaded successfully: ${key}`);
                    });
                    
                    // Test if the audio file is accessible
                    this.testAudioFile(path).then(accessible => {
                        if (!accessible) {
                            console.warn(`⚠️ Audio file may not be accessible: ${path}`);
                        }
                    });
                    
                    // Handle loading events
                    audio.addEventListener('canplaythrough', () => {
                        console.log(`✅ Sound loaded successfully: ${key}`);
                    });
                    
                    audio.addEventListener('error', (e) => {
                        console.warn(`❌ Failed to load sound: ${key} from ${path}`, e);
                    });
                    
                    this.sounds[key] = audio;
                } catch (error) {
                    console.warn(`Error creating audio for ${key}:`, error);
                }
            }
            
            this.isInitialized = true;
            console.log('🔊 Audio service initialized with', Object.keys(this.sounds).length, 'sounds');
            
        } catch (error) {
            console.error('Failed to initialize audio service:', error);
        }
    }

    // Play a specific sound effect
    play(soundName: string, options: { volume?: number } = {}) {
        console.log(`🎵 Attempting to play sound: ${soundName}, initialized: ${this.isInitialized}, muted: ${this.isMuted}`);
        if (!this.isInitialized || this.isMuted) return;
        
        const sound = this.sounds[soundName];
        if (!sound) {
            console.warn(`Sound not found: ${soundName}`);
            return;
        }

        try {
            // Reset sound to beginning
            sound.currentTime = 0;
            
            // Apply volume (can be overridden per sound)
            sound.volume = options.volume !== undefined ? options.volume : this.volume;
            
            // Play the sound
            const playPromise = sound.play();
            
            // Handle play promise (required for some browsers)
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn(`Failed to play sound ${soundName}:`, error);
                });
            }
            
        } catch (error) {
            console.warn(`Error playing sound ${soundName}:`, error);
        }
    }

    // Play sound with delay
    playDelayed(soundName: string, delay: number, options: { volume?: number } = {}) {
        setTimeout(() => {
            this.play(soundName, options);
        }, delay);
    }

    // Play multiple sounds in sequence
    playSequence(soundNames: string[], interval: number = 500) {
        soundNames.forEach((soundName, index) => {
            this.playDelayed(soundName, index * interval);
        });
    }

    // Toggle mute state
    toggleMute(): boolean {
        this.isMuted = !this.isMuted;
        localStorage.setItem('quiz_wars_muted', this.isMuted.toString());
        
        // Handle background music muting (only if music isn't separately muted)
        if (this.backgroundMusic && !this.isMusicMuted) {
            if (this.isMuted) {
                this.wasMusicPlayingBeforeMute = this.isMusicPlaying;
                if (this.isMusicPlaying) {
                    this.pauseBackgroundMusic();
                }
            } else if (this.wasMusicPlayingBeforeMute) {
                this.resumeBackgroundMusic();
            }
        }
        
        // Update UI mute button if it exists
        this.updateMuteButton();
        
        // Play a test sound when unmuting
        if (!this.isMuted) {
            this.play('buttonClick', { volume: 0.3 });
        }
        
        return this.isMuted;
    }

    // Set volume (0.0 to 1.0)
    setVolume(volume: number) {
        this.volume = Math.max(0, Math.min(1, volume));
        localStorage.setItem('quiz_wars_volume', this.volume.toString());
        
        // Update volume for all loaded sounds
        Object.values(this.sounds).forEach(sound => {
            if (sound instanceof Audio) {
                sound.volume = this.volume;
            }
        });
        
        // Update background music volume
        if (this.backgroundMusic) {
            this.backgroundMusic.volume = this.calculateMusicVolume();
        }
        
        // Play test sound at new volume
        if (!this.isMuted) {
            this.play('buttonClick', { volume: this.volume });
        }
    }

    // Calculate background music volume (percentage of main volume)
    private calculateMusicVolume(): number {
        return this.volume * this.musicVolume;
    }

    // Test if audio file is accessible
    private async testAudioFile(path: string): Promise<boolean> {
        try {
            const response = await fetch(path, { method: 'HEAD' });
            const accessible = response.ok;
            if (accessible) {
                console.log(`🧪 Audio file test for ${path}: ${response.status} OK`);
            } else {
                console.warn(`🧪 Audio file test for ${path}: ${response.status} ${response.statusText}`);
            }
            return accessible;
        } catch (error) {
            console.warn(`🧪 Audio file test failed for ${path}:`, error);
            return false;
        }
    }

    // Set background music volume relative to main volume (removed duplicate)

    // Get current mute state
    isSoundMuted(): boolean {
        return this.isMuted;
    }

    // Get muted state (method version for compatibility)
    getMutedState(): boolean {
        return this.isMuted;
    }

    // Check if music is currently playing (removed duplicate)

    // Get current volume
    getVolume(): number {
        return this.volume;
    }

    // Get music volume
    getMusicVolume(): number {
        return this.musicVolume;
    }

    // Set music volume (override the existing one to avoid duplicates)
    setMusicVolume(volume: number) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        localStorage.setItem('quiz_wars_music_volume', this.musicVolume.toString());
        
        // Update background music volume if playing
        if (this.backgroundMusic) {
            this.backgroundMusic.volume = this.calculateMusicVolume();
        }
        
        console.log('🎵 Music volume set to:', this.musicVolume);
    }

    // Check if music is muted
    getMusicMutedState(): boolean {
        return this.isMusicMuted;
    }

    // Toggle music mute (separate from general mute)
    toggleMusicMute(): boolean {
        this.isMusicMuted = !this.isMusicMuted;
        localStorage.setItem('quiz_wars_music_muted', this.isMusicMuted.toString());
        
        // Handle background music muting
        if (this.backgroundMusic) {
            if (this.isMusicMuted) {
                this.wasMusicPlayingBeforeMute = this.isMusicPlaying;
                if (this.isMusicPlaying) {
                    this.pauseBackgroundMusic();
                }
            } else if (this.wasMusicPlayingBeforeMute && !this.isMuted) {
                this.resumeBackgroundMusic();
            }
        }
        
        console.log('🎵 Music mute toggled:', this.isMusicMuted);
        return this.isMusicMuted;
    }

    // Update mute button appearance
    private updateMuteButton() {
        const muteButton = document.getElementById('mute-button');
        if (muteButton) {
            muteButton.innerHTML = this.isMuted ? '🔇' : '🔊';
            muteButton.title = this.isMuted ? 'Unmute sounds' : 'Mute sounds';
            muteButton.classList.toggle('muted', this.isMuted);
        }
    }

    // Game-specific sound methods
    playCorrectAnswer() {
        this.play('correct', { volume: this.volume * 0.8 });
    }

    playIncorrectAnswer() {
        this.play('incorrect', { volume: this.volume * 0.8 });
    }

    playTimeUp() {
        this.play('timeout', { volume: this.volume * 0.9 });
    }

    playVictory() {
        this.play('victory', { volume: this.volume * 0.9 });
    }

    playDefeat() {
        this.play('defeat', { volume: this.volume * 0.8 });
    }

    playTie() {
        this.play('tie', { volume: this.volume * 0.8 });
    }

    // Enable audio context (call after user interaction)
    async enableAudio() {
        try {
            // Create a silent audio to unlock the audio context
            const silentAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
            silentAudio.volume = 0;
            await silentAudio.play();
            console.log('🔊 Audio context enabled');
        } catch (error) {
            console.warn('Could not enable audio context:', error);
        }
    }



    playModeSelect() {
        console.log('🔊 Playing mode select sound, initialized:', this.isInitialized, 'muted:', this.isMuted);
        console.log('🔊 Available sounds:', Object.keys(this.sounds));
        
        // Test if the file is accessible
        this.testAudioFile('/sounds/mode-select.mp3');
        
        this.play('modeSelect', { volume: this.volume * 0.6 });
    }

    playBattleStart() {
        this.play('battleStart', { volume: this.volume * 0.8 });
    }

    playLevelUp() {
        this.play('levelUp', { volume: this.volume * 0.9 });
    }

    playPlayerTurn() {
        this.play('playerTurn', { volume: this.volume * 0.7 });
    }

    playApprenticeTurn() {
        this.play('apprenticeTurn', { volume: this.volume * 0.7 });
    }

    playApprenticeThinking() {
        this.play('apprenticeThinking', { volume: this.volume * 0.5 });
    }

    playChallenge() {
        this.play('challenge', { volume: this.volume * 0.8 });
    }

    playMatchFound() {
        this.play('matchFound', { volume: this.volume * 0.8 });
    }

    playNotification() {
        this.play('notification', { volume: this.volume * 0.6 });
    }

    playButtonClick() {
        this.play('buttonClick', { volume: this.volume * 0.4 });
    }

    playCountdown() {
        this.play('countdown', { volume: this.volume * 0.7 });
    }

    // Background Music Control Methods
    startBackgroundMusic() {
        if (!this.backgroundMusic || this.isMuted || this.isMusicMuted) return;
        
        try {
            this.backgroundMusic.currentTime = 0;
            this.backgroundMusic.volume = this.calculateMusicVolume();
            
            const playPromise = this.backgroundMusic.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    this.isMusicPlaying = true;
                    console.log('🎵 Background music started automatically');
                }).catch(error => {
                    console.warn('Autoplay blocked by browser - will start on user interaction:', error);
                    // Set up music to start on user interaction
                    this.setupMusicAutoStart();
                });
            } else {
                this.isMusicPlaying = true;
            }
        } catch (error) {
            console.warn('Error starting background music:', error);
            this.setupMusicAutoStart();
        }
    }

    pauseBackgroundMusic() {
        if (!this.backgroundMusic) return;
        
        try {
            this.backgroundMusic.pause();
            this.isMusicPlaying = false;
            console.log('🎵 Background music paused');
        } catch (error) {
            console.warn('Error pausing background music:', error);
        }
    }

    resumeBackgroundMusic() {
        if (!this.backgroundMusic || this.isMuted || this.isMusicMuted) return;
        
        try {
            this.backgroundMusic.volume = this.calculateMusicVolume();
            const playPromise = this.backgroundMusic.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    this.isMusicPlaying = true;
                    console.log('🎵 Background music resumed');
                }).catch(error => {
                    console.warn('Failed to resume background music:', error);
                });
            } else {
                this.isMusicPlaying = true;
            }
        } catch (error) {
            console.warn('Error resuming background music:', error);
        }
    }

    stopBackgroundMusic() {
        if (!this.backgroundMusic) return;
        
        try {
            this.backgroundMusic.pause();
            this.backgroundMusic.currentTime = 0;
            this.isMusicPlaying = false;
            console.log('🎵 Background music stopped');
        } catch (error) {
            console.warn('Error stopping background music:', error);
        }
    }

    // Setup auto-start for browsers that require user interaction
    private setupMusicAutoStart() {
        const startMusicOnInteraction = () => {
            if (!this.isMusicPlaying && !this.isMuted && !this.isMusicMuted && this.backgroundMusic) {
                this.startBackgroundMusic();
                
                // Remove listeners after first successful start
                document.removeEventListener('click', startMusicOnInteraction);
                document.removeEventListener('keydown', startMusicOnInteraction);
                document.removeEventListener('touchstart', startMusicOnInteraction);
            }
        };

        // Add listeners for user interaction
        document.addEventListener('click', startMusicOnInteraction);
        document.addEventListener('keydown', startMusicOnInteraction);
        document.addEventListener('touchstart', startMusicOnInteraction);
        
        console.log('🎵 Background music will start on user interaction');
    }

    // Check if background music is playing
    isMusicCurrentlyPlaying(): boolean {
        return this.isMusicPlaying && this.backgroundMusic !== null && !this.backgroundMusic.paused;
    }

    // Check if music is playing (public method)
    isBackgroundMusicPlaying(): boolean {
        return this.isMusicCurrentlyPlaying();
    }

    // Check if audio service is initialized
    isAudioInitialized(): boolean {
        return this.isInitialized;
    }

    // Get background music status
    getMusicStatus() {
        return {
            isPlaying: this.isMusicCurrentlyPlaying(),
            volume: this.musicVolume,
            actualVolume: this.calculateMusicVolume(),
            isMuted: this.isMuted
        };
    }

    // Special effect: countdown sequence
    playCountdownSequence() {
        this.playSequence(['countdown', 'countdown', 'countdown'], 1000);
        this.playDelayed('battleStart', 3000);
    }

    // Special effect: victory fanfare
    playVictoryFanfare() {
        this.play('victory');
        this.playDelayed('notification', 1000);
    }

    // Special effect: level up celebration
    playLevelUpCelebration() {
        this.play('levelUp');
        this.playDelayed('victory', 500, { volume: this.volume * 0.6 });
    }
}

