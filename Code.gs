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

    /* ---- คำสั่งฝั่งผู้ดูแล (ส่งข้อมูลก้อนใหญ่ผ่าน POST) ---- */
    if (d.action === 'certAdd') {
      if (d.token !== ADMIN_PASS) return json({ ok: false, message: 'รหัสผ่านไม่ถูกต้อง' });
      return json(addCerts(d.act, d.rows, d.replace === true));
    }
    if (d.action === 'tplUpload') {
      if (d.token !== ADMIN_PASS) return json({ ok: false, message: 'รหัสผ่านไม่ถูกต้อง' });
      return json(saveTemplate(d.act, d.name, d.mime, d.data));
    }

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
  } else if (p.action === 'certStatus') {
    out = certStatus();
  } else if (p.action === 'certSummary') {
    out = certSummary(p.act);
  } else if (p.action === 'certSearch') {
    out = searchCerts(p.act, p.q, p.ptype);
  } else if (p.action === 'certTemplate') {
    out = getTemplate(p.act);

  /* ---------- ผู้ดูแลระบบ ---------- */
  } else if (p.action === 'actList') {
    if (p.token !== ADMIN_PASS) { out = { ok: false, message: 'รหัสผ่านไม่ถูกต้อง' }; }
    else {
      out = { ok: true, acts: readActs().map(function (a) {
        return { code: a.code, name: a.name, year: a.year, openAt: a.openAt,
                 status: a.status, tplName: a.tplName, hasTpl: !!a.tplId,
                 n: certCount(a.code), live: actLive(a), note: a.note, layout: a.layout }; }) };
    }
  } else if (p.action === 'actSave') {
    if (p.token !== ADMIN_PASS) { out = { ok: false, message: 'รหัสผ่านไม่ถูกต้อง' }; }
    else { out = saveAct({ code: p.code, name: p.name, year: p.year, openAt: p.openAt,
                           status: p.status, note: p.note,
                           layout: (p.layout == null ? null : p.layout) }); }
  } else if (p.action === 'actDelete') {
    out = (p.token === ADMIN_PASS) ? deleteAct(p.code) : { ok: false, message: 'รหัสผ่านไม่ถูกต้อง' };
  } else if (p.action === 'certClear') {
    out = (p.token === ADMIN_PASS) ? clearCerts(p.act) : { ok: false, message: 'รหัสผ่านไม่ถูกต้อง' };
  } else if (p.action === 'migrateBP') {
    out = (p.token === ADMIN_PASS) ? migrateBP2569() : { ok: false, message: 'รหัสผ่านไม่ถูกต้อง' };

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

/* ===============================================================
 *  ระบบเกียรติบัตรกลาง — รองรับหลายกิจกรรม ค้นหาย้อนหลังได้
 *  แท็บ 'กิจกรรม'    = ทะเบียนกิจกรรม (1 กิจกรรม = 1 เทมเพลต)
 *  แท็บ 'เกียรติบัตร' = รายชื่อผู้รับทุกคน ผูกกับรหัสกิจกรรม
 * =============================================================== */
const SHEET_ACT  = 'กิจกรรม';
const SHEET_CERT = 'เกียรติบัตร';

const HEADERS_ACT = [
  'รหัสกิจกรรม', 'ชื่อกิจกรรม', 'ปีงบประมาณ', 'วันเปิดดาวน์โหลด',
  'สถานะ', 'รหัสไฟล์พื้นหลัง', 'ชื่อไฟล์พื้นหลัง', 'หมายเหตุ', 'รูปแบบข้อความ'
];
const HEADERS_CERT = [
  'ลำดับ', 'รหัสกิจกรรม', 'เลขที่เกียรติบัตร', 'รหัสอ้างอิง', 'ประเภท/หมวด',
  'ชื่อผลงาน', 'คำนำหน้า', 'ชื่อ - สกุล', 'ตำแหน่ง', 'กลุ่มโรงเรียน', 'โรงเรียน',
  'ระดับรางวัล', 'คะแนน', 'หมายเหตุ'
];
const AWARD_DEFAULT = 'เข้าร่วม';
const ACT_BP2569    = 'BP2569';

/* ---------- แผ่นงาน ---------- */
function mkSheet(name, headers, color, widths) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground(color).setFontColor('#ffffff').setFontWeight('bold')
      .setVerticalAlignment('middle').setHorizontalAlignment('center').setWrap(true);
    sh.setFrozenRows(1);
    sh.setRowHeight(1, 42);
    widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  }
  return sh;
}
function getActSheet() {
  const sh = mkSheet(SHEET_ACT, HEADERS_ACT, '#b45309',
    [130, 380, 110, 190, 100, 300, 260, 240, 320]);
  /* ชีตเดิมมี 8 คอลัมน์ — เติมหัวคอลัมน์ 'รูปแบบข้อความ' ให้อัตโนมัติ */
  if (sh.getLastColumn() < HEADERS_ACT.length) {
    const n = HEADERS_ACT.length;
    sh.getRange(1, 1, 1, n).setValues([HEADERS_ACT])
      .setBackground('#b45309').setFontColor('#ffffff').setFontWeight('bold')
      .setVerticalAlignment('middle').setHorizontalAlignment('center').setWrap(true);
    sh.setColumnWidth(n, 320);
  }
  return sh;
}
function getCertSheet() {
  return mkSheet(SHEET_CERT, HEADERS_CERT, '#7c3aed',
    [55, 130, 150, 130, 250, 300, 90, 190, 170, 250, 230, 130, 90, 200]);
}

/* ---------- ทะเบียนกิจกรรม ---------- */
function readActs() {
  const sh = getActSheet(), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEADERS_ACT.length).getDisplayValues()
    .filter(function (r) { return String(r[0]).trim() !== ''; })
    .map(function (r) {
      return {
        code: String(r[0]).trim(), name: r[1], year: r[2], openAt: String(r[3] || '').trim(),
        status: String(r[4] || '').trim(), tplId: String(r[5] || '').trim(),
        tplName: r[6], note: r[7], layout: String(r[8] || '').trim()
      };
    });
}
function findAct(code) {
  const c = String(code || '').trim();
  const a = readActs().filter(function (x) { return x.code === c; });
  return a.length ? a[0] : null;
}
function actRowIndex(code) {
  const sh = getActSheet(), last = sh.getLastRow();
  if (last < 2) return -1;
  const v = sh.getRange(2, 1, last - 1, 1).getDisplayValues();
  for (var i = 0; i < v.length; i++) if (String(v[i][0]).trim() === String(code).trim()) return i + 2;
  return -1;
}
/* เปิดให้ค้นหา/ดาวน์โหลดจริง = สถานะเปิด และถึงวันเปิดแล้ว */
function actLive(a) {
  if (!a || a.status !== 'เปิด') return false;
  const t = new Date(a.openAt).getTime();
  return isNaN(t) ? true : (new Date().getTime() >= t);
}

function saveAct(d) {
  const code = String(d.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,20}$/.test(code)) {
    return { ok: false, message: 'รหัสกิจกรรมใช้ได้เฉพาะ A-Z 0-9 - _ ความยาว 2-20 ตัว' };
  }
  if (!String(d.name || '').trim()) return { ok: false, message: 'กรุณากรอกชื่อกิจกรรม' };
  const sh  = getActSheet();
  const row = [code, d.name, d.year || '', d.openAt || '',
               d.status === 'เปิด' ? 'เปิด' : 'ปิด', d.tplId || '', d.tplName || '', d.note || '',
               d.layout == null ? '' : String(d.layout)];
  const at = actRowIndex(code);
  if (at > 0) {
    const cur = sh.getRange(at, 1, 1, HEADERS_ACT.length).getDisplayValues()[0];
    if (!row[5]) { row[5] = cur[5]; row[6] = cur[6]; }   // ไม่ส่งเทมเพลตมา = คงของเดิม
    if (d.layout == null) row[8] = cur[8];               // ไม่ส่งรูปแบบข้อความมา = คงของเดิม
    sh.getRange(at, 1, 1, HEADERS_ACT.length).setValues([row]);
  } else {
    sh.appendRow(row);
  }
  return { ok: true, act: findAct(code) };
}
function deleteAct(code) {
  const at = actRowIndex(code);
  if (at < 1) return { ok: false, message: 'ไม่พบกิจกรรมนี้' };
  const n = readCerts(code).length;
  if (n > 0) return { ok: false, message: 'กิจกรรมนี้มีรายชื่ออยู่ ' + n + ' รายการ กรุณาลบรายชื่อก่อน' };
  getActSheet().deleteRow(at);
  return { ok: true };
}

/* ---------- รายชื่อผู้รับเกียรติบัตร ---------- */
function readCerts(actCode) {
  const sh = getCertSheet(), last = sh.getLastRow();
  if (last < 2) return [];
  const c = String(actCode || '').trim();
  return sh.getRange(2, 1, last - 1, HEADERS_CERT.length).getDisplayValues()
    .filter(function (r) { return String(r[1]).trim() !== '' && (!c || String(r[1]).trim() === c); })
    .map(function (r) {
      return {
        seq: r[0], act: String(r[1]).trim(), certNo: r[2], refCode: r[3], ptype: r[4],
        title: r[5], prefix: r[6], fullname: r[7], name: (r[6] || '') + r[7],
        position: r[8], schoolGroup: r[9], school: r[10],
        award: String(r[11] || '').trim() || AWARD_DEFAULT, score: r[12], note: r[13]
      };
    });
}
function certCount(actCode) { return readCerts(actCode).length; }

/* เพิ่มรายชื่อเข้ากิจกรรม — rows = [{refCode,ptype,title,prefix,fullname,position,schoolGroup,school,award,score,note}] */
function addCerts(actCode, rows, replace) {
  const code = String(actCode || '').trim();
  if (!findAct(code)) return { ok: false, message: 'ไม่พบกิจกรรม ' + code };
  if (!rows || !rows.length) return { ok: false, message: 'ไม่มีข้อมูลรายชื่อ' };

  const sh = getCertSheet();
  if (replace) {
    const last = sh.getLastRow();
    if (last >= 2) {
      const v = sh.getRange(2, 1, last - 1, 2).getDisplayValues();
      for (var k = v.length - 1; k >= 0; k--) {
        if (String(v[k][1]).trim() === code) sh.deleteRow(k + 2);
      }
    }
  }

  const existing = readCerts(code);
  const seen = {};
  existing.forEach(function (r) {
    if (r.refCode) seen[String(r.refCode).trim()] = true;
    if (r.certNo)  seen[String(r.certNo).trim()]  = true;
  });

  var seq = existing.length;
  const y   = String(findAct(code).year || (new Date().getFullYear() + 543)).slice(-2);
  const out = [];
  var skipped = 0;
  for (var i = 0; i < rows.length; i++) {
    var d = rows[i] || {};
    var name = String(d.fullname || '').trim();
    if (!name) { skipped++; continue; }
    var ref = String(d.refCode || '').trim();
    var cno = String(d.certNo || '').trim();          // เลขที่จากไฟล์ (ถ้ามี)
    var key = ref || cno;
    if (key && seen[key]) { skipped++; continue; }
    if (key) seen[key] = true;
    seq++;
    out.push([
      seq, code, cno || (code + '-' + y + '/' + ('0000' + seq).slice(-4)), ref,
      d.ptype || '', d.title || '', d.prefix || '', name, d.position || '',
      d.schoolGroup || '', d.school || '',
      d.award || '', d.score || '', d.note || ''
    ]);
  }
  if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, HEADERS_CERT.length).setValues(out);
  return { ok: true, added: out.length, skipped: skipped, total: certCount(code) };
}

function clearCerts(actCode) {
  const code = String(actCode || '').trim();
  const sh = getCertSheet(), last = sh.getLastRow();
  var n = 0;
  if (last >= 2) {
    const v = sh.getRange(2, 1, last - 1, 2).getDisplayValues();
    for (var k = v.length - 1; k >= 0; k--) {
      if (String(v[k][1]).trim() === code) { sh.deleteRow(k + 2); n++; }
    }
  }
  return { ok: true, removed: n };
}

/* ---------- ย้ายข้อมูล Best Practice 2569 เข้าเป็นกิจกรรมแรก ---------- */
function migrateBP2569() {
  if (!findAct(ACT_BP2569)) {
    saveAct({
      code: ACT_BP2569, name: 'แนวปฏิบัติที่เป็นเลิศ (Best Practice)', year: '2569',
      openAt: '2026-09-08T08:00:00+07:00', status: 'ปิด', note: 'ย้ายจากระบบเดิมอัตโนมัติ'
    });
  }
  if (certCount(ACT_BP2569) > 0) return { ok: true, added: 0, note: 'มีข้อมูลอยู่แล้ว' };
  const src = readAll().concat(readSep()).filter(function (r) {
    return !/^TEST[-\s]/i.test(String(r.title || ''));
  });
  const rows = src.reverse().map(function (r) {
    return {
      refCode: r.refCode, ptype: r.ptype, title: r.title, prefix: r.prefix,
      fullname: r.fullname, position: r.position, schoolGroup: r.schoolGroup, school: r.school
    };
  });
  return addCerts(ACT_BP2569, rows, false);
}

/* ---------- ค้นหาสาธารณะ ---------- */
function publicActs() {
  return readActs().filter(actLive).map(function (a) {
    return { code: a.code, name: a.name, year: a.year, n: certCount(a.code), layout: a.layout };
  });
}
/* กิจกรรมที่ประกาศแล้ว + กิจกรรมที่ยังไม่ถึงวัน (ไว้แสดงนับถอยหลัง) */
function certStatus() {
  const all = readActs();
  return {
    ok: true,
    acts: publicActs(),
    upcoming: all.filter(function (a) { return a.status === 'เปิด' && !actLive(a); })
                 .map(function (a) { return { code: a.code, name: a.name, year: a.year, openAt: a.openAt }; })
  };
}
function certTypes(actCode) {
  const m = {};
  readCerts(actCode).forEach(function (r) { var k = String(r.ptype || '').trim(); if (k) m[k] = (m[k] || 0) + 1; });
  const out = Object.keys(m).map(function (k) { return { ptype: k, n: m[k] }; });
  out.sort(function (a, b) { return b.n - a.n; });
  return out;
}
function certSummary(actCode) {
  const a = findAct(actCode);
  if (!a) return { ok: false, message: 'ไม่พบกิจกรรม' };
  if (!actLive(a)) return { ok: true, live: false, openAt: a.openAt, name: a.name, year: a.year };
  const rows = readCerts(a.code);
  const m = {};
  rows.forEach(function (r) { m[r.award] = (m[r.award] || 0) + 1; });
  const byAward = Object.keys(m).map(function (k) { return { award: k, n: m[k] }; });
  byAward.sort(function (x, y) { return y.n - x.n; });
  return { ok: true, live: true, name: a.name, year: a.year, total: rows.length,
           byAward: byAward, byType: certTypes(a.code) };
}
function searchCerts(actCode, q, ptype) {
  const a = findAct(actCode);
  if (!a) return { ok: false, message: 'ไม่พบกิจกรรม' };
  if (!actLive(a)) return { ok: false, live: false, openAt: a.openAt, message: 'ยังไม่ถึงวันเปิดดาวน์โหลด' };
  const s = String(q || '').trim().toLowerCase();
  const t = String(ptype || '').trim();
  if (s.length < 2 && !t) {
    return { ok: false, live: true, message: 'กรุณาพิมพ์คำค้นอย่างน้อย 2 ตัวอักษร หรือเลือกประเภทผลงาน' };
  }
  var rows = readCerts(a.code);
  if (t) rows = rows.filter(function (r) { return String(r.ptype) === t; });
  if (s.length >= 2) {
    rows = rows.filter(function (r) {
      return [r.refCode, r.certNo, r.name, r.school, r.schoolGroup, r.title]
        .join(' ').toLowerCase().indexOf(s) > -1;
    });
  }
  const CAP = 200;
  return { ok: true, live: true, actName: a.name, actYear: a.year,
           rows: rows.slice(0, CAP), more: Math.max(0, rows.length - CAP) };
}

/* ---------- พื้นหลังเกียรติบัตร (1 กิจกรรม = 1 เทมเพลต) ---------- */
function saveTemplate(actCode, name, mime, dataB64) {
  const a = findAct(actCode);
  if (!a) return { ok: false, message: 'ไม่พบกิจกรรม' };
  if (!/^image\/(png|jpe?g)$/i.test(String(mime))) {
    return { ok: false, message: 'พื้นหลังต้องเป็นไฟล์ PNG หรือ JPG เท่านั้น' };
  }
  const bytes = Utilities.base64Decode(dataB64);
  if (bytes.length > MAX_BYTES) return { ok: false, message: 'ไฟล์พื้นหลังมีขนาดเกิน 10 MB' };
  const isPng = (bytes[0] === -119 || bytes[0] === 137);
  const isJpg = (bytes[0] === -1  || bytes[0] === 255);
  if (!isPng && !isJpg) return { ok: false, message: 'ไฟล์พื้นหลังต้องเป็น PNG หรือ JPG เท่านั้น' };
  const ext  = isPng ? '.png' : '.jpg';
  const real = isPng ? 'image/png' : 'image/jpeg';
  const blob = Utilities.newBlob(bytes, real, 'CERT_' + a.code + ext);
  const f = getFolder().createFile(blob);
  f.setDescription('พื้นหลังเกียรติบัตร: ' + a.name);
  if (a.tplId) { try { DriveApp.getFileById(a.tplId).setTrashed(true); } catch (e) {} }
  const at = actRowIndex(a.code);
  getActSheet().getRange(at, 6, 1, 2).setValues([[f.getId(), name || f.getName()]]);
  return { ok: true, tplId: f.getId(), tplName: name || f.getName() };
}
function getTemplate(actCode) {
  const a = findAct(actCode);
  if (!a) return { ok: false, message: 'ไม่พบกิจกรรม' };
  if (!a.tplId) return { ok: false, message: 'กิจกรรมนี้ยังไม่ได้อัปโหลดพื้นหลังเกียรติบัตร' };
  try {
    const b = DriveApp.getFileById(a.tplId).getBlob();
    return { ok: true, mime: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) };
  } catch (e) {
    return { ok: false, message: 'อ่านไฟล์พื้นหลังไม่สำเร็จ: ' + e.message };
  }
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
