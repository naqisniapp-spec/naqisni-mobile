import { Stack } from 'expo-router';

import { AskChat } from '@/components/ask-chat';
import { useApp } from '@/providers/app-provider';

/** Ask Naqisni as a full screen (opened from links). The Ask AI tab shows the same chat. */
export default function AskScreen() {
  const { t } = useApp();
  return (
    <>
      <Stack.Screen options={{ title: t.askAssistant }} />
      <AskChat />
    </>
  );
}
