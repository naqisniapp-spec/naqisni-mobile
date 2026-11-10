import { View } from 'react-native';

import { AskChat } from '@/components/ask-chat';
import { ScreenHeader } from '@/components/screen-header';
import { useApp } from '@/providers/app-provider';
import { gated } from '@/components/app-gate';

/** The Ask AI tab: the Naqisni AI assistant, in the middle of the tab bar. */
function AssistantTab() {
  const { c, t } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title={t.askAssistant} />
      <AskChat embedded />
    </View>
  );
}

export default gated('ask_ai', AssistantTab);
