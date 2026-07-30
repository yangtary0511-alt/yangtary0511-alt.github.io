import fs from "node:fs/promises";

const site = "https://sentence-forest-toeic.yangdohyun0105.chatgpt.site/";
const html = await (await fetch(site)).text();
const asset = html.match(/\/assets\/quiz-app-[^"]+\.js/)?.[0];
if (!asset) throw new Error("Sentence Forest quiz bundle not found");
const source = await (await fetch(new URL(asset, site))).text();
const raw = source.match(/i=JSON\.parse\(`([\s\S]*?)`\),a=/)?.[1];
if (!raw) throw new Error("Question data not found in Sentence Forest bundle");
const questions = JSON.parse(Function(`"use strict";return \`${raw}\``)());
const stop = new Set("what when where which this that these those with from your have will would could should there their about into than then they them been being were does done some more most very just also only each every because choose best answer blank following refer question questions".split(" "));
const result = {};
for (const q of questions) {
  const text = `${q.prompt || ""} ${(q.choices || []).map((x) => x.text).join(" ")}`.toLowerCase();
  const words = [...new Set(text.match(/[a-z][a-z'-]{3,}/g) || [])].filter((word) => !stop.has(word)).slice(0, 14);
  result[q.id] = words;
}
const output = `window.SENTENCE_FOREST_WORDS_BY_ID=${JSON.stringify(result)};\n`;
await fs.writeFile(new URL("../sentence-forest-vocab.js", import.meta.url), output);
console.log(`Generated ${Object.keys(result).length} Sentence Forest vocabulary links from ${asset}`);
