// js/login.js
import { loginUser, checkSession } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // التحقق الاستباقي من الجلسة
    const currentSession = await checkSession();
    if (currentSession) {
        window.location.replace('dashboard.html'); 
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('identifier');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('submitBtn');
    const errorMessage = document.getElementById('error-message');

    // --- متغيرات حماية الحساب (Brute-Force Protection) ---
    let failedAttempts = 0;
    let isLockedOut = false;
    let lockoutTimer;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // صد المحاولات إذا كان النظام في حالة حظر
        if (isLockedOut) return;

        // 1. تنظيف البيانات (نفس الكود الشغال الخاص بك)
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            errorMessage.textContent = 'يرجى ملء جميع الحقول.';
            errorMessage.classList.remove('hidden');
            return;
        }

        // 2. إظهار حالة التحميل
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-70', 'cursor-not-allowed');
        submitBtn.textContent = 'Authenticating...';
        errorMessage.classList.add('hidden'); // إخفاء الخطأ القديم إن وجد

        try {
            console.log("حاول الاتصال بالسيرفر باستخدام:", email);

            // 3. الاتصال بالسيرفر
            const { data, error } = await loginUser(email, password);

            if (error) {
                failedAttempts++;
                console.error("خطأ من Supabase:", error); 
                
                // عرض الخطأ كما يراه Supabase
                errorMessage.textContent = 'خطأ: ' + (error.message === 'Invalid login credentials' ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : error.message);
                errorMessage.classList.remove('hidden');

                // نظام الحظر بعد 3 محاولات فاشلة
                if (failedAttempts >= 3) {
                    isLockedOut = true;
                    let timeLeft = 30;
                    
                    errorMessage.textContent = `تم تعليق الدخول مؤقتاً لحماية الحساب. المحاولة بعد ${timeLeft} ثانية.`;
                    submitBtn.textContent = `Locked (${timeLeft}s)`;
                    
                    lockoutTimer = setInterval(() => {
                        timeLeft--;
                        errorMessage.textContent = `تم تعليق الدخول مؤقتاً لحماية الحساب. المحاولة بعد ${timeLeft} ثانية.`;
                        submitBtn.textContent = `Locked (${timeLeft}s)`;
                        
                        if (timeLeft <= 0) {
                            clearInterval(lockoutTimer);
                            failedAttempts = 0;
                            isLockedOut = false;
                            submitBtn.disabled = false;
                            submitBtn.classList.remove('opacity-70', 'cursor-not-allowed');
                            submitBtn.textContent = 'Secure Login';
                            errorMessage.classList.add('hidden');
                        }
                    }, 1000);
                }
            } else {
                // نجاح تسجيل الدخول
                failedAttempts = 0;
                console.log("تم تسجيل الدخول بنجاح، جاري التحويل...");
                window.location.replace('dashboard.html'); 
            }
        } catch (err) {
            console.error('خطأ غير متوقع:', err);
            errorMessage.textContent = 'تعذر الاتصال بالخادم. تأكد من اتصالك بالإنترنت.';
            errorMessage.classList.remove('hidden');
        } finally {
            // إعادة تفعيل الزر إذا لم يكن المستخدم محظوراً
            if (!isLockedOut) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-70', 'cursor-not-allowed');
                submitBtn.textContent = 'Secure Login';
            }
        }
    });
});