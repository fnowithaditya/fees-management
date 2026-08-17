// FIREBASE CONFIGURATIONS
const primaryConfig = {
    apiKey: "AIzaSyCFv0Pmc8a684gCO7e96pZF2dEma0Basr4",
    authDomain: "school-management-7570a.firebaseapp.com",
    projectId: "school-management-7570a",
    storageBucket: "school-management-7570a.firebasestorage.app",
    messagingSenderId: "1001418504336",
    appId: "1:1001418504336:web:506d773e5974f86107c015"
};

const secondaryConfig = {
    apiKey: "AIzaSyD7AZGSsdKXxHADT7kEa2lnBqiueizzyQ0",
    authDomain: "studentmanage-lgps.firebaseapp.com",
    projectId: "studentmanage-lgps",
    storageBucket: "studentmanage-lgps.firebasestorage.app",
    messagingSenderId: "394244456290",
    appId: "1:394244456290:web:dc1562ff312963ba93363b"
};

const appPrimary = firebase.initializeApp(primaryConfig);
const db = appPrimary.firestore();
const auth = appPrimary.auth();

const appSecondary = firebase.initializeApp(secondaryConfig, "Secondary");
const dbSecondary = appSecondary.firestore();

let studentDetailsMap = {};
let allStudentsList = [];
let currentId = null;
let currentDb = null;
let currentStudentData = null;
let generatedReceiptText = "";

// --- FIREBASE AUTHENTICATION MANAGER ---
auth.onAuthStateChanged(user => {
    const loginOverlay = document.getElementById('loginOverlay');
    if (user) {
        if (loginOverlay) loginOverlay.style.display = 'none';
        loadClassMap();
        loadAllData();
    } else {
        if (loginOverlay) loginOverlay.style.display = 'flex';
    }
});

async function handleAdminLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value.trim();
    const errText = document.getElementById('loginError');

    if (!email || !pass) {
        errText.innerText = "Please enter both email and password.";
        errText.style.display = "block";
        return;
    }

    try {
        errText.style.display = "none";
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) {
        errText.innerText = "Login Failed: " + e.message;
        errText.style.display = "block";
    }
}

async function handleAdminLogout() {
    if (confirm("Are you sure you want to log out?")) {
        await auth.signOut();
        window.location.reload();
    }
}

// LOAD CLASS & PHONE MAP FROM STUDENTS.JSON SAFELY
async function loadClassMap() {
    try {
        const res = await fetch('./students.json');
        if (!res.ok) throw new Error("JSON file response not ok");
        const data = await res.json();
        data.forEach(s => {
            if (s && s.name) {
                studentDetailsMap[s.name.toUpperCase()] = {
                    class: s.class || "Unassigned",
                    phone: s.phone || ""
                };
            }
        });
    } catch (e) {
        console.warn("Could not load students.json map (Run on Live Server if testing locally):", e);
    }
}

function showPage(p) {
    document.querySelectorAll('.page-view').forEach(v => v.style.display = 'none');
    const target = document.getElementById(p + '-view');
    if (target) target.style.display = 'block';
    
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }

    if (p === 'admin') {
        populateAdminStudentDropdown();
    }
}

function getResolvedPhone(docPhone, jsonPhone) {
    if (docPhone && docPhone !== "000" && String(docPhone).trim() !== "") return docPhone;
    if (jsonPhone && jsonPhone !== "000" && String(jsonPhone).trim() !== "") return jsonPhone;
    return "No Phone";
}

// FETCH & RENDER ALL DATA WITH BULLETPROOF ERROR HANDLING
async function loadAllData() {
    const tbody = document.getElementById('studentData');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Loading Finance Data...</td></tr>';
    
    let totalCount = 0;
    let totalDues = 0;
    allStudentsList = [];

    const fetchProj = async (database, label) => {
        try {
            const snap = await database.collection("students").get();
            snap.forEach(doc => {
                const s = doc.data() || {};
                totalCount++;
                
                const dueAmt = Number(s.amount || 0);
                totalDues += dueAmt;

                const nameKey = String(s.name || "").toUpperCase();
                const mappedInfo = studentDetailsMap[nameKey] || {};

                const studentClass = s.class || mappedInfo.class || "Unassigned";
                const studentPhone = getResolvedPhone(s.phone, mappedInfo.phone);

                allStudentsList.push({
                    id: doc.id,
                    dbLabel: label,
                    dbRef: database,
                    name: s.name || 'Unnamed Student',
                    class: studentClass,
                    phone: studentPhone,
                    monthlyFee: Number(s.monthlyFee || 0),
                    amount: dueAmt,
                    totalPaid: Number(s.totalPaid || 0),
                    isPaid: s.isPaid || (dueAmt <= 0),
                    lastPaidAmt: Number(s.lastPaidAmt || 0),
                    lastPaymentDate: s.lastPaymentDate || '-',
                    data: s
                });
            });
        } catch (err) {
            console.error(`Error loading from ${label}:`, err);
        }
    };

    await fetchProj(db, "Main Project");
    await fetchProj(dbSecondary, "External Project");

    if (allStudentsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#f87171;">No records found or failed to connect to Firebase. Check internet connection.</td></tr>';
        document.getElementById('stat-count').innerText = "0";
        document.getElementById('stat-dues').innerText = "₹0";
        return;
    }

    allStudentsList.sort((a, b) => a.name.localeCompare(b.name));

    tbody.innerHTML = '';
    allStudentsList.forEach(s => {
        const row = document.createElement('tr');
        row.setAttribute('data-name', s.name.toLowerCase());
        row.setAttribute('data-class', s.class);

        row.innerHTML = `
            <td>
                <b>${s.name}</b> <small style="color:var(--primary)">[${s.class}]</small><br>
                <small style="color:var(--text-dim)">📞 ${s.phone}</small>
            </td>
            <td style="color:#f87171; font-weight:800">₹${s.amount}</td>
            <td><small>₹${s.lastPaidAmt}</small><br><small style="font-size:10px; color:var(--text-dim)">${s.lastPaymentDate}</small></td>
            <td>
                <button class="status-pill-ui ${s.isPaid ? 'paid' : 'pending'}" onclick="quickPayToggle('${s.id}', '${s.dbLabel}')">
                    ${s.isPaid ? 'PAID' : 'PAY DUE'}
                </button>
            </td>
            <td><button class="btn-repair" onclick="openProfile('${s.id}', '${s.dbLabel}')">Manage</button></td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('stat-count').innerText = totalCount;
    document.getElementById('stat-dues').innerText = `₹${totalDues.toLocaleString('en-IN')}`;
    
    populateAdminStudentDropdown();
}

// QUICK PAYMENT TOGGLE (WITH CASH / UPI PROMPT)
async function quickPayToggle(id, label) {
    const targetDb = (label === "Main Project") ? db : dbSecondary;
    const docRef = targetDb.collection("students").doc(id);
    const doc = await docRef.get();
    const s = doc.data() || {};

    if (s.isPaid || s.amount <= 0) {
        alert(`${s.name || 'Student'} is already fully paid.`);
        return;
    }

    const payStr = prompt(`Quick Pay Dues for ${s.name}\nCurrent Due: ₹${s.amount}\nEnter amount paid:`, s.amount);
    if (payStr === null) return;
    const payAmt = Number(payStr);

    if (isNaN(payAmt) || payAmt <= 0) {
        alert("Invalid amount entered.");
        return;
    }

    const methodChoice = prompt(`Payment method for ₹${payAmt}?\nType '1' for Cash\nType '2' for UPI\nType '3' for Bank Transfer`, "1");
    let method = "Cash";
    if (methodChoice === "2") method = "UPI";
    else if (methodChoice === "3") method = "Bank Transfer";

    const newDue = Math.max(0, (s.amount || 0) - payAmt);
    const newTotalPaid = (s.totalPaid || 0) + payAmt;
    const nowStr = new Date().toLocaleString('en-IN');

    await docRef.update({
        amount: newDue,
        totalPaid: newTotalPaid,
        lastPaidAmt: payAmt,
        lastPaymentDate: nowStr,
        isPaid: (newDue <= 0)
    });

    await docRef.collection("paymentHistory").add({
        amountPaid: payAmt,
        remainingDue: newDue,
        note: `Quick Payment [${method}]`,
        method: method,
        date: nowStr,
        type: "payment",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert(`Payment of ₹${payAmt} via ${method} recorded!`);
    loadAllData();
}

// FILTER & SEARCH LOGIC
function filterStudents() {
    const searchVal = document.getElementById('studentSearch').value.toLowerCase();
    const classVal = document.getElementById('classFilter').value;
    const rows = document.querySelectorAll("#studentData tr");

    rows.forEach(row => {
        const name = row.getAttribute('data-name') || '';
        const stClass = row.getAttribute('data-class') || '';

        const matchesSearch = name.includes(searchVal);
        const matchesClass = (classVal === 'ALL') || (stClass === classVal);

        if (matchesSearch && matchesClass) {
            row.classList.remove("hidden-row");
        } else {
            row.classList.add("hidden-row");
        }
    });
}

// REGISTER NEW STUDENT
async function addStudentToFirebase() {
    const name = document.getElementById('studentName').value.trim();
    const phone = document.getElementById('parentPhone').value.trim();
    const stClass = document.getElementById('studentClass').value;
    const fee = Number(document.getElementById('feeAmount').value || 0);

    if (!name) { alert("Student Name is required!"); return; }

    try {
        await db.collection("students").add({
            name: name.toUpperCase(),
            phone: phone || "0000000000",
            class: stClass,
            monthlyFee: fee,
            amount: fee,
            totalPaid: 0,
            lastPaidAmt: 0,
            isPaid: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Student Registered Successfully!");
        document.getElementById('studentName').value = '';
        document.getElementById('parentPhone').value = '';
        document.getElementById('feeAmount').value = '';
        showPage('dashboard');
        loadAllData();
    } catch (e) {
        alert("Error: " + e.message);
    }
}

// OPEN DASHBOARD QUICK PAYMENT & CUSTOM ENTRY MODAL
async function openProfile(id, label) {
    currentId = id; 
    currentDb = (label === "Main Project") ? db : dbSecondary;
    
    const doc = await currentDb.collection("students").doc(id).get();
    currentStudentData = doc.data() || {};

    const nameKey = (currentStudentData.name || "").toUpperCase();
    const mappedInfo = studentDetailsMap[nameKey] || {};

    const studentClass = currentStudentData.class || mappedInfo.class || "Unassigned";
    const studentPhone = getResolvedPhone(currentStudentData.phone, mappedInfo.phone);

    currentStudentData.resolvedPhone = studentPhone;

    document.getElementById('m-name').innerText = currentStudentData.name || "Student Profile";
    document.getElementById('m-class-info').innerText = `Class: ${studentClass} | Phone: ${studentPhone} | Current Due: ₹${currentStudentData.amount || 0}`;
    
    document.getElementById('quick-pay-amt').value = '';
    document.getElementById('quick-pay-note').value = '';
    
    if(document.getElementById('custom-entry-amt')) document.getElementById('custom-entry-amt').value = '';
    if(document.getElementById('custom-entry-note')) document.getElementById('custom-entry-note').value = '';

    document.getElementById('studentModal').style.display = 'flex';

    fetchPaymentHistory(id, currentDb, 'history-timeline');
}

// ADD SPECIFIC CUSTOM ENTRY / FEE ADJUSTMENT
async function addCustomStudentEntry() {
    const type = document.getElementById('custom-entry-type').value;
    const amt = Number(document.getElementById('custom-entry-amt').value);
    const reason = document.getElementById('custom-entry-note').value.trim();

    if (!amt || amt <= 0) {
        alert("Please enter a valid amount.");
        return;
    }

    if (!reason) {
        alert("Please specify a reason (e.g. Exam Fee, Fine, Discount).");
        return;
    }

    const currentDue = Number(currentStudentData.amount || 0);
    const newDue = (type === 'add') ? (currentDue + amt) : Math.max(0, currentDue - amt);
    const nowStr = new Date().toLocaleString('en-IN');

    const docRef = currentDb.collection("students").doc(currentId);

    await docRef.update({
        amount: newDue,
        isPaid: (newDue <= 0)
    });

    await docRef.collection("paymentHistory").add({
        amountPaid: (type === 'add') ? `+₹${amt}` : `-₹${amt}`,
        remainingDue: newDue,
        note: `[Custom Entry] ${reason}`,
        date: nowStr,
        type: "adjustment",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("Custom Entry Added Successfully!");
    openProfile(currentId, currentDb === db ? "Main Project" : "External Project");
    loadAllData();
}

// FETCH PAYMENT HISTORY TIMELINE
async function fetchPaymentHistory(studentId, targetDb, targetContainerId, studentObj = null) {
    const container = document.getElementById(targetContainerId);
    if(!container) return;
    container.innerHTML = '<small style="color:var(--text-dim)">Fetching log history...</small>';

    try {
        const snap = await targetDb.collection("students").doc(studentId)
            .collection("paymentHistory")
            .orderBy("timestamp", "desc")
            .get();

        if (snap.empty) {
            container.innerHTML = '<small style="color:var(--text-dim)">No prior payment history logged.</small>';
            return;
        }

        container.innerHTML = '';
        snap.forEach(doc => {
            const log = doc.data() || {};
            const dateStr = log.date || (log.timestamp ? new Date(log.timestamp.toDate()).toLocaleDateString('en-IN') : '-');
            const item = document.createElement('div');
            item.className = `history-item ${log.type === 'adjustment' ? 'adjustment' : ''}`;
            
            let btnHtml = '';
            if (studentObj) {
                btnHtml = `
                    <div style="display:inline-flex; gap:4px; margin-top:4px;">
                        <button class="btn-repair" style="font-size:10px; padding:2px 6px;" onclick="generateReceipt('${encodeURIComponent(JSON.stringify(studentObj))}', '${encodeURIComponent(JSON.stringify(log))}', 'single')">📄 Single Entry Receipt</button>
                        <button class="btn-repair" style="font-size:10px; padding:2px 6px; border-color:var(--primary); color:var(--primary);" onclick="generateReceipt('${encodeURIComponent(JSON.stringify(studentObj))}', '${encodeURIComponent(JSON.stringify(log))}', 'monthly')">📄 1-Month Fee Receipt</button>
                    </div>
                `;
            }

            item.innerHTML = `
                <div>
                    <b>₹${log.amountPaid}</b> <span style="font-size:11px; color:var(--text-dim)">(${log.note || 'Payment'})</span><br>
                    <small style="font-size:10px; color:var(--text-dim)">Remaining Due: ₹${log.remainingDue}</small><br>
                    ${btnHtml}
                </div>
                <small style="color:var(--text-dim)">${dateStr}</small>
            `;
            container.appendChild(item);
        });
    } catch (e) {
        container.innerHTML = '<small style="color:#f87171">No logs found or unable to load history.</small>';
    }
}

// GENERATE RECEIPT CARD (SINGLE ENTRY vs ALL-ENTRIES STATEMENT)
async function generateReceipt(encodedStudent, encodedLog, receiptType) {
    const st = JSON.parse(decodeURIComponent(encodedStudent));
    const log = JSON.parse(decodeURIComponent(encodedLog));

    const txnId = 'LG-' + Math.floor(100000 + Math.random() * 900000);
    const dateStr = log.date || new Date().toLocaleString('en-IN');
    const now = new Date();
    const monthYear = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    if (receiptType === 'monthly') {
        let historyLogs = [];
        const targetDb = (st.dbLabel === "Main Project") ? db : dbSecondary;

        try {
            const snap = await targetDb.collection("students").doc(st.id)
                .collection("paymentHistory")
                .orderBy("timestamp", "asc")
                .get();

            snap.forEach(d => {
                const item = d.data();
                if (item) historyLogs.push(item);
            });
        } catch (e) {
            console.error("Error fetching logs for statement:", e);
        }

        let breakdownText = "";
        let totalPaidThisMonth = 0;

        if (historyLogs.length > 0) {
            historyLogs.forEach((item, i) => {
                const itemNote = item.note || 'Transaction';
                const rawAmt = item.amountPaid;

                if (typeof rawAmt === 'number') {
                    totalPaidThisMonth += rawAmt;
                } else if (typeof rawAmt === 'string' && !rawAmt.startsWith('+')) {
                    const cleanNum = Number(rawAmt.replace(/[^0-9.-]+/g, ""));
                    if (!isNaN(cleanNum)) totalPaidThisMonth += cleanNum;
                }

                breakdownText += `${i + 1}. ${itemNote}\n   Amount: ₹${rawAmt} | Date: ${item.date || dateStr}\n\n`;
            });
        } else {
            breakdownText = `1. Payment Recorded: ₹${log.amountPaid} (${log.note || 'Fee Payment'})\n\n`;
            if (typeof log.amountPaid === 'number') totalPaidThisMonth = log.amountPaid;
        }

        generatedReceiptText = 
`==============================
   LITTLE GARDEN SCHOOL
    1-MONTH CONSOLIDATED STATEMENT
==============================
Statement Period : ${monthYear}
Statement Ref    : ${txnId}
Date Generated   : ${dateStr}
Student Name     : ${st.name}
Class            : ${st.class}
Contact Phone    : ${st.phone}
------------------------------
Standard Tuition Fee : ₹${st.monthlyFee}

--- MONTHLY TRANSACTIONS LOG ---
${breakdownText}------------------------------
Total Paid This Month   : ₹${totalPaidThisMonth}
Current Outstanding Due : ₹${st.amount}
Account Status          : ${st.amount <= 0 ? 'PAID IN FULL (NO DUES)' : 'PENDING OUTSTANDING'}
==============================
Thank you for your fee payment!`;

    } else {
        generatedReceiptText = 
`==============================
   LITTLE GARDEN SCHOOL
    OFFICIAL FEE RECEIPT
==============================
Receipt ID : ${txnId}
Date       : ${dateStr}
Student    : ${st.name}
Class      : ${st.class}
Phone      : ${st.phone}
------------------------------
Particulars : ${log.note || 'Fee Payment'}
Amount Paid : ₹${log.amountPaid}
------------------------------
Remaining Balance Due : ₹${log.remainingDue}
Status                : ${log.remainingDue <= 0 ? 'PAID IN FULL' : 'BALANCE DUE'}
==============================
Thank you for your payment!`;
    }

    document.getElementById('receipt-preview-box').innerText = generatedReceiptText;
    document.getElementById('receiptModal').style.display = 'flex';
}

function closeReceiptModal() {
    document.getElementById('receiptModal').style.display = 'none';
}

// BULLETPROOF COPY RECEIPT FUNCTION
function copyReceiptToClipboard() {
    if (!generatedReceiptText) {
        alert("No receipt content available to copy.");
        return;
    }

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(generatedReceiptText)
            .then(() => {
                alert("📋 Receipt text copied to clipboard!");
            })
            .catch(() => {
                fallbackCopyText(generatedReceiptText);
            });
    } else {
        fallbackCopyText(generatedReceiptText);
    }
}

function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            alert("📋 Receipt text copied to clipboard!");
        } else {
            alert("Unable to copy automatically. Please select text manually.");
        }
    } catch (err) {
        alert("Copy failed: " + err);
    }

    document.body.removeChild(textArea);
}

// RECORD REGULAR MODAL PAYMENT
async function recordNewPayment() {
    const payAmt = Number(document.getElementById('quick-pay-amt').value);
    const method = document.getElementById('quick-pay-method').value;
    const note = document.getElementById('quick-pay-note').value.trim();

    if (!payAmt || payAmt <= 0) {
        alert("Please enter a valid payment amount.");
        return;
    }

    const currentDue = Number(currentStudentData.amount || 0);
    const newDue = Math.max(0, currentDue - payAmt);
    const newTotalPaid = Number(currentStudentData.totalPaid || 0) + payAmt;
    const nowStr = new Date().toLocaleString('en-IN');

    const docRef = currentDb.collection("students").doc(currentId);

    await docRef.update({
        amount: newDue,
        totalPaid: newTotalPaid,
        lastPaidAmt: payAmt,
        lastPaymentDate: nowStr,
        isPaid: (newDue <= 0)
    });

    const fullNote = note ? `${note} [${method}]` : `Payment [${method}]`;

    await docRef.collection("paymentHistory").add({
        amountPaid: payAmt,
        remainingDue: newDue,
        note: fullNote,
        method: method,
        date: nowStr,
        type: "payment",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("Payment recorded successfully!");
    openProfile(currentId, currentDb === db ? "Main Project" : "External Project");
    loadAllData();
}

function closeModal() { 
    document.getElementById('studentModal').style.display = 'none'; 
}

// --- ADMIN PANEL FUNCTIONS ---

function populateAdminStudentDropdown() {
    const select = document.getElementById('adminStudentSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- Choose Student --</option>';

    allStudentsList.forEach((st, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.innerText = `${st.name} (${st.class})`;
        select.appendChild(opt);
    });
}

function loadStudentToAdminEditor() {
    const idx = document.getElementById('adminStudentSelect').value;
    const card = document.getElementById('adminEditorCard');

    if (idx === "") {
        card.style.display = 'none';
        return;
    }

    const st = allStudentsList[idx];
    document.getElementById('admin-editor-title').innerText = `Editing: ${st.name}`;
    document.getElementById('admin-phone').value = st.phone === "No Phone" ? "" : st.phone;
    document.getElementById('admin-class').value = st.class;
    document.getElementById('admin-monthly-fee').value = st.monthlyFee;
    document.getElementById('admin-due-amt').value = st.amount;
    document.getElementById('admin-paid-amt').value = st.totalPaid;

    card.style.display = 'block';

    fetchPaymentHistory(st.id, st.dbRef, 'admin-history-timeline', st);
}

async function saveAdminStudentUpdates() {
    const idx = document.getElementById('adminStudentSelect').value;
    if (idx === "") return;

    const st = allStudentsList[idx];
    const phone = document.getElementById('admin-phone').value.trim();
    const stClass = document.getElementById('admin-class').value.trim();
    const monthlyFee = Number(document.getElementById('admin-monthly-fee').value);
    const due = Number(document.getElementById('admin-due-amt').value);
    const totalPaid = Number(document.getElementById('admin-paid-amt').value);

    await st.dbRef.collection("students").doc(st.id).update({
        phone: phone || "0000000000",
        class: stClass || "Unassigned",
        monthlyFee: monthlyFee,
        amount: due,
        totalPaid: totalPaid,
        isPaid: (due <= 0)
    });

    alert("Student profile updated successfully in Admin Panel!");
    await loadAllData();
    showPage('admin');
}

async function deleteStudentHistoryAdmin() {
    const idx = document.getElementById('adminStudentSelect').value;
    if (idx === "") return;
    const st = allStudentsList[idx];

    if (!confirm(`Are you sure you want to clear payment history logs for ${st.name}?`)) return;

    try {
        const snap = await st.dbRef.collection("students").doc(st.id).collection("paymentHistory").get();
        const batch = st.dbRef.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        alert("Student payment history logs cleared!");
        fetchPaymentHistory(st.id, st.dbRef, 'admin-history-timeline', st);
    } catch (e) {
        alert("Error clearing history: " + e.message);
    }
}

async function deleteStudentAdmin() {
    const idx = document.getElementById('adminStudentSelect').value;
    if (idx === "") return;
    const st = allStudentsList[idx];

    if (!confirm(`⚠️ PERMANENT ACTION: Delete ${st.name} from database?`)) return;

    try {
        const snap = await st.dbRef.collection("students").doc(st.id).collection("paymentHistory").get();
        const batch = st.dbRef.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        await st.dbRef.collection("students").doc(st.id).delete();
        alert("Student permanently deleted.");
        
        document.getElementById('adminEditorCard').style.display = 'none';
        await loadAllData();
        showPage('admin');
    } catch (e) {
        alert("Error deleting student: " + e.message);
    }
}

// CLASS-WISE MONTHLY BILLING WITH CUSTOM FEE SUPPORT
function openBillingModal() {
    const customFeeInput = document.getElementById('billingCustomFee');
    if (customFeeInput) customFeeInput.value = '';
    document.getElementById('billingModal').style.display = 'flex';
}

function closeBillingModal() {
    document.getElementById('billingModal').style.display = 'none';
}

async function executeMonthlyBilling() {
    const targetClass = document.getElementById('billingClassTarget').value;
    const customFeeInput = document.getElementById('billingCustomFee').value.trim();
    const customFeeNum = Number(customFeeInput);

    const isCustom = customFeeInput !== "" && !isNaN(customFeeNum) && customFeeNum > 0;
    
    const feeDescription = isCustom 
        ? `₹${customFeeNum}` 
        : `each student's assigned monthly fee`;

    const confirmMsg = targetClass === "ALL" 
        ? `Apply ${feeDescription} to EVERY student in the school?` 
        : `Apply ${feeDescription} ONLY to all students in ${targetClass}?`;

    if (!confirm(confirmMsg)) return;

    const projects = [db, dbSecondary];
    let updatedCount = 0;

    try {
        for (const p of projects) {
            const snap = await p.collection("students").get();
            const batch = p.batch();
            
            snap.forEach(doc => {
                const s = doc.data() || {};
                const nameKey = (s.name || "").toUpperCase();
                const mappedInfo = studentDetailsMap[nameKey] || {};
                const stClass = s.class || mappedInfo.class || "Unassigned";

                if (targetClass === "ALL" || stClass === targetClass) {
                    const feeToAdd = isCustom ? customFeeNum : (s.monthlyFee || 0);
                    
                    batch.update(doc.ref, { 
                        amount: (s.amount || 0) + feeToAdd, 
                        isPaid: false 
                    });
                    updatedCount++;
                }
            });
            await batch.commit();
        }

        alert(`✅ Monthly billing successfully applied to ${updatedCount} student(s) in ${targetClass}!`);
        closeBillingModal();
        loadAllData();
    } catch (e) {
        alert("Error applying monthly bills: " + e.message);
    }
}

// EXPORT TO SHEETS
async function exportStudentsToCSV() {
    try {
        const fetchStudentsFromDb = async (database, label) => {
            const snap = await database.collection("students").get();
            const list = [];
            snap.forEach(doc => {
                const s = doc.data() || {};
                const nameKey = (s.name || "").toUpperCase();
                const mappedInfo = studentDetailsMap[nameKey] || {};
                const phone = getResolvedPhone(s.phone, mappedInfo.phone);

                list.push({
                    name: s.name || "N/A",
                    class: s.class || mappedInfo.class || "Unassigned",
                    phone: phone,
                    monthlyFee: s.monthlyFee || 0,
                    dueAmount: s.amount || 0,
                    totalPaid: s.totalPaid || 0,
                    status: s.isPaid ? "PAID" : "DUE",
                    source: label
                });
            });
            return list;
        };

        const mainStudents = await fetchStudentsFromDb(db, "Main Project");
        const secondaryStudents = await fetchStudentsFromDb(dbSecondary, "External Project");
        const all = [...mainStudents, ...secondaryStudents];

        all.sort((a, b) => {
            const classComp = a.class.localeCompare(b.class);
            if (classComp !== 0) return classComp;
            return a.name.localeCompare(b.name);
        });

        const headers = ["Class", "Student Name", "Phone Number", "Monthly Fee (INR)", "Due Amount (INR)", "Total Paid (INR)", "Status", "Database"];
        const rows = [headers.join(",")];

        all.forEach(s => {
            rows.push([
                `"${s.class}"`,
                `"${s.name.replace(/"/g, '""')}"`,
                `"${s.phone}"`,
                s.monthlyFee,
                s.dueAmount,
                s.totalPaid,
                `"${s.status}"`,
                `"${s.source}"`
            ].join(","));
        });

        const blob = new Blob([rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Little_Garden_ClassWise_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        alert("Export Error: " + e.message);
    }
}

// INVOICE SENDING LOGIC
function sendInvoice(type) {
    if (!currentStudentData) return;
    const s = currentStudentData;
    const phone = s.resolvedPhone || s.phone;
    
    if (!phone || phone === "No Phone" || phone.length < 10) {
        alert("Invalid phone number found for this student.");
        return;
    }

    const date = new Date().toLocaleDateString('en-IN');
    const msg = `*Little Garden BILL SUMMARY*%0A--------------------------%0A*Student:* ${s.name}%0A*Date:* ${date}%0A*Monthly Fee:* ₹${s.monthlyFee || 0}%0A*Total Due:* ₹${s.amount || 0}%0A--------------------------%0APlease settle the dues at the earliest.%0A_Thank you!_`;
    const formattedPhone = phone.startsWith('91') ? phone : '91' + phone;

    if (type === 'whatsapp') {
        window.open(`https://wa.me/${formattedPhone}?text=${msg}`, '_blank');
    } else {
        const smsMsg = msg.replace(/\*/g, '').replace(/%0A/g, '\n');
        window.location.href = `sms:${formattedPhone}?body=${encodeURIComponent(smsMsg)}`;
    }
}
