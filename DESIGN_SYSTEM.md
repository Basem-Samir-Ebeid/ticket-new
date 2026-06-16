# نظام الديزاين الموحد

## نظرة عامة
تم تطوير نظام ديزاين موحد احترافي وحديث يتناسب مع جميع أنحاء التطبيق. يستخدم النظام أساليب تصميم عالمية حديثة مع دعم كامل للغة العربية.

## الألوان الأساسية

### اللون الأساسي (Primary)
- **أزرق**: `#2563eb` - يستخدم للأزرار الرئيسية والرابط والتفاعلات
- **Light**: `#dce5ff`
- **Dark**: `#1e40af`

### الألوان المحايدة (Neutrals)
- **White**: `#ffffff` - الخلفية الأساسية
- **Slate-50**: `#f8fafc` - خلفية ثانوية فاتحة
- **Slate-900**: `#0f172a` - نص أساسي

### الألوان الداعمة
- **Success/Emerald**: `#10b981` - العمليات الناجحة
- **Warning/Amber**: `#f59e0b` - التنبيهات والانتظار
- **Danger/Red**: `#ef4444` - الأخطاء والرفض
- **Info/Cyan**: `#06b6d4` - المعلومات
- **Violet**: `#a78bfa` - الأولويات العالية

## Typography (الخطوط)

### الخط الأساسي
**Geist** - خط متغير حديث وسلس يدعم العربية والإنجليزية بشكل متساوي

```css
font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### الخط الكودي
**Geist Mono** - لعرض الأكواد والبيانات

```css
font-family: 'Geist Mono', 'IBM Plex Mono', 'Fira Code', monospace;
```

## المكونات الموحدة

### Card Component
بطاقة أساسية تستخدم في عرض المحتوى

```jsx
<Card accent="blue" hoverable>
  <CardHeader>
    <CardTitle>العنوان</CardTitle>
    <CardDescription>الوصف</CardDescription>
  </CardHeader>
  <CardContent>
    {/* المحتوى */}
  </CardContent>
  <CardFooter>
    {/* التذييل */}
  </CardFooter>
</Card>
```

**الخيارات:**
- `variant`: `default` | `elevated` | `subtle`
- `accent`: `blue` | `emerald` | `amber` | `red` | `cyan` | `violet`
- `hoverable`: `true` | `false`

### Button Component
زر موحد مع عدة نمط

```jsx
<Button
  variant="primary"
  size="md"
  loading={false}
  fullWidth={false}
>
  نص الزر
</Button>
```

**المتغيرات:**
- `variant`: `primary` | `secondary` | `success` | `danger` | `warning` | `ghost`
- `size`: `sm` | `md` | `lg`

### StatusBadge Component
شارة حالة مع أيقونات

```jsx
<StatusBadge
  status="pending"
  label="قيد الانتظار"
  size="md"
  showIcon={true}
/>
```

**الحالات المدعومة:**
- `pending` - قيد الانتظار
- `approved` - موافق عليه
- `rejected` - مرفوض
- `present` - حاضر
- `absent` - غائب
- `in-progress` - قيد الإجراء
- `completed` - مكتمل

## Spacing و Layout

### نظام المسافات
```css
--radius-sm:  6px;   /* Small */
--radius-md:  8px;   /* Medium */
--radius-lg:  12px;  /* Large */
--radius-xl:  16px;  /* Extra Large */
```

### Bento Grid Layout
تخطيط شبكة ديناميكي يستجيب للشاشات

```jsx
<div className="grid-cols-bento">
  {/* المحتوى يتكيف تلقائياً */}
</div>
```

- **Mobile**: 1 عمود
- **Tablet**: 2 عمود
- **Desktop**: 3 أعمدة

## الظلال (Shadows)

```css
--shadow-xs:  0 1px 2px 0 rgba(15, 23, 42, 0.05);
--shadow-sm:  0 2px 4px 0 rgba(15, 23, 42, 0.08);
--shadow-md:  0 4px 6px -1px rgba(15, 23, 42, 0.1);
--shadow-lg:  0 10px 15px -3px rgba(15, 23, 42, 0.1);
--shadow-xl:  0 20px 25px -5px rgba(15, 23, 42, 0.1);
```

## أشرطة التمييز (Accent Bars)

```jsx
<Card accent="blue" />      // شريط أزرق
<Card accent="emerald" />   // شريط أخضر
<Card accent="amber" />     // شريط برتقالي
<Card accent="red" />       // شريط أحمر
<Card accent="cyan" />      // شريط سماوي
<Card accent="violet" />    // شريط بنفسجي
```

## المسافات والحشو

### Tailwind Utilities
استخدم فئات Tailwind الموحدة:

```jsx
// Padding
<div className="p-4">        {/* جميع الأطراف */}
<div className="px-4 py-2">  {/* الأفقي والعمودي */}

// Margin
<div className="m-4">
<div className="mb-4">       {/* الهامش السفلي */}

// Gap
<div className="flex gap-4"> {/* المسافة بين العناصر */}
```

## الحدود (Borders)

```css
--border-subtle: #e2e8f0;  /* الحدود الخفيفة */
--border-medium: #cbd5e1;  /* الحدود المتوسطة */
--border-strong: #94a3b8;  /* الحدود القوية */
```

## Responsive Design

### نقاط التوقف
```css
sm:  640px   /* الهواتف الصغيرة */
md:  768px   /* الأجهزة اللوحية */
lg:  1024px  /* سطح المكتب */
xl:  1280px  /* سطح المكتب الكبير */
2xl: 1536px  /* سطح مكتب فائق الحجم */
```

### أمثلة Responsive
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {/* يتكيف مع حجم الشاشة */}
</div>

<p className="text-base md:text-lg lg:text-xl">
  {/* حجم النص يتغير مع الشاشة */}
</p>
```

## التفاعلات والحالات

### Hover Effects
```css
.glass-card:hover {
  border-color: var(--border-medium);
  box-shadow: var(--shadow-md);
}

.btn-primary:hover {
  background: var(--color-primary-700);
  box-shadow: var(--shadow-md);
}
```

### Focus States
```css
input:focus {
  outline: none;
  border-color: var(--color-primary-600);
  box-shadow: 0 0 0 3px var(--color-primary-50);
}
```

### Disabled States
```css
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

## الصيغة والرموز العربية

جميع المكونات تدعم RTL (Right-to-Left) وتتكيف تلقائياً مع النصوص العربية:

```jsx
// استخدم dir="rtl" في الـ HTML root
<html dir="rtl">
  {/* المحتوى يتكيف تلقائياً */}
</html>
```

## أمثلة الاستخدام

### Dashboard Grid
```jsx
<div className="grid-cols-bento">
  <Card accent="blue">
    <CardContent className="flex items-center justify-between">
      <div>
        <p className="text-slate-600 text-sm">العنوان</p>
        <p className="text-3xl font-bold">123</p>
      </div>
      <span className="text-3xl">📊</span>
    </CardContent>
  </Card>
</div>
```

### Table Layout
```jsx
<Card>
  <CardHeader>
    <CardTitle>البيانات</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="overflow-x-auto">
      <table className="w-full">
        {/* جدول محتوى */}
      </table>
    </div>
  </CardContent>
</Card>
```

### Form Layout
```jsx
<Card>
  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <input type="text" placeholder="الاسم" className="input" />
    <input type="email" placeholder="البريد" className="input" />
  </CardContent>
</Card>
```

## Best Practices

1. **استخدم الألوان الموحدة** - تجنب الألوان الإضافية
2. **اتبع نظام المسافات** - استخدم فئات Tailwind الموحدة
3. **تفاعل سلس** - أضف انتقالات وحركات
4. **إمكانية الوصول** - اتبع معايير WCAG
5. **دعم RTL** - اختبر مع اللغات العربية
6. **استجابة الأجهزة** - استخدم نقاط التوقف الموحدة
7. **التناسق** - استخدم نفس المكونات عبر التطبيق
