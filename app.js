// /app.js
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

let currentResult = null;

const progressStages = [
  [10, "Validating video URL…"],
  [24, "Reading visual and audio streams…"],
  [42, "Detecting scenes and timeframes…"],
  [58, "Building detailed image prompts…"],
  [70, "Analyzing camera, lighting and visual direction…"],
  [82, "Mapping sound and voice-over…"],
  [93, "Writing scene recreation prompts…"]
];

function isValidYouTubeUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    return (
      host === "youtube.com" ||
      host === "youtu.be" ||
      host === "m.youtube.com"
    );
  } catch {
    return false;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");

  window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 1800);
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

async function animateProgress(requestPromise) {
  let finished = false;

  requestPromise.finally(() => {
    finished = true;
  });

  for (const [value, message] of progressStages) {
    if (finished) {
      break;
    }

    setProgress(value, message);
    await new Promise((resolve) => {
      window.setTimeout(resolve, 650);
    });
  }

  if (!finished) {
    setProgress(96, "Finalizing director package…");
  }
}

function safeText(value, fallback = "Not specified") {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function buildSceneText(scene, index) {
  return [
    `SCENE ${String(index + 1).padStart(2, "0")} — ${safeText(scene.scene_title)}`,
    `TIME: ${safeText(scene.start_time)} — ${safeText(scene.end_time)}`,
    "",
    "DETAILED IMAGE PROMPT",
    safeText(scene.detailed_image_prompt),
    "",
    "DETAILED VISUAL DIRECTION",
    safeText(scene.detailed_visual_direction),
    "",
    "CAMERA & LENS",
    safeText(scene.camera_direction),
    "",
    "LIGHTING & COLOR",
    safeText(scene.lighting_direction),
    "",
    "SOUND DESIGN",
    safeText(scene.sound_direction),
    "",
    "VOICE OVER / DIALOGUE DIRECTION",
    safeText(scene.voice_over_direction),
    "",
    "SCENE RECREATION PROMPT",
    safeText(scene.scene_recreation_prompt)
  ].join("\n");
}

function createDirectionBlock(title, text, full = false) {
  const block = document.createElement("section");
  block.className = `direction-block${full ? " full" : ""}`;

  block.append(
    createTextElement("h4", "", title),
    createTextElement("p", "", text)
  );

  return block;
}

function renderScene(scene, index) {
  const article = document.createElement("article");
  article.className = "scene-card";

  const head = document.createElement("header");
  head.className = "scene-head";

  const titleWrap = document.createElement("div");
  titleWrap.className = "scene-title";

  const sceneIndex = createTextElement(
    "span",
    "scene-index",
    String(index + 1).padStart(2, "0")
  );

  const titleTextWrap = document.createElement("div");
  const title = createTextElement(
    "strong",
    "",
    safeText(scene.scene_title, `Scene ${index + 1}`)
  );
  const time = createTextElement(
    "span",
    "scene-time",
    `${safeText(scene.start_time, "00:00")} — ${safeText(scene.end_time, "00:00")}`
  );

  titleTextWrap.append(title, time);
  titleWrap.append(sceneIndex, titleTextWrap);

  const sceneCopy = createTextElement(
    "button",
    "scene-copy",
    "Copy Scene"
  );
  sceneCopy.type = "button";
  sceneCopy.addEventListener("click", () => {
    copyText(buildSceneText(scene, index));
  });

  head.append(titleWrap, sceneCopy);

  const content = document.createElement("div");
  content.className = "scene-content";

  const imageSection = document.createElement("section");
  imageSection.className = "scene-section image-prompt-section";
  imageSection.append(
    createTextElement(
      "div",
      "section-heading",
      "DETAILED IMAGE PROMPT"
    ),
    createTextElement(
      "p",
      "",
      safeText(scene.detailed_image_prompt)
    )
  );

  const visualSection = document.createElement("section");
  visualSection.className = "scene-section";

  visualSection.append(
    createTextElement(
      "div",
      "section-heading",
      "DETAILED VISUAL DIRECTION"
    ),
    createTextElement(
      "p",
      "",
      safeText(scene.detailed_visual_direction)
    )
  );

  const directionGrid = document.createElement("div");
  directionGrid.className = "direction-grid";

  directionGrid.append(
    createDirectionBlock(
      "CAMERA & LENS",
      safeText(scene.camera_direction)
    ),
    createDirectionBlock(
      "LIGHTING & COLOR",
      safeText(scene.lighting_direction)
    ),
    createDirectionBlock(
      "SOUND DESIGN",
      safeText(scene.sound_direction)
    ),
    createDirectionBlock(
      "VOICE OVER / DIALOGUE",
      safeText(scene.voice_over_direction)
    )
  );

  const recreationSection = document.createElement("section");
  recreationSection.className = "scene-section recreation-section";

  recreationSection.append(
    createTextElement(
      "div",
      "section-heading",
      "SCENE RECREATION PROMPT"
    ),
    createTextElement(
      "p",
      "",
      safeText(scene.scene_recreation_prompt)
    )
  );

  content.append(
    imageSection,
    visualSection,
    directionGrid,
    recreationSection
  );

  article.append(head, content);
  return article;
}

function renderResults(data) {
  currentResult = data;
  sceneList.innerHTML = "";

  projectTitle.textContent = safeText(
    data.title,
    "Cinematic Prompt Package"
  );

  projectSummary.textContent = safeText(
    data.summary,
    "Director-level analysis complete."
  );

  masterPrompt.textContent = safeText(
    data.master_director_prompt
  );

  const scenes = Array.isArray(data.scenes)
    ? data.scenes
    : [];

  scenes.forEach((scene, index) => {
    sceneList.appendChild(renderScene(scene, index));
  });

  results.classList.remove("hidden");
}

function buildFullTextPackage() {
  if (!currentResult) {
    return "";
  }

  const lines = [
    "DIRECTOR AI — CINEMATIC PROMPT PACKAGE",
    "",
    `TITLE: ${safeText(currentResult.title)}`,
    `SUMMARY: ${safeText(currentResult.summary)}`,
    ""
  ];

  (currentResult.scenes || []).forEach((scene, index) => {
    lines.push(
      buildSceneText(scene, index),
      "",
      "------------------------------------------------------------",
      ""
    );
  });

  lines.push(
    "MASTER DIRECTOR RECREATION PROMPT",
    safeText(currentResult.master_director_prompt)
  );

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

  setLoading(true);
  results.classList.add("hidden");
  progress.classList.remove("hidden");
  setProgress(3, "Starting analysis…");

  const request = fetch(
    `${CONFIG.apiBaseUrl}/api/analyze`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        video_url: url
      })
    }
  );

  const animation = animateProgress(request);

  try {
    const response = await request;
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        body.detail || "Video analysis failed."
      );
    }

    await animation;
    setProgress(
      100,
      "Director prompt package complete."
    );

    renderResults(body);

    window.setTimeout(() => {
      results.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 150);
  } catch (error) {
    showError(
      error.message || "Unable to analyze this video."
    );
  } finally {
    setLoading(false);
  }
}

analyzeBtn.addEventListener(
  "click",
  analyzeVideo
);

videoUrlInput.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Enter") {
      analyzeVideo();
    }
  }
);

copyAllBtn.addEventListener(
  "click",
  () => {
    copyText(buildFullTextPackage());
  }
);

downloadBtn.addEventListener(
  "click",
  () => {
    const text = buildFullTextPackage();

    if (!text) {
      return;
    }

    const blob = new Blob(
      [text],
      {
        type: "text/plain;charset=utf-8"
      }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "director-ai-prompt.txt";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }
);
