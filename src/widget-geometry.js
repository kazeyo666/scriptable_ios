// 桌面组件像素测量改编自 mzeryck/Widget-Blur，仅复用测量表，未引入模糊算法。
// https://github.com/mzeryck/Widget-Blur/blob/main/widget-blur.js
/*
MIT License

Copyright (c) 2022 Maxwell Zeryck

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
const InfoWidgetGeometry = (() => {
  const devices = {
  "1136": {
    "width": 640,
    "layout": {
      "small": 282,
      "medium": 584,
      "large": 622,
      "left": 30,
      "right": 332,
      "top": 59,
      "middle": 399,
      "bottom": 399
    }
  },
  "1334": {
    "width": 750,
    "layout": {
      "text": {
        "small": 296,
        "medium": 642,
        "large": 648,
        "left": 54,
        "right": 400,
        "top": 60,
        "middle": 412,
        "bottom": 764
      },
      "notext": {
        "small": 309,
        "medium": 667,
        "large": 667,
        "left": 41,
        "right": 399,
        "top": 67,
        "middle": 425,
        "bottom": 783
      }
    }
  },
  "1624": {
    "width": 750,
    "layout": {
      "small": 310,
      "medium": 658,
      "large": 690,
      "left": 46,
      "right": 394,
      "top": 142,
      "middle": 522,
      "bottom": 902
    }
  },
  "1792": {
    "width": 828,
    "layout": {
      "small": 338,
      "medium": 720,
      "large": 758,
      "left": 55,
      "right": 437,
      "top": 159,
      "middle": 579,
      "bottom": 999
    }
  },
  "2001": {
    "width": 1125,
    "layout": {
      "small": 444,
      "medium": 963,
      "large": 972,
      "left": 81,
      "right": 600,
      "top": 90,
      "middle": 618,
      "bottom": 1146
    }
  },
  "2079": {
    "width": 960,
    "layout": {
      "small": 423,
      "medium": 875,
      "large": 933,
      "left": 42,
      "right": 494,
      "top": 186,
      "middle": 696,
      "bottom": 1206
    }
  },
  "2208": {
    "width": 1242,
    "layout": {
      "small": 471,
      "medium": 1044,
      "large": 1071,
      "left": 99,
      "right": 672,
      "top": 114,
      "middle": 696,
      "bottom": 1278
    }
  },
  "2436": {
    "width": 1125,
    "layout": {
      "x": {
        "small": 465,
        "medium": 987,
        "large": 1035,
        "left": 69,
        "right": 591,
        "top": 213,
        "middle": 783,
        "bottom": 1353
      },
      "mini": {
        "small": 465,
        "medium": 987,
        "large": 1035,
        "left": 69,
        "right": 591,
        "top": 231,
        "middle": 801,
        "bottom": 1371
      }
    }
  },
  "2532": {
    "width": 1170,
    "layout": {
      "small": 474,
      "medium": 1014,
      "large": 1062,
      "left": 78,
      "right": 618,
      "top": 231,
      "middle": 819,
      "bottom": 1407
    }
  },
  "2556": {
    "width": 1179,
    "layout": {
      "text": {
        "small": 474,
        "medium": 1017,
        "large": 1062,
        "left": 81,
        "right": 624,
        "top": 240,
        "middle": 828,
        "bottom": 1416
      },
      "notext": {
        "small": 495,
        "medium": 1047,
        "large": 1047,
        "left": 66,
        "right": 618,
        "top": 243,
        "middle": 795,
        "bottom": 1347
      }
    }
  },
  "2622": {
    "width": 1206,
    "layout": {
      "text": {
        "small": 486,
        "medium": 1032,
        "large": 1098,
        "left": 87,
        "right": 633,
        "top": 261,
        "middle": 872,
        "bottom": 1485
      },
      "notext": {
        "small": 495,
        "medium": 1037,
        "large": 1035,
        "left": 84,
        "right": 626,
        "top": 270,
        "middle": 810,
        "bottom": 1350
      }
    }
  },
  "2688": {
    "width": 1242,
    "layout": {
      "small": 507,
      "medium": 1080,
      "large": 1137,
      "left": 81,
      "right": 654,
      "top": 228,
      "middle": 858,
      "bottom": 1488
    }
  },
  "2778": {
    "width": 1284,
    "layout": {
      "small": 510,
      "medium": 1092,
      "large": 1146,
      "left": 96,
      "right": 678,
      "top": 246,
      "middle": 882,
      "bottom": 1518
    }
  },
  "2796": {
    "width": 1290,
    "layout": {
      "text": {
        "small": 510,
        "medium": 1092,
        "large": 1146,
        "left": 98,
        "right": 681,
        "top": 252,
        "middle": 888,
        "bottom": 1524
      },
      "notext": {
        "small": 530,
        "medium": 1139,
        "large": 1136,
        "left": 75,
        "right": 684,
        "top": 252,
        "middle": 858,
        "bottom": 1464
      }
    }
  },
  "2868": {
    "width": 1320,
    "layout": {
      "text": {
        "small": 510,
        "medium": 1092,
        "large": 1146,
        "left": 114,
        "right": 696,
        "top": 276,
        "middle": 912,
        "bottom": 1548
      },
      "notext": {
        "small": 530,
        "medium": 1138,
        "large": 1136,
        "left": 91,
        "right": 699,
        "top": 276,
        "middle": 882,
        "bottom": 1488
      }
    }
  }
};
  const labels = {text:"小图标（有名称）",notext:"大图标（无名称）",mini:"iPhone 12 / 13 mini",x:"iPhone X / XS / 11 Pro"};
  function options(size) {
    const device = devices[size.height];
    InfoLogic.assert(device && device.width === size.width, `暂未适配此截图尺寸 ${size.width}×${size.height}，请使用本机完整桌面截图；不会猜测裁剪范围。`);
    return device.layout.small ? [{key:"standard",label:"常规桌面"}] : Object.keys(device.layout).map(key=>({key,label:labels[key]}));
  }
  function rect(size, family, position, variant = "standard") {
    const choices = options(size);
    InfoLogic.assert(choices.some(item=>item.key===variant), "桌面布局选项无效");
    InfoLogic.assert(["small","medium","large"].includes(family) && Number.isInteger(position) && position >= 0 && position < (family === "small" ? 6 : family === "medium" ? 3 : 2), "组件尺寸或位置无效");
    const base=devices[size.height].layout, grid=variant === "standard" ? base : base[variant];
    const row=family === "small" ? Math.floor(position/2) : position;
    return InfoLogic.cropRect({x:family === "small" && position%2 ? grid.right : grid.left, y:grid[["top","middle","bottom"][row]], width:family === "small" ? grid.small : grid.medium, height:family === "large" ? grid.large : grid.small},size);
  }
  // 本次用户两张同壁纸截图中，大号顶部矩形的可见边界。
  // 这是该用户布局的截图测量，不是 iPhone 17/iOS 27 的通用官方尺寸。
  // 两张附件均为 588×1280；原分辨率按轴独立换算，允许有重采样误差。
  function measuredIphone17Rect(size) {
    InfoLogic.assert(size && ((size.width === 1206 && size.height === 2622) || (size.width === 588 && size.height === 1280)),
      "此已测量布局仅匹配 iPhone 17 的 1206×2622 完整截图，或你提供的 588×1280 截图。请选择同一显示设置的空白壁纸图。");
    const reference = { x: 38, y: 132, width: 512, height: 534 };
    const x = Math.round(reference.x * size.width / 588), y = Math.round(reference.y * size.height / 1280);
    const right = Math.round((reference.x + reference.width) * size.width / 588);
    const bottom = Math.round((reference.y + reference.height) * size.height / 1280);
    return InfoLogic.cropRect({ x, y, width: right - x, height: bottom - y }, size);
  }
  return {options,rect,measuredIphone17Rect};
})();
