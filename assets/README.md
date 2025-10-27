# Reddit Realm Quiz Wars - Assets Directory

This directory contains all media assets for your Devvit app.

## Required Files for Splash Screen:

### 📱 **App Icon** (`app-icon.png`)
- **Size**: 512x512px recommended
- **Format**: PNG with transparency
- **Purpose**: Shows in splash screen and app listings
- **Design**: Should represent your quiz game theme

### 🖼️ **Splash Background** (`splash-background.png`)
- **Size**: 1200x800px recommended (16:10 aspect ratio)
- **Format**: PNG or JPG
- **Purpose**: Background image for the splash screen
- **Design**: Should be engaging and match your game's theme

## Current Configuration:

Your `devvit.json` is configured to look for:
- `default-icon.png` - App icon
- `default-splash.png` - Splash background

## File Structure:
```
assets/
├── app-icon.png          (512x512px - Your app icon)
├── splash-background.png (1200x800px - Splash screen background)
└── README.md            (This file)
```

## How to Add Your Assets:

1. **Create or design your images** using tools like:
   - Canva, Figma, Photoshop, GIMP
   - AI image generators (DALL-E, Midjourney, Stable Diffusion)
   - Icon generators online

2. **Save them in this directory** with the exact filenames above

3. **Update the references** in `src/server/core/post.ts` if you use different names

4. **Rebuild and deploy** with `npm run deploy`

## Design Tips:

### App Icon:
- Simple, recognizable design
- Works well at small sizes
- Represents quiz/knowledge theme
- Consider using: 🧠, 🎯, ⚡, 🏆, 📚 themes

### Splash Background:
- Eye-catching but not overwhelming
- Complements the text overlay
- Reddit-themed colors work well
- Consider gradients or subtle patterns

## Image Optimization:
- Keep file sizes under 2MB for optimal performance
- Use PNG for icons (transparency support)
- Use JPG for photos/complex backgrounds
- Optimize images before adding to reduce bundle size