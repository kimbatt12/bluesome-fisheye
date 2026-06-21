const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("previewCanvas");
const context = canvas.getContext("2d", { willReadFrequently: true });
const cropBox = document.getElementById("cropBox");
const shapeButton = document.getElementById("shapeButton");
const backgroundButton = document.getElementById("backgroundButton");
const borderButton = document.getElementById("borderButton");
const previewButton = document.getElementById("previewButton");
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
const borderModal = document.getElementById("borderModal");
const closeBorderButton = document.getElementById("closeBorderButton");
const solidPanel = document.getElementById("solidPanel");
const gradientPanel = document.getElementById("gradientPanel");
const borderBlurPanel = document.getElementById("borderBlurPanel");
const borderColorPanel = document.getElementById("borderColorPanel");
const solidColorInput = document.getElementById("solidColorInput");
const gradientStartInput = document.getElementById("gradientStartInput");
const gradientEndInput = document.getElementById("gradientEndInput");
const borderColorInput = document.getElementById("borderColorInput");
const borderSizeInput = document.getElementById("borderSizeInput");
const borderSizeOutput = document.getElementById("borderSizeOutput");
const borderBlurInput = document.getElementById("borderBlurInput");
const borderBlurOutput = document.getElementById("borderBlurOutput");
const modeButtons = document.querySelectorAll("[data-background-mode]");
const borderModeButtons = document.querySelectorAll("[data-border-mode]");
const swatchButtons = document.querySelectorAll("[data-solid-color]");
const gradientStartButtons = document.querySelectorAll("[data-gradient-start-color]");
const gradientEndButtons = document.querySelectorAll("[data-gradient-end-color]");
const borderColorButtons = document.querySelectorAll("[data-border-color]");
const shapeOptionButtons = document.querySelectorAll("[data-crop-shape]");

const minCropSize = 48;
const stageImagePadding = 28;
const defaultBackground = {
  mode: "solid",
  solid: "#ffffff",
  gradientStart: "#ffd02f",
  gradientEnd: "#4262ff",
};
const defaultBorderStyle = {
  mode: "none",
  color: "#ffffff",
  size: 14,
  blur: 50,
};

let sourceBitmap = null;
let sourceName = "fisheye-image";
let outputType = "image/png";
let previewWidth = 0;
let previewHeight = 0;
let cropRect = null;
let dragState = null;
let cropShape = "circle";
let isPreviewMode = false;
let background = { ...defaultBackground };
let borderStyle = { ...defaultBorderStyle };
let sourceCanvas = null;
let sourceContext = null;
let sourceImageData = null;
let resultCanvas = null;
let resultContext = null;
let resultImageData = null;

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

backgroundButton.addEventListener("click", openBackgroundModal);
shapeButton.addEventListener("click", openShapeModal);
borderButton.addEventListener("click", openBorderModal);
previewButton.addEventListener("click", togglePreviewMode);
closeBackgroundButton.addEventListener("click", closeBackgroundModal);
closeShapeButton.addEventListener("click", closeShapeModal);
closeBorderButton.addEventListener("click", closeBorderModal);
downloadButton.addEventListener("click", downloadImage);
resetButton.addEventListener("click", resetToUploadedState);
window.addEventListener("resize", updateCropBoxPosition);

closeOnBackdropClick(backgroundModal, closeBackgroundModal);
closeOnBackdropClick(shapeModal, closeShapeModal);
closeOnBackdropClick(borderModal, closeBorderModal);

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    background.mode = button.dataset.backgroundMode;
    updateBackgroundControls();
    renderLivePreview();
  });
});

borderModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    borderStyle.mode = button.dataset.borderMode;
    updateBorderControls();
    renderLivePreview();
  });
});

bindBackgroundChoice(swatchButtons, "solid", "solidColor", solidColorInput, "solid");
bindBackgroundChoice(gradientStartButtons, "gradientStart", "gradientStartColor", gradientStartInput, "gradient");
bindBackgroundChoice(gradientEndButtons, "gradientEnd", "gradientEndColor", gradientEndInput, "gradient");

shapeOptionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    cropShape = button.dataset.cropShape;
    updateShapeControls();
    renderLivePreview();
  });
});

bindBackgroundInput(solidColorInput, "solid", "solid");
bindBackgroundInput(gradientStartInput, "gradientStart", "gradient");
bindBackgroundInput(gradientEndInput, "gradientEnd", "gradient");

borderColorButtons.forEach((button) => {
  button.addEventListener("click", () => {
    borderStyle.mode = "color";
    borderStyle.color = button.dataset.borderColor;
    borderColorInput.value = borderStyle.color;
    updateBorderControls();
    renderLivePreview();
  });
});

borderColorInput.addEventListener("input", () => {
  borderStyle.mode = "color";
  borderStyle.color = borderColorInput.value;
  updateBorderControls();
  renderLivePreview();
});

borderSizeInput.addEventListener("input", () => {
  borderStyle.size = Number(borderSizeInput.value);
  borderSizeOutput.value = borderSizeInput.value;
  renderLivePreview();
});

borderBlurInput.addEventListener("input", () => {
  borderStyle.mode = "blur";
  borderStyle.blur = Number(borderBlurInput.value);
  borderBlurOutput.value = borderBlurInput.value;
  updateBorderControls();
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

function closeOnBackdropClick(modal, closeModal) {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });
}

function bindBackgroundChoice(buttons, backgroundKey, datasetKey, input, mode) {
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      background.mode = mode;
      background[backgroundKey] = button.dataset[datasetKey];
      input.value = background[backgroundKey];
      updateBackgroundControls();
      renderLivePreview();
    });
  });
}

function bindBackgroundInput(input, backgroundKey, mode) {
  input.addEventListener("input", () => {
    background.mode = mode;
    background[backgroundKey] = input.value;
    updateBackgroundControls();
    renderLivePreview();
  });
}

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
    borderButton.disabled = false;
    previewButton.disabled = false;
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
  borderButton.disabled = false;
  previewButton.disabled = false;
  downloadButton.disabled = false;
  renderLivePreview();
  updateCropBoxPosition();
  setStatus("업로드 초기 상태로 되돌림");
}

function resetControlsToDefaults() {
  background = { ...defaultBackground };
  borderStyle = { ...defaultBorderStyle };
  isPreviewMode = false;
  strengthInput.value = "0";
  strengthOutput.value = "0";
  cropShape = "circle";
  solidColorInput.value = background.solid;
  gradientStartInput.value = background.gradientStart;
  gradientEndInput.value = background.gradientEnd;
  borderColorInput.value = borderStyle.color;
  borderSizeInput.value = String(borderStyle.size);
  borderSizeOutput.value = String(borderStyle.size);
  borderBlurInput.value = String(borderStyle.blur);
  borderBlurOutput.value = String(borderStyle.blur);
  updateBackgroundControls();
  updateBorderControls();
  updatePreviewControls();
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
  ensureCanvasSize(canvas, previewWidth, previewHeight);
  updateStageSize(previewWidth, previewHeight);
  sourceImageData = null;
  resultImageData = null;
}

function updateStageSize(contentWidth, contentHeight) {
  const stageWidth = contentWidth + stageImagePadding * 2;
  const stageHeight = contentHeight + stageImagePadding * 2;
  dropZone.style.setProperty("--stage-width", `${stageWidth}px`);
  dropZone.style.setProperty("--stage-padding", `${stageImagePadding}px`);
  dropZone.style.setProperty("--stage-aspect", `${stageWidth} / ${stageHeight}`);
}

function renderLivePreview() {
  if (!sourceBitmap || !cropRect) {
    return;
  }

  const crop = sanitizeCropRect(cropRect, previewWidth, previewHeight);
  const output = createResultCanvas(crop);

  if (isPreviewMode) {
    ensureCanvasSize(canvas, output.width, output.height);
    updateStageSize(output.width, output.height);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(output, 0, 0);
    return;
  }

  ensureCanvasSize(canvas, previewWidth, previewHeight);
  updateStageSize(previewWidth, previewHeight);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(output, crop.x, crop.y);
}

function createResultCanvas(crop) {
  const outputWidth = Math.max(1, Math.round(crop.width));
  const outputHeight = Math.max(1, Math.round(crop.height));
  const outputCanvas = getResultCanvas(outputWidth, outputHeight);
  const source = getSourceImageData();
  const result = getResultImageData(outputWidth, outputHeight);
  const sourceData = source.data;
  const targetData = result.data;
  const strength = Number(strengthInput.value) / 100;
  const intensity = strength * 1.4;
  const backgroundColors = getBackgroundColors();

  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const targetIndex = (y * outputWidth + x) * 4;

      if (!isInsideShape(x, y, outputWidth, outputHeight)) {
        fillBackgroundPixel(targetData, targetIndex, x, y, outputWidth, outputHeight, backgroundColors);
        continue;
      }

      sampleBilinearPoint(
        sourceData,
        targetData,
        previewWidth,
        previewHeight,
        crop,
        x,
        y,
        outputWidth,
        outputHeight,
        strength,
        intensity,
        targetIndex,
      );
    }
  }

  applyBorderEffect(targetData, outputWidth, outputHeight);
  resultContext.putImageData(result, 0, 0);
  return outputCanvas;
}

function ensureCanvasSize(targetCanvas, width, height) {
  if (targetCanvas.width !== width) {
    targetCanvas.width = width;
  }
  if (targetCanvas.height !== height) {
    targetCanvas.height = height;
  }
}

function getSourceImageData() {
  if (sourceImageData) {
    return sourceImageData;
  }

  if (!sourceCanvas) {
    sourceCanvas = document.createElement("canvas");
    sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  }

  ensureCanvasSize(sourceCanvas, previewWidth, previewHeight);
  sourceContext.drawImage(sourceBitmap, 0, 0, previewWidth, previewHeight);
  sourceImageData = sourceContext.getImageData(0, 0, previewWidth, previewHeight);
  return sourceImageData;
}

function getResultCanvas(width, height) {
  if (!resultCanvas) {
    resultCanvas = document.createElement("canvas");
    resultContext = resultCanvas.getContext("2d", { willReadFrequently: true });
  }

  ensureCanvasSize(resultCanvas, width, height);
  return resultCanvas;
}

function getResultImageData(width, height) {
  if (!resultImageData || resultImageData.width !== width || resultImageData.height !== height) {
    resultImageData = resultContext.createImageData(width, height);
  }

  return resultImageData;
}

function sampleBilinearPoint(
  source,
  target,
  width,
  height,
  crop,
  x,
  y,
  outputWidth,
  outputHeight,
  strength,
  intensity,
  targetIndex,
) {
  let sampleX = x;
  let sampleY = y;

  if (strength !== 0) {
    const centerX = (outputWidth - 1) / 2;
    const centerY = (outputHeight - 1) / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    const lensRadius = Math.min(outputWidth, outputHeight) / 2;
    const distance = Math.hypot(dx, dy);
    const normalized = distance / lensRadius;
    const sourceRadius = Math.pow(normalized, 1 + intensity) * lensRadius;
    const scale = distance === 0 ? 0 : sourceRadius / distance;
    sampleX = centerX + dx * scale;
    sampleY = centerY + dy * scale;
  }

  const sourceX = crop.x + sampleX;
  const sourceY = crop.y + sampleY;
  const x0 = clamp(Math.floor(sourceX), 0, width - 1);
  const y0 = clamp(Math.floor(sourceY), 0, height - 1);
  const x1 = clamp(x0 + 1, 0, width - 1);
  const y1 = clamp(y0 + 1, 0, height - 1);
  const tx = sourceX - x0;
  const ty = sourceY - y0;

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

function applyBorderEffect(target, width, height) {
  if (borderStyle.mode === "none") {
    return;
  }

  const borderSize = Math.max(1, Math.min(Number(borderStyle.size), Math.min(width, height) / 2));

  if (borderStyle.mode === "color") {
    applyColorBorder(target, width, height, borderSize, hexToRgb(borderStyle.color));
    return;
  }

  applyBlurBorder(target, width, height, borderSize, borderStyle.blur);
}

function applyColorBorder(target, width, height, borderSize, color) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edgeDistance = getShapeEdgeDistance(x, y, width, height);

      if (edgeDistance >= 0 && edgeDistance <= borderSize) {
        fillPixel(target, (y * width + x) * 4, color);
      }
    }
  }
}

function applyBlurBorder(target, width, height, borderSize, blurStrength) {
  const source = target.slice();
  const radius = Math.min(12, Math.max(1, Math.round((borderSize * blurStrength) / 200)));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edgeDistance = getShapeEdgeDistance(x, y, width, height);

      if (edgeDistance < 0 || edgeDistance > borderSize) {
        continue;
      }

      blurPixel(source, target, width, height, x, y, radius);
    }
  }
}

function blurPixel(source, target, width, height, x, y, radius) {
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;
  let samples = 0;

  for (let sampleY = y - radius; sampleY <= y + radius; sampleY += 1) {
    for (let sampleX = x - radius; sampleX <= x + radius; sampleX += 1) {
      const clampedX = clamp(sampleX, 0, width - 1);
      const clampedY = clamp(sampleY, 0, height - 1);
      const sourceIndex = (clampedY * width + clampedX) * 4;
      red += source[sourceIndex];
      green += source[sourceIndex + 1];
      blue += source[sourceIndex + 2];
      alpha += source[sourceIndex + 3];
      samples += 1;
    }
  }

  const targetIndex = (y * width + x) * 4;
  target[targetIndex] = Math.round(red / samples);
  target[targetIndex + 1] = Math.round(green / samples);
  target[targetIndex + 2] = Math.round(blue / samples);
  target[targetIndex + 3] = Math.round(alpha / samples);
}

function getShapeEdgeDistance(x, y, width, height) {
  if (cropShape === "square") {
    return Math.min(x, y, width - 1 - x, height - 1 - y);
  }

  if (cropShape === "rounded") {
    return getRoundedRectEdgeDistance(x, y, width, height);
  }

  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const radius = Math.min(width, height) / 2;
  return radius - Math.hypot(x - centerX, y - centerY);
}

function getRoundedRectEdgeDistance(x, y, width, height) {
  const radius = Math.min(width, height) * 0.18;
  const left = radius;
  const right = width - radius;
  const top = radius;
  const bottom = height - radius;

  if (x >= left && x <= right) {
    return Math.min(y, height - 1 - y);
  }
  if (y >= top && y <= bottom) {
    return Math.min(x, width - 1 - x);
  }

  const cornerX = x < left ? left : right;
  const cornerY = y < top ? top : bottom;
  return radius - Math.hypot(x - cornerX, y - cornerY);
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
  setModalOpen(backgroundModal, true);
}

function closeBackgroundModal() {
  setModalOpen(backgroundModal, false);
}

function openShapeModal() {
  setModalOpen(shapeModal, true);
}

function closeShapeModal() {
  setModalOpen(shapeModal, false);
}

function openBorderModal() {
  setModalOpen(borderModal, true);
}

function closeBorderModal() {
  setModalOpen(borderModal, false);
}

function togglePreviewMode() {
  if (!sourceBitmap) {
    return;
  }

  isPreviewMode = !isPreviewMode;
  updatePreviewControls();
  renderLivePreview();
  updateCropBoxPosition();
}

function setModalOpen(modal, isOpen) {
  modal.classList.toggle("is-open", isOpen);
  modal.setAttribute("aria-hidden", String(!isOpen));
}

function updateBackgroundControls() {
  updateSelectedButtons(modeButtons, "backgroundMode", background.mode);

  solidPanel.classList.toggle("is-hidden", background.mode !== "solid");
  gradientPanel.classList.toggle("is-hidden", background.mode !== "gradient");

  updateSelectedButtons(swatchButtons, "solidColor", background.solid);
  updateSelectedButtons(gradientStartButtons, "gradientStartColor", background.gradientStart);
  updateSelectedButtons(gradientEndButtons, "gradientEndColor", background.gradientEnd);
}

function updateShapeControls() {
  updateSelectedButtons(shapeOptionButtons, "cropShape", cropShape);
}

function updateBorderControls() {
  updateSelectedButtons(borderModeButtons, "borderMode", borderStyle.mode);
  updateSelectedButtons(borderColorButtons, "borderColor", borderStyle.color);
  borderBlurPanel.classList.toggle("is-hidden", borderStyle.mode !== "blur");
  borderColorPanel.classList.toggle("is-hidden", borderStyle.mode !== "color");
}

function updatePreviewControls() {
  cropBox.classList.toggle("is-visible", !isPreviewMode);
  previewButton.classList.toggle("is-active", isPreviewMode);
  previewButton.setAttribute("aria-pressed", String(isPreviewMode));
}

function updateSelectedButtons(buttons, datasetKey, selectedValue) {
  buttons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset[datasetKey] === selectedValue);
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

function getBackgroundColors() {
  if (background.mode === "solid") {
    return {
      mode: "solid",
      solid: hexToRgb(background.solid),
    };
  }

  return {
    mode: "gradient",
    start: hexToRgb(background.gradientStart),
    end: hexToRgb(background.gradientEnd),
  };
}

function fillBackgroundPixel(target, targetIndex, x, y, width, height, colors) {
  if (colors.mode === "solid") {
    fillPixel(target, targetIndex, colors.solid);
    return;
  }

  const horizontal = width <= 1 ? 0 : x / (width - 1);
  const vertical = height <= 1 ? 0 : y / (height - 1);
  const amount = clamp(horizontal * 0.74 + vertical * 0.26, 0, 1);
  target[targetIndex] = Math.round(lerp(colors.start.r, colors.end.r, amount));
  target[targetIndex + 1] = Math.round(lerp(colors.start.g, colors.end.g, amount));
  target[targetIndex + 2] = Math.round(lerp(colors.start.b, colors.end.b, amount));
  target[targetIndex + 3] = 255;
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

function setStatus(message) {
  statusText.textContent = message;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}
