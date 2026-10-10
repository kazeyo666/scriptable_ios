// 仅开发时运行：用 Node/ICU 中国历重建内置年表，随后运行 tools/build.mjs。
import fs from "node:fs";
const path = new URL("../src/logic.js", import.meta.url);
const formatter=new Intl.DateTimeFormat('en-u-ca-chinese',{timeZone:'UTC',year:'numeric',month:'numeric',day:'numeric'});
const years=new Map();
for(let t=Date.UTC(1900,0,31);t<Date.UTC(2101,2,1);t+=86400000){
 const p=Object.fromEntries(formatter.formatToParts(new Date(t)).map(p=>[p.type,p.value]));
 const y=+p.relatedYear,m=parseInt(p.month),leap=p.month.includes('bis');
 if(y<1900||y>2100)continue;
 if(!years.has(y))years.set(y,[]);
 const months=years.get(y);
 if(+p.day===1)months.push({m,leap,days:1});else months[months.length-1].days=+p.day;
}
const bits=[...years.values()].map(months=>months.reduce((bits,m)=>bits|(m.leap?(m.m|(m.days===30?0x10000:0)):(m.days===30?0x10000>>m.m:0)),0));
const source = fs.readFileSync(path, "utf8");
const table = `const lunarYears = [${bits.map(n => "0x" + n.toString(16)).join(",")}];`;
const updated = source.replace(/const lunarYears = \[.*?\];/, table);
if (updated === source) console.log("农历年表一致");
else { fs.writeFileSync(path, updated); console.log("已更新农历年表，请重新构建脚本"); }
