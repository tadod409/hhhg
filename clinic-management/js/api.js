// js/api.js

// 1. استدعاء مكتبة Supabase مباشرة وبشكل آمن
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://lmugtdkkjditymwtvqqp.supabase.co';

// ⚠️ يفضل استبدال هذا المفتاح بمفتاح anon public وعدم استخدام service_role في الـ Frontend
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdWd0ZGtramRpdHltd3R2cXFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4MDU1NjQsImV4cCI6MjA5OTM4MTU2NH0.NlN1Xu0UYPodS0ZR9ZLOKIANqLLLx5Hysm-mLAen4Vs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// المرضى (Patients)
// ==========================================

async function getAllPatients() {
    const { data, error } = await supabase
        .from('patients')
        .select('*');

    if (error) {
        console.error('Error fetching patients:', error);
        return [];
    }

    return data;
}

async function getPatientById(patientId) {
    const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

    if (error) {
        console.error('Error fetching patient details:', error);
        return null;
    }

    return data;
}

async function addPatient(patientData) {
    const { data, error } = await supabase
        .from('patients')
        .insert([patientData])
        .select();
        
    if (error) {
        console.error('Supabase Insert Error:', error);
    }

    return { data, error };
}

async function updatePatient(patientId, updatedData) {
    const { data, error } = await supabase
        .from('patients')
        .update(updatedData)
        .eq('id', patientId)
        .select();

    if (error) {
        console.error('Error updating patient:', error);
    }

    return { data, error };
}

// ==========================================
// المواعيد (Appointments)
// ==========================================

async function getAllAppointments() {
    const { data, error } = await supabase
        .from('appointments')
        .select('*, doctors(name), patients(name)');

    if (error) {
        console.error('Error fetching appointments:', error);
        return [];
    }

    return data;
}

async function getUpcomingAppointments() {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('appointments')
        .select(`
            id,
            date,
            time,
            type,
            status,
            patients (
                id,
                name
            )
        `)
        .eq('date', today)
        .order('time', { ascending: true })
        .limit(5);

    return { data, error };
}

async function addAppointment(apptData) {
    const { data, error } = await supabase
        .from('appointments')
        .insert([apptData])
        .select();

    return { data, error };
}

// ==========================================
// المصادقة (Authentication)
// ==========================================

async function loginUser(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        console.error("Supabase Error Details:", error);
    }

    return { data, error };
}

async function checkSession() {
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
}

async function logoutUser() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

// ==========================================
// لوحة التحكم (Dashboard)
// ==========================================

async function getDashboardStats() {
    try {
        const { count: patientsCount } = await supabase
            .from('patients')
            .select('*', { count: 'exact', head: true });

        const todayStr = new Date().toISOString().split('T')[0];

        const { count: apptsCount } = await supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('date', todayStr);

        return {
            totalPatients: patientsCount || 0,
            appointmentsToday: apptsCount || 0,
            revenueToday: 0
        };

    } catch (e) {
        console.error(e);
        return { totalPatients: 0, appointmentsToday: 0, revenueToday: 0 };
    }
}

// ==========================================
// الزيارات الطبية (Visits)
// ==========================================

async function getPatientVisits(patientId) {
    const { data, error } = await supabase
        .from('visits')
        .select('*')
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false });

    if (error) {
        console.error('Error fetching visits:', error);
        return [];
    }
    return data;
}

async function addVisit(visitData) {
    const { data, error } = await supabase
        .from('visits')
        .insert([visitData])
        .select();

    if (error) {
        console.error('Error adding visit:', error);
    }
    return { data, error };
}

// ==========================================
// Google Drive Integration (Edge Function)
// ==========================================

async function createPatientFolder(patientName) {
    const functionUrl = `${SUPABASE_URL}/functions/v1/manage-drive`;
    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                action: 'create_folder', 
                patientName: patientName 
            })
        });
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data.folderId || null;
    } catch (error) {
        console.error('Error connecting to Edge Function:', error);
        return null;
    }
}

// ✨ دالة رفع الملفات إلى Google Drive
async function uploadVisitFile(driveFolderId, file) {
    const functionUrl = `${SUPABASE_URL}/functions/v1/manage-drive`;
    
    return new Promise((resolve, reject) => {
        // تحويل الملف إلى Base64 لكي يتم إرساله للـ Edge Function
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64Data = reader.result.split(',')[1];
            try {
                const response = await fetch(functionUrl, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'upload_file',
                        folderId: driveFolderId,
                        fileName: file.name,
                        mimeType: file.type,
                        fileData: base64Data
                    })
                });
                
                const data = await response.json();
                resolve(data.fileUrl || null);
            } catch (error) {
                console.error('Drive Upload Error:', error);
                resolve(null);
            }
        };
        reader.onerror = (error) => reject(error);
    });
}

// ==========================================
// Exports (✨ تم إصلاح القائمة وإضافة كل الدوال الناقصة)
// ==========================================

export {
    supabase,
    getAllPatients,
    getPatientById,
    addPatient,
    updatePatient,
    getAllAppointments,
    getUpcomingAppointments,
    addAppointment,
    loginUser,
    checkSession,
    logoutUser,
    getDashboardStats,
    createPatientFolder,
    getPatientVisits,
    addVisit,
    uploadVisitFile
};