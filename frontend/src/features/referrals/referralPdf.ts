import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { platformTitle } from '../../shared/branding';

export type ReferralDoc = {
  id: number; reg_number: number | null; course_title: string; study_number: string; sender: string; auto_sent: boolean;
  test_date: string | null; passed: boolean; grade: number | null; correct_answers: number | null; total: number | null;
  issued_at: string; valid_months: number; exam_deadline: string;
};

// A4 72 dpi боюнча: 210 × 297 мм = 595 × 842 пт.
const A4 = { width: 595, height: 842 };
const pad = (v: number) => String(v).padStart(2, '0');
export const formatDay = (iso: string | null) => { if (!iso) return '—'; const d = new Date(iso); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; };
export const regLabel = (n: number | null) => n == null ? '—' : `№ ${n}`;
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

let logoCache: string | null = null;
async function logoDataUri() {
  if (logoCache !== null) return logoCache;
  try {
    const asset = await Asset.fromModule(require('../../../assets/Kyrgyzstan_Border_Service.svg.webp')).downloadAsync();
    logoCache = asset.localUri ? `data:image/webp;base64,${await new File(asset.localUri).base64()}` : '';
  } catch { logoCache = ''; }
  return logoCache;
}

/** A4 барагына ылайыкталган электрондук жолдомо. */
export function referralHtml(r: ReferralDoc, logo: string) {
  const result = r.passed ? 'ӨТТҮ' : 'ӨТПӨДҮ';
  const rows: [string, string][] = [
    ['Окуу номери', r.study_number],
    ['Курс', r.course_title],
    ['Тест тапшырган күнү', formatDay(r.test_date)],
    ...(r.total != null ? [['Туура жооптор / баасы', `${r.correct_answers} / ${r.total} · ${r.grade}`] as [string, string]] : []),
    ['Жолдомо берилген күнү', formatDay(r.issued_at)],
    ['Жолдомонун жарактуу мөөнөтү', `${r.valid_months} ай`],
    ['Практикалык экзамен тапшыруунун акыркы күнү', formatDay(r.exam_deadline)],
  ];
  return `<!doctype html><html lang="ky"><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; color: #1c2a22; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; height: 297mm; padding: 16mm 18mm; position: relative; display: flex; flex-direction: column; }
  .frame { position: absolute; inset: 9mm; border: 1.6mm double #193f31; border-radius: 3mm; pointer-events: none; }
  .head { display: flex; align-items: center; gap: 6mm; padding-bottom: 6mm; border-bottom: 0.6mm solid #193f31; }
  .head img { width: 24mm; height: 27mm; object-fit: contain; }
  .org { font-size: 9.5pt; line-height: 1.45; color: #39533e; text-transform: uppercase; letter-spacing: .2pt; }
  .title { text-align: center; margin: 12mm 0 2mm; font-size: 24pt; font-weight: 900; letter-spacing: 3pt; color: #193f31; }
  .reg { text-align: center; font-size: 15pt; font-weight: 800; color: #806c32; letter-spacing: 1pt; }
  .result { margin: 10mm auto 8mm; width: 120mm; padding: 6mm 0; text-align: center; border-radius: 4mm; border: 1.2mm solid; }
  .result .label { font-size: 10pt; letter-spacing: 1.5pt; text-transform: uppercase; }
  .result .value { font-size: 40pt; font-weight: 900; letter-spacing: 6pt; line-height: 1.15; }
  .ok { color: #1e6b43; border-color: #1e6b43; background: #e6f4ec; }
  .bad { color: #a04435; border-color: #a04435; background: #fbefed; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5pt; }
  td { padding: 4.2mm 2mm; border-bottom: 0.3mm dashed #c9c2a8; vertical-align: top; }
  td.k { color: #5f705b; width: 58%; }
  td.v { font-weight: 800; color: #193f31; text-align: right; }
  .foot { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10pt; color: #5f705b; }
  .sign { width: 70mm; border-top: 0.3mm solid #5f705b; padding-top: 2mm; text-align: center; }
  .stamp { width: 36mm; height: 36mm; border-radius: 50%; border: 1mm solid; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: 900; font-size: 11pt; transform: rotate(-12deg); opacity: .85; }
</style></head><body><div class="page">
  <div class="frame"></div>
  <div class="head">${logo ? `<img src="${logo}" />` : ''}<div class="org">${esc(platformTitle)}</div></div>
  <div class="title">ЭЛЕКТРОНДУК ЖОЛДОМО</div>
  <div class="reg">Каттоо номери: ${esc(regLabel(r.reg_number))}</div>
  <div class="result ${r.passed ? 'ok' : 'bad'}"><div class="label">Тесттин жыйынтыгы</div><div class="value">${result}</div></div>
  <table>${rows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join('')}</table>
  <div class="foot">
    <div>${r.auto_sent ? 'Жолдомо автоматтык түрдө берилди.' : r.sender ? `Жолдомо берген: ${esc(r.sender)}` : ''}<br/>Документ электрондук түрдө түзүлдү: ${formatDay(new Date().toISOString())}</div>
    <div class="stamp ${r.passed ? 'ok' : 'bad'}">${esc(regLabel(r.reg_number))}<br/>${result}</div>
  </div>
</div></body></html>`;
}

/** PDF түзүп, бөлүшүү терезесин ачат (Telegram, почта, AirDrop, «Файлдарга сактоо» ж.б.). */
export async function shareReferralPdf(r: ReferralDoc) {
  const html = referralHtml(r, await logoDataUri());
  const { uri } = await Print.printToFileAsync({ html, ...A4 });
  let shareUri = uri;
  try {
    const named = new File(Paths.cache, `Joldomo-${r.reg_number ?? r.id}-${r.study_number.replace(/[^\w-]+/g, '')}.pdf`);
    if (named.exists) named.delete();
    new File(uri).copy(named);
    shareUri = named.uri;
  } catch { /* түпнуска аты менен бөлүшөбүз */ }
  if (!(await Sharing.isAvailableAsync())) throw new Error('Бул түзмөктө бөлүшүү мүмкүн эмес.');
  await Sharing.shareAsync(shareUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Электрондук жолдомо (PDF)' });
}

/** Түз басып чыгаруу (A4). */
export async function printReferral(r: ReferralDoc) {
  await Print.printAsync({ html: referralHtml(r, await logoDataUri()), ...A4 });
}
