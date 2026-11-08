import { View } from 'react-native';

import { AskChat } from '@/components/ask-chat';
import { ScreenHeader } from '@/components/screen-header';
import { useApp } from '@/providers/app-provider';

/** The Ask AI tab: the Naqisni AI assistant, in the middle of the tab bar. */
export default function AssistantTab() {
  const { c, t } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title={t.askAssistant} />
      <AskChat embedded />
    </View>
  );
}
