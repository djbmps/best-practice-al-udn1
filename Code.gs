/*******************************************************************
 *  ระบบส่งผลงาน Best Practice การจัดการเรียนรู้เชิงรุก (Active Learning)
 *  สำนักงานเขตพื้นที่การศึกษาประถมศึกษาอุดรธานี เขต 1
 *  -----------------------------------------------------------------
 *  ไฟล์นี้เป็นส่วน "หลังบ้าน" สำหรับ Google Apps Script
 *  ทำหน้าที่  : รับข้อมูลจากฟอร์ม -> บันทึกลง Google Sheet
 *               -> อัปโหลดไฟล์ PDF ลง Google Drive
 *               -> ส่งข้อมูลให้หน้าผู้ดูแลระบบ (admin.html)
 *******************************************************************/

/* =================== ⚙️ ตั้งค่า 3 บรรทัดนี้ =================== */

// 1) รหัส Google Sheet  (คัดลอกจาก URL ของชีต ช่วง /d/........./edit)
const SHEET_ID   = '1LsGET6p0PaxTvokyI7N4EpsB9_PYFFEV8iwW9EPUt1c';

// 2) รหัสโฟลเดอร์ใน Google Drive สำหรับเก็บไฟล์แผนการสอน
//    (คัดลอกจาก URL ของโฟลเดอร์ ช่วง /folders/.........)
const FOLDER_ID  = '1kIIgjAEI8gVfxyDzBEEA_iU62B5Fnh8z';

// 3) รหัสผ่านสำหรับเข้าหน้าผู้ดูแลระบบ (admin.html) — ควรเปลี่ยนเป็นรหัสของท่านเอง
const ADMIN_PASS = 'udn1@bestal2569';

/* ============================================================== */

const SHEET_NAME = 'ผลงาน';
const MAX_BYTES  = 10 * 1024 * 1024;   // 10 MB

const HEADERS = [
  'ลำดับ', 'วันที่ส่ง', 'รหัสอ้างอิง', 'กลุ่มสาระการเรียนรู้', 'ชื่อผลงาน',
  'คำนำหน้า', 'ชื่อ - สกุล', 'ตำแหน่ง', 'วิทยฐานะ',
  'กลุ่มโรงเรียน', 'โรงเรียน', 'ระดับชั้น',
  'เบอร์โทรศัพท์', 'ID Line',
  'ลิงก์แผนการจัดการเรียนรู้', 'ชื่อไฟล์', 'ขนาดไฟล์ (KB)',
  'ลิงก์คลิปวิดีโอ', 'หมายเหตุ'
];

/* ---------------------------------------------------------------
 *  doPost — รับการส่งผลงานจาก index.html
 * --------------------------------------------------------------- */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const d = JSON.parse(e.postData.contents);
    if (d.action !== 'submit') return json({ ok: false, message: 'คำสั่งไม่ถูกต้อง' });

    /* ---- ตรวจสอบข้อมูลฝั่งเซิร์ฟเวอร์ ---- */
    const need = ['prefix','fullname','position','academic','schoolGroup','school',
                  'phone','lineId','subject','title','level','videoUrl','fileData','fileName'];
    for (var i = 0; i < need.length; i++) {
      if (!d[need[i]] || String(d[need[i]]).trim() === '') {
        return json({ ok: false, message: 'ข้อมูลไม่ครบถ้วน (' + need[i] + ')' });
      }
    }
    if (!/^https?:\/\/.+/i.test(String(d.videoUrl))) {
      return json({ ok: false, message: 'ลิงก์คลิปวิดีโอไม่ถูกต้อง' });
    }
    if (!/\.pdf$/i.test(String(d.fileName))) {
      return json({ ok: false, message: 'รองรับเฉพาะไฟล์ PDF เท่านั้น' });
    }

    /* ---- ถอดรหัสไฟล์และตรวจขนาด ---- */
    const bytes = Utilities.base64Decode(d.fileData);
    if (bytes.length > MAX_BYTES) {
      return json({ ok: false, message: 'ไฟล์มีขนาดเกิน 10 MB' });
    }
    // ตรวจ magic number ของ PDF  (%PDF)
    if (!(bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70)) {
      return json({ ok: false, message: 'ไฟล์ที่แนบไม่ใช่ไฟล์ PDF ที่ถูกต้อง' });
    }

    const sh  = getSheet();
    const seq = Math.max(0, sh.getLastRow() - 1) + 1;   // แถวที่ 1 คือหัวตาราง
    const now = new Date();
    const refCode = makeRef(now, seq);

    /* ---- อัปโหลดไฟล์ลง Drive ---- */
    const safeName = String(d.fileName).replace(/[\\/:*?"<>|]/g, '_').replace(/\.pdf$/i, '');
    const finalName = refCode + '__' + d.school + '__' + safeName + '.pdf';
    const blob = Utilities.newBlob(bytes, 'application/pdf', finalName);
    const file = getFolder().createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (err) { /* บางองค์กรปิดการแชร์สาธารณะ — ข้ามได้ */ }
    file.setDescription('Best Practice AL | ' + d.subject + ' | ' + d.school);

    /* ---- บันทึกลงชีต ---- */
    sh.appendRow([
      seq,
      Utilities.formatDate(now, 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss'),
      refCode,
      d.subject,
      d.title,
      d.prefix,
      d.fullname,
      d.position,
      d.academic,
      d.schoolGroup,
      d.school,
      d.level,
      "'" + String(d.phone),
      "'" + String(d.lineId),
      file.getUrl(),
      d.fileName,
      Math.round(bytes.length / 1024),
      d.videoUrl,
      d.note || ''
    ]);

    return json({ ok: true, refCode: refCode, fileUrl: file.getUrl() });

  } catch (err) {
    return json({ ok: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์: ' + err.message });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/* ---------------------------------------------------------------
 *  doGet — ใช้กับหน้าผู้ดูแลระบบ (JSONP) และตรวจสอบสถานะ
 * --------------------------------------------------------------- */
function doGet(e) {
  const p  = (e && e.parameter) ? e.parameter : {};
  const cb = p.callback;

  var out;
  if (p.action === 'list') {
    out = (p.token === ADMIN_PASS) ? { ok: true, rows: readAll() }
                                   : { ok: false, message: 'รหัสผ่านไม่ถูกต้อง' };
  } else {
    out = { ok: true, message: 'Best Practice AL API — สพป.อุดรธานี เขต 1', time: new Date().toISOString() };
  }
  return cb ? jsonp(cb, out) : json(out);
}

/* ---------------------------------------------------------------
 *  ฟังก์ชันช่วย
 * --------------------------------------------------------------- */
function readAll() {
  const sh = getSheet();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const v = sh.getRange(2, 1, last - 1, HEADERS.length).getDisplayValues();
  return v.map(function (r) {
    return {
      seq: r[0], timestamp: r[1], refCode: r[2], subject: r[3], title: r[4],
      prefix: r[5], fullname: r[6], name: (r[5] || '') + r[6],
      position: r[7], academic: r[8], schoolGroup: r[9], school: r[10], level: r[11],
      phone: r[12], lineId: r[13], fileUrl: r[14], fileName: r[15], fileSize: r[16],
      videoUrl: r[17], note: r[18]
    };
  }).reverse();          // รายการล่าสุดขึ้นก่อน
}

function makeRef(now, n) {
  const y = (now.getFullYear() + 543).toString().slice(-2);   // พ.ศ. 2 หลัก
  return 'AL' + y + '-' + ('0000' + n).slice(-4);
}

function getSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    const h = sh.getRange(1, 1, 1, HEADERS.length);
    h.setFontWeight('bold').setBackground('#1e4d8c').setFontColor('#ffffff')
     .setVerticalAlignment('middle').setHorizontalAlignment('center');
    sh.setFrozenRows(1);
    sh.setRowHeight(1, 38);
    [55, 155, 105, 210, 320, 90, 190, 170, 160, 250, 230, 165, 125, 140, 230, 220, 110, 240, 260]
      .forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  }
  return sh;
}

function getFolder() {
  return DriveApp.getFolderById(FOLDER_ID);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonp(cb, obj) {
  const safe = String(cb).replace(/[^A-Za-z0-9_$]/g, '');
  return ContentService.createTextOutput(safe + '(' + JSON.stringify(obj) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/* ---------------------------------------------------------------
 *  ▶ ทดสอบการตั้งค่า — กด Run ฟังก์ชันนี้ 1 ครั้งหลังตั้งค่าเสร็จ
 *     แล้วดูผลที่เมนู "บันทึกการดำเนินการ" (Execution log)
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
  msg.push(ADMIN_PASS === 'udn1@bestal2569'
    ? '⚠️ กรุณาเปลี่ยนรหัสผ่านผู้ดูแล (ADMIN_PASS) เป็นรหัสของท่านเอง'
    : '✅ ตั้งรหัสผ่านผู้ดูแลเรียบร้อย');
  Logger.log(msg.join('\n'));
  return msg.join('\n');
}
