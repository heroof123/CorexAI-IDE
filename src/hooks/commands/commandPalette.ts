import { babelEngine } from "../../services/babelEngine";
import { quantumCodeSuperposition } from "../../services/quantumCodeSuperposition";
import { codeDnaSplicing } from "../../services/codeDnaSplicing";
import { legacyWhisperer } from "../../services/legacyWhisperer";
import { synestheticCodeView } from "../../services/synestheticCodeView";
import { polyglotEngine } from "../../services/polyglotEngine";
import { freshEyesMode } from "../../services/freshEyesMode";
import { blackholeGarbageCollector } from "../../services/blackholeGarbageCollector";
import { codeEthicsEnforcer } from "../../services/codeEthicsEnforcer";

// Action tipleri için basit tipler (tam tipleme useAppLogic'ten gelecektir)
type VoidAction = () => void;

export function buildCommandPaletteList(
    editor: any,
    project: any,
    ui: any,
    toggleRightSidebar: VoidAction,
    toggleBottomPanel: VoidAction,
    toggleZenMode: VoidAction,
    notify: (type: "success" | "error" | "warning" | "info", title: string, message: string) => void
) {
    return [
        {
            id: "save-file",
            title: "Dosya Kaydet",
            description: "Aktif dosyayı kaydet",
            category: "Dosya",
            icon: "💾",
            shortcut: "Ctrl+S",
            action: editor.saveFile,
        },
        {
            id: "open-project",
            title: "Proje Aç",
            description: "Yeni proje klasörü aç",
            category: "Dosya",
            icon: "📁",
            shortcut: "Ctrl+O",
            action: project.handleOpenProject,
        },
        {
            id: "quick-open",
            title: "Hızlı Dosya Aç",
            description: "Dosya adı ile hızlı arama",
            category: "Gezinme",
            icon: "🔍",
            shortcut: "Ctrl+P",
            action: () => ui.setShowQuickFileOpen(true),
        },
        {
            id: "find-in-files",
            title: "Dosyalarda Ara",
            description: "Tüm projede metin ara",
            category: "Arama",
            icon: "🔎",
            shortcut: "Ctrl+Shift+F",
            action: () => ui.setShowFindInFiles(true),
        },
        {
            id: "toggle-terminal",
            title: "Terminal Aç/Kapat",
            description: "Terminal panelini göster/gizle",
            category: "Görünüm",
            icon: "💻",
            shortcut: "Ctrl+`",
            action: () => ui.setShowTerminal((p: boolean) => !p),
        },
        {
            id: "toggle-browser",
            title: "Browser Panel Aç/Kapat",
            description: "Web test browser'ını göster/gizle",
            category: "Görünüm",
            icon: "🌐",
            shortcut: "Ctrl+Shift+B",
            action: () => ui.setShowBrowserPanel((p: boolean) => !p),
        },
        {
            id: "toggle-sidebar",
            title: "Activity Bar Aç/Kapat",
            description: "Sol activity bar'ı göster/gizle",
            category: "Görünüm",
            icon: "📂",
            shortcut: "Ctrl+B",
            action: () => ui.setShowActivitySidebar((p: boolean) => !p),
        },
        {
            id: "toggle-chat",
            title: "AI Sohbet Aç/Kapat",
            description: "Sağ AI sohbet panelini göster/gizle",
            category: "Görünüm",
            icon: "🤖",
            shortcut: "Ctrl+Shift+A",
            action: toggleRightSidebar,
        },
        {
            id: "toggle-bottom-panel",
            title: "Alt Panel Aç/Kapat",
            description: "Problems, Terminal, Debug panelini göster/gizle",
            category: "Görünüm",
            icon: "📊",
            shortcut: "Ctrl+J",
            action: toggleBottomPanel,
        },
        {
            id: "layout-presets",
            title: "Düzen Presetleri",
            description: "Hazır düzen şablonları",
            category: "Görünüm",
            icon: "🎨",
            shortcut: "Ctrl+Shift+L",
            action: () => ui.setShowLayoutPresets(true),
        },
        {
            id: "toggle-zen-mode",
            title: "Zen Modu Aç/Kapat",
            description: "Tüm panelleri gizle ve koda odaklan",
            category: "Görünüm",
            icon: "🧘",
            shortcut: "Ctrl+Alt+Z",
            action: toggleZenMode,
        },
        {
            id: "split-view",
            title: "Bölünmüş Görünüm",
            description: "İki dosyayı yan yana aç",
            category: "Görünüm",
            icon: "📊",
            shortcut: "Ctrl+\\",
            action: () => {
                if (editor.selectedFile && editor.fileContent)
                    ui.openSplitView(editor.selectedFile, editor.fileContent);
                else notify("warning", "Uyarı", "Önce bir dosya açın!");
            },
        },
        {
            id: "advanced-search",
            title: "Gelişmiş Arama",
            description: "Regex ve filtrelerle arama",
            category: "Arama",
            icon: "🔍",
            shortcut: "Ctrl+Shift+H",
            action: () => ui.setShowAdvancedSearch(true),
        },
        {
            id: "git-panel",
            title: "Git Panel",
            description: "Git status ve commit araçları",
            category: "Git",
            icon: "📊",
            shortcut: "Ctrl+Shift+G",
            action: () => ui.setShowGitPanel(true),
        },
        {
            id: "settings",
            title: "Ayarlar",
            description: "Uygulama ayarları",
            category: "Ayarlar",
            icon: "⚙️",
            shortcut: "Ctrl+,",
            action: () => ui.setShowSettingsPanel(true),
        },
        {
            id: "customize-layout",
            title: "Düzeni Özelleştir",
            description: "Arayüz düzenini özelleştir",
            category: "Görünüm",
            icon: "🎨",
            shortcut: "Ctrl+Shift+K",
            action: () => ui.setShowCustomizeLayout(true),
        },
        {
            id: "developer-tools",
            title: "Developer Tools",
            description: "JSON formatter, Base64, Color picker, Regex tester",
            category: "Araçlar",
            icon: "🔧",
            shortcut: "Ctrl+Shift+D",
            action: () => ui.setShowDeveloperTools(true),
        },
        {
            id: "code-snippets",
            title: "Code Snippets & Templates",
            description: "Kod parçacıkları ve proje şablonları",
            category: "Araçlar",
            icon: "📝",
            shortcut: "Ctrl+Shift+S",
            action: () => ui.setShowCodeSnippets(true),
        },
        {
            id: "advanced-theming",
            title: "Advanced Theming",
            description: "Gelişmiş tema editörü ve özelleştirme",
            category: "Görünüm",
            icon: "🎨",
            shortcut: "Ctrl+Shift+T",
            action: () => ui.setShowAdvancedTheming(true),
        },
        {
            id: "remote-development",
            title: "Remote Development",
            description: "SSH, FTP, SFTP ve Docker bağlantıları",
            category: "Araçlar",
            icon: "🌐",
            shortcut: "Ctrl+Shift+R",
            action: () => ui.setShowRemoteDevelopment(true),
        },
        {
            id: "enhanced-ai",
            title: "Enhanced AI Tools",
            description: "Gelişmiş AI araçları: Code Review, Docs, Tests, Security",
            category: "AI",
            icon: "🤖",
            shortcut: "Ctrl+Shift+I",
            action: () => ui.setShowEnhancedAI(true),
        },
        {
            id: "code-review",
            title: "AI Code Review",
            description: "Otomatik kod inceleme ve kalite analizi",
            category: "AI",
            icon: "🔍",
            shortcut: "Ctrl+Shift+V",
            action: () => ui.setShowCodeReview(true),
        },
        {
            id: "generate-tests",
            title: "AI: Generate Tests",
            description: "Aktif dosya için otomatik unit testleri oluştur",
            category: "AI",
            icon: "🧪",
            shortcut: "Ctrl+Shift+U",
            action: async () => {
                if (!editor.selectedFile) {
                    notify("error", "Hata", "Önce bir dosya açmalısınız!");
                    return;
                }

                notify("info", "Test Oluşturuluyor", "AI kodunuzu analiz ediyor ve testleri yazıyor...");

                try {
                    const { testGenerationService } = await import("../../services/testGenerationService");
                    const framework = await testGenerationService.detectFramework(project.projectPath);
                    const testCode = await testGenerationService.generateTests({
                        filePath: editor.selectedFile,
                        sourceCode: editor.fileContent,
                        framework
                    });

                    const testPath = await testGenerationService.createTestFile(editor.selectedFile, testCode);
                    notify("success", "Test Tamamlandı", `${testPath} başarıyla oluşturuldu.`);

                    await project.loadOrIndexProject(project.projectPath);
                } catch (err: any) {
                    notify("error", "Test Hatası", err.message || "Test oluşturulamadı.");
                }
            },
        },
        /* !! FUTURE IMPACT ANALYZER KALDIRILDI (USER İSTEĞİ ÜZERİNE) !! */
        {
            id: "babel-engine",
            title: "🌍 Babel Engine (Evrensel Çevirmen)",
            description: "Dilden bağımsız, bozuk komutları tam fonksiyonel koda çevir.",
            category: "Futuristic",
            icon: "🗣️",
            shortcut: "Ctrl+Shift+F2",
            action: async () => {
                const intent = window.prompt("Babel Engine'a doğal dille veya kaba sözlerle ne istediğinizi yazın:");
                if (!intent) return;
                notify("info", "Babel Çevirisi", "Niyetiniz koda çevriliyor...");
                babelEngine.setEnabled(true);
                const code = await babelEngine.translateIntentToCode(intent, project.projectPath);
                if (code && editor.selectedFile) {
                    navigator.clipboard.writeText(code);
                    notify("success", "Koda Çevrildi!", "Babel Engine kodu oluşturdu ve Pano'ya kopyaladı.");
                }
            }
        },
        {
            id: "quantum-superposition",
            title: "🌀 Quantum Code Superposition (Süperpozisyon)",
            description: "Fonksiyonun aynı anda 3 paralel varyasyonunu(evren) oluştur",
            category: "Futuristic",
            icon: "⚛️",
            shortcut: "Ctrl+Shift+F3",
            action: async () => {
                const task = window.prompt("Hangi fonksiyonelin Quantum süperpozisyon varyasyonlarını istiyorsunuz?");
                if (!task) return;

                notify("info", "Quantum Ayrılma", "3 farklı varyasyon hesaplanıyor (Süperpozisyon)...");
                quantumCodeSuperposition.setEnabled(true);
                const variations = await quantumCodeSuperposition.enterSuperposition(task, editor.selectedFile || "", editor.fileContent || "");
                if (variations) {
                    notify("success", "Hazır", "Quantum varyasyonları konsola (ve panoya) yazıldı.");
                    console.log("⚛️ QUANTUM VARIATIONS:", variations);
                    navigator.clipboard.writeText(variations.join("\\n\\n"));
                }
            }
        },
        {
            id: "code-dna-splicing",
            title: "🧬 Code DNA Splicing (Gen Melezleme)",
            description: "Aktif dosyayı Gen Bankasma bağla ve melez özellik oluştur",
            category: "Futuristic",
            icon: "🧪",
            shortcut: "Ctrl+Shift+F4",
            action: async () => {
                const action = window.prompt("İşlem seçin: 1) Gen Kaydet  2) Melez Birleştirme (Splicing)");
                codeDnaSplicing.setEnabled(true);
                if (action === "1") {
                    const res = codeDnaSplicing.extractGene(editor.selectedFile || "", editor.fileContent || "", "Gen-" + Date.now());
                    notify("success", "Gen Bankası", res);
                } else if (action === "2") {
                    const intent = window.prompt("Genleri birleştirerek ne yapmak istiyorsun?");
                    if (intent) {
                        notify("info", "Splicing", "Genler birleştiriliyor...");
                        const code = await codeDnaSplicing.spliceProjectGenes(intent);
                        if (code) {
                            navigator.clipboard.writeText(code);
                            notify("success", "Melezleme Tamam", "Oluşturulan karma kod panoya kopyalandı.");
                        }
                    }
                }
            }
        },
        {
            id: "legacy-whisperer",
            title: "🏛️ Legacy Whisperer (Eski Kod Arkeoloğu)",
            description: "20-30 yıllık COBOL, Fortran, Delphi kodu analiz edip modern mimariye (TS/Rust vs) dönüştür",
            category: "Futuristic",
            icon: "📜",
            shortcut: "Ctrl+Shift+F5",
            action: async () => {
                if (!editor.selectedFile) return notify("warning", "Uyarı", "Eski kod olan bir dosyayı açık tutun.");
                legacyWhisperer.setEnabled(true);
                notify("info", "Kod Arkeolojisi Başladı", "Eski kodun niyeti ve yazar mektubu çözülüyor...");
                const report = await legacyWhisperer.decryptLegacyCode(editor.fileContent || "");
                if (report) {
                    console.log("LEGACY REPORT:", report);
                    notify("success", "Arkeoloji Tamam!", `Dil: ${report.originalLanguage}, Dönem: ${report.estimatedEra}`);
                    // Orijinal yazar mektubunu ekranda göstermek idealdir ama prompt ya da pano üzerinden verebiliriz.
                    const msg = `📜 Eski Geliştiriciden Mektup:\n\n${report.authorsLetter}\n\n[Modern Dönüşüm panoya eklendi]`;
                    notify("info", "Yazar Mektubu", msg.substring(0, 100) + "...");
                    navigator.clipboard.writeText(report.modernConversionCode);
                } else {
                    notify("error", "Hata", "Eski kod okunamadı.");
                }
            }
        },
        {
            id: "legacy-whisperer-simulate",
            title: "⏳ Legacy Whisperer (Dönem Simülasyonu)",
            description: "Şu anki kod parçasını ('90s', '80s' gibi) eski bir dönemin RAM/CPU kısıtlamalarında simüle et",
            category: "Futuristic",
            icon: "🕰️",
            shortcut: "Ctrl+Shift+F7",
            action: async () => {
                const era = window.prompt("Hangi dönemi/yılı simüle edelim? (Örn: '1998 Pentium', '64MB RAM Late 90s')");
                if (!era || !editor.fileContent) return;

                notify("info", "Zaman Makinesi Devrede", `${era} şartları simüle ediliyor...`);
                legacyWhisperer.setEnabled(true);
                const simulation = await legacyWhisperer.simulateEraEnvironment(editor.fileContent, era);
                if (simulation) {
                    notify("warning", "Simülasyon Çıktısı 💾", simulation);
                }
            }
        },
        {
            id: "synesthetic-code-view",
            title: "🌈 Synesthetic Code View (Ortak Duyu Kod Görünümü)",
            description: "Kodu görsel ve dokunsal(titreşim) sezgilere çevirip semantik akışı hissettirir",
            category: "Futuristic",
            icon: "🖐️",
            shortcut: "Ctrl+Shift+F6",
            action: async () => {
                if (!editor.selectedFile) return notify("warning", "Uyarı", "Dosya açık değil.");
                synestheticCodeView.setEnabled(true);
                notify("info", "Hissiyat Analizi", "Kodun duyu profili çıkarılıyor...");
                const result = await synestheticCodeView.analyzeVibes(editor.fileContent || "");
                if (result && result.lineRanges.length > 0) {
                    notify("success", "Duyu Eşleştirildi", `${result.lineRanges.length} farklı kod akımı algılandı.`);
                    console.log("Synesthetic Vibe Map:", result.lineRanges);
                    // Deneme amaçlı ilk bloğun titreşimini çalıştır:
                    synestheticCodeView.playHapticForType(result.lineRanges[0].type);
                }
            }
        },
        {
            id: "polyglot-engine",
            title: "🌍 Polyglot Engine (Çoklu Dil Çevirici)",
            description: "Projeyi/mimariyi tek tuşla başka dile (Node -> Rust, Go) çevir",
            category: "Futuristic",
            icon: "🔤",
            shortcut: "Ctrl+Shift+F8",
            action: async () => {
                const targetLang = window.prompt("Hangi dile çevirmek istiyorsunuz? (Örn: Rust, Go)");
                if (!targetLang) return;
                notify("info", "Polyglot Aktif", "Proje " + targetLang + " mimarisine dönüştürülüyor...");
                const result = await polyglotEngine.translateArchitecture(editor.fileContent || "", "Mevcut", targetLang);
                if (result) {
                    navigator.clipboard.writeText(result);
                    notify("success", "Dönüşüm Tamam", "Sonuç panoya kopyalandı.");
                }
            }
        },
        {
            id: "fresh-eyes-mode",
            title: "🕶️ Fresh Eyes Mode (Göz Tazeleyici)",
            description: "Geliştirici körlüğünü kırmak için kodu şaşırtıcı formata/diyagrama çevirir",
            category: "Futuristic",
            icon: "👁️",
            shortcut: "Ctrl+Shift+F9",
            action: async () => {
                if (!editor.selectedFile) return notify("warning", "Uyarı", "Dosya açın.");
                notify("info", "Fresh Eyes", "Körlüğünüzü kırmak için kod yabancılaştırılıyor...");
                const result = await freshEyesMode.alienateCode(editor.fileContent || "");
                if (result) {
                    navigator.clipboard.writeText(result);
                    notify("success", "Şok Etkisi Yaratıldı", "Sonuç panoya alındı, şuna bir bakın.");
                }
            }
        },
        {
            id: "blackhole-gc",
            title: "🧲 Blackhole GC (Manuel Tarama)",
            description: "Kullanılmayan değişken/fonksiyon/importları göster (Otomasyon dışı manuel)",
            category: "Futuristic",
            icon: "🕳️",
            shortcut: "Ctrl+Shift+F10",
            action: async () => {
                if (!editor.selectedFile) return notify("warning", "Uyarı", "Dosya seçin.");
                notify("info", "Tarama", "Ölü kod tespiti yapılıyor...");
                const result = await blackholeGarbageCollector.scanForDeadCode(editor.fileContent || "");
                if (result) {
                    navigator.clipboard.writeText(result);
                    notify("success", "Çıktı Panoda", "Silinebilir ölü bloklar tespit edildi.");
                }
            }
        },
        {
            id: "code-ethics-check",
            title: "🛑 Code Ethics Enforcer",
            description: "Koda dark pattern veya zararlı eklentiler yazılmasını kontrol eder",
            category: "Futuristic",
            icon: "⚖️",
            shortcut: "Ctrl+Shift+F11",
            action: async () => {
                const intent = window.prompt("Uygulamakta endişe ettiğiniz kodu yazın: (örn: iptal butonunu gri ve tıklanamaz yap)");
                if (!intent) return;
                const violation = await codeEthicsEnforcer.checkIntent(intent);
                if (violation) {
                    const accept = window.confirm(`🛑 Etik İhlal Tespit:\n${violation}\n\nBu Local bir ortam olduğundan sorumluluk bildirimi: Kabul ederseniz engel kalkar.`);
                    if (accept) {
                        codeEthicsEnforcer.acceptDisclaimer();
                        notify("warning", "İhlal İzni Verildi", "Sorumluluk kullanıcıda.");
                    } else {
                        notify("error", "İptal", "Etik kurallar devrede kaldı.");
                    }
                } else {
                    notify("success", "Güvenli (SAFE)", "Bu istek kullanıcı dostudur.");
                }
            }
        }
    ];
}
