package com.branchtracker.app;

import android.content.Context;
import android.content.Intent;
import android.util.Log;
import android.widget.Toast;

/**
 * DeviceAdminReceiver
 * ════════════════════════════════════════════════════════════
 * بيعمل التطبيق "مدير جهاز" — زي تطبيقات الشركات على الموبايلات.
 *
 * الميزة الأساسية:
 * ═════════════════
 * المستخدم مش هيقدر يحذف التطبيق من غير ما يلغي صلاحيات
 * Device Admin الأول — وده بيحتاج يروح:
 * الإعدادات → الأمان → مديرو الأجهزة → يشيل التطبيق
 *
 * لو حاول يحذف التطبيق مباشرة:
 * ═══════════════════════════════
 * الأندرويد بيوقفه ويقوله "مش ممكن تحذف مدير الجهاز"
 *
 * تفعيل Device Admin:
 * ════════════════════
 * لازم تبعت المستخدم لشاشة التفعيل مرة واحدة بس:
 *   Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
 *   intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent);
 *   intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "مطلوب لتتبع الزيارات");
 *   startActivity(intent);
 */
public class DeviceAdminReceiver extends android.app.admin.DeviceAdminReceiver {

    private static final String TAG = "BranchTracker:Admin";

    @Override
    public void onEnabled(Context context, Intent intent) {
        Log.i(TAG, "Device Admin enabled");
        Toast.makeText(
            context,
            "تم تفعيل حماية التطبيق بنجاح",
            Toast.LENGTH_SHORT
        ).show();
    }

    @Override
    public void onDisabled(Context context, Intent intent) {
        // المستخدم شال الصلاحية يدوياً من الإعدادات
        Log.w(TAG, "Device Admin disabled by user");
    }

    @Override
    public CharSequence onDisableRequested(Context context, Intent intent) {
        // رسالة تظهر للمستخدم لما يحاول يشيل الصلاحية
        return "إيقاف هذه الصلاحية سيؤثر على دقة تسجيل الزيارات الميدانية.";
    }
}
