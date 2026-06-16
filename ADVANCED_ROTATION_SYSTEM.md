# نظام التناوب والتقييمات المتقدم

## نظرة عامة

تم تطوير نظام متقدم لإدارة تناوب الموظفين (المصنع والأوفر تايم) مع نظام تقييم شهري احترافي.

## المميزات الجديدة

### 1. نظام التناوب المتقدم (Factory & Overtime)

#### آلية العمل:
- **تسجيل الحضور**: الموظف المسؤول عن اليوم يمكنه تسجيل حضوره عبر checkbox
- **حالات الحضور**:
  - `pending`: الحالة الافتراضية قبل التسجيل
  - `present`: موظف سجل حضوره
  - `absent`: موظف غاب (يتم التسجيل من قبل الإدارة)
  - `swap_pending`: طلب تبديل قيد الانتظار

#### طلبات التبديل (3 مستويات):
1. **الموظف الأول** → يطلب التبديل من موظف آخر
2. **الموظف الثاني** → يوافق أو يرفض
3. **السوبر أدمن** → الموافقة النهائية والتطبيق

#### الـ APIs الجديدة:
```
POST /api/factory-rotation/schedule/:id/mark-attendance
POST /api/overtime-rotation/schedule/:id/mark-attendance
  Body: { action: 'present' | 'swap_requested', target_user_id?, note? }

POST /api/factory-rotation/schedule/:id/mark-absent-admin
POST /api/overtime-rotation/schedule/:id/mark-absent-admin
  Body: { note? }
```

### 2. نظام التقييم الشهري

#### المعايير:
- المهارات التقنية (Technical Skills)
- التواصل والتعاون (Communication)
- الالتزام بالمواعيد (Punctuality)
- إنجاز المهام (Task Completion)
- المبادرة والإبداع (Initiative)
- جودة العمل (Work Quality)

#### التقارير:
- تقرير شهري تجميعي يحسب المتوسطات لكل معيار
- ترتيب الموظفين حسب الأداء (أفضل وأسوأ الأداء)
- سجل تاريخي لآخر 12 شهر

#### الـ APIs الجديدة:
```
GET /api/evaluations/monthly-report?month=3&year=2026
POST /api/evaluations/generate-monthly-report
  Body: { month: number, year: number }

GET /api/evaluations/employee/:employee_id/history
```

## جداول قاعدة البيانات

### الأعمدة الجديدة:

#### factory_rotation_schedule & overtime_rotation_schedule:
- `user_status`: حالة المستخدم (pending/present/absent/swap_pending)
- `marked_by_user_at`: وقت تسجيل الموظف
- `marked_by_admin_at`: وقت تسجيل الإدارة

#### rotation_swap_requests:
- `user_approval_status`: حالة موافقة الموظف الثاني
- `user_approved_at`: وقت الموافقة من الموظف الثاني
- `user_approval_note`: ملاحظة من الموظف الثاني

#### employee_evaluations:
- `evaluation_period_locked`: لمنع التعديل بعد الإغلاق

### الجداول الجديدة:

#### rotation_attendance_logs:
- تتبع كامل جميع العمليات (تسجيل حضور، طلبات تبديل، إلخ)
- مفيد للتدقيق والتحقق من التاريخ

#### evaluation_reports:
- التقارير التجميعية الشهرية
- حفظ المتوسطات والإحصائيات

## مكونات الـ Frontend

### RotationAttendancePanel.jsx
مكون يعرض حالة الحضور ويوفر:
- زر تسجيل حضور
- زر طلب تبديل (مع نموذج اختيار الموظف)
- زر تسجيل غياب (للإدارة فقط)

### EvaluationReports.jsx
يعرض التقرير الشهري مع:
- اختيار الشهر والسنة
- إحصائيات عامة
- ترتيب الموظفين

### EmployeeEvaluationHistory.jsx
يعرض السجل التاريخي للموظف:
- آخر 12 شهر من التقييمات
- اتجاه التطور
- تفاصيل كل تقييم

## مثال على الاستخدام

### تسجيل الحضور:
```javascript
// المستخدم يضغط زر "تسجيل حضور"
POST /api/factory-rotation/schedule/abc123/mark-attendance
{
  "action": "present",
  "note": "تم التسجيل يدويًا"
}
```

### طلب التبديل:
```javascript
// المستخدم يختار موظف ويطلب تبديل
POST /api/factory-rotation/schedule/abc123/mark-attendance
{
  "action": "swap_requested",
  "target_user_id": "user456",
  "note": "لدي ظرف طاريء"
}
```

### توليد التقرير:
```javascript
// السوبر أدمن يولد تقرير الشهر
POST /api/evaluations/generate-monthly-report
{
  "month": 3,
  "year": 2026
}
```

## ملفات معدلة

1. `shared/schema.ts` - إضافة أعمدة وجداول جديدة
2. `server/routes/factory-rotation.ts` - إضافة endpoints للحضور
3. `server/routes/overtime-rotation.ts` - إضافة endpoints للحضور
4. `server/routes/evaluations.ts` - إضافة endpoints للتقارير
5. `src/components/` - مكونات جديدة للـ UI

## الملاحظات المهمة

- جميع العمليات يتم تسجيلها في `rotation_attendance_logs` للتدقيق
- النظام يرسل إشعارات عند كل مرحلة من مراحل التبديل
- التقارير تُحفظ في قاعدة البيانات لسهولة الوصول المستقبلي
- يمكن للموظفين رؤية تقييماتهم بعد التصريح من الإدارة
