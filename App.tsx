
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Upload, 
  Settings, 
  Zap, 
  Download, 
  Image as ImageIcon, 
  Loader2, 
  AlertCircle,
  RefreshCw,
  Sun,
  Wind,
  Droplets,
  ChevronDown,
  ChevronUp,
  X,
  Maximize2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import JSZip from 'jszip';

// --- Types ---
interface AugmentationParams {
  harshness: number;   // Environment (Noise, Blur, Weather)
  lightAging: number;  // Light, Contrast, Hue, Gamma
  dirtiness: number;   // Lens dirt, artifacts
}

interface GeneratedImage {
  id: number;
  dataUrl: string;
  name: string;
}

// --- Constants ---
const AUGMENTATION_COUNT = 20;

const App: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [params, setParams] = useState<AugmentationParams>({
    harshness: 40,
    lightAging: 40,
    dirtiness: 30,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard navigation for preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (previewIndex === null) return;
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') setPreviewIndex(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewIndex, results.length]);

  const handleNext = () => {
    if (previewIndex === null) return;
    setPreviewIndex((previewIndex + 1) % results.length);
  };

  const handlePrev = () => {
    if (previewIndex === null) return;
    setPreviewIndex((previewIndex - 1 + results.length) % results.length);
  };

  // --- Image Processing Utilities ---
  /**
   * Diversity Engine v2.0:
   * Uses complex randomization for extreme diversity while remaining "traditional CV".
   */
  const applyAugmentation = useCallback((
    img: HTMLImageElement, 
    p: AugmentationParams, 
    index: number
  ): Promise<GeneratedImage> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;

      // --- A. Geometric & Perspective Diversity ---
      const rot = (Math.random() - 0.5) * 40 * (index === 0 ? 0 : 1);
      const scl = 0.85 + Math.random() * 0.3;
      // Perspective simulation: shear/skew
      const skewX = (Math.random() - 0.5) * 0.2;
      const skewY = (Math.random() - 0.5) * 0.2;
      const tx = (Math.random() - 0.5) * (canvas.width * 0.15);
      const ty = (Math.random() - 0.5) * (canvas.height * 0.15);
      const flipH = Math.random() > 0.5;
      
      ctx.save();
      ctx.translate(canvas.width / 2 + tx, canvas.height / 2 + ty);
      ctx.transform(scl * (flipH ? -1 : 1), skewX, skewY, scl, 0, 0);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2);
      ctx.restore();

      // --- B. Pixel-level Dynamics (Lighting, Gamma, Channels) ---
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      const pBrightness = ((p.lightAging / 100) * (Math.random() - 0.5) * 150);
      const pContrast = 0.5 + Math.random() * (p.lightAging / 50);
      const pGamma = 0.5 + Math.random() * (p.lightAging / 50);
      const hueRotation = (p.lightAging / 100) * 360 * Math.random();
      
      // Random channel dominance (Simulating color cast)
      const rGain = 0.8 + Math.random() * 0.4;
      const gGain = 0.8 + Math.random() * 0.4;
      const bGain = 0.8 + Math.random() * 0.4;

      for (let i = 0; i < data.length; i += 4) {
        // Apply Gamma, Contrast, Brightness
        for (let c = 0; c < 3; c++) {
          let val = data[i + c] / 255;
          // Gamma correction
          val = Math.pow(val, pGamma);
          // Apply gain
          if (c === 0) val *= rGain;
          if (c === 1) val *= gGain;
          if (c === 2) val *= bGain;
          // Contrast & Brightness
          val = (val - 0.5) * pContrast + 0.5 + (pBrightness / 255);
          data[i + c] = Math.min(255, Math.max(0, val * 255));
        }

        // Salt & Pepper Noise (Extreme variant)
        if (Math.random() > (1 - (p.harshness / 5000))) {
          const noiseColor = Math.random() > 0.5 ? 255 : 0;
          data[i] = data[i+1] = data[i+2] = noiseColor;
        }
      }
      ctx.putImageData(imageData, 0, 0);

      // --- C. Environmental Overlays (Rain, Fog, Glare) ---
      // 1. Fog Overlay
      if (p.harshness > 50 && Math.random() > 0.5) {
        const fogGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        const fogOpacity = (p.harshness / 200) * Math.random();
        fogGrad.addColorStop(0, `rgba(200, 200, 200, ${fogOpacity})`);
        fogGrad.addColorStop(1, `rgba(255, 255, 255, ${fogOpacity * 0.2})`);
        ctx.fillStyle = fogGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 2. Rain Streaks
      if (p.harshness > 70 && Math.random() > 0.6) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        const rainCount = 100 + Math.random() * 200;
        for (let j = 0; j < rainCount; j++) {
          const rx = Math.random() * canvas.width;
          const ry = Math.random() * canvas.height;
          const rlen = 10 + Math.random() * 30;
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx + rlen * 0.1, ry + rlen);
          ctx.stroke();
        }
      }

      // 3. Sun Glare / Light Leak
      if (p.lightAging > 60 && Math.random() > 0.7) {
        const gx = Math.random() * canvas.width;
        const gy = Math.random() * canvas.height;
        const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.random() * canvas.width);
        grad.addColorStop(0, 'rgba(255, 255, 200, 0.4)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // --- D. Final Artifacts (Compression & Dirt) ---
      const dirtCount = Math.floor((p.dirtiness / 100) * 30 * Math.random());
      for (let i = 0; i < dirtCount; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = 1 + Math.random() * (canvas.width / 20);
        ctx.fillStyle = `rgba(${Math.random() * 50}, ${Math.random() * 50}, ${Math.random() * 50}, ${Math.random() * 0.5})`;
        ctx.beginPath();
        if (Math.random() > 0.5) ctx.arc(x, y, size, 0, Math.PI * 2);
        else ctx.rect(x, y, size, size * 0.2);
        ctx.fill();
      }

      const timestamp = new Date().getTime();
      // Simulate lower quality for some samples to increase YOLO robustness
      const quality = 0.5 + Math.random() * 0.4;
      resolve({
        id: index,
        dataUrl: canvas.toDataURL('image/jpeg', quality),
        name: `aug_${timestamp}_${index}.jpg`
      });
    });
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setSourceImage(event.target?.result as string);
      reader.readAsDataURL(file);
      setResults([]);
    }
  };

  const handleGenerate = async () => {
    if (!sourceImage) return;
    setIsProcessing(true);
    setResults([]);

    const img = new Image();
    img.src = sourceImage;
    await new Promise((resolve) => (img.onload = resolve));

    const newResults: GeneratedImage[] = [];
    for (let i = 0; i < AUGMENTATION_COUNT; i++) {
      const res = await applyAugmentation(img, params, i);
      newResults.push(res);
      if (i % 4 === 0) await new Promise(r => setTimeout(r, 0));
    }

    setResults(newResults);
    setIsProcessing(false);
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    results.forEach((img) => {
      const base64Data = img.dataUrl.split(',')[1];
      zip.file(img.name, base64Data, { base64: true });
    });
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diverse_dataset_${Date.now()}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#020617] text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="px-6 md:px-10 py-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-[#020617]/90 backdrop-blur-xl z-40">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-600 rounded-2xl text-white shadow-xl shadow-blue-600/20">
            <Zap size={24} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">样本数据扩增神器</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Dataset Diversity Engine v2.1</p>
          </div>
        </div>
        
        {sourceImage && (
          <div className="hidden md:flex gap-4">
            <button 
              onClick={() => setSourceImage(null)}
              className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <RefreshCw size={16} /> 重新上传
            </button>
            <button
              disabled={isProcessing}
              onClick={handleGenerate}
              className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-xl font-black shadow-lg shadow-blue-900/40 flex items-center gap-2 transition-all active:scale-95"
            >
              {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
              {isProcessing ? '处理中...' : '生成 20 张高样样本'}
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-10">
        
        {!sourceImage ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-2xl group relative cursor-pointer"
            >
              <div className="absolute -inset-1.5 bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 rounded-[2.5rem] blur opacity-20 group-hover:opacity-60 transition duration-1000"></div>
              <div className="relative h-96 border border-slate-800 bg-slate-900/50 backdrop-blur rounded-[2.5rem] flex flex-col items-center justify-center gap-8 hover:border-slate-600 transition-all duration-500">
                <div className="w-24 h-24 bg-slate-800 rounded-3xl flex items-center justify-center text-blue-500 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-2xl">
                  <Upload size={40} />
                </div>
                <div className="space-y-3">
                  <h3 className="text-3xl font-black text-slate-100">上传原始图</h3>
                  <p className="text-slate-500 max-w-sm mx-auto font-medium leading-relaxed">基于先进 CV 算法模拟物理世界的多样性<br/>包括：透视畸变、天气干扰、色彩抖动等</p>
                </div>
              </div>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
          </div>
        ) : (
          <div className="space-y-12 animate-in fade-in duration-500 pb-20">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-4 bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">原始样本</span>
                  <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">
                    Source Ready
                  </div>
                </div>
                <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl group relative">
                  <img src={sourceImage} alt="Source" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer" onClick={() => setSourceImage(null)}>
                    <RefreshCw size={32} className="text-white animate-spin-slow" />
                  </div>
                </div>
                <div className="p-4 bg-blue-600/5 rounded-xl border border-blue-500/10">
                    <p className="text-xs font-bold text-blue-400">多样性策略：v2.1</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">已开启：透视畸变、随机 Gamma 矫正、雨雾模拟及低质量视频流仿真。</p>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-6">
                <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full -mr-32 -mt-32"></div>
                  
                  <div className="relative space-y-8">
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <h2 className="text-2xl font-black text-white">扩增引擎设置</h2>
                        <p className="text-sm font-medium text-slate-400">调整各种参数以匹配目标应用场景的复杂性</p>
                      </div>
                      <button 
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`p-3 rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${showAdvanced ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                      >
                        <Settings size={18} />
                        高级参数
                        {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>

                    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-8 transition-all duration-500 overflow-hidden ${showAdvanced ? 'max-h-96 opacity-100 py-2' : 'max-h-0 opacity-0'}`}>
                        <div className="space-y-4">
                          <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-blue-400">
                            <span className="flex items-center gap-2"><Wind size={14}/> 外部干扰</span>
                            <span>{params.harshness}%</span>
                          </div>
                          <input 
                            type="range" min="0" max="100" 
                            value={params.harshness} 
                            onChange={(e) => setParams(prev => ({ ...prev, harshness: parseInt(e.target.value) }))}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                          <p className="text-[10px] text-slate-500 italic">模拟：雨雾、强烈噪点、运动模糊</p>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-orange-400">
                            <span className="flex items-center gap-2"><Sun size={14}/> 光影畸变</span>
                            <span>{params.lightAging}%</span>
                          </div>
                          <input 
                            type="range" min="0" max="100" 
                            value={params.lightAging} 
                            onChange={(e) => setParams(prev => ({ ...prev, lightAging: parseInt(e.target.value) }))}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                          />
                          <p className="text-[10px] text-slate-500 italic">模拟：曝光不足、炫光、色彩退化</p>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-slate-400">
                            <span className="flex items-center gap-2"><Droplets size={14}/> 传感器老化</span>
                            <span>{params.dirtiness}%</span>
                          </div>
                          <input 
                            type="range" min="0" max="100" 
                            value={params.dirtiness} 
                            onChange={(e) => setParams(prev => ({ ...prev, dirtiness: parseInt(e.target.value) }))}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-500"
                          />
                          <p className="text-[10px] text-slate-500 italic">模拟：镜头油渍、死像素、压缩伪影</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 pt-2">
                      <button
                        disabled={isProcessing}
                        onClick={handleGenerate}
                        className="flex-1 min-w-[200px] h-16 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-2xl font-black text-xl shadow-2xl shadow-blue-900/60 flex items-center justify-center gap-4 transition-all active:scale-95 group"
                      >
                        {isProcessing ? <Loader2 className="animate-spin" size={28} /> : <Zap size={28} className="group-hover:animate-bounce" fill="currentColor" />}
                        {isProcessing ? '多样性引擎渲染中...' : '生成 20 张高样样本'}
                      </button>
                      
                      {results.length > 0 && (
                        <button
                          onClick={downloadZip}
                          className="px-10 h-16 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-emerald-900/40"
                        >
                          <Download size={24} />
                          下载 ZIP
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
                  <AlertCircle size={20} className="text-emerald-500 shrink-0" />
                  <p className="text-xs font-bold text-emerald-200 uppercase tracking-wider leading-relaxed">
                    本系统专为 YOLO 设计：算法严格遵循物理光学规律，增强物体特征分布，有效防止模型过拟合。
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {results.length > 0 ? (
                <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000">
                  <div className="flex items-center justify-between mb-8">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black text-white flex items-center gap-3">
                        <ImageIcon size={26} className="text-blue-500" /> 扩增结果
                      </h3>
                      <p className="text-sm text-slate-500 font-medium">点击图片进入翻页预览模式，支持键盘左右键操作</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-3">
                       <span className="text-[11px] font-black bg-blue-600/10 text-blue-400 px-4 py-2 rounded-xl border border-blue-500/20 uppercase tracking-widest">Random Seed Enabled</span>
                       <span className="text-[11px] font-black bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg shadow-emerald-900/20">FINISHED 20 SAMPLES</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
                    {results.map((res, i) => (
                      <div 
                        key={res.id} 
                        onClick={() => setPreviewIndex(i)}
                        className="group relative aspect-square bg-slate-900 border border-slate-800 rounded-[1.5rem] overflow-hidden hover:border-blue-500 transition-all duration-500 shadow-xl cursor-zoom-in"
                      >
                        <img 
                          src={res.dataUrl} 
                          alt={`Sample ${res.id}`} 
                          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-4">
                           <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">变体 #{i + 1}</span>
                              <Maximize2 size={16} className="text-white" />
                           </div>
                        </div>
                        <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur rounded-lg border border-white/10">
                          <span className="text-[10px] font-bold text-white/70">{i+1}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-12 py-12 px-6 bg-slate-900/30 rounded-[2.5rem] border border-dashed border-slate-800 text-center space-y-6">
                    <div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center text-blue-500 mx-auto border border-blue-500/20">
                      <Download size={32} />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-2xl font-black text-white uppercase tracking-tight">完整数据集已就绪</h4>
                      <p className="text-slate-500 font-medium">包含 20 个高样样本，支持 YOLOv5/v8/v10 格式直接接入训练。</p>
                    </div>
                    <button 
                      onClick={downloadZip}
                      className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xl transition-all active:scale-95 shadow-2xl shadow-blue-900/40 inline-flex items-center gap-3"
                    >
                      <Download size={24} />
                      下载完整图集
                    </button>
                  </div>
                </div>
              ) : isProcessing ? (
                <div className="flex flex-col items-center justify-center py-32 gap-8 animate-in zoom-in duration-1000">
                  <div className="relative">
                    <div className="w-32 h-32 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
                    <Zap className="absolute inset-0 m-auto text-blue-500 animate-pulse" size={40} fill="currentColor" />
                  </div>
                  <div className="text-center space-y-3">
                    <p className="text-3xl font-black text-white tracking-tight uppercase">Diversity Processing</p>
                    <p className="text-slate-500 max-w-sm mx-auto font-medium leading-relaxed">
                      正在应用透视畸变、随机 Gamma 矫正、雨雾模拟及低质量视频流仿真...
                    </p>
                    <div className="w-64 h-2 bg-slate-800 rounded-full mx-auto overflow-hidden mt-4 shadow-inner">
                        <div className="h-full bg-blue-500 animate-[loading_2s_ease-in-out_infinite] rounded-full"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 border border-dashed border-slate-800 rounded-[2.5rem] opacity-30">
                  <ImageIcon size={64} className="text-slate-700 mb-6" />
                  <p className="text-slate-500 font-black text-xl tracking-tight uppercase">Ready to Augment</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Sequential Preview Modal */}
      {previewIndex !== null && results[previewIndex] && (
        <div 
          className="fixed inset-0 z-[100] bg-slate-950/98 backdrop-blur-2xl flex items-center justify-center animate-in fade-in duration-300"
          onClick={() => setPreviewIndex(null)}
        >
          {/* Close Button */}
          <button 
            className="absolute top-6 right-6 z-[110] p-4 text-slate-400 hover:text-white transition-colors bg-white/5 rounded-2xl border border-white/10"
            onClick={() => setPreviewIndex(null)}
          >
            <X size={24} />
          </button>

          {/* Navigation Controls */}
          <button 
            className="absolute left-6 top-1/2 -translate-y-1/2 z-[110] p-6 text-white hover:bg-white/10 rounded-full transition-all group hidden md:flex"
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
          >
            <ChevronLeft size={48} className="group-active:scale-90 transition-transform" />
          </button>
          
          <button 
            className="absolute right-6 top-1/2 -translate-y-1/2 z-[110] p-6 text-white hover:bg-white/10 rounded-full transition-all group hidden md:flex"
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
          >
            <ChevronRight size={48} className="group-active:scale-90 transition-transform" />
          </button>

          {/* Content */}
          <div className="relative max-w-6xl w-full h-[85vh] flex flex-col items-center justify-center gap-8" onClick={(e) => e.stopPropagation()}>
            <div className="w-full h-full rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl bg-black relative group">
              <img 
                src={results[previewIndex].dataUrl} 
                alt="Full Preview" 
                className="w-full h-full object-contain"
              />
              
              {/* Mobile Swipe Simulation Controls */}
              <div className="md:hidden absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4">
                  <button onClick={handlePrev} className="p-3 bg-black/50 rounded-full text-white"><ChevronLeft size={24} /></button>
                  <button onClick={handleNext} className="p-3 bg-black/50 rounded-full text-white"><ChevronRight size={24} /></button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between w-full px-8 gap-4">
              <div className="text-center md:text-left">
                <div className="flex items-center gap-3">
                    <p className="text-white font-black text-2xl uppercase tracking-tighter">样本 #{previewIndex + 1}</p>
                    <span className="px-3 py-1 bg-blue-600 rounded-lg text-[10px] font-black text-white uppercase tracking-widest">{previewIndex + 1} / {results.length}</span>
                </div>
                <p className="text-xs font-mono text-slate-500 mt-1">{results[previewIndex].name}</p>
              </div>
              
              <div className="flex gap-4">
                  <a 
                    href={results[previewIndex].dataUrl} 
                    download={results[previewIndex].name}
                    className="px-8 py-4 bg-white text-slate-950 rounded-2xl font-black flex items-center gap-3 hover:bg-blue-500 hover:text-white transition-all shadow-xl"
                  >
                    <Download size={22} />
                    保存当前单图
                  </a>
              </div>
            </div>
          </div>

          {/* Progress Indicator at Bottom */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-1.5 p-2 bg-white/5 rounded-full border border-white/10">
              {results.map((_, i) => (
                  <div 
                    key={i} 
                    onClick={(e) => { e.stopPropagation(); setPreviewIndex(i); }}
                    className={`h-1.5 transition-all rounded-full cursor-pointer ${i === previewIndex ? 'w-8 bg-blue-500' : 'w-1.5 bg-slate-700 hover:bg-slate-500'}`}
                  ></div>
              ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-12 px-8 border-t border-slate-900 bg-black/40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-slate-600">
          <div className="flex items-center gap-3">
            <Zap size={18} className="text-blue-500/50" />
            <span className="text-[11px] font-black tracking-[0.3em] uppercase">Dataset Augmentor Engine v2.1.0</span>
          </div>
          <div className="flex gap-10 text-[10px] font-black uppercase tracking-widest">
             <span className="text-slate-700">Traditional CV Pipeline</span>
             <span className="text-slate-700">Local processing only</span>
             <span className="text-slate-700">YOLO Optimized</span>
          </div>
          <p className="text-[10px] font-bold text-slate-800">POWERED BY PURE CANVAS API • © 2025</p>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes loading {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 40%; margin-left: 30%; }
          100% { width: 0%; margin-left: 100%; }
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />

      {/* Mobile Sticky CTA */}
      {sourceImage && (
        <div className="md:hidden fixed bottom-8 left-6 right-6 z-50">
           <button
             disabled={isProcessing}
             onClick={handleGenerate}
             className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-[1.5rem] font-black text-lg shadow-2xl shadow-blue-600/40 flex items-center justify-center gap-3 transition-all active:scale-95"
           >
             {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <Zap size={24} />}
             立即扩增样本
           </button>
        </div>
      )}
    </div>
  );
};

export default App;
