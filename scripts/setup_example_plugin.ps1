# setup_example_plugin.ps1
$appData = [System.Environment]::GetFolderPath('ApplicationData')
$pluginDir = Join-Path $appData "corex\plugins\cyber-neon"

if (!(Test-Path $pluginDir)) {
    New-Item -ItemType Directory -Force -Path $pluginDir
}

$manifest = @{
    id = "cyber-neon"
    name = "Cyber Neon Theme"
    version = "1.0.0"
    description = "A futuristic neon theme for CorexAI"
    author = "Corex Team"
    entry = "index.js"
    permissions = @("ui", "theme")
} | ConvertTo-Json

$script = @"
// Cyber Neon Plugin Entry
console.log('🚀 Cyber Neon Plugin Loading...');

corex.registerTheme({
    id: 'cyber-neon',
    name: 'Cyber Neon',
    colors: {
        '--color-background': '#0d0221',
        '--color-sidebar': '#0f082d',
        '--color-border': '#2de2e6',
        '--color-text': '#ffffff',
        '--color-accent': '#f6019d'
    }
});

corex.showToast('Cyber Neon Theme Loaded!', 'success');
"@

Set-Content -Path (Join-Path $pluginDir "plugin.json") -Value $manifest
Set-Content -Path (Join-Path $pluginDir "index.js") -Value $script

Write-Host "✅ Example plugin 'Cyber Neon' has been setup at: $pluginDir"
Write-Host "Please restart CorexAI to see the plugin in action."
