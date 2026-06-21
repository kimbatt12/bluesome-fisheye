const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("previewCanvas");
const context = canvas.getContext("2d", { willReadFrequently: true });
const downloadButton = document.getElementById("downloadButton");
const resetButton = document.getElementById("resetButton");
const strengthInput = document.getElementById("strengthInput");
const strengthOutput = document.getElementById("strengthOutput");
const backgroundColorInput = document.getElementById("backgroundColorInput");
const presetButtons = document.querySelectorAll("[data-background-preset]");
const emptyState = document.getElementById("emptyState");
const focusPoint = document.getElementById("focusPoint");
const statusText = document.getElementById("statusText");
const dropZone = document.getElementById("dropZone");

let sourceBitmap = null;
let sourceName = "fisheye-image";
let outputType = "image/png";
let distortionCenter = { x: 0.5, y: 0.5 };
let backgroundPreset = "white";

fileInput.addEventListener("change", () => {
  const [file] = fileInput.files;
  if (file) {
    loadImageFile(file);
  }
});

strengthInput.addEventListener("input", () => {
  strengthOutput.value = strengthInput.value;
  if (sourceBitmap) {
    renderFisheye();
  }
});

backgroundColorInput.addEventListener("input", () => {
  backgroundPreset = "custom";
  updatePresetButtons();
  if (sourceBitmap) {
    renderFisheye();
  }
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    backgroundPreset = button.dataset.backgroundPreset;
    if (backgroundPreset === "black") {
      backgroundColorInput.value = "#000000";
    }
    if (backgroundPreset === "white") {
      backgroundColorInput.value = "#ffffff";
    }
    updatePresetButtons();
    if (sourceBitmap) {
      renderFisheye();
    }
  });
});

downloadButton.addEventListener("click", downloadImage);
resetButton.addEventListener("click", resetWorkspace);
window.addEventListener("resize", updateFocusPoint);

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
});

dropZone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;
  if (file) {
    loadImageFile(file);
  }
});

dropZone.addEventListener("pointerdown", (event) => {
  if (!sourceBitmap || event.target === focusPoint) {
    return;
  }

  const point = getCanvasPoint(event);
  if (!point) {
    return;
  }

  distortionCenter = {
    x: point.x / (canvas.width - 1),
    y: point.y / (canvas.height - 1),
  };
  updateFocusPoint();
  renderFisheye();
  setStatus("왜곡 기준점 변경 완료");
});

async function loadImageFile(file) {
  if (!isImageFile(file)) {
    setStatus("이미지 파일을 선택해주세요.");
    return;
  }

  setStatus("변환 중...");
  sourceName = file.name.replace(/\.[^.]+$/, "") || "fisheye-image";
  outputType = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/png";

  try {
    sourceBitmap = await decodeImage(file);
    prepareCanvas(sourceBitmap.width, sourceBitmap.height);
    distortionCenter = { x: 0.5, y: 0.5 };
    renderFisheye();
    dropZone.classList.add("has-image");
    emptyState.classList.add("is-hidden");
    focusPoint.disabled = false;
    focusPoint.classList.add("is-visible");
    updateFocusPoint();
    downloadButton.disabled = false;
    resetButton.disabled = false;
    setStatus(`${file.name} 변환 완료`);
  } catch (error) {
    console.error(error);
    setStatus("이 브라우저에서 해당 이미지 포맷을 읽을 수 없습니다.");
  }
}

function isImageFile(file) {
  const imageExtensions = /\.(avif|bmp|gif|heic|heif|jpeg|jpg|png|svg|tif|tiff|webp)$/i;
  return file.type.startsWith("image/") || imageExtensions.test(file.name);
}

async function decodeImage(file) {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = imageUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function prepareCanvas(width, height) {
  const longestSide = Math.max(width, height);
  const scale = Math.min(1, 1800 / longestSide);
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
}

function renderFisheye() {
  const width = canvas.width;
  const height = canvas.height;
  const offscreen = document.createElement("canvas");
  const offscreenContext = offscreen.getContext("2d", { willReadFrequently: true });

  offscreen.width = width;
  offscreen.height = height;
  offscreenContext.drawImage(sourceBitmap, 0, 0, width, height);

  const source = offscreenContext.getImageData(0, 0, width, height);
  const result = context.createImageData(width, height);
  const strength = Number(strengthInput.value) / 100;
  const intensity = 0.18 + strength * 1.22;
  const centerX = distortionCenter.x * (width - 1);
  const centerY = distortionCenter.y * (height - 1);
  const radius = getFarthestCornerDistance(centerX, centerY, width, height);
  const backgroundColor = hexToRgb(backgroundColorInput.value);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const targetIndex = (y * width + x) * 4;

      const normalized = distance / radius;
      const sourceRadius = Math.pow(normalized, 1 + intensity) * radius;
      const angle = Math.atan2(dy, dx);
      const sourceX = centerX + Math.cos(angle) * sourceRadius;
      const sourceY = centerY + Math.sin(angle) * sourceRadius;

      if (sourceX < 0 || sourceY < 0 || sourceX > width - 1 || sourceY > height - 1) {
        fillPixel(result.data, targetIndex, getBackgroundColor(x, y, width, height, backgroundColor));
        continue;
      }

      sampleBilinear(source.data, result.data, width, height, sourceX, sourceY, targetIndex);
    }
  }

  context.putImageData(result, 0, 0);
}

function getFarthestCornerDistance(centerX, centerY, width, height) {
  return Math.max(
    Math.hypot(centerX, centerY),
    Math.hypot(width - 1 - centerX, centerY),
    Math.hypot(centerX, height - 1 - centerY),
    Math.hypot(width - 1 - centerX, height - 1 - centerY),
  );
}

function sampleBilinear(source, target, width, height, x, y, targetIndex) {
  const x0 = clamp(Math.floor(x), 0, width - 1);
  const y0 = clamp(Math.floor(y), 0, height - 1);
  const x1 = clamp(x0 + 1, 0, width - 1);
  const y1 = clamp(y0 + 1, 0, height - 1);
  const tx = x - x0;
  const ty = y - y0;

  const topLeft = (y0 * width + x0) * 4;
  const topRight = (y0 * width + x1) * 4;
  const bottomLeft = (y1 * width + x0) * 4;
  const bottomRight = (y1 * width + x1) * 4;

  for (let channel = 0; channel < 4; channel += 1) {
    const top = lerp(source[topLeft + channel], source[topRight + channel], tx);
    const bottom = lerp(source[bottomLeft + channel], source[bottomRight + channel], tx);
    target[targetIndex + channel] = lerp(top, bottom, ty);
  }
}

function fillPixel(target, targetIndex, color) {
  target[targetIndex] = color.r;
  target[targetIndex + 1] = color.g;
  target[targetIndex + 2] = color.b;
  target[targetIndex + 3] = 255;
}

function getBackgroundColor(x, y, width, height, fallbackColor) {
  if (backgroundPreset !== "gradient") {
    return fallbackColor;
  }

  const horizontal = width <= 1 ? 0 : x / (width - 1);
  const vertical = height <= 1 ? 0 : y / (height - 1);
  const first = { r: 255, g: 208, b: 47 };
  const middle = { r: 12, g: 166, b: 120 };
  const last = { r: 66, g: 98, b: 255 };

  if (horizontal < 0.5) {
    return mixColor(first, middle, horizontal * 2);
  }

  return mixColor(middle, last, (horizontal - 0.5) * 2 + vertical * 0.18);
}

function mixColor(start, end, amount) {
  const ratio = clamp(amount, 0, 1);

  return {
    r: Math.round(lerp(start.r, end.r, ratio)),
    g: Math.round(lerp(start.g, end.g, ratio)),
    b: Math.round(lerp(start.b, end.b, ratio)),
  };
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function updatePresetButtons() {
  presetButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.backgroundPreset === backgroundPreset);
  });
}

function downloadImage() {
  const link = document.createElement("a");
  const extension = outputType === "image/webp" ? "webp" : "png";

  link.download = `${sourceName}-fisheye.${extension}`;
  link.href = canvas.toDataURL(outputType);
  link.click();
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
    return null;
  }

  return {
    x: clamp((x / rect.width) * (canvas.width - 1), 0, canvas.width - 1),
    y: clamp((y / rect.height) * (canvas.height - 1), 0, canvas.height - 1),
  };
}

function updateFocusPoint() {
  if (!sourceBitmap) {
    return;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const stageRect = dropZone.getBoundingClientRect();
  const left = canvasRect.left - stageRect.left + canvasRect.width * distortionCenter.x;
  const top = canvasRect.top - stageRect.top + canvasRect.height * distortionCenter.y;

  focusPoint.style.left = `${left}px`;
  focusPoint.style.top = `${top}px`;
}

function resetWorkspace() {
  sourceBitmap = null;
  distortionCenter = { x: 0.5, y: 0.5 };
  backgroundPreset = "white";
  backgroundColorInput.value = "#ffffff";
  updatePresetButtons();
  fileInput.value = "";
  context.clearRect(0, 0, canvas.width, canvas.height);
  canvas.removeAttribute("width");
  canvas.removeAttribute("height");
  dropZone.classList.remove("has-image");
  emptyState.classList.remove("is-hidden");
  focusPoint.disabled = true;
  focusPoint.classList.remove("is-visible");
  focusPoint.removeAttribute("style");
  downloadButton.disabled = true;
  resetButton.disabled = true;
  setStatus("");
}

function setStatus(message) {
  statusText.textContent = message;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}
