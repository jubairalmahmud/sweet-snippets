// @ts-nocheck
// Google Noto Animated Emoji CDN helper.
// Reference: https://googlefonts.github.io/noto-emoji-animation/

const CODEPOINTS: Record<string, string> = {
  "😀": "1f600", "😂": "1f602", "😍": "1f60d", "🥰": "1f970",
  "😎": "1f60e", "😭": "1f62d", "😡": "1f621", "👍": "1f44d",
  "👏": "1f44f", "🙏": "1f64f", "🔥": "1f525", "🎉": "1f389",
  "❤️": "2764_fe0f", "❤": "2764_fe0f", "💯": "1f4af",
  "😱": "1f631", "🤔": "1f914", "😴": "1f634", "🥳": "1f973",
};

export const PARTY_REACTION_EMOJIS = [
  "😀","😂","😍","🥰","😎","😭","😡","👍","👏","🙏",
  "🔥","🎉","❤️","💯","😱","🤔","😴","🥳",
];

export function notoAnimatedUrl(emoji: string): string | null {
  const cp = CODEPOINTS[emoji];
  if (!cp) return null;
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${cp}/512.webp`;
}
