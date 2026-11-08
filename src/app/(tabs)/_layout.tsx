import { NativeTabs } from 'expo-router/native-tabs';

import { useApp } from '@/providers/app-provider';

// Phosphor icons (the same family as naqisni.com), rendered to PNGs so the
// native tab bar can use them: outline when idle, filled when selected.
const TAB_ICONS = {
  overview: { default: require('@/assets/images/tabs/overview.png'), selected: require('@/assets/images/tabs/overview-active.png') },
  products: { default: require('@/assets/images/tabs/products.png'), selected: require('@/assets/images/tabs/products-active.png') },
  alerts: { default: require('@/assets/images/tabs/alerts.png'), selected: require('@/assets/images/tabs/alerts-active.png') },
  orders: { default: require('@/assets/images/tabs/orders.png'), selected: require('@/assets/images/tabs/orders-active.png') },
  more: { default: require('@/assets/images/tabs/more.png'), selected: require('@/assets/images/tabs/more-active.png') },
};

/** Native tab bar (UITabBar on iOS, Material bottom navigation on Android). */
export default function TabsLayout() {
  const { c, t } = useApp();
  return (
    <NativeTabs
      backgroundColor={c.card}
      indicatorColor={c.brandSoft}
      tintColor={c.brandDeep}
      labelStyle={{ selected: { color: c.ink } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t.tabOverview}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={TAB_ICONS.overview} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="products">
        <NativeTabs.Trigger.Label>{t.tabProducts}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={TAB_ICONS.products} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="alerts">
        <NativeTabs.Trigger.Label>{t.tabAlerts}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={TAB_ICONS.alerts} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="orders">
        <NativeTabs.Trigger.Label>{t.tabOrders}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={TAB_ICONS.orders} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>{t.tabMore}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={TAB_ICONS.more} renderingMode="template" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
