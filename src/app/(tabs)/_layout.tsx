import { NativeTabs } from 'expo-router/native-tabs';

import { useApp } from '@/providers/app-provider';

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
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="dashboard" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="products">
        <NativeTabs.Trigger.Label>{t.tabProducts}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'shippingbox', selected: 'shippingbox.fill' }} md="inventory_2" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="alerts">
        <NativeTabs.Trigger.Label>{t.tabAlerts}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bell', selected: 'bell.fill' }} md="notifications" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="orders">
        <NativeTabs.Trigger.Label>{t.tabOrders}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'truck.box', selected: 'truck.box.fill' }} md="local_shipping" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>{t.tabMore}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="ellipsis.circle" md="more_horiz" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
