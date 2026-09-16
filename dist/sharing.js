import { formatAverage } from './logic.js';

export const SITE_URL = 'https://yorunagi-lab.github.io/sato-triple-crown/';
const TITLE = '佐藤輝明｜三冠王への道';
const date = value => `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))}`;
let current = null, imageURL = null;
export function shareText(data) {
  return `佐藤輝明、三冠王への道。\n打率 ${formatAverage(data.player.avg)} / ${data.player.hr}本塁打 / ${data.player.rbi}打点\n${data.leading_categories}部門で首位（暫定・同率を含む）\n${data.season}年${date(data.data_through)} 最新出場・取得元更新 ${date(data.source_updated_at)} ${data.source_updated_at.slice(11, 16)} JST\n#佐藤輝明 #三冠王への道`;
}
export function updateShareData(data) {
  current = data;
  document.querySelectorAll('[data-share-action]').forEach(button => { button.disabled = false; });
  const preview = document.querySelector('#share-preview');
  preview.hidden = true;
  if (imageURL) { URL.revokeObjectURL(imageURL); imageURL = null; }
}

export async function makeStatCard(data) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('画像を作成できません');
  const font = '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans CJK JP", Meiryo, sans-serif';
  const text = (str, x, y, size, color = '#f5f2e9', weight = 700) => {
    ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${font}`; ctx.fillText(str, x, y);
  };
  ctx.fillStyle = '#121411'; ctx.fillRect(0, 0, 1200, 630);
  ctx.fillStyle = '#f5cf60'; ctx.fillRect(0, 0, 1200, 9);
  ctx.strokeStyle = '#353a30'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(1130, 100, 185, 0, Math.PI * 2); ctx.stroke();
  text('8', 1020, 246, 250, '#22271d', 900);
  text(`${data.season} CENTRAL LEAGUE / THE TRIPLE CROWN CHASE`, 62, 60, 17, '#f5cf60');
  text('佐藤輝明、三冠王への道。', 58, 145, 52);
  text(`最新出場 ${data.season}.${data.data_through.slice(5).replace('-', '.')}   /   ${data.leading_categories}部門で首位〈暫定・同率を含む〉`, 62, 199, 22, '#abb09f', 400);
  const metrics = [['打率', formatAverage(data.player.avg), 'AVG'], ['本塁打', String(data.player.hr), 'HR'], ['打点', String(data.player.rbi), 'RBI']];
  metrics.forEach(([label, value, english], i) => {
    const x = 60 + i * 365;
    ctx.fillStyle = i === 0 ? '#f5cf60' : '#1c1f19'; ctx.fillRect(x, 242, 350, 207);
    const ink = i === 0 ? '#22291c' : '#f5f2e9';
    text(`${label} / ${english}`, x + 23, 282, 20, ink);
    text(value, x + 20, 395, 87, ink, 900);
  });
  text(`取得元更新 ${date(data.source_updated_at)} ${data.source_updated_at.slice(11, 16)} JST   ·   阪神の残り ${data.player.team_remaining} 試合`, 62, 495, 21, '#abb09f', 400);
  ctx.strokeStyle = '#353a30'; ctx.beginPath(); ctx.moveTo(60, 525); ctx.lineTo(1140, 525); ctx.stroke();
  text('yorunagi-lab.github.io/sato-triple-crown/', 62, 562, 20, '#f5cf60', 400);
  text('非公式ファンサイト  /  成績データ：baseballdata.jp', 62, 600, 17, '#abb09f', 400);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG変換に失敗しました')), 'image/png'));
}

export function initSharing() {
  const share = document.querySelector('#share-button'), save = document.querySelector('#save-card-button');
  const status = document.querySelector('#share-status'), fallback = document.querySelector('#share-copy');
  share.addEventListener('click', async () => {
    if (!current) return;
    const text = shareText(current), payload = { title: TITLE, text, url: SITE_URL };
    fallback.hidden = true;
    // Invoke native share directly within the tap's activation window.
    if (navigator.share) {
      try { await navigator.share(payload); status.textContent = '共有の操作を終えました。'; return; }
      catch (error) { if (error.name === 'AbortError') { status.textContent = '共有をキャンセルしました。'; return; } }
    }
    try { await navigator.clipboard.writeText(`${text}\n${SITE_URL}`); status.textContent = '成績とサイトURLをコピーしました。SNSに貼り付けて共有できます。'; }
    catch {
      fallback.hidden = false; fallback.value = `${text}\n${SITE_URL}`; fallback.focus(); fallback.select();
      status.textContent = '下の文章を長押しでコピーして共有できます。';
    }
  });
  save.addEventListener('click', async () => {
    if (!current) return;
    const snapshot = current;
    save.disabled = true; status.textContent = '成績画像を作っています…';
    try {
      const blob = await makeStatCard(snapshot);
      if (imageURL) URL.revokeObjectURL(imageURL);
      imageURL = URL.createObjectURL(blob);
      const preview = document.querySelector('#share-preview'), image = preview.querySelector('img'), link = preview.querySelector('a');
      image.src = imageURL; image.alt = `${snapshot.season}年${date(snapshot.data_through)}最新出場。打率${formatAverage(snapshot.player.avg)}、${snapshot.player.hr}本塁打、${snapshot.player.rbi}打点。`;
      link.href = imageURL; link.download = `sato-triple-crown-${snapshot.data_through}.png`;
      preview.hidden = false; link.click();
      status.textContent = '保存用画像を作成しました。保存が始まらない場合は、下の画像を長押しするか保存リンクを使ってください。';
    } catch { status.textContent = '画像を作成できませんでした。「成績を共有」から文章とURLを共有できます。'; }
    finally { save.disabled = false; }
  });
}
