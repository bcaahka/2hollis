export type LyricBlock =
  | { kind: 'section'; text: string }
  | { kind: 'line'; text: string }
  | { kind: 'gap' };

const LYRICS: Record<string, string> = {
  'singles-4': `[Verse 1]
We were kids back then, and I know you wish we never did what we did, but oh well
I guess you'll live and learn
I'm counting pennies, going to the city
It's good fun, but it sure ain't pretty
We know, we know how to fall (We know how to fall, yeah)
But I'm goin' upstate for a few days
And you should come, but don't be late
Guess I'm back in my ways, I'm back to your face
I know I shouldn't, but can I stay?

[Pre-Chorus]
We can do the cliché, I'll buy a bouquet
Sit down at cafés, make out in the rain
It might not ever be the same, but I'm down for the game, I'm down for the game

[Chorus]
We can do the cliché, I'll buy a bouquet
Sit down at cafés, make out in the rain
And it might not ever be the same, but I'm down for the game, I'm down for the game
We can do the cliché, I'll buy a bouquet
Sit down at cafés, make out in the rain
And it might not ever be the same, but I'm down for the game, I'm down for the game

[Bridge]
Uh, I'm down for the game
You play with me once, you play with me twice, too much
You play with me once, you play with me twice, too much
You play with me once, you play with me twice, too much

[Verse 2]
I had a dream last night
In the dream I said "I love you" for the first time
I hope it's alright (Ooh)
Yeah, I'm fine
Chainsmokin', heart broken open (Oh no)
Can't say I own it if I stole it (Oh no)
Clothes soaking, heart racing open (Oh no)
Can't say I know you in this moment (Oh no)
Chainsmokin', heart broken open (Oh no)
Can't say I own it if I stole it (Oh no)
Clothes soaking, heart racing open (Oh no)
Can't say I know you in this moment (Oh no)

[Chorus]
We can do the cliché, I'll buy a bouquet
Sit down at cafés, make out in the rain
It might not ever be the same, but I'm down for the game, I'm down for the game
We can do the cliché, I'll buy a bouquet
Sit down at cafés, make out in the rain
And it might not ever be the same, but I'm down for the game, I'm down for the game

[Outro]
(Down for the game, down for the game)
(I'm down for the game, I'm down for the game)
(I'm down for the game)
Oh, oh
Ah, aye`,
};

const SECTION = /^\[(.+)\]$/;

export const parseLyrics = (raw: string | null | undefined): LyricBlock[] | undefined => {
  if (!raw?.trim()) return undefined;
  return raw.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return { kind: 'gap' as const };
    const section = SECTION.exec(trimmed);
    if (section) return { kind: 'section' as const, text: section[1] };
    return { kind: 'line' as const, text: trimmed };
  });
};

export const lyricsFor = (trackId: string): LyricBlock[] | undefined => parseLyrics(LYRICS[trackId]);
