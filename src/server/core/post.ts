import { reddit } from "@devvit/web/server";

export async function createPost() {
  const subreddit = await reddit.getCurrentSubreddit();
  
  const post = await reddit.submitCustomPost({
    title: '🃏 Reddit Realm Quiz Wars - Test Your Knowledge!',
    subredditName: subreddit.name,
    splash: {
      appDisplayName: 'Reddit Realm Quiz Wars',
      heading: 'Test Your Knowledge!',
      description: 'Challenge other Redditors in epic knowledge battles across different realms. Climb the leaderboard and become the ultimate quiz champion!',
      buttonLabel: 'Start Playing',
      backgroundUri: 'splash-background.png',
      appIconUri: 'app-icon.png',
      entryUri: 'index.html'
    }
  });

  console.log(`✅ Created Quiz Wars post with splash screen in r/${subreddit.name}: ${post.id}`);
  
  return post;
}