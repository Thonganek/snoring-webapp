import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
export async function readReportAssets() {
  const definitions = [
    ['report-workbook.js', 'assets/report-workbook.js', 'text/javascript; charset=utf-8'],
    ['exceljs.min.js', 'node_modules/exceljs/dist/exceljs.min.js', 'text/javascript; charset=utf-8'],
    ['EXCELJS-LICENSE.txt', 'node_modules/exceljs/LICENSE', 'text/plain; charset=utf-8']
  ];
  return Object.fromEntries(await Promise.all(definitions.map(async ([name, path, type]) => ['/assets/' + name, [await fs.readFile(new URL(path, root), 'utf8'), type]])));
}
export async function writeReportAssets(output) {
  const assets = await readReportAssets();
  const directory = new URL('assets/', output);
  await fs.mkdir(directory, {recursive:true});
  assert((await fs.readdir(directory)).every(name => Object.hasOwn(assets, '/assets/'+name)), 'Unexpected files in public assets');
  for (const [path, [content]] of Object.entries(assets)) await fs.writeFile(new URL(path.slice(1), output), content);
  return assets;
}
