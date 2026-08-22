import { useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

/**
 * The chart, which for a price-action trade is the setup itself.
 *
 * Paste is the first-class way in: the screenshot is already on the clipboard
 * the moment you take it, and making someone save it to disk first is friction
 * on the field that carries the most of what a trade was about. Drop and click
 * work too, for a chart that was already a file.
 */
export function ChartUpload({ value, onChange }) {
    const [busy, setBusy] = useState(false);
    const [over, setOver] = useState(false);

    const send = async (file) => {
        if (!file) return;
        setBusy(true);
        try {
            const body = new FormData();
            body.append('chart', file);
            // The client defaults to JSON, which would send this without a
            // multipart boundary and the server would see no file at all.
            const res = await api.post('/journal/chart', body, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            onChange(res.data.data.chartUrl);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not store that image');
        } finally {
            setBusy(false);
        }
    };

    const fromClipboard = (e) => {
        const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
        if (!item) return;
        e.preventDefault();
        send(item.getAsFile());
    };

    if (value) {
        return (
            <div className="flex items-center gap-3 rounded-control ring-1 ring-hairline p-2">
                <img src={value} alt="Chart for this trade"
                    className="w-16 h-11 object-cover rounded-control ring-1 ring-hairline" />
                <a href={value} target="_blank" rel="noreferrer"
                    className="text-sm text-cyan-600 dark:text-cyan-400 font-medium hover:underline">
                    View full size
                </a>
                <button type="button" onClick={() => onChange('')} aria-label="Remove chart"
                    className="ml-auto p-1 rounded-control text-ink-faint hover:text-ink hover:bg-surface-muted">
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <label
            onPaste={fromClipboard}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files?.[0]); }}
            className={`flex flex-col items-center gap-1 rounded-control border border-dashed
                        px-4 py-5 text-center cursor-pointer bg-surface-muted
                        focus-within:ring-2 focus-within:ring-cyan-500
                        ${over ? 'border-cyan-500' : 'border-hairline'}`}
        >
            <ImagePlus className="w-5 h-5 text-ink-faint" />
            <span className="text-sm font-medium text-ink-muted">
                {busy ? 'Storing…' : 'Paste, drop, or choose a chart'}
            </span>
            <span className="text-xs text-ink-faint">PNG, JPEG or WebP, up to 6MB</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
                onChange={(e) => send(e.target.files?.[0])} />
        </label>
    );
}

export default ChartUpload;
