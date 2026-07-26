function countSyllables(word) {
  if (!word) return 0;
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w || w.length <= 3) return Math.min(1, w.length || 0);
  const vowels = w.match(/[aeiouy]+/g);
  let count = vowels ? vowels.length : 0;
  if (w.endsWith("e") && !w.endsWith("le") && count > 1) count--;
  if (w.endsWith("le") && w.length > 2 && !"aeiouy".includes(w[w.length - 3])) count++;
  return Math.max(1, count);
}

function countSentences(text) {
  if (!text || !text.trim()) return 0;
  const cleaned = text
    .replace(/v\d+(\.\d+)*/gi, "version")
    .replace(/\b(vs|e\.g|i\.e|mr|mrs|dr|prof|inc|ltd)\./gi, "$1");
  const matches = cleaned.match(/[^.!?]+[.!?]+/g);
  return matches ? matches.length : 1;
}

function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return hours + ":" + String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
  }
  return minutes + ":" + String(seconds).padStart(2, "0");
}

function getGradeLabel(rawGrade) {
  if (rawGrade == null) return "-";
  if (rawGrade <= 12) return "Grade " + Math.max(1, Math.round(rawGrade));
  if (rawGrade <= 16) return "College";
  return "Graduate";
}

export function computeReadability(text) {
  if (!text || !text.trim()) {
    return {
      wordCount: 0,
      charCount: 0,
      readingTime: "0:00",
      speakingTime: "0:00",
      gradeLabel: "-",
    };
  }

  const cleanText = text.trim();
  const words = cleanText.split(/\s+/).filter(Boolean);
  const numWords = words.length;
  const numChars = cleanText.length;
  const numSentences = countSentences(cleanText);

  let totalSyllables = 0;
  for (const w of words) totalSyllables += countSyllables(w);

  const readingTimeTotal = Math.round((numWords / 250) * 60);
  const speakingTimeTotal = Math.round((numWords / 130) * 60);

  let rawGrade = null;
  if (numSentences > 0 && numWords > 0) {
    const wordsPerSentence = numWords / numSentences;
    const syllablesPerWord = totalSyllables / numWords;
    rawGrade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
  }

  return {
    wordCount: numWords,
    charCount: numChars,
    readingTime: formatTime(readingTimeTotal),
    speakingTime: formatTime(speakingTimeTotal),
    gradeLabel: getGradeLabel(rawGrade),
  };
}
