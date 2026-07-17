// js/patients.js
import { checkSession, getAllPatients, logoutUser, addPatient } from './api.js';

let allPatients = []; // لتخزين جميع المرضى لعملية البحث الداخلي

document.addEventListener('DOMContentLoaded', async () => {
    // 1. حارس الأمان (Auth Guard)
    const session = await checkSession();
    if (!session) {
        window.location.replace('index.html');
        return; // توقيف السكربت لو مفيش جلسة
    } else {
        // استخراج اسم الدكتور وعرضه في الشريط الجانبي
        const userEmail = session.user.email;
        const doctorName = userEmail.split('@')[0];
        const sidebarName = document.getElementById('sidebar-user-name');
        if(sidebarName) sidebarName.textContent = `Dr. ${doctorName}`;
    }

    // 2. تفعيل زر تسجيل الخروج (Logout)
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await logoutUser();
            window.location.replace('index.html');
        });
    }

    // 3. تحميل بيانات المرضى فوراً من السيرفر
    await loadPatients();

    // 4. تفعيل خانات البحث والفلترة الحية
    const searchNameInput = document.getElementById('searchName');
    const searchPhoneInput = document.getElementById('searchPhone');

    if (searchNameInput) searchNameInput.addEventListener('input', filterPatients);
    if (searchPhoneInput) searchPhoneInput.addEventListener('input', filterPatients);

    // =========================================================================
    // 🛡️ 5. معالجة إرسال نموذج إضافة مريض جديد (إرسال البيانات للسيرفر)
    // =========================================================================
    const addPatientForm = document.getElementById('form-add-patient') || document.getElementById('addPatientForm');
    if (addPatientForm) {
        addPatientForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // منع الصفحة من إعادة التحميل التقليدية
            
            // قراءة وتجميع كافة الحقول الجديدة المتوافقة مع بنية قاعدة البيانات
            const newPatientData = {
                name: (document.getElementById('patient-name') || document.getElementById('newPatientName'))?.value.trim(),
                national_id: document.getElementById('patient-national-id')?.value.trim() || null,
                date_of_birth: document.getElementById('patient-dob')?.value || null,
                age: document.getElementById('patient-age')?.value ? parseInt(document.getElementById('patient-age').value) : null,
                gender: document.getElementById('patient-gender')?.value || null,
                phone: (document.getElementById('patient-phone') || document.getElementById('newPatientPhone'))?.value.trim(),
                email: document.getElementById('patient-email')?.value.trim() || null,
                address: document.getElementById('patient-address')?.value.trim() || null,
                emergency_contact_name: document.getElementById('patient-emergency-name')?.value.trim() || null,
                emergency_contact_phone: document.getElementById('patient-emergency-phone')?.value.trim() || null,
                blood_type: document.getElementById('patient-blood')?.value || null,
                insurance_provider: document.getElementById('patient-insurance')?.value.trim() || null,
                medical_notes: document.getElementById('patient-notes')?.value.trim() || null
            };

            try {
                // إرسال البيانات المجمعة إلى Supabase عن طريق دالة addPatient
                const { data, error } = await addPatient(newPatientData);
                if (error) throw error;

                alert('تم تسجيل المريض بنجاح وحفظ الملف الطبي في السيرفر!');
                
                // إعادة تعيين الحقول وإغلاق النافذة المنبثقة
                addPatientForm.reset();
                if (typeof closeModal === 'function') {
                    closeModal('addPatientModal');
                } else {
                    const modal = document.getElementById('addPatientModal');
                    if (modal) {
                        modal.classList.remove('show');
                        modal.classList.add('hidden');
                    }
                }

                // تحديث الجدول فوراً ليعرض المريض الجديد دون الحاجة لعمل Refresh للمتصفح
                await loadPatients();

            } catch (err) {
                console.error('حدث خطأ أثناء حفظ المريض:', err);
                alert('فشل الاتصال بالسيرفر لحفظ البيانات. يرجى التحقق من المدخلات.');
            }
        });
    }
});

// دالة جلب المرضى من السيرفر
async function loadPatients() {
    const tableBody = document.getElementById('patientTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-10">جاري تحميل بيانات المرضى من السيرفر...</td></tr>';
    
    try {
        allPatients = await getAllPatients();
        
        // تحديث أرقام الإحصائيات في نصوص الصفحة
        const countText = document.getElementById('total-patients-text');
        if(countText) countText.textContent = `Manage and view all registered patients (${allPatients.length} total).`;
        
        const paginationText = document.getElementById('pagination-info');
        if(paginationText) paginationText.textContent = `Showing 1 to ${allPatients.length} of ${allPatients.length} patients`;

        // رسم الجدول بالبيانات الحقيقية
        renderTable(allPatients);
    } catch (err) {
        console.error("خطأ أثناء جلب المرضى:", err);
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-error">فشل الاتصال بالسيرفر لجلب البيانات.</td></tr>';
    }
}

// دالة رسم الجدول وتفعيل التوجيه للبروفايل عند الضغط
function renderTable(patientsArray) {
    const tableBody = document.getElementById('patientTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';

    if (!patientsArray || patientsArray.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-on-surface-variant">لا يوجد مرضى يطابقون البحث.</td></tr>';
        return;
    }

    patientsArray.forEach(patient => {
        const row = document.createElement('tr');
        row.className = "hover:bg-surface-container-low/50 transition-colors group cursor-pointer";
        
        // التوجيه لصفحة البروفايل بالـ ID
        row.onclick = () => {
            window.location.href = `profile.html?id=${patient.id}`;
        };
        
        const patientName = patient.name || 'غير معروف';
        const initials = patientName.substring(0, 2).toUpperCase();
        const createdDate = patient.created_at ? new Date(patient.created_at).toLocaleDateString() : 'N/A';
        const shortId = patient.id ? patient.id.split('-')[0].toUpperCase() : 'UNKNOWN';

        row.innerHTML = `
            <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-primary-container text-primary font-bold flex items-center justify-center shrink-0">
                        ${initials}
                    </div>
                    <div>
                        <p class="font-bold text-on-surface group-hover:text-primary transition-colors">${patientName}</p>
                        <p class="text-xs text-on-surface-variant mt-0.5">ID: ${shortId}</p>
                    </div>
                </div>
            </td>
            <td class="py-3 px-4">
                <p class="text-on-surface font-medium">${patient.phone || 'لا يوجد رقم'}</p>
                <p class="text-xs text-on-surface-variant mt-0.5">${patient.email || 'لا يوجد إيميل'}</p>
            </td>
            <td class="py-3 px-4">
                <p class="text-on-surface font-medium">${createdDate}</p>
                <p class="text-xs text-on-surface-variant mt-0.5">تاريخ التسجيل</p>
            </td>
            <td class="py-3 px-4">
                <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#dcfce7] text-[#065f46] border border-[#10b981]/20">
                    Active
                </span>
            </td>
            <td class="py-3 px-4 text-right">
                <button class="p-1.5 text-outline hover:text-primary hover:bg-primary-container/50 rounded-md transition-colors" onclick="event.stopPropagation();">
                    <span class="material-symbols-outlined text-[20px]">more_vert</span>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// دالة البحث الحية بالاسم أو الهاتف
function filterPatients() {
    const nameQuery = document.getElementById('searchName').value.toLowerCase();
    const phoneQuery = document.getElementById('searchPhone').value.toLowerCase();

    const filtered = allPatients.filter(p => {
        const matchesName = p.name ? p.name.toLowerCase().includes(nameQuery) : false;
        const matchesPhone = p.phone ? p.phone.toLowerCase().includes(phoneQuery) : false;
        return matchesName && matchesPhone;
    });

    renderTable(filtered);
}