import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const html = read('index.html');
const baseMatch = html.match(/const QUESTIONS = (\[[\s\S]*?\]);\r?\nQUESTIONS\.push/);
if (!baseMatch) throw new Error('QUESTIONS 데이터를 찾지 못했습니다.');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['additional-questions.js','toeic-update-5.js','full-passages.js','full-passages-extra.js','choice-translations.js','word-bank.js','drive-example-translations.js','app-example-translations.js']) vm.runInContext(read(file), sandbox, {filename:file});
const questions=[...JSON.parse(baseMatch[1]),...(sandbox.window.ADDITIONAL_QUESTIONS||[]),...(sandbox.window.TOEIC_UPDATE_5_QUESTIONS||[])];
for(const q of questions){if(sandbox.window.TOEIC_FULL_PASSAGE_OVERRIDES?.[q.id])q.passage=sandbox.window.TOEIC_FULL_PASSAGE_OVERRIDES[q.id];if(sandbox.window.TOEIC_FULL_PASSAGE_TRANSLATION_OVERRIDES?.[q.id])q.passageTranslation=sandbox.window.TOEIC_FULL_PASSAGE_TRANSLATION_OVERRIDES[q.id]}
const issues=[];const add=(q,type,detail)=>issues.push({id:q?.id||'global',type,detail});
const numberOf=q=>q.question.match(/(?:blank\s*|^)(\d{1,3})/i)?.[1]||q.question.match(/^(\d{1,3})\./)?.[1]||'';
const hasMarker=q=>{const n=numberOf(q);return n?new RegExp(`-{3,}${n}\\.?-{0,3}|\\[${n}\\]`).test(q.passage||''):/_{3,}/.test(q.passage||'')};
const categories={part5Vocabulary:q=>q.part==='Part 5'&&/어휘|숙어|콜로케이션/.test(q.skill),part5Grammar:q=>q.part==='Part 5'&&!/어휘|숙어|콜로케이션/.test(q.skill),prepositionConnector:q=>/전치사|접속/.test(q.skill),polysemy:q=>/promotion|serve|following|issue|order|charge|account|subject|address|position|figure|current|present|available|due|concern|release|conduct|apply|provide|respect|matter/i.test(`${q.question} ${q.choices.join(' ')}`),part6:q=>q.part==='Part 6',part6Insertion:q=>q.part==='Part 6'&&/문장 삽입/.test(q.skill),part7:q=>q.part==='Part 7'};
const ids=new Set();for(const q of questions){
 if(ids.has(q.id))add(q,'duplicate-id','중복 ID');ids.add(q.id);
 if(!Array.isArray(q.choices)||q.choices.length<3||q.choices.length>4)add(q,'choice-count','선택지가 3~4개 범위를 벗어남');
 if(!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.choices.length)add(q,'answer-index','정답 인덱스 범위 오류');
 if(!String(q.explanation||'').trim())add(q,'empty-explanation','해설 누락');
 const sentenceKo=String(q.sentenceTranslation||sandbox.window.APP_EXAMPLE_TRANSLATIONS?.[q.question]||sandbox.window.DRIVE_EXAMPLE_TRANSLATIONS?.[q.question]||'').trim();if(!sentenceKo&&/Part [567]/.test(q.part))add(q,'empty-sentence-translation','문장 해석 누락');
 if(q.part==='Part 6'&&/Choose the best|blank/i.test(q.question)&&(!q.passage||!hasMarker(q)))add(q,'part6-context','전체 지문 또는 해당 빈칸 표식 누락');
 if(q.part==='Part 7'&&(!q.passage||!q.explanation))add(q,'part7-evidence','지문 또는 근거 해설 누락');
 if(/Part [67]/.test(q.part)&&q.passage){const lines=String(q.passage).split(/(?<=[.!?])\\s+|\\n+/).map(v=>v.trim()).filter(Boolean),maps=[sandbox.window.DRIVE_EXAMPLE_TRANSLATIONS||{},sandbox.window.APP_EXAMPLE_TRANSLATIONS||{}],composed=lines.map(line=>maps.map(map=>map[line]).find(Boolean)||'').filter(Boolean).join('\\n'),ko=[String(q.passageTranslation||''),String(sandbox.window.TOEIC_FULL_PASSAGE_TRANSLATION_OVERRIDES?.[q.id]||''),composed].sort((a,b)=>b.length-a.length)[0],en=String(q.passage||'');if(ko.length<en.length*.18)add(q,'passage-translation','전체 지문 해석 분량 부족')}
 const correct=String(q.choices?.[q.answer]||'').toLowerCase();for(let i=0;i<q.choices.length;i++){if(i!==q.answer&&String(q.explanation).toLowerCase().includes(`${q.choices[i]}가 정답`))add(q,'answer-conflict',`오답 ${q.choices[i]}을 정답으로 서술`)}
 if(!correct)add(q,'empty-correct-option','정답 선택지 비어 있음');
}
const forbidden=['문장 자체는 성립하지만, 지문에 적힌 사실이나 질문의 초점과 일치하지 않습니다','뜻뿐 아니라 이 빈칸이 요구하는','⑦ 같이 외울 표현','⑧ 다음에 푸는 법','"following": "수행원"'];for(const phrase of forbidden)if(html.includes(phrase)||read('choice-translations.js').includes(phrase))add(null,'legacy-template',phrase);
const answerPositions=Object.fromEntries(['A','B','C','D'].map((x,i)=>[x,questions.filter(q=>q.answer===i).length]));
const typeCounts=Object.fromEntries(Object.entries(categories).map(([k,p])=>[k,questions.filter(p).length]));
const manualPlan={part5Vocabulary:questions.filter(categories.part5Vocabulary).slice(0,10).map(q=>q.id),part5Grammar:questions.filter(categories.part5Grammar).slice(0,10).map(q=>q.id),prepositionConnector:questions.filter(categories.prepositionConnector).slice(0,10).map(q=>q.id),polysemy:questions.filter(categories.polysemy).slice(0,10).map(q=>q.id),part6:questions.filter(categories.part6).slice(0,10).map(q=>q.id),part6Insertion:questions.filter(categories.part6Insertion).slice(0,10).map(q=>q.id),part7:questions.filter(categories.part7).slice(0,10).map(q=>q.id)};
const report={totalQuestions:questions.length,auditedQuestions:questions.length,answerPositions,typeCounts,manualReviewPlan:manualPlan,manualReviewUniqueCount:new Set(Object.values(manualPlan).flat()).size,issueCount:issues.length,issues};console.log(JSON.stringify(report,null,2));if(issues.length)process.exitCode=1;
