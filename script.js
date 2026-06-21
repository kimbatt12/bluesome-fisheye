const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("previewCanvas");
const context = canvas.getContext("2d", { willReadFrequently: true });
const cropBox = document.getElementById("cropBox");
const shapeButton = document.getElementById("shapeButton");
const backgroundButton = document.getElementById("backgroundButton");
const downloadButton = document.getElementById("downloadButton");
const resetButton = document.getElementById("resetButton");
const strengthInput = document.getElementById("strengthInput");
const strengthOutput = document.getElementById("strengthOutput");
const emptyState = document.getElementById("emptyState");
const statusText = document.getElementById("statusText");
const dropZone = document.getElementById("dropZone");
const backgroundModal = document.getElementById("backgroundModal");
const closeBackgroundButton = document.getElementById("closeBackgroundButton");
const shapeModal = document.getElementById("shapeModal");
const closeShapeButton = document.getElementById("closeShapeButton");
const solidPanel = document.getElementById("solidPanel");
const gradientPanel = document.getElementById("gradientPanel");
const solidColorInput = document.getElementById("solidColorInput");
const gradientStartInput = document.getElementById("gradientStartInput");
const gradientEndInput = document.getElementById("gradientEndInput");
const modeButtons = document.querySelectorAll("[data-background-mode]");
const swatchButtons = document.querySelectorAll("[data-solid-color]");
const gradientStartButtons = document.querySelectorAll("[data-gradient-start-color]");
const gradientEndButtons = document.querySelectorAll("[data-gradient-end-color]");
const shapeOptionButtons = document.querySelectorAll("[data-crop-shape]");

const minCropSize = 48;

let sourceBitmap = null;
let sourceName = "fisheye-image";
let outputType = "image/png";
let previewWidth = 0;
let previewHeight = 0;
let cropRect = null;
let dragState = null;
let cropShape = "circle";
let background = {
  mode: "solid",
  solid: "#ffffff",
  gradientStart: "#ffd02f",
  gradientEnd: "#4262ff",
};

fileInput.addEventListener("change", () => {
  const [file] = fileInput.files;
  if (file) {
    loadImageFile(file);
  }
});

strengthInput.addEventListener("input", () => {
  strengthOutput.value = strengthInput.value;
  renderLivePreview();
});

shapeButton.addEventListener("click", openShapeModal);
backgroundButton.addEventListener("click", openBackgroundModal);
closeBackgroundButton.addEventListener("click", closeBackgroundModal);
closeShapeButton.addEventListener("click", closeShapeModal);
downloadButton.addEventListener("click", downloadImage);
resetButton.addEventListener("click", resetToUploadedState);
window.addEventListener("resize", updateCropBoxPosition);

backgroundModal.addEventListener("click", (event) => {
  if (event.target === backgroundModal) {
    closeBackgroundModal();
  }
});

shapeModal.addEventListener("click", (event) => {
  if (event.target === shapeModal) {
    closeShapeModal();
  }
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    background.mode = button.dataset.backgroundMode;
    updateBackgroundControls();
    renderLivePreview();
  });
});

swatchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    background.mode = "solid";
    background.solid = button.dataset.solidColor;
    solidColorInput.value = background.solid;
    updateBackgroundControls();
    renderLivePreview();
  });
});

gradientStartButtons.forEach((button) => {
  button.addEventListener("click", () => {
    background.mode = "gradient";
    background.gradientStart = button.dataset.gradientStartColor;
    gradientStartInput.value = background.gradientStart;
    updateBackgroundControls();
    renderLivePreview();
  });
});

gradientEndButtons.forEach((button) => {
  button.addEventListener("click", () => {
    background.mode = "gradient";
    background.gradientEnd = button.dataset.gradientEndColor;
    gradientEndInput.value = background.gradientEnd;
    updateBackgroundControls();
    renderLivePreview();
  });
});

shapeOptionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    cropShape = button.dataset.cropShape;
    updateShapeControls();
    renderLivePreview();
  });
});

solidColorInput.addEventListener("input", () => {
  background.mode = "solid";
  background.solid = solidColorInput.value;
  updateBackgroundControls();
  renderLivePreview();
});

gradientStartInput.addEventListener("input", () => {
  background.mode = "gradient";
  background.gradientStart = gradientStartInput.value;
  updateBackgroundControls();
  renderLivePreview();
});

gradientEndInput.addEventListener("input", () => {
  background.mode = "gradient";
  background.gradientEnd = gradientEndInput.value;
  updateBackgroundControls();
  renderLivePreview();
});

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

cropBox.addEventListener("pointerdown", (event) => {
  const handle = event.target.dataset.cropHandle;
  if (!handle || !cropRect) {
    return;
  }

  event.preventDefault();
  event.target.setPointerCapture(event.pointerId);

  const point = getCanvasPoint(event);
  dragState = {
    handle,
    pointerId: event.pointerId,
    startPoint: point,
    startRect: { ...cropRect },
  };
});

cropBox.addEventListener("pointermove", (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) {
    return;
  }

  const point = getCanvasPoint(event);
  updateCropFromDrag(point);
  renderLivePreview();
  updateCropBoxPosition();
});

cropBox.addEventListener("pointerup", endCropDrag);
cropBox.addEventListener("pointercancel", endCropDrag);

async function loadImageFile(file) {
  if (!isImageFile(file)) {
    setStatus("이미지 파일을 선택해주세요.");
    return;
  }

  setStatus("업로드 중...");
  sourceName = file.name.replace(/\.[^.]+$/, "") || "fisheye-image";
  outputType = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/png";

  try {
    sourceBitmap = await decodeImage(file);
    prepareCanvas(sourceBitmap.width, sourceBitmap.height);
    resetControlsToDefaults();
    resetCropToFullImage();
    emptyState.classList.add("is-hidden");
    dropZone.classList.add("has-image");
    cropBox.classList.add("is-visible");
    shapeButton.disabled = false;
    backgroundButton.disabled = false;
    downloadButton.disabled = false;
    resetButton.disabled = false;
    renderLivePreview();
    updateCropBoxPosition();
    setStatus(`${file.name} 업로드 완료`);
  } catch (error) {
    console.error(error);
    setStatus("이 브라우저에서 해당 이미지 포맷을 읽을 수 없습니다.");
  }
}

function resetToUploadedState() {
  if (!sourceBitmap) {
    return;
  }

  canvas.width = previewWidth;
  canvas.height = previewHeight;
  resetControlsToDefaults();
  resetCropToFullImage();
  cropBox.classList.add("is-visible");
  shapeButton.disabled = false;
  downloadButton.disabled = false;
  renderLivePreview();
  updateCropBoxPosition();
  setStatus("업로드 초기 상태로 되돌림");
}

function resetControlsToDefaults() {
  background = {
    mode: "solid",
    solid: "#ffffff",
    gradientStart: "#ffd02f",
    gradientEnd: "#4262ff",
  };
  strengthInput.value = "0";
  strengthOutput.value = "0";
  cropShape = "circle";
  solidColorInput.value = background.solid;
  gradientStartInput.value = background.gradientStart;
  gradientEndInput.value = background.gradientEnd;
  updateBackgroundControls();
  updateShapeControls();
}

function resetCropToFullImage() {
  cropRect = {
    x: 0,
    y: 0,
    width: previewWidth,
    height: previewHeight,
  };
}

function prepareCanvas(width, height) {
  const longestSide = Math.max(width, height);
  const scale = Math.min(1, 1800 / longestSide);
  previewWidth = Math.max(1, Math.round(width * scale));
  previewHeight = Math.max(1, Math.round(height * scale));
  canvas.width = previewWidth;
  canvas.height = previewHeight;
}

function renderLivePreview() {
  if (!sourceBitmap || !cropRect) {
    return;
  }

  canvas.width = previewWidth;
  canvas.height = previewHeight;
  const crop = sanitizeCropRect(cropRect, previewWidth, previewHeight);
  const output = createResultCanvas(crop);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(output, crop.x, crop.y);
}

function createResultCanvas(crop) {
  const outputCanvas = document.createElement("canvas");
  const outputContext = outputCanvas.getContext("2d", { willReadFrequently: true });

  const sourceCanvas = document.createElement("canvas");
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  sourceCanvas.width = previewWidth;
  sourceCanvas.height = previewHeight;
  sourceContext.drawImage(sourceBitmap, 0, 0, previewWidth, previewHeight);

  const outputWidth = Math.max(1, Math.round(crop.width));
  const outputHeight = Math.max(1, Math.round(crop.height));
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;

  const source = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const result = outputContext.createImageData(outputWidth, outputHeight);
  const strength = Number(strengthInput.value) / 100;
  const intensity = strength * 1.4;

  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const targetIndex = (y * outputWidth + x) * 4;

      if (!isInsideShape(x, y, outputWidth, outputHeight)) {
        fillPixel(result.data, targetIndex, getBackgroundColor(x, y, outputWidth, outputHeight));
        continue;
      }

      const sourcePoint = getFisheyeSourcePoint(x, y, outputWidth, outputHeight, strength, intensity);
      const sourceX = crop.x + sourcePoint.x;
      const sourceY = crop.y + sourcePoint.y;
      sampleBilinear(source.data, result.data, sourceCanvas.width, sourceCanvas.height, sourceX, sourceY, targetIndex);
    }
  }

  outputContext.putImageData(result, 0, 0);
  return outputCanvas;
}

function getFisheyeSourcePoint(x, y, width, height, strength, intensity) {
  if (strength === 0) {
    return { x, y };
  }

  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const dx = x - centerX;
  const dy = y - centerY;
  const lensRadius = Math.min(width, height) / 2;
  const distance = Math.hypot(dx, dy);
  const normalized = distance / lensRadius;
  const sourceRadius = Math.pow(normalized, 1 + intensity) * lensRadius;
  const scale = distance === 0 ? 0 : sourceRadius / distance;

  return {
    x: centerX + dx * scale,
    y: centerY + dy * scale,
  };
}

function isInsideShape(x, y, width, height) {
  if (cropShape === "square") {
    return true;
  }

  if (cropShape === "rounded") {
    const radius = Math.min(width, height) * 0.18;
    const insideCenter = x >= radius && x <= width - radius && y >= radius && y <= height - radius;
    const insideEdge = (x >= radius && x <= width - radius) || (y >= radius && y <= height - radius);

    if (insideCenter || insideEdge) {
      return true;
    }

    const cornerX = x < radius ? radius : width - radius;
    const cornerY = y < radius ? radius : height - radius;
    return Math.hypot(x - cornerX, y - cornerY) <= radius;
  }

  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const radius = Math.min(width, height) / 2;
  return Math.hypot(x - centerX, y - centerY) <= radius;
}

function updateCropFromDrag(point) {
  const dx = point.x - dragState.startPoint.x;
  const dy = point.y - dragState.startPoint.y;
  const rect = { ...dragState.startRect };

  if (dragState.handle === "move") {
    cropRect = sanitizeCropRect({
      ...rect,
      x: rect.x + dx,
      y: rect.y + dy,
    });
    return;
  }

  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  let nextLeft = left;
  let nextRight = right;
  let nextTop = top;
  let nextBottom = bottom;

  if (dragState.handle.includes("w")) {
    nextLeft = clamp(left + dx, 0, right - minCropSize);
  }
  if (dragState.handle.includes("e")) {
    nextRight = clamp(right + dx, left + minCropSize, canvas.width);
  }
  if (dragState.handle.includes("n")) {
    nextTop = clamp(top + dy, 0, bottom - minCropSize);
  }
  if (dragState.handle.includes("s")) {
    nextBottom = clamp(bottom + dy, top + minCropSize, canvas.height);
  }

  cropRect = sanitizeCropRect({
    x: nextLeft,
    y: nextTop,
    width: nextRight - nextLeft,
    height: nextBottom - nextTop,
  });
}

function updateCropBoxPosition() {
  if (!cropRect || !cropBox.classList.contains("is-visible")) {
    return;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const stageRect = dropZone.getBoundingClientRect();
  const scaleX = canvasRect.width / canvas.width;
  const scaleY = canvasRect.height / canvas.height;

  cropBox.style.left = `${canvasRect.left - stageRect.left + cropRect.x * scaleX}px`;
  cropBox.style.top = `${canvasRect.top - stageRect.top + cropRect.y * scaleY}px`;
  cropBox.style.width = `${cropRect.width * scaleX}px`;
  cropBox.style.height = `${cropRect.height * scaleY}px`;
}

function endCropDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) {
    return;
  }

  dragState = null;
}

function openBackgroundModal() {
  backgroundModal.classList.add("is-open");
  backgroundModal.setAttribute("aria-hidden", "false");
}

function closeBackgroundModal() {
  backgroundModal.classList.remove("is-open");
  backgroundModal.setAttribute("aria-hidden", "true");
}

function openShapeModal() {
  shapeModal.classList.add("is-open");
  shapeModal.setAttribute("aria-hidden", "false");
}

function closeShapeModal() {
  shapeModal.classList.remove("is-open");
  shapeModal.setAttribute("aria-hidden", "true");
}

function updateBackgroundControls() {
  modeButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.backgroundMode === background.mode);
  });

  solidPanel.classList.toggle("is-hidden", background.mode !== "solid");
  gradientPanel.classList.toggle("is-hidden", background.mode !== "gradient");
  swatchButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.solidColor === background.solid);
  });

  gradientStartButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.gradientStartColor === background.gradientStart);
  });

  gradientEndButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.gradientEndColor === background.gradientEnd);
  });
}

function updateShapeControls() {
  shapeOptionButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.cropShape === cropShape);
  });
}

function downloadImage() {
  if (!sourceBitmap || !cropRect) {
    return;
  }

  const link = document.createElement("a");
  const extension = outputType === "image/webp" ? "webp" : "png";
  const crop = sanitizeCropRect(cropRect, previewWidth, previewHeight);
  const output = createResultCanvas(crop);

  link.download = `${sourceName}-fisheye.${extension}`;
  link.href = output.toDataURL(outputType);
  link.click();
}

function getBackgroundColor(x, y, width, height) {
  if (background.mode === "solid") {
    return hexToRgb(background.solid);
  }

  const start = hexToRgb(background.gradientStart);
  const end = hexToRgb(background.gradientEnd);
  const horizontal = width <= 1 ? 0 : x / (width - 1);
  const vertical = height <= 1 ? 0 : y / (height - 1);
  return mixColor(start, end, clamp(horizontal * 0.74 + vertical * 0.26, 0, 1));
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  return {
    x: clamp((x / rect.width) * canvas.width, 0, canvas.width),
    y: clamp((y / rect.height) * canvas.height, 0, canvas.height),
  };
}

function sanitizeCropRect(rect, boundsWidth = canvas.width, boundsHeight = canvas.height) {
  const width = Math.min(Math.max(rect.width, minCropSize), boundsWidth);
  const height = Math.min(Math.max(rect.height, minCropSize), boundsHeight);

  return {
    x: clamp(rect.x, 0, boundsWidth - width),
    y: clamp(rect.y, 0, boundsHeight - height),
    width,
    height,
  };
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

function hexToRgb(hex) {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function mixColor(start, end, amount) {
  return {
    r: Math.round(lerp(start.r, end.r, amount)),
    g: Math.round(lerp(start.g, end.g, amount)),
    b: Math.round(lerp(start.b, end.b, amount)),
  };
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
