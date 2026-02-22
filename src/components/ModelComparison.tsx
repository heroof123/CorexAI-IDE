import { useState, useRef, useEffect } from 'react';
import { compareModels } from '../services/ai';
import { loadAIProviders, AIModel } from '../services/aiProvider';
import { Message } from '../types';

interface ModelComparisonProps {
  onClose: () => void;
}

export default function ModelComparison({ onClose }: ModelComparisonProps) {
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [model1Id, setModel1Id] = useState<string>('');
  const [model2Id, setModel2Id] = useState<string>('');

  const [input, setInput] = useState('');
  const [isComparing, setIsComparing] = useState(false);

  const [messages1, setMessages1] = useState<Message[]>([]);
  const [messages2, setMessages2] = useState<Message[]>([]);

  const [metrics1, setMetrics1] = useState({ speed: 0, tokens: 0, duration: 0 });
  const [metrics2, setMetrics2] = useState({ speed: 0, tokens: 0, duration: 0 });

  const messagesEndRef1 = useRef<HTMLDivElement>(null);
  const messagesEndRef2 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const providers = await loadAIProviders();
      const allModels: AIModel[] = [];
      providers.forEach(p => {
        // GGUF provider için tüm indirilmiş modelleri ekle
        if (p.id === 'gguf-direct' || p.baseUrl === 'internal://gguf') {
          allModels.push(...p.models.filter(m => m.isActive || (m as any).isDownloaded));
        } else if (p.isActive) {
          // Diğer provider'lar için sadece aktif olanları ekle
          allModels.push(...p.models.filter(m => m.isActive));
        }
      });

      // Tekilleştir (ID'ye göre)
      const uniqueModels = allModels.filter((model, index, self) =>
        index === self.findIndex((m) => m.id === model.id)
      );

      setAvailableModels(uniqueModels);

      // Varsayılan seçimleri ayarla
      if (uniqueModels.length >= 2) {
        setModel1Id(uniqueModels[0].id);
        setModel2Id(uniqueModels[1].id);
      } else if (uniqueModels.length === 1) {
        setModel1Id(uniqueModels[0].id);
      }
    };

    init();
  }, []);

  useEffect(() => {
    messagesEndRef1.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages1]);

  useEffect(() => {
    messagesEndRef2.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages2]);

  const handleSend = async () => {
    if (!input.trim() || !model1Id || !model2Id || isComparing) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages1(prev => [...prev, userMsg]);
    setMessages2(prev => [...prev, userMsg]);
    setIsComparing(true);

    setMessages1(prev => [...prev, { id: 'm1-loading', role: 'assistant', content: '', timestamp: Date.now() }]);
    setMessages2(prev => [...prev, { id: 'm2-loading', role: 'assistant', content: '', timestamp: Date.now() }]);

    const currentInput = input;
    setInput('');

    try {
      await compareModels(
        currentInput,
        model1Id,
        model2Id,
        (token, m) => {
          setMessages1(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, content: last.content + token }];
            }
            return prev;
          });
          if (m?.speed) setMetrics1(prev => ({ ...prev, speed: m.speed }));
        },
        (token, m) => {
          setMessages2(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, content: last.content + token }];
            }
            return prev;
          });
          if (m?.speed) setMetrics2(prev => ({ ...prev, speed: m.speed }));
        }
      ).then(res => {
        setMetrics1(prev => ({ ...prev, ...res.metrics1 }));
        setMetrics2(prev => ({ ...prev, ...res.metrics2 }));
      });
    } catch (error) {
      console.error('Comparison error:', error);
    } finally {
      setIsComparing(false);
    }
  };

  const ChatColumn = ({
    modelId,
    messages,
    metrics,
    endRef,
    color
  }: {
    modelId: string,
    messages: Message[],
    metrics: any,
    endRef: any,
    color: string
  }) => {
    const model = availableModels.find(m => m.id === modelId);
    return (
      <div className="flex flex-col h-full border-r border-gray-700 last:border-r-0">
        {/* Model Header */}
        <div className={`p-3 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center`}>
          <div>
            <h3 className={`font-bold ${color}`}>{model?.displayName || 'Model'}</h3>
            <p className="text-[10px] text-gray-500">{model?.name}</p>
          </div>
          <div className="text-right">
            <div className="text-xs font-mono text-gray-400">{metrics.speed.toFixed(1)} t/s</div>
            <div className="text-[10px] text-gray-500">{metrics.tokens} tokens</div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] p-3 rounded-lg text-sm ${msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-100 border border-gray-600'
                }`}>
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-white">
      {/* Top Bar - Selection */}
      <div className="p-3 border-b border-gray-700 bg-gray-900 flex items-center justify-between gap-4">
        {availableModels.length >= 1 ? (
          <div className="flex items-center gap-4 flex-1">
            <div className="flex-1">
              <select
                value={model1Id}
                onChange={e => setModel1Id(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
              >
                {availableModels.map(m => (
                  <option key={m.id} value={m.id}>{m.displayName}</option>
                ))}
              </select>
            </div>
            <div className="text-gray-500 font-bold">VS</div>
            <div className="flex-1">
              <select
                value={model2Id}
                onChange={e => setModel2Id(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs outline-none focus:border-green-500"
              >
                {availableModels.length < 2 ? (
                  <option value="">Başka aktif model yok</option>
                ) : (
                  availableModels.map(m => (
                    <option key={m.id} value={m.id}>{m.displayName}</option>
                  ))
                )}
              </select>
            </div>
          </div>
        ) : (
          <div className="flex-1 text-xs text-yellow-500">
            ⚠️ Hiç aktif model bulunamadı. Lütfen AI Ayarları'ndan modelleri aktif edin.
          </div>
        )}
        <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded text-gray-500">✕</button>
      </div>

      {/* Comparison Chat Area */}
      <div className="flex-1 flex overflow-hidden">
        <ChatColumn
          modelId={model1Id}
          messages={messages1}
          metrics={metrics1}
          endRef={messagesEndRef1}
          color="text-blue-400"
        />
        <ChatColumn
          modelId={model2Id}
          messages={messages2}
          metrics={metrics2}
          endRef={messagesEndRef2}
          color="text-green-400"
        />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-700 bg-gray-900">
        <div className="relative">
          <textarea
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 pr-12 text-sm outline-none focus:border-blue-500 transition-colors resize-none"
            placeholder="İki modeli karşılaştırmak için bir soru yazın..."
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={isComparing || !input.trim()}
            className="absolute right-3 bottom-3 p-2 bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

