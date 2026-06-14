const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5174/hepburn-converter');
  await page.waitForTimeout(2000);

  // スクリーンショット1: 初期状態
  await page.screenshot({ path: 'verify_01_initial.png', fullPage: true });
  console.log('SS1: initial state taken');

  // 設定パネルの確認（アルファベット区画が青背景か）
  const alphabetSection = await page.$('.bg-blue-50');
  console.log('blue-50 section exists:', !!alphabetSection);

  // アルファベット設定の「プリセット非連動」テキスト確認
  const nonLinkedText = await page.textContent('.bg-blue-50 p');
  console.log('alphabet section header:', nonLinkedText);

  // 変換ボタンの矢印確認
  const buttonTexts = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(t => t?.includes('変換')));
  console.log('convert button texts:', buttonTexts);

  // 入力して変換ボタン動作テスト
  const textarea = await page.$('textarea');
  await textarea.fill('にゅうりょく');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'verify_02_input.png', fullPage: true });

  // 変換ボタンクリック（budoux 読み込み待ち）
  await page.waitForSelector('button:not([disabled]):has-text("変換")', { timeout: 5000 });
  await page.click('button:has-text("変換")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'verify_03_after_convert.png', fullPage: true });

  // 出力欄の値確認
  const outputValue = await page.$eval('textarea[readonly]', el => el.value);
  console.log('output after convert:', outputValue);
  const hasUntranslatable = await page.textContent('body');
  console.log('has "変換できない":', hasUntranslatable.includes('変換できない'));

  // 入力欄タイトルの右にメッセージ確認
  const inputLabelArea = await page.$('.flex.flex-wrap.items-center.gap-x-2');
  console.log('input label flex area exists:', !!inputLabelArea);

  // プリセット変更でカスタムになることを確認
  await page.selectOption('select[onchange]', { index: 1 }); // 2番目のselectを試す
  await page.waitForTimeout(200);
  const presetValue = await page.$eval('select', el => el.value);
  console.log('preset after individual change:', presetValue);

  await browser.close();
})();
