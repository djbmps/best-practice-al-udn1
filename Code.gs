/*******************************************************************
 *  ระบบส่งผลงานแนวปฏิบัติที่เป็นเลิศ (Best Practice) ประจำปีงบประมาณ 2569
 *  สำนักงานเขตพื้นที่การศึกษาประถมศึกษาอุดรธานี เขต 1
 *  -----------------------------------------------------------------
 *  รองรับผลงาน 3 ประเภท
 *    1) การจัดการเรียนรู้เชิงรุก (Active Learning)  -> แผนการสอน + คลิป + อินโฟกราฟิก
 *    2) ด้านการบริหารสถานศึกษา                      -> อินโฟกราฟิก
 *    3) ด้านการจัดการเรียนรู้                        -> อินโฟกราฟิก
 *******************************************************************/

/* =================== ⚙️ ตั้งค่า 3 บรรทัดนี้ =================== */

// 1) รหัส Google Sheet  (คัดลอกจาก URL ของชีต ช่วง /d/........./edit)
const SHEET_ID   = '1LsGET6p0PaxTvokyI7N4EpsB9_PYFFEV8iwW9EPUt1c';

// 2) รหัสโฟลเดอร์ใน Google Drive สำหรับเก็บไฟล์ผลงาน
const FOLDER_ID  = '1kIIgjAEI8gVfxyDzBEEA_iU62B5Fnh8z';

// 3) รหัสผ่านสำหรับเข้าหน้าผู้ดูแลระบบ (admin.html)
const ADMIN_PASS = 'udn1@bestal2569';

/* ============================================================== */

const SHEET_NAME = 'ผลงาน';
const MAX_BYTES  = 10 * 1024 * 1024;   // 10 MB

const HEADERS = [
  'ลำดับ', 'วันที่ส่ง', 'รหัสอ้างอิง', 'ประเภทผลงาน', 'กลุ่มสาระการเรียนรู้', 'ชื่อผลงาน',
  'คำนำหน้า', 'ชื่อ - สกุล', 'ตำแหน่ง', 'วิทยฐานะ',
  'กลุ่มโรงเรียน', 'โรงเรียน', 'ระดับชั้น',
  'เบอร์โทรศัพท์', 'ID Line',
  'ลิงก์แผนการจัดการเรียนรู้', 'ลิงก์อินโฟกราฟิก', 'ลิงก์คลิปการสอน', 'หมายเหตุ'
];

const PTYPE_NAME = {
  '1': 'แนวปฏิบัติที่เป็นเลิศในการจัดการเรียนรู้เชิงรุก (Active Learning)',
  '2': 'แนวปฏิบัติที่เป็นเลิศ ด้านการบริหารสถานศึกษา',
  '3': 'แนวปฏิบัติที่เป็นเลิศ ด้านการจัดการเรียนรู้'
};
const PTYPE_CODE = { '1': 'AL', '2': 'ADM', '3': 'LRN' };

/* ---- ผลงานเศรษฐกิจพอเพียง (แท็บชีตแยก + หน้าเว็บ /sep/) ---- */
const SHEET_SEP = 'เศรษฐกิจพอเพียง';
const SEP_NAME  = 'การจัดการเรียนรู้เศรษฐกิจพอเพียง';
const HEADERS_SEP = [
  'ลำดับ', 'วันที่ส่ง', 'รหัสอ้างอิง', 'ชื่อผลงาน',
  'คำนำหน้า', 'ชื่อ - สกุล', 'ตำแหน่ง', 'วิทยฐานะ',
  'กลุ่มโรงเรียน', 'โรงเรียน', 'เบอร์โทรศัพท์', 'ID Line',
  'ลิงก์อินโฟกราฟิก', 'หมายเหตุ'
];

/* ---- สวิตช์เปิด/ปิดระบบรับผลงาน (ควบคุมจากหน้า admin) ---- */
const CLOSED_MSG = 'ขณะนี้ปิดรับผลงานแล้ว ขออภัยในความไม่สะดวก';
function isOpen() {
  return PropertiesService.getScriptProperties().getProperty('SUBMIT_OPEN') !== 'OFF';
}
function setOpen(on) {
  PropertiesService.getScriptProperties().setProperty('SUBMIT_OPEN', on ? 'ON' : 'OFF');
  return isOpen();
}

/* ---------------------------------------------------------------
 *  doPost — รับการส่งผลงานจาก index.html
 * --------------------------------------------------------------- */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const d = JSON.parse(e.postData.contents);
    if (d.action !== 'submit') return json({ ok: false, message: 'คำสั่งไม่ถูกต้อง' });
    if (!isOpen()) return json({ ok: false, message: CLOSED_MSG });

    if (String(d.form || '') === 'sep') return submitSep(d);

    const t = String(d.ptype || '');
    if (!PTYPE_NAME[t]) return json({ ok: false, message: 'กรุณาเลือกประเภทผลงาน' });

    /* ---- ตรวจสอบข้อมูลฝั่งเซิร์ฟเวอร์ ---- */
    var need = ['prefix','fullname','position','academic','schoolGroup','school',
                'phone','lineId','title','infoData','infoName'];
    if (t === '1') {
      need = need.concat(['subject','level','videoUrl','planData','planName']);
    }
    for (var i = 0; i < need.length; i++) {
      if (!d[need[i]] || String(d[need[i]]).trim() === '') {
        return json({ ok: false, message: 'ข้อมูลไม่ครบถ้วน (' + need[i] + ')' });
      }
    }
    if (t === '1' && !/^https?:\/\/.+/i.test(String(d.videoUrl))) {
      return json({ ok: false, message: 'ลิงก์คลิปการสอนไม่ถูกต้อง' });
    }
    if (!/\.(jpe?g|png|pdf)$/i.test(String(d.infoName))) {
      return json({ ok: false, message: 'อินโฟกราฟิกต้องเป็นไฟล์ PDF, JPG หรือ PNG เท่านั้น' });
    }
    if (t === '1' && !/\.pdf$/i.test(String(d.planName))) {
      return json({ ok: false, message: 'แผนการจัดการเรียนรู้ต้องเป็นไฟล์ PDF เท่านั้น' });
    }

    const sh  = getSheet();
    const seq = Math.max(0, sh.getLastRow() - 1) + 1;
    const now = new Date();
    const refCode = makeRef(now, seq, t);
    const folder = getFolder();

    /* ---- อัปโหลดอินโฟกราฟิก ---- */
    const infoBytes = Utilities.base64Decode(d.infoData);
    if (infoBytes.length > MAX_BYTES) return json({ ok: false, message: 'ไฟล์อินโฟกราฟิกมีขนาดเกิน 10 MB' });
    const isPng = (infoBytes[0] === -119 || infoBytes[0] === 137);
    const isJpg = (infoBytes[0] === -1  || infoBytes[0] === 255);
    const isPdf = (infoBytes[0] === 37 && infoBytes[1] === 80 && infoBytes[2] === 68 && infoBytes[3] === 70);
    if (!isPng && !isJpg && !isPdf) {
      return json({ ok: false, message: 'ไฟล์อินโฟกราฟิกต้องเป็น PDF, JPG หรือ PNG เท่านั้น' });
    }
    const infoExt  = isPdf ? '.pdf' : (isPng ? '.png' : '.jpg');
    const infoMime = isPdf ? 'application/pdf' : (isPng ? 'image/png' : 'image/jpeg');
    const infoFile = saveFile(folder, infoBytes, infoMime,
      refCode + '__INFO__' + safe(d.school) + infoExt, PTYPE_NAME[t], d.school);

    /* ---- อัปโหลดแผนการจัดการเรียนรู้ (เฉพาะประเภท 1) ---- */
    var planUrl = '';
    if (t === '1') {
      const planBytes = Utilities.base64Decode(d.planData);
      if (planBytes.length > MAX_BYTES) return json({ ok: false, message: 'ไฟล์แผนการจัดการเรียนรู้มีขนาดเกิน 10 MB' });
      if (!(planBytes[0] === 37 && planBytes[1] === 80 && planBytes[2] === 68 && planBytes[3] === 70)) {
        return json({ ok: false, message: 'ไฟล์แผนการจัดการเรียนรู้ไม่ใช่ PDF ที่ถูกต้อง' });
      }
      const planFile = saveFile(folder, planBytes, 'application/pdf',
        refCode + '__PLAN__' + safe(d.school) + '.pdf', PTYPE_NAME[t], d.school);
      planUrl = planFile.getUrl();
    }

    /* ---- บันทึกลงชีต ---- */
    sh.appendRow([
      seq,
      Utilities.formatDate(now, 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss'),
      refCode,
      PTYPE_NAME[t],
      d.subject || '',
      d.title,
      d.prefix,
      d.fullname,
      d.position,
      d.academic,
      d.schoolGroup,
      d.school,
      d.level || '',
      "'" + String(d.phone),
      "'" + String(d.lineId),
      planUrl,
      infoFile.getUrl(),
      d.videoUrl || '',
      d.note || ''
    ]);

    return json({ ok: true, refCode: refCode });

  } catch (err) {
    return json({ ok: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์: ' + err.message });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/* ---------------------------------------------------------------
 *  doGet — หน้าผู้ดูแลระบบ (JSONP)
 * --------------------------------------------------------------- */
function doGet(e) {
  const p  = (e && e.parameter) ? e.parameter : {};
  const cb = p.callback;

  var out;
  if (p.action === 'list') {
    out = (p.token === ADMIN_PASS) ? { ok: true, rows: readAll().concat(readSep()) }
                                   : { ok: false, message: 'รหัสผ่านไม่ถูกต้อง' };
  } else if (p.action === 'public') {
    out = { ok: true, rows: readPublic() };
  } else if (p.action === 'publicSep') {
    out = { ok: true, rows: readPublicSep() };
  } else if (p.action === 'status') {
    out = { ok: true, open: isOpen(), closedMsg: CLOSED_MSG };
  } else if (p.action === 'setOpen') {
    out = (p.token === ADMIN_PASS)
      ? { ok: true, open: setOpen(String(p.open) === '1' || String(p.open) === 'true') }
      : { ok: false, message: 'รหัสผ่านไม่ถูกต้อง' };
  } else {
    out = { ok: true, message: 'Best Practice 2569 API — สพป.อุดรธานี เขต 1', time: new Date().toISOString() };
  }
  return cb ? jsonp(cb, out) : json(out);
}

/* ---------------------------------------------------------------
 *  ฟังก์ชันช่วย
 * --------------------------------------------------------------- */
function saveFile(folder, bytes, mime, name, ptypeName, school) {
  const blob = Utilities.newBlob(bytes, mime, name);
  const file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) { /* บางองค์กรปิดการแชร์สาธารณะ — ข้ามได้ */ }
  file.setDescription('Best Practice 2569 | ' + ptypeName + ' | ' + school);
  return file;
}

function safe(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '_');
}

function readAll() {
  const sh = getSheet();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const v = sh.getRange(2, 1, last - 1, HEADERS.length).getDisplayValues();
  return v.map(function (r) {
    return {
      seq: r[0], timestamp: r[1], refCode: r[2], ptype: r[3], subject: r[4], title: r[5],
      prefix: r[6], fullname: r[7], name: (r[6] || '') + r[7],
      position: r[8], academic: r[9], schoolGroup: r[10], school: r[11], level: r[12],
      phone: r[13], lineId: r[14], planUrl: r[15], infoUrl: r[16], videoUrl: r[17], note: r[18]
    };
  }).reverse();          // รายการล่าสุดขึ้นก่อน
}

/* รายการสาธารณะ — เปิดให้ผู้ส่งตรวจสอบว่าผลงานเข้าระบบแล้ว
   ไม่แสดงเบอร์โทรศัพท์ ID Line และลิงก์ไฟล์ */
function readPublic() {
  const sh = getSheet();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const v = sh.getRange(2, 1, last - 1, HEADERS.length).getDisplayValues();
  const out = [];
  for (var i = 0; i < v.length; i++) {
    var r = v[i];
    var title = String(r[5] || '');
    if (/^TEST[-\s]/i.test(title)) continue;      // ซ่อนรายการทดสอบระบบ
    out.push({
      seq: r[0],
      date: String(r[1] || '').split(' ')[0],
      refCode: r[2],
      ptype: r[3],
      subject: r[4],
      title: title,
      name: (r[6] || '') + r[7],
      schoolGroup: r[10],
      school: r[11]
    });
  }
  return out.reverse();
}

/* ===============================================================
 *  ผลงานเศรษฐกิจพอเพียง — บันทึกลงแท็บชีตแยก
 * =============================================================== */
function submitSep(d) {
  var need = ['prefix','fullname','position','academic','schoolGroup','school',
              'phone','lineId','title','infoData','infoName'];
  for (var i = 0; i < need.length; i++) {
    if (!d[need[i]] || String(d[need[i]]).trim() === '') {
      return json({ ok: false, message: 'ข้อมูลไม่ครบถ้วน (' + need[i] + ')' });
    }
  }
  if (!/^0\d{1,2}-?\d{3}-?\d{4}$/.test(String(d.phone).replace(/\s/g, ''))) {
    return json({ ok: false, message: 'เบอร์โทรศัพท์ไม่ถูกต้อง' });
  }
  if (!/\.(jpe?g|png|pdf)$/i.test(String(d.infoName))) {
    return json({ ok: false, message: 'อินโฟกราฟิกต้องเป็นไฟล์ PDF, JPG หรือ PNG เท่านั้น' });
  }

  const sh  = getSepSheet();
  const seq = Math.max(0, sh.getLastRow() - 1) + 1;
  const now = new Date();
  const y   = (now.getFullYear() + 543).toString().slice(-2);
  const refCode = 'SEP' + y + '-' + ('0000' + seq).slice(-4);

  const bytes = Utilities.base64Decode(d.infoData);
  if (bytes.length > MAX_BYTES) return json({ ok: false, message: 'ไฟล์อินโฟกราฟิกมีขนาดเกิน 10 MB' });
  const isPng = (bytes[0] === -119 || bytes[0] === 137);
  const isJpg = (bytes[0] === -1  || bytes[0] === 255);
  const isPdf = (bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70);
  if (!isPng && !isJpg && !isPdf) {
    return json({ ok: false, message: 'ไฟล์อินโฟกราฟิกต้องเป็น PDF, JPG หรือ PNG เท่านั้น' });
  }
  const ext  = isPdf ? '.pdf' : (isPng ? '.png' : '.jpg');
  const mime = isPdf ? 'application/pdf' : (isPng ? 'image/png' : 'image/jpeg');
  const file = saveFile(getFolder(), bytes, mime,
    refCode + '__INFO__' + safe(d.school) + ext, SEP_NAME, d.school);

  sh.appendRow([
    seq,
    Utilities.formatDate(now, 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss'),
    refCode,
    d.title,
    d.prefix, d.fullname, d.position, d.academic,
    d.schoolGroup, d.school, d.phone, d.lineId,
    file.getUrl(), d.note || ''
  ]);
  return json({ ok: true, refCode: refCode });
}

function getSepSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(SHEET_SEP);
  if (!sh) sh = ss.insertSheet(SHEET_SEP);
  const need = (sh.getLastRow() === 0) ||
               (sh.getRange(1, 1, 1, HEADERS_SEP.length).getDisplayValues()[0][3] !== HEADERS_SEP[3]);
  if (need) {
    sh.getRange(1, 1, 1, HEADERS_SEP.length).setValues([HEADERS_SEP])
      .setFontWeight('bold').setBackground('#0d9488').setFontColor('#ffffff')
      .setVerticalAlignment('middle').setHorizontalAlignment('center').setWrap(true);
    sh.setFrozenRows(1);
    sh.setRowHeight(1, 42);
    [55, 155, 110, 320, 90, 190, 170, 150, 250, 230, 140, 140, 220, 260]
      .forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  }
  return sh;
}

/* แปลงเป็นรูปแบบเดียวกับ readAll() เพื่อให้หน้า admin แสดงรวมกันได้ */
function readSep() {
  const sh = getSepSheet();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const v = sh.getRange(2, 1, last - 1, HEADERS_SEP.length).getDisplayValues();
  return v.map(function (r) {
    return {
      seq: r[0], timestamp: r[1], refCode: r[2], ptype: SEP_NAME, subject: '', title: r[3],
      prefix: r[4], fullname: r[5], name: (r[4] || '') + r[5],
      position: r[6], academic: r[7], schoolGroup: r[8], school: r[9], level: '',
      phone: r[10], lineId: r[11], planUrl: '', infoUrl: r[12], videoUrl: '', note: r[13]
    };
  }).reverse();
}

function readPublicSep() {
  const sh = getSepSheet();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const v = sh.getRange(2, 1, last - 1, HEADERS_SEP.length).getDisplayValues();
  const out = [];
  for (var i = 0; i < v.length; i++) {
    var r = v[i];
    var title = String(r[3] || '');
    if (/^TEST[-\s]/i.test(title)) continue;
    out.push({
      seq: r[0],
      date: String(r[1] || '').split(' ')[0],
      refCode: r[2],
      ptype: SEP_NAME,
      subject: '',
      title: title,
      name: (r[4] || '') + r[5],
      schoolGroup: r[8],
      school: r[9]
    });
  }
  return out.reverse();
}

function makeRef(now, n, t) {
  const y = (now.getFullYear() + 543).toString().slice(-2);   // พ.ศ. 2 หลัก
  return PTYPE_CODE[t] + y + '-' + ('0000' + n).slice(-4);
}

function getSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);

  if (sh.getLastRow() === 0) {
    writeHeader(sh);
  } else {
    // ชีตเดิมมี 19 คอลัมน์แบบเก่า — ถ้าหัวตารางไม่ตรง ให้เขียนหัวใหม่ทับ (ข้อมูลเดิมยังอยู่)
    const cur = sh.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
    if (cur[3] !== HEADERS[3]) writeHeader(sh);
  }
  return sh;
}

function writeHeader(sh) {
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  const h = sh.getRange(1, 1, 1, HEADERS.length);
  h.setFontWeight('bold').setBackground('#1e4d8c').setFontColor('#ffffff')
   .setVerticalAlignment('middle').setHorizontalAlignment('center').setWrap(true);
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 42);
  [55, 155, 110, 300, 210, 320, 90, 190, 170, 150, 250, 230, 165, 125, 140, 220, 220, 240, 260]
    .forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
}

function getFolder() {
  return DriveApp.getFolderById(FOLDER_ID);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonp(cb, obj) {
  const safeCb = String(cb).replace(/[^A-Za-z0-9_$]/g, '');
  return ContentService.createTextOutput(safeCb + '(' + JSON.stringify(obj) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/* ---------------------------------------------------------------
 *  ▶ ทดสอบการตั้งค่า — กด Run ฟังก์ชันนี้เพื่อตรวจการเชื่อมต่อ
 * --------------------------------------------------------------- */
function ทดสอบการตั้งค่า() {
  var msg = [];
  try {
    var sh = getSheet();
    msg.push('✅ เชื่อมต่อ Google Sheet สำเร็จ: ' + sh.getParent().getName() + ' / แผ่นงาน "' + sh.getName() + '"');
  } catch (e) { msg.push('❌ Google Sheet: ' + e.message); }
  try {
    var f = getFolder();
    msg.push('✅ เชื่อมต่อโฟลเดอร์ Drive สำเร็จ: ' + f.getName());
  } catch (e) { msg.push('❌ โฟลเดอร์ Drive: ' + e.message); }
  Logger.log(msg.join('\n'));
  return msg.join('\n');
}
