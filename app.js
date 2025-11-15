// دالة تحميل الإطارات
function loadFrames() {
    const url = document.getElementById('url-input').value.trim();
    const count = parseInt(document.getElementById('page-count').value);
    const container = document.getElementById('iframe-container');

    // 1. تنظيف الحاوية
    container.innerHTML = '';

    // 2. التحقق من صحة الإدخالات
    if (!url || count < 1 || isNaN(count)) {
        alert('الرجاء إدخال رابط صحيح وعدد صفحات رقمي أكبر من صفر.');
        return;
    }
    
    // 3. تعديل الرابط لضمان البدء بـ http:// أو https://
    let finalUrl = url;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
    }

    // 4. إنشاء الإطارات وحقنها
    for (let i = 0; i < count; i++) {
        const iframe = document.createElement('iframe');
        iframe.className = 'web-frame';
        iframe.src = finalUrl;
        
        container.appendChild(iframe);
    }
    
    console.warn("تذكير: بعض المواقع تمنع تحميلها داخل iFrame لأسباب أمنية. إذا لم يظهر المحتوى، فقد تكون المشكلة من إعدادات الموقع الخارجي.");
}

// إضافة المستمعين للأحداث بعد تحميل الصفحة بالكامل
document.addEventListener('DOMContentLoaded', () => {
    // تشغيل الدالة عند الضغط على زر "عرض"
    document.getElementById('load-button').addEventListener('click', loadFrames);

    // تشغيل الدالة عند الضغط على Enter في حقول الإدخال
    const inputs = [
        document.getElementById('url-input'), 
        document.getElementById('page-count')
    ];
    
    inputs.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault(); 
                loadFrames();
            }
        });
    });
});
