const storeKey = "home_medicine_box_pwa_v1";
const form = document.querySelector("#medicineForm");
const list = document.querySelector("#medicineList");
const emptyState = document.querySelector("#emptyState");
const template = document.querySelector("#medicineItemTemplate");
const searchInput = document.querySelector("#searchInput");
const clearBtn = document.querySelector("#clearBtn");
const exportBtn = document.querySelector("#exportBtn");
const importFile = document.querySelector("#importFile");
const installBtn = document.querySelector("#installBtn");

let medicines = readMedicines();
let deferredInstallPrompt = null;

render();
registerServiceWorker();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const medicine = {
    id: crypto.randomUUID(),
    name: document.querySelector("#nameInput").value.trim(),
    location: document.querySelector("#locationInput").value.trim(),
    quantity: Number(document.querySelector("#quantityInput").value || 0),
    expireDate: document.querySelector("#expireInput").value,
    tag: document.querySelector("#tagInput").value,
    createdAt: new Date().toISOString(),
  };
  if (!medicine.name) return;
  medicines.unshift(medicine);
  saveMedicines();
  form.reset();
  document.querySelector("#quantityInput").value = "1";
  render();
});

searchInput.addEventListener("input", render);

clearBtn.addEventListener("click", () => {
  searchInput.value = "";
  render();
});

exportBtn.addEventListener("click", () => {
  const payload = {
    app: "home_medicine_box_pwa",
    version: 1,
    exportedAt: new Date().toISOString(),
    medicines,
  };
  const file = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `home_medicine_box_${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data.medicines)) throw new Error("invalid file");
    medicines = data.medicines
      .filter((item) => item && item.name)
      .map((item) => ({
        id: item.id || crypto.randomUUID(),
        name: String(item.name || ""),
        location: String(item.location || ""),
        quantity: Number(item.quantity || 0),
        expireDate: String(item.expireDate || ""),
        tag: String(item.tag || "常备药"),
        createdAt: item.createdAt || new Date().toISOString(),
      }));
    saveMedicines();
    render();
  } catch {
    alert("导入失败，请选择本页面导出的 JSON 文件。");
  } finally {
    importFile.value = "";
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBtn.hidden = true;
});

function render() {
  const keyword = searchInput.value.trim().toLowerCase();
  const visible = medicines.filter((item) => {
    const text = `${item.name} ${item.location} ${item.tag}`.toLowerCase();
    return text.includes(keyword);
  });

  list.innerHTML = "";
  emptyState.hidden = medicines.length > 0;

  for (const item of visible) {
    const node = template.content.cloneNode(true);
    const status = getStatus(item.expireDate);
    node.querySelector("[data-name]").textContent = item.name;
    node.querySelector("[data-meta]").textContent = [
      item.location || "未填写位置",
      `${item.quantity || 0} 件`,
      item.expireDate ? `有效期 ${item.expireDate}` : "未填写有效期",
      item.tag,
    ].join(" · ");
    const statusNode = node.querySelector("[data-status]");
    statusNode.textContent = status.text;
    statusNode.className = `status ${status.level}`;
    node.querySelector("[data-delete]").addEventListener("click", () => {
      medicines = medicines.filter((medicine) => medicine.id !== item.id);
      saveMedicines();
      render();
    });
    list.appendChild(node);
  }

  const stats = medicines.reduce(
    (result, item) => {
      const status = getStatus(item.expireDate);
      result.total += 1;
      if (status.level === "warning") result.expiring += 1;
      if (status.level === "danger") result.expired += 1;
      return result;
    },
    { total: 0, expiring: 0, expired: 0 },
  );
  document.querySelector("#totalCount").textContent = stats.total;
  document.querySelector("#expiringCount").textContent = stats.expiring;
  document.querySelector("#expiredCount").textContent = stats.expired;
}

function getStatus(expireDate) {
  if (!expireDate) return { text: "正常", level: "" };
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(expireDate));
  const days = Math.round((target - today) / 86400000);
  if (days < 0) return { text: "已过期", level: "danger" };
  if (days <= 30) return { text: "将过期", level: "warning" };
  return { text: "正常", level: "" };
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function readMedicines() {
  try {
    return JSON.parse(localStorage.getItem(storeKey) || "[]");
  } catch {
    return [];
  }
}

function saveMedicines() {
  localStorage.setItem(storeKey, JSON.stringify(medicines));
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => registration.update())
      .catch(() => {});
  });
}
