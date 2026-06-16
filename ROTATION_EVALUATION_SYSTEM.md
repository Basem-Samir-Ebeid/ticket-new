# نظام التناوب والتقييم المتقدم

## نظرة عامة

تم تطوير نظام متقدم لإدارة التناوب (Factory & Overtime) والتقييمات الشهرية للموظفين مع دعم كامل لـ:
- تسجيل الحضور/الغياب من قبل الموظف
- طلبات تبديل التناوب مع نظام الموافقة المتسلسل
- تقييمات شهرية احترافية
- تقارير تجميعية بإحصائيات

## الواجهات الخلفية (Backend APIs)

### 1. API الحضور والتناوب (`/api/rotation-attendance/`)

#### تسجيل الحضور
**POST** `/mark-present`
```json
{
  "scheduleId": "uuid",
  "module": "factory" | "overtime"
}
```

#### تسجيل الغياب من قبل الموظف
**POST** `/mark-absent`
```json
{
  "scheduleId": "uuid",
  "module": "factory" | "overtime",
  "reason": "string (optional)"
}
```

#### طلب تبديل التناوب
**POST** `/request-swap`
```json
{
  "module": "factory" | "overtime",
  "scheduleId": "uuid",
  "targetUserId": "uuid",
  "note": "string (optional)"
}
```

#### الموافقة على التبديل من قبل الموظف الآخر
**POST** `/approve-swap/:swapId`
```json
{
  "note": "string (optional)"
}
```

#### رفض التبديل من قبل الموظف الآخر
**POST** `/reject-swap/:swapId`
```json
{
  "reason": "string (optional)"
}
```

#### الموافقة على التبديل من قبل السوبر أدمن
**POST** `/approve-swap-admin/:swapId`

#### تسجيل الغياب من قبل الإدارة
**POST** `/mark-absent-admin/:scheduleId`
```json
{
  "module": "factory" | "overtime",
  "reason": "string (optional)"
}
```

#### الحصول على طلبات التبديل
**GET** `/swaps`

#### الحصول على سجلات الحضور
**GET** `/logs?module=factory&scheduleId=uuid`

### 2. API التقارير التقييمية (`/api/evaluation-reports/`)

#### الحصول على التقارير الشهرية
**GET** `/monthly-reports`

#### الحصول على تاريخ التقييمات للموظف
**GET** `/monthly-reports/:employeeId`

#### توليد التقرير الشهري
**POST** `/generate-monthly-report`
```json
{
  "month": 1-12,
  "year": 2024
}
```

#### إحصائيات الأقسام
**GET** `/department-stats?month=1&year=2024`

#### أفضل الأداء
**GET** `/top-performers?month=1&year=2024&limit=10`

## المكونات الأمامية (Frontend Components)

### 1. RotationAttendancePanel
مكون لإدارة حضور التناوب الفردي

```jsx
import RotationAttendancePanel from '@/components/RotationAttendancePanel'

<RotationAttendancePanel 
  module="factory"
  schedule={scheduleData}
  onStatusChange={handleRefresh}
  isAdmin={false}
  employees={employeesList}
/>
```

**Props:**
- `module`: "factory" | "overtime"
- `schedule`: بيانات الجدول الزمني
- `onStatusChange`: callback عند تغيير الحالة
- `isAdmin`: هل المستخدم إداري
- `employees`: قائمة الموظفين للتبديل

### 2. RotationSwapRequests
مكون لإدارة طلبات التبديل

```jsx
import RotationSwapRequests from '@/components/RotationSwapRequests'

<RotationSwapRequests module="factory" />
```

**Props:**
- `module`: "factory" | "overtime"

**الميزات:**
- عرض جميع طلبات التبديل
- الموافقة/الرفض من قبل الموظفين
- موافقة الإدارة
- تصفية حسب الحالة

### 3. EvaluationForm
فورم تقييم الموظف الشهري

```jsx
import EvaluationForm from '@/components/EvaluationForm'

<EvaluationForm 
  employeeId="uuid"
  onSuccess={handleSuccess}
/>
```

**Props:**
- `employeeId`: معرّف الموظف المراد تقييمه
- `onSuccess`: callback عند الحفظ بنجاح

**المعايير المتضمنة:**
- المهارات التقنية (1-5)
- التواصل (1-5)
- الانضباط (1-5)
- إكمال المهام (1-5)
- المبادرة والابتكار (1-5)
- جودة العمل (1-5)
- نقاط القوة
- مجالات التحسين
- ملاحظات عامة

### 4. MonthlyEvaluationReports
تقرير التقييمات الشهري المتقدم

```jsx
import MonthlyEvaluationReports from '@/components/MonthlyEvaluationReports'

<MonthlyEvaluationReports />
```

**الميزات:**
- توليد التقرير الشهري
- عرض أفضل الأداء
- إحصائيات الأقسام
- التقارير الفردية
- تصفية حسب الشهر والسنة

## سيناريوهات الاستخدام

### السيناريو 1: الموظف يسجل حضوره
1. يظهر للموظف مكون `RotationAttendancePanel`
2. يختار بين:
   - تسجيل حضور
   - تسجيل غياب (مع سبب)
   - طلب تبديل
3. يتم حفظ البيانات وإرسال إشعارات للإدارة

### السيناريو 2: طلب تبديل التناوب
1. الموظف يختار "طلب تبديل"
2. يختار الموظف الآخر والسبب
3. يتم إرسال إشعار للموظف الآخر
4. الموظف الآخر يوافق/يرفض
5. إذا وافق، يذهب للسوبر أدمن للموافقة النهائية
6. السوبر أدمن يوافق ويتم تبديل الجداول

### السيناريو 3: تقييم الموظف الشهري
1. السوبر أدمن ينتقل لـ `EvaluationForm`
2. يختار الموظف والشهر والسنة
3. يقيم الموظف على 6 معايير
4. يضيف ملاحظات
5. يتم حفظ التقييم

### السيناريو 4: عرض التقارير الشهرية
1. يتم توليد التقرير من قبل السوبر أدمن
2. يتم عرض:
   - أفضل الأداء (أعلى 5)
   - إحصائيات الأقسام
   - التقييمات الفردية مع الرسوم البيانية

## جداول قاعدة البيانات

### rotation_attendance_logs
```sql
{
  id: uuid,
  schedule_id: uuid,
  module: text ('factory' | 'overtime'),
  action: text,
  performed_by: uuid,
  details: jsonb,
  created_at: timestamp
}
```

### evaluationReports
```sql
{
  id: uuid,
  employee_id: uuid,
  month: integer,
  year: integer,
  technical_skills_avg: double,
  communication_avg: double,
  punctuality_avg: double,
  task_completion_avg: double,
  initiative_avg: double,
  work_quality_avg: double,
  overall_score_avg: double,
  evaluation_count: integer,
  created_by: uuid,
  created_at: timestamp
}
```

## الأدوار والصلاحيات

### الموظف
- تسجيل الحضور/الغياب
- طلب تبديل التناوب
- الموافقة/الرفض على طلبات التبديل من موظفين آخرين
- عرض تقييماته الشهرية

### السوبر أدمن
- عرض جميع التناوبات والحضور
- تسجيل الغياب من الإدارة
- الموافقة على طلبات التبديل
- إنشاء وتقييم الموظفين
- توليد التقارير الشهرية
- عرض الإحصائيات

## الإشعارات

يتم إرسال إشعارات تلقائية في الحالات التالية:
- الموظف سجل حضوره
- الموظف طلب تبديل
- الموظف وافق على تبديل
- الموظف رفض تبديل
- السوبر أدمن وافق على تبديل
- السوبر أدمن سجل الموظف غياب

## ملاحظات مهمة

1. **النظام يدعم نوعي التناوب**: Factory Rotation و Overtime Rotation بنفس الطريقة
2. **تسلسل الموافقات**: طلب تبديل → موافقة الموظف الآخر → موافقة السوبر أدمن
3. **سجل كامل**: جميع الإجراءات يتم تسجيلها في `rotation_attendance_logs`
4. **التقارير الشهرية**: يتم تجميع البيانات تلقائياً عند توليد التقرير
5. **الحماية**: فقط السوبر أدمن يمكنه توليد التقارير الشهرية

## الخطوات التالية

1. دمج المكونات في الصفحات المخصصة
2. إضافة الرسوم البيانية المتقدمة للتقارير
3. تصدير التقارير كـ PDF
4. إضافة تنبيهات البريد الإلكتروني
5. تطبيق الصلاحيات على المستوى الأدق
