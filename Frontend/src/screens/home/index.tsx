import { ColorSwatch, Group } from '@mantine/core';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Draggable from 'react-draggable';
import { SWATCHES } from '@/constants';

interface GeneratedResult {
  expression: string;
  answer: string;
}

interface Response {
  expr: string;
  result: string;
  assign: boolean;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('rgb(255, 255, 255)');
  const [penSize, setPenSize] = useState(3);
  const [penStyle, setPenStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  const [reset, setReset] = useState(false);
  const [dictOfVars, setDictOfVars] = useState<Record<string, string>>({});
  const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
  const [latexExpression, setLatexExpression] = useState<Array<string>>([]);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (latexExpression.length > 0 && window.MathJax) {
      setTimeout(() => {
        window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub]);
      }, 0);
    }
  }, [latexExpression]);

  useEffect(() => {
    if (reset) {
      resetCanvas();
      setLatexExpression([]);
      setDictOfVars({});
      setReset(false);
    }
  }, [reset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - canvas.offsetTop;
        ctx.lineCap = 'round';
        ctx.lineWidth = penSize;
      }
    }

    const script = document.createElement('script');
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML';
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      window.MathJax.Hub.Config({
        tex2jax: { inlineMath: [['$', '$'], ['\\(', '\\)']] },
      });
    };

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.background = 'black';
      const ctx = canvas.getContext('2d');
      const offsetX = 'touches' in e ? e.touches[0].clientX : e.nativeEvent.offsetX;
      const offsetY = 'touches' in e ? e.touches[0].clientY : e.nativeEvent.offsetY;
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY);
        setIsDrawing(true);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const offsetX = 'touches' in e ? e.touches[0].clientX : e.nativeEvent.offsetX;
      const offsetY = 'touches' in e ? e.touches[0].clientY : e.nativeEvent.offsetY;
      if (ctx) {
        ctx.strokeStyle = color;
        ctx.lineWidth = penSize;

        if (penStyle === 'dashed') {
          ctx.setLineDash([10, 5]);
        } else if (penStyle === 'dotted') {
          ctx.setLineDash([2, 5]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const runRoute = async () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
      let minX = canvas.width,
        minY = canvas.height,
        maxX = 0,
        maxY = 0;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if (imageData.data[i + 3] > 0) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      setLatexPosition({ x: centerX, y: centerY });

      const image = canvas.toDataURL('image/jpeg', 0.6);
      const { data: resp } = await axios.post(`${import.meta.env.VITE_API_URL}/calculate`, {
        image,
        dict_of_vars: dictOfVars,
      });

      const results: GeneratedResult[] = resp.data.map((item: Response) => {
        if (item.assign) {
          dictOfVars[item.expr] = item.result;
        }
        return { expression: item.expr, answer: item.result };
      });

      setDictOfVars({ ...dictOfVars });
      setLatexExpression(results.map(r => `\\(\\LARGE{${r.expression} = ${r.answer}}\\)`));
    } catch (error) {
      console.error('Error during calculation:', error);
    }
  };

  const exportCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'canvas.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  return (
    <>
      <div className="fixed top-0 left-0 w-full z-50 flex justify-between flex-wrap gap-4 items-center bg-black p-4 border-b border-gray-700 shadow-lg">
        <Button onClick={() => setReset(true)} className="bg-red-600 text-white">
          Reset
        </Button>

        <Group>
          {SWATCHES.map((swatch) => (
            <ColorSwatch
              key={swatch}
              color={swatch}
              onClick={() => setColor(swatch)}
              style={{
                cursor: 'pointer',
                border: color === swatch ? '2px solid white' : '1px solid gray',
              }}
            />
          ))}
        </Group>

        <Button onClick={() => setColor('black')} className="bg-gray-600 text-white">
          Eraser
        </Button>

        <div className="flex items-center gap-2 text-white">
          <label>Pen</label>
          <input
            type="range"
            min={1}
            max={20}
            value={penSize}
            onChange={(e) => setPenSize(parseInt(e.target.value))}
          />
          <span>{penSize}px</span>
        </div>

        <div className="flex gap-4">
          <Button onClick={() => setPenStyle('solid')} className="bg-gray-500 text-white">
            Solid
          </Button>
          <Button onClick={() => setPenStyle('dashed')} className="bg-gray-500 text-white">
            Dashed
          </Button>
          <Button onClick={() => setPenStyle('dotted')} className="bg-gray-500 text-white">
            Dotted
          </Button>
        </div>

        <Button onClick={runRoute} className="bg-green-600 text-white">
          Calculate
        </Button>

        <Button onClick={exportCanvas} className="bg-blue-600 text-white">
          Export Image
        </Button>
      </div>

      <canvas
        ref={canvasRef}
        id="canvas"
        className="fixed top-0 left-0 w-full h-full"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />

      {latexExpression &&
        latexExpression.map((latex, index) => (
          <Draggable
            key={index}
            defaultPosition={latexPosition}
            onStop={(e, data) => setLatexPosition({ x: data.x, y: data.y })}
          >
            <div
              className={`absolute p-2 rounded shadow-md transition duration-300 ease-in-out ${
                hovered ? 'bg-blue-700 text-white' : 'bg-gray-900 text-white'
              }`}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
            >
              <div className="latex-content">{latex}</div>
            </div>
          </Draggable>
        ))}
    </>
  );
}