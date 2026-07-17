// js/profile.js

// ✨ تم إضافة الدوال الناقصة (getPatientVisits, uploadVisitFile) في سطر الاستيراد
import { 
    checkSession, 
    logoutUser, 
    getPatientById, 
    updatePatient, 
    addVisit, 
    getPatientVisits,
    uploadVisitFile 
} from './api.js';

let currentPatient = null;

// دالة لتأمين النصوص
const escapeHTML = (str) => {
    if (!str) return '';
    return str.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Profile Initializing...");

    // 1. فحص الجلسة (Auth)
    const session = await checkSession();
    if (!session) {
        window.location.replace('index.html');
        return;
    } else {
        const doctorName = escapeHTML(session.user.email).split('@')[0];
        const sidebarName = document.getElementById('sidebar-user-name');
        if (sidebarName) sidebarName.textContent = `Dr. ${doctorName}`;
    }

    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await logoutUser();
        window.location.replace('index.html');
    });

    // 2. استخراج الـ ID الخاص بالمريض من الرابط
    const urlParams = new URLSearchParams(window.location.search);
    const patientId = urlParams.get('id');

    if (!patientId) {
        alert("Patient ID is missing!");
        window.location.replace('patients.html');
        return;
    }

    // 3. تحميل الصفحة
    await loadPatientProfile(patientId);
    await loadVisits(patientId);

    // ==========================================
    // 4. معالجة نموذج (تعديل المريض)
    // ==========================================
    const editPatientForm = document.getElementById('form-edit-patient');
    if (editPatientForm) {
        editPatientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const updatedData = {
                name: document.getElementById('editName')?.value.trim(),
                national_id: document.getElementById('editNationalId')?.value.trim() || null,
                date_of_birth: document.getElementById('editBirthDate')?.value || null,
                gender: document.getElementById('editGender')?.value || null,
                phone: document.getElementById('editPhone')?.value.trim() || null,
                email: document.getElementById('editEmail')?.value.trim() || null,
                address: document.getElementById('editAddress')?.value.trim() || null,
                blood_type: document.getElementById('editBlood')?.value || null,
                insurance_provider: document.getElementById('editInsurance')?.value.trim() || null,
                medical_notes: document.getElementById('editNotes')?.value.trim() || null,
                emergency_contact_name: document.getElementById('editEmergencyName')?.value.trim() || null,
                emergency_contact_phone: document.getElementById('editEmergencyPhone')?.value.trim() || null,
                height: document.getElementById('editHeight')?.value ? parseFloat(document.getElementById('editHeight').value) : null,
                weight: document.getElementById('editWeight')?.value ? parseFloat(document.getElementById('editWeight').value) : null,
                allergies: document.getElementById('editAllergies')?.value.trim() || null,
                chronic_diseases: document.getElementById('editDiseases')?.value.trim() || null,
            };

            const btn = document.getElementById('savePatientChanges');
            btn.innerHTML = 'Saving...';
            btn.disabled = true;

            try {
                const { error } = await updatePatient(patientId, updatedData);
                if (error) throw error;
                
                alert("Patient details updated successfully!");
                closeModal('editPatientModal');
                await loadPatientProfile(patientId); 
            } catch (err) {
                console.error("Update Error:", err);
                alert("Failed to update patient data.");
            } finally {
                btn.innerHTML = 'Save Changes';
                btn.disabled = false;
            }
        });
    }

    // ==========================================
    // 5. معالجة نموذج (إضافة زيارة جديدة + رفع الملفات)
    // ==========================================
    const addVisitForm = document.getElementById('form-add-visit');
    if (addVisitForm) {
        addVisitForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('saveVisitDetails');
            btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">autorenew</span> Saving...';
            btn.disabled = true;

            try {
                // 1. التعامل مع رفع الملفات
                const fileInput = document.getElementById('visitFiles');
                let fileUrls = []; 

                if (fileInput && fileInput.files.length > 0) {
                    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">cloud_upload</span> Uploading Files...';
                    
                    for (const file of fileInput.files) {
                        const url = await uploadVisitFile(patientId, file);
                        if (url) fileUrls.push(url);
                    }
                }

                // 2. تجميع بيانات الزيارة
                const newVisit = {
                    patient_id: patientId,
                    clinical_examination: document.getElementById('clinicalExamination')?.value.trim() || null,
                    diagnosis: document.getElementById('diagnosis')?.value.trim() || null,
                    icd_code: document.getElementById('icdCode')?.value.trim() || null,
                    prescription: document.getElementById('prescription')?.value.trim() || null,
                    lab_orders: document.getElementById('labOrders')?.value.trim() || null,
                    radiology_orders: document.getElementById('radiologyOrders')?.value.trim() || null,
                    follow_up_date: document.getElementById('followUpDate')?.value || null,
                    attachments: fileUrls.length > 0 ? fileUrls.join(',') : null 
                };

                // 3. الإرسال للسيرفر
                btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">autorenew</span> Saving Record...';
                const { error } = await addVisit(newVisit);
                if (error) throw error;

                alert("Clinical encounter & files saved successfully!");
                closeModal('addVisitModal');
                addVisitForm.reset();
                
                await loadVisits(patientId); 

            } catch (err) {
                console.error("Visit Save Error:", err);
                alert("Failed to save encounter. Please check console for details.");
            } finally {
                btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">save</span> Save Encounter';
                btn.disabled = false;
            }
        });
    }
});

// ==========================================
// الدوال المساعدة لجلب وعرض البيانات
// ==========================================

async function loadPatientProfile(patientId) {
    try {
        currentPatient = await getPatientById(patientId);
        if (!currentPatient) {
            alert("Patient not found!");
            window.location.replace('patients.html');
            return;
        }

        const name = escapeHTML(currentPatient.name) || 'Unknown Patient';
        document.getElementById('breadcrumb-patient-name').textContent = name;
        document.getElementById('patient-name-display').textContent = name;
        document.getElementById('patient-avatar-placeholder').textContent = name.substring(0, 2).toUpperCase();
        
        const displayId = currentPatient.national_id ? escapeHTML(currentPatient.national_id) : currentPatient.id.split('-')[0].toUpperCase();
        document.getElementById('patient-mrn-display').textContent = displayId;
        
        let ageStr = '--';
        if (currentPatient.age) {
            ageStr = `${currentPatient.age}y`;
        } else if (currentPatient.date_of_birth) {
            const birthYear = new Date(currentPatient.date_of_birth).getFullYear();
            ageStr = `${new Date().getFullYear() - birthYear}y`;
        }
        document.getElementById('patient-age-gender-display').textContent = `${ageStr}, ${escapeHTML(currentPatient.gender) || 'Unknown'}`;
        document.getElementById('patient-blood-display').textContent = escapeHTML(currentPatient.blood_type) || '--';
        document.getElementById('patient-phone-display').textContent = escapeHTML(currentPatient.phone) || '--';

        if(document.getElementById('vital-weight') && currentPatient.weight) {
            document.getElementById('vital-weight').textContent = `${currentPatient.weight} kg`;
        }
        if(document.getElementById('vital-height') && currentPatient.height) {
            document.getElementById('vital-height').textContent = `${currentPatient.height} cm`;
        }

        const alertsContainer = document.getElementById('medical-alerts-container');
        const overviewProblems = document.getElementById('overview-active-problems');
        
        alertsContainer.innerHTML = ''; 
        overviewProblems.innerHTML = ''; 

        if (currentPatient.allergies) {
            alertsContainer.innerHTML += `
                <div class="bg-error/10 text-error px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-error/20">
                    <span class="material-symbols-outlined text-[18px]">warning</span> Allergy: ${escapeHTML(currentPatient.allergies)}
                </div>`;
            overviewProblems.innerHTML += `<li class="text-sm font-semibold text-error">Allergies: ${escapeHTML(currentPatient.allergies)}</li>`;
        }
        if (currentPatient.chronic_diseases) {
            alertsContainer.innerHTML += `
                <div class="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-orange-200">
                    <span class="material-symbols-outlined text-[18px]">warning</span> Chronic: ${escapeHTML(currentPatient.chronic_diseases)}
                </div>`;
            overviewProblems.innerHTML += `<li class="text-sm font-semibold text-orange-700">Chronic Diseases: ${escapeHTML(currentPatient.chronic_diseases)}</li>`;
        }
        if (currentPatient.medical_notes) {
            overviewProblems.innerHTML += `<li class="text-sm text-on-surface whitespace-pre-wrap mt-2">Notes: ${escapeHTML(currentPatient.medical_notes)}</li>`;
        }
        
        if(overviewProblems.innerHTML === '') {
            overviewProblems.innerHTML = '<li class="text-sm text-outline">No active medical records found.</li>';
        }

        document.getElementById('editName').value = currentPatient.name || '';
        document.getElementById('editNationalId').value = currentPatient.national_id || '';
        document.getElementById('editBirthDate').value = currentPatient.date_of_birth || '';
        document.getElementById('editGender').value = currentPatient.gender || 'Male';
        document.getElementById('editPhone').value = currentPatient.phone || '';
        document.getElementById('editEmail').value = currentPatient.email || '';
        document.getElementById('editAddress').value = currentPatient.address || '';
        document.getElementById('editBlood').value = currentPatient.blood_type || '';
        document.getElementById('editInsurance').value = currentPatient.insurance_provider || '';
        document.getElementById('editNotes').value = currentPatient.medical_notes || '';
        document.getElementById('editEmergencyName').value = currentPatient.emergency_contact_name || '';
        document.getElementById('editEmergencyPhone').value = currentPatient.emergency_contact_phone || '';
        
        if (document.getElementById('editHeight')) document.getElementById('editHeight').value = currentPatient.height || '';
        if (document.getElementById('editWeight')) document.getElementById('editWeight').value = currentPatient.weight || '';
        if (document.getElementById('editAllergies')) document.getElementById('editAllergies').value = currentPatient.allergies || '';
        if (document.getElementById('editDiseases')) document.getElementById('editDiseases').value = currentPatient.chronic_diseases || '';

    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

async function loadVisits(patientId) {
    const visitsContainer = document.getElementById('timeline-list');
    if (!visitsContainer) return;

    try {
        const visits = await getPatientVisits(patientId);
        
        const statVisits = document.getElementById('stat-visits');
        if (statVisits) statVisits.textContent = visits.length;

        if (visits.length === 0) {
            visitsContainer.innerHTML = '<div class="text-center text-sm text-outline py-10">No past visits recorded.</div>';
            return;
        }

        const lastVisitStat = document.getElementById('stat-last-visit');
        if (lastVisitStat) lastVisitStat.textContent = new Date(visits[0].visit_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

        visitsContainer.innerHTML = ''; 

        visits.forEach((visit, index) => {
            const visitDate = new Date(visit.visit_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const title = visit.diagnosis || `Clinical Encounter #${visits.length - index}`;
            const details = visit.clinical_examination ? escapeHTML(visit.clinical_examination).substring(0, 150) + '...' : 'No clinical examination details provided.';

            visitsContainer.innerHTML += `
                <div class="bg-surface rounded-xl border border-outline-variant/50 shadow-sm p-5 hover:border-primary transition-colors mb-4">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h3 class="font-bold text-lg text-primary">${escapeHTML(title)}</h3>
                            <p class="text-sm font-medium text-on-surface-variant flex items-center gap-1">
                                <span class="material-symbols-outlined text-[16px]">calendar_today</span> ${visitDate}
                            </p>
                        </div>
                        <button onclick="console.log('View Visit: ${visit.id}')" class="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition shadow">
                            View Details
                        </button>
                    </div>
                    <p class="text-sm text-on-surface-variant">${details}</p>
                </div>
            `;
        });

    } catch (err) {
        console.error("Error loading visits:", err);
        visitsContainer.innerHTML = '<div class="text-center text-sm text-error py-10">Failed to load visits.</div>';
    }
}