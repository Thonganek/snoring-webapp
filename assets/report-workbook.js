const riskNames = { low: 'ต่ำ', moderate: 'ปานกลาง', high: 'สูง', 'urgent-review': 'ควรทบทวนเร่งด่วน' };
const statusNames = { new: 'รอทบทวน', reviewing: 'กำลังทบทวน', 'follow-up': 'นัดติดตาม', referred: 'ส่งต่อแล้ว', closed: 'สิ้นสุดการติดตาม' };
const roleNames = { parent: 'ผู้ปกครอง', nurse: 'พยาบาล', ent: 'แพทย์ ENT', doctor: 'แพทย์', admin: 'ผู้ดูแลระบบ' };
const videoNames = { uploaded: 'อัปโหลดแล้ว', pending: 'รออัปโหลด', 'pending-human-review': 'รอเจ้าหน้าที่ทบทวน', reviewing: 'กำลังทบทวน', accepted: 'ผ่านการทบทวน', 'needs-human-review': 'ต้องทบทวนเพิ่มเติม', rejected: 'ไม่ผ่านการทบทวน' };
const validNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const numeric = value => validNumber(value) ? Number(value) : null;
const answer = value => [true, 1, '1', 'true'].includes(value) ? true : [false, 0, '0', 'false'].includes(value) ? false : null;
const answerText = value => answer(value) === null ? 'ไม่มีข้อมูล' : answer(value) ? 'มี / ใช่' : 'ไม่มี / ไม่ใช่';
const osaNumber = value => validNumber(value) && Number(value) >= 1 && Number(value) <= 7 ? Number(value) : null;
const date = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(new Date(value).getTime() + 7 * 3600000) : null;
const dayCount = (at, now) => at && Number.isFinite(new Date(at).getTime()) ? Math.max(0, Math.floor((new Date(now) - new Date(at)) / 86400000)) : null;
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const percent = (count, total) => total ? count / total : null;
const groupName = value => ({ low: 'ต่ำ (<60)', moderate: 'ปานกลาง (60–80)', high: 'สูง (>80)' })[value] || value || 'ไม่มีข้อมูล';
const label = (names, value) => names[value] || value || 'ไม่มีข้อมูล';
const dataType = child => child?.isTestData ? 'ข้อมูลทดสอบ' : 'ข้อมูลจริง';

export function analyseReport(data) {
  const children = data.children || [], screenings = data.screenings || [], videos = data.videos || [];
  const byChild = new Map(children.map(child => [child.childId, child]));
  const ordered = [...screenings].sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)) || String(b.screeningId).localeCompare(String(a.screeningId)));
  const latest = new Map();
  for (const row of ordered) if (!latest.has(row.childId)) latest.set(row.childId, row);
  const latestRows = [...latest.values()];
  const high = row => ['high', 'urgent-review'].includes(row.riskLevel);
  const open = row => row.clinicalStatus !== 'closed';
  const scores = screenings.map(row => numeric(row.osa18Total)).filter(value => value !== null).sort((a, b) => a - b);
  const ranks = { 'urgent-review': 0, high: 1, moderate: 2, low: 3 };
  const followUp = latestRows.filter(open).sort((a,b) => (ranks[a.riskLevel] ?? 4) - (ranks[b.riskLevel] ?? 4) || String(a.submittedAt).localeCompare(String(b.submittedAt)));
  const months = new Map();
  for (const row of screenings) {
    const key = date(row.submittedAt)?.toISOString().slice(0,7) || 'ไม่มีวันที่';
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(row);
  }
  const quality = [];
  const issue = (type, id, childId, message) => quality.push([type, id, byChild.get(childId)?.childCode || childId, message, dataType(byChild.get(childId))]);
  for (const child of children) {
    if (!child.childName && !child.nickname) issue('ข้อมูลเด็ก', child.childId, child.childId, 'ไม่มีชื่อเด็กหรือชื่อเล่น');
    if (!child.birthDate) issue('ข้อมูลเด็ก', child.childId, child.childId, 'ไม่มีวันเกิด');
    if (!validNumber(child.ageYears)) issue('ข้อมูลเด็ก', child.childId, child.childId, 'ไม่มีอายุในทะเบียน');
    if (!validNumber(child.weightKg) || Number(child.weightKg) <= 0) issue('ข้อมูลเด็ก', child.childId, child.childId, 'ไม่มีน้ำหนักที่ใช้ได้');
    if (!validNumber(child.heightCm) || Number(child.heightCm) <= 0) issue('ข้อมูลเด็ก', child.childId, child.childId, 'ไม่มีส่วนสูงที่ใช้ได้');
    if (!latest.has(child.childId)) issue('ข้อมูลเด็ก', child.childId, child.childId, 'ไม่มีผลคัดกรองในขอบเขตรายงาน');
  }
  for (const row of screenings) {
    const osa = (data.schema?.osa18Items || []).map(item => osaNumber(row.osa18Answers?.[item.key]));
    const coreMissing = (data.schema?.coreQuestions || []).filter(item => answer(row.coreAnswers?.[item.key]) === null).length;
    const riskMissing = (data.schema?.riskFactors || []).filter(item => answer(row.riskFactors?.[item.key]) === null).length;
    if (osa.some(value => value === null)) issue('ผลคัดกรอง', row.screeningId, row.childId, 'คำตอบ OSA-18 ขาดหรืออยู่นอกช่วง 1–7: ' + osa.filter(value => value === null).length + ' ข้อ');
    else if (osa.length && osa.reduce((a,b)=>a+b,0) !== numeric(row.osa18Total)) issue('ผลคัดกรอง', row.screeningId, row.childId, 'ผลรวมคำตอบ OSA-18 ไม่ตรงกับคะแนนที่บันทึก');
    if (coreMissing || riskMissing) issue('ผลคัดกรอง', row.screeningId, row.childId, `ไม่มีคำตอบสัญญาณสำคัญ ${coreMissing} ข้อ / ปัจจัยเสี่ยง ${riskMissing} ข้อ`);
    if (!riskNames[row.riskLevel]) issue('ผลคัดกรอง', row.screeningId, row.childId, 'ระดับความเสี่ยงไม่อยู่ในรายการมาตรฐาน');
    if (!statusNames[row.clinicalStatus]) issue('ผลคัดกรอง', row.screeningId, row.childId, 'สถานะทบทวนไม่อยู่ในรายการมาตรฐาน');
    if (!date(row.submittedAt)) issue('ผลคัดกรอง', row.screeningId, row.childId, 'ไม่มีวันที่ประเมินที่ใช้ได้');
  }
  return { children, screenings, videos, byChild, ordered, latest, latestRows, scores, high, open, followUp, months, quality,
    median: scores.length ? (scores[Math.floor((scores.length-1)/2)] + scores[Math.ceil((scores.length-1)/2)]) / 2 : null,
    actualChildren: children.filter(child=>!child.isTestData).length,
    testChildren: children.filter(child=>child.isTestData).length
  };
}

export async function createReportWorkbook(data, ExcelJS) {
  if (!ExcelJS?.Workbook) throw new Error('ไม่สามารถโหลดเครื่องมือสร้าง Excel');
  const report = analyseReport(data);
  const { children, screenings, videos, byChild, latest, latestRows, scores, high, followUp, months, quality } = report;
  const schema = data.schema || { coreQuestions: [], riskFactors: [], osa18Items: [] };
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'โรงพยาบาลธัญบุรี · Pediatric OSA Screening';
  workbook.created = new Date(data.exportedAt);
  workbook.modified = new Date(data.exportedAt);
  workbook.title = 'รายงานผลคัดกรองเด็กนอนกรนและบทสรุปผู้บริหาร';
  const scopeLabel = { all: 'ข้อมูลทั้งหมด (รวมข้อมูลทดสอบ)', real: 'ข้อมูลจริงเท่านั้น', test: 'ข้อมูลทดสอบเท่านั้น' }[data.filters?.scope] || 'ข้อมูลทั้งหมด';
  const rangeLabel = `${data.filters?.from || 'ไม่จำกัดวันเริ่มต้น'} ถึง ${data.filters?.to || 'ไม่จำกัดวันสิ้นสุด'} (วันที่คัดกรอง เวลาไทย)`;
  const generated = date(data.exportedAt)?.toISOString().replace('T', ' ').slice(0, 19) || '';
  const notes = `${scopeLabel} | ${rangeLabel} | ส่งออก ${generated} น. (ค.ศ.)`;
  const sheets = [];
  const dateFmt = 'dd/mm/yyyy hh:mm';
  function sheet(name, headings, rows, options = {}) {
    if (rows.length > 1048572) throw new Error('ข้อมูลในชีต ' + name + ' เกินขีดจำกัด Excel กรุณาเลือกช่วงวันที่ให้สั้นลง');
    const ws = workbook.addWorksheet(name, { properties: { defaultRowHeight: 24, tabColor: { argb: options.summary ? 'FF007D77' : 'FF7DB7A8' } }, views: [{ state: 'frozen', ySplit: 4, xSplit: headings.length > 8 ? 3 : 0 }], pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: headings.length > 20 ? 3 : 1, fitToHeight: 0 } });
    sheets.push([name, options.description || name, rows.length]);
    ws.columns = headings.map((heading, index) => ({ width: options.widths?.[index] || (index < 3 ? 25 : heading.length > 35 ? 42 : 25) }));
    ws.mergeCells(1,1,1,headings.length);
    ws.getCell(1,1).value = name + ' · โรงพยาบาลธัญบุรี';
    ws.getRow(1).height = 34;
    ws.getCell(1,1).fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF00685E'}};
    ws.getCell(1,1).font = {name:'Tahoma',size:16,bold:true,color:{argb:'FFFFFFFF'}};
    ws.mergeCells(2,1,2,headings.length);
    ws.getCell(2,1).value = options.note || notes;
    ws.getCell(2,1).font = {name:'Tahoma',size:9,color:{argb:'FF61796D'}};
    ws.getCell(2,1).alignment = {wrapText:true,vertical:'middle'};
    ws.getRow(2).height = 32;
    ws.getRow(4).values = headings;
    ws.getRow(4).height = headings.some(heading=>heading.length>45) ? 65 : 36;
    ws.getRow(4).eachCell(cell => {cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE0F0E8'}};cell.font={name:'Tahoma',size:10,bold:true,color:{argb:'FF17513D'}};cell.alignment={wrapText:true,vertical:'middle'};});
    for (const values of rows) {
      const clean = values.map(value => {
        if (typeof value === 'string' && value.length > 32767) throw new Error('ข้อความยาวเกินขีดจำกัดเซลล์ Excel ในชีต ' + name);
        return value === undefined ? null : value;
      });
      const row = ws.addRow(clean);
      row.height = options.rowHeight || 32;
      row.eachCell({includeEmpty:true}, (cell, column) => {
        cell.font={name:'Tahoma',size:10,color:{argb:'FF223E32'}};
        cell.alignment={vertical:'top',wrapText:true};
        if(row.number%2===1) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF4F8F5'}};
        if(cell.value instanceof Date) cell.numFmt = dateFmt;
        else if(typeof cell.value === 'number') cell.numFmt = options.percentColumns?.includes(column) ? '0.0%' : Number.isInteger(cell.value) ? '0' : '0.00';
        if (['สูง','ควรทบทวนเร่งด่วน','ข้อมูลทดสอบ'].includes(cell.value)) {cell.font={...cell.font,bold:true,color:{argb:cell.value==='ข้อมูลทดสอบ'?'FF9C651C':'FFAB2346'}};}
      });
    }
    ws.autoFilter = {from:{row:4,column:1},to:{row:Math.max(4,ws.rowCount),column:headings.length}};
    ws.pageSetup.printTitlesRow = '1:4';
    ws.pageSetup.printArea = `A1:${ws.getColumn(headings.length).letter}${Math.max(4,ws.rowCount)}`;
    ws.headerFooter.oddFooter = '&Lโรงพยาบาลธัญบุรี&C' + name + '&Rหน้า &P / &N';
    return ws;
  }
  const highLatest = latestRows.filter(high).length;
  const highOpen = latestRows.filter(row=>high(row)&&row.clinicalStatus!=='closed').length;
  const pending = screenings.filter(row=>row.clinicalStatus==='new').length;
  const days = row => dayCount(row.submittedAt, data.exportedAt);
  const noRecords = !screenings.length;
  const summaryRows = [
    ['ขอบเขตข้อมูล',scopeLabel,'ประเภทข้อมูล','ข้อมูลจริงและข้อมูลทดสอบระบุแยกทุกชีต'],
    ['ช่วงวันที่คัดกรอง',rangeLabel,'เวลาไทย UTC+7','เว้นวันที่ทั้งสองช่อง = ข้อมูลทั้งหมด; เมื่อเลือกช่วงวันที่ จะรวมเฉพาะเด็กที่มีผลคัดกรองในช่วงนั้น'],
    ['ผู้ส่งออกรายงาน',data.exportedBy?.displayName || '-',label(roleNames,data.exportedBy?.role),'เวลาจัดทำ '+generated+' น.'],
    ['เด็กในขอบเขต',children.length,'คน','นับ childId ไม่ซ้ำ'],
    ['ข้อมูลจริง',report.actualChildren,'คน','ไม่นับเด็กที่กำกับ consentVersion = demo-data'],
    ['ข้อมูลทดสอบ',report.testChildren,'คน',report.testChildren ? 'มีข้อมูลสมมติรวมอยู่ ห้ามตีความยอดรวมนี้เป็นผลดำเนินงานผู้ป่วยจริง' : 'ไม่มีข้อมูลทดสอบในขอบเขต'],
    ['เด็กที่มีผลคัดกรอง',latest.size,'คน','มีผลอย่างน้อย 1 ครั้งในขอบเขต'],
    ['เด็กที่ยังไม่มีผลคัดกรอง',children.length-latest.size,'คน','แสดงได้เมื่อไม่จำกัดช่วงวันที่คัดกรอง'],
    ['แบบคัดกรองทั้งหมด',screenings.length,'ครั้ง','นับทุกรอบการประเมิน จึงอาจมากกว่าจำนวนเด็ก'],
    ['เด็กที่ประเมินมากกว่า 1 ครั้ง',children.filter(child=>screenings.filter(row=>row.childId===child.childId).length>1).length,'คน','นับเฉพาะรอบที่อยู่ในขอบเขตรายงาน'],
    ['คะแนน OSA-18 เฉลี่ย',mean(scores),'คะแนน','ค่าเฉลี่ยทุกผลที่มีคะแนนตัวเลข ไม่ใช่ค่าเฉลี่ยเฉพาะผลล่าสุด'],
    ['ค่ามัธยฐาน OSA-18',report.median,'คะแนน','ค่ากลางของคะแนนที่มีข้อมูล'],
    ['คะแนนต่ำสุด',scores.length?scores[0]:null,'คะแนน','ช่องว่างหมายถึงไม่มีข้อมูล'],
    ['คะแนนสูงสุด',scores.length?scores[scores.length-1]:null,'คะแนน','ช่องว่างหมายถึงไม่มีข้อมูล'],
    ['ผลเสี่ยงสูง / เร่งด่วน',screenings.filter(high).length,'ครั้ง','นับทุกผล ไม่ใช่จำนวนเด็ก'],
    ['เด็กเสี่ยงสูง / เร่งด่วนจากผลล่าสุด',highLatest,'คน','ใช้ผลล่าสุดของแต่ละเด็กภายในขอบเขตรายงาน'],
    ['เด็กเสี่ยงสูง / เร่งด่วนที่ยังไม่ปิดเคส',highOpen,'คน','ผลล่าสุดมีความเสี่ยงสูงหรือเร่งด่วน และ clinicalStatus ไม่ใช่ closed'],
    ['ผลรอทบทวน',pending,'ครั้ง','clinicalStatus = new'],
    ['ผลกำลังทบทวน',screenings.filter(row=>row.clinicalStatus==='reviewing').length,'ครั้ง','clinicalStatus = reviewing'],
    ['เด็กที่ผลล่าสุดยังไม่ปิดเคส',followUp.length,'คน','รวมทุกระดับความเสี่ยง ดูชีตเคสที่ต้องติดตาม'],
    ['เด็กที่ยังไม่ปิดเคสและประเมินมาแล้ว ≥7 วัน',followUp.filter(row=>days(row)>=7).length,'คน','นับเวลาตั้งแต่ประเมิน ไม่ใช่ระยะเวลาตั้งแต่เปลี่ยนสถานะ'],
    ['เด็กที่ยังไม่ปิดเคสและประเมินมาแล้ว ≥30 วัน',followUp.filter(row=>days(row)>=30).length,'คน','เกณฑ์ช่วงเวลานี้ใช้แสดงอายุรายการ ไม่ใช่เกณฑ์เร่งด่วนทางการแพทย์'],
    ['วิดีโอประกอบผลคัดกรอง',videos.length,'ไฟล์','เฉพาะวิดีโอที่สัมพันธ์กับผลในขอบเขต'],
    ['วิดีโอรอเจ้าหน้าที่ / ต้องทบทวนเพิ่ม',videos.filter(video=>['pending-human-review','needs-human-review'].includes(video.reviewStatus)).length,'ไฟล์','ใช้สถานะการทบทวนที่บันทึก'],
    ['รายการตรวจคุณภาพข้อมูล',quality.length,'ประเด็น','เด็กหรือผลเดียวอาจมีมากกว่า 1 ประเด็น'],
    ['บทสรุปสำหรับผู้บริหาร',noRecords ? 'ยังไม่มีผลคัดกรองในขอบเขตที่เลือก' : `มีเด็กที่ได้รับการประเมิน ${latest.size} คน รวม ${screenings.length} ครั้ง คะแนนเฉลี่ย ${mean(scores)===null?'-':mean(scores).toFixed(2)} จาก 126 คะแนน ผลล่าสุดพบเด็กเสี่ยงสูงหรือเร่งด่วน ${highLatest} คน และยังไม่ปิดเคส ${highOpen} คนในกลุ่มดังกล่าว`,'สรุปจากข้อมูลที่บันทึก','ไม่ใช่การวินิจฉัยโรคหรือข้อแนะนำการรักษาใหม่'],
    ['ประเด็นสำหรับติดตามงาน',`มีผลรอทบทวน ${pending} ครั้ง และวิดีโอรอเจ้าหน้าที่/ต้องทบทวนเพิ่มเติม ${videos.filter(video=>['pending-human-review','needs-human-review'].includes(video.reviewStatus)).length} ไฟล์`,'ภาระงาน','ใช้ชีตผลคัดกรองทั้งหมดและวิดีโอเพื่อตรวจรายการ'],
    ['ข้อจำกัดการตีความ','ผลล่าสุดหมายถึงล่าสุดภายในช่วงวันที่ที่เลือก สถานะเคสเป็นสถานะปัจจุบัน ไม่ใช่สถานะย้อนหลัง ณ วันประเมิน','หมายเหตุ','ข้อมูลประชากรเป็นทะเบียนปัจจุบัน; ผลคัดกรองหลายครั้งของเด็กคนเดียวต้องไม่นับเป็นหลายคน']
  ];
  const executive = sheet('สรุปผู้บริหาร',['หัวข้อ','ผลสรุป','หน่วยหรือประเภท','นิยามและรายละเอียด'],summaryRows,{summary:true,widths:[45,70,24,95],rowHeight:44});
  for(const index of [25,26,27]) executive.getRow(index+5).height=82;
  const riskRows = [...Object.keys(riskNames),'other'].map(key=> {
    const match = row => key==='other' ? !riskNames[row.riskLevel] : row.riskLevel===key;
    const count=screenings.filter(match).length, people=latestRows.filter(match).length;
    return [key==='other'?'ไม่มีข้อมูล / อื่น ๆ':riskNames[key],count,percent(count,screenings.length),people,percent(people,latestRows.length)];
  });
  sheet('สรุปความเสี่ยง',['ระดับความเสี่ยง','ผลคัดกรอง (ครั้ง)','สัดส่วนผลคัดกรอง','เด็กจากผลล่าสุด (คน)','สัดส่วนเด็กที่มีผล'],riskRows,{percentColumns:[3,5],description:'แยกจำนวนผลคัดกรองกับเด็กไม่ซ้ำ'});
  sheet('สรุปสถานะ',['สถานะปัจจุบัน','ผลคัดกรอง (ครั้ง)','สัดส่วนผลคัดกรอง','เด็กจากผลล่าสุด (คน)'],[...Object.keys(statusNames),'other'].map(key=>{const match=row=>key==='other'?!statusNames[row.clinicalStatus]:row.clinicalStatus===key;const count=screenings.filter(match).length;return [key==='other'?'ไม่มีข้อมูล / อื่น ๆ':statusNames[key],count,percent(count,screenings.length),latestRows.filter(match).length];}),{percentColumns:[3]});
  sheet('แนวโน้มรายเดือน',['เดือน ค.ศ. (เวลาไทย)','เด็กที่ประเมิน (คน)','ผลคัดกรอง (ครั้ง)','คะแนนเฉลี่ย','เสี่ยงสูง / เร่งด่วน (ครั้ง)','สัดส่วนผลเสี่ยงสูง','ผลที่ยังรอทบทวน (ครั้ง)'],[...months].sort(([a],[b])=>a.localeCompare(b)).map(([month,rows])=>[month,new Set(rows.map(row=>row.childId)).size,rows.length,mean(rows.map(row=>numeric(row.osa18Total)).filter(value=>value!==null)),rows.filter(high).length,percent(rows.filter(high).length,rows.length),rows.filter(row=>row.clinicalStatus==='new').length]),{percentColumns:[6],note:notes+' | แสดงเฉพาะเดือนที่มีรายการ; จำนวนเด็กรายเดือนห้ามบวกเป็นจำนวนเด็กไม่ซ้ำทั้งช่วง'});
  const demographics=[];
  for(const [key,name] of [['male','ชาย'],['female','หญิง'],['other','อื่น ๆ']]) demographics.push(['เพศ',name,children.filter(child=>child.sex===key).length]);
  demographics.push(['เพศ','ไม่มีข้อมูล / ไม่อยู่ในรายการ',children.filter(child=>!['male','female','other'].includes(child.sex)).length]);
  for(const [name,test] of [['ต่ำกว่า 3 ปี',age=>age>=0&&age<3],['3–5 ปี',age=>age>=3&&age<6],['6–11 ปี',age=>age>=6&&age<12],['12–17 ปี',age=>age>=12&&age<18],['18 ปีขึ้นไป',age=>age>=18]]) demographics.push(['อายุในทะเบียน',name,children.filter(child=>validNumber(child.ageYears)&&test(Number(child.ageYears))).length]);
  demographics.push(['อายุในทะเบียน','ไม่มีข้อมูล / ติดลบ',children.filter(child=>!validNumber(child.ageYears)||Number(child.ageYears)<0).length]);
  sheet('ประชากรเด็ก',['หมวด','กลุ่ม','จำนวนเด็ก (คน)','สัดส่วนเด็กในขอบเขต'],demographics.map(row=>[...row,percent(row[2],children.length)]),{percentColumns:[4],note:notes+' | อายุเป็นค่าที่บันทึกในทะเบียน ไม่ใช่อายุ ณ วันที่ประเมินแต่ละครั้ง'});
  const answerSummary=[];
  for(const [section,items,field] of [['สัญญาณสำคัญ',schema.coreQuestions,'coreAnswers'],['ปัจจัยเสี่ยง',schema.riskFactors,'riskFactors']]) for(const item of items) {const values=screenings.map(row=>answer(row[field]?.[item.key]));const n=values.filter(value=>value!==null).length;const yes=values.filter(value=>value===true).length;answerSummary.push([section,item.key,item.label,n,values.length-n,yes,percent(yes,n),null]);}
  for(const item of schema.osa18Items) {const values=screenings.map(row=>osaNumber(row.osa18Answers?.[item.key]));const valid=values.filter(value=>value!==null);answerSummary.push(['OSA-18',item.key,item.label,valid.length,values.length-valid.length,null,null,mean(valid)]);}
  sheet('สรุปคำตอบและปัจจัย',['หมวด','รหัสข้อ','คำถาม','ตอบครบ (ครั้ง)','ไม่มีคำตอบ (ครั้ง)','ตอบมีหรือใช่ (ครั้ง)','สัดส่วนมีหรือใช่ในผู้ตอบ','คะแนนเฉลี่ย OSA-18 (1–7)'],answerSummary,{percentColumns:[7],widths:[22,32,70,20,22,24,28,30],rowHeight:48});
  const childBase = id => {const child=byChild.get(id)||{};return [id,child.childCode||'',child.childName||child.nickname||'',dataType(child)];};
  sheet('ข้อมูลเด็ก',['Child ID','รหัสเด็ก','ชื่อเด็ก','ประเภทข้อมูล','ชื่อเล่น','เพศ','วันเกิด ค.ศ.','อายุในทะเบียน (ปี)','น้ำหนัก (กก.)','ส่วนสูง (ซม.)','BMI ที่บันทึก','ขนาดทอนซิล','ผลอะดีนอยด์','มีเลขระบุตัวเด็กในระบบ','โรคร่วมที่บันทึก','หมายเหตุ','วันที่ลงทะเบียน (เวลาไทย)','ปรับปรุงล่าสุด (เวลาไทย)','จำนวนผลในขอบเขต','คะแนนจากผลล่าสุด','ความเสี่ยงจากผลล่าสุด','สถานะจากผลล่าสุด'],children.map(child=>{const last=latest.get(child.childId);return [...childBase(child.childId),child.nickname||'',label({male:'ชาย',female:'หญิง',other:'อื่น ๆ'},child.sex),child.birthDate||'',numeric(child.ageYears),numeric(child.weightKg),numeric(child.heightCm),numeric(child.bmi),child.tonsilSize||'',label({normal:'ปกติ',enlarged:'โต / สงสัยโต','not-done':'ยังไม่ได้ตรวจ'},child.adenoidXrayResult),child.childCidNumber?'มี':'ไม่มี',JSON.stringify(child.comorbidities||{}),child.notes||'',date(child.createdAt),date(child.updatedAt),screenings.filter(row=>row.childId===child.childId).length,numeric(last?.osa18Total),last?label(riskNames,last.riskLevel):'ยังไม่มีผล',last?label(statusNames,last.clinicalStatus):'ยังไม่มีผล'];}));
  const screeningHead=['Screening ID','Child ID','รหัสเด็ก','ชื่อเด็ก','ประเภทข้อมูล','วันที่ประเมิน (เวลาไทย)','OSA-18 รวม (18–126)','กลุ่มคะแนน','ความเสี่ยง','สถานะปัจจุบัน','คำแนะนำที่บันทึก','บันทึกผู้ทบทวน','สัญญาณสำคัญที่ตอบใช่ (ข้อ)','ปัจจัยเสี่ยงที่ตอบใช่ (ข้อ)','จำนวนวิดีโอ','วันนับจากวันที่ประเมิน'];
  sheet('ผลคัดกรองทั้งหมด',screeningHead,report.ordered.map(row=>[row.screeningId,...childBase(row.childId),date(row.submittedAt),numeric(row.osa18Total),groupName(row.osa18Group),label(riskNames,row.riskLevel),label(statusNames,row.clinicalStatus),row.recommendation||'',row.reviewerNotes||'',schema.coreQuestions.filter(item=>answer(row.coreAnswers?.[item.key])===true).length,schema.riskFactors.filter(item=>answer(row.riskFactors?.[item.key])===true).length,videos.filter(video=>video.screeningId===row.screeningId).length,days(row)]),{widths:[38,38,20,32,22,25,24,24,28,28,90,70],rowHeight:65});
  const questionCols=[...schema.coreQuestions.map((item,i)=>`สัญญาณ ${i+1}: ${item.label}`),...schema.riskFactors.map((item,i)=>`ปัจจัย ${i+1}: ${item.label}`),...schema.osa18Items.map((item,i)=>`OSA ${i+1}: ${item.label}`)];
  sheet('คำตอบรายข้อ',['Screening ID','รหัสเด็ก','ชื่อเด็ก','ประเภทข้อมูล','วันที่ประเมิน (เวลาไทย)',...questionCols],report.ordered.map(row=>[row.screeningId,byChild.get(row.childId)?.childCode||'',byChild.get(row.childId)?.childName||byChild.get(row.childId)?.nickname||'',dataType(byChild.get(row.childId)),date(row.submittedAt),...schema.coreQuestions.map(item=>answerText(row.coreAnswers?.[item.key])),...schema.riskFactors.map(item=>answerText(row.riskFactors?.[item.key])),...schema.osa18Items.map(item=>osaNumber(row.osa18Answers?.[item.key]))]),{rowHeight:32});
  sheet('เคสที่ต้องติดตาม',['Screening ID ล่าสุด','รหัสเด็ก','ชื่อเด็ก','ประเภทข้อมูล','วันที่ประเมิน (เวลาไทย)','วันที่ผ่านไป','ความเสี่ยง','OSA-18','สถานะปัจจุบัน','คำแนะนำเดิม','บันทึกผู้ทบทวน'],followUp.map(row=>[row.screeningId,byChild.get(row.childId)?.childCode||'',byChild.get(row.childId)?.childName||byChild.get(row.childId)?.nickname||'',dataType(byChild.get(row.childId)),date(row.submittedAt),days(row),label(riskNames,row.riskLevel),numeric(row.osa18Total),label(statusNames,row.clinicalStatus),row.recommendation||'',row.reviewerNotes||'']),{rowHeight:65,widths:[38,20,32,22,25,18,28,18,28,90,70],note:notes+' | ผลล่าสุดของแต่ละเด็กที่ยังไม่ปิดเคส เรียงความเสี่ยงแล้ววันที่เก่าไปใหม่ ไม่ใช่รายการนัดหมาย'});
  sheet('วิดีโอ',['Video ID','Screening ID','รหัสเด็ก','ชื่อเด็ก','ประเภทข้อมูล','ชื่อไฟล์','ชนิดไฟล์','ขนาด (ไบต์)','อัปโหลดเมื่อ (เวลาไทย)','สถานะอัปโหลด','สถานะทบทวน','บันทึกผู้ทบทวน','ปรับปรุงล่าสุด (เวลาไทย)'],videos.map(video=>[video.videoId,video.screeningId,byChild.get(video.childId)?.childCode||'',byChild.get(video.childId)?.childName||'',dataType(byChild.get(video.childId)),video.fileName,video.mimeType,numeric(video.sizeBytes),date(video.uploadedAt),label(videoNames,video.uploadStatus),label(videoNames,video.reviewStatus),video.reviewerNotes||'',date(video.updatedAt)]),{rowHeight:44});
  if (data.adminSections) sheet('ผู้ใช้',['User ID','ชื่อแสดงผล','อีเมล','บทบาท','สถานะ','สร้างบัญชี (เวลาไทย)','เข้าระบบล่าสุดที่บันทึก (เวลาไทย)'],(data.users||[]).map(user=>[user.userId,user.displayName||'',user.email||'',label(roleNames,user.role),label({active:'ใช้งานได้',disabled:'ระงับใช้งาน'},user.status),date(user.createdAt),date(user.lastLoginAt)]),{note:'บัญชีผู้ใช้ทั้งหมด ณ เวลาส่งออก ไม่จำกัดด้วยช่วงวันที่คัดกรอง; ไม่รวมรหัสผ่านหรือโทเคน'});
  if (data.adminSections && data.filters?.includeAudit) sheet('บันทึกกิจกรรม',['Log ID','เวลา (เวลาไทย)','ผู้กระทำ (User ID)','กิจกรรม','ประเภทเป้าหมาย','รหัสเป้าหมาย'],(data.auditLogs||[]).map(log=>[log.logId,date(log.createdAt),log.actorUserId,log.action,log.targetType,log.targetId]),{note:notes+' | กรองตามเวลาทำกิจกรรม ไม่กรองประเภทข้อมูลจริง/ทดสอบ และไม่รวมกิจกรรมส่งออกครั้งนี้'});
  sheet('คุณภาพข้อมูล',['ประเภทข้อมูล','รหัสรายการ','รหัสเด็ก','ประเด็นที่ควรตรวจสอบ','ประเภทจริงหรือทดสอบ'],quality,{widths:[24,38,25,95,24],rowHeight:44});
  const definitions = [
    ['ขอบเขต',scopeLabel],['ช่วงวันที่',rangeLabel],['เวลาที่ใช้','เวลาประเทศไทย UTC+7; เซลล์วันที่และปีในรายงานใช้ ค.ศ.'],
    ['เด็ก','จำนวน Child ID ไม่ซ้ำในขอบเขต; ไม่เลือกวันที่รวมเด็กที่ยังไม่มีแบบคัดกรองด้วย'],['จำนวนการประเมิน','นับ Screening ID ทุกครั้ง แยกจากจำนวนเด็ก'],['ผลล่าสุด','ล่าสุดภายในช่วงวันที่ที่เลือก ไม่ใช่ล่าสุดนอกช่วงรายงาน'],
    ['ความเสี่ยง','ใช้ค่าความเสี่ยงที่ระบบบันทึก ไม่คำนวณเปลี่ยนเกณฑ์จากการส่งออก'],['กลุ่มคะแนน OSA-18','แสดงกลุ่มที่บันทึก: ต่ำ <60, ปานกลาง 60–80, สูง >80; คะแนนรวมเต็ม 126'],['คำตอบไม่มีข้อมูล','ไม่แทนค่าว่างด้วย 0 หรือไม่ใช่; ค่าเฉลี่ยใช้เฉพาะคำตอบตัวเลขที่ใช้ได้'],['สัดส่วนความเสี่ยง','จำนวนผลระดับนั้น / ผลทั้งหมด; สัดส่วนเด็ก = เด็กจากผลล่าสุดระดับนั้น / เด็กที่มีผล'],
    ['สัดส่วนสัญญาณ/ปัจจัย','จำนวนคำตอบมีหรือใช่ / จำนวนที่ตอบข้อนั้น; แยกจำนวนไม่มีคำตอบ'],['สถานะเคส','สถานะปัจจุบัน ณ เวลาส่งออก ไม่ใช่สถานะย้อนหลัง ณ วันประเมิน'],['เคสที่ต้องติดตาม','ผลล่าสุดที่สถานะไม่ใช่ closed; อายุรายการนับจากวันประเมิน ไม่ใช่วันเปลี่ยนสถานะ'],['คะแนนเฉลี่ย/มัธยฐาน','คำนวณจากผลคัดกรองทุกครั้งที่มีคะแนนตัวเลขในขอบเขต'],['ข้อมูลประชากร','ใช้ทะเบียนปัจจุบัน โดยอายุ น้ำหนัก ส่วนสูง และ BMI อาจไม่ใช่ค่าขณะคัดกรองย้อนหลัง'],['ข้อมูลทดสอบ','กำกับจาก consentVersion = demo-data; แยกประเภทในชีตรายละเอียดและนับในสรุป'],['ผู้ใช้','แสดงเฉพาะผู้ดูแลระบบ และเป็นทุกบัญชี ณ เวลาส่งออก'],['กิจกรรม','แสดงเฉพาะผู้ดูแลระบบเมื่อเลือก; กรองด้วยวันที่กิจกรรม และไม่กรองด้วยประเภทเด็ก'],['ข้อมูลที่ไม่นำออก','รหัสผ่าน โทเคน session, secret key, เลขบัตรประชาชนจริง และ URL วิดีโอที่ให้สิทธิ์เข้าถึง'],['แหล่งข้อมูล','Supabase; ดึงทุกรายการด้วยการอ่านเป็นหน้า ไม่จำกัดตาม 100 รายการล่าสุดบน Dashboard'],['ไฟล์','Excel .xlsx มีตัวกรองและตรึงหัวตาราง; ข้อความจากผู้ใช้เก็บเป็นข้อความ ไม่ใช่สูตร Excel'],['การตีความ','เป็นรายงานข้อมูลคัดกรองเพื่อการติดตามงาน ไม่ใช่การยืนยันการวินิจฉัย'],['ผลการตรวจคุณภาพ',quality.length?'พบ '+quality.length+' ประเด็น ดูชีตคุณภาพข้อมูล':'ไม่พบประเด็นตามรายการตรวจอัตโนมัติที่กำหนด'],
    ...sheets.map(([name,description,count])=>['ชีต: '+name,description+' | จำนวนแถวข้อมูล '+count])
  ];
  sheet('นิยามและสารบัญ',['รายการ','รายละเอียด'],definitions,{widths:[42,135],rowHeight:38,summary:true});
  return workbook;
}
