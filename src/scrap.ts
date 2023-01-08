import playwright from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pSeries from "p-series";

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

const expandSkills = async (locator: playwright.Locator) => {
  const name = await (
    await locator.locator("css=.name").nth(1).allInnerTexts()
  ).join();
  const skillType = (
    await locator.locator("css=.skill-type").first().allInnerTexts()
  ).join();

  const content = (
    await locator
      .locator("css=.skill-content")
      .locator("css=.skill-description")
      .allInnerTexts()
  ).join();

  const upgrades = (
    await locator
      .locator("css=.skill-content")
      .locator("css=p:not(:first-child)")
      .allInnerTexts()
  ).join(" ");

  return { name, skillType, content, upgrades };
};

const extractFromCharPage = async (page: playwright.Page) => {
  const headerP = await page
    .locator("css=.content.es>.character-header.ag")
    .allInnerTexts();
  const infoListP = await page.locator("css=.content.es>.info-list");
  const skillsP = await page
    .locator("css=.content.es>.skills")
    .locator("css=.skill-box");

  const skills = await Promise.all((await skillsP.all()).map(expandSkills));

  const combatInfoRaw = (
    await infoListP.first().locator("css=.info-list-row").allInnerTexts()
  ).map((line: string) => line.split("\n"));

  const combatInfo = (() => {
    const obj = Object.fromEntries(combatInfoRaw);
    return {
      name: obj["Name"],
      alias: obj["Alias"],
      rarity: obj["Rarity"],
      type: obj["Type"],
      class: obj["Class"],
      gearType: obj["Gear type"],
    };
  })();

  return { ...combatInfo, skills };
};

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();

  const charPages = String(
    fs.readFileSync(path.join(__dirname, "../chars.txt"))
  )
    .split("\n")
    .filter((v) => v)
    .map((name) => `http://localhost:8080/${name}.html`);

  const values = charPages.map((pageAddress) => {
    return async () => {
      console.log("pageadd", pageAddress);
      await page.goto(pageAddress);
      return await extractFromCharPage(page);
    };
  });

  const res = await pSeries(values);
  await browser.close();

  const ws = fs.createWriteStream(path.join(__dirname, "../outs/chars.json"));
  ws.write(JSON.stringify(res));
  console.log("Save");
})();
