import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const html = read('index.html');
const baseMatch = html.match(/const QUESTIONS = (\[[\s\S]*?\]);\r?\nQUESTIONS\.push/);
if (!baseMatch) throw new Error('QUESTIONS 데이터를 찾지 못했습니다.');

const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['additional-questions.js', 'toeic-update-5.js', 'full-passages.js', 'full-passages-extra.js', 'drive-example-translations.js', 'app-example-translations.js']) {
  vm.runInContext(read(file), sandbox, { filename: file });
}
const questions = [
  ...JSON.parse(baseMatch[1]),
  ...(sandbox.window.ADDITIONAL_QUESTIONS || []),
  ...(sandbox.window.TOEIC_UPDATE_5_QUESTIONS || [])
];
for (const q of questions) {
  if (sandbox.window.TOEIC_FULL_PASSAGE_OVERRIDES?.[q.id]) q.passage = sandbox.window.TOEIC_FULL_PASSAGE_OVERRIDES[q.id];
  if (sandbox.window.TOEIC_FULL_PASSAGE_TRANSLATION_OVERRIDES?.[q.id]) q.passageTranslation = sandbox.window.TOEIC_FULL_PASSAGE_TRANSLATION_OVERRIDES[q.id];
}

const numberOf = q => q.question.match(/(?:blank\s*|^)(\d{1,3})/i)?.[1] || q.question.match(/^(\d{1,3})\./)?.[1] || '';
const hasMarker = q => {
  const n = numberOf(q);
  return n ? new RegExp(`-{3,}${n}\\.?-{0,3}|\\[${n}\\]`).test(q.passage || '') : /_{3,}/.test(q.passage || '');
};
const categories = {
  part5Vocabulary: q => q.part === 'Part 5' && /어휘|숙어|콜로케이션/.test(q.skill),
  part5Pos: q => q.part === 'Part 5' && /품사|형용사|부사|명사/.test(q.skill),
  part5Grammar: q => q.part === 'Part 5' && /시제|태|동사|분사|대명사|관계|수량|수 일치/.test(q.skill),
  part6Blank: q => q.part === 'Part 6' && !/문장 삽입/.test(q.skill),
  part6Insertion: q => q.part === 'Part 6' && /문장 삽입/.test(q.skill),
  part7: q => q.part === 'Part 7'
};
const samples = Object.fromEntries(Object.entries(categories).map(([name, test]) => [name, questions.filter(test).slice(0, 5).map(q => q.id)]));
const problems = [];
const translatedPassageLength = q => {
  const direct = q.passageTranslation || '';
  const maps = [sandbox.window.DRIVE_EXAMPLE_TRANSLATIONS || {}, sandbox.window.APP_EXAMPLE_TRANSLATIONS || {}];
  const composed = String(q.passage || '').split(/(?<=[.!?])\s+|\n+/).map(v => v.trim()).filter(Boolean).map(line => maps.map(map => map[line]).find(Boolean) || '').filter(Boolean).join('\n');
  return Math.max(direct.length, composed.length);
};
for (const q of questions) {
  if (/문장 삽입/.test(q.skill) && (!q.passage || !hasMarker(q))) problems.push({ id: q.id, issue: 'Part 6 문장 삽입 passage/blank context 없음' });
  if (/문장 삽입/.test(q.skill) && q.choices.some(choice => choice.split(/\s+/).length < 4)) problems.push({ id: q.id, issue: '문장 삽입 보기 길이 확인 필요' });
  if (/Part [67]/.test(q.part) && q.passage && translatedPassageLength(q) < q.passage.length * 0.18) problems.push({ id: q.id, issue: '지문 번역 누락 가능성' });
}
const legacyPhrases = ['문장 자체는 성립하지만, 지문에 적힌 사실이나 질문의 초점과 일치하지 않습니다', '뜻뿐 아니라 이 빈칸이 요구하는', '⑦ 같이 외울 표현', '⑧ 다음에 푸는 법'];
const legacyRemaining = legacyPhrases.filter(phrase => html.includes(phrase));
const report = {
  totalQuestions: questions.length,
  sampleCount: Object.values(samples).flat().length,
  samples,
  part6InsertionWithContext: questions.filter(categories.part6Insertion).filter(hasMarker).length,
  part6InsertionTotal: questions.filter(categories.part6Insertion).length,
  legacyRemaining,
  problems
};
console.log(JSON.stringify(report, null, 2));
if (legacyRemaining.length || problems.some(item => item.issue.includes('context 없음'))) process.exitCode = 1;
