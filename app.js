// /frontend/app.js
"use strict";

const CONFIG = window.DIRECTOR_AI_CONFIG;
const videoUrlInput = document.getElementById("videoUrl");
const analyzeBtn = document.getElementById("analyzeBtn");
const progress = document.getElementById("progress");
const progressBar = document.getElementById("progressBar");
const progressPercent = document.getElementById("progressPercent");
const progressText = document.getElementById("progressText");
const errorBox = document.getElementById("errorBox");
const results = document.getElementById("results");
const sceneList = document.getElementById("sceneList");
const projectTitle = document.getElementById("projectTitle");
const projectSummary = document.getElementById("projectSummary");
const masterPrompt = document.getElementById("masterPrompt");
const copyAllBtn = document.getElementById("copyAllBtn");
const downloadBtn = document.getElementById("downloadBtn");
const toast = document.getElementById("toast");

let lastAnalyzedUrl = "";
let currentResult = null;
let smartlinkRotation = 0;

const progressStages = [
  [10, "Validating video URL…"],
  [24, "Reading visual and audio streams…"],
  [42, "Detecting scenes and key cinematic beats…"],
  [61, "Analyzing camera, lens, lighting and composition…"],
  [78, "Mapping sound design and voice-over…"],
  [91, "Writing director-level recreation prompts…"]
];

function isValidYouTubeUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    return host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com";
  } catch {
    return false;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 1800);
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function setLoading(isLoading) {
  analyzeBtn.disabled = isLoading;
  analyzeBtn.innerHTML = isLoading
    ? '<span class="spinner"></span><span>Analyzing</span>'
    : '<span class="button-icon">▶</span><span>Analyze</span>';
}

function setProgress(value, message) {
  progressBar.style.width = `${value}%`;
  progressPercent.textContent = `${value}%`;
  progressText.textContent = message;
}

function rotateAdDestinations() {
  const links = CONFIG.smartlinks;
  document.querySelectorAll(".smartlink-ad").forEach((element, index) => {
    const linkIndex = (smartlinkRotation + index + 1) % links.length;
    element.href = links[linkIndex];
  });
}

function triggerAnalyzeSmartlink() {
  if (!CONFIG.openSmartlinkOnNewAnalyze || !CONFIG.smartlinks.length) return;

  const destination = CONFIG.smartlinks[smartlinkRotation % CONFIG.smartlinks.length];
  smartlinkRotation = (smartlinkRotation + 1) % CONFIG.smartlinks.length;
  rotateAdDestinations();

  const adWindow = window.open(destination, "_blank", "noopener,noreferrer");
  if (!adWindow) {
    showToast("Browser blocked the sponsored tab.");
  }
}

async function animateProgress(requestPromise) {
  let finished = false;
  requestPromise.finally(() => { finished = true; });

  for (const [value, message] of progressStages) {
    if (finished) break;
    setProgress(value, message);
    await new Promise(resolve => window.setTimeout(resolve, 700));
  }

  if (!finished) {
    setProgress(94, "Finalizing prompt package…");
  }
}

function safeText(value, fallback = "Not specified") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function createPromptBlock(label, text, full = false) {
  const section = document.createElement("section");
  section.className = `prompt${full ? " full" : ""}`;

  const heading = document.createElement("div");
  heading.className = "card-heading";

  const headingLabel = document.createElement("span");
  headingLabel.textContent = label;

  const copyButton = document.createElement("button");
  copyButton.className = "mini-copy";
  copyButton.type = "button";
  copyButton.textContent = "Copy";
  copyButton.addEventListener("click", () => copyText(text));

  const paragraph = document.createElement("p");
  paragraph.textContent = text;

  heading.append(headingLabel, copyButton);
  section.append(heading, paragraph);
  return section;
}

function renderResults(data) {
  currentResult = data;
  sceneList.innerHTML = "";
  projectTitle.textContent = safeText(data.title, "Cinematic Prompt Package");
  projectSummary.textContent = safeText(data.summary, "Director-level analysis complete.");
  masterPrompt.textContent = safeText(data.master_director_prompt);

  const scenes = Array.isArray(data.scenes) ? data.scenes : [];

  scenes.forEach((scene, index) => {
    const article = document.createElement("article");
    article.className = "scene-card";

    const head = document.createElement("div");
    head.className = "scene-head";

    const title = document.createElement("div");
    title.className = "scene-title";

    const sceneIndex = document.createElement("span");
    sceneIndex.className = "scene-index";
    sceneIndex.textContent = String(index + 1).padStart(2, "0");

    const sceneName = document.createElement("strong");
    sceneName.textContent = safeText(scene.scene_title, `Scene ${index + 1}`);

    const time = document.createElement("span");
    time.className = "scene-time";
    time.textContent = `${safeText(scene.start_time, "00:00")} — ${safeText(scene.end_time, "00:00")}`;

    title.append(sceneIndex, sceneName);
    head.append(title, time);

    const grid = document.createElement("div");
    grid.className = "prompt-grid";
    grid.append(
      createPromptBlock("SCENE SUMMARY", safeText(scene.scene_summary)),
      createPromptBlock("VISUAL PROMPT", safeText(scene.visual_prompt)),
      createPromptBlock("CAMERA & LENS", safeText(scene.camera_prompt)),
      createPromptBlock("LIGHTING & COLOR", safeText(scene.lighting_prompt)),
      createPromptBlock("SOUND DESIGN", safeText(scene.sound_design)),
      createPromptBlock("VOICE OVER", safeText(scene.voice_over)),
      createPromptBlock("SCENE RECREATION PROMPT", safeText(scene.scene_recreation_prompt), true)
    );

    article.append(head, grid);
    sceneList.appendChild(article);
  });

  results.classList.remove("hidden");
}

function buildTextPackage() {
  if (!currentResult) return "";

  const lines = [
    "DIRECTOR AI — CINEMATIC PROMPT PACKAGE",
    "",
    `TITLE: ${safeText(currentResult.title)}`,
    `SUMMARY: ${safeText(currentResult.summary)}`,
    ""
  ];

  (currentResult.scenes || []).forEach((scene, index) => {
    lines.push(
      `SCENE ${String(index + 1).padStart(2, "0")} — ${safeText(scene.scene_title)}`,
      `TIME: ${safeText(scene.start_time)} — ${safeText(scene.end_time)}`,
      "",
      "SCENE SUMMARY",
      safeText(scene.scene_summary),
      "",
      "VISUAL PROMPT",
      safeText(scene.visual_prompt),
      "",
      "CAMERA & LENS",
      safeText(scene.camera_prompt),
      "",
      "LIGHTING & COLOR",
      safeText(scene.lighting_prompt),
      "",
      "SOUND DESIGN",
      safeText(scene.sound_design),
      "",
      "VOICE OVER",
      safeText(scene.voice_over),
      "",
      "SCENE RECREATION PROMPT",
      safeText(scene.scene_recreation_prompt),
      "",
      "------------------------------------------------------------",
      ""
    );
  });

  lines.push("MASTER DIRECTOR RECREATION PROMPT", safeText(currentResult.master_director_prompt));
  return lines.join("\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied.");
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    showToast("Copied.");
  }
}

async function analyzeVideo() {
  const url = videoUrlInput.value.trim();
  clearError();

  if (!url) {
    showError("Paste a public YouTube URL first.");
    videoUrlInput.focus();
    return;
  }

  if (!isValidYouTubeUrl(url)) {
    showError("V1 currently accepts public YouTube URLs only.");
    videoUrlInput.focus();
    return;
  }

  const isNewUrl = url !== lastAnalyzedUrl;
  if (isNewUrl) {
    triggerAnalyzeSmartlink();
    lastAnalyzedUrl = url;
  }

  setLoading(true);
  results.classList.add("hidden");
  progress.classList.remove("hidden");
  setProgress(3, "Starting analysis…");

  const request = fetch(`${CONFIG.apiBaseUrl}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_url: url })
  });

  const animation = animateProgress(request);

  try {
    const response = await request;
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.detail || "Video analysis failed.");
    }

    await animation;
    setProgress(100, "Director prompt package complete.");
    renderResults(body);

    window.setTimeout(() => {
      results.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 180);
  } catch (error) {
    showError(error.message || "Unable to analyze this video.");
  } finally {
    setLoading(false);
  }
}

analyzeBtn.addEventListener("click", analyzeVideo);
videoUrlInput.addEventListener("keydown", event => {
  if (event.key === "Enter") analyzeVideo();
});

copyAllBtn.addEventListener("click", () => copyText(buildTextPackage()));

downloadBtn.addEventListener("click", () => {
  const text = buildTextPackage();
  if (!text) return;

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "director-ai-prompt.txt";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
});

document.querySelector("[data-copy-target='masterPrompt']").addEventListener("click", () => {
  copyText(masterPrompt.textContent.trim());
});

rotateAdDestinations();
