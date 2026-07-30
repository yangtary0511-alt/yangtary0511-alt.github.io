import fs from "node:fs/promises";
import vm from "node:vm";

const html = await fs.readFile(new URL("../index.html", import.meta.url), "utf8");
const baseMatch = html.match(/const QUESTIONS = (\[[\s\S]*?\]);\s*QUESTIONS\.push/);
if (!baseMatch) throw new Error("Base questions were not found.");

const baseQuestions = JSON.parse(baseMatch[1]);
const context = { window: {} };
vm.createContext(context);
vm.runInContext(await fs.readFile(new URL("../additional-questions.js", import.meta.url), "utf8"), context);

const questions = [...baseQuestions, ...context.window.ADDITIONAL_QUESTIONS];
const choices = [...new Set(questions.flatMap((q) => q.choices))];
const stopWords = new Set("about after again against all also and any are because been before being between both but can could did does doing down during each few for from further had has have having her here hers herself him himself his how into its itself just may might more most must not now off once only other our ours ourselves out over own same she should some such than that the their theirs them themselves then there these they this those through too under until very was were what when where which while who whom why will with would you your yours yourself yourselves".split(" "));
const words = [...new Set(
  questions.flatMap((q) => `${q.question} ${q.passage || ""}`.match(/[A-Za-z][A-Za-z’'-]{3,}/g) || [])
    .map((word) => word.toLowerCase().replace(/[’']/g, "'"))
    .filter((word) => !stopWords.has(word)),
)];
const missingPassages = [...new Set(questions.filter((q) => q.passage && !q.passageTranslation).map((q) => q.passage))];
const missingSentences = [...new Set(questions.filter((q) => !q.sentenceTranslation).map((q) => q.question))];

async function translateAll(items) {
  const translations = {};
  let cursor = 0;
  async function worker() {
   while (cursor < items.length) {
    const choice = items[cursor++];
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.search = new URLSearchParams({ client: "gtx", sl: "en", tl: "ko", dt: "t", q: choice });
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Translation failed: ${response.status}`);
    const data = await response.json();
    translations[choice] = data[0].map((part) => part[0]).join("").trim();
   }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  return Object.fromEntries(items.map((item) => [item, translations[item]]));
}

const ordered = await translateAll(choices);
const wordTranslations = await translateAll(words);
const passageTranslations = await translateAll(missingPassages);
const sentenceTranslations = await translateAll(missingSentences);
await fs.writeFile(
  new URL("../choice-translations.js", import.meta.url),
  `window.CHOICE_TRANSLATIONS = ${JSON.stringify(ordered, null, 2)};\nwindow.TOEIC_WORD_TRANSLATIONS = ${JSON.stringify(wordTranslations, null, 2)};\nwindow.TOEIC_PASSAGE_TRANSLATIONS = ${JSON.stringify(passageTranslations, null, 2)};\nwindow.TOEIC_SENTENCE_TRANSLATIONS = ${JSON.stringify(sentenceTranslations, null, 2)};\n`,
  "utf8",
);
console.log(`Wrote ${choices.length} choices, ${words.length} vocabulary entries, ${missingPassages.length} passages, and ${missingSentences.length} sentences.`);
