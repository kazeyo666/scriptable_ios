// 自主实现：从本机截图识别紫色校准组件，避免仅凭屏幕分辨率复用旧系统测量。
// 纯像素逻辑同时在本地 WebView 与测试中运行，不上传截图。
function findInfoCalibrationRect(pixels, width, height, family) {
  if (!["small", "medium", "large"].includes(family) || !Number.isInteger(width) || !Number.isInteger(height)
    || width < 100 || height < 100 || width * height > 24000000 || pixels.length !== width * height * 4) throw new Error("校准截图尺寸或数据无效");
  const mask = new Uint8Array(width * height), queue = new Int32Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    const p = i * 4, r = pixels[p], g = pixels[p + 1], b = pixels[p + 2];
    mask[i] = r > 160 && b > 160 && g < 125 && r - g > 90 && b - g > 90 ? 1 : 0;
  }
  const found = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    let head = 0, tail = 1, minX = width, maxX = 0, minY = height, maxY = 0;
    queue[0] = i; mask[i] = 0;
    while (head < tail) {
      const point = queue[head++], x = point % width, y = Math.floor(point / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      const visit = next => { if (mask[next]) { mask[next] = 0; queue[tail++] = next; } };
      if (x) visit(point - 1); if (x + 1 < width) visit(point + 1);
      if (y) visit(point - width); if (y + 1 < height) visit(point + width);
    }
    const w = maxX - minX + 1, h = maxY - minY + 1, ratio = w / h;
    const shape = family === "small" ? ratio >= 0.9 && ratio <= 1.1 : family === "medium" ? ratio >= 1.8 && ratio <= 2.5 : ratio >= 0.85 && ratio <= 1.1;
    const size = family === "small" ? w / width >= 0.3 && w / width <= 0.5 : w / width >= 0.7 && w / width <= 0.95;
    if (shape && size && minY > height * 0.025 && maxY < height * 0.87 && tail / (w * h) >= 0.75) {
      found.push({ x: minX, y: minY, width: w, height: h });
    }
  }
  if (found.length !== 1) throw new Error(found.length ? "识别到多个校准组件，请仅保留一个对应尺寸的紫色组件再截图" : "未识别到对应尺寸的紫色校准组件。请确认参数为 calibrate，等紫色背景显示后再截完整桌面图；使用原色图标模式");
  return found[0];
}

function renderInfoCalibrationWidget() {
  const widget = new ListWidget(); widget.backgroundColor = new Color("#FF00FF");
  widget.setPadding(0, 0, 0, 0); widget.addSpacer();
  const text = widget.addText("背景校准\n请截取完整桌面"); text.textColor = new Color("#FFFFFF");
  text.font = Font.semiboldSystemFont(15); text.centerAlignText(); widget.addSpacer();
  return widget;
}

async function measureInfoCalibration(image, family) {
  InfoLogic.assert(config.runsInApp, "只能在 App 内识别校准截图");
  const base64 = Data.fromPNG(image).toBase64String(), view = new WebView();
  view.shouldAllowRequest = request => String(request.url || "").startsWith("data:") || request.url === "about:blank";
  await view.loadHTML(`<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; script-src 'unsafe-inline'"></head><body><img id="photo" src="data:image/png;base64,${base64}"></body></html>`);
  const script = `const family=${JSON.stringify(family)}; const detect=${findInfoCalibrationRect.toString()};
    const photo=document.getElementById('photo'); let finished=false;
    function done(value){if(!finished){finished=true;clearTimeout(timer);completion(value);}}
    const timer=setTimeout(()=>done({error:'校准图片解码超时，请重选完整截图'}),10000);
    function run(){try{const canvas=document.createElement('canvas'); canvas.width=photo.naturalWidth;canvas.height=photo.naturalHeight;
      const context=canvas.getContext('2d');context.drawImage(photo,0,0);
      done({rect:detect(context.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,family)});
    }catch(error){done({error:error.message});}}
    if(photo.complete && photo.naturalWidth)run();else{photo.onload=run;photo.onerror=()=>done({error:'校准图片无法解码'});}`;
  const result = await view.evaluateJavaScript(script, true);
  InfoLogic.assert(result && !result.error, result?.error || "校准结果为空，请重试");
  return InfoLogic.cropRect(result.rect, image.size);
}
