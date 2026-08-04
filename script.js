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
const appSecondary = firebase.initializeApp(secondaryConfig, "Secondary");
const dbSecondary = appSecondary.firestore();

function showPage(p) {
    document.querySelectorAll('.page-view').forEach(v => v.style.display = 'none');
    document.getElementById(p + '-view').style.display = 'block';
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    if(event) event.currentTarget.classList.add('active');
}

async function loadAllData() {
    const tbody = document.getElementById('studentData');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Loading Finance Data...</td></tr>';
    let total = 0;

    const fetchProj = async (database, label) => {
        const snap = await database.collection("students").orderBy("name").get();
        snap.forEach(doc => {
            const s = doc.data();
            total++;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><b>${s.name}</b><br><small style="color:var(--text-dim)">${label}</small></td>
                <td style="color:#f87171; font-weight:800">₹${s.amount || 0}</td>
                <td><small>₹${s.lastPaidAmt || 0}</small><br><small style="font-size:10px">${s.lastPaymentDate || '-'}</small></td>
                <td><button class="status-pill-ui ${s.isPaid ? 'paid' : 'pending'}" onclick="handleSmartPayment('${doc.id}', '${label}')">${s.isPaid ? 'PAID' : 'DUE'}</button></td>
                <td><button class="btn-repair" onclick="openProfile('${doc.id}', '${label}')">View</button></td>
            `;
            tbody.appendChild(row);
        });
    };

    tbody.innerHTML = '';
    await fetchProj(db, "Main Project");
    await fetchProj(dbSecondary, "External Project");
    document.getElementById('stat-count').innerText = total;
}

// RESTORE FUNCTION: Adds students back from JSON
async function restoreStudents() {
    if(!confirm("Re-import all 150+ students from JSON?")) return;
    const btn = event.target;
    btn.innerText = "Restoring...";
    try {
        const res = await fetch('./students.json');
        const data = await res.json();
        const batch = dbSecondary.batch();
        data.forEach(st => {
            const docRef = dbSecondary.collection("students").doc();
            batch.set(docRef, {
                name: st.name.toUpperCase(), phone: st.phone || "000",
                monthlyFee: 500, amount: 500, totalPaid: 0, lastPaidAmt: 0, isPaid: false
            });
        });
        await batch.commit();
        alert("Restoration Complete!");
        loadAllData();
    } catch (e) { alert("Error: " + e.message); }
    btn.innerText = "⚠️ Restore Deleted Students";
}

// SAFE SEARCH FUNCTION: Prevents 'toUpperCase' error
function searchStudent() {
    let input = document.getElementById('studentSearch').value.toLowerCase();
    let rows = document.querySelectorAll("#studentData tr");
    rows.forEach(row => {
        let nameElement = row.querySelector("td b");
        if (nameElement) {
            let name = nameElement.innerText.toLowerCase();
            row.classList.toggle("hidden-row", !name.includes(input));
        }
    });
}

async function handleSmartPayment(id, label) {
    const targetDb = (label === "Main Project") ? db : dbSecondary;
    const docRef = targetDb.collection("students").doc(id);
    const s = (await docRef.get()).data();
    let payStr = prompt(`Recording payment for ${s.name}.\nDue: ₹${s.amount}\nEnter amount paid:`, s.amount);
    if (payStr === null) return;
    let payAmt = Number(payStr);
    const newDue = (s.amount || 0) - payAmt;
    const now = new Date().toLocaleString('en-IN');
    await docRef.update({
        amount: Math.max(0, newDue),
        totalPaid: (s.totalPaid || 0) + payAmt,
        lastPaidAmt: payAmt,
        lastPaymentDate: now,
        isPaid: (newDue <= 0)
    });
    loadAllData();
}

let currentId, currentDb;
async function openProfile(id, label) {
    currentId = id; currentDb = (label === "Main Project") ? db : dbSecondary;
    const s = (await currentDb.collection("students").doc(id).get()).data();
    document.getElementById('m-name').innerText = s.name;
    document.getElementById('m-last-info').innerText = `Last Paid: ₹${s.lastPaidAmt || 0} on ${s.lastPaymentDate || 'N/A'}`;
    document.getElementById('m-monthly-fee').value = s.monthlyFee || 0;
    document.getElementById('m-due-amt').value = s.amount || 0;
    document.getElementById('m-paid-amt').value = s.totalPaid || 0;
    document.getElementById('studentModal').style.display = 'flex';
}

function closeModal() { document.getElementById('studentModal').style.display = 'none'; }

async function saveStudentFees() {
    const due = Number(document.getElementById('m-due-amt').value);
    await currentDb.collection("students").doc(currentId).update({ 
        monthlyFee: Number(document.getElementById('m-monthly-fee').value),
        amount: due, totalPaid: Number(document.getElementById('m-paid-amt').value), isPaid: (due <= 0)
    });
    closeModal(); loadAllData();
}

async function runMonthlyBilling() {
    if(!confirm("Add monthly fee to EVERY student's due amount?")) return;
    const projects = [db, dbSecondary];
    for (const p of projects) {
        const snap = await p.collection("students").get();
        const batch = p.batch();
        snap.forEach(doc => {
            const s = doc.data();
            batch.update(doc.ref, { amount: (s.amount || 0) + (s.monthlyFee || 0), isPaid: false });
        });
        await batch.commit();
    }
    loadAllData();
}

window.onload = loadAllData;


























// --- NEW: INVOICE SENDING LOGIC ---

function generateInvoiceMessage(student) {
    const date = new Date().toLocaleDateString('en-IN');
    return `*Little Garden BILL SUMMARY*%0A--------------------------%0A*Student:* ${student.name}%0A*Date:* ${date}%0A*Monthly Fee:* ₹${student.monthlyFee}%0A*Total Due:* ₹${student.amount}%0A--------------------------%0APlease settle the dues at the earliest.%0A_Thank you!_`;
}

async function sendInvoice(type) {
    // currentId and currentDb are set when you open the modal
    const doc = await currentDb.collection("students").doc(currentId).get();
    const s = doc.data();
    
    if (!s.phone || s.phone === "000" || s.phone.length < 10) {
        alert("Invalid phone number found for this student.");
        return;
    }

    const message = generateInvoiceMessage(s);
    const phone = s.phone.startsWith('91') ? s.phone : '91' + s.phone;

    if (type === 'whatsapp') {
        // Opens WhatsApp with pre-filled text
        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    } else {
        // Opens default SMS app (replaces * with spaces for SMS compatibility)
        const smsMsg = message.replace(/\*/g, '').replace(/%0A/g, '\n');
        window.location.href = `sms:${phone}?body=${encodeURIComponent(smsMsg)}`;
    }
}