# PatternDrawing

A hexagonal grid pattern drawing library for the Hexcasting mod. It provides a canvas for drawing hex patterns with customizable colors, grid spacing, and rendering modes.

## Features

- Hexagonal grid rendering with mouse interaction
- Pattern drawing with stroke sequence tracking
- Customizable point size, grid spacing, line width, and colors
- Gradient support for lines and points
- Distance-based fade effect
- Free painting mode and drag-to-draw mode
- Zappy effect for organic feel
- Pattern code export (Hexprase spell format)

## Usage

```html
<canvas id="PatternCanvas"></canvas>
<script src="PatternDrawing.js"></script>
<script>
  const canvas = CreatePatternCanvas()
</script>
```

## Configuration

```js
const config = {
  Point: {
    Color: '#7fffe6',      // Point inner color
    MinColor: '#66ccc8',   // Point outer color
    Size: 5                // Point size
  },
  Grid: {
    Spacing: 80            // Grid spacing in pixels
  },
  Line: {
    TailColor: '#64c8ff',  // Line tail color
    HeadColor: '#fecbe6',  // Line head color
    Width: 5,              // Line width
    StrokeWidth: 2,        // Stroke width
    UseGradient: true      // Use gradient for lines
  },
  Mouse: {
    Range: 1.5,            // Mouse interaction range
    FadeRate: 0.7          // Distance fade rate
  },
  Mode: {
    FreePainting: false,   // Free painting mode
    ShowNearMouse: true,   // Show grid near mouse
    FadeWithDistance: true,// Distance-based fade
    AllowOverlap: false,   // Allow stroke overlap
    EnableZappy: false,    // Enable zappy effect
    ZappyVariance: 2.5,    // Zappy variance
    DragToDraw: true       // Drag to draw mode
  }
}

const canvas = CreatePatternCanvas(element, config)
```

## API

### `CreatePatternCanvas(CanvasElement, Config)`

Creates a pattern drawing canvas instance.

### `getPatterns()`

Returns all drawn patterns as `[x, y, strokeString][]`.

### `clearPatterns()`

Clears all drawn patterns.

## License

MIT License. See [LICENSE](LICENSE) for details.

---

[中文版 README](README.zh.md)
