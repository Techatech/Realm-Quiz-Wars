import { defineConfig } from 'vite'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 3000
  },
  plugins: [
    {
      name: 'copy-assets',
      writeBundle() {
        // Copy audio files
        const soundsDir = resolve(__dirname, 'sounds')
        const outputSoundsDir = resolve(__dirname, '../../dist/client/sounds')
        
        if (!existsSync(outputSoundsDir)) {
          mkdirSync(outputSoundsDir, { recursive: true })
        }
        
        const audioFiles = [
          'apprentice-thinking.mp3', 'apprentice-turn.mp3', 'background-music.mp3',
          'battle-start.mp3', 'button-click.mp3', 'challenge.mp3', 'correct-answer.mp3',
          'countdown.mp3', 'defeat.mp3', 'incorrect-answer.mp3', 'level-up.mp3',
          'match-found.mp3', 'mode-select.mp3', 'notification.mp3', 'player-turn.mp3',
          'tie.mp3', 'time-up.mp3', 'victory.mp3'
        ]
        
        audioFiles.forEach(file => {
          try {
            copyFileSync(
              resolve(soundsDir, file),
              resolve(outputSoundsDir, file)
            )
            console.log(`Copied ${file} to dist/client/sounds/`)
          } catch (error) {
            console.warn(`Failed to copy ${file}:`, error)
          }
        })

        // Copy splash screen assets from project root assets folder
        const assetsDir = resolve(__dirname, '../../assets')
        const outputAssetsDir = resolve(__dirname, '../../dist/client')
        
        const assetFiles = [
          'app-icon.png',
          'splash-background.png'
        ]
        
        assetFiles.forEach(file => {
          try {
            const sourcePath = resolve(assetsDir, file)
            const destPath = resolve(outputAssetsDir, file)
            
            if (existsSync(sourcePath)) {
              copyFileSync(sourcePath, destPath)
              console.log(`Copied ${file} to dist/client/`)
            } else {
              console.warn(`Asset file not found: ${sourcePath}`)
            }
          } catch (error) {
            console.warn(`Failed to copy asset ${file}:`, error)
          }
        })
      }
    }
  ]
})