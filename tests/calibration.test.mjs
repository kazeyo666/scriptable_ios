import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { harness, plain } from "./helpers.mjs";

function fixture(width, height, rectangles) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (const rect of rectangles) for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) {
    const p = (y * width + x) * 4;
    pixels[p] = 255; pixels[p + 2] = 255; pixels[p + 3] = 255;
  }
  return pixels;
}
test("从实际像素识别三种尺寸，圆角与文字孔洞不改变真实矩形", () => {
  const h = harness(), width = 402, height = 874;
  for (const [family, rect] of Object.entries({small:{x:27,y:87,width:160,height:160},medium:{x:27,y:87,width:348,height:160},large:{x:27,y:87,width:348,height:366}})) {
    const pixels = fixture(width,height,[rect]);
    for (const corner of [rect.x,rect.x+rect.width-8]) for(let y=rect.y;y<rect.y+8;y++) for(let x=corner;x<corner+8;x++) pixels[(y*width+x)*4+2]=0;
    for(let y=rect.y+50;y<rect.y+70;y++)for(let x=rect.x+30;x<rect.x+100;x++)pixels[(y*width+x)*4+1]=255;
    assert.deepEqual(plain(h.detectCalibration(pixels,width,height,family)),rect);
  }
});
test("全分辨率像素识别不因机型共用屏幕尺寸而套旧边界", () => {
  const h=harness(), size={width:1206,height:2622}, rect={x:81,y:261,width:1044,height:1098};
  assert.deepEqual(plain(h.detectCalibration(fixture(size.width,size.height,[rect]),size.width,size.height,"large")),rect);
  assert.notDeepEqual(rect,plain(h.geometry.rect(size,"large",0,"text")));
});
test("无标记、多个标记、尺寸不符及输入错误明确拒绝", () => {
  const h=harness(), size={width:402,height:874};
  for(const rectangles of [[],[{x:10,y:100,width:80,height:80}],[{x:27,y:87,width:160,height:160},{x:210,y:87,width:160,height:160}]]) assert.throws(()=>h.detectCalibration(fixture(size.width,size.height,rectangles),size.width,size.height,"small"));
  assert.throws(()=>h.detectCalibration(new Uint8Array(0),size.width,size.height,"large"));
});
test("calibrate 参数在 Widget 中只呈现校准色，无菜单、网络或数据修改", async () => {
  const h=harness({parameter:"calibrate",systemVersion:"27.0"}); await h.suite.run("dashboard");
  assert.equal(h.rendered.backgroundColor.value,"#FF00FF"); assert.equal(h.files.size,0); assert.equal(h.dialogs.length,0);assert.equal(h.requests.length,0);
  const remote=harness({parameter:"dashboard|calibrate",systemVersion:"27.0"});
  await remote.evaluate(readFileSync(new URL("../RemoteLauncher.js",import.meta.url),"utf8"));
  assert.equal(remote.rendered.backgroundColor.value,"#FF00FF"); assert.equal(remote.dialogs.length,0);
});
test("iOS 27 本机自动校准保存测量值，复用时不再走旧表", async () => {
  const rect={x:81,y:261,width:1044,height:1098};
  const h=harness({app:true,systemVersion:"27.0",image:{size:{width:1206,height:2622}},calibrationResult:{rect},responses:[10,8,1,0,0,0,0,0,-1,-1]});
  await h.suite.run("dashboard");
  const bg=h.suite.read("settings").data.background;
  assert.equal(bg.mode,"transparent");assert.deepEqual(plain(bg.calibration.large.rect),rect);
  assert.equal(h.webviews.length,1);assert.equal(h.previews[0].family,"large");assert.ok(h.rendered.backgroundImage);
  assert.equal(h.webviews[0].shouldAllowRequest({url:"https://example.com"}),false);
  const saved=plain(h.suite.backupObject());assert.deepEqual(saved.data.settings.background.calibration.large.rect,rect);
  const next=harness({app:true,systemVersion:"27.0",files:Object.fromEntries(h.files),image:{size:{width:1206,height:2622}},responses:[10,0,0,0,0,0,-1,-1]});
  await next.suite.run("dashboard");assert.equal(next.webviews.length,0);
  assert.equal(next.dialogs.some(a=>a.title==="桌面图标大小"),false);
  assert.deepEqual(plain(next.drawings[0].operations[0].point),{x:-81,y:-261});assert.equal(next.drawings[0].size.width,1044);
});
test("新系统优先提示校准；解码错误或第二张图尺寸错误不保存", async () => {
  const route=harness({app:true,systemVersion:"27.0",responses:[10,0,0,-1,-1,-1]});await route.suite.run("dashboard");
  assert.ok(route.dialogs.some(d=>d.title==="新系统桌面布局"));assert.equal(route.suite.read("settings").data.background.mode,"theme");
  for(const options of [{calibrationResult:{error:"未识别到校准组件"},responses:[10,8,1,0,0,0,0,-1]},
    {calibrationResult:{rect:{x:78,y:231,width:1014,height:1062}},cancelPhotoAt:1,responses:[10,8,1,0,0,0,0,-1,-1]},
    {calibrationResult:{rect:{x:78,y:231,width:1014,height:1062}},images:[{size:{width:1170,height:2532}},{size:{width:1206,height:2622}}],responses:[10,8,1,0,0,0,0,0,-1]}]) {
    const h=harness({app:true,...options});await h.suite.run("dashboard");
    assert.equal(h.suite.read("settings").data.background.mode,"theme");assert.equal(h.previews.length,0);
  }
});
test("校准数据的越界和位置错误被拒绝，旧背景配置自动补齐空校准", () => {
  const h=harness(), bg=plain(h.logic.backgroundDefaults());delete bg.calibration;
  assert.deepEqual(plain(h.logic.validateBackground(bg).calibration),{small:null,medium:null,large:null});
  for(const entry of [{width:1206,height:2622,position:0,rect:{x:-1,y:261,width:1044,height:1098}}, {width:1206,height:2622,position:2,rect:{x:81,y:261,width:1044,height:1098}}]) {
    assert.throws(()=>h.logic.validateBackground({...bg,calibration:{large:entry}}));
  }
});
