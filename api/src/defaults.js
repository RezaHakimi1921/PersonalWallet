// Starting categories for every new user. Several names are load-bearing: the app
// matches on them exactly (قسط, قرض, تسویه طلب, تسویه بدهی, وام دریافتی,
// انتقال وجه بین حساب, درآمد کار), so rename them only together with that code.
const DEFAULT_CATEGORIES = [
  ...[
    'خوراکی',
    'غذا',
    'رفت و آمد',
    'قبوض و خانه',
    'خرید',
    'درمان و سلامت',
    'خانواده',
    'شخصی',
    'وسیله نقلیه',
    'توسعه شخصی',
    'تفریح',
    'هدیه',
    'آرایشگاه',
    'قسط',
    'قرض',
    'تسویه بدهی',
    'انتقال وجه بین حساب',
    'ناشناخته',
  ].map((name) => ({ name, direction: 'expense' })),
  ...[
    'درآمد کار',
    'درآمد شخصی',
    'سود سرمایه‌گذاری',
    'وام دریافتی',
    'قرض',
    'تسویه طلب',
    'انتقال وجه بین حساب',
    'ناشناخته',
  ].map((name) => ({ name, direction: 'income' })),
];

module.exports = { DEFAULT_CATEGORIES };
