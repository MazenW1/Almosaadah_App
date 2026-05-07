// pages/Contracts.tsx
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef, useTransition } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Header } from '../components/Header';

// ─── Contract type config (title + financial section only) ──────────────────
const CONTRACT_TITLES: Record<string, { title: string; subtitle?: string }> = {
  'عون':     { title: 'عقد خدمة عون للجمعيات الأهلية',                               subtitle: '(الباقة الماسية)' },
  'تطوع':    { title: 'عقد خدمة تقديم منحة تطوع للمحترفين\nللجمعيات الأهلية' },
  'مشاريع':  { title: 'عقد خدمة تقديم مشاريع للجمعيات الأهلية' },
};

// ─── Generate Contract — browser print, uses dynamic clauses ──────────────────
function generateContractPDF(data: {
  contract_number: string;
  client_name: string;
  client_phone: string;
  service_name: string;
  contract_type: string;
  contract_details: string;
  employee_name: string;
  financial_amount: string;
  financial_notes: string;
  start_date: string;
  end_date: string;
  fee_tier1_label: string;
  fee_tier1_value: string;
  fee_tier2_label: string;
  fee_tier2_value: string;
  fee_tier3_label: string;
  fee_tier3_value: string;
  client_logo_url?: string;
  client_rep?: string;
  awn_package?: string;
  clauses?: Array<{ id: string; title: string; text: string; enabled: boolean; isTable?: boolean }>;
}) {
  const isTatawwu  = data.contract_type === 'تطوع';
  const isMashari  = data.contract_type === 'مشاريع';
  const titleCfg   = CONTRACT_TITLES[data.contract_type] || CONTRACT_TITLES['عون'];
  // إذا في اسم خدمة محدد، يصبح عنوان العقد
  const contractMainTitle = data.service_name
    ? `عقد خدمة ${data.service_name}`
    : titleCfg.title;
  const contractSubtitle = data.awn_package ? `(${data.awn_package})` : titleCfg.subtitle;

  const dateAr = (d: string) =>
    d ? new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  const today     = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  const todayHijri = new Date().toLocaleDateString('ar-SA-u-ca-islamic', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const startDateDisplay = data.start_date ? dateAr(data.start_date) : today;
  const startHijri = data.start_date
    ? new Date(data.start_date).toLocaleDateString('ar-SA-u-ca-islamic', { year: 'numeric', month: 'long', day: 'numeric' })
    : todayHijri;

  // ─── موضوع العقد حسب النوع ────────────────────────────────────────────────
  const subjectItems = isTatawwu ? [
    'مراجعة جاهزية الجهة المستفيدة.',
    'تجهيز المستندات المطلوبة مع الجهة المستفيدة.',
    'تحسين الملف التعريفي والبيانات اللازمة مع الجهة المستفيدة.',
    `رفع طلب المنحة تطوع للمحترفين باسم الجهة المستفيدة${data.service_name ? ': <strong>' + data.service_name + '</strong>' : ''}.`,
    'المتابعة الإدارية حتى يتم رد على المنحة المرفوعة.',
  ] : isMashari ? [
    `تقديم طلب منحة البرامج والمشاريع من صندوق دعم الجمعيات باسم الجهة المستفيدة${data.service_name ? ': <strong>' + data.service_name + '</strong>' : ''}.`,
    'إعداد وثيقة المشروع المتضمنة تحليل، خطة، مؤشرات أداء، واحتياج تدريبي.',
    'متابعة الإجراءات اللازمة لتنفيذ المشروع.',
    'تسليم التقارير والمتطلبات النهائية وإغلاق المشروع.',
  ] : [
    `تقديم طلب منحة البرامج والمشاريع من صندوق دعم الجمعيات باسم الجهة المستفيدة${data.service_name ? ': <strong>' + data.service_name + '</strong>' : ''}.`,
    'تقديم الدعم الاستشاري والإداري والفني والتوجيهي.',
    'متابعة الإجراءات اللازمة لصرف المنح.',
    'تسليم التقارير والمتطلبات النهائية من الجهة المستفيدة حسب اشتراطات صندوق دعم الجمعيات وإغلاقها.',
  ];

  // ─── التزامات مقدم الخدمة ─────────────────────────────────────────────────
  const providerObligations = isTatawwu ? [
    'تنفيذ كافة الأعمال المنصوص عليها باحترافية وفق موضوع العقد المادة (2).',
    'تقديم الدعم الاستشاري والإداري والفني والتوجيهي والمتابعة المستمرة.',
    'تنفيذ حلول المناسبة ومعالجة لثلاث تحديات التي يتم تحديدها من قبل الطرف الثاني وفق محضر مجلس الإدارة المعتمد.',
    'الحفاظ التام على سرية كافة المعلومات والمستندات.',
    'إغلاق المنحة فنياً وإدارياً ومالياً بالصندوق.',
  ] : [
    'تنفيذ كافة الأعمال المنصوص عليها باحترافية (إدارة الحساب - التقديم - صناعة برنامج - المتابعة - الإغلاق) فقط.',
    'تقديم الدعم الاستشاري والإداري والفني والتوجيهي والمتابعة المستمرة.',
    'الحفاظ التام على سرية كافة المعلومات والمستندات.',
    'إغلاق المنحة فنياً وإدارياً ومالياً بالصندوق.',
  ];

  // ─── التزامات الجهة المستفيدة ─────────────────────────────────────────────
  const clientObligations = isTatawwu ? [
    'يلتزم بتحديد واعتماد ثلاثة تحديات أساسية مرتبطة بالمشروع، على أن يتم توثيقها رسمياً ضمن محضر اجتماع مجلس الإدارة ويتم تزويد نسخة منها مع العقد.',
    'تزويد مقدم الخدمة بكافة المعلومات والمستندات المطلوبة.',
    'تمكين مقدم الخدمة من استخدام حساب منصة صندوق دعم الجمعيات.',
    'التعاون السريع في الردود والتواقيع والاعتمادات خلال مراحل المنحة.',
    'الالتزام بسداد الأتعاب بعد صرف المنحة.',
  ] : [
    'تزويد مقدم الخدمة بكافة المعلومات والمستندات المطلوبة.',
    'تمكين مقدم الخدمة من استخدام حساب منصة صندوق دعم الجمعيات.',
    'التعاون الكامل خلال مراحل المنحة.',
    'الالتزام بسداد الأتعاب بعد صرف المنحة.',
  ];

  // ─── المادة المالية ───────────────────────────────────────────────────────
  const financialArticleHTML = isTatawwu || isMashari ? `
    <p style="font-size:12.5px;color:#1e293b;line-height:2.1;margin-bottom:4mm;text-align:justify;">
      يستحق الطرف الأول (مقدم الخدمة) النسبة <strong>(60%)</strong> من إجمالي قيمة المنحة، يُخصص لتغطية تكاليف تنفيذ المشروع، بما في ذلك أتعاب مقدم الخدمة، وذلك بناءً على معالجة ثلاثة تحديات رئيسية يتم تحديدها واعتمادها من قبل مجلس إدارة الجمعية.
    </p>
    <p style="font-size:12.5px;color:#1e293b;line-height:2.1;margin-bottom:4mm;">
      ويتم توفير عائد مالي من باقي المنحة <strong>(40%)</strong> للطرف الثاني.
    </p>
    <ol style="font-size:12.5px;color:#1e293b;line-height:2.1;padding-right:6mm;margin-bottom:5mm;list-style:decimal;">
      <li>يشمل مبلغ التنفيذ كافة التكاليف الإدارية والفنية اللازمة لمعالجة التحديات الثلاث، وفق ما يراه مقدم الخدمة.</li>
      <li>في حال رغبة الجمعية بإضافة تحديات أخرى أو تعديل التحديات المعتمدة بعد إقرارها، يتم ذلك بموجب ملحق عقد مستقل، وقد يترتب عليه تعديل في التكاليف.</li>
      <li>يُعد اعتماد محضر مجلس الإدارة للتحديات بمثابة موافقة نهائية على نطاق المشروع، ولا يحق الاعتراض لاحقاً على بنود التنفيذ المرتبطة بها.</li>
      <li>يتم الدفع عن طريق تحويل بنكي عبر رقم الحساب ببنك الراجحي: <strong>SA15800000694608017026296</strong> بأسم: ألأراكان مطلق مسيفر العتيبي المساعده الإدارية.</li>
    </ol>
    ${data.financial_amount ? `<p style="font-size:12.5px;color:#1e293b;line-height:2;margin-bottom:3mm;"><strong>المبلغ المتفق عليه:</strong> ${Number(data.financial_amount).toLocaleString('ar-SA')} ريال${data.financial_notes ? ' — ' + data.financial_notes : ''}.</p>` : ''}
  ` : `
    <table style="width:100%;border-collapse:collapse;margin-bottom:5mm;font-size:12.5px;">
      <thead>
        <tr style="background:#1e3a8a;color:#fff;">
          <th style="padding:3mm 4mm;text-align:right;font-weight:700;font-size:11.5px;width:38px;">م</th>
          <th style="padding:3mm 4mm;text-align:right;font-weight:700;font-size:11.5px;">الإيراد المتحقق</th>
          <th style="padding:3mm 4mm;text-align:right;font-weight:700;font-size:11.5px;">مستحقات الطرف الأول ${data.awn_package ? `(${data.awn_package})` : '(الباقة الماسية)'}</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background:#f8fafc;">
          <td style="padding:2.5mm 4mm;border-bottom:1px solid #e2e8f0;">1</td>
          <td style="padding:2.5mm 4mm;border-bottom:1px solid #e2e8f0;">${data.fee_tier1_label}</td>
          <td style="padding:2.5mm 4mm;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0e7490;">${data.fee_tier1_value}</td>
        </tr>
        <tr>
          <td style="padding:2.5mm 4mm;border-bottom:1px solid #e2e8f0;">2</td>
          <td style="padding:2.5mm 4mm;border-bottom:1px solid #e2e8f0;">${data.fee_tier2_label}</td>
          <td style="padding:2.5mm 4mm;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0e7490;">${data.fee_tier2_value}</td>
        </tr>
        <tr style="background:#f8fafc;">
          <td style="padding:2.5mm 4mm;">3</td>
          <td style="padding:2.5mm 4mm;">${data.fee_tier3_label}</td>
          <td style="padding:2.5mm 4mm;font-weight:700;color:#0e7490;">${data.fee_tier3_value}</td>
        </tr>
      </tbody>
    </table>
    <p style="font-size:12px;color:#0369a1;line-height:1.8;margin-bottom:4mm;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:3mm 4mm;">
      <strong>مثال توضيحي:</strong> في حال تحقق إيراد إجمالي قدره 360,000 ريال، عن كل 100,000 ريال يتم احتساب 17,000 ريال. مستحقات 300,000 ريال = 17,000 × 3 = <strong>51,000 ريال</strong>. أما المبلغ المتبقي 60,000 ريال فمستحقاته <strong>8,500 ريال</strong>.
    </p>
    <p style="font-size:12.5px;color:#1e293b;line-height:2;margin-bottom:3mm;">
      يستحق مقدم الخدمة أتعاباً وفق الجدول بالأعلى <strong>${data.awn_package ? `(${data.awn_package})` : '(الباقة الماسية)'}</strong>، تُدفع خلال يوم عمل واحد من تاريخ صرف المنحة المرفوعة. يتم الدفع عن طريق تحويل بنكي عبر رقم الحساب ببنك الراجحي: <strong>SA15800000694608017026296</strong> بأسم: ألأراكان مطلق مسيفر العتيبي المساعده الإدارية.
    </p>
    ${data.financial_amount ? `<p style="font-size:12.5px;color:#1e293b;line-height:2;margin-bottom:3mm;"><strong>المبلغ المتفق عليه:</strong> ${Number(data.financial_amount).toLocaleString('ar-SA')} ريال${data.financial_notes ? ' — ' + data.financial_notes : ''}.</p>` : ''}
  `;

  // ─── رقم المادة العامة ─────────────────────────────────────────────────────
  const generalArticleNum = isTatawwu ? '10' : '11';

  // ─── إنشاء HTML للبنود (ديناميكي إذا وُجدت clauses) ──────────────────────────
  const renderClausesHTML = (): string => {
    if (!data.clauses || data.clauses.length === 0) {
      // fallback: البنود الثابتة القديمة
      return `
  <!-- ── المادة 1: تعريف المصطلحات ── -->
  <div class="article-title"><span class="article-bar"></span>المادة (1) تعريف المصطلحات إذا وردت في هذا العقد كلها أو بعضها:</div>
  <ul class="items-list">
    <li><span class="item-bullet check">−</span><span><strong>الدعم:</strong> الدعم الاستشاري والإداري والفني والتوجيهي.</span></li>
    <li><span class="item-bullet check">−</span><span><strong>وثيقة المشروع:</strong> ملف يتضمن تحليل، خطة، مؤشرات أداء، واحتياج تدريبي.</span></li>
    <li><span class="item-bullet check">−</span><span><strong>المنحة:</strong> مبلغ مالي يُمنح من صندوق دعم الجمعيات، بهدف تحسين كفاءة الجهة وزيادة الفرص في الدعم والتمويل.</span></li>
    <li><span class="item-bullet check">−</span><span><strong>طلب المنح من صندوق دعم الجمعيات:</strong> طلب يُقدَّم للحصول على منحة مالية مخصصة لدعم الجمعيات والمشاريع النوعية. (يعتمد على موافقة الصندوق لهذا الطلب).</span></li>
  </ul>
  <hr class="divider"/>
  <div class="article-title"><span class="article-bar"></span>المادة (2) موضوع العقد</div>
  <p style="font-size:12.5px;color:#475569;margin-bottom:2.5mm;">يتعهد مقدم الخدمة بتقديم الخدمات التالية:</p>
  <ul class="items-list">
    ${subjectItems.map(item => `<li><span class="item-bullet check">✓</span><span>${item}</span></li>`).join('')}
  </ul>
  ${data.contract_details ? `<p style="font-size:12px;color:#475569;background:#f8fafc;padding:3mm 4mm;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:3mm;">${data.contract_details}</p>` : ''}
  <hr class="divider"/>
  <div class="article-title"><span class="article-bar"></span>المادة (3) مدة العقد</div>
  <p style="font-size:12.5px;color:#1e293b;line-height:2.1;margin-bottom:4mm;">تبدأ مدة هذا العقد من تاريخ <strong>${startDateDisplay}</strong>، إلى نهاية تقديم فترات المنح المقدمة من الصندوق، قابلة للتمديد باتفاق خطي بين الطرفين، ولا يعتبر العقد منتهياً إلا بعد استكمال كامل مراحل التنفيذ.</p>
  <hr class="divider"/>
  <div class="article-title"><span class="article-bar"></span>المادة (4) التزامات مقدم الخدمة</div>
  <ul class="items-list">
    ${providerObligations.map((item, i) => `<li><span class="item-bullet num">${i+1}</span><span>${item}</span></li>`).join('')}
  </ul>
  <hr class="divider"/>
  <div class="article-title"><span class="article-bar"></span>المادة (5) التزامات الجهة المستفيدة</div>
  <ul class="items-list">
    ${clientObligations.map((item, i) => `<li><span class="item-bullet num">${i+1}</span><span>${item}</span></li>`).join('')}
  </ul>
  <hr class="divider"/>
  <div class="article-title"><span class="article-bar"></span>المادة (6) القابل المالي وآلية الدفع</div>
  ${financialArticleHTML}
  <hr class="divider"/>
  <div class="article-title"><span class="article-bar"></span>المادة (7) السرية والملكية الفكرية</div>
  <ul class="items-list">
    <li><span class="item-bullet num">1</span><span>يلتزم الطرفان بالحفاظ على سرية المعلومات المتبادلة.</span></li>
    <li><span class="item-bullet num">2</span><span>تعود ملكية النماذج والأدوات المستخدمة لمقدم الخدمة، ولا يجوز إعادة استخدامها أو نشرها دون إذنه.</span></li>
  </ul>
  <div class="article-title"><span class="article-bar"></span>المادة (8) تسوية النزاعات</div>
  <ul class="items-list">
    <li><span class="item-bullet num">1</span><span>تُحل النزاعات ودياً خلال شهر من تاريخ نشوئها.</span></li>
    <li><span class="item-bullet num">2</span><span>إن تعذر ذلك، يُحال النزاع للتحكيم أو المحكمة المختصة في المملكة العربية السعودية — الطائف.</span></li>
  </ul>
  <hr class="divider"/>
  <div class="article-title"><span class="article-bar"></span>المادة (${generalArticleNum}) أحكام عامة</div>
  <ul class="items-list">
    <li><span class="item-bullet num">1</span><span>لا يلتزم الطرف الأول بتقديم أي دعم مالي خاص بناءً على هذا العقد.</span></li>
    <li><span class="item-bullet num">2</span><span>يمثل العقد الاتفاق الكامل ويلغي أي تفاهمات سابقة.</span></li>
    <li><span class="item-bullet num">3</span><span>لا يجوز التنازل عن الحقوق والالتزامات إلا بموافقة خطية.</span></li>
    <li><span class="item-bullet num">4</span><span>يُحرر من نسختين أصليتين، بيد كل طرف نسخة.</span></li>
  </ul>
      `;
    }

    // ─── عرض البنود الديناميكية ───────────────────────────────────────────────
    return data.clauses
      .filter(c => c.enabled)
      .map(clause => {
        let bodyHTML = '';

        if (clause.isTable) {
          // جدول الشرائح المالية
          const rows = clause.text.split('\n').filter(l => l.includes('|'));
          if (rows.length > 0) {
            const tableRows = rows.map((line, i) => {
              const [rev, fee] = line.split('|');
              const bg = i % 2 === 0 ? 'background:#f8fafc;' : '';
              return `<tr style="${bg}">
                <td style="padding:2.5mm 4mm;border-bottom:1px solid #e2e8f0;">${i + 1}</td>
                <td style="padding:2.5mm 4mm;border-bottom:1px solid #e2e8f0;">${(rev || '').trim()}</td>
                <td style="padding:2.5mm 4mm;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0e7490;">${(fee || '').trim()}</td>
              </tr>`;
            }).join('');
            bodyHTML = `
              <table style="width:100%;border-collapse:collapse;margin-bottom:5mm;font-size:12.5px;">
                <thead>
                  <tr style="background:#1e3a8a;color:#fff;">
                    <th style="padding:3mm 4mm;text-align:right;font-weight:700;font-size:11.5px;width:38px;">م</th>
                    <th style="padding:3mm 4mm;text-align:right;font-weight:700;font-size:11.5px;">الإيراد المتحقق</th>
                    <th style="padding:3mm 4mm;text-align:right;font-weight:700;font-size:11.5px;">المستحقات</th>
                  </tr>
                </thead>
                <tbody>${tableRows}</tbody>
              </table>
              <p style="font-size:12.5px;color:#1e293b;line-height:2;margin-bottom:3mm;">
                يتم الدفع عن طريق تحويل بنكي عبر رقم الحساب ببنك الراجحي: <strong>SA15800000694608017026296</strong> بأسم: ألأراكان مطلق مسيفر العتيبي المساعده الإدارية.
              </p>
              ${data.financial_amount ? `<p style="font-size:12.5px;color:#1e293b;line-height:2;margin-bottom:3mm;"><strong>المبلغ المتفق عليه:</strong> ${Number(data.financial_amount).toLocaleString('ar-SA')} ريال${data.financial_notes ? ' — ' + data.financial_notes : ''}.</p>` : ''}
            `;
          }
        } else {
          // بند نصي عادي — كل سطر يصبح بنداً في قائمة
          const lines = clause.text.replace(/\\n/g, '\n').split('\n').filter(l => l.trim());
          if (lines.length === 1) {
            bodyHTML = `<p style="font-size:12.5px;color:#1e293b;line-height:2.1;margin-bottom:4mm;">${lines[0]}</p>`;
          } else {
            const items = lines.map((line, i) => {
              // إزالة رقم البداية إن وُجد (مثل "1. النص")
              const clean = line.replace(/^\d+[\.\-\)]\s*/, '');
              return `<li><span class="item-bullet num">${i + 1}</span><span>${clean}</span></li>`;
            }).join('');
            bodyHTML = `<ul class="items-list">${items}</ul>`;
          }
        }

        return `
  <div class="article-title"><span class="article-bar"></span>${clause.title}</div>
  ${bodyHTML}
  <hr class="divider"/>`;
      })
      .join('');
  };

  const clausesHTML = renderClausesHTML();

  // ─── لوجو الجمعية ─────────────────────────────────────────────────────────
  const clientLogoHTML = data.client_logo_url
    ? `<img src="${data.client_logo_url}" alt="شعار الجمعية" style="height:48px;max-width:110px;object-fit:contain;display:block;"/>`
    : '';

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HTML
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar" style="overflow:visible;">
<head>
<meta charset="UTF-8"/>
<title>${contractMainTitle.replace(/\n/g,' ')} — ${data.client_name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');

  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family:'Tajawal', sans-serif;
    background:#fff;
    color:#1e293b;
    font-size:13px;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
    overflow:visible;
  }

  /* ── صفحة A4 عادية بدون حدود ── */
  .page {
    width:210mm;
    min-height:297mm;
    margin:0 auto;
    padding:0 5mm 20mm 20mm;
    background:#fff;
    box-sizing:border-box;
  }

  /* ── هيدر اللوجوهات ── */
  .header-logos {
    direction:ltr;
    display:flex;
    flex-direction:row;
    align-items:center;
    justify-content:space-between;
    width:100%;
    margin-bottom:5mm;
    padding-bottom:3mm;
    border-bottom:1.5px solid #e2e8f0;
    box-sizing:border-box;
  }
  .logo-left,
  .logo-right {
    display:flex;
    align-items:center;
    flex-shrink:0;
  }
  .logo-left img,
  .logo-right img {
    height:80px;
    max-width:180px;
    width:auto;
    object-fit:contain;
    display:block;
  }
  .header-logo-placeholder {
    width:60px;
    height:60px;
  }

  /* ── عنوان العقد ── */
  .contract-title {
    text-align:center;
    font-size:23px;
    font-weight:900;
    color:#1e293b;
    line-height:1.4;
    margin-bottom:1.5mm;
  }
  .contract-subtitle { text-align:center; font-size:14px; color:#475569; margin-bottom:1.5mm; font-weight:700; }
  .contract-date {
    text-align:center;
    font-size:12px;
    color:#475569;
    margin-bottom:6mm;
  }

  /* ── فاصل ── */
  .divider { border:none; border-top:1.5px solid #e2e8f0; margin:4mm 0; }
  .divider-sm { border:none; border-top:0.75px solid #f1f5f9; margin:3mm 0; }

  /* ── المقدمة التمهيدية ── */
  .intro {
    font-size:12.5px;
    line-height:2.1;
    color:#475569;
    margin-bottom:5mm;
    text-align:justify;
  }

  /* ── عنوان المادة ── */
  .article-title {
    display:flex;
    align-items:center;
    gap:7px;
    font-size:13.5px;
    font-weight:900;
    color:#dc2626;
    margin-bottom:3.5mm;
    margin-top:1mm;
  }
  .article-bar {
    width:4px; height:18px; min-width:4px;
    background:#dc2626;
    border-radius:2px;
    display:inline-block;
    flex-shrink:0;
  }

  /* ── جدول بيانات الأطراف ── */
  .parties-grid {
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:1.5mm 10mm;
    margin-bottom:5mm;
  }
  .party-field { padding:2mm 0; }
  .party-field label {
    display:block;
    font-size:9.5px;
    color:#94a3b8;
    margin-bottom:0.5mm;
    font-weight:600;
  }
  .party-field span {
    font-size:12.5px;
    font-weight:700;
    color:#1e293b;
  }
  .parties-sep {
    grid-column:1/-1;
    height:1px;
    background:#e2e8f0;
    margin:2mm 0;
  }

  /* ── قوائم البنود ── */
  .items-list { list-style:none; padding:0; margin-bottom:4mm; }
  .items-list li {
    display:flex;
    align-items:flex-start;
    gap:7px;
    padding:2mm 0;
    border-bottom:0.5px solid #f8fafc;
    font-size:12.5px;
    line-height:1.9;
    color:#1e293b;
  }
  .items-list li:last-child { border-bottom:none; }
  .item-bullet {
    flex-shrink:0;
    margin-top:3px;
  }
  /* ✓ احمر للبنود */
  .item-bullet.check {
    width:16px; height:16px;
    background:#fee2e2; border:1.5px solid #fca5a5;
    border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:8px; color:#dc2626; font-weight:900;
  }
  /* رقم للالتزامات */
  .item-bullet.num {
    width:16px; height:16px;
    background:#fee2e2; border:1.5px solid #fca5a5;
    border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:8px; color:#dc2626; font-weight:900;
  }

  /* ── التوقيعات ── */
  .sign-row {
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:12mm;
    margin-top:6mm;
  }
  .sign-box { text-align:center; }
  .sign-party-title {
    font-size:13px; font-weight:900; color:#1e293b;
    margin-bottom:2mm;
  }
  .sign-name {
    font-size:11.5px; color:#475569;
    line-height:1.7; margin-bottom:6mm;
  }
  .sign-stamp {
    width:28mm; height:28mm;
    border:1.5px dashed #cbd5e1;
    border-radius:50%;
    margin:0 auto 3mm;
    display:flex; align-items:center; justify-content:center;
    color:#cbd5e1; font-size:10px;
  }
  .sign-line {
    border-top:1px solid #94a3b8;
    padding-top:2mm;
    font-size:10px; color:#94a3b8;
    text-align:center;
  }

  /* ── الفوتر ── */
  .footer {
    text-align:center;
    font-size:9.5px;
    color:#94a3b8;
    margin-top:5mm;
    padding-top:3mm;
    border-top:1px solid #f1f5f9;
  }

  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; margin:0; padding:0; }
    .page { padding:0 5mm 20mm 20mm; margin:0; width:210mm; box-sizing:border-box; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- ── هيدر: لوجو الجمعية يسار + المساعدة الإدارية يمين ── -->
  <div class="header-logos">
    <div class="logo-left">${data.client_logo_url ? `<img src="${data.client_logo_url}" alt="شعار الجمعية"/>` : '<div class="header-logo-placeholder"></div>'}</div>
    <div class="logo-right"><img src="https://whapstcqrktvfmxtinnp.supabase.co/storage/v1/object/public/news-images/news/icon.png" alt="المساعدة الإدارية"/></div>
  </div>

  <!-- ── عنوان العقد ── -->
  <h1 class="contract-title">${contractMainTitle.replace(/\n/g, '<br/>')}</h1>
  ${contractSubtitle ? `<div class="contract-subtitle">${contractSubtitle}</div>` : ''}
  <div class="contract-date">
    بتاريخ: ${startHijri} هجري، الموافق: ${startDateDisplay} ميلادي.
  </div>

  <hr class="divider"/>

  <!-- ── المقدمة التمهيدية ── -->
  <p class="intro">
    نظراً لرغبة الجهة المستفيدة في التعاقد مع مقدم الخدمة الذي لديه الخبرة والكفاءة والإمكانيات اللازمة، لتقديم خدمات الدعم الاستشاري والإداري والفني والتوجيهي والتخصصي من خلال طلب المنح المقدمة من صندوق دعم الجمعيات، لرفع الكفاءة وزيادة الفرص في الدعم والتمويل، فقد اتفق الطرفان على ما يلي:
  </p>

  <!-- ── أطراف التعاقد ── -->
  <div class="article-title"><span class="article-bar"></span>أطراف التعاقد</div>
  <div class="parties-grid">
    <div class="party-field">
      <label>الطرف الأول (مقدم الخدمة)</label>
      <span>راكان مطلق مسيفر العتيبي</span>
    </div>
    <div class="party-field">
      <label>هوية / ترخيص</label>
      <span>FL-549486842 — 1071726275</span>
    </div>
    <div class="party-field">
      <label>رقم التواصل</label>
      <span>0580171160 / 0591700131</span>
    </div>
    <div class="party-field">
      <label>البريد الإلكتروني</label>
      <span>info@almosaadah.sa</span>
    </div>
    <div class="parties-sep"></div>
    <div class="party-field">
      <label>الطرف الثاني (الجهة المستفيدة)</label>
      <span>${data.client_name}</span>
    </div>
    <div class="party-field">
      <label>ممثل الجمعية (رئيس مجلس الإدارة)</label>
      <span>${data.client_rep || '—'}</span>
    </div>
    <div class="party-field">
      <label>رقم التواصل</label>
      <span>${data.client_phone || '—'}</span>
    </div>
    <div class="party-field">
      <label>تاريخ بدء العقد</label>
      <span>${startDateDisplay}</span>
    </div>
    ${data.end_date ? `
    <div class="party-field">
      <label>نهاية العقد</label>
      <span>${dateAr(data.end_date)}</span>
    </div>
    <div></div>` : ''}
  </div>

  <hr class="divider"/>

  <!-- ── بنود العقد الديناميكية ── -->
  ${clausesHTML}

  <!-- ── التوقيعات ── -->
  <p style="text-align:center;font-size:14px;font-weight:900;color:#1e293b;margin-bottom:5mm;">تمت تتمة هذا العقد بتوفيق الله...</p>
  <div class="sign-row">
    <div class="sign-box">
      <div class="sign-party-title">(الطرف الأول)</div>
      <div class="sign-name">اسم الجهة: المساعدة الإدارية<br/>مدير الجهة: أ/ راكان مطلق العتيبي</div>
      <div class="sign-stamp">الختم</div>
      <div class="sign-line">التوقيع:</div>
    </div>
    <div class="sign-box">
      <div class="sign-party-title">(الطرف الثاني)</div>
      <div class="sign-name">اسم الجمعية: ${data.client_name}<br/>ممثل الجمعية: أ/ ${data.client_rep || '..........................'} (رئيس مجلس الإدارة)</div>
      <div class="sign-stamp">الختم</div>
      <div class="sign-line">التوقيع:</div>
    </div>
  </div>

  <!-- ── الفوتر ── -->
  <div class="footer">
    تاريخ الإنشاء: ${today} | المساعدة الإدارية — خدمات دعم الجمعيات الأهلية | info@almosaadah.sa
  </div>

</div>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Contract {
  contract_id: string;
  contract_number: string;
  client_name: string;
  client_phone: string;
  client_rep?: string;
  service_name: string;
  employee_id: string;
  employee_name: string;
  contract_status: string;
  status_reason?: string;
  contract_url?: string;
  financial_amount?: number;
  financial_notes?: string;
  created_at: string;
  updated_at?: string;
  signed_at?: string;
  created_by?: string;
  contract_type?: string;
  contract_details?: string;
  start_date?: string;
  end_date?: string;
  // للعلاقة
  employee?: { employee_name: string; employee_phone?: string };
  user?: { association_name: string; user_phone?: string; user_email?: string };
  service?: { service_name: string; service_description?: string };
}

// ─── Clause (بند العقد القابل للتعديل) ──────────────────────────────────────
interface Clause {
  id: string;
  title: string;
  text: string;
  enabled: boolean;
  isTable?: boolean;  // للمادة المالية
}

interface Employee {
  employee_id: string;
  employee_name: string;
  employee_email?: string;
  employee_phone?: string;
  employee_role?: string;
  is_active: boolean;
}

interface Toast { id: number; msg: string; type: 'success' | 'error' | 'info' }

// ─── Status Configurations ────────────────────────────────────────────────────
const CONTRACT_STATUS_MAP: Record<string, { text: string; icon: string; colors: string; dot: string }> = {
  draft: {
    text: 'مسودة',
    icon: 'fa-file-pen',
    colors: 'bg-slate-100 text-slate-600 border border-slate-200',
    dot: 'bg-slate-400'
  },
  pending_signature: {
    text: 'في انتظار توقيع العميل',
    icon: 'fa-clock',
    colors: 'bg-amber-50 text-amber-700 border border-amber-200',
    dot: 'bg-amber-400'
  },
  pending_admin_review: {
    text: 'بانتظار مراجعة الإدارة',
    icon: 'fa-hourglass-half',
    colors: 'bg-orange-50 text-orange-700 border border-orange-200',
    dot: 'bg-orange-400'
  },
  approved: {
    text: 'معتمد',
    icon: 'fa-check',
    colors: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dot: 'bg-emerald-500'
  },
  completed: {
    text: 'مكتمل - تم التوقيع',
    icon: 'fa-flag-checkered',
    colors: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
    dot: 'bg-emerald-600'
  },
  cancelled: {
    text: 'ملغى',
    icon: 'fa-ban',
    colors: 'bg-red-50 text-red-600 border border-red-200',
    dot: 'bg-red-400'
  },
  expired: {
    text: 'منتهي الصلاحية',
    icon: 'fa-calendar-xmark',
    colors: 'bg-gray-100 text-gray-600 border border-gray-200',
    dot: 'bg-gray-400'
  },
};

const AWN_PACKAGES = [
  { label: 'ماسية', icon: 'fa-gem',        color: '#06b6d4' },
  { label: 'ذهبية', icon: 'fa-star',        color: '#d97706' },
  { label: 'فضية',  icon: 'fa-circle-half-stroke', color: '#64748b' },
  { label: 'برونزية', icon: 'fa-shield',    color: '#92400e' },
];

const CONTRACT_TYPE_MAP: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  'عون': { label: 'باقة عون', icon: 'fa-handshake', color: '#0891b2', bg: '#f0f9ff' },
  'تطوع': { label: 'منحة تطوع', icon: 'fa-hands-holding-heart', color: '#059669', bg: '#f0fdf4' },
  'مشاريع': { label: 'مشاريع', icon: 'fa-rocket', color: '#7c3aed', bg: '#faf5ff' },
  'default': { label: 'عقد عام', icon: 'fa-file-contract', color: '#64748b', bg: '#f8fafc' },
};

// ─── Toast Component ──────────────────────────────────────────────────────────
function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[2000] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={onRemove} />)}
    </div>
  );
}
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  useEffect(() => { const t = setTimeout(() => onRemove(toast.id), 4500); return () => clearTimeout(t); }, [toast.id, onRemove]);
  const color = toast.type === 'success' ? 'border-emerald-500' : toast.type === 'error' ? 'border-red-500' : 'border-cyan-500';
  const icon  = toast.type === 'success' ? 'fa-check-circle text-emerald-500' : toast.type === 'error' ? 'fa-exclamation-circle text-red-500' : 'fa-info-circle text-cyan-500';
  return (
    <div className={`flex items-center gap-3 bg-white px-5 py-3 rounded-xl shadow-lg min-w-[260px] border-r-4 ${color} pointer-events-auto`}>
      <i className={`fas ${icon}`} />
      <span className="text-slate-700 font-semibold text-sm">{toast.msg}</span>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = CONTRACT_STATUS_MAP[status] || CONTRACT_STATUS_MAP['draft'];
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${s.colors}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} flex-shrink-0`} />
      <i className={`fas ${s.icon} text-[10px]`} />
      {s.text}
    </span>
  );
}

// ─── Filter Pill ─────────────────────────────────────────────────────────────
function FilterPill({ label, active, count, onClick, accent = 'cyan' }: { label: string; active: boolean; count?: number; onClick: () => void; accent?: string }) {
  const accentMap: Record<string, { on: string; off: string; badge: string }> = {
    cyan:    { on: 'bg-cyan-600 text-white border-cyan-600 shadow shadow-cyan-200',      off: 'bg-white text-slate-500 border-slate-200 hover:border-cyan-300 hover:text-cyan-700',    badge: 'bg-white/25 text-white' },
    amber:   { on: 'bg-amber-500 text-white border-amber-500 shadow shadow-amber-200',   off: 'bg-white text-slate-500 border-slate-200 hover:border-amber-300 hover:text-amber-600',  badge: 'bg-white/25 text-white' },
    violet:  { on: 'bg-violet-600 text-white border-violet-600 shadow shadow-violet-200',off: 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600',badge: 'bg-white/25 text-white' },
    sky:     { on: 'bg-sky-600 text-white border-sky-600 shadow shadow-sky-200',         off: 'bg-white text-slate-500 border-slate-200 hover:border-sky-300 hover:text-sky-600',      badge: 'bg-white/25 text-white' },
    emerald: { on: 'bg-emerald-600 text-white border-emerald-600 shadow shadow-emerald-200',off:'bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-emerald-600',badge:'bg-white/25 text-white'},
    red:     { on: 'bg-red-500 text-white border-red-500 shadow shadow-red-200',         off: 'bg-white text-slate-500 border-slate-200 hover:border-red-300 hover:text-red-500',      badge: 'bg-white/25 text-white' },
    slate:   { on: 'bg-slate-700 text-white border-slate-700 shadow',                    off: 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700',  badge: 'bg-white/25 text-white' },
  };
  const c = accentMap[accent] || accentMap.cyan;
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border transition-all duration-150 ${active ? c.on : c.off}`}>
      {label}
      {count !== undefined && (
        <span className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-full ${active ? c.badge : 'bg-slate-100 text-slate-500'}`}>{count}</span>
      )}
    </button>
  );
}

// ─── Table Components ─────────────────────────────────────────────────────────
function TableWrapper({ children, isDarkMode }: { children: React.ReactNode; isDarkMode: boolean }) {
  return (
    <div className={`rounded-2xl overflow-hidden shadow-sm border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
      <div className="overflow-x-auto -mx-0">
       <table className="w-full border-collapse min-w-[700px]">{children}</table>
      </div>
    </div>
  );
}
function THead({ cols, isDarkMode }: { cols: string[]; isDarkMode?: boolean }) {
  return (
    <thead>
      <tr className={isDarkMode ? 'bg-slate-700/80' : 'bg-gradient-to-l from-slate-700 to-slate-600'}>
        {cols.map((h, i) => (
          <th key={h} className={`px-4 py-3.5 text-right text-xs font-bold text-white/90 whitespace-nowrap tracking-wide uppercase
            ${i === 0 ? 'rounded-tr-2xl' : ''} ${i === cols.length - 1 ? 'rounded-tl-2xl' : ''}`}>
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}
function EmptyState({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-20 text-slate-300">
        <i className="fas fa-file-contract text-5xl block mb-3 opacity-30" />
        <span className="text-sm font-semibold text-slate-400">لا توجدعقود</span>
      </td>
    </tr>
  );
}
function LoadingState({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-20">
        <i className="fas fa-spinner fa-spin text-4xl text-cyan-400 block mb-3" />
        <span className="text-sm text-slate-400">جاري التحميل...</span>
      </td>
    </tr>
  );
}

// ─── Contract Upload Cell ─────────────────────────────────────────────────────
function ContractFileCell({ contractUrl, contractId, onUploaded, showToast }: { contractUrl?: string; contractId: string; onUploaded: () => void; showToast: (msg: string, type?: 'success'|'error'|'info') => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('الملف أكبر من 10MB', 'error'); return; }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `contracts/${contractId}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('contracts').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(path);
      const { error: updateErr } = await supabase.from('contracts').update({ contract_url: urlData.publicUrl, updated_at: new Date().toISOString() }).eq('contract_id', contractId);
      if (updateErr) throw updateErr;
      showToast('تم رفع العقد بنجاح ✓');
      onUploaded();
    } catch (err: any) { showToast('خطأ في رفع الملف: ' + (err.message || ''), 'error'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleView = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" aria-label="رفع ملف العقد" className="hidden" onChange={handleUpload} />
      {contractUrl ? (
        <div className="flex gap-1 w-full">
          <button onClick={() => handleView(contractUrl)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all border border-emerald-200">
            <i className="fas fa-eye" /> عرض
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} title="رفع عقد جديد"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-50 text-slate-500 hover:bg-slate-200 transition-all border border-slate-200">
            <i className="fas fa-arrow-up-from-bracket text-[10px]" />
          </button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 border-dashed transition-all
            ${uploading ? 'border-cyan-300 text-cyan-400 cursor-wait' : 'border-slate-200 text-slate-400 hover:border-cyan-500 hover:text-cyan-600 hover:bg-cyan-50'}`}>
          {uploading ? <><i className="fas fa-spinner fa-spin" /> جاري الرفع...</> : <><i className="fas fa-file-arrow-up" /> رفع</>}
        </button>
      )}
    </div>
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────
function StatCard({ label, val, icon, bg, color, onClick, isDarkMode, isActive, activeClass = 'bg-cyan-600 border-cyan-600 shadow shadow-cyan-200' }: { label: string; val: number; icon: string; bg: string; color: string; onClick?: () => void; isDarkMode: boolean; isActive?: boolean; activeClass?: string }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl p-4 border flex items-center gap-3.5 transition-all duration-150 cursor-pointer
        ${isActive
          ? activeClass
          : isDarkMode
            ? 'bg-slate-800/80 border-slate-700/80 hover:border-cyan-600'
            : 'bg-white border-slate-100 shadow-sm hover:border-cyan-300'}`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0 shadow-sm
        ${isActive ? 'bg-white/20 text-white' : `${bg} ${color}`}`}>
        <i className={`fas ${icon}`} />
      </div>
      <div className="min-w-0">
        <div className={`text-2xl font-black tabular-nums leading-none
          ${isActive ? 'text-white' : isDarkMode ? 'text-white' : 'text-slate-800'}`}>{val}</div>
        <div className={`text-[11px] mt-1 font-bold truncate
          ${isActive ? 'text-white/80' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</div>
      </div>
    </div>
  );
}

// ─── Modal Component ───────────────────────────────────────────────────────────
function Modal({ isOpen, onClose, title, children, size = 'md', isDarkMode = false }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; isDarkMode?: boolean }) {
  if (!isOpen) return null;
  const sizeClasses = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative rounded-2xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto border
        ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
        <div className={`sticky top-0 rounded-t-2xl border-b px-6 py-4 flex items-center justify-between z-10
          ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{title}</h3>
          <button onClick={onClose} title="إغلاق" className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors
            ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-400'}`}>
            <i className="fas fa-xmark" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Form Input ───────────────────────────────────────────────────────────────
function FormInput({ label, value, onChange, placeholder, type = 'text', required, icon, prefix, isDarkMode = false }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean; icon?: string; prefix?: string; isDarkMode?: boolean }) {
  return (
    <div className="mb-4">
      <span className={`block text-sm font-bold mb-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
        {icon && <i className={`fas ${icon} ml-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`} />}
        {label}
        {required && <span className="text-red-500 mr-1">*</span>}
      </span>
      <div className="relative">
        {prefix && <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{prefix}</span>}
        <input
          aria-label={label}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          style={{ textAlign: prefix ? 'left' : 'right', colorScheme: isDarkMode ? 'dark' : 'light' }}
          className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 outline-none transition-all text-sm ${prefix ? 'pr-10' : ''}
            ${isDarkMode
              ? 'bg-slate-700 border-slate-500 text-white placeholder-slate-400 focus:border-cyan-500 focus:ring-cyan-900/30'
              : 'border-slate-200 focus:border-cyan-500 focus:ring-cyan-200'}`}
          dir="ltr"
        />
      </div>
    </div>
  );
}

// ─── Form Select ─────────────────────────────────────────────────────────────
function FormSelect({ label, value, onChange, options, required, icon, placeholder, isDarkMode = false }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; required?: boolean; icon?: string; placeholder?: string; isDarkMode?: boolean }) {
  return (
    <div className="mb-4">
      <label className={`block text-sm font-bold mb-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
        {icon && <i className={`fas ${icon} ml-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`} />}
        {label}
        {required && <span className="text-red-500 mr-1">*</span>}
      </label>
      <select
        aria-label={label}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 outline-none transition-all text-sm
          ${isDarkMode
            ? 'bg-slate-700 border-slate-500 text-white focus:border-cyan-500 focus:ring-cyan-900/30'
            : 'bg-white border-slate-200 focus:border-cyan-500 focus:ring-cyan-200'}`}
      >
        <option value="">{placeholder || 'اختر...'}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Form Textarea ────────────────────────────────────────────────────────────
function FormTextarea({ label, value, onChange, placeholder, rows = 3, isDarkMode = false }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; isDarkMode?: boolean }) {
  return (
    <div className="mb-4">
      <label className={`block text-sm font-bold mb-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 outline-none transition-all text-sm resize-none
          ${isDarkMode
            ? 'bg-slate-700 border-slate-500 text-white placeholder-slate-400 focus:border-cyan-500 focus:ring-cyan-900/30'
            : 'border-slate-200 focus:border-cyan-500 focus:ring-cyan-200'}`}
        dir="rtl"
      />
    </div>
  );
}

// ─── Default Financial Tiers (خارج الكمبوننت — مشتركة) ──────────────────────
const DEFAULT_TIERS = {
  fee_tier1_label: 'أكثر من 100,000 مئة ألف ريال',
  fee_tier1_value: '17,000 ألف عن كل 100 ألف ريال',
  fee_tier2_label: 'أقل من 100,000 مئة ألف ريال',
  fee_tier2_value: '8,500 ألف من 60 ألف وأعلى',
  fee_tier3_label: 'يساوي أو أقل من 50,000 ألف ريال',
  fee_tier3_value: '4,250 ألف عن كل 10 ألف ريال',
};

// ─── Main Contracts Page ─────────────────────────────────────────────────────
export default function Contracts() {
  const navigate = useNavigate();
  const { user, isAdmin, isEmployee, loading: authLoading, profileLoading } = useAuth();
  const { isDarkMode: dm, toggleDarkMode } = useDarkMode();
  const [, startTransition] = useTransition();

  // ── State ─────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<{service_id: string; service_name: string; icon?: string; category?: string}[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // ── Modal State ───────────────────────────────────────────────────────────
  const [modals, setModals] = useState({
    addContract: false,
    editContract: false,
    changeStatus: false,
    viewContract: false,
    contractPreview: false
  });
  const [currentContractId, setCurrentContractId] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  // ── Form State ────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    client_name: '',
    client_phone: '',
    service_name: '',
    employee_id: '',
    contract_type: 'تطوع',
    contract_details: '',
    financial_amount: '',
    financial_notes: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    contract_status: 'draft',
    client_logo_url: '',
    client_rep: '',
    awn_package: '',
    ...DEFAULT_TIERS,
  });
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: (() => void) | null }>({ open: false, title: '', message: '', onConfirm: null });
  const askConfirm = (title: string, message: string, onConfirm: () => void) => { setConfirmModal({ open: true, title, message, onConfirm }); };
  const [logoUploading, setLogoUploading] = useState(false);
  const [clauses, setClauses] = useState<Clause[]>([]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    pending_signature: 0,
    approved: 0,
    completed: 0,
    cancelled: 0,
  });

  // ── Toast ────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);
  const removeToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // ── Load Data ────────────────────────────────────────────────────────────
  const loadContracts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          contract_id,
          contract_number,
          client_name,
          client_phone,
          service_name,
          employee_id,
          employee_name,
          contract_status,
          status_reason,
          contract_url,
          financial_amount,
          financial_notes,
          created_at,
          updated_at,
          signed_at,
          created_by,
          contract_type,
          contract_details,
          start_date,
          end_date,
          employee:employee_id(employee_name, employee_phone)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // تحديث التاريخ حسب الحالة
      const updatedData = (data || []).map((c: any) => {
        if (c.contract_status === 'completed' && c.signed_at) {
          return { ...c, updated_at: c.signed_at };
        }
        return c;
      });

      setContracts(updatedData as Contract[]);

      // حساب الإحصائيات
      const newStats = {
        total: updatedData.length,
        draft: updatedData.filter((c: Contract) => c.contract_status === 'draft').length,
        pending_signature: updatedData.filter((c: Contract) => c.contract_status === 'pending_signature').length,
        approved: updatedData.filter((c: Contract) => c.contract_status === 'approved').length,
        completed: updatedData.filter((c: Contract) => c.contract_status === 'completed').length,
        cancelled: updatedData.filter((c: Contract) => c.contract_status === 'cancelled').length,
      };
      setStats(newStats);
    } catch (err: any) {
      console.error('Load contracts error:', err);
      showToast('خطأ في تحميل العقود', 'error');
    }
  }, [showToast]);

  const loadEmployees = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('employee_id, employee_name, is_active')
        .eq('is_active', true)
        .order('employee_name', { ascending: true });
      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error('Load employees error:', err);
    }
  }, []);

  const loadServices = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('services')
        .select('service_id, service_name, icon, category')
        .eq('is_active', true)
        .order('service_name', { ascending: true });
      setServices(data || []);
    } catch (err) {
      console.error('Load services error:', err);
    }
  }, []);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user) { navigate('/'); return; }
    if (!isAdmin && !isEmployee) {
      showToast('غير مصرح لك بالوصول لهذه الصفحة', 'error');
      setTimeout(() => navigate('/'), 2000);
      return;
    }

    const init = async () => {
      await Promise.all([loadContracts(), loadEmployees(), loadServices()]);
      // جلب employee_id للموظف الحالي
      if (isEmployee && !isAdmin && user?.id) {
        const { data: empData } = await supabase
          .from("employees")
          .select("employee_id")
          .eq("auth_id", user.id)
          .single();
        if (empData) setCurrentEmployeeId(empData.employee_id);
      }
      setLoading(false);
    };
    init();
  }, [authLoading, profileLoading, user, isAdmin, isEmployee, navigate, showToast, loadContracts, loadEmployees, loadServices]);

  // ── Filtered Data ─────────────────────────────────────────────────────────
  const filteredContracts = contracts.filter(c => {
    if (statusFilter && c.contract_status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.client_name?.toLowerCase().includes(q) ||
      c.employee_name?.toLowerCase().includes(q) ||
      c.service_name?.toLowerCase().includes(q) ||
      c.contract_number?.toLowerCase().includes(q) ||
      c.contract_type?.toLowerCase().includes(q)
    );
  });

  const handleSearch = useCallback((query: string) => {
    startTransition(() => setSearchQuery(query));
  }, []);

  // ── Form Handlers ─────────────────────────────────────────────────────────
  // ── بناء البنود الافتراضية حسب نوع العقد ────────────────────────────────
  const buildClauses = (contractType: string, tiers: typeof DEFAULT_TIERS): Clause[] => {
    const uid = () => Math.random().toString(36).slice(2, 9);
    const isAwn = contractType !== 'تطوع';

    return [
      {
        id: uid(), enabled: true,
        title: 'المادة (1) تعريف المصطلحات',
        text: 'الدعم: الدعم الاستشاري والإداري والفني والتوجيهي.\nوثيقة المشروع: ملف يتضمن تحليل، خطة، مؤشرات أداء، واحتياج تدريبي.\nالمنحة: مبلغ مالي يُمنح من صندوق دعم الجمعيات، بهدف تحسين كفاءة الجهة وزيادة الفرص في الدعم والتمويل.\nطلب المنح من صندوق دعم الجمعيات: طلب يُقدَّم للحصول على منحة مالية مخصصة لدعم الجمعيات والمشاريع النوعية، ويعتمد على موافقة الصندوق لهذا الطلب.',
      },
      {
        id: uid(), enabled: true,
        title: 'المادة (2) موضوع العقد',
        text: isAwn
          ? 'يتعهد مقدم الخدمة بتقديم الخدمات التالية:\n1. تقديم طلب منحة البرامج والمشاريع من صندوق دعم الجمعيات باسم الجهة المستفيدة.\n2. تقديم الدعم الاستشاري والإداري والفني والتوجيهي.\n3. متابعة الإجراءات اللازمة لصرف المنح.\n4. تسليم التقارير والمتطلبات النهائية من الجهة المستفيدة وإغلاقها.'
          : 'يتعهد مقدم الخدمة بتقديم الخدمات التالية:\n1. مراجعة جاهزية الجهة المستفيدة.\n2. تجهيز المستندات المطلوبة مع الجهة المستفيدة.\n3. تحسين الملف التعريفي والبيانات اللازمة.\n4. رفع طلب المنحة تطوع للمحترفين باسم الجهة المستفيدة.\n5. المتابعة الإدارية حتى يتم رد على المنحة المرفوعة.',
      },
      {
        id: uid(), enabled: true,
        title: 'المادة (3) مدة العقد',
        text: 'تبدأ مدة هذا العقد من تاريخ توقيعه، إلى نهاية تقديم فترات المنح المقدمة من الصندوق، قابلة للتمديد باتفاق خطي بين الطرفين، ولا يعتبر العقد منتهياً إلا بعد استكمال كامل مراحل التنفيذ.',
      },
      {
        id: uid(), enabled: true,
        title: 'المادة (4) التزامات مقدم الخدمة',
        text: '1. تنفيذ كافة الأعمال المنصوص عليها باحترافية وفق موضوع العقد.\n2. تقديم الدعم الاستشاري والإداري والفني والتوجيهي والمتابعة المستمرة.\n3. الحفاظ التام على سرية كافة المعلومات والمستندات.\n4. إغلاق المنحة فنياً وإدارياً ومالياً بالصندوق.',
      },
      {
        id: uid(), enabled: true,
        title: 'المادة (5) التزامات الجهة المستفيدة',
        text: isAwn
          ? '1. تزويد مقدم الخدمة بكافة المعلومات والمستندات المطلوبة.\n2. تمكين مقدم الخدمة من استخدام حساب منصة صندوق دعم الجمعيات.\n3. التعاون الكامل خلال مراحل المنحة.\n4. الالتزام بسداد الأتعاب بعد صرف المنحة.'
          : '1. يلتزم بتحديد واعتماد ثلاثة تحديات أساسية مرتبطة بالمشروع، على أن يتم توثيقها رسمياً ضمن محضر اجتماع مجلس الإدارة.\n2. تزويد مقدم الخدمة بكافة المعلومات والمستندات المطلوبة.\n3. تمكين مقدم الخدمة من استخدام حساب منصة صندوق دعم الجمعيات.\n4. التعاون السريع في الردود والتواقيع والاعتمادات.\n5. الالتزام بسداد الأتعاب بعد صرف المنحة.',
      },
      {
        id: uid(), enabled: true, isTable: true,
        title: 'المادة (6) القابل المالي وآلية الدفع',
        text: tiers.fee_tier1_label + '|' + tiers.fee_tier1_value + '\n' +
              tiers.fee_tier2_label + '|' + tiers.fee_tier2_value + '\n' +
              tiers.fee_tier3_label + '|' + tiers.fee_tier3_value,
      },
      {
        id: uid(), enabled: true,
        title: 'المادة (7) السرية والملكية الفكرية',
        text: '1. يلتزم الطرفان بالحفاظ على سرية المعلومات المتبادلة.\n2. تعود ملكية النماذج والأدوات المستخدمة لمقدم الخدمة، ولا يجوز إعادة استخدامها أو نشرها دون إذنه.',
      },
      {
        id: uid(), enabled: true,
        title: 'المادة (8) تسوية النزاعات',
        text: '1. تُحل النزاعات ودياً خلال شهر من تاريخ نشوئها.\n2. إن تعذر ذلك، يُحال النزاع للتحكيم أو المحكمة المختصة في المملكة العربية السعودية – الطائف.',
      },
      {
        id: uid(), enabled: true,
        title: 'المادة (9) طرق التواصل',
        text: 'يقر الطرفان بأن وسيلة التواصل الرسمية والمعتمدة بينهما لأغراض هذا العقد هي عبر الوسائل التالية:\nالبريد الإلكتروني: info@almosaadah.sa (الطرف الأول)\nرقم الهاتف: 0591700131 / 0580171160 (الطرف الأول)',
      },
      {
        id: uid(), enabled: true,
        title: 'المادة (10) أحكام عامة',
        text: '1. لا يلتزم الطرف الأول بتقديم أي دعم مالي خاص بناءً على هذا العقد، ويفسر عمله على تقديم الدعم الاستشاري والإداري والفني والتوجيهي فقط.\n2. يمثل العقد الاتفاق الكامل ويلغي أي تفاهمات سابقة.\n3. لا يجوز التنازل عن الحقوق والالتزامات إلا بموافقة خطية.\n4. يُحرر من نسختين أصليتين، بيد كل طرف نسخة.',
      },
    ];
  };

  const openAddModal = () => {
    const defaultTiers = { ...DEFAULT_TIERS };
    setFormData({
      client_name: '',
      client_phone: '',
      service_name: '',
      employee_id: '',
      contract_type: 'تطوع',
      contract_details: '',
      financial_amount: '',
      financial_notes: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      client_rep: '',
      contract_status: 'draft',
      client_logo_url: '',
      awn_package: '',
      ...defaultTiers,
    });
    setClauses(buildClauses('تطوع', defaultTiers));
    setModals(m => ({ ...m, addContract: true }));
  };

  // ── Logo Upload from Supabase Storage ──────────────────────────────────────
  const handleLogoUpload = useCallback(async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('يرجى رفع ملف صورة فقط', 'error'); return; }
    if (file.size > 2 * 1024 * 1024) { showToast('حجم الصورة يجب أن يكون أقل من 2MB', 'error'); return; }
    setLogoUploading(true);
    try {
      const path = `logos/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
      const { error: upErr } = await supabase.storage
        .from('contracts')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(path);
      setFormData(f => ({ ...f, client_logo_url: urlData.publicUrl }));
      showToast('تم رفع شعار الجمعية ✓');
    } catch (e: any) {
      showToast('خطأ في رفع الشعار: ' + (e.message || ''), 'error');
    } finally {
      setLogoUploading(false);
    }
  }, [showToast]);

  const openEditModal = (contract: Contract) => {
    setCurrentContractId(contract.contract_id);
    const tiers = {
      fee_tier1_label: (contract as any).fee_tier1_label || DEFAULT_TIERS.fee_tier1_label,
      fee_tier1_value: (contract as any).fee_tier1_value || DEFAULT_TIERS.fee_tier1_value,
      fee_tier2_label: (contract as any).fee_tier2_label || DEFAULT_TIERS.fee_tier2_label,
      fee_tier2_value: (contract as any).fee_tier2_value || DEFAULT_TIERS.fee_tier2_value,
      fee_tier3_label: (contract as any).fee_tier3_label || DEFAULT_TIERS.fee_tier3_label,
      fee_tier3_value: (contract as any).fee_tier3_value || DEFAULT_TIERS.fee_tier3_value,
    };
    setFormData({
      client_name: contract.client_name || '',
      client_phone: contract.client_phone || '',
      service_name: contract.service_name || '',
      employee_id: contract.employee_id || '',
      contract_type: contract.contract_type || 'تطوع',
      contract_details: contract.contract_details || '',
      financial_amount: contract.financial_amount?.toString() || '',
      financial_notes: contract.financial_notes || '',
      start_date: contract.start_date || '',
      end_date: contract.end_date || '',
      contract_status: contract.contract_status || 'draft',
      client_logo_url: (contract as any).client_logo_url || '',
      client_rep: contract.client_rep || '',
      awn_package: (contract as any).awn_package || '',
      ...tiers,
    });
    setClauses(buildClauses(contract.contract_type || 'تطوع', tiers));
    setModals(m => ({ ...m, editContract: true }));
  };

  const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const openStatusModal = (contractId: string, currentStatus: string) => {
    setOpenStatusDropdown(prev => prev === contractId ? null : contractId);
  };

  // إغلاق الـ dropdown عند الضغط خارجه
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setOpenStatusDropdown(null);
      }
    };
    if (openStatusDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openStatusDropdown]);

  const handleInlineStatusChange = async (contractId: string, newSt: string) => {
    setOpenStatusDropdown(null);
    const updateData: any = { contract_status: newSt, updated_at: new Date().toISOString() };
    if (newSt === 'completed') updateData.signed_at = new Date().toISOString();
    const { error } = await supabase.from('contracts').update(updateData).eq('contract_id', contractId);
    if (error) { showToast('خطأ في تحديث الحالة', 'error'); }
    else { showToast('تم تحديث الحالة ✓'); loadContracts(); }
  };

  const handleContractFileClick = (url: string) => {
    setPreviewUrl(url);
    setModals(m => ({ ...m, contractPreview: true }));
  };

  // ── CRUD Operations ───────────────────────────────────────────────────────
  const handleCreateContract = async () => {
    if (!formData.client_name || !formData.employee_id) {
      showToast('يرجى تعبئة الحقول المطلوبة *', 'error');
      return;
    }
    if (formData.client_phone && formData.client_phone.length !== 10) {
      showToast('رقم الجوال يجب أن يكون 10 أرقام بالضبط', 'error');
      return;
    }

    setFormLoading(true);
    try {
      // توليد رقم العقد
      const contractNumber = `CTR-${Date.now()}`;

      const employee = employees.find(e => e.employee_id === formData.employee_id);

      const { error } = await supabase.from('contracts').insert([{
        contract_number: contractNumber,
        client_name: formData.client_name,
        client_phone: formData.client_phone || null,
        service_name: formData.service_name || null,
        employee_id: formData.employee_id,
        employee_name: employee?.employee_name || null,
        contract_type: formData.contract_type || null,
        contract_details: formData.contract_details || null,
        financial_amount: formData.financial_amount ? parseFloat(formData.financial_amount) : null,
        financial_notes: formData.financial_notes || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        contract_status: 'draft',
        created_by: user?.id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]);

      if (error) throw error;

      setModals(m => ({ ...m, addContract: false }));
      showToast('تم إنشاء العقد بنجاح ✓');
      loadContracts();
    } catch (err: any) {
      showToast('خطأ في إنشاء العقد: ' + (err.message || ''), 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateContract = async () => {
    if (!formData.client_name || !formData.employee_id) {
      showToast('يرجى تعبئة الحقول المطلوبة *', 'error');
      return;
    }
    if (formData.client_phone && formData.client_phone.length !== 10) {
      showToast('رقم الجوال يجب أن يكون 10 أرقام بالضبط', 'error');
      return;
    }

    setFormLoading(true);
    try {
      const employee = employees.find(e => e.employee_id === formData.employee_id);

      const updatePayload: any = {
        client_name: formData.client_name,
        client_phone: formData.client_phone || null,
        service_name: formData.service_name || null,
        employee_id: formData.employee_id,
        employee_name: employee?.employee_name || null,
        contract_type: formData.contract_type || null,
        contract_details: formData.contract_details || null,
        financial_amount: formData.financial_amount ? parseFloat(formData.financial_amount) : null,
        financial_notes: formData.financial_notes || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        contract_status: formData.contract_status,
        updated_at: new Date().toISOString(),
      };
      if (formData.contract_status === 'completed') {
        updatePayload.signed_at = new Date().toISOString();
      }
      const { error } = await supabase.from('contracts').update(updatePayload).eq('contract_id', currentContractId);

      if (error) throw error;

      setModals(m => ({ ...m, editContract: false }));
      showToast('تم تحديث العقد بنجاح ✓');
      loadContracts();
    } catch (err: any) {
      showToast('خطأ في تحديث العقد: ' + (err.message || ''), 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) {
      showToast('يرجى اختيار الحالة الجديدة', 'error');
      return;
    }

    setFormLoading(true);
    try {
      const updateData: any = {
        contract_status: newStatus,
        updated_at: new Date().toISOString(),
      };

      // تحديث تاريخ التوقيع إذا تم التوقيع
      if (newStatus === 'completed') {
        updateData.signed_at = new Date().toISOString();
      }

      if (statusReason) {
        updateData.status_reason = statusReason;
      }

      const { error } = await supabase.from('contracts').update(updateData).eq('contract_id', currentContractId);
      if (error) throw error;

      setModals(m => ({ ...m, changeStatus: false }));
      showToast('تم تحديث حالة العقد بنجاح ✓');
      loadContracts();
    } catch (err: any) {
      showToast('خطأ في تحديث الحالة: ' + (err.message || ''), 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteContract = (contractId: string) => {
    const contract = contracts.find(c => c.contract_id === contractId);
    const clientName = contract?.client_name || 'هذا العقد';
    askConfirm('حذف العقد', `سيتم حذف عقد "${clientName}" نهائياً ولا يمكن التراجع.`, async () => {
      try {
        const { error } = await supabase
          .from('contracts')
          .delete()
          .eq('contract_id', contractId)
          .select('contract_id');

        if (error) {
          if (error.message?.includes('permission denied') || error.code === '42501') {
            showToast('لا تملك صلاحية الحذف — راجع إعدادات RLS في Supabase', 'error');
          } else {
            showToast('خطأ في حذف العقد: ' + (error.message || ''), 'error');
          }
          return;
        }
        showToast('تم حذف العقد بنجاح ✓');
        loadContracts();
      } catch (err: any) {
        showToast('خطأ في حذف العقد: ' + (err.message || ''), 'error');
      }
    });
  };

  // ── Loading Screen ────────────────────────────────────────────────────────
  if (authLoading || profileLoading || loading) {
    return (
      <div className={`fixed inset-0 flex flex-col items-center justify-center z-[9999] ${dm ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 to-cyan-50'}`}>
        <div className="relative">
          <i className={`fas fa-spinner fa-spin text-6xl mb-4 ${dm ? 'text-cyan-400' : 'text-cyan-500'}`} />
          <div className="absolute inset-0 animate-ping rounded-full bg-cyan-400 opacity-20" />
        </div>
        <p className={`font-semibold animate-pulse mt-4 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>جاري تحميل إدارة العقود...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${dm ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-50'}`} dir="rtl">
      <style>{`
@keyframes confirm-pop {
  from { opacity:0; transform:scale(0.82) translateY(24px); }
  to   { opacity:1; transform:scale(1) translateY(0); }
}
@keyframes confirm-ring {
  0%   { transform:scale(1); opacity:0.7; }
  100% { transform:scale(1.7); opacity:0; }
}
@keyframes confirm-icon-in {
  from { opacity:0; transform:scale(0.3) rotate(-20deg); }
  to   { opacity:1; transform:scale(1) rotate(0deg); }
}
.confirm-overlay {
  position:fixed; inset:0; z-index:9999999;
  display:flex; align-items:center; justify-content:center; padding:20px;
  background:rgba(8,18,40,0.78);
  backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
  font-family:'Tajawal',sans-serif; direction:rtl;
}
.confirm-card {
  position:relative; overflow:hidden; width:90%; max-width:400px;
  background:linear-gradient(155deg,#0c1e35 0%,#0a2240 60%,#081828 100%);
  border:1.5px solid rgba(239,68,68,0.35); border-radius:28px;
  padding:40px 32px 32px; text-align:center;
  box-shadow:0 32px 80px rgba(239,68,68,0.2),0 0 0 1px rgba(239,68,68,0.1);
  animation:confirm-pop 0.45s cubic-bezier(.34,1.56,.64,1) both;
}
.confirm-deco1{position:absolute;top:-60px;right:-60px;width:200px;height:200px;border-radius:50%;background:rgba(239,68,68,0.06);pointer-events:none;}
.confirm-deco2{position:absolute;bottom:-40px;left:-40px;width:150px;height:150px;border-radius:50%;background:rgba(239,68,68,0.04);pointer-events:none;}
.confirm-icon-wrap{position:relative;margin:0 auto 22px;width:80px;height:80px;}
.confirm-ring{position:absolute;inset:-8px;border-radius:50%;border:2px solid rgba(239,68,68,0.4);animation:confirm-ring 1.6s ease-out 0.3s infinite;}
.confirm-icon-circle{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);display:flex;align-items:center;justify-content:center;box-shadow:0 12px 36px rgba(239,68,68,0.45);animation:confirm-icon-in 0.45s 0.2s cubic-bezier(.34,1.56,.64,1) both;font-size:30px;}
.confirm-title{margin:0 0 10px;font-size:20px;font-weight:900;color:#fef2f2;letter-spacing:-0.3px;}
.confirm-sub{margin:0 0 26px;font-size:13px;font-weight:600;line-height:1.8;color:rgba(252,165,165,0.85);}
.confirm-btns{display:flex;gap:10px;justify-content:center;}
.confirm-cancel{flex:1;padding:11px;border-radius:14px;border:1.5px solid rgba(148,163,184,0.25);background:rgba(148,163,184,0.08);color:#94a3b8;font-family:'Tajawal',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all .18s;}
.confirm-cancel:hover{background:rgba(148,163,184,0.15);color:#cbd5e1;}
.confirm-ok{flex:1;padding:11px;border-radius:14px;border:none;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-family:'Tajawal',sans-serif;font-size:14px;font-weight:800;cursor:pointer;transition:all .18s;box-shadow:0 6px 20px rgba(239,68,68,0.35);}
.confirm-ok:hover{background:linear-gradient(135deg,#f87171,#ef4444);box-shadow:0 8px 28px rgba(239,68,68,0.5);transform:translateY(-1px);}
`}</style>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── الهيدر الرئيسي ── */}
      <Header
        onLoginClick={() => {}}
        onRegisterClick={() => {}}
        onSignOut={async () => navigate('/')}
        isAdmin={isAdmin}
        isEmployee={isEmployee}
        user={user}
        isDarkMode={dm}
        onToggleDarkMode={toggleDarkMode}
      />

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-28">
        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard label="إجمالي العقود" val={stats.total} icon="fa-file-contract" bg="bg-slate-100" color="text-slate-600" isDarkMode={dm}
            onClick={() => setStatusFilter(null)} isActive={statusFilter === null}
            activeClass="bg-cyan-600 border-cyan-600 shadow shadow-cyan-200" />
          <StatCard label="مسودة" val={stats.draft} icon="fa-file-pen" bg="bg-slate-100" color="text-slate-500" isDarkMode={dm}
            onClick={() => setStatusFilter(f => f === 'draft' ? null : 'draft')} isActive={statusFilter === 'draft'}
            activeClass="bg-slate-700 border-slate-700 shadow" />
          <StatCard label="بانتظار التوقيع" val={stats.pending_signature} icon="fa-clock" bg="bg-amber-100" color="text-amber-600" isDarkMode={dm}
            onClick={() => setStatusFilter(f => f === 'pending_signature' ? null : 'pending_signature')} isActive={statusFilter === 'pending_signature'}
            activeClass="bg-amber-500 border-amber-500 shadow shadow-amber-200" />
          <StatCard label="معتمد" val={stats.approved} icon="fa-check" bg="bg-emerald-100" color="text-emerald-600" isDarkMode={dm}
            onClick={() => setStatusFilter(f => f === 'approved' ? null : 'approved')} isActive={statusFilter === 'approved'}
            activeClass="bg-emerald-600 border-emerald-600 shadow shadow-emerald-200" />
          <StatCard label="مكتمل" val={stats.completed} icon="fa-flag-checkered" bg="bg-emerald-100" color="text-emerald-700" isDarkMode={dm}
            onClick={() => setStatusFilter(f => f === 'completed' ? null : 'completed')} isActive={statusFilter === 'completed'}
            activeClass="bg-emerald-700 border-emerald-700 shadow shadow-emerald-200" />
          <StatCard label="ملغى" val={stats.cancelled} icon="fa-ban" bg="bg-red-100" color="text-red-500" isDarkMode={dm}
            onClick={() => setStatusFilter(f => f === 'cancelled' ? null : 'cancelled')} isActive={statusFilter === 'cancelled'}
            activeClass="bg-red-500 border-red-500 shadow shadow-red-200" />
        </div>

        {/* ── Search & Filter ── */}
        <div className={`rounded-2xl p-4 border mb-6 ${dm ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-100 shadow-sm'}`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <i className="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                <input
                  type="text"
                  aria-label="بحث في العقود"
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="ابحث باسم العميل أو الموظف أو الخدمة..."
                  className={`w-full pr-10 pl-4 py-2.5 rounded-xl border text-sm outline-none transition-all
                    ${dm ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-cyan-500' : 'border-slate-200 focus:border-cyan-500'}`}
                  dir="rtl"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Active Filter Badge ── */}
        {statusFilter && (
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${dm ? 'bg-cyan-900/30 text-cyan-300 border-cyan-700' : 'bg-cyan-50 text-cyan-700 border-cyan-200'}`}>
              <i className="fas fa-filter text-[10px]" />
              فلتر نشط: {CONTRACT_STATUS_MAP[statusFilter]?.text || statusFilter}
              <button onClick={() => setStatusFilter(null)} title="إزالة الفلتر" className="hover:text-red-500 transition-colors mr-1">
                <i className="fas fa-xmark text-[11px]" />
              </button>
            </span>
            <span className={`text-xs ${dm ? 'text-slate-400' : 'text-slate-400'}`}>{filteredContracts.length} عقد</span>
          </div>
        )}

        {/* ── Table ── */}
        <div className={`rounded-2xl overflow-hidden shadow-sm border ${dm ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr className={dm ? 'bg-slate-700/80' : 'bg-gradient-to-l from-slate-700 to-slate-600'}>
                  <th className="px-4 py-3.5 text-right text-xs font-bold text-white/90 rounded-tr-2xl">العقد</th>
                  <th className="px-4 py-3.5 text-right text-xs font-bold text-white/90">العميل</th>
                  <th className="px-4 py-3.5 text-right text-xs font-bold text-white/90">رقم الجوال</th>
                  <th className="px-4 py-3.5 text-right text-xs font-bold text-white/90">الخدمة</th>
                  <th className="px-4 py-3.5 text-right text-xs font-bold text-white/90">الموظف</th>
                  <th className="px-4 py-3.5 text-right text-xs font-bold text-white/90">الحالة</th>
                  <th className="px-4 py-3.5 text-right text-xs font-bold text-white/90">التاريخ</th>
                  <th className="px-4 py-3.5 text-right text-xs font-bold text-white/90 rounded-tl-2xl">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-20">
                      <i className="fas fa-file-contract text-5xl block mb-3 opacity-30 text-slate-300" />
                      <span className="text-sm font-semibold text-slate-400">لا توجد عقود</span>
                    </td>
                  </tr>
                ) : (
                  filteredContracts.map((contract, idx) => {
                    const typeInfo = CONTRACT_TYPE_MAP[contract.contract_type || ''] || CONTRACT_TYPE_MAP['default'];
                    return (
                      <tr key={contract.contract_id} className={`border-b transition-colors ${dm ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-100 hover:bg-slate-50/80'}`}>
                        {/* ملف العقد — زر توليد PDF */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              const empName = contract.employee_name || contract.employee?.employee_name || '';
                              generateContractPDF({
                                contract_number: contract.contract_number || `CTR-${contract.contract_id?.slice(0,8).toUpperCase()}`,
                                client_name: contract.client_name,
                                client_phone: contract.client_phone || '',
                                service_name: contract.service_name || '',
                                contract_type: contract.contract_type || 'تطوع',
                                contract_details: contract.contract_details || '',
                                employee_name: empName,
                                financial_amount: contract.financial_amount?.toString() || '',
                                financial_notes: contract.financial_notes || '',
                                start_date: contract.start_date || '',
                                end_date: contract.end_date || '',
                                fee_tier1_label: (contract as any).fee_tier1_label || DEFAULT_TIERS.fee_tier1_label,
                                fee_tier1_value: (contract as any).fee_tier1_value || DEFAULT_TIERS.fee_tier1_value,
                                fee_tier2_label: (contract as any).fee_tier2_label || DEFAULT_TIERS.fee_tier2_label,
                                fee_tier2_value: (contract as any).fee_tier2_value || DEFAULT_TIERS.fee_tier2_value,
                                fee_tier3_label: (contract as any).fee_tier3_label || DEFAULT_TIERS.fee_tier3_label,
                                fee_tier3_value: (contract as any).fee_tier3_value || DEFAULT_TIERS.fee_tier3_value,
                                client_logo_url: (contract as any).client_logo_url || '',
                                awn_package: (contract as any).awn_package || '',
                                clauses: (contract as any).clauses || [],
                              });
                            }}
                            title="توليد وطباعة ملف العقد"
                            className={`w-9 h-9 flex items-center justify-center rounded-xl border-2 transition-all group
                              ${dm
                                ? 'bg-slate-700 border-slate-600 text-cyan-400 hover:bg-cyan-900/40 hover:border-cyan-500'
                                : 'bg-cyan-50 border-cyan-200 text-cyan-600 hover:bg-cyan-600 hover:text-white hover:border-cyan-600 hover:shadow-md hover:shadow-cyan-200/60'}`}
                          >
                            <i className="fas fa-file-alt text-sm" />
                          </button>
                        </td>
                        {/* العميل */}
                        <td className="px-4 py-3">
                          <div className={`font-bold text-sm ${dm ? 'text-white' : 'text-slate-800'}`}>
                            {contract.client_name || '-'}
                          </div>
                          {contract.user?.user_email && (
                            <div className={`text-xs ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                              {contract.user.user_email}
                            </div>
                          )}
                        </td>
                        {/* رقم الجوال */}
                        <td className="px-4 py-3">
                          <span className={`text-sm font-mono ${dm ? 'text-slate-300' : 'text-slate-600'}`}>
                            {contract.client_phone || '-'}
                          </span>
                        </td>
                        {/* الخدمة */}
                        <td className="px-4 py-3">
                          <span className={`text-sm ${dm ? 'text-slate-300' : 'text-slate-600'}`}>
                            {contract.service_name || '-'}
                          </span>
                        </td>
                        {/* الموظف */}
                        <td className="px-4 py-3">
                          <div className={`text-sm font-medium ${dm ? 'text-slate-300' : 'text-slate-700'}`}>
                            {contract.employee_name || contract.employee?.employee_name || '-'}
                          </div>
                          {contract.employee?.employee_phone && (
                            <div className="text-xs text-slate-500 font-mono">{contract.employee.employee_phone}</div>
                          )}
                        </td>
                        {/* الحالة */}
                        <td className="px-4 py-3">
                          {(() => {
                            const sc = CONTRACT_STATUS_MAP[contract.contract_status] || CONTRACT_STATUS_MAP['draft'];
                            const pillDm: Record<string, string> = {
                              draft:               'bg-slate-700/60 text-slate-300 border-slate-600',
                              pending_signature:   'bg-amber-900/30 text-amber-400 border-amber-700',
                              pending_admin_review:'bg-orange-900/30 text-orange-400 border-orange-700',
                              approved:            'bg-emerald-900/30 text-emerald-400 border-emerald-700',
                              completed:           'bg-emerald-900/40 text-emerald-300 border-emerald-600',
                              cancelled:           'bg-red-900/30 text-red-400 border-red-700',
                              expired:             'bg-gray-700/60 text-gray-400 border-gray-600',
                            };
                            const dotColor: Record<string, string> = {
                              draft: 'bg-slate-400', pending_signature: 'bg-amber-400',
                              pending_admin_review: 'bg-orange-400', approved: 'bg-emerald-500',
                              completed: 'bg-emerald-500', cancelled: 'bg-red-400', expired: 'bg-gray-400',
                            };
                            const dot = dotColor[contract.contract_status] || 'bg-slate-400';
                            const pillClass = dm
                              ? (pillDm[contract.contract_status] || 'bg-slate-700/60 text-slate-300 border-slate-600')
                              : sc.colors;
                            const isOpen = openStatusDropdown === contract.contract_id;

                            const isMyContract = isEmployee && !isAdmin && currentEmployeeId && contract.employee_id === currentEmployeeId;
                            if (isAdmin || isMyContract) {
                              return (
                                <div className="relative" ref={isOpen ? statusDropdownRef : undefined}>
                                  <button
                                    onClick={() => openStatusModal(contract.contract_id, contract.contract_status)}
                                    title="اضغط لتغيير الحالة"
                                    className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all hover:scale-105 hover:shadow-md cursor-pointer ${pillClass}`}
                                  >
                                    <span className="relative flex-shrink-0 w-2 h-2">
                                      <span className={`absolute inset-0 rounded-full ${dot} animate-ping opacity-60`} />
                                      <span className={`relative block w-2 h-2 rounded-full ${dot}`} />
                                    </span>
                                    <i className={`fas ${sc.icon} text-[10px]`} />
                                    {sc.text}
                                    <i className={`fas fa-chevron-down text-[8px] mr-0.5 transition-transform ${isOpen ? 'rotate-180 opacity-100' : 'opacity-40 group-hover:opacity-100'}`} />
                                  </button>
                                  {isOpen && (
                                    <div className={`absolute top-full mt-1.5 right-0 z-50 min-w-[160px] rounded-xl shadow-xl border overflow-hidden
                                      ${dm ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
                                      {Object.entries(CONTRACT_STATUS_MAP).map(([key, cfg]) => {
                                        const isSelected = contract.contract_status === key;
                                        const itemDotColors: Record<string, string> = {
                                          draft: 'bg-slate-400', pending_signature: 'bg-amber-400',
                                          pending_admin_review: 'bg-orange-400', approved: 'bg-emerald-500',
                                          completed: 'bg-emerald-500', cancelled: 'bg-red-400', expired: 'bg-gray-400',
                                        };
                                        return (
                                          <button
                                            key={key}
                                            onClick={() => handleInlineStatusChange(contract.contract_id, key)}
                                            className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold transition-colors text-right
                                              ${isSelected
                                                ? (dm ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-800')
                                                : (dm ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-50')}`}
                                          >
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${itemDotColors[key] || 'bg-slate-400'}`} />
                                            <i className={`fas ${cfg.icon} text-[10px] flex-shrink-0`} />
                                            {cfg.text}
                                            {isSelected && <i className="fas fa-check text-[10px] mr-auto text-emerald-500" />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${pillClass}`}>
                                <span className="relative flex-shrink-0 w-2 h-2">
                                  <span className={`absolute inset-0 rounded-full ${dot} animate-ping opacity-60`} />
                                  <span className={`relative block w-2 h-2 rounded-full ${dot}`} />
                                </span>
                                <i className={`fas ${sc.icon} text-[10px]`} />
                                {sc.text}
                              </span>
                            );
                          })()}
                        </td>
                        {/* التاريخ */}
                        <td className="px-4 py-3">
                          <div className={`text-xs ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                            {contract.updated_at ? new Date(contract.updated_at).toLocaleDateString('ar-SA') : '-'}
                          </div>
                          {contract.start_date && (
                            <div className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
                              من: {new Date(contract.start_date).toLocaleDateString('ar-SA')}
                            </div>
                          )}
                        </td>
                        {/* إجراءات */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {/* زر تعديل — أدمن فقط */}
                            {isAdmin && (
                              <button
                                onClick={() => openEditModal(contract)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white border-sky-200"
                              >
                                <i className="fas fa-pen text-[10px]" /> تعديل
                              </button>
                            )}
                            {/* زر إنشاء PDF — للجميع */}
                            <button
                              onClick={() => {
                                generateContractPDF({
                                  contract_number: contract.contract_number || `CTR-${contract.contract_id.slice(0,8)}`,
                                  client_name: contract.client_name,
                                  client_phone: contract.client_phone || '',
                                  service_name: contract.service_name || '',
                                  contract_type: contract.contract_type || 'تطوع',
                                  contract_details: contract.contract_details || '',
                                  employee_name: contract.employee_name || contract.employee?.employee_name || '',
                                  financial_amount: contract.financial_amount?.toString() || '',
                                  financial_notes: contract.financial_notes || '',
                                  start_date: contract.start_date || '',
                                  end_date: contract.end_date || '',
                                  fee_tier1_label: (contract as any).fee_tier1_label || DEFAULT_TIERS.fee_tier1_label,
                                  fee_tier1_value: (contract as any).fee_tier1_value || DEFAULT_TIERS.fee_tier1_value,
                                  fee_tier2_label: (contract as any).fee_tier2_label || DEFAULT_TIERS.fee_tier2_label,
                                  fee_tier2_value: (contract as any).fee_tier2_value || DEFAULT_TIERS.fee_tier2_value,
                                  fee_tier3_label: (contract as any).fee_tier3_label || DEFAULT_TIERS.fee_tier3_label,
                                  fee_tier3_value: (contract as any).fee_tier3_value || DEFAULT_TIERS.fee_tier3_value,
                                  client_logo_url: (contract as any).client_logo_url || '',
                                  clauses: (contract as any).clauses || [],
                                });
                                showToast('تم فتح ملف العقد — اضغط Ctrl+P لحفظه', 'info');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-50 text-cyan-600 hover:bg-cyan-600 hover:text-white transition-all border border-cyan-200"
                            >
                              <i className="fas fa-file-pdf text-[10px]" /> إنشاء PDF
                            </button>
                            {/* زر تغيير الحالة — للموظف إذا العقد مرتبط باسمه */}
                            {isEmployee && !isAdmin && currentEmployeeId && contract.employee_id === currentEmployeeId && (
                              <button
                                onClick={() => openStatusModal(contract.contract_id, contract.contract_status)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-violet-50 text-violet-600 hover:bg-violet-600 hover:text-white transition-all border border-violet-200"
                              >
                                <i className="fas fa-rotate text-[10px]" /> تغيير الحالة
                              </button>
                            )}
                            {/* زر حذف — أدمن فقط */}
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteContract(contract.contract_id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all border border-red-200"
                              >
                                <i className="fas fa-trash text-[10px]" /> حذف
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Add/Edit Contract Modal ── */}
      <Modal
        isOpen={modals.addContract || modals.editContract}
        onClose={() => setModals(m => ({ ...m, addContract: false, editContract: false }))}
        title={modals.editContract ? (isAdmin ? 'تعديل العقد' : 'عرض تفاصيل العقد') : 'إضافة عقد جديد'}
        size="xl"
        isDarkMode={dm}
      >
        <div className="space-y-5">
          {/* تنبيه للموظف */}
          {!isAdmin && modals.editContract && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <i className="fas fa-eye text-amber-500" />
              <span className="text-sm text-amber-700 font-semibold">أنت في وضع العرض فقط — التعديلات تتطلب صلاحية أدمن</span>
            </div>
          )}
          <div className={`rounded-xl p-4 border ${dm ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
            <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${dm ? 'text-slate-200' : 'text-slate-700'}`}>
              <i className={`fas fa-id-card ${dm ? 'text-slate-400' : 'text-slate-500'}`} />
              البيانات الأساسية
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormInput label="اسم العميل / الجمعية" value={formData.client_name}
                onChange={v => isAdmin && setFormData(f => ({ ...f, client_name: v }))}
                placeholder="اسم الجمعية" required isDarkMode={dm} />
              <div className="mb-4">
                <label className={`block text-sm font-bold mb-1.5 ${dm ? 'text-slate-200' : 'text-slate-700'}`}>
                  <i className={`fas fa-user-tie ml-1 ${dm ? 'text-slate-400' : 'text-slate-400'}`} />
                  ممثل الجمعية (رئيس مجلس الإدارة)
                </label>
                <input
                  type="text"
                  aria-label="ممثل الجمعية"
                  value={formData.client_rep}
                  readOnly={!isAdmin}
                  onChange={e => isAdmin && setFormData(f => ({ ...f, client_rep: e.target.value }))}
                  placeholder="اسم الممثل..."
                  dir="rtl"
                  className={`w-full px-4 py-2.5 rounded-xl border transition-all text-sm outline-none
                    ${!isAdmin
                      ? dm ? 'bg-slate-600 border-slate-500 text-slate-300 cursor-default' : 'bg-slate-50 border-slate-100 text-slate-500 cursor-default'
                      : dm ? 'bg-slate-700 border-slate-500 text-white placeholder-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-900'
                        : 'border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200'}`}
                />
              </div>
              {/* ── رقم الجوال — أرقام فقط، 10 خانات ── */}
              <div className="mb-4">
                <label className={`block text-sm font-bold mb-1.5 ${dm ? 'text-slate-200' : 'text-slate-700'}`}>
                  <i className={`fas fa-phone ml-1 ${dm ? 'text-slate-400' : 'text-slate-400'}`} />
                  رقم الجوال
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    aria-label="رقم الهاتف"
                    inputMode="numeric"
                    value={formData.client_phone}
                    maxLength={10}
                    readOnly={!isAdmin}
                    onChange={e => {
                      if (!isAdmin) return;
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData(f => ({ ...f, client_phone: digits }));
                    }}
                    placeholder="05xxxxxxxx"
                    dir="ltr"
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all text-sm outline-none text-right
                      ${!isAdmin
                        ? dm ? 'bg-slate-600 border-slate-500 text-slate-300 cursor-default' : 'bg-slate-50 border-slate-100 cursor-default text-slate-500'
                        : formData.client_phone.length > 0 && formData.client_phone.length !== 10
                          ? dm ? 'bg-slate-700 text-white border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-900' : 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                          : formData.client_phone.length === 10
                            ? dm ? 'bg-slate-700 text-white border-emerald-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-900' : 'border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'
                            : dm ? 'bg-slate-700 border-slate-500 text-white placeholder-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-900'
                              : 'border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200'}`}
                  />
                  {isAdmin && formData.client_phone.length > 0 && (
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold
                      ${formData.client_phone.length === 10 ? 'text-emerald-500' : 'text-red-400'}`}>
                      {formData.client_phone.length === 10
                        ? <i className="fas fa-check-circle" />
                        : `${formData.client_phone.length}/10`}
                    </span>
                  )}
                </div>
                {isAdmin && formData.client_phone.length > 0 && formData.client_phone.length !== 10 && (
                  <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                    <i className="fas fa-exclamation-circle" /> رقم الجوال يجب أن يكون 10 أرقام بالضبط
                  </p>
                )}
                {isAdmin && formData.client_phone && !formData.client_phone.startsWith('05') && (
                  <p className="text-[11px] text-amber-500 mt-1 flex items-center gap-1">
                    <i className="fas fa-triangle-exclamation" /> يُفضّل أن يبدأ الرقم بـ 05
                  </p>
                )}
              </div>
              <div className="mb-4">
                <label className={`block text-sm font-bold mb-1.5 ${dm ? 'text-slate-200' : 'text-slate-700'}`}>
                  <i className={`fas fa-user-tie ml-1 ${dm ? 'text-slate-400' : 'text-slate-400'}`} />
                  الموظف المتابع <span className="text-red-500 mr-1">*</span>
                </label>
                <select aria-label="الموظف المتابع" value={formData.employee_id}
                  onChange={e => setFormData(f => ({ ...f, employee_id: e.target.value }))}
                  className={`w-full px-4 py-2.5 rounded-xl border focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none text-sm
                    ${dm ? 'bg-slate-700 border-slate-500 text-white focus:ring-cyan-900' : 'bg-white border-slate-200'}`}
                  disabled={!isAdmin}>
                  <option value="">اختر الموظف المسؤول...</option>
                  {employees.map(e => (
                    <option key={e.employee_id} value={e.employee_id}>
                      {e.employee_name}
                    </option>
                  ))}
                </select>
                {!isAdmin && (
                  <p className="text-[11px] text-amber-500 mt-1 flex items-center gap-1">
                    <i className="fas fa-lock" /> فقط الأدمن يمكنه تغيير الموظف
                  </p>
                )}
              </div>
              <div className="mb-4">
                <label className={`block text-sm font-bold mb-1.5 ${dm ? 'text-slate-200' : 'text-slate-700'}`}>
                  <i className={`fas fa-concierge-bell ml-1 ${dm ? 'text-slate-400' : 'text-slate-400'}`} />
                  الخدمة
                </label>
                <div className="relative">
                  <select aria-label="الخدمة" value={formData.service_name}
                    onChange={e => setFormData(f => ({ ...f, service_name: e.target.value, awn_package: '' }))}
                    className={`w-full px-4 py-2.5 rounded-xl border focus:border-cyan-500 focus:ring-2 outline-none text-sm appearance-none pr-10
                      ${dm ? 'bg-slate-700 border-slate-500 text-white focus:ring-cyan-900' : 'bg-white border-slate-200 focus:ring-cyan-200'}`}
                    disabled={!isAdmin}>
                    <option value="">اختر الخدمة أو المنتج...</option>
                    {services.filter(s => s.category === 'منتج').length > 0 && (
                      <optgroup label="── منتجات ──">
                        {services.filter(s => s.category === 'منتج').map((s, idx) => (
                          <option key={s.service_id} value={s.service_name}>
                            {idx + 1}. {s.service_name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {services.filter(s => s.category === 'خدمة').length > 0 && (
                      <optgroup label="── خدمات ──">
                        {services.filter(s => s.category === 'خدمة').map((s, idx) => (
                          <option key={s.service_id} value={s.service_name}>
                            {idx + 1}. {s.service_name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {services.filter(s => !s.category).map(s => (
                      <option key={s.service_id} value={s.service_name}>{s.service_name}</option>
                    ))}
                  </select>
                  {/* أيقونة الخدمة المختارة */}
                  {formData.service_name && (() => {
                    const svc = services.find(s => s.service_name === formData.service_name);
                    return svc?.icon ? (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-500 text-base pointer-events-none">
                        <i className={`fas ${svc.icon}`} />
                      </span>
                    ) : null;
                  })()}
                  {!isAdmin && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 text-xs pointer-events-none">
                      <i className="fas fa-lock" />
                    </span>
                  )}
                </div>
                {/* عرض الخدمات المتاحة مع أيقوناتها مقسمة حسب الفئة */}
                {services.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {/* منتجات */}
                    {services.filter(s => s.category === 'منتج').length > 0 && (
                      <div>
                        <span className={`text-[10px] font-extrabold uppercase tracking-widest mb-1 block ${dm ? 'text-slate-400' : 'text-slate-400'}`}>منتجات</span>
                        <div className="flex flex-wrap gap-1.5">
                          {services.filter(s => s.category === 'منتج').map((s, idx) => (
                            <button
                              key={s.service_id}
                              type="button"
                              disabled={!isAdmin}
                              onClick={() => isAdmin && setFormData(f => ({ ...f, service_name: s.service_name, awn_package: '' }))}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all
                                ${formData.service_name === s.service_name
                                  ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                                  : isAdmin
                                    ? 'bg-slate-50 text-slate-500 border-slate-200 hover:border-cyan-300 hover:text-cyan-600 hover:bg-cyan-50'
                                    : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                }`}
                            >
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0
                                ${formData.service_name === s.service_name ? 'bg-white/20 text-white' : 'bg-cyan-100 text-cyan-700'}`}>
                                {idx + 1}
                              </span>
                              {s.icon && <i className={`fas ${s.icon} text-[10px]`} />}
                              {s.service_name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* خدمات */}
                    {services.filter(s => s.category === 'خدمة').length > 0 && (
                      <div>
                        <span className={`text-[10px] font-extrabold uppercase tracking-widest mb-1 block ${dm ? 'text-slate-400' : 'text-slate-400'}`}>خدمات</span>
                        <div className="flex flex-wrap gap-1.5">
                          {services.filter(s => s.category === 'خدمة').map((s, idx) => (
                            <button
                              key={s.service_id}
                              type="button"
                              disabled={!isAdmin}
                              onClick={() => isAdmin && setFormData(f => ({ ...f, service_name: s.service_name, awn_package: '' }))}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all
                                ${formData.service_name === s.service_name
                                  ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                                  : isAdmin
                                    ? 'bg-slate-50 text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50'
                                    : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                }`}
                            >
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0
                                ${formData.service_name === s.service_name ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'}`}>
                                {idx + 1}
                              </span>
                              {s.icon && <i className={`fas ${s.icon} text-[10px]`} />}
                              {s.service_name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* بدون فئة */}
                    {services.filter(s => !s.category).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {services.filter(s => !s.category).map(s => (
                          <button
                            key={s.service_id}
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => isAdmin && setFormData(f => ({ ...f, service_name: s.service_name, awn_package: '' }))}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all
                              ${formData.service_name === s.service_name
                                ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                                : isAdmin
                                  ? 'bg-slate-50 text-slate-500 border-slate-200 hover:border-cyan-300 hover:text-cyan-600 hover:bg-cyan-50'
                                  : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                              }`}
                          >
                            {s.icon && <i className={`fas ${s.icon} text-[10px]`} />}
                            {s.service_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── اختيار الباقة لمنتج عون ── */}
                {(() => {
                  const selectedSvc = services.find(s => s.service_name === formData.service_name);
                  const isAwn = selectedSvc?.service_id === 'P01';
                  if (!isAwn) return null;
                  return (
                    <div className={`mt-3 rounded-xl border p-3 ${dm ? 'bg-cyan-950/30 border-cyan-800/60' : 'bg-cyan-50 border-cyan-200'}`}>
                      <label className={`block text-xs font-extrabold mb-2 flex items-center gap-1.5
                        ${dm ? 'text-cyan-300' : 'text-cyan-700'}`}>
                        <i className="fas fa-layer-group text-[10px]" />
                        اختر الباقة <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {AWN_PACKAGES.map(pkg => {
                          const isSelected = formData.awn_package === pkg.label;
                          return (
                            <button
                              key={pkg.label}
                              type="button"
                              disabled={!isAdmin}
                              onClick={() => isAdmin && setFormData(f => ({ ...f, awn_package: pkg.label }))}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all
                                ${isSelected
                                  ? 'bg-cyan-600 text-white border-cyan-600 shadow shadow-cyan-200'
                                  : isAdmin
                                    ? (dm ? 'bg-slate-700 border-slate-600 text-slate-300 hover:border-cyan-500 hover:text-cyan-300' : 'bg-white border-slate-200 text-slate-500 hover:border-cyan-400 hover:text-cyan-700')
                                    : 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                                }`}
                            >
                              <i className={`fas ${pkg.icon} text-[11px]`} />
                              {pkg.label}
                              {isSelected && <i className="fas fa-check text-[10px] mr-1" />}
                            </button>
                          );
                        })}
                      </div>
                      {!formData.awn_package && isAdmin && (
                        <p className="text-[11px] text-amber-500 mt-1.5 flex items-center gap-1">
                          <i className="fas fa-triangle-exclamation text-[10px]" /> يرجى اختيار الباقة لمنتج عون
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* ── شعار الجمعية (من Storage) ── */}
              <div className="mb-4 sm:col-span-2">
                <label className={`block text-sm font-bold mb-1.5 ${dm ? 'text-slate-200' : 'text-slate-700'}`}>
                  <i className={`fas fa-image ml-1 ${dm ? 'text-indigo-300' : 'text-indigo-400'}`} />
                  شعار الجمعية
                  <span className={`text-xs font-normal mr-2 ${dm ? 'text-slate-400' : 'text-slate-400'}`}>(اختياري — يظهر في العقد)</span>
                </label>
                <div className="flex items-center gap-3">
                  {/* صورة مصغرة */}
                  {formData.client_logo_url ? (
                    <div className="relative flex-shrink-0">
                      <img src={formData.client_logo_url} alt="شعار الجمعية"
                        className="w-14 h-14 rounded-xl object-contain border border-slate-200 bg-white p-1 shadow-sm" />
                      <button onClick={() => setFormData(f => ({ ...f, client_logo_url: '' }))} title="حذف الشعار"
                        className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center hover:bg-red-600 shadow">
                        <i className="fas fa-times" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 flex-shrink-0">
                      <i className="fas fa-image text-xl" />
                    </div>
                  )}
                  {/* زر الرفع */}
                  <div className="flex-1">
                    <label className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all text-sm font-bold
                      ${logoUploading ? 'border-indigo-300 bg-indigo-50 text-indigo-400' : 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-indigo-600'}`}>
                      {logoUploading
                        ? <><i className="fas fa-spinner fa-spin" /> جاري الرفع...</>
                        : <><i className="fas fa-cloud-upload-alt" /> {formData.client_logo_url ? 'تغيير الشعار' : 'رفع شعار الجمعية'}</>
                      }
                      <input type="file" accept="image/*" aria-label="رفع شعار الجمعية" className="hidden" disabled={logoUploading}
                        onChange={e => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]); e.target.value = ''; }} />
                    </label>
                    <p className="text-[11px] text-slate-400 mt-1">PNG أو JPG • حد أقصى 2MB • يُرفع في Storage تلقائياً</p>
                  </div>
                </div>
              </div>
              <FormInput label="تاريخ البدء" value={formData.start_date}
                onChange={v => isAdmin && setFormData(f => ({ ...f, start_date: v }))}
                type="date" icon="fa-calendar" isDarkMode={dm} />
              <FormInput label="تاريخ الانتهاء" value={formData.end_date}
                onChange={v => isAdmin && setFormData(f => ({ ...f, end_date: v }))}
                type="date" icon="fa-calendar" isDarkMode={dm} />
              {/* حالة العقد — أدمن فقط في وضع التعديل */}
              {isAdmin && modals.editContract && (
                <div className="mb-4 sm:col-span-2">
                  <label className={`block text-sm font-bold mb-1.5 ${dm ? 'text-slate-200' : 'text-slate-700'}`}>
                    <i className={`fas fa-circle-dot ml-1 ${dm ? 'text-slate-400' : 'text-slate-400'}`} />
                    حالة العقد
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['draft','pending_signature','completed','cancelled'] as const).map(s => {
                      const cfg = CONTRACT_STATUS_MAP[s];
                      const isSelected = formData.contract_status === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData(f => ({ ...f, contract_status: s }))}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-bold transition-all
                            ${isSelected
                              ? `${cfg.colors} border-current shadow-sm scale-[1.02]`
                              : dm ? 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                        >
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isSelected ? cfg.dot : 'bg-slate-300'}`} />
                          <i className={`fas ${cfg.icon} text-[10px]`} />
                          {cfg.text}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── القسم الثاني: بنود العقد ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className={`text-sm font-bold flex items-center gap-2 ${dm ? 'text-slate-200' : 'text-slate-700'}`}>
                <i className={`fas fa-list-ol ${dm ? 'text-red-400' : 'text-red-500'}`} />
                بنود العقد
                {isAdmin && <span className={`text-xs font-normal ${dm ? 'text-slate-400' : 'text-slate-400'}`}>(يمكنك تعديل عنوان أو نص أي بند، أو حذفه)</span>}
                {!isAdmin && <span className="text-xs font-normal text-amber-500 flex items-center gap-1"><i className="fas fa-lock text-[10px]" /> للعرض فقط</span>}
              </h4>
            </div>
            <div className="space-y-3">
              {clauses.map((clause, idx) => (
                <div key={clause.id}
                  className={`rounded-xl border transition-all overflow-hidden select-none
                    ${clause.enabled
                      ? dm ? 'border-red-800/60 bg-red-950/30 hover:border-red-600' : 'border-red-200 bg-red-50/40 hover:border-red-400'
                      : dm ? 'border-slate-700 bg-slate-800/50 opacity-60' : 'border-red-100 bg-slate-50 opacity-60'}`}
                  style={{ cursor: isAdmin ? 'grab' : 'default' }}
                  draggable={isAdmin}
                  onDragStart={e => { if (!isAdmin) { e.preventDefault(); return; } e.dataTransfer.setData('clauseId', clause.id); }}
                  onDragOver={e => { if (!isAdmin) return; e.preventDefault(); (e.currentTarget as HTMLElement).style.outline = '2px solid #0891b2'; }}
                  onDragLeave={e => { (e.currentTarget as HTMLElement).style.outline = ''; }}
                  onDrop={e => {
                    if (!isAdmin) return;
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).style.outline = '';
                    const draggedId = e.dataTransfer.getData('clauseId');
                    if (draggedId === clause.id) return;
                    setClauses(prev => {
                      const arr = [...prev];
                      const fromIdx = arr.findIndex(c => c.id === draggedId);
                      const toIdx = arr.findIndex(c => c.id === clause.id);
                      const [item] = arr.splice(fromIdx, 1);
                      arr.splice(toIdx, 0, item);
                      return arr;
                    });
                  }}>
                  {/* رأس البند */}
                  <div className={`flex items-center gap-3 px-4 py-3 border-b ${dm ? 'bg-red-950/40 border-red-800/50' : 'bg-red-100/60 border-red-200'}`}>
                    {isAdmin && (
                      <span style={{ cursor: 'grab', color: '#f87171', fontSize: 14, flexShrink: 0 }} title="اسحب لتغيير الترتيب">
                        <i className="fas fa-grip-vertical" />
                      </span>
                    )}
                    <input type="checkbox" aria-label={`تفعيل البند: ${clause.title || ''}`} checked={clause.enabled}
                      onChange={e => isAdmin && setClauses(prev => prev.map(c => c.id === clause.id ? { ...c, enabled: e.target.checked } : c))}
                      className="w-4 h-4 accent-red-600 flex-shrink-0"
                      style={{ cursor: isAdmin ? 'pointer' : 'not-allowed' }}
                      disabled={!isAdmin} />
                    <input
                      aria-label="عنوان البند"
                      value={clause.title}
                      onChange={e => isAdmin && setClauses(prev => prev.map(c => c.id === clause.id ? { ...c, title: e.target.value } : c))}
                      className={`flex-1 text-sm font-bold bg-transparent outline-none border-b border-transparent pb-0.5 transition-colors
                        ${dm ? 'text-red-300' : 'text-red-800'}
                        ${isAdmin ? 'focus:border-red-400' : 'cursor-default'}`}
                      dir="rtl"
                      readOnly={!isAdmin}
                    />
                    {isAdmin && (
                    <button onClick={() => setClauses(prev => prev.filter(c => c.id !== clause.id))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors flex-shrink-0"
                      title="حذف البند">
                      <i className="fas fa-times text-xs" />
                    </button>
                    )}
                  </div>
                  {/* نص البند */}
                  {clause.enabled && (
                    <div className="px-4 py-3">
                      {clause.isTable ? (
                        <div className="space-y-2">
                          {!isAdmin && <p className="text-xs text-amber-500 mb-2 flex items-center gap-1"><i className="fas fa-lock text-[10px]" /> للعرض فقط</p>}
                          {isAdmin && <p className={`text-xs mb-2 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>كل سطر يمثل شريحة بالصيغة: الإيراد | المستحقات</p>}
                          {clause.text.split('\n').map((line, li) => {
                            const [rev, fee] = line.split('|');
                            return (
                              <div key={li} className="grid grid-cols-2 gap-2">
                                <input aria-label="قيمة الشريحة" value={rev || ''} dir="rtl"
                                  readOnly={!isAdmin}
                                  onChange={e => {
                                    if (!isAdmin) return;
                                    const lines = clause.text.split('\n');
                                    const parts = lines[li].split('|');
                                    parts[0] = e.target.value;
                                    lines[li] = parts.join('|');
                                    setClauses(prev => prev.map(c => c.id === clause.id ? { ...c, text: lines.join('\n') } : c));
                                  }}
                                  className={`px-3 py-2 rounded-lg border text-xs outline-none transition-colors
                                    ${isAdmin
                                      ? dm ? 'bg-emerald-950/30 border-emerald-700 text-emerald-200 focus:border-emerald-500 placeholder-emerald-700' : 'bg-emerald-50 border-emerald-200 focus:border-emerald-500 text-slate-700'
                                      : dm ? 'bg-slate-700 border-slate-600 text-slate-400 cursor-default' : 'bg-slate-50 border-slate-200 text-slate-500 cursor-default'}`}
                                  placeholder="الإيراد" />
                                <input aria-label="نسبة الرسوم" value={fee || ''} dir="rtl"
                                  readOnly={!isAdmin}
                                  onChange={e => {
                                    if (!isAdmin) return;
                                    const lines = clause.text.split('\n');
                                    const parts = lines[li].split('|');
                                    parts[1] = e.target.value;
                                    lines[li] = parts.join('|');
                                    setClauses(prev => prev.map(c => c.id === clause.id ? { ...c, text: lines.join('\n') } : c));
                                  }}
                                  className={`px-3 py-2 rounded-lg border text-xs outline-none transition-colors
                                    ${isAdmin
                                      ? dm ? 'bg-emerald-950/30 border-emerald-700 text-emerald-200 focus:border-emerald-500 placeholder-emerald-700' : 'bg-emerald-50 border-emerald-200 focus:border-emerald-500 text-slate-700'
                                      : dm ? 'bg-slate-700 border-slate-600 text-slate-400 cursor-default' : 'bg-slate-50 border-slate-200 text-slate-500 cursor-default'}`}
                                  placeholder="المستحقات" />
                              </div>
                            );
                          })}
                          {isAdmin && (
                          <button onClick={() => setClauses(prev => prev.map(c => c.id === clause.id ? { ...c, text: c.text + '\n|' } : c))}
                            className={`text-xs font-bold mt-1 ${dm ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-800'}`}>
                            <i className="fas fa-plus ml-1" />إضافة شريحة
                          </button>
                          )}
                        </div>
                      ) : (
                        <textarea aria-label="نص البند" value={clause.text.replace(/\\n/g, '\n')}
                          onChange={e => isAdmin && setClauses(prev => prev.map(c => c.id === clause.id ? { ...c, text: e.target.value.replace(/\n/g, '\\n') } : c))}
                          rows={Math.max(3, clause.text.split('\n').length + 1)}
                          dir="rtl"
                          readOnly={!isAdmin}
                          className={`w-full px-3 py-2 rounded-lg border outline-none text-sm resize-none leading-relaxed
                            ${isAdmin
                              ? dm ? 'border-red-800/60 focus:border-red-500 focus:ring-1 focus:ring-red-900 bg-red-950/20 text-slate-200' : 'border-red-200 focus:border-red-400 focus:ring-1 focus:ring-red-100 bg-white text-slate-700'
                              : dm ? 'border-red-900/40 bg-red-950/20 text-slate-400 cursor-default' : 'border-red-100 bg-white text-slate-600 cursor-default'}`}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
              {/* إضافة بند جديد — أدمن فقط */}
              {isAdmin && (
              <button
                onClick={() => setClauses(prev => [...prev, {
                  id: Math.random().toString(36).slice(2),
                  title: `المادة (${prev.length + 1}) بند جديد`,
                  text: 'اكتب نص البند هنا...',
                  enabled: true,
                }])}
                className={`w-full py-3 rounded-xl border-2 border-dashed transition-all text-sm font-bold flex items-center justify-center gap-2
                  ${dm ? 'border-red-800 text-red-400 hover:border-red-500 hover:text-red-300 hover:bg-red-950/30' : 'border-red-200 text-red-400 hover:border-red-400 hover:text-red-600 hover:bg-red-50'}`}
              >
                <i className="fas fa-plus" /> إضافة بند جديد
              </button>
              )}
            </div>
          </div>

          {/* ── أزرار ── */}
          <div className={`flex flex-col sm:flex-row gap-3 pt-4 border-t ${dm ? 'border-slate-700' : 'border-slate-200'}`}>
            <button
              onClick={() => {
                if (!formData.client_name || !formData.employee_id) {
                  showToast('يرجى تعبئة اسم العميل والموظف أولاً', 'error');
                  return;
                }
                const emp = employees.find(e => e.employee_id === formData.employee_id);
                const financialClause = clauses.find(c => c.isTable);
                const tiers = financialClause ? financialClause.text.split('\n').map(l => l.split('|')) : [];
                generateContractPDF({
                  contract_number: `CTR-${Date.now()}`,
                  client_name: formData.client_name,
                  client_phone: formData.client_phone,
                  service_name: formData.service_name,
                  contract_type: formData.contract_type,
                  contract_details: formData.contract_details,
                  employee_name: emp?.employee_name || '',
                  financial_amount: formData.financial_amount,
                  financial_notes: formData.financial_notes,
                  start_date: formData.start_date,
                  end_date: formData.end_date,
                  fee_tier1_label: tiers[0]?.[0] || formData.fee_tier1_label,
                  fee_tier1_value: tiers[0]?.[1] || formData.fee_tier1_value,
                  fee_tier2_label: tiers[1]?.[0] || formData.fee_tier2_label,
                  fee_tier2_value: tiers[1]?.[1] || formData.fee_tier2_value,
                  fee_tier3_label: tiers[2]?.[0] || formData.fee_tier3_label,
                  fee_tier3_value: tiers[2]?.[1] || formData.fee_tier3_value,
                  client_logo_url: formData.client_logo_url || '',
                  client_rep: formData.client_rep || '',
                  awn_package: formData.awn_package || '',
                  clauses: clauses,
                });
                showToast('تم فتح ملف العقد — اضغط Ctrl+P لحفظه', 'info');
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-l from-cyan-600 to-cyan-500 hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
            >
              <i className="fas fa-file-pdf" /> توليد ملف العقد (PDF)
            </button>
            {isAdmin && (
            <button
              onClick={modals.editContract ? handleUpdateContract : handleCreateContract}
              disabled={formLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-l from-slate-700 to-slate-600 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {formLoading
                ? <><i className="fas fa-spinner fa-spin" /> جاري الحفظ...</>
                : <><i className="fas fa-bookmark" /> {modals.editContract ? 'تحديث' : 'حفظ للمتابعة'}</>}
            </button>
            )}
            <button
              onClick={() => setModals(m => ({ ...m, addContract: false, editContract: false }))}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all ${dm ? 'text-slate-300 bg-slate-700 hover:bg-slate-600' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}
            >
              {isAdmin ? 'إلغاء' : 'إغلاق'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Change Status Modal ── */}
      <Modal
        isOpen={modals.changeStatus}
        onClose={() => setModals(m => ({ ...m, changeStatus: false }))}
        title="تغيير حالة العقد"
        size="md"
      >
        <div className="space-y-4">
          <FormSelect
            label="الحالة الجديدة"
            value={newStatus}
            onChange={setNewStatus}
            options={Object.entries(CONTRACT_STATUS_MAP).map(([value, config]) => ({
              value,
              label: config.text,
            }))}
            required
            placeholder="اختر الحالة الجديدة..."
            isDarkMode={dm}
          />
          <div className={`flex gap-3 pt-4 border-t ${dm ? 'border-slate-700' : 'border-slate-200'}`}>
            <button
              onClick={handleUpdateStatus}
              disabled={formLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-l from-violet-600 to-violet-500 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {formLoading ? (
                <><i className="fas fa-spinner fa-spin" /> جاري التحديث...</>
              ) : (
                <><i className="fas fa-check" /> تحديث الحالة</>
              )}
            </button>
            <button
              onClick={() => setModals(m => ({ ...m, changeStatus: false }))}
              className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${dm ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Contract Preview Modal ── */}
      <Modal
        isOpen={modals.contractPreview}
        onClose={() => setModals(m => ({ ...m, contractPreview: false }))}
        title="عرض العقد"
        size="xl"
        isDarkMode={dm}
      >
        <div className="bg-slate-100 rounded-xl overflow-hidden" style={{ height: '70vh' }}>
          <iframe
            src={previewUrl}
            className="w-full h-full"
            title="Contract Preview"
          />
        </div>
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      {confirmModal.open && (
        <div className="confirm-overlay">
          <div className="confirm-card">
            <div className="confirm-deco1" />
            <div className="confirm-deco2" />
            <div className="confirm-icon-wrap">
              <div className="confirm-ring" />
              <div className="confirm-icon-circle">🗑️</div>
            </div>
            <h2 className="confirm-title">{confirmModal.title}</h2>
            <p className="confirm-sub">{confirmModal.message}</p>
            <div className="confirm-btns">
              <button className="confirm-cancel" onClick={() => setConfirmModal(p => ({ ...p, open: false }))}>إلغاء</button>
              <button className="confirm-ok" onClick={() => { confirmModal.onConfirm?.(); setConfirmModal(p => ({ ...p, open: false })); }}>نعم، تأكيد</button>
            </div>
          </div>
        </div>
      )}

            {/* ── زر إضافة عقد العائم — أدمن فقط ── */}
      {isAdmin && (
      <button
        onClick={openAddModal}
        style={{
          position: 'fixed',
          bottom: 32,
          left: 32,
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 24px',
          borderRadius: 50,
          border: 'none',
          background: 'linear-gradient(135deg, #0891b2, #0e7490)',
          color: '#fff',
          fontFamily: 'Tajawal, sans-serif',
          fontSize: 15,
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 8px 28px rgba(8,145,178,0.45)',
          transition: 'all 0.25s ease',
          direction: 'rtl',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 36px rgba(8,145,178,0.55)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 28px rgba(8,145,178,0.45)';
        }}
      >
        <i className="fas fa-plus" style={{ fontSize: 16 }} />
        إضافة عقد جديد
      </button>
      )}

    </div>
  );
}