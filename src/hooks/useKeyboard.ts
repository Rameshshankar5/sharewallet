import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Whether the on-screen keyboard is currently up.
 *
 * Centred forms look best on an empty screen but break once the keyboard takes
 * half the display: the fields below the fold simply vanish. Screens use this
 * to top-align and drop decoration while typing.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // iOS reports will-show/hide early enough to animate with the keyboard;
    // Android only emits the did- events.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  return visible;
}
