/**
 * Chat Confirmation Part
 * Kullanıcıdan onay isteyen UI parçası (Örn: Dosya silinsin mi?)
 */


export interface ConfirmationPartData {
    title: string;
    message: string;
}

export function ChatConfirmationPart({ data, onConfirm, onCancel }: { data: ConfirmationPartData, onConfirm?: () => void, onCancel?: () => void }) {
    return (
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 my-2 text-xs">
            <div className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">⚠️</span>
                <div className="flex-1">
                    <div className="font-semibold text-yellow-400 mb-1">{data.title}</div>
                    <div className="text-yellow-200/80 mb-3 leading-relaxed">{data.message}</div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onConfirm}
                            className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded font-medium transition-colors"
                        >
                            Onayla
                        </button>
                        <button
                            onClick={onCancel}
                            className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
                        >
                            İptal
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
