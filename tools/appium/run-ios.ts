import { mkdirSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { remote } from "webdriverio";

const appPath = process.env.IOS_APP_PATH;
if (!appPath) {
  console.error("IOS_APP_PATH is required (path to .app bundle).",
    "Build the app and set IOS_APP_PATH before running.");
  process.exit(1);
}

const artifactsDir = resolve(process.cwd(), "appium-artifacts");
mkdirSync(artifactsDir, { recursive: true });

const udid = process.env.IOS_UDID;
const platformVersion = process.env.IOS_PLATFORM_VERSION;

const resolveHostIp = () => {
  const interfaces = networkInterfaces();
  let fallback: string | null = null;
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      if (!fallback) fallback = entry.address;
      if (!entry.address.startsWith("169.254.")) {
        return entry.address;
      }
    }
  }
  return fallback;
};

const hostIp = resolveHostIp();
const apiBase =
  process.env.API_BASE ??
  (process.env.API_BASE_PREFER_HOST && hostIp ? `http://${hostIp}:8787` : "http://127.0.0.1:8787");

const capabilities: Record<string, string | number | boolean | Record<string, unknown>> = {
  platformName: "iOS",
  "appium:automationName": "XCUITest",
  "appium:deviceName": process.env.IOS_DEVICE_NAME ?? "iPhone 12 mini",
  "appium:app": appPath,
  "appium:newCommandTimeout": 120,
  "appium:shouldTerminateApp": true,
  "appium:autoLaunch": true,
  "appium:forceAppLaunch": true,
  "appium:noReset": false,
  "appium:wdaStartupRetries": 2,
  "appium:wdaStartupRetryInterval": 5000,
  "appium:processArguments": {
    args: [],
    env: {
      API_BASE: apiBase
    }
  }
};

const bundleId = "com.example.floorplantracer";

if (udid) {
  capabilities["appium:udid"] = udid;
}

if (platformVersion) {
  capabilities["appium:platformVersion"] = platformVersion;
}

console.log(`Using API_BASE=${apiBase}`);
if (hostIp) {
  console.log(`Detected host IP=${hostIp}`);
}

const driver = await remote({
  hostname: "127.0.0.1",
  port: 4723,
  path: "/",
  logLevel: "error",
  capabilities
});

try {
  const sleep = (ms: number) => new Promise((resolveFn) => setTimeout(resolveFn, ms));
  const ensureAppActive = async () => {
    try {
      const state = await driver.queryAppState(bundleId);
      if (state !== 4) {
        await driver.activateApp(bundleId);
      }
    } catch {
      try {
        await driver.launchApp();
      } catch {
        // Ignore if Appium cannot relaunch the app.
      }
    }
  };
  let step = 0;
  const snap = async (name: string) => {
    step += 1;
    const filename = `${String(step).padStart(2, "0")}-${name}.png`;
    await driver.saveScreenshot(resolve(artifactsDir, filename));
  };
  const tapTool = async (label: string) => {
    const toolId = `tool-${label.toLowerCase()}`;
    const toolButton = await driver.$(`~${toolId}`);
    if (await toolButton.isExisting()) {
      await toolButton.click();
      return true;
    }
    const segmentedButtons = await driver.$$(
      "-ios class chain:**/XCUIElementTypeSegmentedControl/XCUIElementTypeButton"
    );
    const segmentedLabels: string[] = [];
    for (const button of segmentedButtons) {
      const labelValue = await button.getAttribute("label");
      if (typeof labelValue === "string") segmentedLabels.push(labelValue);
      if (labelValue === label) {
        await button.click();
        return true;
      }
    }
    if (segmentedLabels.length > 0) {
      console.log(`Segmented buttons: ${segmentedLabels.join(", ")}`);
    }
    const fallback = await driver.$(`-ios predicate string:type == "XCUIElementTypeButton" AND label == "${label}"`);
    if (await fallback.isExisting()) {
      await fallback.click();
      return true;
    }
    try {
      const allButtons = await driver.$$("-ios class chain:**/XCUIElementTypeButton");
      const labels: string[] = [];
      for (const button of allButtons) {
        const labelValue = await button.getAttribute("label");
        if (typeof labelValue === "string" && labelValue.trim().length > 0) {
          labels.push(labelValue);
        }
      }
      if (labels.length > 0) {
        console.log(`All button labels: ${labels.join(", ")}`);
      }
      const source = await driver.getPageSource();
      await Bun.write(resolve(artifactsDir, `tool-missing-${label.toLowerCase()}.xml`), source);
    } catch {
      // Ignore diagnostics errors.
    }
    return false;
  };

  const title = await driver.$('-ios predicate string:name == "Projects"');
  await title.waitForExist({ timeout: 15000 });
  await snap("launch");

  const nameField = await driver.$("-ios class chain:**/XCUIElementTypeTextField[1]");
  await nameField.waitForExist({ timeout: 10000 });
  await nameField.click();
  await nameField.setValue(`Demo ${new Date().toISOString().slice(11, 19)}`);
  await snap("project-name-entered");

  const createButton = await driver.$('-ios predicate string:name == "Create" AND type == "XCUIElementTypeButton"');
  await createButton.click();
  await sleep(1500);
  try {
    const dismissKeys = ["Return", "Done", "OK"];
    let dismissed = false;
    for (const key of dismissKeys) {
      const keyEl = await driver.$(
        `-ios predicate string:name == "${key}" AND (type == "XCUIElementTypeKey" OR type == "XCUIElementTypeButton")`
      );
      if (await keyEl.isExisting()) {
        await keyEl.click();
        dismissed = true;
        break;
      }
    }
    if (!dismissed) {
      const title = await driver.$('-ios predicate string:name == "Projects"');
      if (await title.isExisting()) {
        await title.click();
      } else {
        await driver.performActions([
          {
            type: "pointer",
            id: "finger-dismiss",
            parameters: { pointerType: "touch" },
            actions: [
              { type: "pointerMove", duration: 0, x: 20, y: 120 },
              { type: "pointerDown", button: 0 },
              { type: "pointerUp", button: 0 }
            ]
          }
        ]);
        await driver.releaseActions();
      }
    }
  } catch {
    // Ignore if we cannot dismiss keyboard via title tap.
  }
  await snap("project-created");

  const projectCellButton = await driver.$(
    '-ios predicate string:type == "XCUIElementTypeButton" AND label CONTAINS "Updated"'
  );
  try {
    await projectCellButton.waitForExist({ timeout: 10000 });
    await projectCellButton.click();
  } catch {
    const source = await driver.getPageSource();
    await Bun.write(resolve(artifactsDir, "project-cell-missing.xml"), source);
    const firstProject = await driver.$("-ios class chain:**/XCUIElementTypeCell[1]");
    await firstProject.waitForExist({ timeout: 10000 });
    await firstProject.click();
  }
  await sleep(1000);
  await snap("editor-open");
  const editorHint = await driver.$('-ios predicate string:label == "Start drawing"');
  if (await editorHint.isExisting()) {
    await editorHint.waitForExist({ timeout: 5000 });
  } else {
    const source = await driver.getPageSource();
    await Bun.write(resolve(artifactsDir, "editor-open.xml"), source);
  }

  const window = await driver.getWindowRect();
  const startX = Math.round(window.width * 0.2);
  const startY = Math.round(window.height * 0.4);
  const endX = Math.round(window.width * 0.8);
  const endY = Math.round(window.height * 0.4);

  await driver.performActions([
    {
      type: "pointer",
      id: "finger1",
      parameters: { pointerType: "touch" },
      actions: [
        { type: "pointerMove", duration: 0, x: startX, y: startY },
        { type: "pointerDown", button: 0 },
        { type: "pointerMove", duration: 500, x: endX, y: endY },
        { type: "pointerUp", button: 0 }
      ]
    }
  ]);
  await driver.releaseActions();
  await sleep(500);
  await snap("wall-drawn");

  if (await tapTool("Opening")) {
    await sleep(300);
    const openingButtons = await driver.$$(
      '-ios predicate string:type == "XCUIElementTypeButton" AND (label == "Door" OR label == "Window")'
    );
    for_toggle: for (const button of openingButtons) {
      const labelValue = await button.getAttribute("label");
      if (labelValue === "Door") {
        await button.click();
        break for_toggle;
      }
    }
    await sleep(300);
    await driver.performActions([
      {
        type: "pointer",
        id: "finger2",
        parameters: { pointerType: "touch" },
        actions: [
          { type: "pointerMove", duration: 0, x: Math.round(window.width * 0.5), y: startY },
          { type: "pointerDown", button: 0 },
          { type: "pointerUp", button: 0 }
        ]
      }
    ]);
    await driver.releaseActions();
    await sleep(500);
    await snap("opening-added");
  } else {
    console.warn("Opening tool not found; skipping opening step.");
    await snap("opening-missing");
  }

  if (await tapTool("Pan")) {
    await sleep(300);
    await driver.performActions([
      {
        type: "pointer",
        id: "finger3",
        parameters: { pointerType: "touch" },
        actions: [
          { type: "pointerMove", duration: 0, x: Math.round(window.width * 0.5), y: Math.round(window.height * 0.6) },
          { type: "pointerDown", button: 0 },
          { type: "pointerMove", duration: 400, x: Math.round(window.width * 0.5), y: Math.round(window.height * 0.4) },
          { type: "pointerUp", button: 0 }
        ]
      }
    ]);
    await driver.releaseActions();
    await sleep(500);
    await snap("panned");
  } else {
    console.warn("Pan tool not found; skipping pan step.");
    await snap("pan-missing");
  }

  try {
    const centerX = Math.round(window.width * 0.5);
    const centerY = Math.round(window.height * 0.6);
    await driver.performActions([
      {
        type: "pointer",
        id: "finger4",
        parameters: { pointerType: "touch" },
        actions: [
          { type: "pointerMove", duration: 0, x: centerX - 40, y: centerY },
          { type: "pointerDown", button: 0 },
          { type: "pointerMove", duration: 400, x: centerX - 80, y: centerY },
          { type: "pointerUp", button: 0 }
        ]
      },
      {
        type: "pointer",
        id: "finger5",
        parameters: { pointerType: "touch" },
        actions: [
          { type: "pointerMove", duration: 0, x: centerX + 40, y: centerY },
          { type: "pointerDown", button: 0 },
          { type: "pointerMove", duration: 400, x: centerX + 80, y: centerY },
          { type: "pointerUp", button: 0 }
        ]
      }
    ]);
    await driver.releaseActions();
    await sleep(500);
    await snap("pinch-zoom");
  } catch (error) {
    console.warn("Pinch gesture failed:", error);
    await snap("pinch-zoom-failed");
  }

  await driver.back();
  await sleep(500);
  await snap("back-to-projects");

  let settingsOpened = false;
  try {
    await ensureAppActive();
    const settingsTab = await driver.$('-ios predicate string:name == "Settings" AND type == "XCUIElementTypeButton"');
    if (await settingsTab.isExisting()) {
      await settingsTab.click();
      settingsOpened = true;
    } else {
      const tabBar = await driver.$("-ios class chain:**/XCUIElementTypeTabBar");
      if (await tabBar.isExisting()) {
        const tabButtons = await driver.$$("-ios class chain:**/XCUIElementTypeTabBar/XCUIElementTypeButton");
        if (tabButtons.length > 0) {
          const labels = await Promise.all(tabButtons.map(async (button) => button.getAttribute("label")));
          console.log(`Tab bar buttons: ${labels.join(", ")}`);
        }
        if (tabButtons.length >= 2) {
          await tabButtons[1].click();
          settingsOpened = true;
        }
      }
      if (!settingsOpened) {
        const tapX = Math.round(window.width * 0.65);
        const tapY = Math.round(window.height * 0.93);
        await driver.performActions([
          {
            type: "pointer",
            id: "finger-tab",
            parameters: { pointerType: "touch" },
            actions: [
              { type: "pointerMove", duration: 0, x: tapX, y: tapY },
              { type: "pointerDown", button: 0 },
              { type: "pointerUp", button: 0 }
            ]
          }
        ]);
        await driver.releaseActions();
        await sleep(600);
        const settingsTitle = await driver.$(
          '-ios predicate string:name == "Settings" OR name == "Device Pairing" OR name == "Devices"'
        );
        if (await settingsTitle.isExisting()) {
          settingsOpened = true;
        }
      }
      if (!settingsOpened) {
        console.warn("Settings tab not found; skipping settings flow.");
        await snap("settings-missing");
        const source = await driver.getPageSource();
        const sourcePath = resolve(artifactsDir, "settings-missing.xml");
        await Bun.write(sourcePath, source);
        const tabSource = await driver.$("-ios class chain:**/XCUIElementTypeTabBar");
        if (await tabSource.isExisting()) {
          const tabBarSource = await tabSource.getAttribute("label");
          console.log(`Tab bar label: ${tabBarSource}`);
        }
      }
    }
    if (settingsOpened) {
      await sleep(800);
      await snap("settings");

      const deviceLabel = await driver.$('-ios predicate string:label CONTAINS "Device ID"');
      if (await deviceLabel.isExisting()) {
        await snap("device-id");
      }

      const loadingLabel = await driver.$('-ios predicate string:label CONTAINS "Loading"');
      if (await loadingLabel.isExisting()) {
        const start = Date.now();
        while (Date.now() - start < 8000) {
          const stillLoading = await loadingLabel.isExisting();
          const emptyLabel = await driver.$('-ios predicate string:label CONTAINS "No devices"');
          const deviceRow = await driver.$("-ios class chain:**/XCUIElementTypeCell[1]");
          if (!stillLoading || await emptyLabel.isExisting() || await deviceRow.isExisting()) {
            break;
          }
          await sleep(500);
        }
        await snap("devices-state");
      }

      let pairingTapped = false;
      const pairingButton = await driver.$("~pairing-create");
      if (await pairingButton.isExisting()) {
        await pairingButton.click();
        pairingTapped = true;
      } else {
        const pairingCell = await driver.$(
          '-ios predicate string:(label CONTAINS[c] "pairing code") OR (name CONTAINS[c] "pairing code")'
        );
        if (await pairingCell.isExisting()) {
          await pairingCell.click();
          pairingTapped = true;
        }
      }
      if (pairingTapped) {
        const start = Date.now();
        let pairingResolved = false;
        while (Date.now() - start < 10000) {
          const codeLabel = await driver.$('-ios predicate string:label CONTAINS[c] "Expires"');
          const errorLabel = await driver.$('-ios predicate string:label CONTAINS[c] "Failed to create pairing code"');
          if (await codeLabel.isExisting() || await errorLabel.isExisting()) {
            pairingResolved = true;
            break;
          }
          await sleep(500);
        }
        await snap(pairingResolved ? "pairing-result" : "pairing-timeout");
        const source = await driver.getPageSource();
        const sourcePath = resolve(artifactsDir, "pairing-result.xml");
        await Bun.write(sourcePath, source);
      } else {
        console.warn("Pairing button not found; captured settings screen only.");
      }

      const devicesEmpty = await driver.$('-ios predicate string:label CONTAINS[c] "No devices"');
      if (await devicesEmpty.isExisting()) {
        await snap("devices-empty");
      }
    }
  } catch (error) {
    console.warn("Settings flow failed:", error);
    await snap("settings-error");
  }

  console.log("Appium: manual flow complete.");
} finally {
  await driver.deleteSession();
}
