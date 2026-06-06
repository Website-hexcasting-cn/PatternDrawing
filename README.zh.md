# PatternDrawing

Hexcasting 模组的六边形网格图案绘制库。提供可自定义颜色、网格间距和渲染模式的画布用于绘制六边形图案。

## 功能特性

- 六边形网格渲染，支持鼠标交互
- 图案绘制，记录笔画顺序
- 可自定义点大小、网格间距、线宽和颜色
- 线条和点的渐变支持
- 距离渐隐效果
- 自由绘画模式和拖拽绘制模式
- 抖动效果（Zappy）
- 图案代码导出（Hexprase 法术格式）

## 使用方法

```html
<canvas id="PatternCanvas"></canvas>
<script src="PatternDrawing.js"></script>
<script>
  const canvas = CreatePatternCanvas()
</script>
```

## 配置项

```js
const config = {
  Point: {
    Color: '#7fffe6',      // 点内部颜色
    MinColor: '#66ccc8',   // 点外部颜色
    Size: 5                // 点大小
  },
  Grid: {
    Spacing: 80            // 网格间距（像素）
  },
  Line: {
    TailColor: '#64c8ff',  // 线条起始颜色
    HeadColor: '#fecbe6',  // 线条结束颜色
    Width: 5,              // 线条宽度
    StrokeWidth: 2,        // 笔画宽度
    UseGradient: true      // 使用渐变
  },
  Mouse: {
    Range: 1.5,            // 鼠标交互范围
    FadeRate: 0.7          // 距离渐隐率
  },
  Mode: {
    FreePainting: false,   // 自由绘画模式
    ShowNearMouse: true,   // 显示鼠标附近网格
    FadeWithDistance: true,// 距离渐隐
    AllowOverlap: false,   // 允许笔画重叠
    EnableZappy: false,    // 启用抖动效果
    ZappyVariance: 2.5,    // 抖动方差
    DragToDraw: true       // 拖拽绘制模式
  }
}

const canvas = CreatePatternCanvas(element, config)
```

## API

### `CreatePatternCanvas(CanvasElement, Config)`

创建图案绘制画布实例。

### `getPatterns()`

返回所有已绘制的图案，格式为 `[x, y, 笔画字符串][]`。

### `clearPatterns()`

清除所有已绘制的图案。

## 许可证

MIT License。详见 [LICENSE](LICENSE)。

---

[English README](README.md)
