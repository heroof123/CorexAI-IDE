const fs = require('fs');
let content = fs.readFileSync('src/components/GGUFModelBrowser.tsx', 'utf8');

const importReplacement = `import DownloadManager from './GGUFModelBrowser/DownloadManager';
import ModelSettingsPanel from './GGUFModelBrowser/ModelSettingsPanel';
import AdvancedFilterModal from './GGUFModelBrowser/AdvancedFilterModal';
import CleanupModal from './GGUFModelBrowser/CleanupModal';`;

content = content.replace("import DownloadManager from './GGUFModelBrowser/DownloadManager';", importReplacement);

const startStr = '{/* Sağ Panel - Model Ayarları */}';
const startIndex = content.indexOf(startStr);
if (startIndex !== -1) {
    const selectedStart = content.indexOf('{selectedModelForConfig && (', startIndex);
    let openBraces = 0;
    let endIndex = -1;
    let inString = false;
    let stringChar = '';

    for (let i = selectedStart; i < content.length; i++) {
        const char = content[i];
        if (!inString) {
            if (char === '{' || char === '(') openBraces++;
            else if (char === '}' || char === ')') {
                openBraces--;
                if (openBraces === 0) {
                    endIndex = i;
                    break;
                }
            } else if (char === "'" || char === '"' || char === '`') {
                inString = true;
                stringChar = char;
            }
        } else {
            if (char === stringChar && content[i - 1] !== '\\') {
                inString = false;
            }
        }
    }

    if (endIndex !== -1) {
        const extractedBlock = content.substring(startIndex, endIndex + 1);
        fs.writeFileSync('tmp_extracted_block.txt', extractedBlock);

        const panelProps = `        <ModelSettingsPanel
          selectedModelForConfig={selectedModelForConfig}
          setSelectedModelForConfig={setSelectedModelForConfig}
          modelMetadata={modelMetadata}
          setModelMetadata={setModelMetadata}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          gpuMemory={gpuMemory}
          contextLength={contextLength}
          setContextLength={setContextLength}
          outputMode={outputMode as any}
          setOutputMode={setOutputMode as any}
          gpuLayers={gpuLayers}
          setGpuLayers={setGpuLayers}
          maxGpuLayers={maxGpuLayers}
          temperature={temperature}
          setTemperature={setTemperature}
          topP={topP}
          setTopP={setTopP}
          topK={topK}
          setTopK={setTopK}
          repeatPenalty={repeatPenalty}
          setRepeatPenalty={setRepeatPenalty}
          minP={minP}
          setMinP={setMinP}
          applyModelConfig={applyModelConfig}
          isLoadingToGPU={isLoadingToGPU}
          activeGpuModel={activeGpuModel}
          unloadFromGPU={unloadFromGPU}
          performanceLogs={performanceLogs}
          setPerformanceLogs={setPerformanceLogs}
          conversationHistory={conversationHistory}
          setConversationHistory={setConversationHistory}
          gpuBackendInfo={gpuBackendInfo}
          gpuInfo={gpuInfo}
          backendRecommendation={backendRecommendation}
          calculateRequirements={calculateRequirements}
          loadingProgress={loadingProgress}
          openUrl={openUrl}
        />`;

        const newBlock = startStr + '\n      {selectedModelForConfig && (\n' + panelProps + '\n      )}';
        content = content.substring(0, startIndex) + newBlock + content.substring(endIndex + 1);
        console.log('Successfully replaced ModelSettingsPanel in GGUFModelBrowser.tsx');
    } else {
        console.error('ModelSettingsPanel end not found');
    }
} else {
    console.error('ModelSettingsPanel start not found');
}

// 2. Extracted Filter Modal
const filterStartStr = '{/* 🆕 Gelişmiş Filtre Modal */}';
const filterStartIndex = content.indexOf(filterStartStr);
if (filterStartIndex !== -1) {
    const filterSelectedStart = content.indexOf('{showFilterModal && (', filterStartIndex);
    let openBraces = 0;
    let endIndex = -1;
    let inString = false;
    let stringChar = '';

    for (let i = filterSelectedStart; i < content.length; i++) {
        const char = content[i];
        if (!inString) {
            if (char === '{' || char === '(') openBraces++;
            else if (char === '}' || char === ')') {
                openBraces--;
                if (openBraces === 0) {
                    endIndex = i;
                    break;
                }
            } else if (char === "'" || char === '"' || char === '`') {
                inString = true;
                stringChar = char;
            }
        } else {
            if (char === stringChar && content[i - 1] !== '\\') {
                inString = false;
            }
        }
    }

    if (endIndex !== -1) {
        const newBlock = `{/* 🆕 Gelişmiş Filtre Modal */}
      <AdvancedFilterModal 
        showFilterModal={showFilterModal}
        setShowFilterModal={setShowFilterModal}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />`;
        content = content.substring(0, filterStartIndex) + newBlock + content.substring(endIndex + 1);
        console.log('Successfully replaced AdvancedFilterModal in GGUFModelBrowser.tsx');
    } else {
        console.error('AdvancedFilterModal end not found');
    }
} else {
    console.error('AdvancedFilterModal start not found');
}


// 3. Extracted Cleanup Modal
const cleanupStartStr = '{/* 🧹 Temizlik Modal */}';
const cleanupStartIndex = content.indexOf(cleanupStartStr);
if (cleanupStartIndex !== -1) {
    const cleanupSelectedStart = content.indexOf('{showCleanupModal && (', cleanupStartIndex);
    let openBraces = 0;
    let endIndex = -1;
    let inString = false;
    let stringChar = '';

    for (let i = cleanupSelectedStart; i < content.length; i++) {
        const char = content[i];
        if (!inString) {
            if (char === '{' || char === '(') openBraces++;
            else if (char === '}' || char === ')') {
                openBraces--;
                if (openBraces === 0) {
                    endIndex = i;
                    break;
                }
            } else if (char === "'" || char === '"' || char === '`') {
                inString = true;
                stringChar = char;
            }
        } else {
            if (char === stringChar && content[i - 1] !== '\\') {
                inString = false;
            }
        }
    }

    if (endIndex !== -1) {
        const newBlock = `{/* 🧹 Temizlik Modal */}
      <CleanupModal 
        showCleanupModal={showCleanupModal}
        setShowCleanupModal={setShowCleanupModal}
        models={models}
        getTotalDiskUsage={getTotalDiskUsage}
        getCleanupSuggestions={getCleanupSuggestions}
        selectedForCleanup={selectedForCleanup}
        setSelectedForCleanup={setSelectedForCleanup}
        cleanupSelectedModels={cleanupSelectedModels}
      />`;
        content = content.substring(0, cleanupStartIndex) + newBlock + content.substring(endIndex + 1);
        console.log('Successfully replaced CleanupModal in GGUFModelBrowser.tsx');
    } else {
        console.error('CleanupModal end not found');
    }
} else {
    console.error('CleanupModal start not found');
}

fs.writeFileSync('src/components/GGUFModelBrowser.tsx', content);
