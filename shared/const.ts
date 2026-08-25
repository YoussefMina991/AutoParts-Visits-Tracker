export const COOKIE_NAME = "app_session_id";
// مدة الجلسة: 30 يوم (الاسم القديم ONE_YEAR_MS كان مضلل — اتغير للاسم الصادق)
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = "يرجى تسجيل الدخول (10001)";
export const NOT_ADMIN_ERR_MSG = "ليس لديك صلاحية (10002)";
