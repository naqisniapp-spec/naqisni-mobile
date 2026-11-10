import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { BusinessGate } from '@/components/business-gate';
import { Barcode, Camera, Trash } from '@/components/icons';
import { Button, Card, ErrorState, Loading, panel, Row, Text } from '@/components/ui';
import type { Business, Product } from '@/lib/data';
import { waitFor } from '@/lib/picker';
import {
  CURRENCIES,
  emptyProduct,
  isSynced,
  loadProductForEdit,
  ownsLeadTime,
  ownsReorderPoint,
  ProductError,
  productToValues,
  saveProduct,
  sourceName,
  type ProductValues,
} from '@/lib/products';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

/** Add a product (no id) or edit one (id) — the same fields and rules as naqisni.com. */
export default function ProductFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <BusinessGate>{(b) => (id ? <EditProduct business={b} id={id} /> : <ProductForm business={b} />)}</BusinessGate>;
}

function EditProduct({ business, id }: { business: Business; id: string }) {
  const { t } = useApp();
  const { data, error, loading, refresh } = useLoad(() => loadProductForEdit(business.id, id), `edit:${id}`);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? t.noProducts} onRetry={refresh} />;
  return <ProductForm business={business} product={data} />;
}

function ProductForm({ business, product }: { business: Business; product?: Product }) {
  const { c, t, session, allStores, stores } = useApp();
  const [values, setValues] = useState<ProductValues>(product ? productToValues(product) : emptyProduct);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const source = product?.source ?? 'manual';
  const synced = isSynced(source);
  const system = sourceName(source);
  const lockReorder = synced && ownsReorderPoint(source);
  const lockLead = synced && ownsLeadTime(source);
  const fromSystem = t.fromSystem(system);
  const mainCurrency = business.currency ?? 'USD';
  const currency = values.currency || mainCurrency;
  const photo = photoUri ?? (values.image_url || null);
  const mainStore = stores.find((s) => s.isDefault)?.name;

  function set<K extends keyof ProductValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function scanBarcode() {
    waitFor('barcode', (code) => set('barcode', code));
    router.push({ pathname: '/scan', params: { pick: '1' } });
  }

  function takePhoto() {
    waitFor('photo', (uri) => setPhotoUri(uri));
    router.push('/photo');
  }

  function removePhoto() {
    setPhotoUri(null);
    set('image_url', '');
  }

  function message(e: unknown): string {
    if (e instanceof ProductError) {
      switch (e.code) {
        case 'name':
          return t.needName;
        case 'sku':
          return t.needSku;
        case 'unit':
          return t.needUnit;
        case 'stock':
          return t.needStock;
        case 'number':
          return t.needNumber(e.detail ?? '');
        case 'leadTime':
          return t.needLeadTime;
        case 'barcodeTaken': {
          const [code, name] = (e.detail ?? '|').split('|');
          return t.barcodeTaken(code, name);
        }
        case 'photoSize':
        case 'photoType':
          return t.photoTooBig;
      }
    }
    return e instanceof Error ? e.message : t.error;
  }

  async function save() {
    if (!session) return;
    setError(null);
    setSaving(true);
    try {
      const id = await saveProduct({
        businessId: business.id,
        userId: session.user.id,
        mainCurrency,
        values,
        photoUri,
        labels: { reorderPoint: t.reorderPoint, costPrice: t.costPrice(currency), sellPrice: t.sellPrice(currency) },
        existing: product
          ? { productId: product.product_id, source: product.source, groupId: product.group_id, stock: Number(product.current_stock ?? 0) }
          : undefined,
      });
      if (product) router.back();
      else router.replace({ pathname: '/product/[id]', params: { id } });
    } catch (e) {
      setError(message(e));
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: product ? t.editProduct : t.addProduct }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={[panel(c), { gap: space.lg, marginBottom: space.xxl * 2 }]} keyboardShouldPersistTaps="handled">
          {/* Photo */}
          <Row style={{ gap: space.lg }}>
            <Pressable
              onPress={takePhoto}
              accessibilityRole="button"
              accessibilityLabel={photo ? t.changePhoto : t.addPhoto}
              style={[styles.photo, { backgroundColor: c.card, borderColor: c.hairline }, !photo && { borderStyle: 'dashed' }]}>
              {photo ? <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Camera size={30} color={c.slate} />}
            </Pressable>
            <View style={{ flex: 1, gap: space.sm }}>
              <Button title={photo ? t.changePhoto : t.addPhoto} variant="secondary" onPress={takePhoto} />
              {photo ? (
                <Pressable onPress={removePhoto} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
                  <Trash size={16} color={c.alert} />
                  <Text tone="alert" size={14} weight="600">
                    {t.removePhoto}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Row>

          <Section title={t.basics}>
            <Field label={t.productName}>
              <Input value={values.name} onChangeText={(v) => set('name', v)} placeholder={t.productNameExample} autoFocus={!product} />
            </Field>
            <Field label={t.brand}>
              <Input value={values.brand} onChangeText={(v) => set('brand', v)} />
            </Field>
            <Field label={t.category} hint={synced ? t.categoryFromSystem(system) : undefined}>
              <Input value={values.category} onChangeText={(v) => set('category', v)} placeholder={t.categoryExample} />
            </Field>
            <Field label="SKU" hint={synced ? fromSystem : undefined}>
              <Input value={values.sku} onChangeText={(v) => set('sku', v)} placeholder="RICE-5KG" autoCapitalize="characters" editable={!synced} />
            </Field>
            <Field label={t.barcode}>
              <Row style={{ gap: space.sm }}>
                <Input style={{ flex: 1 }} value={values.barcode} onChangeText={(v) => set('barcode', v)} keyboardType="number-pad" />
                <Pressable
                  onPress={scanBarcode}
                  accessibilityRole="button"
                  accessibilityLabel={t.scan}
                  style={({ pressed }) => [styles.scanBtn, { backgroundColor: c.ink, opacity: pressed ? 0.8 : 1 }]}>
                  <Barcode size={20} color={c.brand} weight="bold" />
                  <Text size={14} weight="600" style={{ color: c.card }}>
                    {t.scan}
                  </Text>
                </Pressable>
              </Row>
            </Field>
            <Field label={t.description}>
              <Input value={values.description} onChangeText={(v) => set('description', v)} multiline style={{ minHeight: 84, paddingTop: 14 }} />
            </Field>
          </Section>

          <Section title={t.stockAndPrice}>
            <Field label={t.unit} hint={t.unitHint}>
              <Input value={values.unit} onChangeText={(v) => set('unit', v)} placeholder={t.unitExample} autoCapitalize="none" />
            </Field>
            <Field
              label={t.currentStock}
              hint={synced ? fromSystem : !product && allStores && mainStore ? t.stockGoesTo(mainStore) : undefined}>
              <Input value={values.current_stock} onChangeText={(v) => set('current_stock', v)} keyboardType="decimal-pad" editable={!synced} placeholder="0" />
            </Field>
            <Field
              label={t.reorderPoint}
              hint={lockReorder ? t.reorderFromMaximo : synced ? t.reorderFromSystem(system) : t.reorderHint}>
              <Input value={values.reorder_point} onChangeText={(v) => set('reorder_point', v)} keyboardType="decimal-pad" editable={!lockReorder} />
            </Field>
            <Field label={t.location} hint={source === 'maximo' ? t.locationFromMaximo : t.locationHint}>
              <Input value={values.location} onChangeText={(v) => set('location', v)} />
            </Field>
            <Field label={t.priceCurrency} hint={t.priceCurrencyHint(mainCurrency)}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                {[mainCurrency, ...CURRENCIES.filter((x) => x !== mainCurrency)].map((code) => {
                  const on = code === currency;
                  return (
                    <Pressable
                      key={code}
                      onPress={() => set('currency', code === mainCurrency ? '' : code)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[styles.pill, { backgroundColor: on ? c.ink : c.card, borderColor: on ? c.ink : c.hairline }]}>
                      <Text size={13} weight="600" style={{ color: on ? c.card : c.ink }}>
                        {code}
                        {code === mainCurrency ? ` · ${t.main}` : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Field>
            <Row style={{ gap: space.md, alignItems: 'flex-start' }}>
              <Field label={t.costPrice(currency)} style={{ flex: 1 }}>
                <Input value={values.cost_price} onChangeText={(v) => set('cost_price', v)} keyboardType="decimal-pad" />
              </Field>
              <Field label={t.sellPrice(currency)} style={{ flex: 1 }}>
                <Input value={values.sell_price} onChangeText={(v) => set('sell_price', v)} keyboardType="decimal-pad" />
              </Field>
            </Row>
          </Section>

          <Section title={t.supplier} description={t.supplierHint}>
            <Field label={t.supplierName}>
              <Input value={values.supplier_name} onChangeText={(v) => set('supplier_name', v)} />
            </Field>
            <Field label={t.supplierPhone}>
              <Input value={values.supplier_phone} onChangeText={(v) => set('supplier_phone', v)} keyboardType="phone-pad" placeholder="+971 50 123 4567" />
            </Field>
            <Field label={t.deliveryDays} hint={lockLead ? t.leadFromMaximo : source === 'odoo' ? t.leadFromOdoo : t.leadHint}>
              <Input value={values.lead_time_days} onChangeText={(v) => set('lead_time_days', v)} keyboardType="number-pad" placeholder="7" editable={!lockLead} />
            </Field>
          </Section>

          {error ? (
            <View style={[styles.error, { backgroundColor: c.alertSoft }]} accessibilityRole="alert">
              <Text tone="alert">{error}</Text>
            </View>
          ) : null}

          <Button title={saving ? t.saving : product ? t.saveChanges : t.addProduct} onPress={save} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ gap: 2 }}>
        <Text size={17} weight="700">
          {title}
        </Text>
        {description ? (
          <Text tone="slate" size={13}>
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </Card>
  );
}

function Field({ label, hint, children, style }: { label: string; hint?: string; children: ReactNode; style?: object }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text tone="slate" size={13} weight="600">
        {label}
      </Text>
      {children}
      {hint ? (
        <Text tone="slate" size={12}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function Input({ style, editable = true, ...rest }: TextInputProps) {
  const { c } = useApp();
  return (
    <TextInput
      {...rest}
      editable={editable}
      placeholderTextColor={c.slate}
      style={[
        styles.input,
        { backgroundColor: editable ? c.bg : c.hairline, borderColor: c.hairline, color: editable ? c.ink : c.slate },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  photo: { width: 96, height: 96, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16 },
  scanBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 48, borderRadius: radius.md },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  error: { padding: space.md, borderRadius: radius.md },
});
