import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { space, radius } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

type Block = { kind: 'p'; text: string } | { kind: 'list'; items: string[] };

/**
 * Shows an AI answer as short paragraphs, the first one in bold, and turns
 * "- " lists into clean rows. A line like "Black Pepper (70 pcs, Beyto Whole
 * Sale): order today" becomes the product name, its details underneath and a
 * tag on the right. Same look as the website.
 */
export function AiAnswer({ text }: { text: string }) {
  const blocks: Block[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'list') last.items.push(bullet[1]);
      else blocks.push({ kind: 'list', items: [bullet[1]] });
    } else {
      blocks.push({ kind: 'p', text: line });
    }
  }

  return (
    <View style={{ gap: space.md, alignSelf: 'stretch' }}>
      {blocks.map((b, i) =>
        b.kind === 'p' ? (
          <Text key={i} weight={i === 0 ? '700' : undefined} tone={i === 0 ? 'ink' : 'slate'} style={{ lineHeight: 22 }}>
            {b.text}
          </Text>
        ) : (
          <List key={i} items={b.items} />
        )
      )}
    </View>
  );
}

function List({ items }: { items: string[] }) {
  const { c } = useApp();
  return (
    <View style={[styles.list, { borderColor: c.hairline, backgroundColor: c.card }]}>
      {items.map((item, j) => (
        <Row key={j} text={item} last={j === items.length - 1} />
      ))}
    </View>
  );
}

function Row({ text, last }: { text: string; last: boolean }) {
  const { c } = useApp();
  const border = last ? undefined : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.hairline };
  const m = text.match(/^(.+?)\s*\(([^)]*)\)\s*:\s*(.+)$/) ?? text.match(/^(.+?)()\s*:\s*(.+)$/);
  if (!m) {
    return (
      <View style={[styles.row, border]}>
        <Text size={14}>{text}</Text>
      </View>
    );
  }
  const [, title, detail, status] = m;
  const urgent = /today|now|out of stock|اليوم|الآن|نفد/i.test(status);
  return (
    <View style={[styles.row, border, { flexDirection: 'row', alignItems: 'center', gap: space.md }]}>
      <View style={{ flex: 1 }}>
        <Text size={14} weight="600">
          {title}
        </Text>
        {detail ? (
          <Text size={12} tone="slate">
            {detail}
          </Text>
        ) : null}
      </View>
      <View style={[styles.tag, { backgroundColor: urgent ? c.alertSoft : c.amberSoft }]}>
        <Text size={12} weight="600" style={{ color: urgent ? c.alert : c.amber }}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, overflow: 'hidden' },
  row: { paddingHorizontal: space.md, paddingVertical: 10 },
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, maxWidth: '45%' },
});
