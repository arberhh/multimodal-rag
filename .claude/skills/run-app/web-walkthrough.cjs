// Drives the web app as one user, the way a person would: home, documents, chats, reopening a chat,
// a follow-up question and New chat. Saves a screenshot of each step and prints every console
// error and failed API call.
//
// node web-walkthrough.cjs <device id> <screenshot dir>
// The device id must already have a ready document and a chat: make them with the API first.
const { chromium } = require("playwright");

const [device, out] = process.argv.slice(2);
const app = "http://localhost:8081";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const problems = [];
  page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
  page.on("pageerror", (e) => problems.push(String(e)));
  page.on("response", (r) => {
    if (r.url().includes(":3000") && r.status() >= 400) problems.push(`${r.status()} ${r.url()}`);
  });
  // One.Storage keeps its values in localStorage under this prefix
  await page.addInitScript((id) => localStorage.setItem("One.Storage.device-id", id), device);

  let failed = false;
  const step = async (name, run) => {
    try {
      await run();
      await page.waitForTimeout(800);
      console.log("ok  ", name);
    } catch (err) {
      failed = true;
      console.log("FAIL", name, err.message.split("\n")[0]);
    }
    await page.screenshot({ path: `${out}/${name}.png` });
  };
  const visit = (path) => page.goto(app + path, { waitUntil: "networkidle" });

  await step("1-home", async () => {
    await visit("/");
    await page.getByText("Recent chats").waitFor({ timeout: 15000 });
  });
  await step("2-documents", async () => {
    await visit("/documents");
    await page.getByText("Ready").first().waitFor();
  });
  await step("3-chats", async () => {
    await visit("/conversations");
    await page
      .getByLabel(/^Remove /)
      .first()
      .waitFor();
  });
  await step("4-reopened-chat", async () => {
    // each row's Remove button is labelled with the chat's title
    const label = await page
      .getByLabel(/^Remove /)
      .first()
      .getAttribute("aria-label");
    await page
      .getByText(label.replace(/^Remove /, ""), { exact: true })
      .first()
      .click();
    await page.getByLabel("Copy answer").first().waitFor({ timeout: 15000 });
  });
  await step("5-follow-up", async () => {
    const answers = await page.getByLabel("Copy answer").count();
    await page.getByLabel("Question").fill("Summarize that in one sentence.");
    await page.getByLabel("Send").click();
    await page.getByLabel("Copy answer").nth(answers).waitFor({ timeout: 60000 });
  });
  await step("6-new-chat", async () => {
    await page.getByText("New chat").click();
    await page.getByText("Ask about your documents").waitFor();
  });
  // wider than a phone, to see the page centered
  await page.setViewportSize({ width: 1200, height: 900 });
  await step("7-home-wide", () => visit("/"));

  console.log("problems:", problems.length ? problems : "none");
  await browser.close();
  process.exit(failed || problems.length ? 1 : 0);
})();
