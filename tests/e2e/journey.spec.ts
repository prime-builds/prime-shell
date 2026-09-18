import { browser, $, expect } from "@wdio/globals";

describe("Prime Shell Native Journey", () => {
  it("should present the visible shell and reach ready state", async () => {
    const header = await $("h1");
    await header.waitForDisplayed({ timeout: 15000 });
    const headerText = await header.getText();
    expect(headerText).toContain("Prime Shell Lifecycle & Resilience");

    const statusText = await $("#backend-status-text");
    await statusText.waitForDisplayed({ timeout: 15000 });
    await browser.waitUntil(
      async () => (await statusText.getText()).toLowerCase() === "ready",
      {
        timeout: 15000,
        timeoutMsg: "Backend did not reach Ready state within 15s",
      }
    );
  });

  it("should perform exact Unicode echo roundtrip", async () => {
    const echoInput = await $("#echo-input");
    await echoInput.waitForDisplayed({ timeout: 5000 });

    const expectedText = "Hello — مرحبا — こんにちは 👋";
    await echoInput.setValue(expectedText);

    const echoBtn = await $("#btn-echo");
    await echoBtn.waitForClickable({ timeout: 5000 });
    await echoBtn.click();

    const echoResult = await $("#echo-result");
    await echoResult.waitForDisplayed({ timeout: 10000 });
    await browser.waitUntil(
      async () => (await echoResult.getText()) === expectedText,
      {
        timeout: 10000,
        timeoutMsg: "Echo result did not match expected Unicode text",
      }
    );
    expect(await echoResult.getText()).toBe(expectedText);
  });

  it("should execute count task through start, progress, and Succeeded terminal state", async () => {
    const startBtn = await $("#btn-start-count");
    await startBtn.waitForClickable({ timeout: 5000 });
    await startBtn.click();

    const taskBadge = await $("#task-state-badge");
    await taskBadge.waitForDisplayed({ timeout: 5000 });

    await browser.waitUntil(
      async () => {
        const text = await taskBadge.getText();
        return text === "Succeeded";
      },
      {
        timeout: 15000,
        timeoutMsg: "Count task did not reach Succeeded state",
      }
    );

    const progressText = await $("#progress-text");
    const text = await progressText.getText();
    expect(text).toContain("20 / 20");
  });

  it("should handle safe error path without crashing backend", async () => {
    const oversizedBtn = await $("#btn-trigger-oversized");
    await oversizedBtn.waitForClickable({ timeout: 5000 });
    await oversizedBtn.click();

    const faultError = await $("#fault-error");
    await faultError.waitForDisplayed({ timeout: 10000 });
    const errorText = await faultError.getText();
    expect(errorText).toContain("RESOURCE_EXHAUSTED");

    const statusText = await $("#backend-status-text");
    expect((await statusText.getText()).toLowerCase()).toBe("ready");
  });
});
