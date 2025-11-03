// --- IndexedDB Setup using Dexie ---
const db = new Dexie('PatientRecordsDB');
db.version(1).stores({
visits: '++id, date, name, mobile, fatherName'
});

let allVisits = [];
let filteredVisits = [];
let inputTimer = null;
let currentVisitId = null; // null for New Record, ID for Update

// --- Utility Functions ---

function showMsg(m, isError = false) {
const el = document.getElementById('msg');
el.textContent = m;
el.className = isError ? 'mt-3 alert alert-danger' : 'mt-3 alert alert-success';
el.classList.remove('d-none');
setTimeout(() => el.classList.add('d-none'), 4000);
}

function updateSaveButton(isUpdate) {
const btn = document.getElementById('btnSaveUpdate');
if (isUpdate) {
 btn.textContent = '🔄 Update Record';
 btn.classList.remove('btn-primary');
 btn.style.backgroundColor = '#ff6347'; // Tomato color for update
} else {
 btn.textContent = '💾 Save Visit';
 btn.classList.add('btn-primary');
 btn.style.backgroundColor = '#007bff'; // Blue color for save
}
}

function updateNewRecordButton(isVisible) {
const btn = document.getElementById('btnNewRecord');
if (isVisible) {
 btn.classList.remove('d-none');
} else {
 btn.classList.add('d-none');
}
}

function escapeHtml(t) { return (t || '').toString().replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }


// --- NEW TOGGLE FUNCTION: APPLIES TO ALL 4 SHIFTS (MODIFIED) ---
function setupDosageToggle(row) {
// Defines the shifts (classes for the checkbox/input pair)
['morning', 'afternoon', 'evening', 'night'].forEach(time => {
 const checkbox = row.querySelector(`.${time}-check`);
 const input = row.querySelector(`.${time}-input`);
 const cell = checkbox ? checkbox.closest('.dosage-cell') : null;

 if (checkbox && input && cell) {

 // Helper to manage green background class
 const updateVisuals = () => {
  if (checkbox.checked) {
  cell.classList.add('dosage-active'); // Add green background
  input.classList.remove('hidden-input');
  } else {
  cell.classList.remove('dosage-active'); // Remove green background
  input.classList.add('hidden-input');
  input.value = ''; // Ensure value is cleared when unchecked
  }
 };

 // --- INITIAL STATE ---
 const hasDosageText = input.value.trim() !== '';
 if (checkbox.checked || hasDosageText) {
  checkbox.checked = true; // Force check if text is present
 }
 updateVisuals(); // Apply initial visuals

 // --- EVENT LISTENERS ---

 // 1. Toggle visibility and color on checkbox click
 checkbox.addEventListener('change', function() {
  updateVisuals();
  if (this.checked) {
  input.focus();
  }
 });

 // 2. Auto-check the box and show the input if text is typed
 input.addEventListener('input', function() {
  if (this.value.trim().length > 0) {
  checkbox.checked = true;
  updateVisuals();
  } else if (!checkbox.checked) {
  // If input is cleared AND box is unchecked, re-hide it (handled by updateVisuals on change)
  }
 });
 }
});
}
// -----------------------------

// --- Prescription Table Logic ---
function addMedicineRow(p = {}) {
const tbody = document.querySelector('#presTable tbody');
const tr = document.createElement('tr');

 // Helper to get initial state from data
 const getInitialState = (timeData) => {
  // If data is a string, assume it's the dosage text and the box is checked
  if (typeof timeData === 'string' && timeData) {
   return { isChecked: true, textValue: timeData }; 
  }
  // If data is simply true (from older records), use a default display text (and ensure box is checked)
  if (timeData === true) {
   return { isChecked: true, textValue: '' }; 
  }
  return { isChecked: false, textValue: '' };
 };

 const morning = getInitialState(p.morning);
 const afternoon = getInitialState(p.afternoon);
 const evening = getInitialState(p.evening);
 const night = getInitialState(p.night);

tr.innerHTML = `
    <td><input class="medName form-control" value="${escapeHtml(p.medicine || '')}"></td>
    
    <td><input class="quantityDays form-control" value="${escapeHtml(p.quantityDays || '')}" placeholder="e.g. 10 Days"></td>
    
  <td class="dosage-cell">
 <input type="checkbox" class="form-check-input morning-check" ${morning.isChecked ? 'checked' : ''}>
 <input type="text" class="form-control dosage-input morning-input" value="${escapeHtml(morning.textValue)}" placeholder="e.g., 1 Tab">
 </td>

  <td class="dosage-cell">
 <input type="checkbox" class="form-check-input afternoon-check" ${afternoon.isChecked ? 'checked' : ''}>
 <input type="text" class="form-control dosage-input afternoon-input" value="${escapeHtml(afternoon.textValue)}" placeholder="e.g., 1 Tab">
 </td>

  <td class="dosage-cell">
 <input type="checkbox" class="form-check-input evening-check" ${evening.isChecked ? 'checked' : ''}>
 <input type="text" class="form-control dosage-input evening-input" value="${escapeHtml(evening.textValue)}" placeholder="e.g., 1 Tab">
 </td>

  <td class="dosage-cell">
 <input type="checkbox" class="form-check-input night-check" ${night.isChecked ? 'checked' : ''}>
 <input type="text" class="form-control dosage-input night-input" value="${escapeHtml(night.textValue)}" placeholder="e.g., 1 Tab">
 </td>

 <td><button type="button" class="btn btn-sm btn-danger" 
 onclick="removeMedicineRow(this)">❌</button></td>`;
tbody.appendChild(tr);

 // Set up the toggle behaviour for all four shifts in the new row
 setupDosageToggle(tr);
}

function clearPrescriptionTable() { document.querySelector('#presTable tbody').innerHTML = ''; }

window.removeMedicineRow = function(buttonElement) {
const row = buttonElement.closest('tr');
if (row) {
 row.remove();
 showMsg('Medicine row removed.');
}
}

// --- Initialization ---
window.addEventListener('load', () => {
document.getElementById('date').value = new Date().toISOString().split('T')[0];
addMedicineRow();

loadAllVisitsInternal();

// Auto search existing visits based on input (MOBILE FIELD)
document.getElementById('mobile').addEventListener('input', () => {
 if (inputTimer) clearTimeout(inputTimer);
 inputTimer = setTimeout(loadVisitsByMobile, 500);
});

// Auto load on dropdown change
document.getElementById('visitSelect').addEventListener('change', () => {
 const date = document.getElementById('visitSelect').value;
 if (!date) return;
 const selectedVisit = filteredVisits.find(v => v.date === date);
 if (selectedVisit) {
 loadVisitDetails(selectedVisit.id);
 }
});
});

// --- Data Loading and Filtering (MOBILE-FOCUSED) ---
async function loadAllVisitsInternal() {
try {
 allVisits = await db.visits.toArray();
} catch (error) {
 console.error("Error loading visits:", error);
 showMsg('Failed to load records from local database.', true);
}
}

async function loadVisitsByMobile() {
const mobile = document.getElementById('mobile').value.trim();
const visitWrapper = document.getElementById('visitRowWrapper');
const noRecordsMsg = document.getElementById('noRecordsMsg');

updateNewRecordButton(false); // Hide New Record button by default

// Clear previous results and hide section if mobile is empty
if (!mobile) {
 visitWrapper.classList.add('d-none');
 noRecordsMsg.classList.add('d-none');
 document.getElementById('visitSelect').innerHTML = '<option value="">Select Date - Mobile</option>';
 filteredVisits = [];
 return;
}

// Filter allVisits locally based on mobile number
filteredVisits = allVisits.filter(v => v.mobile === mobile);

if (filteredVisits.length > 0) {
 // Records found: show the visits section
 noRecordsMsg.classList.add('d-none');
 visitWrapper.classList.remove('d-none');
 updateVisitDropdown(filteredVisits);
 updateNewRecordButton(true); // Show New Record button

 // Prefill Name/Father Name/Age/Address from the latest visit
 const latestVisit = filteredVisits.sort((a, b) => b.date.localeCompare(a.date))[0];
 document.getElementById('name').value = latestVisit.name || '';
 document.getElementById('father').value = latestVisit.fatherName || '';
 document.getElementById('age').value = latestVisit.age || '';
 document.getElementById('address').value = latestVisit.address || '';

 // Load the latest visit details automatically
 loadVisitDetails(latestVisit.id);

} else {
 // New patient: hide visit section and show message
 visitWrapper.classList.add('d-none');
 noRecordsMsg.classList.remove('d-none');
 noRecordsMsg.textContent = `No previous records found for Mobile: ${mobile}. Enter details below to create a New Record.`;
 document.getElementById('visitSelect').innerHTML = '<option value="">Select Date - Mobile</option>';
 updateNewRecordButton(true); // Show New Record button for new entry

 // --- START OF FIX: Only clear patient fields if they are EMPTY ---
 const patientFields = ['name', 'father', 'age', 'address'];
 let hasPreFilledData = patientFields.some(id => document.getElementById(id).value.trim() !== '');

 // If there is no pre-filled data, clear the fields to prepare for a new entry.
 // If the user has already typed in data, DO NOT clear it.
 if (!hasPreFilledData) {
 document.getElementById('name').value = '';
 document.getElementById('father').value = '';
 document.getElementById('age').value = '';
 document.getElementById('address').value = '';
 }
 // --- END OF FIX ---
 
 // Always clear visit-specific fields for a new record entry
 document.getElementById('problem').value = '';
 clearPrescriptionTable();
 addMedicineRow();
 currentVisitId = null;
 updateSaveButton(false); // Ensure Save button is set to SAVE
}
}

function updateVisitDropdown(list) {
const sel = document.getElementById('visitSelect');
list.sort((a, b) => b.date.localeCompare(a.date));

sel.innerHTML = '<option value="">Select Date - Mobile</option>';
list.forEach(v => {
 const opt = document.createElement('option');
 opt.value = v.date;
 opt.textContent = `${v.date} - ${v.mobile}`;
 sel.appendChild(opt);
});
}

window.applyDateFilter = function() {
const start = document.getElementById('startDate').value;
const end = document.getElementById('endDate').value;

let listToFilter = allVisits.filter(v => v.mobile === document.getElementById('mobile').value.trim());

if (start) listToFilter = listToFilter.filter(v => v.date >= start);
if (end) listToFilter = listToFilter.filter(v => v.date <= end);

updateVisitDropdown(listToFilter);
}

window.clearFilters = function() {
document.getElementById('startDate').value = '';
document.getElementById('endDate').value = '';
loadVisitsByMobile();
}

// --- Form Functions ---
window.clearForm = function() {
['name', 'father', 'mobile', 'age', 'address', 'problem'].forEach(id => {
 const el = document.getElementById(id);
 if (el) el.value = '';
});

clearPrescriptionTable();
addMedicineRow();

currentVisitId = null;
document.getElementById('date').value = new Date().toISOString().split('T')[0];

// Hide the visit section, clear the record message, and hide New Record button
document.getElementById('visitRowWrapper').classList.add('d-none');
document.getElementById('noRecordsMsg').classList.add('d-none');
updateNewRecordButton(false);

updateSaveButton(false); // Ensure Save button is set to SAVE
showMsg('Form cleared successfully for new patient.');
}

// UPDATED: This function is now correctly preserving fields when called.
window.newRecord = function() {
const mobile = document.getElementById('mobile').value;

// Clear only visit-specific fields: Problem and Prescription
document.getElementById('problem').value = '';
clearPrescriptionTable();
addMedicineRow();

// Reset date and context
document.getElementById('date').value = new Date().toISOString().split('T')[0];
currentVisitId = null;
updateSaveButton(false); // Ensure Save button is set to SAVE

showMsg(`New visit started for Mobile: ${mobile || 'N/A'}. Existing patient details retained.`);
}

// --- Load Details ---
async function loadVisitDetails(id) {
try {
 const content = await db.visits.get(id);
 if (!content) return showMsg('No data found for this record.', true);

 document.getElementById('name').value = content.name || '';
 document.getElementById('father').value = content.fatherName || '';
 document.getElementById('mobile').value = content.mobile || '';
 document.getElementById('age').value = content.age || '';
 document.getElementById('date').value = content.date || '';
 document.getElementById('address').value = content.address || '';
 document.getElementById('problem').value = content.problem || '';

 clearPrescriptionTable();
 (content.prescription || []).forEach(addMedicineRow);
 if ((content.prescription || []).length === 0) addMedicineRow();

 currentVisitId = id;
 updateSaveButton(true); // Change button to UPDATE
 showMsg(`Loaded record for ${content.date}`);
} catch (error) {
 console.error("Load visit error:", error);
 showMsg('Failed to load visit details.', true);
}
}

// --- Save/Update Logic (MODIFIED) ---
window.saveVisit = async function() {
  const name = document.getElementById('name').value.trim();
  const father = document.getElementById('father').value.trim();
  const mobile = document.getElementById('mobile').value.trim();
  const date = document.getElementById('date').value || new Date().toISOString().split('T')[0];
  
  if (!name || !mobile) return alert('Enter Name and Mobile number.');
  
  const patient = {
  name,
  fatherName: father,
  mobile: mobile,
  age: document.getElementById('age').value,
  address: document.getElementById('address').value,
  problem: document.getElementById('problem').value,
  date: date,
  prescription: []
  };
  
  document.querySelectorAll('#presTable tbody tr').forEach(row => {
  const med = row.querySelector('.medName').value.trim();
  if (med) {
   // NEW LOGIC: Prioritize text input value over checkbox status for storage
   const getDosage = (time) => {
    const textValue = row.querySelector(`.${time}-input`).value.trim();
    // If text is entered, save the text (e.g., "1 Tablet")
    if (textValue) return textValue;
    // Otherwise, save the checkbox status (true/false)
    return row.querySelector(`.${time}-check`).checked;
   };
  
  patient.prescription.push({
   medicine: med,
    // CAPTURE NEW FIELD
    quantityDays: row.querySelector('.quantityDays').value.trim(), 
   morning: getDosage('morning'),
   afternoon: getDosage('afternoon'),
   evening: getDosage('evening'),
   night: getDosage('night')
  });
  }
  });
  
  let saveSuccessful = false;
  let isNewRecord = false; // <-- NEW FLAG
  
  try {
  if (currentVisitId) {
  await db.visits.update(currentVisitId, patient);
  showMsg(`Updated successfully (${date})`);
  saveSuccessful = true;
  isNewRecord = false; // <-- Set to false for update
  } else {
  const existing = allVisits.find(v => v.mobile === mobile && v.date === date);
  if (existing) {
   if (confirm(`A record already exists for Mobile ${mobile} on ${date}. Do you want to update it?`)) {
   await db.visits.update(existing.id, patient);
   showMsg(`Updated existing record successfully (${date})`);
   saveSuccessful = true;
   currentVisitId = existing.id; 
   isNewRecord = false; // <-- Set to false for existing update
   } else {
   return; 
   }
  } else {
   await db.visits.add(patient);
   showMsg(`Saved new record successfully (${date})`);
   saveSuccessful = true;
   isNewRecord = true; // <-- Set to true for new record!
  }
  }
  
  if (saveSuccessful) {
  // Auto Download .DOC after successful save/update 
  
  // --- MODIFIED LOGIC HERE ---
  if (isNewRecord) { 
   downloadRecordAsDoc(patient);
  }
  // ---------------------------
  
  // Reset the form, reload the data, and set the button back to SAVE
  clearForm();
  loadAllVisitsInternal();
  }
  
  } catch (error) {
  console.error('Save failed:', error);
  showMsg('Save failed: ' + error.message, true);
  }
  }
// --- Data Retrieval for Document Generation (MODIFIED) ---
function getPatientDataFromForm() {
const name = document.getElementById('name').value.trim();
const mobile = document.getElementById('mobile').value.trim();

if (!name || !mobile) {
 alert('Please load or enter patient details before downloading/printing.');
 return null;
}

const patientData = {
 name,
 fatherName: document.getElementById('father').value.trim(),
 mobile: mobile,
 age: document.getElementById('age').value,
 address: document.getElementById('address').value,
 problem: document.getElementById('problem').value,
 date: document.getElementById('date').value || new Date().toISOString().split('T')[0],
 prescription: []
};

document.querySelectorAll('#presTable tbody tr').forEach(row => {
 const med = row.querySelector('.medName').value.trim();
 if (med) {
   // NEW LOGIC: Pull text from the dosage input field.
   const getDosage = (time) => {
    const textValue = row.querySelector(`.${time}-input`).value.trim();
    // If text is entered, use the text
    if (textValue) return textValue;
    // If checkbox is checked but text is empty, return a 'true' flag to indicate a checkmark should be shown
    if (row.querySelector(`.${time}-check`).checked) return true;
    // Otherwise, return false for no display
    return false;
   };

 patientData.prescription.push({
  medicine: med,
   // CAPTURE NEW FIELD
   quantityDays: row.querySelector('.quantityDays').value.trim(),
  morning: getDosage('morning'),
  afternoon: getDosage('afternoon'),
  evening: getDosage('evening'),
  night: getDosage('night')
 });
 }
});
return patientData;
}


// --- .DOC GENERATION FUNCTIONS (MODIFIED) ---
function generateDocContent(data) {
const docName = "Dr. SIVASANKAR MBBS";
const docSubtitle = "Physician, General Medicine, Reg. No: XXXXX";
const docContact = "123 Main Street, City, State | Phone: (123) 456-7890 | Email: example@clinic.com";

 // NEW HELPER: Formats dosage for the print/doc output
 const formatDosage = (dosage) => {
  // If dosage is a string (the text input value), use it
  if (typeof dosage === 'string' && dosage) return escapeHtml(dosage);
  // If dosage is boolean 'true' (checkbox ticked but no text entered), display the tick mark
  if (dosage === true) return '✓';
  // Otherwise (false or empty string), display a dash
  return '-';
 };

// Format prescription table HTML (MODIFIED to remove 'Action' column and adjust widths)
const medRowsHtml = data.prescription.map(m => `
 <tr>
 <td style="border: 1px solid #000; padding: 8px; text-align: left; width: 35%;">${escapeHtml(m.medicine)}</td>
   <td style="border: 1px solid #000; padding: 8px; text-align: center; width: 15%;">${escapeHtml(m.quantityDays || '-')}</td>
 <td style="border: 1px solid #000; padding: 8px; text-align: center; width: 12.5%;">${formatDosage(m.morning)}</td>
 <td style="border: 1px solid #000; padding: 8px; text-align: center; width: 12.5%;">${formatDosage(m.afternoon)}</td>
 <td style="border: 1px solid #000; padding: 8px; text-align: center; width: 12.5%;">${formatDosage(m.evening)}</td>
 <td style="border: 1px solid #000; padding: 8px; text-align: center; width: 12.5%;">${formatDosage(m.night)}</td>
 </tr>
`).join('');

// CSS for Print/Doc
const style = `
 body { font-family: 'Times New Roman', serif; margin: 40px; }
 .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
 .header h1 { margin: 0; color: #000; font-size: 28px; font-weight: bold; }
 .header h2 { margin: 5px 0 0; font-size: 16px; font-weight: normal; color: #333; }
 .header p { margin: 3px 0; font-size: 12px; color: #666; }
 .section { margin-bottom: 20px; border: 1px solid #ccc; padding: 10px; border-radius: 5px; }
 .section-title { font-weight: bold; padding-bottom: 5px; margin-bottom: 10px; font-size: 16px; border-bottom: 1px solid #ccc; color: #0056b3; }
 .details p { margin: 5px 0; font-size: 14px; line-height: 1.5; }
 table { width: 93%; border-collapse: collapse; margin-top: 15px; font-size: 14px; }
 th { border: 1px solid #000; padding: 8px; text-align: center; background-color: #f2f2f2; }
 .signature { margin-top: 50px; text-align: right; }
 .signature p { margin: 0; border-top: 1px dashed #000; width: 200px; display: inline-block; text-align: center; }
`;

// HTML structure for the .doc file or print window (Action column removed)
return `
 <html lang="en">
 <head>
 <meta charset="UTF-8">
 <title>Prescription for ${data.name} on ${data.date}</title>
 <style>${style}</style>
 </head>
 <body>
 <div class="header">
  <h1>${docName}</h1>
  <h2>${docSubtitle}</h2>
  <p>${docContact}</p>
 </div>

 <div class="section details">
  <div class="section-title">Patient Information</div>
  <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
  <p><strong>Father's Name:</strong> ${escapeHtml(data.fatherName)}</p>
  <p><strong>Mobile:</strong> ${escapeHtml(data.mobile)}</p>
  <p><strong>Age:</strong> ${escapeHtml(data.age)}</p>
  <p><strong>Date:</strong> ${escapeHtml(data.date)}</p>
  <p><strong>Address:</strong> ${escapeHtml(data.address).replace(/\n/g, '<br>')}</p>
 </div>

 <div class="section">
  <div class="section-title">Problem & Diagnosis</div>
  <p style="margin: 5px 0; min-height: 30px;">${escapeHtml(data.problem).replace(/\n/g, '<br>')}</p>
 </div>

 <div class="section">
  <div class="section-title">Medication Schedule (Dosage/Form)</div>
  <table>
  <thead>
   <tr>
   <th style="width: 35%;">Medicine</th>
       <th style="width: 15%;">Quantity/Days</th>
   <th style="width: 12.5%;">Morning</th>
   <th style="width: 12.5%;">Afternoon</th>
   <th style="width: 12.5%;">Evening</th>
   <th style="width: 12.5%;">Night</th>
   </tr>
  </thead>
  <tbody>
   ${medRowsHtml}
  </tbody>
  </table>
 </div>
 
 <div class="signature">
  <br>
  <p>Signature of Doctor</p>
 </div>
 </body>
 </html>
`;
}

// --- Download Functionality ---
function downloadFile(content, filename) {
const link = document.createElement('a');
link.href = 'data:application/msword;charset=utf-8,' + encodeURIComponent(content);
link.download = filename;
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
showMsg(`Download started for file: ${filename}`);
}

function downloadRecordAsDoc(patientData) {
const nameClean = patientData.name.trim().replace(/[^a-zA-Z0-9]/g, '-');
const dateFormatted = patientData.date;
const mobile = patientData.mobile;
const filename = `Prescription_${nameClean}_${mobile}_${dateFormatted}.doc`;

const fileContent = generateDocContent(patientData);
downloadFile(fileContent, filename);
}

window.downloadCurrentRecord = function() {
const patientData = getPatientDataFromForm();
if (patientData) {
 downloadRecordAsDoc(patientData);
}
}


// --- Print Functionality (UPDATED to print .doc format) ---
window.printCurrentRecord = function() {
const patientData = getPatientDataFromForm();
if (!patientData) return;

// Generate the clean, print-friendly HTML content
const printContent = generateDocContent(patientData);

// Open a new window for printing the content
const printWindow = window.open('', '_blank');
printWindow.document.write(printContent);
printWindow.document.close();

// Wait for content to load and then print
printWindow.onload = function() {
 printWindow.focus(); 
 printWindow.print();
};
}


// --- Backup (Export) Functionality ---
window.backupData = async function() {
try {
 const allData = await db.visits.toArray();
 const jsonString = JSON.stringify(allData, null, 2);
 const blob = new Blob([jsonString], { type: 'application/json' });
 const url = URL.createObjectURL(blob);

 const a = document.createElement('a');
 a.href = url;
 a.download = `PatientRecords_Backup_${new Date().toISOString().split('T')[0]}.json`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);

 showMsg('All records exported successfully to your Downloads folder!');
} catch (error) {
 console.error("Backup failed:", error);
 showMsg('Backup failed: ' + error.message, true);
}
}

// --- Restore (Import) Functionality ---
window.restoreData = function(event) {
const file = event.target.files[0];
if (!file) return;

const reader = new FileReader();
reader.onload = async (e) => {
 try {
 const data = JSON.parse(e.target.result);
 if (!Array.isArray(data)) throw new Error("File content is not a valid list of records.");

 if (!confirm(`This will attempt to import ${data.length} records. New records will be created. Continue?`)) {
  event.target.value = '';
  return;
 }

 await db.visits.bulkAdd(data.map(v => {
  const {
  id,
  ...rest
  } = v;
  return rest;
 }));

 event.target.value = '';
 clearForm();
 loadAllVisitsInternal();
 showMsg(`Successfully imported ${data.length} records.`);

 } catch (error) {
 console.error("Restore failed:", error);
 showMsg('Restore failed: Invalid or corrupted JSON file. ' + error.message, true);
 }
};
reader.onerror = () => {
 showMsg('Error reading file.', true);
};
reader.readAsText(file);
}