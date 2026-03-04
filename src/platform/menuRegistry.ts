import { Command, commandRegistry } from './commandRegistry';
import { contextKeyService } from './contextKeyService';

/**
 * Desteklenen Menü Alanları
 */
export enum MenuId {
    CommandPalette = 'commandPalette',
    EditorContext = 'editor/context',
    EditorTitle = 'editor/title',
    ExplorerContext = 'explorer/context',
    StatusBar = 'statusBar',
}

export interface MenuItem {
    commandId: string;
    when?: string;     // görünüp görünmemesini kontrol eder ("isMac")
    group?: string;    // Sıralama ve gruplama için ("1_navigation", "2_editing")
    order?: number;    // Aynı grup içi sıralama
}

class MenuRegistry {
    private static instance: MenuRegistry;

    // Hangi menüde hangi komut öğeleri var?
    private menus = new Map<MenuId, MenuItem[]>();

    private constructor() { }

    public static getInstance(): MenuRegistry {
        if (!MenuRegistry.instance) {
            MenuRegistry.instance = new MenuRegistry();
        }
        return MenuRegistry.instance;
    }

    /**
     * Belirli bir menüye komut öğesi ekler
     */
    public appendMenuItem(menuId: MenuId, item: MenuItem) {
        let list = this.menus.get(menuId);
        if (!list) {
            list = [];
            this.menus.set(menuId, list);
        }
        list.push(item);

        // Kendi içinde sıralar: Group -> Order
        list.sort((a, b) => {
            const gA = a.group || '';
            const gB = b.group || '';
            if (gA !== gB) {
                return gA.localeCompare(gB);
            }
            return (a.order || 0) - (b.order || 0);
        });
    }

    /**
     * O Anki Context'e Göre Belirli Bir Menüdeki GÖRÜNÜR Komutları/Menü Öğelerini Alır
     */
    public getMenuItems(menuId: MenuId): Array<{ item: MenuItem; command: Command }> {
        const list = this.menus.get(menuId) || [];
        const visibleItems: Array<{ item: MenuItem; command: Command }> = [];

        for (const item of list) {
            const ctxPassed = contextKeyService.evaluate(item.when);
            if (!ctxPassed) continue;

            const command = commandRegistry.getCommands().find(c => c.id === item.commandId);
            if (command) {
                visibleItems.push({ item, command });
            }
        }

        return visibleItems;
    }
}

export const menuRegistry = MenuRegistry.getInstance();
