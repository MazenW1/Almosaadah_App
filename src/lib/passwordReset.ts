// lib/passwordReset.ts
// ─────────────────────────────────────────────────────────────────────────────
// helpers لاستعادة كلمة المرور — يرسل بريد OTP ويؤكد الرمز
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';

export interface ResetPasswordResult {
  success: boolean;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Step 1 — أرسل رمز OTP إلى بريد المستخدم ════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export async function requestPasswordReset(email: string): Promise<ResetPasswordResult> {
  try {
    // التحقق من البريد
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: 'صيغة البريد الإلكتروني غير صحيحة' };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/reset-password`,
    });

    if (error) {
      // رسائل خطأ واضحة للمستخدم
      if (error.message.includes('not found') || error.message.includes('not_found')) {
        return { success: false, error: 'هذا البريد غير مسجّل في النظام' };
      }
      return { success: false, error: error.message || 'حدث خطأ أثناء الإرسال' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[passwordReset] requestPasswordReset error:', err);
    return { success: false, error: 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Step 2 — المستخدم ضغط على الرابط في البريد → يفتح صفحة التغيير ══════════
// ═══════════════════════════════════════════════════════════════════════════════
// عندما يفتح المستخدم الرابط، Supabase يعرّف token في URL hash أو query param
// نستخدم verifySegment أو نتحقق من session

export async function getPasswordResetSession(): Promise<{ hasSession: boolean; error?: string }> {
  try {
    // Supabase يعرّف recovery token في URL hash
    // نحاول استرداد الجلسة
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return { hasSession: false, error: error.message };
    }

    // التحقق من أن الرابط صالح (token يفترض أن يُنتج session)
    if (!data.session) {
      // محاولة تحديث — قد يكون هناك token pending
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        return { hasSession: false, error: 'الرابط غير صالح أو منتهي الصلاحية' };
      }
    }

    const newSession = await supabase.auth.getSession();
    return { hasSession: !!newSession.data.session };
  } catch (err: any) {
    return { hasSession: false, error: 'فشل في التحقق من الرابط' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Step 3 — تحديث كلمة المرور الجديدة ══════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export interface UpdatePasswordResult {
  success: boolean;
  error?: string;
}

export async function updatePassword(newPassword: string): Promise<UpdatePasswordResult> {
  try {
    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return { success: false, error: 'كلمة المرور يجب أن تحتوي على حروف وأرقام' };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      if (error.message.includes('session')) {
        return { success: false, error: 'انتهت صلاحية الجلسة. يرجى طلب رابط جديد' };
      }
      return { success: false, error: error.message || 'فشل في تحديث كلمة المرور' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[passwordReset] updatePassword error:', err);
    return { success: false, error: 'حدث خطأ غير متوقع' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ التحقق من قوة كلمة المرور ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export interface PasswordStrengthResult {
  level: number;       // 0-3
  label: string;
  color: string;
  score: number;       // 0-100
  hints: string[];
}

export function getPasswordStrength(password: string): PasswordStrengthResult {
  const hints: string[] = [];
  let score = 0;

  if (password.length === 0) {
    return { level: 0, label: '', color: '', score: 0, hints: [] };
  }

  if (password.length < 8) {
    hints.push('8 أحرف على الأقل');
  } else {
    score += 20;
  }

  if (password.length >= 12) score += 10;

  if (/[A-Z]/.test(password)) {
    score += 15;
  } else {
    hints.push('حرف كبير (A-Z)');
  }

  if (/[a-z]/.test(password)) {
    score += 15;
  } else {
    hints.push('حرف صغير (a-z)');
  }

  if (/[0-9]/.test(password)) {
    score += 20;
  } else {
    hints.push('رقم (0-9)');
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 20;
  } else {
    hints.push('رمز خاص (!@#$%)');
  }

  // تحديد المستوى
  let level: number;
  let label: string;
  let color: string;

  if (score < 40) {
    level = 1; label = 'ضعيفة'; color = '#dc2626';
  } else if (score < 70) {
    level = 2; label = 'متوسطة'; color = '#d97706';
  } else {
    level = 3; label = 'قوية'; color = '#059669';
  }

  return { level, label, color, score: Math.min(100, score), hints };
}