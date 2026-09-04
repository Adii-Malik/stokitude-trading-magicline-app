import { useState, useEffect } from 'react';
import { Send } from 'lucide-react';
import toast from 'react-hot-toast';
import push from '../services/push';

/**
 * The push toggle.
 *
 * Kept apart from the rest of the preferences because it is the only setting
 * that belongs to *this device* rather than to the account. Everything else on
 * the page is edited into a blob and written on Save; turning push on has to
 * happen inside the click itself, because that is the only moment a browser
 * will show a permission prompt.
 */
export default function PushChannel({ icon }) {
    const [enabled, setEnabled] = useState(false);
    const [busy, setBusy] = useState(false);
    const [ready, setReady] = useState(false);
    // What the server can actually reach, which is a different question from
    // what this browser is holding, and the only one that decides whether an
    // alert arrives.
    const [devices, setDevices] = useState(null);

    const blocked = push.blockedReason();

    const refresh = () =>
        Promise.all([push.isEnabled(), push.sync()])
            .then(([on, seen]) => { setEnabled(on); setDevices(seen); })
            .catch(() => { })
            .finally(() => setReady(true));

    useEffect(() => { refresh(); }, []);

    /**
     * The toggle says the browser is subscribed; this says the server has the
     * subscription. They can disagree, and when they do every alert is written,
     * counted and delivered nowhere - which looks exactly like a quiet week.
     */
    const unreachable = enabled && devices && !devices.here;

    const toggle = async () => {
        setBusy(true);
        try {
            if (enabled) {
                await push.disable();
                setEnabled(false);
                setDevices(await push.sync());
                toast.success('Push turned off on this device');
            } else {
                await push.enable();
                setEnabled(true);
                setDevices(await push.sync());
                toast.success('Push enabled on this device');
            }
        } catch (error) {
            toast.error(error.message || 'Could not change push notifications');
        } finally {
            setBusy(false);
        }
    };

    const test = async () => {
        setBusy(true);
        try {
            const result = await push.sendTest();
            if (result.success) toast.success('Sent - it should appear in a moment');
            else toast.error('No device took it. Try turning push off and on again.');
        } catch {
            toast.error('Could not send the test');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {icon}
                    <div>
                        <label className="font-medium text-gray-900 dark:text-white">
                            Push Notifications
                        </label>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Alerts on this device, even when the app is closed
                        </p>
                    </div>
                </div>

                {blocked ? (
                    <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                        Unavailable
                    </div>
                ) : (
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={enabled}
                            disabled={busy || !ready}
                            onChange={toggle}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-cyan-600 peer-disabled:opacity-50"></div>
                    </label>
                )}
            </div>

            {/* The reason, not just the refusal - on iPhone it is something the
                user can actually fix in two taps. */}
            {blocked && (
                <p className="mt-2 ml-8 text-xs text-amber-600 dark:text-amber-400">{blocked}</p>
            )}

            {unreachable && (
                <p className="mt-2 ml-8 text-xs text-amber-600 dark:text-amber-400">
                    This device is switched on but the server has no record of it, so alerts
                    are not reaching you. Turn it off and on again to re-register.
                </p>
            )}

            {enabled && !blocked && (
                <button
                    type="button"
                    onClick={test}
                    disabled={busy}
                    className="mt-3 ml-8 inline-flex items-center gap-2 text-sm text-cyan-600 dark:text-cyan-400 hover:underline disabled:opacity-50"
                >
                    <Send className="w-4 h-4" />
                    Send a test notification
                </button>
            )}
        </div>
    );
}
