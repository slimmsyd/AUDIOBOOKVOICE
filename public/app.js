const state = {
  project: null,
  projects: []
};

const els = {
  toolStatus: document.querySelector("#toolStatus"),
  projectList: document.querySelector("#projectList"),
  dropZone: document.querySelector("#dropZone"),
  fileInput: document.querySelector("#fileInput"),
  chooseFileButton: document.querySelector("#chooseFileButton"),
  projectEditor: document.querySelector("#projectEditor"),
  titleInput: document.querySelector("#titleInput"),
  authorInput: document.querySelector("#authorInput"),
  projectStats: document.querySelector("#projectStats"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  voiceIdInput: document.querySelector("#voiceIdInput"),
  modelInput: document.querySelector("#modelInput"),
  saveButton: document.querySelector("#saveButton"),
  resplitButton: document.querySelector("#resplitButton"),
  generateButton: document.querySelector("#generateButton"),
  downloadButton: document.querySelector("#downloadButton"),
  statusLine: document.querySelector("#statusLine"),
  chapters: document.querySelector("#chapters")
};

init();

async function init() {
  wireEvents();
  await checkHealth();
  await loadProjects();
}

function wireEvents() {
  els.chooseFileButton.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", () => {
    const file = els.fileInput.files?.[0];
    if (file) importFile(file);
  });

  for (const eventName of ["dragenter", "dragover"]) {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.add("dragging");
    });
  }

  for (const eventName of ["dragleave", "drop"]) {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("dragging");
    });
  }

  els.dropZone.addEventListener("drop", (event) => {
    const file = [...event.dataTransfer.files].find((item) => item.type === "application/pdf" || item.name.toLowerCase().endsWith(".pdf"));
    if (file) importFile(file);
    else setStatus("Drop a PDF file to start.");
  });

  els.saveButton.addEventListener("click", saveProject);
  els.resplitButton.addEventListener("click", resplitProject);
  els.generateButton.addEventListener("click", generateAudiobook);
}

async function checkHealth() {
  try {
    const health = await api("/api/health");
    const pdftotext = health.tools.pdftotext ? "pdftotext ready" : "pdftotext missing";
    const ffmpeg = health.tools.ffmpeg ? "ffmpeg ready" : "ffmpeg missing";
    els.toolStatus.textContent = `${pdftotext}. ${ffmpeg}.`;
  } catch (error) {
    els.toolStatus.textContent = `Server check failed: ${error.message}`;
  }
}

async function loadProjects() {
  const response = await api("/api/projects");
  state.projects = response.projects;
  renderProjectList();
}

async function importFile(file) {
  setBusy(true);
  setStatus("Extracting PDF text locally...");

  try {
    const pdfBase64 = await fileToBase64(file);
    const project = await api("/api/import", {
      method: "POST",
      body: {
        fileName: file.name,
        pdfBase64
      }
    });
    state.project = project;
    renderProject();
    await loadProjects();
    setStatus("Review the detected chapters, then generate the audiobook.");
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
}

async function openProject(id) {
  setStatus("Loading project...");
  state.project = await api(`/api/projects/${id}`);
  renderProject();
  setStatus("");
}

async function saveProject() {
  if (!state.project) return;
  setBusy(true);
  setStatus("Saving edits...");

  try {
    state.project = await api(`/api/projects/${state.project.id}`, {
      method: "PUT",
      body: collectProjectPayload()
    });
    renderProject();
    await loadProjects();
    setStatus("Edits saved.");
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
}

async function resplitProject() {
  if (!state.project) return;
  const shouldContinue = confirm("Re-splitting replaces the current chapter edits for this project. Continue?");
  if (!shouldContinue) return;

  setBusy(true);
  setStatus("Re-splitting chapters from the extracted text...");

  try {
    state.project = await api(`/api/projects/${state.project.id}/resplit`, {
      method: "POST",
      body: {}
    });
    renderProject();
    await loadProjects();
    setStatus(`Re-split complete: ${state.project.chapters.length} sections detected.`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
}

async function generateAudiobook() {
  if (!state.project) return;
  if (!els.apiKeyInput.value.trim()) {
    setStatus("Add your ElevenLabs API key first.");
    els.apiKeyInput.focus();
    return;
  }

  setBusy(true);
  setStatus("Generating voice and building the M4B. Long books can take a while.");

  try {
    state.project = await api(`/api/projects/${state.project.id}/generate`, {
      method: "POST",
      body: {
        ...collectProjectPayload(),
        apiKey: els.apiKeyInput.value.trim(),
        voiceId: els.voiceIdInput.value.trim(),
        modelId: els.modelInput.value.trim()
      }
    });
    renderProject();
    await loadProjects();
    setStatus("Audiobook complete. Download is ready.");
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
}

function collectProjectPayload() {
  return {
    title: els.titleInput.value.trim(),
    author: els.authorInput.value.trim(),
    chapters: [...document.querySelectorAll(".chapter")].map((chapter, index) => ({
      id: `chapter-${index + 1}`,
      title: chapter.querySelector("[data-title]").value.trim(),
      text: chapter.querySelector("[data-text]").value.trim()
    }))
  };
}

function renderProjectList() {
  els.projectList.innerHTML = "";
  if (!state.projects.length) {
    els.projectList.innerHTML = `<p class="muted">No projects yet.</p>`;
    return;
  }

  for (const project of state.projects) {
    const button = document.createElement("button");
    button.className = "project-card secondary";
    button.type = "button";
    button.innerHTML = `
      <strong>${escapeHtml(project.title)}</strong>
      <span>${project.chapterCount} chapters · ${escapeHtml(project.status)}</span>
    `;
    button.addEventListener("click", () => openProject(project.id));
    els.projectList.append(button);
  }
}

function renderProject() {
  const project = state.project;
  if (!project) return;

  els.projectEditor.classList.remove("hidden");
  els.titleInput.value = project.title || "";
  els.authorInput.value = project.author || "";
  els.projectStats.textContent = `${project.chapters.length} chapters · ${formatNumber(project.extraction?.cleanedCharacters || 0)} cleaned characters`;
  els.downloadButton.classList.toggle("hidden", !project.output?.downloadUrl);
  if (project.output?.downloadUrl) els.downloadButton.href = project.output.downloadUrl;

  els.chapters.innerHTML = "";
  project.chapters.forEach((chapter, index) => {
    const section = document.createElement("section");
    section.className = "chapter";
    section.innerHTML = `
      <div class="chapter-head">
        <input data-title type="text" value="${escapeAttribute(chapter.title)}" aria-label="Chapter title" />
        <div class="chapter-meta">${formatNumber(chapter.wordCount)} words · ${chapter.estimatedMinutes} min · ${escapeHtml(chapter.status || "ready")}</div>
      </div>
      <textarea data-text spellcheck="true" aria-label="Chapter text">${escapeHtml(chapter.text)}</textarea>
    `;
    els.chapters.append(section);
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function setBusy(isBusy) {
  for (const button of [els.chooseFileButton, els.saveButton, els.resplitButton, els.generateButton]) {
    button.disabled = isBusy;
  }
}

function setStatus(message) {
  els.statusLine.textContent = message || "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}
