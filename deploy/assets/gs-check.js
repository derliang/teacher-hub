/*
Copyright (c) 2026 derliang. All rights reserved.
Non-commercial use only. See LICENSE.md.
Authorization inquiries: derliang@gmail.com
*/
/**
 * gs-check.js — 正式版程式的 .gs 靜態檢查（瀏覽器端；管理員核准前與老師寫入前各跑一次）
 *
 * ⛔ BEGIN/END 之間逐字複製自本機版 src/gs-syntax.mjs（第四輪巡檢 G-20 之後的版本），不要手改；
 *    本機版改了就重新複製，私人 repo gas-deploy-helper 的 test/selfservice-parity.test.mjs 會在兩邊不一致時亮紅燈。
 * 抓兩件事：單檔語法錯誤、跨檔同名頂層 let／const／class（GAS 所有 .gs 共用同一個全域範圍，同名整個專案無法載入）。
 */

// ── BEGIN copied from src/gs-syntax.mjs ──
function isIdentifierStart(ch) { return ch !== undefined && /[A-Za-z_$]/.test(ch); }
function isIdentifierPart(ch) { return ch !== undefined && /[A-Za-z0-9_$]/.test(ch); }

function skipStringOrComment(source, i) {
  const ch = source[i];
  if (ch === '"' || ch === "'" || ch === '`') {
    const quote = ch;
    i++;
    while (i < source.length && source[i] !== quote) { if (source[i] === '\\') i++; i++; }
    return i + 1;
  }
  if (ch === '/' && source[i + 1] === '/') {
    while (i < source.length && source[i] !== '\n') i++;
    return i;
  }
  if (ch === '/' && source[i + 1] === '*') {
    i += 2;
    while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
    return i + 2;
  }
  // G-20（第四輪巡檢）：regex 字面值（如 /'/）裡的引號不能被當成字串起點，否則後面整段都被吞掉。
  // 簡化判斷：`/` 前一個非空白字元是運算子／括號／分隔符，或前一個字是 return 這類關鍵字，就當 regex。
  if (ch === '/' && regexAllowedBefore(source, i)) {
    i++;
    let inClass = false;
    while (i < source.length && source[i] !== '\n') {
      if (source[i] === '\\') { i += 2; continue; }
      if (inClass) { if (source[i] === ']') inClass = false; i++; continue; }
      if (source[i] === '[') { inClass = true; i++; continue; }
      if (source[i] === '/') { i++; while (isIdentifierPart(source[i])) i++; return i; }
      i++;
    }
    return i;
  }
  return null;
}

const REGEX_PRECEDING_CHARS = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_PRECEDING_WORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'throw', 'void', 'delete', 'new', 'yield', 'await']);

function regexAllowedBefore(source, i) {
  let k = i - 1;
  while (k >= 0 && /\s/.test(source[k])) k--;
  if (k < 0) return true;
  if (REGEX_PRECEDING_CHARS.has(source[k])) return true;
  if (!isIdentifierPart(source[k])) return false;
  let start = k;
  while (start > 0 && isIdentifierPart(source[start - 1])) start--;
  return REGEX_PRECEDING_WORDS.has(source.slice(start, k + 1));
}

const STATEMENT_KEYWORDS = new Set(['const', 'let', 'class', 'function', 'var', 'import', 'export']);

// 不寫分號的檔案：換行後緊接 const／let／class／function／var／import／export，就把它當成上一條敘述結束。
function statementStartsAt(source, i) {
  while (i < source.length && /\s/.test(source[i])) i++;
  let k = i;
  while (isIdentifierPart(source[k])) k++;
  return STATEMENT_KEYWORDS.has(source.slice(i, k));
}

// 跳過一個宣告初始值（`= 表達式`），一路吃到與這個表達式同一層的下一個逗號或分號為止。
// 表達式內部的 ()/[]/{} 只影響自己的層次，跳完一定回到跟進來時同一個外層深度，
// 所以呼叫端不必為了這段再另外調整外層的大括號計數。
// G-20：沒寫分號時（`const a = 1\nconst b = 2`）以「換行後緊接敘述關鍵字」當作敘述結束，否則 b 會被漏掉。
function skipToNextTopLevelSeparator(source, i) {
  let depth = 0;
  while (i < source.length) {
    const skipped = skipStringOrComment(source, i);
    if (skipped !== null) { i = skipped; continue; }
    const ch = source[i];
    if (ch === '(' || ch === '[' || ch === '{') { depth++; i++; continue; }
    if (ch === ')' || ch === ']' || ch === '}') { if (depth === 0) return i; depth--; i++; continue; }
    if (depth === 0 && (ch === ',' || ch === ';')) return i;
    if (depth === 0 && ch === '\n' && statementStartsAt(source, i + 1)) return i;
    i++;
  }
  return i;
}

// 只解析、不執行：蒐集每個檔案「括號深度為 0」的 let／const／class 宣告名稱。
// GAS V8 執行環境把同一個 GAS 專案裡所有 .gs 檔案視為同一個全域範圍，
// 兩個檔案各自宣告同名的頂層 let／const／class 會讓整個專案在 GAS 端直接無法載入（BUG-20）；
// 逐檔語法檢查看不到這件事，因為每個檔案分開編譯都是合法的。
// 解構樣式（`const { a, b } = ...`）與陣列樣式的宣告目標不解析名稱，只會少抓、不會誤報。
// ⚠ 這是輔助檢查、不是完整的 JavaScript parser：用字元掃描近似處理字串、註解、regex 與括號深度，
// 目標是「不誤報常見寫法」，不保證抓到所有重複宣告（G-20，第四輪巡檢）。
// G-20：深度同時計 ()／[]／{}，頂層 `for (const i of …)` 的 i 在括號內，不算頂層宣告。
export function topLevelDeclarationNames(source) {
  const names = [];
  let depth = 0;
  let i = 0;
  const declarationKeywords = new Set(['const', 'let', 'class']);
  while (i < source.length) {
    const skipped = skipStringOrComment(source, i);
    if (skipped !== null) { i = skipped; continue; }
    const ch = source[i];
    if (ch === '{' || ch === '(' || ch === '[') { depth++; i++; continue; }
    if (ch === '}' || ch === ')' || ch === ']') { depth = Math.max(0, depth - 1); i++; continue; }
    if (depth === 0 && isIdentifierStart(ch) && (i === 0 || !isIdentifierPart(source[i - 1]))) {
      let j = i;
      while (isIdentifierPart(source[j])) j++;
      const word = source.slice(i, j);
      if (!declarationKeywords.has(word)) { i = j; continue; }
      i = j;
      while (/\s/.test(source[i])) i++;
      if (word === 'class') {
        let k = i;
        while (isIdentifierPart(source[k])) k++;
        if (k > i) names.push(source.slice(i, k));
        i = k;
        continue;
      }
      // const／let：逐一讀出以逗號分隔的簡單識別字，遇到解構樣式（{ 或 [）就放棄這個目標，
      // 但仍繼續讀同一條敘述裡逗號後面的其他目標。
      while (isIdentifierStart(source[i])) {
        let k = i;
        while (isIdentifierPart(source[k])) k++;
        names.push(source.slice(i, k));
        i = k;
        while (source[i] === ' ' || source[i] === '\t') i++;
        if (source[i] === '=') { i = skipToNextTopLevelSeparator(source, i + 1); }
        if (source[i] === ',') { i++; while (/\s/.test(source[i])) i++; continue; }
        break;
      }
      continue;
    }
    i++;
  }
  return names;
}
// ── END copied from src/gs-syntax.mjs ──

/** 單檔語法檢查：只編譯不執行（瀏覽器沒有 node:vm，改用 Function 建構子編譯）。 */
export function syntaxProblem(source) {
  try {
    // eslint-disable-next-line no-new-func
    new Function(source);
    return null;
  } catch (e) {
    if (!(e instanceof SyntaxError)) return null;
    return e.message;
  }
}

/** files：Apps Script API 格式（name/type/source）。回傳中文阻擋原因清單（空陣列＝通過）。 */
export function gsBlockers(files) {
  const gs = files.filter((f) => f.type === 'SERVER_JS');
  const blockers = [];
  const broken = new Set();
  for (const f of gs) {
    const msg = syntaxProblem(f.source || '');
    if (msg) { broken.add(f.name); blockers.push(`${f.name}.gs 有語法錯誤，上傳後整個程式會無法執行：${msg}`); }
  }
  const byName = new Map();
  for (const f of gs.filter((x) => !broken.has(x.name))) {
    for (const name of new Set(topLevelDeclarationNames(f.source || ''))) {
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(`${f.name}.gs`);
    }
  }
  for (const [name, where] of byName) {
    if (where.length > 1) blockers.push(`「${name}」同時出現在 ${where.join('、')}。GAS 的所有 .gs 檔共用同一個範圍，同名會讓整個專案無法載入。`);
  }
  return blockers;
}
