import { Song, ChordItem, LyricLine } from '../types';

function parseLine(time: number, textWithChords: string): LyricLine {
  let cleanText = '';
  const chords: ChordItem[] = [];
  const regex = /\[([^\]]+)\]/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(textWithChords)) !== null) {
    cleanText += textWithChords.slice(lastIndex, match.index);
    chords.push({
      offset: cleanText.length,
      chord: match[1],
    });
    lastIndex = regex.lastIndex;
  }
  cleanText += textWithChords.slice(lastIndex);

  return {
    time,
    text: cleanText || ' ',
    originalText: textWithChords,
    chords,
  };
}

export const PRESET_SONGS: Song[] = [
  {
    id: '1',
    title: '晴天 (Sunny Day)',
    artist: '周杰伦 (Jay Chou)',
    bpm: 84,
    key: 'G Major',
    type: 'preset',
    lyrics: [
      parseLine(0.0, '[Em7](前奏吉他独奏 - 准备开始哼唱)'),
      parseLine(4.0, '[Em7]故事的小黄[Cadd9]花 [G]从出生那年就[D]飘着'),
      parseLine(9.0, '[Em7]童年的荡秋[Cadd9]千 [G]随记忆一直晃[D]到现在'),
      parseLine(14.0, '[Em7]Re So So Si Do [Cadd9]Si Do Si [G]La So La [D]Si Si Si Si La Si La So'),
      parseLine(20.0, '[Em7]吹着前奏 [Cadd9]望着天空 [G]我想起花瓣[D]试着掉落'),
      parseLine(25.5, '[Em7]为你翘课那[Cadd9]一天 教室的那一[G]间 下雨的那一[D]天 我怎么看不[Em7]见'),
      parseLine(31.0, '消失的下雨[Cadd9]天 我好想再吻[G]一次 你的[D]脸'),
      parseLine(36.5, '[Em7]刮风这天 [Cadd9]我走了 [G]但故事的[D]最后你好像还是说了 [Em7]拜拜'),
      parseLine(42.0, '[Em7]晴天这天 [Cadd9]我哭了 [G]没想到失[D]去的勇气我还留着 [Em7]好想'),
      parseLine(47.5, '再问一[Cadd9]遍 你会等[G]待 还是[D]离开'),
      parseLine(53.0, '[Em7]刮风这天 [Cadd9]我走了 [G]但故事的[D]最后你好像还是说了 [Em7]拜拜'),
      parseLine(59.0, '[Em7]晴天这天 [Cadd9]我哭了 [G]没想到失[D]去的勇气我还留着 [Em7]好想'),
      parseLine(65.0, '再问一[Cadd9]遍 你会等[G]待 还是[D]就此离开[Em7]')
    ]
  },
  {
    id: '2',
    title: 'Perfect',
    artist: 'Ed Sheeran',
    bpm: 95,
    key: 'G Major',
    type: 'preset',
    lyrics: [
      parseLine(0.0, '[G](Acoustic Intro - 12/8 Time Signature)'),
      parseLine(4.0, 'I found a [G]love for [Em]me'),
      parseLine(8.5, 'Darling, just [C]dive right in and follow my [D]lead'),
      parseLine(14.0, 'Well, I found a [G]girl, beautiful and [Em]sweet'),
      parseLine(19.0, 'Oh, I never [C]knew you were the someone waiting for [D]me'),
      parseLine(24.5, "Cause we were just kids when we [G]fell in love"),
      parseLine(28.0, 'Not knowing [Em]what it was'),
      parseLine(31.0, 'I will not [C]give you up this [G]ti-[D]ime'),
      parseLine(35.5, 'But darling, just [G]kiss me slow'),
      parseLine(39.0, 'Your heart is [Em]all I own'),
      parseLine(42.0, "And in your [C]eyes you're holding [D]mine"),
      parseLine(46.0, "Baby, [Em]I'm [C]dancing in the [G]dark"),
      parseLine(51.0, "With [D]you between my [Em]arms"),
      parseLine(54.0, "[C]Barefoot on the [G]grass"),
      parseLine(57.0, "[D]Listening to our [Em]favorite song"),
      parseLine(60.0, "When you [C]said you looked a [G]mess"),
      parseLine(63.0, "I whispered [D]underneath my [Em]breath"),
      parseLine(65.5, "But you [C]heard it, darling, [G]you look [D]perfect [G]tonight")
    ]
  },
  {
    id: '3',
    title: 'Fly Me to the Moon',
    artist: 'Frank Sinatra',
    bpm: 120,
    key: 'C Major / A Minor',
    type: 'preset',
    lyrics: [
      parseLine(0.0, '[Am7](Jazz Swing Intro - 4/4 Swing)'),
      parseLine(3.5, '[Am7]Fly me to the [Dm7]moon, let me [G7]play among the [Cmaj7]stars'),
      parseLine(9.0, '[Fmaj7]Let me see what [Bm7b5]spring is like on [E7]Jupiter and [Am7]Mars [A7]'),
      parseLine(15.0, 'In [Dm7]other words, [G7]hold my [Cmaj7]hand [Am7]'),
      parseLine(20.5, 'In [Dm7]other words, [G7]darling, [Cmaj7]kiss me [E7]'),
      parseLine(26.0, '[Am7]Fill my heart with [Dm7]song, and let me [G7]sing forever [Cmaj7]more'),
      parseLine(31.5, '[Fmaj7]You are all I [Bm7b5]long for, all I [E7]worship and a[Am7]dore [A7]'),
      parseLine(37.5, 'In [Dm7]other words, [G7]please be [Cmaj7]true [Am7]'),
      parseLine(43.0, 'In [Dm7]other words, [G7]I love [Cmaj7]you [E7]'),
      parseLine(49.0, '[Am7](Piano Solo Break - Feel the Swing)'),
      parseLine(54.0, 'In [Dm7]other words, [G7]I love [C]you')
    ]
  },
  {
    id: '4',
    title: '凄美地 (Beautiful Land)',
    artist: '郭顶 (Guo Ding)',
    bpm: 126,
    key: 'F Major',
    type: 'preset',
    lyrics: [
      parseLine(0.0, '[C](前奏准备 - 享受轻松的旋律)'),
      parseLine(4.0, '[C]在这个冬天的下午[G]突然想起你'),
      parseLine(12.0, '[Am]翻开那些旧相片[F]都是甜甜的回忆'),
      parseLine(20.0, '[C]小黄花在微风中[G]静静地呼吸'),
      parseLine(28.0, '[Am]我们一起走过的路[F]还有你身上的香气'),
      parseLine(36.0, '[C]时间慢一点[G]让我多抱你一下'),
      parseLine(44.0, '[Am]雨后的晴天里[F]有我们未完的话'),
      parseLine(52.0, '[C]故事的最后[G]你微笑着说拜拜'),
      parseLine(60.0, '[Am]我会一直在你身边[F]永远都不分开')
    ]
  }
];
