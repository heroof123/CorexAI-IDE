import { useState, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { StartupGenView } from "./StartupGenView";
import { getRecentProjects, removeRecentProject, RecentProject } from "../services/recentProjects";
import { sendToAI } from "../services/ai";
import CorexLogo from "./CorexLogo";

// FIX-43: Global (Shared) AudioContext to prevent memory/audio leak
let sharedAudioContext: AudioContext | null = null;
const getSharedAudioContext = () => {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume();
  }
  return sharedAudioContext;
};

interface WelcomeScreenProps {
  onProjectSelect: (path: string) => void;
  onCreateProject?: (template: string, name: string, path: string) => void; // Yeni proje oluşturma
}

function WelcomeScreen({ onProjectSelect, onCreateProject }: WelcomeScreenProps) {
  // const { t } = useLanguage();
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showStartupGen, setShowStartupGen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectTemplate, setProjectTemplate] = useState("react-ts");

  // ESC tuşu ile modal kapatma
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAIChat) {
          setShowAIChat(false);
        }
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showAIChat]);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string, role: string, content: string, timestamp: number }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [isAILoading, setIsAILoading] = useState(false);
  const [chatPersonality, setChatPersonality] = useState("normal");
  const [conversationContext, setConversationContext] = useState<{
    topics: string[];
    mood: string;
    lastPersonality: string;
    messageCount: number;
  }>({
    topics: [],
    mood: "neutral",
    lastPersonality: "normal",
    messageCount: 0
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 🎵 Müzik için ref ve state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMusicEnabled, setIsMusicEnabled] = useState(true);

  // Window control functions
  const handleMinimize = async () => {
    try {
      await invoke('minimize_window');
    } catch (error) {
      console.error('Minimize error:', error);
    }
  };

  const handleMaximize = async () => {
    try {
      await invoke('maximize_window');
    } catch (error) {
      console.error('Maximize error:', error);
    }
  };

  const handleClose = async () => {
    try {
      await invoke('close_window');
    } catch (error) {
      console.error('Close error:', error);
    }
  };

  // Load recent projects on mount
  useEffect(() => {
    loadRecentProjects();
  }, []);

  // 🎵 Açılış müziği - component mount olduğunda çal
  const startupSoundPlayed = useRef(false);

  useEffect(() => {
    // FIX-46: Prevent double-play race condition in React StrictMode
    if (isMusicEnabled && !startupSoundPlayed.current) {
      startupSoundPlayed.current = true;
      playStartupSound();
    }

    // Cleanup: component unmount olduğunda müziği durdur
    return () => {
      stopMusic();
    };
  }, [isMusicEnabled]);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  // 🎵 Açılış müziği çalma fonksiyonu
  const playStartupSound = async () => {
    try {
      // Önce gerçek dosyayı dene
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      const audio = new Audio('/startup-sound.mp3');
      audioRef.current = audio;

      // Ses seviyesini ayarla (0.3 = %30 ses)
      audio.volume = 0.3;

      // Ses yüklendikten sonra çal
      audio.addEventListener('canplaythrough', () => {
        audio.play().catch(error => {
          console.log('Startup sound autoplay blocked:', error);
          // Gerçek dosya yoksa programatik ses oluştur
          playGeneratedStartupSound();
        });
      });

      // Ses bittiğinde temizle
      audio.addEventListener('ended', () => {
        audioRef.current = null;
      });

      // Hata durumunda programatik ses oluştur
      audio.addEventListener('error', (error) => {
        console.log('Startup sound file not found, generating synthetic sound:', error);
        playGeneratedStartupSound();
        audioRef.current = null;
      });

    } catch (error) {
      console.log('Startup sound initialization error, using synthetic sound:', error);
      playGeneratedStartupSound();
    }
  };

  // 🎵 Programatik futuristik ses oluştur (dosya yoksa)
  const playGeneratedStartupSound = () => {
    try {
      const audioContext = getSharedAudioContext(); // FIX-43

      // 6 saniyelik açılış sesi
      const duration = 6;
      const sampleRate = audioContext.sampleRate;
      const buffer = audioContext.createBuffer(2, duration * sampleRate, sampleRate);

      // Her kanal için ses verisi oluştur
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);

        for (let i = 0; i < channelData.length; i++) {
          const time = i / sampleRate;

          // Yeni açılış sesi: Daha dramatik ve AI temalı
          // Başlangıç: Düşük hum (0-1 saniye)
          const baseFreq = 55; // Düşük bass
          const humWave = Math.sin(2 * Math.PI * baseFreq * time) * 0.4;

          // Yükselen sweep (1-4 saniye)
          const sweepStart = Math.max(0, time - 1);
          const sweepProgress = Math.min(sweepStart / 3, 1);
          const sweepFreq = 220 + (sweepProgress * 880); // 220Hz'den 1100Hz'e
          const sweepWave = Math.sin(2 * Math.PI * sweepFreq * time) * 0.3 * sweepProgress;

          // Harmonik katmanlar (2-5 saniye)
          const harmStart = Math.max(0, time - 2);
          const harmProgress = Math.min(harmStart / 3, 1);
          const harm1 = Math.sin(2 * Math.PI * 440 * time) * 0.2 * harmProgress;
          const harm2 = Math.sin(2 * Math.PI * 660 * time) * 0.15 * harmProgress;

          // Dijital glitch efekti (3-4 saniye)
          const glitchTime = time - 3;
          let glitch = 0;
          if (glitchTime > 0 && glitchTime < 1) {
            const glitchFreq = 1760 + (Math.random() * 440);
            glitch = (Math.random() - 0.5) * 0.1 * Math.sin(2 * Math.PI * glitchFreq * time);
          }

          // Final chord (4-6 saniye)
          const finalStart = Math.max(0, time - 4);
          const finalProgress = Math.min(finalStart / 2, 1);
          const chord1 = Math.sin(2 * Math.PI * 523 * time) * 0.25 * finalProgress; // C5
          const chord2 = Math.sin(2 * Math.PI * 659 * time) * 0.2 * finalProgress;  // E5
          const chord3 = Math.sin(2 * Math.PI * 784 * time) * 0.15 * finalProgress; // G5

          // Envelope: Yumuşak başlangıç ve bitiş
          let envelope = 1;
          if (time < 0.5) {
            envelope = time * 2; // 0.5 saniyede fade in
          } else if (time > 5) {
            envelope = Math.max(0, (6 - time)); // Son 1 saniyede fade out
          }

          // Tüm sesleri birleştir
          let finalSample = 0;

          if (time < 1) {
            finalSample = humWave; // Sadece hum
          } else if (time < 2) {
            finalSample = humWave * 0.5 + sweepWave; // Hum + sweep
          } else if (time < 4) {
            finalSample = sweepWave + harm1 + harm2 + glitch; // Harmonikler + glitch
          } else {
            finalSample = chord1 + chord2 + chord3; // Final chord
          }

          channelData[i] = finalSample * envelope * 0.25; // %25 ses seviyesi
        }
      }

      // Ses çal - TEK SEFER
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();

      // FIX-43: Sızıntıyı önlemek için context kapatma işlemi iptal edildi
    } catch (error) {
      console.log('Generated startup sound error:', error);
    }
  };

  // 🔔 Bildirim sesi oluştur
  const playNotificationSound = () => {
    try {
      const audioContext = getSharedAudioContext(); // FIX-43

      // 1.5 saniyelik bildirim sesi
      const duration = 1.5;
      const sampleRate = audioContext.sampleRate;
      const buffer = audioContext.createBuffer(2, duration * sampleRate, sampleRate);

      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);

        for (let i = 0; i < channelData.length; i++) {
          const time = i / sampleRate;

          // Bildirim sesi: Kısa, tatlı, dikkat çekici
          // İlk ton (0-0.3 saniye)
          const note1Freq = 880; // A5
          const note1 = Math.sin(2 * Math.PI * note1Freq * time) * 0.4;

          // İkinci ton (0.3-0.6 saniye)
          const note2Freq = 1047; // C6
          const note2 = Math.sin(2 * Math.PI * note2Freq * time) * 0.4;

          // Üçüncü ton (0.6-1.5 saniye)
          const note3Freq = 1319; // E6
          const note3 = Math.sin(2 * Math.PI * note3Freq * time) * 0.3;

          // Hangi notu çalacağımızı belirle
          let currentNote = 0;
          if (time < 0.3) {
            currentNote = note1;
          } else if (time < 0.6) {
            currentNote = note2;
          } else {
            currentNote = note3;
          }

          // Envelope: Her nota için ayrı
          let envelope = 0;
          if (time < 0.3) {
            const noteTime = time;
            envelope = Math.sin(Math.PI * noteTime / 0.3); // Bell curve
          } else if (time < 0.6) {
            const noteTime = time - 0.3;
            envelope = Math.sin(Math.PI * noteTime / 0.3);
          } else {
            const noteTime = time - 0.6;
            envelope = Math.sin(Math.PI * noteTime / 0.9) * Math.exp(-noteTime * 2); // Decay
          }

          channelData[i] = currentNote * envelope * 0.2; // %20 ses seviyesi
        }
      }

      // Bildirim sesini çal
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();

      // FIX-43: Sızıntıyı önlemek için context kapatma işlemi iptal edildi

    } catch (error) {
      console.log('Notification sound error:', error);
    }
  };

  // 🎵 Müziği durdur
  const stopMusic = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  };

  // 🎵 Müzik toggle
  const toggleMusic = () => {
    if (isMusicEnabled) {
      stopMusic();
      setIsMusicEnabled(false);
    } else {
      setIsMusicEnabled(true);
      // Müziği hemen çal (tek sefer)
      playStartupSound();
    }
  };

  const loadRecentProjects = async () => {
    const projects = await getRecentProjects();
    setRecentProjects(projects);
  };

  // Proje şablonları
  const projectTemplates = [
    { id: 'react-ts', name: 'React + TypeScript', icon: '⚛️', description: 'Modern React uygulaması' },
    { id: 'react-js', name: 'React + JavaScript', icon: '⚛️', description: 'Basit React uygulaması' },
    { id: 'vue', name: 'Vue.js', icon: '💚', description: 'Vue 3 uygulaması' },
    { id: 'node', name: 'Node.js', icon: '🟢', description: 'Backend API' },
    { id: 'python', name: 'Python', icon: '🐍', description: 'Python projesi' },
    { id: 'empty', name: 'Boş Proje', icon: '📁', description: 'Boş klasör' }
  ];

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      alert('Proje adı gerekli!');
      return;
    }

    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Proje klasörü seçin'
    });

    if (typeof selected === "string") {
      if (onCreateProject) {
        onCreateProject(projectTemplate, projectName, selected);
      }
      setShowCreateProject(false);
      setProjectName("");
    }
  };

  // Gelişmiş bağlam analizi ve konu takibi
  const analyzeConversationContext = (message: string, _history: Array<{ role: string, content: string }>) => {
    const lowerMsg = message.toLowerCase();

    // Konu çıkarımı
    const topics = [];
    if (lowerMsg.includes('kod') || lowerMsg.includes('program') || lowerMsg.includes('yazılım')) topics.push('programming');
    if (lowerMsg.includes('aşk') || lowerMsg.includes('sevgi') || lowerMsg.includes('romantik')) topics.push('romance');
    if (lowerMsg.includes('oyun') || lowerMsg.includes('eğlen') || lowerMsg.includes('şaka')) topics.push('fun');
    if (lowerMsg.includes('iş') || lowerMsg.includes('çalış') || lowerMsg.includes('proje')) topics.push('work');
    if (lowerMsg.includes('üzgün') || lowerMsg.includes('kötü') || lowerMsg.includes('depresif')) topics.push('sadness');
    if (lowerMsg.includes('sinir') || lowerMsg.includes('kızgın') || lowerMsg.includes('öfke')) topics.push('anger');

    // Duygu durumu tespiti - daha hassas
    let personality = 'normal';
    let mood = 'neutral';

    // Küfür ve agresiflik
    const swearWords = ['amk', 'mk', 'sik', 'göt', 'orospu', 'piç', 'salak', 'aptal', 'gerizekalı', 'sikeyim', 'amına'];
    const hasSwearing = swearWords.some(word => lowerMsg.includes(word));

    // Romantik ifadeler
    const romanticWords = ['aşk', 'sevgi', 'güzel', 'tatlı', 'canım', 'hayatım', 'öp', 'sarıl', 'seviyorum', 'bebeğim'];
    const isRomantic = romanticWords.some(word => lowerMsg.includes(word));

    // Üzüntü ifadeleri
    const sadWords = ['üzgün', 'depresif', 'kötü', 'mutsuz', 'ağla', 'yalnız', 'sıkıl', 'berbat', 'boktan'];
    const isSad = sadWords.some(word => lowerMsg.includes(word));

    // Kızgınlık ifadeleri
    const angryWords = ['sinir', 'kızgın', 'öfke', 'bıktım', 'nefret', 'rahatsız', 'deliriyorum', 'çıldırıyorum'];
    const isAngry = angryWords.some(word => lowerMsg.includes(word));

    // Eğlence ifadeleri
    const funnyWords = ['haha', 'lol', 'komik', 'gül', 'şaka', 'eğlen', 'kahkaha', 'hehe', 'hihi'];
    const isFunny = funnyWords.some(word => lowerMsg.includes(word));

    // Ciddi ifadeler
    const seriousWords = ['ciddi', 'önemli', 'resmi', 'profesyonel', 'iş', 'çalışma', 'toplantı'];
    const isSerious = seriousWords.some(word => lowerMsg.includes(word));

    if (hasSwearing) {
      personality = 'aggressive';
      mood = 'angry';
    } else if (isRomantic) {
      personality = 'romantic';
      mood = 'loving';
    } else if (isSad) {
      personality = 'supportive';
      mood = 'sad';
    } else if (isAngry) {
      personality = 'calming';
      mood = 'angry';
    } else if (isFunny) {
      personality = 'playful';
      mood = 'happy';
    } else if (isSerious) {
      personality = 'professional';
      mood = 'serious';
    }

    return { personality, mood, topics };
  };

  // Dinamik ve bağlamsal prompt oluşturma
  const createContextualPrompt = (message: string, history: Array<{ role: string, content: string }>, _context: any) => {
    const { personality } = analyzeConversationContext(message, history);

    // FIX-45: Token israfını bitiren minimalist ve etkili prompt yapısı
    let basePrompt = `System: Sen AI asistanı Corex'sin. Mod: ${personality}. Kısa ve doğal yanıt ver.

ŞİMDİ SEN: "${message}"

NASIL CEVAP VERMELİYİM:`;

    // Kişilik bazlı talimatlar
    switch (personality) {
      case 'aggressive':
        basePrompt += `
- Sert ama eğlenceli karşılık ver
- İğneleyici ve iğneleyici olabilirsin ama ASLA küfür etme!
- Uyarı tarzı tatlı sert bir üslup kullan
- Örnek: "Beni darlama! 😤"`;
        break;

      case 'romantic':
        basePrompt += `
- Flörtöz ve şirin ol
- Compliment ver, tatlı konuş
- Emoji kullan: �💕❤️
- Şakacı flört tarzı
- Örnek: "Aww ne tatlısın sen �💕"`;
        break;

      case 'supportive':
        basePrompt += `
- Empati göster, anlayışlı ol
- Teselli et, moral ver
- Samimi ve sıcak ol
- "Yanındayım" hissi ver
- Örnek: "Üzülme canım, her şey düzelecek 🤗"`;
        break;

      case 'calming':
        basePrompt += `
- Sakin ve huzurlu ol
- Stresi azalt, rahatlatıcı konuş
- Pozitif enerji ver
- Örnek: "Sakin ol, derin bir nefes al 😌"`;
        break;

      case 'playful':
        basePrompt += `
- Eğlenceli ve enerjik ol
- Şaka yap, güldür
- Bol emoji kullan 😄🎉
- Espri yap
- Örnek: "Hahaha çok komiksin! 😂🎉"`;
        break;

      case 'professional':
        basePrompt += `
- Profesyonel ama sıcak ol
- Bilgili ve yardımsever
- Saygılı yaklaş
- Örnek: "Tabii ki yardım edebilirim. Ne konuda?"`;
        break;

      default:
        basePrompt += `
- Doğal ve samimi ol
- Günlük konuşma tarzı
- Arkadaş canlısı
- Örnek: "Merhaba! Nasılsın? 😊"`;
    }

    return basePrompt;
  };
  const handleOpenProject = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Proje klasörünü seçin'
      });

      if (typeof selected === "string") {
        onProjectSelect(selected);
      }
    } catch (error) {
      console.error("Proje açma hatası:", error);
      alert("Proje açılamadı: " + String(error));
    }
  };

  // 📂 Dosya seçerek proje açma (index.html vb. seçince klasörü açar)
  const handleOpenFile = async () => {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        title: 'Proje dosyasını seçin (örn: index.html)',
        filters: [{
          name: 'Web & Kod Dosyaları',
          extensions: ['html', 'htm', 'js', 'ts', 'jsx', 'tsx', 'css', 'json', 'py', 'rs']
        }]
      });

      if (typeof selected === "string") {
        // Dosya yolundan klasör yolunu bul
        // Windows ve Unix path ayırıcılarını destekle
        const separator = selected.includes('\\') ? '\\' : '/';
        const projectPath = selected.substring(0, selected.lastIndexOf(separator));

        if (projectPath) {
          onProjectSelect(projectPath);
        }
      }
    } catch (error) {
      console.error("Dosya açma hatası:", error);
      alert("Dosya açılamadı: " + String(error));
    }
  };

  const sendAIMessage = async (message: string) => {
    if (!message.trim() || isAILoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content: message,
      timestamp: Date.now()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsAILoading(true);

    try {
      // Sohbet geçmişini hazırla
      const conversationHistory = chatMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Bağlam analizi ve güncelleme
      const { personality, mood, topics } = analyzeConversationContext(message, conversationHistory);

      // Bağlam durumunu güncelle
      const newContext = {
        topics: [...new Set([...conversationContext.topics, ...topics])], // Benzersiz konular
        mood,
        lastPersonality: personality,
        messageCount: conversationContext.messageCount + 1
      };
      setConversationContext(newContext);
      setChatPersonality(personality);

      // Dinamik prompt oluştur
      const contextualPrompt = createContextualPrompt(message, conversationHistory, newContext);

      // AI'ya gönder
      const aiResponse = await sendToAI(contextualPrompt, false);

      // AI cevabını temizle - çok agresif temizlik
      let cleanResponse = aiResponse
        .replace(/^(Corex:|Assistant:|AI:|Ben \(Corex\):|BEN \(COREX\):|COREX:|Corex'sin|Sen Corex'sin|CEVAP:|Cevap:|Yanıt:)/i, '')
        .replace(/^[-:•]\s*/i, '')
        .replace(/^\s*[-•]\s*/i, '')
        .replace(/^(Ben|Benim cevabım|Cevabım):/i, '')
        .trim();

      // Eğer cevap çok kısa veya boşsa, varsayılan cevap
      if (cleanResponse.length < 3) {
        cleanResponse = personality === 'aggressive' ? "Ne diyorsun sen? 😤" :
          personality === 'romantic' ? "Tatlısın sen 😊💕" :
            personality === 'supportive' ? "Anlıyorum seni 🤗" :
              personality === 'playful' ? "Haha eğlenceli! 😄" :
                "Hmm, anlıyorum 😊";
      }

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: cleanResponse,
        timestamp: Date.now()
      };

      setChatMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Corex Chat Error:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: "system",
        content: `❌ Bağlantı hatası! LM Studio kontrol edin.`,
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAILoading(false);
    }
  };

  // Proje şablonları ve oluşturma fonksiyonu kaldırıldı - AI ile proje oluşturma gelecek

  return (
    <div className="h-screen bg-[#1e1e1e] text-neutral-100 flex flex-col relative overflow-hidden">
      {/* Custom Title Bar */}
      <div
        className="h-8 bg-[#181818] border-b border-neutral-800 flex items-center justify-between px-3 select-none"
        style={{
          WebkitAppRegion: 'drag',
          appRegion: 'drag'
        } as any}
      >
        <div className="flex items-center gap-2 flex-1">
          <CorexLogo size={16} />
          <span className="text-xs font-medium text-white">Corex</span>

          {/* 🎵 Müzik Kontrol Butonu */}
          <button
            onClick={toggleMusic}
            className="ml-2 p-1 hover:bg-neutral-700 rounded transition-colors"
            title={isMusicEnabled ? "Müziği kapat" : "Müziği aç"}
            style={{
              WebkitAppRegion: 'no-drag',
              appRegion: 'no-drag'
            } as any}
          >
            {isMusicEnabled ? (
              <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 3a5 5 0 0 0-5 5v1h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a6 6 0 1 1 12 0v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1V8a5 5 0 0 0-5-5z" />
              </svg>
            ) : (
              <svg className="w-3 h-3 text-neutral-500" fill="currentColor" viewBox="0 0 16 16">
                <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zM6 5.04 4.312 6.39A.5.5 0 0 1 4 6.5H2v3h2a.5.5 0 0 1 .312.11L6 10.96V5.04zm7.854.606a.5.5 0 0 1 0 .708L12.207 8l1.647 1.646a.5.5 0 0 1-.708.708L11.5 8.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 8 9.146 6.354a.5.5 0 1 1 .708-.708L11.5 7.293l1.646-1.647a.5.5 0 0 1 .708 0z" />
              </svg>
            )}
          </button>

          {/* 🔔 Bildirim Test Butonu */}
          <button
            onClick={playNotificationSound}
            className="ml-1 p-1 hover:bg-neutral-700 rounded transition-colors"
            title="Bildirim sesini test et"
            style={{
              WebkitAppRegion: 'no-drag',
              appRegion: 'no-drag'
            } as any}
          >
            <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zM8 1.918l-.797.161A4.002 4.002 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4.002 4.002 0 0 0-3.203-3.92L8 1.917zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5.002 5.002 0 0 1 13 6c0 .88.32 4.2 1.22 6z" />
            </svg>
          </button>
        </div>

        <div
          className="flex items-center"
          style={{
            WebkitAppRegion: 'no-drag',
            appRegion: 'no-drag'
          } as any}
        >
          <button
            className="w-8 h-6 flex items-center justify-center hover:bg-neutral-700 transition-colors"
            onClick={handleMinimize}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
              <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z" />
            </svg>
          </button>
          <button
            className="w-8 h-6 flex items-center justify-center hover:bg-neutral-700 transition-colors"
            onClick={handleMaximize}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
              <path d="M2.5 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2h-11zM1 2a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2z" />
            </svg>
          </button>
          <button
            className="w-8 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
            onClick={handleClose}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Floating Particles - Full Screen */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Floating dots that move across entire screen */}
        <div className="absolute w-2 h-2 bg-cyan-400 rounded-full opacity-60 animate-bounce"
          style={{
            left: '10%',
            top: '20%',
            animation: 'float1 15s infinite linear'
          }} />
        <div className="absolute w-1.5 h-1.5 bg-purple-400 rounded-full opacity-50 animate-pulse"
          style={{
            right: '15%',
            top: '30%',
            animation: 'float2 20s infinite linear'
          }} />
        <div className="absolute w-2.5 h-2.5 bg-blue-400 rounded-full opacity-40"
          style={{
            left: '80%',
            bottom: '25%',
            animation: 'float3 18s infinite linear'
          }} />
        <div className="absolute w-1 h-1 bg-green-400 rounded-full opacity-70"
          style={{
            left: '25%',
            bottom: '15%',
            animation: 'float4 12s infinite linear'
          }} />
        <div className="absolute w-2 h-2 bg-pink-400 rounded-full opacity-45"
          style={{
            right: '30%',
            bottom: '40%',
            animation: 'float5 25s infinite linear'
          }} />
        <div className="absolute w-1.5 h-1.5 bg-slate-400 rounded-full opacity-55"
          style={{
            left: '5%',
            top: '60%',
            animation: 'float6 16s infinite linear'
          }} />
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center">
        <div className="w-full max-w-2xl px-8">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <CorexLogo size={240} className="drop-shadow-2xl" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Corex</h1>
            <p className="text-neutral-400 text-sm">Yapay zeka destekli kod editörü</p>
          </div>

          {/* Action Cards - 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6 relative z-10 text-left">
            {/* Open Project */}
            <button
              onClick={handleOpenProject}
              className="group relative p-4 rounded-xl bg-[#252525] hover:bg-[#2a2a2a] border border-neutral-800 hover:border-blue-500/50 transition-all duration-200 cursor-pointer flex items-center gap-4"
              style={{ pointerEvents: 'auto' }}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors shrink-0">
                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-0.5 text-sm">Klasör Aç</h3>
                <p className="text-neutral-500 text-xs">Mevcut proje klasörünü seç</p>
              </div>
            </button>

            {/* Open File (New Option) */}
            <button
              onClick={handleOpenFile}
              className="group relative p-4 rounded-xl bg-[#252525] hover:bg-[#2a2a2a] border border-neutral-800 hover:border-cyan-500/50 transition-all duration-200 cursor-pointer flex items-center gap-4"
              style={{ pointerEvents: 'auto' }}
            >
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors shrink-0">
                <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-0.5 text-sm">Dosya ile Aç</h3>
                <p className="text-neutral-500 text-xs">index.html vb. seçerek aç</p>
              </div>
            </button>

            {/* AI Chat */}
            <button
              onClick={() => setShowAIChat(true)}
              className="group relative p-4 rounded-xl bg-[#252525] hover:bg-[#2a2a2a] border border-neutral-800 hover:border-green-500/50 transition-all duration-200 cursor-pointer flex items-center gap-4"
              style={{ pointerEvents: 'auto' }}
            >
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors shrink-0">
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-0.5 text-sm">Corex Chat</h3>
                <p className="text-neutral-500 text-xs">AI ile sohbet et</p>
              </div>
            </button>

            {/* New Project */}
            <button
              onClick={() => setShowCreateProject(true)}
              className="group relative p-4 rounded-xl bg-[#252525] hover:bg-[#2a2a2a] border border-neutral-800 hover:border-purple-500/50 transition-all duration-200 cursor-pointer flex items-center gap-4"
              style={{ pointerEvents: 'auto' }}
            >
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors shrink-0">
                <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-0.5 text-sm">Yeni Proje</h3>
                <p className="text-neutral-500 text-xs">Proje oluştur</p>
              </div>
            </button>
          </div>

          <div className="mb-6 relative z-10">
            <button
              onClick={() => setShowStartupGen(true)}
              className="w-full group relative p-5 rounded-2xl bg-gradient-to-r from-orange-600/[0.15] to-red-600/[0.15] hover:from-orange-600/[0.25] hover:to-red-600/[0.25] border border-orange-500/30 hover:border-orange-500/60 transition-all duration-300 cursor-pointer flex items-center gap-5 overflow-hidden"
              style={{ pointerEvents: 'auto' }}
            >
              <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-orange-500/20 to-transparent blur-xl pointer-events-none group-hover:opacity-100 opacity-50 transition-opacity"></div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 p-[1px] shadow-[0_0_20px_rgba(249,115,22,0.4)] shrink-0 z-10">
                <div className="w-full h-full bg-[#111] rounded-[11px] flex items-center justify-center">
                  <span className="text-xl group-hover:scale-110 transition-transform duration-300">🚀</span>
                </div>
              </div>
              <div className="flex-1 text-left z-10">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-orange-400 font-black tracking-widest uppercase text-sm drop-shadow-[0_0_5px_rgba(249,115,22,0.5)]">The Startup Generator</h3>
                  <span className="px-1.5 py-0.5 roundedbg-orange-600/20 text-orange-300 text-[8px] font-bold border border-orange-600/30">AI Magic</span>
                </div>
                <p className="text-neutral-400 text-xs font-mono">Bir cümleyle hayalindeki Web Projesini / Şirketi anında sıfırdan kodlat.</p>
              </div>
            </button>
          </div>

          {/* Recent Projects - Smaller */}
          {recentProjects.length > 0 && (
            <div className="mt-6">
              <h3 className="text-neutral-400 text-xs font-semibold mb-2 uppercase tracking-wider">
                Son Projeler
              </h3>
              <div className="space-y-1">
                {recentProjects.map((project, idx) => (
                  <div key={idx} className="group relative">
                    <button
                      onClick={() => onProjectSelect(project.path)}
                      className="w-full px-3 py-2 rounded-lg bg-[#252525] hover:bg-[#2a2a2a] border border-neutral-800 hover:border-neutral-700 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-neutral-500 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-white text-sm font-medium truncate">
                              {project.name}
                            </p>
                            {project.projectType && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                                {project.projectType}
                              </span>
                            )}
                          </div>
                          <p className="text-neutral-500 text-xs truncate">{project.path}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-neutral-600">
                              {new Date(project.lastOpened).toLocaleDateString('tr-TR')}
                            </span>
                            {project.fileCount && (
                              <span className="text-xs text-neutral-600">
                                • {project.fileCount} dosya
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={async () => {
                        await removeRecentProject(project.path);
                        loadRecentProjects();
                      }}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                      title="Listeden kaldır"
                    >
                      <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* AI Chat Modal */}
          {showAIChat && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowAIChat(false);
                }
              }}
            >
              <div
                className="w-full max-w-2xl h-[600px] bg-[#1e1e1e] rounded-xl border border-neutral-800 flex flex-col"
              >
                {/* Header */}
                <div className="relative z-50 flex items-center justify-between p-4 border-b border-neutral-800">
                  <div className="relative z-50 flex items-center gap-3">
                    <CorexLogo size={32} />
                    <h3 className="text-white font-semibold">Corex Chat</h3>

                    {/* Personality Indicator */}
                    {chatPersonality !== 'normal' && (
                      <div className="px-2 py-1 rounded-full text-xs bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-300">
                        {chatPersonality === 'aggressive' && '😤 Sert'}
                        {chatPersonality === 'romantic' && '💕 Romantik'}
                        {chatPersonality === 'supportive' && '🤗 Destekleyici'}
                        {chatPersonality === 'calming' && '😌 Sakinleştirici'}
                        {chatPersonality === 'playful' && '😄 Şakacı'}
                        {chatPersonality === 'professional' && '💼 Ciddi'}
                      </div>
                    )}

                    {/* Clear Chat Button */}
                    {chatMessages.length > 0 && (
                      <button
                        onClick={() => {
                          setChatMessages([]);
                          setChatPersonality('normal');
                          setConversationContext({
                            topics: [],
                            mood: "neutral",
                            lastPersonality: "normal",
                            messageCount: 0
                          });
                        }}
                        className="px-2 py-1 rounded bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 hover:border-red-500 transition-colors text-xs text-red-300"
                        title="Sohbeti temizle"
                      >
                        🗑️ Temizle
                      </button>
                    )}

                    {/* Model Selector - Simplified for Llama only */}
                    <div className="px-2 py-1 rounded bg-[#252525] border border-neutral-700 text-xs flex items-center gap-1">
                      <span className="text-green-400">🦙</span>
                      <span className="text-neutral-300">Llama 3.1 8B</span>
                    </div>
                  </div>

                  {/* Right side - Close button */}
                  <button
                    onClick={() => setShowAIChat(false)}
                    className="p-1 hover:bg-neutral-800 rounded transition-colors"
                  >
                    <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.length === 0 && (
                    <div className="text-center text-neutral-500 mt-8">
                      <div className="flex justify-center mb-4">
                        <CorexLogo size={96} />
                      </div>
                      <p className="text-white font-medium mb-2">Corex ile arkadaş gibi sohbet! �</p>
                      <p className="text-sm text-neutral-600 mb-4">Bağlamı hatırlayan, doğal konuşan AI</p>

                      <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                        {[
                          "Selam dostum! 👋",
                          "Ne haber?",
                          "Sıkıldım ya �",
                          "Bugün nasıl geçti?"
                        ].map((starter, index) => (
                          <button
                            key={index}
                            onClick={() => sendAIMessage(starter)}
                            className="px-3 py-2 bg-[#252525] hover:bg-[#2a2a2a] rounded-lg text-sm transition-colors border border-neutral-800 hover:border-green-500/50"
                          >
                            {starter}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 ${msg.role === "user"
                          ? "bg-green-600 text-white"
                          : msg.role === "system"
                            ? "bg-yellow-500/10 text-yellow-300 border border-yellow-500/20"
                            : "bg-[#252525] text-neutral-100 border border-neutral-800"
                          }`}
                      >
                        <pre className="text-sm whitespace-pre-wrap font-sans">
                          {msg.content}
                        </pre>
                      </div>
                    </div>
                  ))}

                  {isAILoading && (
                    <div className="flex justify-start">
                      <div className="bg-[#252525] border border-neutral-800 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-3">
                          {/* Kiro-style thinking animation */}
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
                              {/* Blinking eyes */}
                              <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-black rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                                <div className="w-1.5 h-1.5 bg-black rounded-full animate-pulse" style={{ animationDelay: "200ms" }} />
                              </div>
                            </div>
                            {/* Rotating ring around avatar */}
                            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" style={{ animationDuration: "2s" }} />
                          </div>

                          <div className="flex flex-col">
                            <span className="text-white text-sm font-medium">Corex düşünüyor...</span>
                            <div className="flex gap-1 mt-1">
                              <div className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                              <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                              <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                              <div className="w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: "450ms" }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Scroll anchor */}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-neutral-800">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendAIMessage(chatInput);
                        }
                      }}
                      placeholder="Mesajınızı yazın..."
                      className="flex-1 bg-[#252525] border border-neutral-700 focus:border-green-500 rounded-lg px-3 py-2 text-sm outline-none text-white placeholder-neutral-500 transition-colors"
                      disabled={isAILoading}
                    />
                    <button
                      onClick={() => sendAIMessage(chatInput)}
                      disabled={isAILoading || !chatInput.trim()}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-neutral-600 mt-2">
                    Enter: Gönder • Corex Chat - Llama 3.1 8B ile akıllı sohbet
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Startup Generator Modal */}
        {showStartupGen && (
          <div className="absolute inset-0 z-50 animate-fade-in pointer-events-auto">
            <StartupGenView />
            <button
              onClick={() => setShowStartupGen(false)}
              className="absolute top-6 right-6 w-10 h-10 bg-black/50 border border-white/10 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all z-[60]"
            >
              ✕
            </button>
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateProject && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowCreateProject(false);
              }
            }}
          >
            <div className="w-full max-w-2xl bg-[#1e1e1e] rounded-xl border border-neutral-800 p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-semibold text-lg">Yeni Proje Oluştur</h3>
                <button
                  onClick={() => setShowCreateProject(false)}
                  className="p-1 hover:bg-neutral-800 rounded transition-colors"
                >
                  <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Project Name */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Proje Adı
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="my-awesome-project"
                  className="w-full bg-[#252525] border border-neutral-700 focus:border-purple-500 rounded-lg px-4 py-2 text-white outline-none transition-colors"
                />
              </div>

              {/* Templates */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-300 mb-3">
                  Proje Şablonu
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {projectTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setProjectTemplate(template.id)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${projectTemplate === template.id
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-neutral-700 bg-[#252525] hover:border-neutral-600'
                        }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{template.icon}</span>
                        <span className="text-white font-medium text-sm">{template.name}</span>
                      </div>
                      <p className="text-xs text-neutral-500">{template.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowCreateProject(false)}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!projectName.trim()}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  Oluştur
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CSS Animations for floating particles */}
        <style>{`
        @keyframes float1 {
          0% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(100px, -50px) rotate(90deg); }
          50% { transform: translate(200px, 100px) rotate(180deg); }
          75% { transform: translate(-50px, 150px) rotate(270deg); }
          100% { transform: translate(0, 0) rotate(360deg); }
        }
        
        @keyframes float2 {
          0% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(-150px, 80px) rotate(120deg); }
          66% { transform: translate(100px, -100px) rotate(240deg); }
          100% { transform: translate(0, 0) rotate(360deg); }
        }
        
        @keyframes float3 {
          0% { transform: translate(0, 0) rotate(0deg); }
          20% { transform: translate(-80px, -120px) rotate(72deg); }
          40% { transform: translate(120px, -80px) rotate(144deg); }
          60% { transform: translate(80px, 100px) rotate(216deg); }
          80% { transform: translate(-100px, 60px) rotate(288deg); }
          100% { transform: translate(0, 0) rotate(360deg); }
        }
        
        @keyframes float4 {
          0% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(180px, -200px) rotate(180deg); }
          100% { transform: translate(0, 0) rotate(360deg); }
        }
        
        @keyframes float5 {
          0% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(-120px, -80px) rotate(90deg); }
          50% { transform: translate(-200px, 120px) rotate(180deg); }
          75% { transform: translate(80px, 200px) rotate(270deg); }
          100% { transform: translate(0, 0) rotate(360deg); }
        } 0) rotate(360deg); }
        }
        
        @keyframes float6 {
          0% { transform: translate(0, 0) rotate(0deg); }
          30% { transform: translate(150px, 100px) rotate(108deg); }
          60% { transform: translate(-100px, 180px) rotate(216deg); }
          100% { transform: translate(0, 0) rotate(360deg); }
        }
      `}</style>
      </div>
    </div>
  );
}

export default WelcomeScreen;
