// js/dashboard.js
import { 
    checkSession, 
    logoutUser, 
    getDashboardStats, 
    getUpcomingAppointments, 
    getAllPatients, 
    addPatient, 
    addAppointment 
} from './api.js';

const escapeHTML = (str) => {
    if (!str) return '';
    return str.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

document.addEventListener('DOMContentLoaded', async () => {

    // ==========================================
    // 1. تشغيل واجهة المستخدم فوراً (UI Logic First)
    // ==========================================
    console.log("UI Initializing..."); // للتأكد أن الملف يعمل

    const patientModal = document.getElementById('modal-add-patient');
    const appointmentModal = document.getElementById('modal-add-appointment');

    const openModal = (modal) => {
        if (modal) {
            modal.classList.remove('hidden');
            console.log("Modal opened!");
        }
    };
    
    const closeModal = (modal, formId) => {
        if (modal) {
            modal.classList.add('hidden');
            if (formId) document.getElementById(formId)?.reset();
        }
    };

    // ربط زر إضافة مريض
    document.getElementById('open-patient-modal')?.addEventListener('click', () => {
        console.log("Add Patient clicked");
        openModal(patientModal);
    });

    // ربط زر إضافة موعد
    document.getElementById('open-appointment-modal')?.addEventListener('click', async () => {
        console.log("Add Appointment clicked");
        openModal(appointmentModal);
        
        const patientSelect = document.getElementById('appt-patient-id');
        if (!patientSelect) return;

        try {
            patientSelect.innerHTML = '<option value="">Loading patients...</option>';
            const patients = await getAllPatients();
            patientSelect.innerHTML = '<option value="">Select a patient...</option>';
            
            if (patients && patients.length > 0) {
                patients.forEach(p => {
                    const option = document.createElement('option');
                    option.value = escapeHTML(p.id);
                    option.textContent = escapeHTML(p.name);
                    patientSelect.appendChild(option);
                });
            }
        } catch (err) {
            console.error('Error loading patients:', err);
            patientSelect.innerHTML = '<option value="">Error loading data</option>';
        }
    });

    // ربط أزرار الإغلاق
    document.getElementById('close-patient-modal')?.addEventListener('click', () => closeModal(patientModal, 'form-add-patient'));
    document.getElementById('cancel-patient-modal')?.addEventListener('click', () => closeModal(patientModal, 'form-add-patient'));
    document.getElementById('close-appointment-modal')?.addEventListener('click', () => closeModal(appointmentModal, 'form-add-appointment'));
    document.getElementById('cancel-appointment-modal')?.addEventListener('click', () => closeModal(appointmentModal, 'form-add-appointment'));

    // ==========================================
    // 2. التحقق من الجلسة (Session Check)
    // ==========================================
    // تم إيقاف التوجيه التلقائي (Redirect) مؤقتاً لتتمكن من تجربة الواجهة 
    try {
        const session = await checkSession();
        if (!session) {
            console.warn('No active session. Authentication required for DB operations.');
             window.location.replace('index.html'); // يمكنك تفعيلها لاحقاً
        } else {
            const userEmail = escapeHTML(session.user.email);
            const doctorName = userEmail.split('@')[0];
            document.getElementById('sidebar-user-name').textContent = doctorName;
            document.getElementById('welcome-name').textContent = `Dr. ${doctorName}`;
        }
    } catch (err) {
        console.error('Session Error:', err);
    }

    const todayOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', todayOptions);

    // ==========================================
    // 3. جلب بيانات الداشبورد وإرسال النماذج
    // ==========================================
    async function loadDashboardData() {
        try {
            const stats = await getDashboardStats();
            if (stats) {
                document.getElementById('stat-appointments').textContent = escapeHTML(stats.appointmentsToday);
                document.getElementById('stat-patients').textContent = escapeHTML(stats.totalPatients);
                document.getElementById('stat-revenue').textContent = `$${escapeHTML(stats.revenueToday)}`;
            }

            const apptsContainer = document.getElementById('upcoming-appointments-list');
            if (!apptsContainer) return;

            const { data: appts } = await getUpcomingAppointments();
            apptsContainer.innerHTML = ''; 
            
            if (!appts || appts.length === 0) {
                apptsContainer.innerHTML = `<div class="text-center text-sm text-outline mt-10">No appointments scheduled for today.</div>`;
                return;
            }

            appts.forEach(appt => {
                const patientName = appt.patients?.name ? escapeHTML(appt.patients.name) : 'Unknown';
                const initial = patientName.substring(0, 2).toUpperCase();
                apptsContainer.insertAdjacentHTML('beforeend', `
                    <div class="p-3 bg-surface border border-outline-variant/50 hover:bg-surface-container-low transition-colors rounded-xl flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold text-sm shrink-0">
                            ${initial}
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-on-surface truncate">${patientName}</p>
                            <p class="text-xs text-on-surface-variant truncate">${escapeHTML(appt.type)}</p>
                        </div>
                        <div class="text-right shrink-0">
                            <p class="text-sm font-bold text-on-surface">${appt.time ? escapeHTML(appt.time.substring(0, 5)) : '--:--'}</p>
                        </div>
                    </div>
                `);
            });
        } catch (err) {
            console.error('Dashboard Data Fetch Error:', err);
        }
    }

    loadDashboardData();

    // إرسال نماذج الإضافة
    document.getElementById('form-add-patient')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const newPatient = {
                name: document.getElementById('patient-name')?.value.trim(),
                phone: document.getElementById('patient-phone')?.value.trim(),
                age: document.getElementById('patient-age')?.value ? parseInt(document.getElementById('patient-age').value) : null,
                gender: document.getElementById('patient-gender')?.value || null,
                blood_type: document.getElementById('patient-blood')?.value || null,
                national_id: document.getElementById('patient-national-id')?.value.trim() || null,
                date_of_birth: document.getElementById('patient-dob')?.value || null,
                email: document.getElementById('patient-email')?.value.trim() || null,
                address: document.getElementById('patient-address')?.value.trim() || null,
                emergency_contact_name: document.getElementById('patient-emergency-name')?.value.trim() || null,
                emergency_contact_phone: document.getElementById('patient-emergency-phone')?.value.trim() || null,
                insurance_provider: document.getElementById('patient-insurance')?.value.trim() || null,
                medical_notes: document.getElementById('patient-notes')?.value.trim() || null
            };
            const { error } = await addPatient(newPatient);
            if (error) throw error;
            alert('Patient added successfully!');
            closeModal(patientModal, 'form-add-patient');
            loadDashboardData();
        } catch (err) {
            console.error(err);
            alert('Failed to save patient.');
        }
    });

    document.getElementById('form-add-appointment')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const newAppt = {
                patient_id: document.getElementById('appt-patient-id').value,
                date: document.getElementById('appt-date').value,
                time: document.getElementById('appt-time').value,
                type: document.getElementById('appt-type').value,
                status: 'Scheduled'
            };
            if (!newAppt.patient_id) return alert('Select a patient.');
            const { error } = await addAppointment(newAppt);
            if (error) throw error;
            alert('Appointment scheduled!');
            closeModal(appointmentModal, 'form-add-appointment');
            loadDashboardData();
        } catch (err) {
            console.error(err);
            alert('Failed to schedule appointment.');
        }
    });

    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        if (confirm("Logout?")) {
            await logoutUser();
            window.location.replace('index.html'); 
        }
    });
    async function createPatientFolder(patientName) {
    const supabaseUrl = 'https://lmugtdkkjditymwtvqqp.supabase.co/functions/v1/manage-drive';
    // ملاحظة: استخدم مفتاح anon public الخاص بمشروعك
    const anonKey = 'YOUR_SUPABASE_ANON_KEY'; 

    try {
        const response = await fetch(supabaseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${anonKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ patientName: patientName })
        });

        if (!response.ok) {
            throw new Error('حدث خطأ أثناء الاتصال بالفانكشن');
        }

        const data = await response.json();
        console.log("تم إنشاء المجلد بنجاح! الـ ID هو:", data.folderId);
        return data.folderId; // هذا الـ ID هو الذي ستخزنه في جدول المرضى في Supabase

    } catch (error) {
        console.error("خطأ في الاتصال:", error);
    }
}
});