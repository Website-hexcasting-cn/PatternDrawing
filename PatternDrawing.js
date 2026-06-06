// @ts-nocheck
/**
 * 创建一个模式绘制画布
 * @param {HTMLCanvasElement} CanvasElement - 画布元素，默认为 document.getElementById("PatternCanvas")
 * @param {Object} Config - 配置对象，默认为空对象
 */
function CreatePatternCanvas(
    CanvasElement = document.getElementById("PatternCanvas"),
    Config = {}
) {
    // ==================== 配置数据 ====================
    const DefaultConfig = {
        Point: {
            Color: "#7fffe6",
            MinColor: "#66ccc8",
            Size: 5
        },
        Grid: {
            Spacing: 80
        },
        Line: {
            TailColor: "#64c8ff",
            HeadColor: "#fecbe6",
            Width: 5,
            StrokeWidth: 2,
            UseGradient: true
        },
        Mouse: {
            Range: 1.5,
            FadeRate: 0.7
        },
        Mode: {
            FreePainting: false,
            ShowNearMouse: true,
            FadeWithDistance: true,
            AllowOverlap: false,
            EnableZappy: false,
            ZappyVariance: 2.5,
            DragToDraw: true,
            PreventConnectToExisting: true,
            DebugMode: false
        }
    };

    let PatternData = {
        ...DefaultConfig,
        Point: { ...DefaultConfig.Point, ...(Config.Point || {}) },
        Grid: { ...DefaultConfig.Grid, ...(Config.Grid || {}) },
        Line: { ...DefaultConfig.Line, ...(Config.Line || {}) },
        Mouse: { ...DefaultConfig.Mouse, ...(Config.Mouse || {}) },
        Mode: { ...DefaultConfig.Mode, ...(Config.Mode || {}) }
    };

    // ==================== 状态数据 ====================
    let CanvasElementCtx = CanvasElement.getContext("2d");
    let VirtualCanvas = { X: 0, Y: 0, Patterns: [] };
    let State = {
        Messages: [],
        Path: [],
        MousePosition: null,
        HighlightPoint: null,
        DrawingStatus: false
    };

    // ==================== 缓存变量 ====================
    let CachedSpacing = PatternData.Grid.Spacing;
    let CachedHalfSpacing = CachedSpacing / 2;
    let CachedMaxDistance = CachedSpacing * PatternData.Mouse.Range;
    let CachedMaxDistanceSq = CachedMaxDistance * CachedMaxDistance;
    let ZappySeed = Math.random() * 10000;
    let ZappyTime = 0;

    function UpdateCache() {
        CachedSpacing = PatternData.Grid.Spacing;
        CachedHalfSpacing = CachedSpacing / 2;
        CachedMaxDistance = CachedSpacing * PatternData.Mouse.Range;
        CachedMaxDistanceSq = CachedMaxDistance * CachedMaxDistance;
    }

    // ==================== 工具函数 ====================
    function HexToRGB(Hex) {
        const R = parseInt(Hex.slice(1, 3), 16);
        const G = parseInt(Hex.slice(3, 5), 16);
        const B = parseInt(Hex.slice(5, 7), 16);
        return { R, G, B };
    }

    function RGBToHex(R, G, B) {
        const ToHex = (N) => Math.round(Math.max(0, Math.min(255, N))).toString(16).padStart(2, '0');
        return `#${ToHex(R)}${ToHex(G)}${ToHex(B)}`;
    }

    function HexWithAlpha(Hex, Alpha) {
        const { R, G, B } = HexToRGB(Hex);
        return `rgba(${R},${G},${B},${Alpha})`;
    }

    function LerpColor(Hex1, Hex2, T) {
        const C1 = HexToRGB(Hex1);
        const C2 = HexToRGB(Hex2);
        const R = C1.R + (C2.R - C1.R) * T;
        const G = C1.G + (C2.G - C1.G) * T;
        const B = C1.B + (C2.B - C1.B) * T;
        return RGBToHex(R, G, B);
    }

    function ScreenColor(Hex) {
        const { R, G, B } = HexToRGB(Hex);
        const NewR = R + (255 - R) * 0.5;
        const NewG = G + (255 - G) * 0.5;
        const NewB = B + (255 - B) * 0.5;
        return RGBToHex(NewR, NewG, NewB);
    }

    function DodgeColor(Hex) {
        const { R, G, B } = HexToRGB(Hex);
        return RGBToHex(R * 0.8, G * 0.8, B * 0.8);
    }

    function SimpleNoise(X, Y, Seed) {
        const N = Math.sin(X * 12.9898 + Y * 78.233 + Seed) * 43758.5453;
        return N - Math.floor(N);
    }

    function MakeZappy(Points, Variance, Time) {
        if (Points.length < 2 || Variance <= 0) {
            return Points.map(P => VirtualToReal(P));
        }

        const Hops = 8;
        const ZappyPts = [];
        const RealPoints = Points.map(P => VirtualToReal(P));

        for (let i = 0; i < RealPoints.length - 1; i++) {
            const Src = RealPoints[i];
            const Target = RealPoints[i + 1];
            const DeltaX = Target.x - Src.x;
            const DeltaY = Target.y - Src.y;
            const Dist = Math.sqrt(DeltaX * DeltaX + DeltaY * DeltaY);
            const HopDist = Dist / Hops;
            const MaxVariance = HopDist * Variance * 0.3;

            ZappyPts.push({ x: Src.x, y: Src.y });

            for (let j = 1; j < Hops; j++) {
                const Progress = j / Hops;
                const BaseX = Src.x + DeltaX * Progress;
                const BaseY = Src.y + DeltaY * Progress;

                const Noise1 = SimpleNoise(i + Progress - Time, 1337, ZappySeed);
                const Noise2 = SimpleNoise(i + Progress - Time, 69420, ZappySeed);
                const Theta = Noise1 * Math.PI * 2;
                const R = Noise2 * MaxVariance * Math.min(1, 8 * (0.5 - Math.abs(0.5 - Progress)));

                ZappyPts.push({
                    x: BaseX + R * Math.cos(Theta),
                    y: BaseY + R * Math.sin(Theta)
                });
            }
        }

        const Last = RealPoints[RealPoints.length - 1];
        ZappyPts.push({ x: Last.x, y: Last.y });

        return ZappyPts;
    }

    // ==================== 六边形数学函数 ====================
    function VirtualToReal(Point) {
        const OffsetX = (Point.y & 1) ? CachedHalfSpacing : 0;
        return {
            x: Point.x * CachedSpacing + OffsetX + VirtualCanvas.X,
            y: Point.y * CachedSpacing + VirtualCanvas.Y
        };
    }

    function RealToVirtual(RealX, RealY) {
        const VirtualY = Math.round((RealY - VirtualCanvas.Y) / CachedSpacing);
        const OffsetX = (VirtualY & 1) ? CachedHalfSpacing : 0;
        const VirtualX = Math.round((RealX - VirtualCanvas.X - OffsetX) / CachedSpacing);
        return { x: VirtualX, y: VirtualY };
    }

    function GetGridRange() {
        const CanvasWidth = CanvasElement.width;
        const CanvasHeight = CanvasElement.height;
        const Spacing = CachedSpacing;
        return {
            StartI: Math.floor(-VirtualCanvas.X / Spacing) - 1,
            EndI: Math.ceil((CanvasWidth - VirtualCanvas.X) / Spacing) + 1,
            StartJ: Math.floor(-VirtualCanvas.Y / Spacing) - 1,
            EndJ: Math.ceil((CanvasHeight - VirtualCanvas.Y) / Spacing) + 1
        };
    }

    function IsAdjacentPoint(MouseMovePoint) {
        const Path = State.Path;
        if (Path.length === 0) return true;

        const Last = Path[Path.length - 1];
        const DeltaX = MouseMovePoint.x - Last.x;
        const DeltaY = MouseMovePoint.y - Last.y;

        if (DeltaX === 0 && DeltaY === 0) return true;
        if (Math.abs(DeltaX) === 1 && DeltaY === 0) return true;
        if (DeltaX === 0 && Math.abs(DeltaY) === 1) return true;

        const AbsDeltaY = Math.abs(DeltaY);
        if (AbsDeltaY === 1) {
            if ((Last.y & 1) === 0 && DeltaX === -1) return true;
            if ((Last.y & 1) === 1 && DeltaX === 1) return true;
        }
        return false;
    }

    function IsPointAdjacent(FromPoint, ToPoint) {
        const DeltaX = ToPoint.x - FromPoint.x;
        const DeltaY = ToPoint.y - FromPoint.y;

        if (DeltaX === 0 && DeltaY === 0) return true;

        if (DeltaY === 0 && Math.abs(DeltaX) === 1) return true;

        if (DeltaX === 0 && Math.abs(DeltaY) === 1) return true;

        if (Math.abs(DeltaY) === 1 && Math.abs(DeltaX) === 1) {
            if ((FromPoint.y & 1) === 0 && DeltaY === -1 && DeltaX === -1) return true;
            if ((FromPoint.y & 1) === 0 && DeltaY === 1 && DeltaX === -1) return true;
            if ((FromPoint.y & 1) === 1 && DeltaY === -1 && DeltaX === 1) return true;
            if ((FromPoint.y & 1) === 1 && DeltaY === 1 && DeltaX === 1) return true;
        }
        return false;
    }

    function GetHexPath(FromPoint, ToPoint) {
        const Path = [];
        const DeltaX = ToPoint.x - FromPoint.x;
        const DeltaY = ToPoint.y - FromPoint.y;

        if (DeltaX === 0 && DeltaY === 0) {
            return Path;
        }

        const Distance = Math.max(Math.abs(DeltaX), Math.abs(DeltaY), Math.abs(DeltaX + DeltaY));
        const Steps = Distance;

        let CurrentX = FromPoint.x;
        let CurrentY = FromPoint.y;

        for (let Step = 1; Step <= Steps; Step++) {
            const T = Step / Steps;
            const TargetX = FromPoint.x + DeltaX * T;
            const TargetY = FromPoint.y + DeltaY * T;

            const RoundedY = Math.round(TargetY);
            const OffsetX = (RoundedY & 1) ? 0.5 : 0;
            const RoundedX = Math.round(TargetX + OffsetX) - (RoundedY & 1);

            if (RoundedX !== CurrentX || RoundedY !== CurrentY) {
                CurrentX = RoundedX;
                CurrentY = RoundedY;
                Path.push({ x: CurrentX, y: CurrentY });
            }
        }

        return Path;
    }

    function IsMouseOverPoint(e) {
        let ClientX, ClientY;
        
        if (e.touches && e.touches.length > 0) {
            ClientX = e.touches[0].clientX;
            ClientY = e.touches[0].clientY;
        } else {
            ClientX = e.clientX;
            ClientY = e.clientY;
        }
        
        const ClickX = ClientX - CanvasElement.offsetLeft;
        const ClickY = ClientY - CanvasElement.offsetTop;
        const VirtualPoint = RealToVirtual(ClickX, ClickY);
        const RealPoint = VirtualToReal(VirtualPoint);
        const Threshold = CachedSpacing * 0.3;

        if (Math.abs(ClickX - RealPoint.x) <= Threshold && Math.abs(ClickY - RealPoint.y) <= Threshold) {
            return VirtualPoint;
        }
        return null;
    }

    function CalculateRelativeDirectionCode(FromPoint, ToPoint, PreviousDirectionIndex) {
        const DeltaX = ToPoint.x - FromPoint.x;
        const DeltaY = ToPoint.y - FromPoint.y;

        if (Math.abs(DeltaX) < 0.001 && Math.abs(DeltaY) < 0.001) {
            return { DirectionCode: "", CurrentDirectionIndex: PreviousDirectionIndex };
        }

        const Angle = Math.atan2(-DeltaY, DeltaX);
        let CurrentDirectionIndex = Math.round(Angle / (Math.PI / 3));
        CurrentDirectionIndex = ((CurrentDirectionIndex % 6) + 6) % 6;

        let Turn = CurrentDirectionIndex - PreviousDirectionIndex;
        if (Turn > 3) Turn -= 6;
        if (Turn < -3) Turn += 6;

        const RelativeDirectionMap = ["w", "e", "d", "s", "a", "q"];
        return {
            DirectionCode: RelativeDirectionMap[(Turn + 6) % 6],
            CurrentDirectionIndex: CurrentDirectionIndex
        };
    }

    function IsPointInExistingPatterns(Point) {
        const Patterns = VirtualCanvas.Patterns;

        for (let i = 0, len = Patterns.length; i < len; i++) {
            const StrokeOrder = Patterns[i].StrokeOrder;
            for (let j = 0, jLen = StrokeOrder.length; j < jLen; j++) {
                const P = StrokeOrder[j];
                if (Point.x === P.x && Point.y === P.y) {
                    return true;
                }
            }
        }

        return false;
    }

    function IsStrokeOverlap(FromPoint, ToPoint) {
        const Patterns = VirtualCanvas.Patterns;
        const Path = State.Path;

        for (let i = 0, len = Patterns.length; i < len; i++) {
            const StrokeOrder = Patterns[i].StrokeOrder;
            for (let j = 1, jLen = StrokeOrder.length; j < jLen; j++) {
                const A = StrokeOrder[j - 1];
                const B = StrokeOrder[j];
                if ((FromPoint.x === A.x && FromPoint.y === A.y && ToPoint.x === B.x && ToPoint.y === B.y) ||
                    (FromPoint.x === B.x && FromPoint.y === B.y && ToPoint.x === A.x && ToPoint.y === A.y)) {
                    return true;
                }
            }
        }

        for (let i = 1, len = Path.length; i < len; i++) {
            const A = Path[i - 1];
            const B = Path[i];
            if ((FromPoint.x === A.x && FromPoint.y === A.y && ToPoint.x === B.x && ToPoint.y === B.y) ||
                (FromPoint.x === B.x && FromPoint.y === B.y && ToPoint.x === A.x && ToPoint.y === A.y)) {
                return true;
            }
        }

        return false;
    }

    // ==================== 渲染函数 ====================
    function RenderSinglePoint(Ctx, PointX, PointY, Opacity = 1, IsHighlight = false) {
        const { Color, MinColor, Size } = PatternData.Point;
        const UseColor = IsHighlight ? Color : MinColor;

        Ctx.beginPath();
        Ctx.arc(PointX, PointY, Size / 2, 0, Math.PI * 2);
        Ctx.fillStyle = Opacity < 1 ? HexWithAlpha(UseColor, Opacity) : UseColor;
        Ctx.fill();
    }

    function RenderGridPoints(Ctx, Range) {
        const { ShowNearMouse, FadeWithDistance } = PatternData.Mode;
        const MousePosition = State.MousePosition;

        const { FadeRate } = PatternData.Mouse;
        const Spacing = CachedSpacing;
        const HalfSpacing = CachedHalfSpacing;
        const MaxDistanceSq = CachedMaxDistanceSq;
        const MaxDistance = CachedMaxDistance;

        const ShouldFilterByDistance = ShowNearMouse && MousePosition;

        for (let i = Range.StartI; i < Range.EndI; i++) {
            for (let j = Range.StartJ; j < Range.EndJ; j++) {
                const OffsetX = (j & 1) ? HalfSpacing : 0;
                const PointX = i * Spacing + OffsetX + VirtualCanvas.X;
                const PointY = j * Spacing + VirtualCanvas.Y;

                let DistanceSq = 0;
                let Distance = 0;

                if (MousePosition) {
                    const Dx = PointX - MousePosition.x;
                    const Dy = PointY - MousePosition.y;
                    DistanceSq = Dx * Dx + Dy * Dy;

                    if (ShouldFilterByDistance && DistanceSq > MaxDistanceSq) continue;

                    if (FadeWithDistance) {
                        Distance = Math.sqrt(DistanceSq);
                    }
                }

                let Opacity = 1;
                if (ShouldFilterByDistance && FadeWithDistance) {
                    Opacity = Math.max(0.1, 1 - (Distance / MaxDistance) * FadeRate);
                }

                RenderSinglePoint(Ctx, PointX, PointY, Opacity);

                if (PatternData.Mode.DebugMode) {
                    Ctx.font = "10px monospace";
                    Ctx.fillStyle = `rgba(255, 255, 255, ${Opacity * 0.8})`;
                    Ctx.fillText(`(${i},${j})`, PointX + 8, PointY - 8);
                }
            }
        }
    }

    function RenderLineSegment(Ctx, FromReal, ToReal, Color, Width) {
        Ctx.beginPath();
        Ctx.moveTo(FromReal.x, FromReal.y);
        Ctx.lineTo(ToReal.x, ToReal.y);
        Ctx.strokeStyle = Color;
        Ctx.lineWidth = Width;
        Ctx.lineCap = "round";
        Ctx.stroke();
    }

    function RenderPatternLine(Ctx, Points, TailColor, HeadColor, Width, StrokeWidth, EnableZappy, ZappyVariance) {
        if (Points.length < 2) return;

        const N = Points.length;
        const RealPoints = EnableZappy
            ? MakeZappy(Points, ZappyVariance, ZappyTime)
            : Points.map(P => VirtualToReal(P));

        function GetColor(Index) {
            const T = Index / (N - 1);
            return LerpColor(TailColor, HeadColor, T);
        }

        for (let i = 0; i < RealPoints.length - 1; i++) {
            const ColorIndex = Math.floor((i / (RealPoints.length - 1)) * (N - 1));
            const Color = GetColor(ColorIndex);
            const ScreenCol = ScreenColor(Color);

            RenderLineSegment(Ctx, RealPoints[i], RealPoints[i + 1], Color, Width);
            RenderLineSegment(Ctx, RealPoints[i], RealPoints[i + 1], ScreenCol, StrokeWidth);
        }
    }

    function RenderPatternNodes(Ctx, Points, HeadColor, DrawLast = true) {
        const Nodes = DrawLast ? Points : Points.slice(0, -1);
        const NodeColor = DodgeColor(HeadColor);
        const NodeRadius = 2;

        for (const Node of Nodes) {
            const Real = VirtualToReal(Node);
            Ctx.beginPath();
            Ctx.arc(Real.x, Real.y, NodeRadius, 0, Math.PI * 2);
            Ctx.fillStyle = NodeColor;
            Ctx.fill();
        }
    }

    function RenderPatterns(Ctx) {
        const Patterns = VirtualCanvas.Patterns;
        const { TailColor, HeadColor, Width, StrokeWidth } = PatternData.Line;
        const { EnableZappy, ZappyVariance } = PatternData.Mode;

        for (let i = 0, len = Patterns.length; i < len; i++) {
            const StrokeOrder = Patterns[i].StrokeOrder;
            RenderPatternLine(Ctx, StrokeOrder, TailColor, HeadColor, Width, StrokeWidth, EnableZappy, ZappyVariance);
            RenderPatternNodes(Ctx, StrokeOrder, HeadColor, true);
        }
    }

    function RenderCurrentPath(Ctx, HighlightPoint) {
        const Path = State.Path;
        if (!State.DrawingStatus || Path.length === 0) return;

        const { TailColor, HeadColor, Width, StrokeWidth } = PatternData.Line;
        const { EnableZappy, ZappyVariance } = PatternData.Mode;
        const Points = HighlightPoint ? [...Path, HighlightPoint] : Path;

        RenderPatternLine(Ctx, Points, TailColor, HeadColor, Width, StrokeWidth, EnableZappy, ZappyVariance);
        RenderPatternNodes(Ctx, Path, HeadColor, false);
    }

    function RenderHighlightPoint(Ctx, HighlightPoint) {
        if (!HighlightPoint) return;

        const { Color, Size } = PatternData.Point;
        const RealPoint = VirtualToReal(HighlightPoint);

        Ctx.beginPath();
        Ctx.arc(RealPoint.x, RealPoint.y, Size, 0, Math.PI * 2);
        Ctx.fillStyle = Color;
        Ctx.fill();
    }

    function Rendering(HighlightPoint = State.HighlightPoint) {
        const Ctx = CanvasElementCtx;
        Ctx.clearRect(0, 0, CanvasElement.width, CanvasElement.height);

        if (PatternData.Mode.EnableZappy) {
            ZappyTime = performance.now() / 1000;
        }

        const Range = GetGridRange();
        RenderGridPoints(Ctx, Range);
        RenderPatterns(Ctx);
        RenderCurrentPath(Ctx, HighlightPoint);
        RenderHighlightPoint(Ctx, HighlightPoint);
    }

    // ==================== 事件处理函数 ====================
    function GetEventPosition(e) {
        const Rect = CanvasElement.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
            return {
                x: e.touches[0].clientX - Rect.left,
                y: e.touches[0].clientY - Rect.top
            };
        }
        return {
            x: e.clientX - Rect.left,
            y: e.clientY - Rect.top
        };
    }

    function HandleMouseMove(e) {
        const { DragToDraw, FreePainting } = PatternData.Mode;
        const MouseX = e.clientX - CanvasElement.getBoundingClientRect().left;
        const MouseY = e.clientY - CanvasElement.getBoundingClientRect().top;
        State.MousePosition = { x: MouseX, y: MouseY };

        const MouseMovePoint = IsMouseOverPoint(e);

        if (DragToDraw) {
            if (State.DrawingStatus && MouseMovePoint) {
                State.Messages.push({ Type: "PatternCanvasMouseMove", x: MouseMovePoint.x, y: MouseMovePoint.y });
            }
            State.HighlightPoint = MouseMovePoint;
        } else {
            if (MouseMovePoint && (FreePainting || IsAdjacentPoint(MouseMovePoint))) {
                State.Messages.push({ Type: "PatternCanvasMouseMove", x: MouseMovePoint.x, y: MouseMovePoint.y });
                State.HighlightPoint = MouseMovePoint;
            } else {
                State.HighlightPoint = null;
            }
        }
        Rendering();
    }

    function HandleMouseDown(e) {
        if (!PatternData.Mode.DragToDraw) return;

        const Point = IsMouseOverPoint(e);
        if (Point && (!PatternData.Mode.PreventConnectToExisting || !IsPointInExistingPatterns(Point))) {
            State.DrawingStatus = true;
            State.Path = [Point];
            State.HighlightPoint = Point;
            Rendering();
        }
    }

    function HandleMouseUp(e) {
        if (!PatternData.Mode.DragToDraw) return;

        if (State.DrawingStatus) {
            FinishPattern();
        }
    }

    function HandleClick(e) {
        if (PatternData.Mode.DragToDraw) return;

        const ClickPoint = IsMouseOverPoint(e);
        if (ClickPoint) {
            State.Messages.push({ Type: "PatternCanvasClickPoint", x: ClickPoint.x, y: ClickPoint.y });
        }
    }

    function HandleTouchStart(e) {
        if (!PatternData.Mode.DragToDraw) return;
        e.preventDefault();

        const Touch = e.touches[0];
        const Rect = CanvasElement.getBoundingClientRect();
        const TouchX = Touch.clientX - Rect.left;
        const TouchY = Touch.clientY - Rect.top;

        State.MousePosition = { x: TouchX, y: TouchY };

        const VirtualPoint = RealToVirtual(TouchX, TouchY);
        if (VirtualPoint && (!PatternData.Mode.PreventConnectToExisting || !IsPointInExistingPatterns(VirtualPoint))) {
            State.DrawingStatus = true;
            State.Path = [VirtualPoint];
            State.HighlightPoint = VirtualPoint;
            Rendering();
        }
    }

    function HandleTouchMove(e) {
        if (!PatternData.Mode.DragToDraw) return;
        e.preventDefault();

        const Touch = e.touches[0];
        const Rect = CanvasElement.getBoundingClientRect();
        const TouchX = Touch.clientX - Rect.left;
        const TouchY = Touch.clientY - Rect.top;

        State.MousePosition = { x: TouchX, y: TouchY };

        const VirtualPoint = RealToVirtual(TouchX, TouchY);
        if (VirtualPoint && State.DrawingStatus) {
            State.Messages.push({ Type: "PatternCanvasMouseMove", x: VirtualPoint.x, y: VirtualPoint.y });
            State.HighlightPoint = VirtualPoint;
            Rendering();
        }
    }

    function HandleTouchEnd(e) {
        if (!PatternData.Mode.DragToDraw) return;

        if (State.DrawingStatus) {
            FinishPattern();
        }
    }

    function FinishPattern() {
        State.DrawingStatus = false;
        const StrokeOrder = State.Path;
        if (StrokeOrder.length > 0) {
            VirtualCanvas.Patterns.push({
                StrokeOrder: StrokeOrder,
                StartingPointX: StrokeOrder[0].x,
                StartingPointY: StrokeOrder[0].y
            });
        }
        State.Path = [];
        State.HighlightPoint = null;
        Rendering();
    }

    function HandleWheel(e) {
        e.preventDefault();
        const AbsDeltaX = Math.abs(e.deltaX);
        const AbsDeltaY = Math.abs(e.deltaY);
        if (AbsDeltaX > AbsDeltaY) {
            VirtualCanvas.X += e.deltaX;
        } else {
            VirtualCanvas.Y += e.deltaY;
        }
        Rendering();
    }

    function HandleResize() {
        SetCanvasWidthAndHeight();
        Rendering();
    }

    // ==================== 消息处理函数 ====================
    function ProcessMouseMoveMessage(Message) {
        const Path = State.Path;
        const Last = Path[Path.length - 1];
        const NewPoint = { x: Message.x, y: Message.y };

        if (!State.DrawingStatus) return;

        if (Path.length >= 2) {
            const PrevPoint = Path[Path.length - 2];
            if (PrevPoint.x === NewPoint.x && PrevPoint.y === NewPoint.y) {
                Path.pop();
                return;
            }
        }

        if (!Last) {
            Path.push(NewPoint);
            return;
        }

        if (Last.x === NewPoint.x && Last.y === NewPoint.y) {
            return;
        }

        const HexPath = GetHexPath(Last, NewPoint);

        for (let i = 0; i < HexPath.length; i++) {
            const MidPoint = HexPath[i];
            const LastInPath = Path[Path.length - 1];

            if (!IsPointAdjacent(LastInPath, MidPoint)) {
                continue;
            }

            if (Path.length >= 2) {
                const PrevPoint = Path[Path.length - 2];
                if (PrevPoint.x === MidPoint.x && PrevPoint.y === MidPoint.y) {
                    Path.pop();
                    continue;
                }
            }

            if (PatternData.Mode.PreventConnectToExisting && IsPointInExistingPatterns(MidPoint)) {
                continue;
            }

            if (!PatternData.Mode.AllowOverlap) {
                if (LastInPath && IsStrokeOverlap(LastInPath, MidPoint)) {
                    continue;
                }
            }

            Path.push(MidPoint);
        }
    }

    function ProcessClickMessage() {
        State.DrawingStatus = !State.DrawingStatus;
        if (!State.DrawingStatus) {
            FinishPattern();
        }
    }

    function ProcessMessageQueue() {
        const Messages = State.Messages;
        if (Messages.length === 0) return;

        const Message = Messages.shift();
        if (Message.Type === "PatternCanvasClickPoint") {
            ProcessClickMessage();
        } else if (Message.Type === "PatternCanvasMouseMove") {
            ProcessMouseMoveMessage(Message);
        }
    }

    // ==================== 画布设置函数 ====================
    function SetCanvasWidthAndHeight(Width, Height) {
        CanvasElement.width = Width ?? window.innerWidth;
        CanvasElement.height = Height ?? window.innerHeight;
    }

    function GetCanvasElement() {
        return CanvasElement;
    }

    function SetCanvasElement(NewCanvasElement) {
        CanvasElement = NewCanvasElement;
        CanvasElementCtx = CanvasElement.getContext("2d");
    }

    function SetConfig(NewConfig) {
        Object.assign(PatternData.Point, NewConfig.Point || {});
        Object.assign(PatternData.Grid, NewConfig.Grid || {});
        Object.assign(PatternData.Line, NewConfig.Line || {});
        Object.assign(PatternData.Mouse, NewConfig.Mouse || {});
        Object.assign(PatternData.Mode, NewConfig.Mode || {});
        UpdateCache();
        Rendering();
    }

    // ==================== 图案处理函数 ====================
    function VirtualToPatternList() {
        const Patterns = VirtualCanvas.Patterns;
        if (Patterns.length === 0) return [];

        const PatternStringList = [];

        for (let i = 0, len = Patterns.length; i < len; i++) {
            const StrokeOrder = Patterns[i].StrokeOrder;
            if (StrokeOrder.length === 0) continue;

            const PreprocessedStrokeOrder = [];
            for (let j = 0, jLen = StrokeOrder.length; j < jLen; j++) {
                const Point = StrokeOrder[j];
                const PreprocessedPoint = { x: Point.x, y: Point.y };
                if ((Point.y & 1) === 0) {
                    PreprocessedPoint.x -= 0.5;
                }
                PreprocessedStrokeOrder.push(PreprocessedPoint);
            }

            let PatternString = "";
            let PreviousDirectionIndex = 0;
            for (let j = 1, jLen = PreprocessedStrokeOrder.length; j < jLen; j++) {
                const Result = CalculateRelativeDirectionCode(
                    PreprocessedStrokeOrder[j - 1],
                    PreprocessedStrokeOrder[j],
                    PreviousDirectionIndex
                );
                PatternString += Result.DirectionCode;
                PreviousDirectionIndex = Result.CurrentDirectionIndex;
            }

            PatternString = PatternString.slice(1);
            PatternStringList.push([
                PreprocessedStrokeOrder[0].x,
                PreprocessedStrokeOrder[0].y,
                PatternString
            ]);
        }
        return PatternStringList;
    }

    // ==================== 事件注册 ====================
    function RegisterEvents() {
        window.addEventListener("resize", HandleResize);
        CanvasElement.addEventListener("wheel", HandleWheel, { passive: false });

        CanvasElement.addEventListener("click", HandleClick);
        CanvasElement.addEventListener("mousemove", HandleMouseMove);
        CanvasElement.addEventListener("mousedown", HandleMouseDown);
        CanvasElement.addEventListener("mouseup", HandleMouseUp);
        CanvasElement.addEventListener("mouseleave", HandleMouseUp);

        CanvasElement.addEventListener("touchstart", HandleTouchStart, { passive: false });
        CanvasElement.addEventListener("touchmove", HandleTouchMove, { passive: false });
        CanvasElement.addEventListener("touchend", HandleTouchEnd);
        CanvasElement.addEventListener("touchcancel", HandleTouchEnd);
    }

    // ==================== 动画循环 ====================
    let AnimationFrameId = null;
    function AnimationLoop() {
        if (PatternData.Mode.EnableZappy) {
            Rendering();
        }
        AnimationFrameId = requestAnimationFrame(AnimationLoop);
    }

    // ==================== 初始化 ====================
    SetCanvasWidthAndHeight();
    RegisterEvents();
    Rendering();
    AnimationLoop();

    const MessageQueueInterval = setInterval(ProcessMessageQueue, 10);

    // ==================== 返回接口 ====================
    return {
        Function: {
            SetCanvasWidthAndHeight,
            Rendering,
            GetCanvasElement,
            SetCanvasElement,
            SetConfig,
            VirtualToReal,
            RealToVirtual,
            GetGridRange,
            IsAdjacentPoint,
            IsMouseOverPoint,
            IsStrokeOverlap,
            GetHexPath,
            CalculateRelativeDirectionCode,
            VirtualToPatternList,
            Destroy: () => {
                window.removeEventListener("resize", HandleResize);
                CanvasElement.removeEventListener("wheel", HandleWheel);

                CanvasElement.removeEventListener("click", HandleClick);
                CanvasElement.removeEventListener("mousemove", HandleMouseMove);
                CanvasElement.removeEventListener("mousedown", HandleMouseDown);
                CanvasElement.removeEventListener("mouseup", HandleMouseUp);
                CanvasElement.removeEventListener("mouseleave", HandleMouseUp);

                CanvasElement.removeEventListener("touchstart", HandleTouchStart);
                CanvasElement.removeEventListener("touchmove", HandleTouchMove);
                CanvasElement.removeEventListener("touchend", HandleTouchEnd);
                CanvasElement.removeEventListener("touchcancel", HandleTouchEnd);

                clearInterval(MessageQueueInterval);
                if (AnimationFrameId) {
                    cancelAnimationFrame(AnimationFrameId);
                }
            }
        },
        Modifiable: {
            Config: PatternData,
            VirtualCanvas,
            get Path() { return State.Path; },
            set Path(value) { State.Path = value; },
        },
        ReadOnly: {
            get CanvasElement() { return CanvasElement; },
            get State() { return State; },
        }
    };
}

export { CreatePatternCanvas };
