const cleanupCategories = ["user-temp", "windows-temp", "browser-cache"];
const activity = [];

const elements = {
  connection: document.querySelector("#connectionStatus"),
  connectionText: document.querySelector("#connectionText"),
  diskUsage: document.querySelector("#diskUsage"),
  diskDetail: document.querySelector("#diskDetail"),
  memoryUsage: document.querySelector("#memoryUsage"),
  memoryDetail: document.querySelector("#memoryDetail"),
  lastScan: document.querySelector("#lastScan"),
  itemsFound: document.querySelector("#itemsFound"),
  recoverableSpace: document.querySelector("#recoverableSpace"),
  runScan: document.querySelector("#runScan"),
  dryRun: document.querySelector("#dryRun"),
  viewReport: document.querySelector("#viewReport"),
  reportPanel: document.querySelector("#reportPanel"),
  activityList: document.querySelector("#activityList"),
  activityCount: document.querySelector("#activityCount"),
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function addActivity(title, detail) {
  activity.unshift({
    title,
    detail,
    time: new Date(),
  });
  activity.splice(5);
  renderActivity();
}

function renderActivity() {
  elements.activityCount.textContent = `${activity.length} ${
    activity.length === 1 ? "event" : "events"
  }`;

  if (activity.length === 0) {
    elements.activityList.innerHTML =
      '<li class="empty-state">No dashboard activity yet.</li>';
    return;
  }

  elements.activityList.innerHTML = activity
    .map(
      (item) => `
        <li>
          <span><strong>${item.title}</strong><br />${item.detail}</span>
          <time>${formatTime(item.time)}</time>
        </li>
      `,
    )
    .join("");
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

async function loadHealth() {
  try {
    const health = await requestJson("/api/v1/system/health");
    elements.diskUsage.textContent = `${health.disk.usedPercent}%`;
    elements.diskDetail.textContent =
      `${formatBytes(health.disk.usedBytes)} of ${formatBytes(health.disk.totalBytes)}`;
    elements.memoryUsage.textContent = `${health.memory.usedPercent}%`;
    elements.memoryDetail.textContent =
      `${formatBytes(health.memory.usedBytes)} of ${formatBytes(health.memory.totalBytes)}`;
    elements.connectionText.textContent = "API connected";
  } catch {
    elements.connection.classList.add("error");
    elements.connectionText.textContent = "API unavailable";
    addActivity("Connection issue", "System health could not be loaded.");
  }
}

async function runReadOnlyAction(button, action) {
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Working...";
  try {
    await action();
  } catch (error) {
    addActivity("Action failed", error.message);
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

elements.runScan.addEventListener("click", () =>
  runReadOnlyAction(elements.runScan, async () => {
    const result = await requestJson("/api/v1/cleanup/scan");
    elements.lastScan.textContent = formatTime(result.scannedAt);
    elements.itemsFound.textContent = result.fileCount.toLocaleString();
    elements.recoverableSpace.textContent = formatBytes(result.totalBytes);
    addActivity(
      "Read-only scan completed",
      `${result.fileCount.toLocaleString()} files found across approved locations.`,
    );
  }),
);

elements.dryRun.addEventListener("click", () =>
  runReadOnlyAction(elements.dryRun, async () => {
    const result = await requestJson("/api/v1/cleanup/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories: cleanupCategories }),
    });
    elements.itemsFound.textContent = result.fileCount.toLocaleString();
    elements.recoverableSpace.textContent = formatBytes(result.totalBytes);
    addActivity(
      "Dry run completed",
      `${formatBytes(result.totalBytes)} estimated; no files were removed.`,
    );
  }),
);

elements.viewReport.addEventListener("click", () => {
  elements.reportPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  addActivity("Report viewed", "Opened the current dashboard session report.");
});

loadHealth();
