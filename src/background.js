// 图片只在本地处理。WebView 的 DOM 仅用于 App 内裁剪界面，组件运行不创建 WebView。
function infoCropHTML(base64, size, initial) {
  InfoLogic.cropRect(initial, size);
  InfoLogic.assert(typeof base64 === "string" && /^[A-Za-z0-9+/=]+$/.test(base64), "图片编码无效");
  return `<!doctype html><html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
*{box-sizing:border-box}body{margin:0;padding:18px;font:15px -apple-system,BlinkMacSystemFont,sans-serif;background:#f6f5f1;color:#25313c}
h1{font-size:22px;margin:0 0 8px}p{font-size:13px;color:#65717c;line-height:1.6;margin:8px 0 14px}
#stage{position:relative;margin:auto;width:100%;max-width:290px;line-height:0;overflow:hidden;border-radius:14px;background:#ddd;touch-action:none}
img{display:block;width:100%;height:auto;pointer-events:none}#frame{position:absolute;border:2px solid white;border-radius:12px;box-shadow:0 0 0 1000px #0006;touch-action:none;cursor:move}
#handle{position:absolute;right:-10px;bottom:-10px;width:30px;height:30px;border:3px solid white;border-radius:50%;background:#007aff;touch-action:none}
.fields{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px}label{font-size:12px;color:#65717c}input{width:100%;margin-top:5px;padding:9px 3px;border:1px solid #d6dce1;border-radius:8px;background:white;font-size:14px;text-align:center}
button{width:100%;border:0;border-radius:12px;padding:14px;background:#007aff;color:white;font-size:16px;font-weight:600;margin:14px 0 0}
#message{min-height:38px}@media(prefers-color-scheme:dark){body{background:#161a1e;color:#f1f3f5}p,label{color:#a9b2bc}input{background:#23292f;color:white;border-color:#3a424a}}
</style></head><body><h1>对齐桌面背景</h1>
<p>拖动白框到组件位置，拖动右下角蓝点调整尺寸。初始框仅供参考，可输入像素坐标精调。按实际组件边界校准后确认。</p>
<div id="stage"><img id="image" alt="所选桌面截图" src="data:image/png;base64,${base64}"><div id="frame"><div id="handle"></div></div></div>
<div class="fields"><label>左侧 X<input id="x" type="number" inputmode="numeric"></label><label>顶部 Y<input id="y" type="number" inputmode="numeric"></label><label>宽度<input id="width" type="number" inputmode="numeric"></label><label>高度<input id="height" type="number" inputmode="numeric"></label></div>
<button id="save">确认裁剪范围</button><p id="message">确认后，点顶部的完成按钮返回并保存。直接关闭则取消。</p>
<script>
const imageSize=${JSON.stringify({ width: size.width, height: size.height })};
let box=${JSON.stringify(initial)}, drag=null; window.cropResult=null;
const stage=document.getElementById('stage'), frame=document.getElementById('frame'), handle=document.getElementById('handle');
const message=document.getElementById('message'), save=document.getElementById('save');
const keys=['x','y','width','height'], inputs=Object.fromEntries(keys.map(key=>[key,document.getElementById(key)]));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Math.round(v)));
function invalidate(){window.cropResult=null;frame.style.borderColor='white';save.textContent='确认裁剪范围';message.textContent='确认后，点顶部的完成按钮返回并保存。直接关闭则取消。'}
function draw(){frame.style.left=box.x/imageSize.width*100+'%';frame.style.top=box.y/imageSize.height*100+'%';frame.style.width=box.width/imageSize.width*100+'%';frame.style.height=box.height/imageSize.height*100+'%';keys.forEach(key=>inputs[key].value=box[key]);}
frame.addEventListener('pointerdown',event=>{event.preventDefault();drag={resize:event.target===handle,x:event.clientX,y:event.clientY,box:{...box}};frame.setPointerCapture(event.pointerId);invalidate();});
frame.addEventListener('pointermove',event=>{if(!drag)return;const scale=imageSize.width/stage.getBoundingClientRect().width,dx=(event.clientX-drag.x)*scale,dy=(event.clientY-drag.y)*scale;
if(drag.resize){box.width=clamp(drag.box.width+dx,1,imageSize.width-box.x);box.height=clamp(drag.box.height+dy,1,imageSize.height-box.y);}
else{box.x=clamp(drag.box.x+dx,0,imageSize.width-box.width);box.y=clamp(drag.box.y+dy,0,imageSize.height-box.height);}draw();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])frame.addEventListener(event,()=>drag=null);
keys.forEach(key=>inputs[key].addEventListener('change',()=>{const value=Number(inputs[key].value);if(!Number.isFinite(value)){draw();return;}
const limits={x:[0,imageSize.width-box.width],y:[0,imageSize.height-box.height],width:[1,imageSize.width-box.x],height:[1,imageSize.height-box.y]};box[key]=clamp(value,...limits[key]);invalidate();draw();}));
save.addEventListener('click',()=>{window.cropResult={...box};frame.style.borderColor='#34c759';save.textContent='已确认';message.textContent='裁剪范围已确认。请点顶部的完成按钮返回，背景会保存到本机。';});draw();
</script></body></html>`;
}

async function editInfoCrop(image, family, position) {
  InfoLogic.assert(config.runsInApp, "请在 Scriptable App 内设置背景");
  const initial = InfoLogic.cropSuggestion(image.size, family, position);
  const view = new WebView();
  view.shouldAllowRequest = request => String(request.url || "").startsWith("data:") || request.url === "about:blank";
  await view.loadHTML(infoCropHTML(Data.fromPNG(image).toBase64String(), image.size, initial));
  await view.present(false);
  const result = await view.evaluateJavaScript("window.cropResult", false);
  return result ? InfoLogic.cropRect(result, image.size) : null;
}

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
