/**
 * 教師離線權 × LINE 早晨預約回覆
 * - 家長傳給「班級 LINE 官方帳號」的訊息，自動記到試算表「收件匣」
 * - 16:00 後、週末傳來的私訊，自動回覆一次「老師明早 7:30 回覆」
 * - 你在「我的回覆」欄填好內容，上學日早上 7:30 自動推播
 * - 「公告」分頁可排程隔天早上的班級通知
 */

// ===== 可自行修改 =====
const SEND_HOUR = 7;
const SEND_MINUTE = 30;
const OFF_HOUR = 16; // 16:00 後算離線
const SCHOOL_PHONE = '02-XXXX-XXXX（學校總機）';
const AUTO_REPLY_TEXT =
  '家長您好，已收到您的訊息🙏\n' +
  '老師配合教師離線權，16:00 後及假日暫不讀回訊息，' +
  '將於上學日早上 7:30 統一回覆。\n' +
  '若有緊急狀況（身體不適、安全問題），請直接撥打 ' + SCHOOL_PHONE + '。謝謝您！';
// =====================

const INBOX = '收件匣';
const NOTICE = '公告';
const TZ = 'Asia/Taipei';

function props_() { return PropertiesService.getScriptProperties(); }
function token_() { return props_().getProperty('LINE_TOKEN'); }
function ss_() { return SpreadsheetApp.openById(props_().getProperty('SHEET_ID')); }
function sheet_(name) { return ss_().getSheetByName(name); }

/** 第一次：在編輯器選 setup 按「執行」 */
function setup() {
  const ss = SpreadsheetApp.getActive();
  props_().setProperty('SHEET_ID', ss.getId());

  let inbox = ss.getSheetByName(INBOX) || ss.insertSheet(INBOX);
  if (inbox.getLastRow() === 0) {
    inbox.appendRow(['收到時間', '來源', '對象ID', '家長名稱', '家長訊息', '我的回覆', '狀態', '發送時間']);
    inbox.setFrozenRows(1);
    inbox.setColumnWidth(5, 320);
    inbox.setColumnWidth(6, 320);
  }
  let notice = ss.getSheetByName(NOTICE) || ss.insertSheet(NOTICE);
  if (notice.getLastRow() === 0) {
    notice.appendRow(['發送日期(空白=下次)', '對象(群組ID或「全部」)', '公告內容', '狀態', '發送時間']);
    notice.setFrozenRows(1);
    notice.setColumnWidth(3, 400);
  }

  // 每天清晨 6 點左右排好當天 7:30 的發送
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'scheduleToday')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('scheduleToday').timeBased().atHour(6).everyDays(1).create();
  SpreadsheetApp.getUi().alert('設定完成！下一步：部署成網頁應用程式，把網址貼到 LINE Webhook。');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('📮 LINE 預約')
    .addItem('現在立刻發送（測試用）', 'sendMorning')
    .addToUi();
}

// ---------- 接收家長訊息 ----------
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  (body.events || []).forEach(handleEvent_);
  return ContentService.createTextOutput('OK');
}

function handleEvent_(ev) {
  if (ev.type !== 'message') return;
  const src = ev.source;
  const targetId = src.groupId || src.roomId || src.userId;
  const name = getName_(src);
  const text = ev.message.type === 'text' ? ev.message.text : '[' + ev.message.type + ']';
  sheet_(INBOX).appendRow([new Date(), src.type === 'user' ? '私訊' : '群組', targetId, name, text, '', '待回覆', '']);

  // 只在私訊自動回覆，避免洗版班群；同一位家長一晚只回一次
  if (src.type === 'user' && isOffHours_()) {
    const nightKey = 'ar_' + src.userId + '_' +
      Utilities.formatDate(new Date(Date.now() - SEND_HOUR * 3600e3), TZ, 'yyyyMMdd');
    if (!props_().getProperty(nightKey)) {
      props_().setProperty(nightKey, '1');
      lineApi_('reply', { replyToken: ev.replyToken, messages: [{ type: 'text', text: AUTO_REPLY_TEXT }] });
    }
  }
}

function getName_(src) {
  try {
    const url = src.groupId
      ? 'https://api.line.me/v2/bot/group/' + src.groupId + '/member/' + src.userId
      : 'https://api.line.me/v2/bot/profile/' + src.userId;
    const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token_() }, muteHttpExceptions: true });
    return JSON.parse(res.getContentText()).displayName || '';
  } catch (err) { return ''; }
}

function isOffHours_() {
  const now = new Date();
  const h = Number(Utilities.formatDate(now, TZ, 'H'));
  const dow = Number(Utilities.formatDate(now, TZ, 'u')); // 1=一 … 7=日
  return h >= OFF_HOUR || h < SEND_HOUR || dow >= 6;
}

// ---------- 早上 7:30 發送 ----------
function scheduleToday() {
  const dow = Number(Utilities.formatDate(new Date(), TZ, 'u'));
  if (dow >= 6) return; // 週末不發
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendMorning')
    .forEach(t => ScriptApp.deleteTrigger(t));
  const at = new Date();
  at.setHours(SEND_HOUR, SEND_MINUTE, 0, 0);
  if (at > new Date()) ScriptApp.newTrigger('sendMorning').timeBased().at(at).create();
}

function sendMorning() {
  const now = new Date();

  // 1) 回覆家長：同一對象的多則回覆合併成一次推播（省額度）
  const inbox = sheet_(INBOX);
  const rows = inbox.getDataRange().getValues();
  const byTarget = {};
  for (let i = 1; i < rows.length; i++) {
    const [, , targetId, , , reply, status] = rows[i];
    if (String(reply).trim() && status !== '已發送') {
      (byTarget[targetId] = byTarget[targetId] || []).push(i + 1);
    }
  }
  Object.keys(byTarget).forEach(targetId => {
    const rowNums = byTarget[targetId];
    for (let k = 0; k < rowNums.length; k += 5) { // 一次最多 5 則
      const chunk = rowNums.slice(k, k + 5);
      const messages = chunk.map(r => ({ type: 'text', text: String(inbox.getRange(r, 6).getValue()) }));
      const err = lineApi_('push', { to: targetId, messages });
      chunk.forEach(r => {
        inbox.getRange(r, 7).setValue(err ? '失敗：' + err : '已發送');
        inbox.getRange(r, 8).setValue(now);
      });
    }
  });

  // 2) 公告
  const notice = sheet_(NOTICE);
  const nrows = notice.getDataRange().getValues();
  const today = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  for (let i = 1; i < nrows.length; i++) {
    const [date, target, content, status] = nrows[i];
    if (!String(content).trim() || status === '已發送') continue;
    const d = date ? Utilities.formatDate(new Date(date), TZ, 'yyyy-MM-dd') : '';
    if (d && d > today) continue;
    const messages = [{ type: 'text', text: String(content) }];
    const err = String(target).trim() === '全部'
      ? lineApi_('broadcast', { messages })
      : lineApi_('push', { to: String(target).trim(), messages });
    notice.getRange(i + 1, 4).setValue(err ? '失敗：' + err : '已發送');
    notice.getRange(i + 1, 5).setValue(now);
  }

  cleanupNightKeys_();
}

function lineApi_(kind, payload) {
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/' + kind, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token_() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  return res.getResponseCode() === 200 ? '' : res.getContentText().slice(0, 200);
}

function cleanupNightKeys_() {
  const all = props_().getProperties();
  Object.keys(all).filter(k => k.startsWith('ar_')).forEach(k => props_().deleteProperty(k));
}
