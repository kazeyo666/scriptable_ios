// 原生图片处理：透明背景使用内置桌面尺寸表自动裁剪，不创建 WebView。
function cropInfoImage(image, rect) {
  const box = InfoLogic.cropRect(rect, image.size), draw = new DrawContext();
  draw.respectScreenScale = false; draw.opaque = true;
  draw.size = new Size(box.width, box.height);
  draw.drawImageAtPoint(image, new Point(-box.x, -box.y));
  return draw.getImage();
}

function dimInfoImage(image, amount) {
  if (!amount) return image;
  const draw = new DrawContext(); draw.respectScreenScale = false; draw.opaque = true; draw.size = image.size;
  const rect = new Rect(0, 0, image.size.width, image.size.height);
  draw.drawImageInRect(image, rect); draw.setFillColor(new Color("#000000", amount)); draw.fillRect(rect);
  return draw.getImage();
}

// App 内生成一次三种尺寸的图片；Widget 只读取已保存的 PNG，避免每次解码原始大照片。
function photoInfoImage(image, family, amount) {
  const ratio = { small: 1, medium: 2.14, large: 0.955 }[family];
  const width = Math.min(image.size.width, image.size.height * ratio), height = width / ratio;
  const x = (image.size.width - width) / 2, y = (image.size.height - height) / 2;
  const draw = new DrawContext(); draw.respectScreenScale = false; draw.opaque = true;
  const targetWidth = Math.min(1200, Math.round(width));
  draw.size = new Size(targetWidth, Math.max(1, Math.round(targetWidth / ratio)));
  const scale = targetWidth / width;
  draw.drawImageInRect(image, new Rect(-x * scale, -y * scale, image.size.width * scale, image.size.height * scale));
  return dimInfoImage(draw.getImage(), amount);
}
