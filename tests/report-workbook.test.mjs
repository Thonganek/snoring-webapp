import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { analyseReport, createReportWorkbook } from '../assets/report-workbook.js';

const items = (prefix,n) => Array.from({length:n},(_,i)=>({key:prefix+i,label:prefix+' ข้อ '+(i+1)}));
const schema = { coreQuestions:items('core',6),riskFactors:items('risk',12),osa18Items:items('osa',18) };
const answers = (items,value) => Object.fromEntries(items.map(item=>[item.key,value]));
function fixture() {
  const base = {childId:'c1',submittedAt:'2026-09-04T17:00:00Z',osa18Total:90,osa18Group:'high',riskLevel:'high',clinicalStatus:'new',coreAnswers:answers(schema.coreQuestions,false),riskFactors:answers(schema.riskFactors,false),osa18Answers:answers(schema.osa18Items,5)};
  return {exportedAt:'2026-09-06T12:00:00Z',exportedBy:{displayName:'Test staff',role:'admin'},filters:{scope:'all',includeAudit:true},schema,adminSections:true,
    children:[{childId:'c1',childCode:'TEST1',childName:'เด็กทดสอบ',isTestData:true,birthDate:'2020-01-01',ageYears:6,weightKg:20,heightCm:110,notes:'=HYPERLINK("https://example.invalid","test")'},{childId:'c2',childCode:'TEST2',childName:'Example',isTestData:false}],
    screenings:[{...base,screeningId:'s1'},{...base,screeningId:'s2',submittedAt:'2026-09-05T17:00:00Z',clinicalStatus:'closed'},{...base,screeningId:'s3',childId:'c2',riskLevel:'low',osa18Group:'low',osa18Total:36,osa18Answers:answers(schema.osa18Items,2),coreAnswers:{}}],videos:[],users:[],auditLogs:[]};
}
const summaryValue = (ws,key) => {let value; ws.eachRow(row=>{if(row.getCell(1).value===key)value=row.getCell(2).value;});return value;};

test('Excel export round trip: distinct children, latest case, numbers, missing answers and literal text', async () => {
  const data=fixture(), stats=analyseReport(data);
  assert.equal(stats.latest.size,2);
  assert.equal(stats.followUp.length,1);
  assert.equal(stats.median,90);
  const original=await createReportWorkbook(data,ExcelJS);
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(await original.xlsx.writeBuffer());
  assert.equal(wb.worksheets.length,15);
  const executive=wb.getWorksheet('สรุปผู้บริหาร');
  assert.equal(summaryValue(executive,'เด็กในขอบเขต'),2);
  assert.equal(summaryValue(executive,'แบบคัดกรองทั้งหมด'),3);
  assert.equal(summaryValue(executive,'ข้อมูลทดสอบ'),1);
  assert.equal(summaryValue(executive,'เด็กเสี่ยงสูง / เร่งด่วนที่ยังไม่ปิดเคส'),0);
  assert.equal(summaryValue(executive,'คะแนน OSA-18 เฉลี่ย'),72);
  const risk=wb.getWorksheet('สรุปความเสี่ยง');
  assert.equal(risk.getCell('C7').value,2/3);
  assert.equal(risk.getCell('C7').numFmt,'0.0%');
  const detail=wb.getWorksheet('คำตอบรายข้อ');
  assert.equal(detail.columnCount,41);
  assert.equal(detail.rowCount,7);
  assert.equal(detail.getCell('E5').value.toISOString(),'2026-09-06T00:00:00.000Z');
  assert.equal(detail.getCell('AO5').value,5);
  assert.equal(detail.views[0].ySplit,4);
  assert(detail.autoFilter);
  const literal=wb.getWorksheet('ข้อมูลเด็ก').getCell('P5');
  assert.equal(literal.value,data.children[0].notes);
  assert.equal(literal.type,ExcelJS.ValueType.String);
  assert.equal(literal.formula,undefined);
  assert.equal(wb.getWorksheet('สรุปคำตอบและปัจจัย').getCell('E5').value,1);
});

test('empty clinical export has no admin sheets or fabricated averages', async () => {
  const data={...fixture(),children:[],screenings:[],adminSections:false};
  const wb=await createReportWorkbook(data,ExcelJS);
  assert.equal(wb.worksheets.length,13);
  assert.equal(wb.getWorksheet('ผู้ใช้'),undefined);
  assert.equal(wb.getWorksheet('บันทึกกิจกรรม'),undefined);
  assert.equal(summaryValue(wb.getWorksheet('สรุปผู้บริหาร'),'คะแนน OSA-18 เฉลี่ย'),null);
  assert.equal(summaryValue(wb.getWorksheet('สรุปผู้บริหาร'),'เด็กในขอบเขต'),0);
  assert((await wb.xlsx.writeBuffer()).byteLength>10000);
});
