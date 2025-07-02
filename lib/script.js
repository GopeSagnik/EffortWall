// Import Appwrite SDK components directly using ES Modules.
import { Client, Databases, ID, Query } from "appwrite";

import { listTeamMembersAndPopulateSelects, addTeamMember, updateTeamMemberPrompt, deleteTeamMember, addActivityCategory, listActivityCategoriesAndPopulateSelect, updateActivityCategoryPrompt, deleteActivityCategory, deleteAllTeamMembers, deleteAllActivityCategories } from './manageModule.js';
import { displaySummaryTable } from './chartModule.js'; // <-- Import displaySummaryTable

// --- Appwrite Configuration ---
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT;

// --- Debugging: Log the resolved environment variables ---
console.log('--- Appwrite Config Debug ---');
console.log('Resolved APPWRITE_PROJECT_ID:', APPWRITE_PROJECT_ID);
console.log('Resolved APPWRITE_ENDPOINT:', APPWRITE_ENDPOINT);
console.log('---------------------------');

if (!APPWRITE_PROJECT_ID || !APPWRITE_ENDPOINT) {
    console.error("Appwrite environment variables are not loaded or are empty! Please check your .env file and Vite configuration.");
    document.addEventListener('DOMContentLoaded', () => {
        const statusMessageDiv = document.getElementById('statusMessage');
        if (statusMessageDiv) {
            statusMessageDiv.innerHTML = '<span class="text-red-500">Configuration Error: Appwrite Project ID or Endpoint missing. Check console for details.</span>';
        }
    });
    throw new Error("Appwrite configuration missing.");
} else {
    document.addEventListener('DOMContentLoaded', () => {
        const statusMessageDiv = document.getElementById('statusMessage');
        if (statusMessageDiv) {
            statusMessageDiv.textContent = 'Connecting to Appwrite...';
        }
    });
}

// Database ID and Collection IDs (Centralized here)
export const DATABASE_ID = '685d34970008292a6c80';
export const COLLECTION_IDS = {
    teamMembers: '685d4a8d00314e8e9ce3',
    holidays: '685d3f0a001c6ed5cc65',
    timeEntries: '685d35e8001fc90f9dab',
    activityCategories: '685d7dd2001b35eaf00c' // <-- IMPORTANT: User needs to create this and replace the ID
};

// --- Initialize Appwrite Client ---
export const client = new Client();
client.setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
export const databases = new Databases(client); // This is the object that needs to be initialized

// DEBUG: Log databases object to confirm initialization
console.log('Appwrite Databases object initialized:', databases);

export { ID, Query };


// --- Global state variables (Centralized) ---
export let teamMembers = [];
export let activityCategories = [];

export function updateGlobalTeamMembers(newTeamMembers) {
    teamMembers = newTeamMembers;
}

export function updateGlobalActivityCategories(newCategories) {
    activityCategories = newCategories;
}

export function getOrCreateGuestUserId() {
    let userId = localStorage.getItem('guestUserId');
    if (!userId) {
        userId = ID.unique();
        localStorage.setItem('guestUserId', userId);
        console.log('Generated new guest userId:', userId);
    } else {
        console.log('Using existing guest userId:', userId);
    }
    return userId;
}

// --- Utility Functions (Remaining in main script.js) ---

export function displayMessage(message, isError = false, type = 'status') {
    if (type === 'status') {
        const statusMessageDiv = document.getElementById('statusMessage');
        if (statusMessageDiv) {
            statusMessageDiv.innerHTML = `<span class="${isError ? 'text-red-500' : 'text-green-500'}">${message}</span>`;
        }
    } else if (type === 'modal') {
        showCustomModal({
            title: isError ? 'Error' : 'Notification',
            message: message,
            isError: isError,
            showCancel: false
        });
    }
    console.log(message);
}

export function showSpinner(buttonId, spinnerId, buttonTextId) {
    const button = document.getElementById(buttonId);
    const spinner = document.getElementById(spinnerId);
    const buttonText = document.getElementById(buttonTextId);
    if (button) button.disabled = true;
    if (buttonText) buttonText.classList.add('hidden');
    if (spinner) spinner.classList.remove('hidden');
}

export function hideSpinner(buttonId, spinnerId, buttonTextId) {
    const button = document.getElementById(buttonId);
    const spinner = document.getElementById(spinnerId);
    const buttonText = document.getElementById(buttonTextId);
    if (button) button.disabled = false;
    if (buttonText) buttonText.classList.remove('hidden');
    if (spinner) spinner.classList.add('hidden');
}

export function showCustomModal({ title, message, isError = false, showCancel = true, onConfirm, onCancel, inputs = [] }) {
    let modal = document.getElementById('messageModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'messageModal';
        document.body.appendChild(modal);
    }

    let inputHtml = inputs.map(input => {
        if (input.type === 'select') {
            return `
                <div class="mb-4">
                    <label for="${input.id}" class="block text-sm font-medium text-gray-300 mb-1">${input.label}:</label>
                    <select id="${input.id}" class="p-2 rounded-md bg-gray-700 text-white w-full border border-gray-600 focus:outline-none focus:ring-2 ${isError ? 'focus:ring-red-500' : 'focus:ring-blue-500'}" ${input.required ? 'required' : ''}>
                        ${input.options ? input.options.map(opt => `<option value="${opt.value}" ${opt.value === input.value ? 'selected' : ''}>${opt.text}</option>`).join('') : ''}
                    </select>
                </div>
            `;
        } else if (input.type === 'textarea') {
            return `
                <div class="mb-4">
                    <label for="${input.id}" class="block text-sm font-medium text-gray-300 mb-1">${input.label}:</label>
                    <textarea id="${input.id}" class="p-2 rounded-md bg-gray-700 text-white w-full border border-gray-600 focus:outline-none focus:ring-2 ${isError ? 'focus:ring-red-500' : 'focus:ring-blue-500'}" placeholder="${input.placeholder || ''}" ${input.required ? 'required' : ''}>${input.value || ''}</textarea>
                </div>
            `;
        } else if (input.type === 'radio') {
            // Special handling for radio buttons
            return `
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-300 mb-1">${input.label}:</label>
                    <div class="flex items-center space-x-4">
                        ${input.options.map(opt => `
                            <label class="inline-flex items-center">
                                <input type="radio" name="${input.name}" value="${opt.value}" class="form-radio text-indigo-500" ${opt.value === input.value ? 'checked' : ''} ${input.required ? 'required' : ''}>
                                <span class="ml-2 text-gray-300">${opt.label}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        else {
            return `
                <div class="mb-4">
                    <label for="${input.id}" class="block text-sm font-medium text-gray-300 mb-1">${input.label}:</label>
                    <input type="${input.type || 'text'}" id="${input.id}" value="${input.value || ''}"
                           class="p-2 rounded-md bg-gray-700 text-white w-full border border-gray-600 focus:outline-none focus:ring-2 ${isError ? 'focus:ring-red-500' : 'focus:ring-blue-500'}"
                           placeholder="${input.placeholder || ''}" ${input.required ? 'required' : ''}>
                </div>
            `;
        }
    }).join('');

    modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-gray-800 p-6 rounded-lg shadow-xl text-gray-100 w-full max-w-md">
            <h2 class="text-xl font-bold mb-4 ${isError ? 'text-red-400' : 'text-blue-400'}">${title}</h2>
            <p class="mb-6">${message}</p>
            ${inputHtml}
            <div class="flex justify-end space-x-4">
                <button id="modalConfirmBtn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Confirm</button>
                ${showCancel ? '<button id="modalCancelBtn" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>' : ''}
            </div>
        </div>
    `;

    document.getElementById('modalConfirmBtn').onclick = () => {
        modal.classList.add('hidden');
        if (onConfirm) onConfirm();
    };

    if (showCancel) {
        document.getElementById('modalCancelBtn').onclick = () => {
            modal.classList.add('hidden');
            if (onCancel) onCancel();
        };
    }

    modal.classList.remove('hidden');
}

export function hideCustomModal() {
    const modal = document.getElementById('messageModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// --- Time Entries (CRUD) ---
async function logTimeEntry(teamMemberAppwriteId, activity, ticketNumber, hoursSpent, trackDateHtmlInput, notes) {
    showSpinner('logEffortBtn', 'logEffortSpinner', 'logEffortBtnText');
    const userId = getOrCreateGuestUserId();
    try {
        const response = await databases.createDocument(
            DATABASE_ID,
            COLLECTION_IDS.timeEntries,
            ID.unique(),
            {
                userId: userId,
                teamMember: teamMemberAppwriteId,
                activity: activity,
                ticketNumber: ticketNumber,
                hoursSpent: hoursSpent,
                date: trackDateHtmlInput,
                notes: notes
            }
        );
        displayMessage(`Time logged successfully! Document ID: ${response.$id}`, false, 'modal');
        console.log('Logged Time Entry:', response);
        document.getElementById('timeTrackForm').reset();
        if (document.getElementById('tableViewBtn').classList.contains('bg-indigo-700')) {
            await displayFilteredTimeEntries();
        }
    } catch (error) {
        displayMessage(`Error logging time: ${error.message}`, true, 'modal');
        console.error('Error logging time:', error);
    } finally {
        hideSpinner('logEffortBtn', 'logEffortSpinner', 'logEffortBtnText');
    }
}

export async function displayFilteredTimeEntries() {
    const dataContainer = document.getElementById('dataContainer');
    if (!dataContainer) {
        console.error('Data container not found!');
        return;
    }
    dataContainer.innerHTML = '<p class="text-gray-500 text-center py-8">Loading time entries...</p>';

    const filterStartDate = document.getElementById('filterStartDate').value;
    const filterEndDate = document.getElementById('filterEndDate').value;
    const filterTeamMemberId = document.getElementById('filterTeamMember').value;
    const filterActivity = document.getElementById('filterActivity').value; // This is now specific to activity

    const queries = [];
    const userId = getOrCreateGuestUserId();
    queries.push(Query.equal('userId', userId));

    if (filterStartDate) queries.push(Query.greaterThanEqual('date', filterStartDate));
    if (filterEndDate) queries.push(Query.lessThanEqual('date', filterEndDate));
    if (filterTeamMemberId) queries.push(Query.equal('teamMember', filterTeamMemberId));
    if (filterActivity) queries.push(Query.equal('activity', filterActivity));

    queries.push(Query.orderDesc('date'));

    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTION_IDS.timeEntries,
            queries
        );

        if (response.documents.length === 0) {
            dataContainer.innerHTML = '<p class="text-gray-500 text-center py-8">No time entries found for the selected filters.</p>';
            displayMessage('No time entries found for filters.', false);
            return;
        }

        let tableHtml = `
            <table class="min-w-full bg-gray-700 rounded-md overflow-hidden text-sm">
                <thead class="bg-gray-600 text-gray-200">
                    <tr>
                        <th class="py-2 px-3 text-left">Date</th>
                        <th class="py-2 px-3 text-left">Member</th>
                        <th class="py-2 px-3 text-left">Activity</th>
                        <th class="py-2 px-3 text-left">Hours</th>
                        <th class="py-2 px-3 text-left">Ticket</th>
                        <th class="py-2 px-3 text-left">Notes</th>
                        <th class="py-2 px-3 text-left">Actions</th>
                    </tr>
                </thead>
                <tbody class="text-gray-300">
        `;

        response.documents.forEach(entry => {
            const memberName = teamMembers.find(m => m.$id === entry.teamMember)?.name || 'Unknown';
            // Use data-attributes instead of onclick
            tableHtml += `
                <tr class="border-b border-gray-600 last:border-0">
                    <td class="py-2 px-3">${entry.date}</td>
                    <td class="py-2 px-3">${memberName}</td>
                    <td class="py-2 px-3">${entry.activity}</td>
                    <td class="py-2 px-3">${entry.hoursSpent.toFixed(2)}</td>
                    <td class="py-2 px-3">${entry.ticketNumber || 'N/A'}</td>
                    <td class="py-2 px-3">${entry.notes || 'N/A'}</td>
                    <td class="py-2 px-3 flex flex-col sm:flex-row gap-1">
                        <button class="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold py-1 px-2 rounded-lg edit-time-entry-btn"
                                data-id="${entry.$id}"
                                data-date="${entry.date}"
                                data-team-member="${entry.teamMember}"
                                data-activity="${entry.activity}"
                                data-ticket-number="${entry.ticketNumber || ''}"
                                data-hours-spent="${entry.hoursSpent}"
                                data-notes="${entry.notes ? entry.notes.replace(/"/g, '&quot;') : ''}">Edit</button>
                        <button class="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded-lg delete-time-entry-btn"
                                data-id="${entry.$id}">Delete</button>
                    </td>
                </tr>
            `;
        });

        tableHtml += `
                </tbody>
            </table>
        `;
        dataContainer.innerHTML = tableHtml;
        displayMessage(`Displayed ${response.documents.length} time entries.`, false);
    } catch (error) {
        displayMessage(`Error displaying time entries: ${error.message}`, true);
        console.error('Error displaying time entries:', error);
        dataContainer.innerHTML = '<p class="text-red-500 text-center py-8">Failed to load time entries.</p>';
    }
}

export function updateTimeEntryPrompt(entryId, currentDate, currentTeamMemberId, currentActivity, currentTicketNumber, currentHoursSpent, currentNotes) {
    showCustomModal({
        title: 'Update Time Entry',
        message: 'Update details for this time entry:',
        inputs: [
            { id: 'modalTimeEntryDate', label: 'Date', type: 'date', value: currentDate, required: true },
            { id: 'modalTimeEntryTeamMember', label: 'Team Member', type: 'select', value: currentTeamMemberId, options: teamMembers.map(m => ({ value: m.$id, text: m.name })), required: true },
            { id: 'modalTimeEntryActivity', label: 'Activity', type: 'select', value: currentActivity, options: activityCategories.map(a => ({ value: a.name, text: a.name })), required: true },
            { id: 'modalTimeEntryTicket', label: 'Ticket Number', type: 'text', value: currentTicketNumber || '', placeholder: 'e.g., SUP-12345' },
            { id: 'modalTimeEntryHours', label: 'Duration (hours)', type: 'number', value: currentHoursSpent, step: '0.01', min: '0', required: true },
            { id: 'modalTimeEntryNotes', label: 'Notes', type: 'textarea', value: currentNotes || '', placeholder: 'Add any relevant notes...' }
        ],
        onConfirm: async () => {
            const newDate = document.getElementById('modalTimeEntryDate').value;
            const newTeamMemberId = document.getElementById('modalTimeEntryTeamMember').value;
            const newActivity = document.getElementById('modalTimeEntryActivity').value;
            const newTicketNumber = document.getElementById('modalTimeEntryTicket').value;
            const newHoursSpent = parseFloat(document.getElementById('modalTimeEntryHours').value);
            const newNotes = document.getElementById('modalTimeEntryNotes').value;

            if (newTeamMemberId && newActivity && !isNaN(newHoursSpent) && newHoursSpent > 0 && newDate) {
                await updateTimeEntry(entryId, newTeamMemberId, newActivity, newTicketNumber, newHoursSpent, newDate, newNotes);
            } else {
                displayMessage('Please ensure all required fields are valid.', true, 'modal');
            }
        },
        onCancel: () => displayMessage('Time entry update cancelled.', false)
    });
}

export async function updateTimeEntry(documentId, teamMemberAppwriteId, activity, ticketNumber, hoursSpent, date, notes) {
    const userId = getOrCreateGuestUserId();
    try {
        await databases.updateDocument(
            DATABASE_ID,
            COLLECTION_IDS.timeEntries,
            documentId,
            {
                userId: userId,
                teamMember: teamMemberAppwriteId,
                activity: activity,
                ticketNumber: ticketNumber,
                hoursSpent: hoursSpent,
                date: date,
                notes: notes
            }
        );
        displayMessage(`Time entry with ID ${documentId} updated successfully!`, false, 'modal');
        await displayFilteredTimeEntries();
    } catch (error) {
        displayMessage(`Error updating time entry ${documentId}: ${error.message}`, true, 'modal');
        console.error('Error updating time entry:', error);
    }
}

export async function deleteTimeEntry(documentId) {
    showCustomModal({
        title: 'Confirm Deletion',
        message: `Are you sure you want to delete this time entry (ID: ${documentId})? This action cannot be undone.`,
        isError: true,
        showCancel: true,
        onConfirm: async () => {
            try {
                await databases.deleteDocument(
                    DATABASE_ID,
                    COLLECTION_IDS.timeEntries,
                    documentId
                );
                displayMessage(`Time entry with ID ${documentId} deleted successfully!`, false, 'modal');
                await displayFilteredTimeEntries();
            } catch (error) {
                displayMessage(`Error deleting time entry ${documentId}: ${error.message}`, true, 'modal');
                console.error('Error deleting time entry:', error);
            }
        },
        onCancel: () => displayMessage('Deletion cancelled.', false)
    });
}

export async function deleteAllTimeEntries() {
    showSpinner('deleteAllTimeEntriesBtn', 'deleteAllTimeEntriesSpinner', 'deleteAllTimeEntriesBtnText');
    const userId = getOrCreateGuestUserId();
    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTION_IDS.timeEntries,
            [Query.equal('userId', userId), Query.limit(100)]
        );

        if (response.documents.length === 0) {
            displayMessage('No time entries to delete.', false, 'modal');
            return;
        }

        for (const doc of response.documents) {
            await databases.deleteDocument(DATABASE_ID, COLLECTION_IDS.timeEntries, doc.$id);
        }
        displayMessage(`Successfully deleted ${response.documents.length} time entries.`, false, 'modal');
        await displayFilteredTimeEntries();
    } catch (error) {
        displayMessage(`Error deleting all time entries: ${error.message}`, true, 'modal');
        console.error('Error deleting all time entries:', error);
    } finally {
        hideSpinner('deleteAllTimeEntriesBtn', 'deleteAllTimeEntriesSpinner', 'deleteAllTimeEntriesBtnText');
    }
}


// --- UI Management ---
export function switchView(viewId) {
    // Get filter elements and copy button wrappers
    const filterTeamMemberWrapper = document.getElementById('filterTeamMemberWrapper');
    const filterActivityWrapper = document.getElementById('filterActivityWrapper');
    const filterHolidayTypeWrapper = document.getElementById('filterHolidayTypeWrapper'); // New holiday type filter wrapper
    const copyButtonsContainer = document.getElementById('copyButtonsContainer');
    const copyGraphButtonWrapper = document.getElementById('copyGraphButtonWrapper');

    document.getElementById('filterControls').classList.add('hidden');
    document.getElementById('dataContainer').classList.add('hidden');
    document.getElementById('manageTeamMembersSection').classList.add('hidden');
    document.getElementById('utilizationChartContainer').classList.add('hidden');
    const activityCategorySection = document.getElementById('activityCategoryManagement');
    if (activityCategorySection) {
        activityCategorySection.classList.add('hidden');
    }

    // Hide all filters and copy buttons by default at the start of view switch
    if (filterTeamMemberWrapper) filterTeamMemberWrapper.classList.add('hidden');
    if (filterActivityWrapper) filterActivityWrapper.classList.add('hidden');
    if (filterHolidayTypeWrapper) filterHolidayTypeWrapper.classList.add('hidden');
    if (copyButtonsContainer) copyButtonsContainer.classList.add('hidden'); // Hide copy buttons container
    if (copyGraphButtonWrapper) copyGraphButtonWrapper.classList.add('hidden'); // Hide copy graph button


    const viewButtons = ['tableViewBtn', 'chartsViewBtn', 'holidaysViewBtn', 'manageViewBtn'];
    viewButtons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.classList.remove('bg-indigo-700', 'text-white');
            btn.classList.add('bg-gray-700', 'hover:bg-gray-600');
        }
    });

    const activateButton = document.getElementById(`${viewId}ViewBtn`);
    if (activateButton) {
        activateButton.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        activateButton.classList.add('bg-indigo-700', 'text-white');
    }

    switch (viewId) {
        case 'table':
            document.getElementById('filterControls').classList.remove('hidden');
            document.getElementById('dataContainer').classList.remove('hidden');
            if (filterTeamMemberWrapper) filterTeamMemberWrapper.classList.remove('hidden');
            if (filterActivityWrapper) filterActivityWrapper.classList.remove('hidden'); // Show Activity filter
            if (copyButtonsContainer) copyButtonsContainer.classList.remove('hidden'); // Show copy buttons
            displayFilteredTimeEntries();
            break;
        case 'charts':
            document.getElementById('filterControls').classList.remove('hidden');
            document.getElementById('dataContainer').classList.remove('hidden');
            document.getElementById('utilizationChartContainer').classList.remove('hidden');
            if (copyButtonsContainer) copyButtonsContainer.classList.remove('hidden'); // Show copy buttons
            if (copyGraphButtonWrapper) copyGraphButtonWrapper.classList.remove('hidden'); // Show copy graph button
            // Hide Team Member and Activity filters for Summary tab
            // filterTeamMemberWrapper and filterActivityWrapper remain hidden from default state
            displaySummaryTable(databases); 
            break;
        case 'holidays':
            document.getElementById('filterControls').classList.remove('hidden');
            document.getElementById('dataContainer').classList.remove('hidden');
            if (filterTeamMemberWrapper) filterTeamMemberWrapper.classList.remove('hidden');
            if (filterHolidayTypeWrapper) filterHolidayTypeWrapper.classList.remove('hidden'); // Show Holiday Type filter
            if (copyButtonsContainer) copyButtonsContainer.classList.remove('hidden'); // Show copy buttons
            displayHolidays();
            break;
        case 'manage':
            document.getElementById('manageTeamMembersSection').classList.remove('hidden');
            // All filters and copy buttons remain hidden from default state
            listTeamMembersAndPopulateSelects();
            listActivityCategoriesAndPopulateSelect();
            const manageActivityCatSection = document.getElementById('activityCategoryManagement');
            if (manageActivityCatSection) {
                manageActivityCatSection.classList.remove('hidden');
            }
            break;
    }
}

// --- Holiday Manager Functions (Now defined in script.js) ---
export async function displayHolidays() {
    const dataContainer = document.getElementById('dataContainer');
    if (!dataContainer) {
        console.error('Data container not found!');
        return;
    }
    dataContainer.innerHTML = '<p class="text-gray-500 text-center py-8">Loading holiday records...</p>';

    const filterStartDate = document.getElementById('filterStartDate').value;
    const filterEndDate = document.getElementById('filterEndDate').value;
    const filterTeamMemberId = document.getElementById('filterTeamMember').value;
    // Changed to filterHolidayType
    const filterHolidayType = document.getElementById('filterHolidayType').value; 

    const queries = [];
    const userId = getOrCreateGuestUserId();
    queries.push(Query.equal('userId', userId));

    if (filterStartDate) queries.push(Query.lessThanEqual('startDate', filterEndDate)); 
    if (filterEndDate) queries.push(Query.greaterThanEqual('endDate', filterStartDate)); 
    if (filterTeamMemberId) queries.push(Query.equal('teamMember', filterTeamMemberId));
    // Changed to holidayType
    if (filterHolidayType) queries.push(Query.equal('holidayType', filterHolidayType)); 

    queries.push(Query.orderDesc('startDate'));

    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTION_IDS.holidays,
            queries
        );

        if (response.documents.length === 0) {
            dataContainer.innerHTML = '<p class="text-gray-500 text-center py-8">No holiday/leave records found for the selected filters.</p>';
            displayMessage('No holiday/leave records found for filters.', false);
            return;
        }

        let tableHtml = `
            <table class="min-w-full bg-gray-700 rounded-md overflow-hidden text-sm">
                <thead class="bg-gray-600 text-gray-200">
                    <tr>
                        <th class="py-2 px-3 text-left">Member</th>
                        <th class="py-2 px-3 text-left">Start Date</th>
                        <th class="py-2 px-3 text-left">End Date</th>
                        <th class="py-2 px-3 text-left">Type</th>
                        <th class="py-2 px-3 text-left">Reason</th>
                        <th class="py-2 px-3 text-left">Actions</th>
                    </tr>
                </thead>
                <tbody class="text-gray-300">
        `;

        response.documents.forEach(holiday => {
            const memberName = teamMembers.find(m => m.$id === holiday.teamMember)?.name || 'Unknown';
            // Corrected data-reason attribute formatting
            tableHtml += `
                <tr class="border-b border-gray-600 last:border-0">
                    <td class="py-2 px-3">${memberName}</td>
                    <td class="py-2 px-3">${holiday.startDate}</td>
                    <td class="py-2 px-3">${holiday.endDate}</td>
                    <td class="py-2 px-3">${holiday.holidayType || 'Undefined'}</td> 
                    <td class="py-2 px-3">${holiday.reason || 'N/A'}</td>
                    <td class="py-2 px-3 flex flex-col sm:flex-row gap-1">
                        <button class="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold py-1 px-2 rounded-lg edit-holiday-btn"
                                data-id="${holiday.$id}"
                                data-team-member="${holiday.teamMember}"
                                data-start-date="${holiday.startDate}"
                                data-end-date="${holiday.endDate}"
                                data-type="${holiday.holidayType || ''}"
                                data-reason="${holiday.reason ? holiday.reason.replace(/"/g, '&quot;') : ''}">Edit</button>
                        <button class="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded-lg delete-holiday-btn"
                                data-id="${holiday.$id}">Delete</button>
                    </td>
                </tr>
            `;
        });

        tableHtml += `
                </tbody>
            </table>
        `;
        dataContainer.innerHTML = tableHtml;
        displayMessage(`Displayed ${response.documents.length} holiday records.`, false);
    } catch (error) {
        displayMessage(`Error displaying holiday records: ${error.message}`, true);
        console.error('Error displaying holiday records:', error);
        dataContainer.innerHTML = '<p class="text-red-500 text-center py-8">Failed to load holiday records.</p>';
    }
}

export async function recordHolidayLeave(teamMemberAppwriteId, startDate, endDate, holidayTypeInput, reason) { 
    showSpinner('markHolidayBtn', 'markHolidaySpinner', 'markHolidayBtnText');
    const userId = getOrCreateGuestUserId();
    try {
        if (!holidayTypeInput) {
            displayMessage('Error: Holiday type is required.', true, 'modal');
            hideSpinner('markHolidayBtn', 'markHolidaySpinner', 'markHolidayBtnText');
            return;
        }

        const response = await databases.createDocument(
            DATABASE_ID,
            COLLECTION_IDS.holidays,
            ID.unique(),
            {
                userId: userId,
                teamMember: teamMemberAppwriteId,
                startDate: startDate,
                endDate: endDate,
                holidayType: holidayTypeInput, 
                reason: reason
            }
        );
        displayMessage(`Holiday/Leave recorded successfully! Document ID: ${response.$id}`, false, 'modal');
        console.log('Recorded Holiday/Leave:', response);
        document.getElementById('holidayForm').reset();
        if (document.getElementById('holidaysViewBtn').classList.contains('bg-indigo-700')) {
            await displayHolidays();
        }
    } catch (error) {
        displayMessage(`Error recording holiday/leave: ${error.message}`, true, 'modal');
        console.error('Error recording holiday/leave:', error);
    } finally {
        hideSpinner('markHolidayBtn', 'markHolidaySpinner', 'markHolidayBtnText');
    }
}

export function updateHolidayPrompt(holidayId, currentTeamMemberId, currentStartDate, currentEndDate, currentHolidayType, currentReason) { 
    showCustomModal({
        title: 'Update Holiday/Leave',
        message: 'Update details for this holiday/leave record:',
        inputs: [
            { id: 'modalHolidayTeamMember', label: 'Team Member', type: 'select', value: currentTeamMemberId, options: teamMembers.map(m => ({ value: m.$id, text: m.name })), required: true },
            { id: 'modalHolidayStartDate', label: 'Start Date', type: 'date', value: currentStartDate, required: true },
            { id: 'modalHolidayEndDate', label: 'End Date', type: 'date', value: currentEndDate, required: true },
            { id: 'modalHolidayType', label: 'Type', type: 'radio', name: 'modalHolidayTypeRadio', value: currentHolidayType, options: [{value: 'Holiday', label: 'Holiday'}, {value: 'Leave', label: 'Leave'}], required: true }, 
            { id: 'modalHolidayReason', label: 'Reason', type: 'textarea', value: currentReason || '', placeholder: 'e.g., Annual vacation', required: true }
        ],
        onConfirm: async () => {
            const newTeamMemberId = document.getElementById('modalHolidayTeamMember').value;
            const newStartDate = document.getElementById('modalHolidayStartDate').value;
            const newEndDate = document.getElementById('modalHolidayEndDate').value;
            const newHolidayType = document.querySelector('input[name="modalHolidayTypeRadio"]:checked')?.value; 
            const newReason = document.getElementById('modalHolidayReason').value;

            if (newTeamMemberId && newStartDate && newEndDate && newHolidayType && newReason) {
                await updateHoliday(holidayId, newTeamMemberId, newStartDate, newEndDate, newHolidayType, newReason); 
            } else {
                displayMessage('Please ensure all required fields are valid.', true, 'modal');
            }
        },
        onCancel: () => displayMessage('Holiday/Leave update cancelled.', false)
    });
}

export async function updateHoliday(documentId, teamMemberAppwriteId, startDate, endDate, holidayType, reason) { 
    const userId = getOrCreateGuestUserId();
    try {
        await databases.updateDocument(
            DATABASE_ID,
            COLLECTION_IDS.holidays,
            documentId,
            {
                userId: userId,
                teamMember: teamMemberAppwriteId,
                startDate: startDate,
                endDate: endDate,
                holidayType: holidayType, 
                reason: reason
            }
        );
        displayMessage(`Holiday/Leave record with ID ${documentId} updated successfully!`, false, 'modal');
        await displayHolidays();
    } catch (error) {
        displayMessage(`Error updating holiday/leave record ${documentId}: ${error.message}`, true, 'modal');
        console.error('Error updating holiday/leave record:', error);
    }
}

export async function deleteAllHolidays() {
    showSpinner('deleteAllHolidayRecordsBtn', 'deleteAllHolidayRecordsSpinner', 'deleteAllHolidayRecordsBtnText');
    const userId = getOrCreateGuestUserId();
    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTION_IDS.holidays,
            [Query.equal('userId', userId), Query.limit(100)]
        );

        if (response.documents.length === 0) {
            displayMessage('No holiday records to delete.', false, 'modal');
            return;
        }

        for (const doc of response.documents) {
            await databases.deleteDocument(DATABASE_ID, COLLECTION_IDS.holidays, doc.$id);
        }
        displayMessage(`Successfully deleted ${response.documents.length} holiday records.`, false, 'modal');
        await displayHolidays();
    } catch (error) {
        displayMessage(`Error deleting all holiday records: ${error.message}`, true, 'modal');
        console.error('Error deleting all holiday records:', error);
    } finally {
        hideSpinner('deleteAllHolidayRecordsBtn', 'deleteAllHolidayRecordsSpinner', 'deleteAllHolidayRecordsBtnText');
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    // Event Delegation for Time Entry and Holiday Table Actions
    const dataContainer = document.getElementById('dataContainer');
    if (dataContainer) {
        dataContainer.addEventListener('click', (event) => {
            const target = event.target;

            // Handle Time Entry Edit Button
            if (target.classList.contains('edit-time-entry-btn')) {
                const dataset = target.dataset;
                updateTimeEntryPrompt(
                    dataset.id,
                    dataset.date,
                    dataset.teamMember,
                    dataset.activity,
                    dataset.ticketNumber,
                    parseFloat(dataset.hoursSpent),
                    dataset.notes
                );
            }
            // Handle Time Entry Delete Button
            else if (target.classList.contains('delete-time-entry-btn')) {
                const entryId = target.dataset.id;
                deleteTimeEntry(entryId);
            }
            // Handle Holiday Edit Button
            else if (target.classList.contains('edit-holiday-btn')) {
                const dataset = target.dataset;
                updateHolidayPrompt(
                    dataset.id,
                    dataset.teamMember,
                    dataset.startDate,
                    dataset.endDate,
                    dataset.type, 
                    dataset.reason
                );
            }
            // Handle Holiday Delete Button
            else if (target.classList.contains('delete-holiday-btn')) {
                const holidayId = target.dataset.id;
                deleteHoliday(holidayId);
            }
        });
    }


    const timeTrackForm = document.getElementById('timeTrackForm');
    if (timeTrackForm) {
        timeTrackForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const teamMemberId = document.getElementById('teamMemberTime').value;
            const activity = document.getElementById('activity').value;
            const ticketNumber = document.getElementById('ticketNumber').value;
            const hoursSpent = parseFloat(document.getElementById('hoursSpent').value);
            const trackDateInput = document.getElementById('trackDate').value;
            const notes = document.getElementById('notes').value;

            if (teamMemberId && activity && !isNaN(hoursSpent) && hoursSpent > 0 && trackDateInput) {
                logTimeEntry(teamMemberId, activity, ticketNumber, hoursSpent, trackDateInput, notes);
            } else {
                displayMessage('Please fill all required fields for time log.', true, 'modal');
            }
        });
    }

    const holidayForm = document.getElementById('holidayForm');
    if (holidayForm) {
        holidayForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const teamMemberId = document.getElementById('teamMemberHoliday').value;
            const startDate = document.getElementById('holidayStartDate').value;
            const endDate = document.getElementById('holidayEndDate').value;
            const holidayTypeRadioElement = document.querySelector('input[name="holidayType"]:checked');
            const holidayType = holidayTypeRadioElement ? holidayTypeRadioElement.value : ''; 
            const reason = document.getElementById('holidayReason').value;

            if (teamMemberId && startDate && endDate && holidayType && reason) {
                recordHolidayLeave(teamMemberId, startDate, endDate, holidayType, reason);
            } else {
                displayMessage('Please fill all required fields for holiday/leave, including selecting a type.', true, 'modal');
            }
        });
    }

    const addTeamMemberForm = document.getElementById('addTeamMemberForm');
    if (addTeamMemberForm) {
        addTeamMemberForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('newTeamMemberName').value;
            const dailyHours = parseFloat(document.getElementById('newTeamMemberHours').value);
            if (name && !isNaN(dailyHours) && dailyHours >= 0) {
                await addTeamMember(name, dailyHours);
            } else {
                displayMessage('Please enter valid name and daily work hours.', true, 'modal');
            }
        });
    }

    const addActivityCategoryForm = document.getElementById('addActivityCategoryForm');
    if (addActivityCategoryForm) {
        addActivityCategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const categoryName = document.getElementById('newActivityCategoryName').value;
            if (categoryName) {
                await addActivityCategory(categoryName);
            } else {
                displayMessage('Please enter an activity category name.', true, 'modal');
            }
        });
    }

    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            const currentView = document.querySelector('.flex.justify-center.space-x-2.mb-6.text-xs.text-gray-400 button.bg-indigo-700')?.id;
            if (currentView === 'tableViewBtn') {
                displayFilteredTimeEntries();
            } else if (currentView === 'holidaysViewBtn') {
                displayHolidays();
            } else if (currentView === 'chartsViewBtn') {
                displaySummaryTable(databases); 
            }
        });
    }
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            document.getElementById('filterStartDate').value = '';
            document.getElementById('filterEndDate').value = '';
            document.getElementById('filterTeamMember').value = '';
            document.getElementById('filterActivity').value = '';
            document.getElementById('filterHolidayType').value = ''; 

            const currentView = document.querySelector('.flex.justify-center.space-x-2.mb-6.text-xs.text-gray-400 button.bg-indigo-700')?.id;
            if (currentView === 'tableViewBtn') {
                displayFilteredTimeEntries();
            } else if (currentView === 'holidaysViewBtn') {
                displayHolidays();
            } else if (currentView === 'chartsViewBtn') {
                displaySummaryTable(databases);
            }
        });
    }

    // New Refresh Data Button Event Listener
    const refreshDataBtn = document.getElementById('refreshDataBtn');
    if (refreshDataBtn) {
        refreshDataBtn.addEventListener('click', async () => {
            showSpinner('refreshDataBtn', 'refreshDataSpinner', 'refreshDataBtnText');
            try {
                const currentView = document.querySelector('.flex.justify-center.space-x-2.mb-6.text-xs.text-gray-400 button.bg-indigo-700')?.id;
                if (currentView === 'tableViewBtn') {
                    await displayFilteredTimeEntries();
                } else if (currentView === 'holidaysViewBtn') {
                    await displayHolidays();
                } else if (currentView === 'chartsViewBtn') {
                    await displaySummaryTable(databases);
                } else if (currentView === 'manageViewBtn') {
                    await listTeamMembersAndPopulateSelects();
                    await listActivityCategoriesAndPopulateSelect();
                }
                displayMessage('Data refreshed successfully!', false);
            } catch (error) {
                displayMessage(`Error refreshing data: ${error.message}`, true);
                console.error('Refresh error:', error);
            } finally {
                hideSpinner('refreshDataBtn', 'refreshDataSpinner', 'refreshDataBtnText');
            }
        });
    }

    document.getElementById('tableViewBtn')?.addEventListener('click', () => switchView('table'));
    document.getElementById('chartsViewBtn')?.addEventListener('click', () => switchView('charts'));
    document.getElementById('holidaysViewBtn')?.addEventListener('click', () => switchView('holidays'));
    document.getElementById('manageViewBtn')?.addEventListener('click', () => switchView('manage'));

    // --- Danger Zone Button Event Listeners ---
    document.getElementById('deleteAllTimeEntriesBtn')?.addEventListener('click', deleteAllTimeEntries);
    document.getElementById('deleteAllHolidayRecordsBtn')?.addEventListener('click', deleteAllHolidays);
    document.getElementById('deleteAllTeamMembersBtn')?.addEventListener('click', deleteAllTeamMembers);
    document.getElementById('deleteAllActivityCategoriesBtn')?.addEventListener('click', deleteAllActivityCategories);

    getOrCreateGuestUserId();
    await listTeamMembersAndPopulateSelects();
    await listActivityCategoriesAndPopulateSelect();
    switchView('table'); // Initial view load
});
