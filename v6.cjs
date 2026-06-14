const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://localhost:5174/hepburn-converter');
  await page.waitForTimeout(2000);

  // 初期状態
  await page.screenshot({ path: 'v6_01_initial.png', fullPage: false, clip: { x: 0, y: 200, width: 1280, height: 420 } });

  // 形態素解析チェックボックスの確認
  const checkboxes = await page.$$('input[type="checkbox"]');
  console.log('checkbox count:', checkboxes.length); // expect 2: useParser, pascalSpaces
  const useParserChecked = await checkboxes[0].isChecked();
  const spacesChecked = await checkboxes[1].isChecked();
  const spacesDisabled = await checkboxes[1].isDisabled();
  console.log('useParser checked:', useParserChecked); // expect true
  console.log('pascalSpaces disabled:', spacesDisabled); // expect false (useParser=true)

  // 形態素解析オフ → 単語区切りが非活性になるか
  await checkboxes[0].click();
  await page.waitForTimeout(200);
  const spacesDisabledAfter = await checkboxes[1].isDisabled();
  console.log('pascalSpaces disabled after uncheck:', spacesDisabledAfter); // expect true

  await page.screenshot({ path: 'v6_02_noparser.png', fullPage: false, clip: { x: 0, y: 200, width: 1280, height: 420 } });

  // 形態素解析オフで変換できるか
  await page.waitForFunction(() => {
    const btns = [...document.querySelectorAll('button.bg-blue-600')];
    return btns.length > 0 && !btns[0].disabled;
  }, { timeout: 5000 });
  const textarea = page.locator('textarea').first();
  await textarea.fill('にほんご');
  await page.waitForTimeout(600);
  const outputNoParser = await page.$$eval('textarea', els => els.map(e => e.value));
  console.log('output without parser:', outputNoParser[1]); // expect simple convert (no segmentation)

  // 形態素解析オン → 単語区切りが再び有効になるか
  await checkboxes[0].click();
  await page.waitForTimeout(600);
  const spacesEnabledAgain = !(await checkboxes[1].isDisabled());
  console.log('pascalSpaces enabled again:', spacesEnabledAgain); // expect true
  const outputWithParser = await page.$$eval('textarea', els => els.map(e => e.value));
  console.log('output with parser:', outputWithParser[1]); // expect segmented

  await page.screenshot({ path: 'v6_03_withparser.png', fullPage: false, clip: { x: 0, y: 200, width: 1280, height: 420 } });
  await browser.close();
})();
