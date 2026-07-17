import { checkSession, logoutUser, supabase } from './api.js';

// متغير لتخزين المواعيد في الذاكرة لتسهيل التعامل معها
let appointmentsCache = [];

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Calendar Module Initializing...");

    // 1. حماية الصفحة (Authentication)
    const session = await checkSession();
    if (!session) {
        window.location.replace('index.html');
        return;
    } else {
        // عرض اسم المستخدم (الطبيب/الموظف) في القائمة الجانبية
        const userName = session.user.email.split('@')[0];
        const sidebarName = document.getElementById('sidebar-user-name');
        if (sidebarName) sidebarName.textContent = `Dr. ${userName}`;
    }

    // زر تسجيل الخروج
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await logoutUser();
        window.location.replace('index.html');
    });

    // 2. تحديث عنوان الشهر والسنة تلقائياً
    updateMonthHeader();

    // 3. جلب وعرض المواعيد
    await loadAndRenderAppointments();

    // 4. تفعيل نموذج حفظ موعد جديد
    const saveBtn = document.getElementById('saveAppointmentBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', handleSaveAppointment);
    }

    // 5. تفعيل بحث المرضى الحي (Live Search)
    const patientInput = document.getElementById('apptPatientName');
    if (patientInput) {
        patientInput.addEventListener('input', handlePatientSearch);
        
        // إخفاء القائمة عند النقر في أي مكان آخر بالشاشة
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#patientSearchContainer')) {
                document.getElementById('patientSuggestions')?.classList.add('hidden');
            }
        });
    }
});

// ==========================================
// الدوال الأساسية (Core Functions)
// ==========================================

// دالة تحديث عنوان الشهر
function updateMonthHeader() {
    const header = document.getElementById('current-month-year');
    if (!header) return;
    const date = new Date();
    const options = { month: 'long', year: 'numeric' };
    header.textContent = date.toLocaleDateString('en-US', options);
}

// دالة جلب المواعيد من قاعدة البيانات وعرضها
async function loadAndRenderAppointments() {
    try {
        // جلب البيانات من جدول المواعيد (تأكد أن اسم الجدول لديك هو appointments)
        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .order('date', { ascending: true })
            .order('time', { ascending: true });

        if (error) throw error;
        
        appointmentsCache = data || [];
        
        // تفريغ الجدول والقائمة قبل إعادة الرسم
        clearCalendar();
        
        // رسم المواعيد
        renderGrid(appointmentsCache);
        renderQueue(appointmentsCache);

    } catch (err) {
        console.error("Error loading appointments:", err);
    }
}

// دالة مسح البيانات القديمة من الواجهة
function clearCalendar() {
    document.querySelectorAll('.calendar-cell').forEach(cell => cell.innerHTML = '');
    const queue = document.getElementById('waitingQueue');
    if (queue) queue.innerHTML = '';
}

// ==========================================
// دوال الرسم (Rendering Logic)
// ==========================================

// 1. رسم المواعيد داخل جدول التقويم (Grid)
function renderGrid(appointments) {
    appointments.forEach(appt => {
        if (!appt.date || !appt.time) return;

        const apptDate = new Date(appt.date);
        const dayOfWeek = apptDate.getDay(); // 0 = Sunday, 1 = Monday ... 5 = Friday
        const hour = appt.time.split(':')[0]; // استخراج الساعة (مثلاً 09 من 09:30)

        // تجاهل أيام العطلة (السبت والأحد) في هذا التصميم أو الأوقات خارج الدوام
        if (dayOfWeek < 1 || dayOfWeek > 5) return;

        // البحث عن الخلية المناسبة بناءً على اليوم والساعة
        const cell = document.querySelector(`.calendar-cell[data-hour="${hour}"][data-day="${dayOfWeek}"]`);
        
        if (cell) {
            // إنشاء كرت الموعد داخل الخلية
            const apptCard = document.createElement('div');
            // استخدام تصميم Tailwind الاحترافي الذي كان موجوداً في HTML
            apptCard.className = "absolute top-1 left-1 right-1 bg-secondary-container border-l-4 border-secondary rounded shadow-sm p-1.5 cursor-pointer hover:shadow-md transition-shadow overflow-hidden z-10 opacity-90";
            
            apptCard.innerHTML = `
                <p class="text-[11px] font-bold text-on-secondary-container truncate">${appt.patient_name}</p>
                <p class="text-[9px] text-on-secondary-container/80 truncate mt-0.5">${appt.type || 'Visit'} • ${appt.time}</p>
            `;
            
            cell.appendChild(apptCard);
        }
    });
}

// 2. رسم قائمة الانتظار (Waiting Queue) لمواعيد اليوم فقط
function renderQueue(appointments) {
    const queueContainer = document.getElementById('waitingQueue');
    const queueCount = document.getElementById('queueCount');
    if (!queueContainer || !queueCount) return;

    // الحصول على تاريخ اليوم بصيغة YYYY-MM-DD
    const todayStr = new Date().toISOString().split('T')[0];
    
    // فلترة مواعيد اليوم فقط
    const todaysAppointments = appointments.filter(appt => appt.date === todayStr);
    
    queueCount.textContent = todaysAppointments.length;

    if (todaysAppointments.length === 0) {
        queueContainer.innerHTML = '<p class="text-xs text-outline text-center py-4">No appointments in queue for today.</p>';
        return;
    }

    todaysAppointments.forEach(appt => {
        // إنشاء أيقونة الاسم (أول حرفين)
        const initials = appt.patient_name.substring(0, 2).toUpperCase();
        
        // إنشاء بطاقة الموعد
        const card = document.createElement('div');
        card.className = "bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-sm relative overflow-hidden group hover:border-primary transition-all";
        
        card.innerHTML = `
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-[#eab308]"></div>
            <div class="flex items-start gap-3">
                <div class="w-9 h-9 rounded-full bg-secondary-container text-secondary font-bold flex items-center justify-center text-sm shrink-0">${initials}</div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start mb-0.5">
                        <p class="text-sm font-bold text-on-surface truncate">${appt.patient_name}</p>
                        <span class="material-symbols-outlined text-[16px] text-outline cursor-pointer hover:text-primary">more_vert</span>
                    </div>
                    <p class="text-xs text-on-surface-variant truncate">${appt.provider_name || 'General Provider'}</p>
                    <div class="flex items-center gap-2 mt-2">
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#fef9c3] text-[#854d0e] uppercase tracking-wider">Waiting</span>
                        <span class="text-[10px] font-medium text-error flex items-center gap-0.5"><span class="material-symbols-outlined text-[12px]">schedule</span> ${appt.time}</span>
                    </div>
                </div>
            </div>
        `;
        queueContainer.appendChild(card);
    });
}

// ==========================================
// دوال الإضافة (Adding Data) و البحث (Search)
// ==========================================

// دالة البحث المباشر في قاعدة بيانات المرضى
let searchTimeout;
async function handlePatientSearch(e) {
    const searchTerm = e.target.value.trim();
    const suggestionsBox = document.getElementById('patientSuggestions');
    const hiddenIdInput = document.getElementById('apptPatientId');

    // إذا مسح المستخدم النص، نفرغ البيانات
    if (searchTerm.length === 0) {
        suggestionsBox.classList.add('hidden');
        suggestionsBox.innerHTML = '';
        hiddenIdInput.value = '';
        return;
    }

    // تأخير بسيط (Debounce) لكي لا نرهق السيرفر مع كل حرف يُكتب
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            // البحث عن المريض بالاسم
            const { data, error } = await supabase
                .from('patients')
                .select('id, name, phone')
                .ilike('name', `%${searchTerm}%`)
                .limit(5);

            if (error) throw error;

            suggestionsBox.innerHTML = '';
            
            if (data.length === 0) {
                suggestionsBox.innerHTML = '<li class="p-3 text-sm text-outline text-center">No patients found</li>';
                suggestionsBox.classList.remove('hidden');
                return;
            }

            // عرض النتائج كخيارات
            data.forEach(patient => {
                const li = document.createElement('li');
                li.className = "p-3 border-b border-outline-variant/40 hover:bg-surface-container-low cursor-pointer flex justify-between items-center transition-colors";
                li.innerHTML = `
                    <span class="font-bold text-sm text-on-surface">${patient.name}</span>
                    <span class="text-xs text-outline">${patient.phone || 'No phone'}</span>
                `;
                
                // عند اختيار المريض
                li.addEventListener('click', () => {
                    document.getElementById('apptPatientName').value = patient.name; // عرض الاسم
                    hiddenIdInput.value = patient.id; // حفظ الـ ID سراً
                    suggestionsBox.classList.add('hidden'); // إخفاء القائمة
                });
                
                suggestionsBox.appendChild(li);
            });

            suggestionsBox.classList.remove('hidden');

        } catch (err) {
            console.error("Search error:", err);
        }
    }, 300); // ينتظر 300 جزء من الثانية بعد التوقف عن الكتابة
}

// دالة حفظ الموعد
async function handleSaveAppointment(e) {
    e.preventDefault();
    const btn = document.getElementById('saveAppointmentBtn');
    
    // جمع البيانات من النموذج المحدث
    const newAppointment = {
        patient_id: document.getElementById('apptPatientId').value, // ✨ استخدام الـ ID بدلاً من الاسم
        patient_name: document.getElementById('apptPatientName').value.trim(), 
        type: document.getElementById('apptType').value,
        date: document.getElementById('apptDate').value,
        time: document.getElementById('apptTime').value,
        status: 'Waiting'
    };

    // التحقق أن المستخدم اختار مريضاً من القائمة (يمتلك ID)
    if (!newAppointment.patient_id) {
        alert("Please select a patient from the search suggestions.");
        return;
    }

    if (!newAppointment.date || !newAppointment.time) {
        alert("Please select date and time.");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[18px]">autorenew</span> Saving...`;

    try {
        const { error } = await supabase
            .from('appointments')
            .insert([newAppointment]);

        if (error) throw error;

        // إغلاق النافذة المنبثقة، تفريغ النموذج، وإعادة تحميل البيانات
        if (typeof closeModal === 'function') closeModal('addAppointmentModal');
        document.getElementById('form-add-appointment').reset();
        document.getElementById('apptPatientId').value = ''; // تفريغ الـ ID
        
        await loadAndRenderAppointments(); // تحديث الواجهة فوراً

    } catch (err) {
        console.error("Error saving appointment:", err);
        alert("Failed to save appointment. Check console for details.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">event_available</span> Confirm Booking`;
    }
}