// js/profile.js

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
let currentVisits = []; // متغير جديد لحفظ الزيارات واستخدامها في النافذة المنبثقة

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
                const m = document.getElementById('editPatientModal');
                if(m) { m.classList.remove('show'); setTimeout(() => m.classList.add('hidden'), 300); }
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
                // التعامل مع رفع الملفات
                const fileInput = document.getElementById('visitFiles');
                let fileUrls = []; 

                if (fileInput && fileInput.files.length > 0) {
                    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">cloud_upload</span> Uploading Files...';
                    
                    for (const file of fileInput.files) {
                        const url = await uploadVisitFile(patientId, file);
                        if (url) fileUrls.push(url);
                    }
                }

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

                btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">autorenew</span> Saving Record...';
                const { error } = await addVisit(newVisit);
                if (error) throw error;

                alert("Clinical encounter & files saved successfully!");
                const m = document.getElementById('addVisitModal');
                if(m) { m.classList.remove('show'); setTimeout(() => m.classList.add('hidden'), 300); }
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
// دالة نافذة التفاصيل (تعمل عند الضغط على الزر)
// ==========================================
window.viewVisitDetails = (visitId) => {
    const visit = currentVisits.find(v => v.id === visitId);
    if (!visit) return;

    // تعبئة البيانات في النافذة
    const visitDate = new Date(visit.visit_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    document.getElementById('visitDetailDate').textContent = visitDate;

    // تجهيز قائمة الملفات إن وجدت
    let filesHtml = '';
    if (visit.attachments) {
        const files = visit.attachments.split(',');
        filesHtml = `<div class="mt-4"><h4 class="font-bold text-sm text-primary mb-2">Attached Files</h4><div class="flex gap-2 flex-wrap">`;
        files.forEach((url, i) => {
            filesHtml += `<a href="${url}" target="_blank" class="px-3 py-1.5 bg-primary-container text-primary rounded-lg text-xs font-bold hover:bg-primary hover:text-white transition">File ${i + 1} <span class="material-symbols-outlined text-[14px] align-middle">open_in_new</span></a>`;
        });
        filesHtml += `</div></div>`;
    }

    const container = document.getElementById('visitDetailsContainer');
    container.innerHTML = `
        <div class="space-y-5">
            <div class="bg-surface border p-4 rounded-xl">
                <h4 class="font-bold text-sm text-outline uppercase mb-2">Diagnosis</h4>
                <p class="font-semibold text-lg">${escapeHTML(visit.diagnosis) || 'No diagnosis recorded'}</p>
                <p class="text-sm text-on-surface-variant mt-1">ICD Code: <span class="font-mono bg-surface-container px-2 py-0.5 rounded">${escapeHTML(visit.icd_code) || 'N/A'}</span></p>
            </div>
            
            <div class="bg-surface border p-4 rounded-xl">
                <h4 class="font-bold text-sm text-outline uppercase mb-2">Clinical Examination</h4>
                <p class="text-sm text-on-surface whitespace-pre-wrap">${escapeHTML(visit.clinical_examination) || '--'}</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-surface border p-4 rounded-xl">
                    <h4 class="font-bold text-sm text-outline uppercase mb-2">Prescription</h4>
                    <p class="text-sm text-on-surface whitespace-pre-wrap">${escapeHTML(visit.prescription) || '--'}</p>
                </div>
                <div class="bg-surface border p-4 rounded-xl space-y-4">
                    <div>
                        <h4 class="font-bold text-sm text-outline uppercase mb-2">Lab Orders</h4>
                        <p class="text-sm text-on-surface whitespace-pre-wrap">${escapeHTML(visit.lab_orders) || '--'}</p>
                    </div>
                    <div>
                        <h4 class="font-bold text-sm text-outline uppercase mb-2">Radiology</h4>
                        <p class="text-sm text-on-surface whitespace-pre-wrap">${escapeHTML(visit.radiology_orders) || '--'}</p>
                    </div>
                </div>
            </div>
            ${filesHtml}
        </div>
    `;

    // إظهار النافذة
    const m = document.getElementById('visitDetailsModal');
    if (m) {
        m.classList.remove('hidden');
        setTimeout(() => m.classList.add('show'), 10);
    }
};

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
    // تحديد الحاويات للأقسام المختلفة
    const visitsContainer = document.getElementById('timeline-list');
    const prescriptionsList = document.getElementById('prescriptions-list');
    const laboratoryTbody = document.getElementById('laboratory-tbody');
    const radiologyGrid = document.getElementById('radiology-grid');
    const filesGrid = document.getElementById('files-grid');

    if (!visitsContainer) return;

    try {
        currentVisits = await getPatientVisits(patientId);
        const visits = currentVisits;
        
        const statVisits = document.getElementById('stat-visits');
        if (statVisits) statVisits.textContent = visits.length;

        if (visits.length === 0) {
            visitsContainer.innerHTML = '<div class="text-center text-sm text-outline py-10">No past visits recorded.</div>';
            return;
        }

        const lastVisitStat = document.getElementById('stat-last-visit');
        if (lastVisitStat) lastVisitStat.textContent = new Date(visits[0].visit_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

        // تفريغ الأقسام قبل التعبئة
        visitsContainer.innerHTML = ''; 
        if(prescriptionsList) prescriptionsList.innerHTML = '';
        if(laboratoryTbody) laboratoryTbody.innerHTML = '';
        if(radiologyGrid) radiologyGrid.innerHTML = '';
        if(filesGrid) filesGrid.innerHTML = '';

        let hasPrescription = false, hasLab = false, hasRadiology = false, hasFiles = false;

        visits.forEach((visit, index) => {
            const visitDate = new Date(visit.visit_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const title = visit.diagnosis || `Clinical Encounter #${visits.length - index}`;
            const details = visit.clinical_examination ? escapeHTML(visit.clinical_examination).substring(0, 150) + '...' : 'No clinical examination details provided.';

            // 1. قسم الزيارات
            visitsContainer.innerHTML += `
                <div class="bg-surface rounded-xl border border-outline-variant/50 shadow-sm p-5 hover:border-primary transition-colors mb-4">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h3 class="font-bold text-lg text-primary">${escapeHTML(title)}</h3>
                            <p class="text-sm font-medium text-on-surface-variant flex items-center gap-1">
                                <span class="material-symbols-outlined text-[16px]">calendar_today</span> ${visitDate}
                            </p>
                        </div>
                        <button onclick="window.viewVisitDetails('${visit.id}')" class="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition shadow">
                            View Details
                        </button>
                    </div>
                    <p class="text-sm text-on-surface-variant">${details}</p>
                </div>
            `;

            // 2. قسم الوصفات الطبية
            if (visit.prescription && prescriptionsList) {
                hasPrescription = true;
                prescriptionsList.innerHTML += `
                    <div class="bg-surface rounded-xl border border-outline-variant/50 shadow-sm p-4 mb-3">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="material-symbols-outlined text-primary">prescriptions</span>
                            <span class="font-bold text-sm text-on-surface">${visitDate}</span>
                        </div>
                        <p class="text-sm text-on-surface-variant whitespace-pre-wrap">${escapeHTML(visit.prescription)}</p>
                    </div>
                `;
            }

            // 3. قسم التحاليل
            if (visit.lab_orders && laboratoryTbody) {
                hasLab = true;
                laboratoryTbody.innerHTML += `
                    <tr class="hover:bg-surface-container-low transition border-b border-outline-variant/30">
                        <td class="p-4 text-sm">${visitDate}</td>
                        <td class="p-4 text-sm font-semibold">${escapeHTML(visit.lab_orders)}</td>
                        <td class="p-4"><span class="px-2 py-1 bg-secondary-container text-secondary text-xs rounded-full font-bold">Ordered</span></td>
                        <td class="p-4 text-right"><button onclick="window.viewVisitDetails('${visit.id}')" class="text-primary hover:underline text-sm font-semibold">View</button></td>
                    </tr>
                `;
            }

            // 4. قسم الأشعة
            if (visit.radiology_orders && radiologyGrid) {
                hasRadiology = true;
                radiologyGrid.innerHTML += `
                    <div class="bg-surface rounded-xl border border-outline-variant/50 shadow-sm p-4">
                        <div class="flex items-center gap-2 mb-2 text-primary">
                            <span class="material-symbols-outlined">radiology</span>
                            <span class="font-bold text-sm">Order on ${visitDate.split(',')[0]}</span>
                        </div>
                        <p class="text-sm text-on-surface-variant">${escapeHTML(visit.radiology_orders)}</p>
                    </div>
                `;
            }

            // 5. قسم الملفات السحابية (Google Drive)
            if (visit.attachments && filesGrid) {
                hasFiles = true;
                const files = visit.attachments.split(',');
                files.forEach((fileUrl, i) => {
                    filesGrid.innerHTML += `
                        <div class="bg-surface rounded-xl border border-outline-variant/50 shadow-sm p-4 flex items-center justify-between hover:border-primary transition">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-lg bg-primary-container text-primary flex items-center justify-center">
                                    <span class="material-symbols-outlined">description</span>
                                </div>
                                <div>
                                    <p class="text-sm font-bold text-on-surface">Attachment ${i + 1}</p>
                                    <p class="text-xs text-on-surface-variant">${visitDate.split(',')[0]}</p>
                                </div>
                            </div>
                            <a href="${fileUrl}" target="_blank" class="p-2 rounded-lg bg-surface-container hover:bg-primary hover:text-white transition text-primary">
                                <span class="material-symbols-outlined text-[20px]">download</span>
                            </a>
                        </div>
                    `;
                });
            }
        });

        // رسائل الأقسام الفارغة
        if (!hasPrescription && prescriptionsList) prescriptionsList.innerHTML = '<div class="text-center text-sm text-outline py-10">No prescriptions found.</div>';
        if (!hasLab && laboratoryTbody) laboratoryTbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-outline">No laboratory records found.</td></tr>';
        if (!hasRadiology && radiologyGrid) radiologyGrid.innerHTML = '<div class="col-span-full text-center text-sm text-outline py-10">No radiology records found.</div>';
        if (!hasFiles && filesGrid) filesGrid.innerHTML = '<div class="col-span-full text-center text-sm text-outline py-10">No files synced from Google Drive.</div>';

    } catch (err) {
        console.error("Error loading visits:", err);
        visitsContainer.innerHTML = '<div class="text-center text-sm text-error py-10">Failed to load visits.</div>';
    }
}