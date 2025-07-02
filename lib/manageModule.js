// lib/manageModule.js
import { DATABASE_ID, COLLECTION_IDS, databases, ID, Query, displayMessage, showSpinner, hideSpinner, showCustomModal, updateGlobalTeamMembers, teamMembers, updateGlobalActivityCategories, activityCategories, getOrCreateGuestUserId } from './script.js'; // <-- Import ID

// --- Team Members (CRUD) ---

/**
 * Adds a new team member.
 * @param {string} name - Team member's name.
 * @param {number} dailyHours - Daily work hours.
 */
export async function addTeamMember(name, dailyHours) {
    showSpinner('addTeamMemberBtn', 'addTeamMemberSpinner', 'addTeamMemberBtnText');
    const userId = getOrCreateGuestUserId();
    try {
        const response = await databases.createDocument(
            DATABASE_ID,
            COLLECTION_IDS.teamMembers,
            ID.unique(), // <-- Using imported ID.unique()
            {
                userId: userId,
                name: name,
                dailyHours: dailyHours
            }
        );
        displayMessage(`Team member "${name}" added successfully!`, false, 'modal');
        console.log('Added Team Member:', response);
        document.getElementById('newTeamMemberName').value = '';
        document.getElementById('newTeamMemberHours').value = '';
        await listTeamMembersAndPopulateSelects();
    } catch (error) {
        displayMessage(`Error adding team member: ${error.message}`, true, 'modal');
        console.error('Error adding team member:', error);
    } finally {
        hideSpinner('addTeamMemberBtn', 'addTeamMemberSpinner', 'addTeamMemberBtnText');
    }
}

/**
 * Lists all team members and populates the relevant select dropdowns and the management list.
 * This also updates the global `teamMembers` array in script.js.
 */
export async function listTeamMembersAndPopulateSelects() {
    const userId = getOrCreateGuestUserId();
    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTION_IDS.teamMembers,
            [
                Query.equal('userId', userId),
                Query.orderAsc('name')
            ]
        );
        updateGlobalTeamMembers(response.documents);

        const teamMemberSelects = ['teamMemberTime', 'teamMemberHoliday', 'filterTeamMember'];
        teamMemberSelects.forEach(selectId => {
            const selectElement = document.getElementById(selectId);
            if (selectElement) {
                selectElement.innerHTML = `<option value="">${selectId === 'filterTeamMember' ? 'All Team Members' : 'Select Team Member'}</option>`;
                teamMembers.forEach(member => {
                    const option = document.createElement('option');
                    option.value = member.$id;
                    option.textContent = member.name;
                    selectElement.appendChild(option);
                });
            }
        });

        // Populate Existing Team Members list in Manage section
        const teamMemberListDiv = document.getElementById('teamMemberList');
        if (teamMemberListDiv) {
            teamMemberListDiv.innerHTML = '';
            if (teamMembers.length === 0) {
                teamMemberListDiv.innerHTML = '<p class="text-gray-500 text-center py-4">No team members added yet.</p>';
            } else {
                teamMembers.forEach(member => {
                    const memberCard = document.createElement('div');
                    memberCard.className = 'flex justify-between items-center bg-gray-600 p-2 rounded-md shadow-sm';
                    memberCard.innerHTML = `
                        <span class="text-gray-200">${member.name} (${member.dailyHours} hrs/day)</span>
                        <div>
                            <button onclick="updateTeamMemberPrompt('${member.$id}', '${member.name}', ${member.dailyHours})" class="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold py-1 px-2 rounded-lg mr-1">Edit</button>
                            <button onclick="deleteTeamMember('${member.$id}')" class="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded-lg">Delete</button>
                        </div>
                    `;
                    teamMemberListDiv.appendChild(memberCard);
                });
            }
        }
        displayMessage(`Team members loaded.`, false);
    } catch (error) {
        displayMessage(`Error loading team members: ${error.message}`, true);
        console.error('Error loading team members:', error);
    }
}

/**
 * Prompts the user to update a team member's details using a custom modal.
 * @param {string} memberId - The ID of the team member document.
 * @param {string} currentName - Current name for pre-filling.
 * @param {number} currentDailyHours - Current daily work hours for pre-filling.
 */
export function updateTeamMemberPrompt(memberId, currentName, currentDailyHours) {
    showCustomModal({
        title: 'Update Team Member',
        message: `Update details for ${currentName}:`,
        inputs: [
            { id: 'modalName', label: 'Name', type: 'text', value: currentName, required: true },
            { id: 'modalDailyHours', label: 'Daily Work Hours', type: 'number', value: currentDailyHours, step: '0.5', min: '0', required: true }
        ],
        onConfirm: () => {
            const newName = document.getElementById('modalName').value;
            const newDailyHours = parseFloat(document.getElementById('modalDailyHours').value);
            if (newName && !isNaN(newDailyHours)) {
                updateTeamMember(memberId, newName, newDailyHours);
            } else {
                displayMessage('Invalid inputs for update.', true, 'modal');
            }
        },
        onCancel: () => displayMessage('Update cancelled.', false)
    });
}

/**
 * Updates an existing team member.
 * @param {string} documentId - The ID of the document to update.
 * @param {string} name - The new name.
 * @param {number} dailyHours - The new daily work hours.
 */
export async function updateTeamMember(documentId, name, dailyHours) {
    const userId = getOrCreateGuestUserId();
    try {
        await databases.updateDocument(
            DATABASE_ID,
            COLLECTION_IDS.teamMembers,
            documentId,
            { userId: userId, name: name, dailyHours: dailyHours }
        );
        displayMessage(`Team member with ID ${documentId} updated successfully!`, false, 'modal');
        await listTeamMembersAndPopulateSelects();
    } catch (error) {
        displayMessage(`Error updating team member ${documentId}: ${error.message}`, true, 'modal');
        console.error('Error updating team member:', error);
    }
}

/**
 * Deletes a team member.
 * @param {string} documentId - The ID of the document to delete.
 */
export async function deleteTeamMember(documentId) {
    showCustomModal({
        title: 'Confirm Deletion',
        message: `Are you sure you want to delete this team member (ID: ${documentId})? This action cannot be undone.`,
        isError: true,
        showCancel: true,
        onConfirm: async () => {
            try {
                await databases.deleteDocument(
                    DATABASE_ID,
                    COLLECTION_IDS.teamMembers,
                    documentId
                );
                displayMessage(`Team member with ID ${documentId} deleted successfully!`, false, 'modal');
                await listTeamMembersAndPopulateSelects();
            } catch (error) {
                displayMessage(`Error deleting team member ${documentId}: ${error.message}`, true, 'modal');
                console.error('Error deleting team member:', error);
            }
        },
        onCancel: () => displayMessage('Deletion cancelled.', false)
    });
}

/**
 * Deletes all team members for the current user.
 */
export async function deleteAllTeamMembers() {
    showCustomModal({
        title: 'Confirm ALL Team Member Deletion',
        message: 'Are you absolutely sure you want to delete ALL team members? This action is irreversible.',
        isError: true,
        showCancel: true,
        onConfirm: async () => {
            showSpinner('deleteAllTeamMembersBtn', 'deleteAllTeamMembersSpinner', 'deleteAllTeamMembersBtnText');
            const userId = getOrCreateGuestUserId();
            try {
                const response = await databases.listDocuments(
                    DATABASE_ID,
                    COLLECTION_IDS.teamMembers,
                    [Query.equal('userId', userId), Query.limit(100)]
                );

                if (response.documents.length === 0) {
                    displayMessage('No team members to delete.', false, 'modal');
                    return;
                }

                for (const doc of response.documents) {
                    await databases.deleteDocument(DATABASE_ID, COLLECTION_IDS.teamMembers, doc.$id);
                }
                displayMessage(`Successfully deleted ${response.documents.length} team members.`, false, 'modal');
                await listTeamMembersAndPopulateSelects();
            } catch (error) {
                displayMessage(`Error deleting all team members: ${error.message}`, true, 'modal');
                console.error('Error deleting all team members:', error);
            } finally {
                hideSpinner('deleteAllTeamMembersBtn', 'deleteAllTeamMembersSpinner', 'deleteAllTeamMembersBtnText');
            }
        },
        onCancel: () => displayMessage('Deletion of all team members cancelled.', false)
    });
}

// --- Activity Categories (CRUD) ---

/**
 * Adds a new activity category.
 * @param {string} name - The name of the activity category.
 */
export async function addActivityCategory(name) {
    showSpinner('addActivityCategoryBtn', 'addActivityCategorySpinner', 'addActivityCategoryBtnText');
    const userId = getOrCreateGuestUserId();
    try {
        const response = await databases.createDocument(
            DATABASE_ID,
            COLLECTION_IDS.activityCategories,
            ID.unique(), // <-- Using imported ID.unique()
            {
                userId: userId,
                name: name
            }
        );
        displayMessage(`Activity category "${name}" added successfully!`, false, 'modal');
        console.log('Added Activity Category:', response);
        document.getElementById('newActivityCategoryName').value = '';
        await listActivityCategoriesAndPopulateSelect();
    } catch (error) {
        displayMessage(`Error adding activity category: ${error.message}`, true, 'modal');
        console.error('Error adding activity category:', error);
    } finally {
        hideSpinner('addActivityCategoryBtn', 'addActivityCategorySpinner', 'addActivityCategoryBtnText');
    }
}

/**
 * Lists all activity categories and populates the 'Activity' select dropdowns.
 * This also updates the global `activityCategories` array in script.js.
 */
export async function listActivityCategoriesAndPopulateSelect() {
    const userId = getOrCreateGuestUserId();
    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTION_IDS.activityCategories,
            [
                Query.equal('userId', userId),
                Query.orderAsc('name')
            ]
        );
        updateGlobalActivityCategories(response.documents);

        const activitySelects = ['activity', 'filterActivity'];
        activitySelects.forEach(selectId => {
            const selectElement = document.getElementById(selectId);
            if (selectElement) {
                selectElement.innerHTML = `<option value="">${selectId === 'filterActivity' ? 'All Activities' : 'Select Activity'}</option>`;
                activityCategories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.name;
                    option.textContent = category.name;
                    selectElement.appendChild(option);
                });
            }
        });

        // Populate Existing Activity Categories list in Manage section
        const activityCategoryListDiv = document.getElementById('activityCategoryList');
        if (activityCategoryListDiv) {
            activityCategoryListDiv.innerHTML = '';
            if (activityCategories.length === 0) {
                activityCategoryListDiv.innerHTML = '<p class="text-gray-500 text-center py-4">No activity categories added yet.</p>';
            } else {
                activityCategories.forEach(category => {
                    const categoryCard = document.createElement('div');
                    categoryCard.className = 'flex justify-between items-center bg-gray-600 p-2 rounded-md shadow-sm';
                    categoryCard.innerHTML = `
                        <span class="text-gray-200">${category.name}</span>
                        <div>
                            <button onclick="updateActivityCategoryPrompt('${category.$id}', '${category.name}')" class="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold py-1 px-2 rounded-lg mr-1">Edit</button>
                            <button onclick="deleteActivityCategory('${category.$id}')" class="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded-lg">Delete</button>
                        </div>
                    `;
                    activityCategoryListDiv.appendChild(categoryCard);
                });
            }
        }
        displayMessage(`Activity categories loaded.`, false);
    } catch (error) {
        displayMessage(`Error loading activity categories: ${error.message}`, true);
        console.error('Error loading activity categories:', error);
    }
}

/**
 * Prompts the user to update an activity category's name.
 * @param {string} categoryId - The ID of the activity category document.
 * @param {string} currentName - Current name for pre-filling.
 */
export function updateActivityCategoryPrompt(categoryId, currentName) {
    showCustomModal({
        title: 'Update Activity Category',
        message: `Update name for ${currentName}:`,
        inputs: [
            { id: 'modalCategoryName', label: 'Category Name', type: 'text', value: currentName, required: true }
        ],
        onConfirm: async () => {
            const newName = document.getElementById('modalCategoryName').value;
            if (newName) {
                await updateActivityCategory(categoryId, newName);
            } else {
                displayMessage('Activity category name cannot be empty.', true, 'modal');
            }
        },
        onCancel: () => displayMessage('Update cancelled.', false)
    });
}

/**
 * Updates an existing activity category.
 * @param {string} documentId - The ID of the document to update.
 * @param {string} name - The new name.
 */
export async function updateActivityCategory(documentId, name) {
    const userId = getOrCreateGuestUserId();
    try {
        await databases.updateDocument(
            DATABASE_ID,
            COLLECTION_IDS.activityCategories,
            documentId,
            { userId: userId, name: name }
        );
        displayMessage(`Activity category with ID ${documentId} updated successfully!`, false, 'modal');
        await listActivityCategoriesAndPopulateSelect();
    } catch (error) {
        displayMessage(`Error updating activity category ${documentId}: ${error.message}`, true, 'modal');
        console.error('Error updating activity category:', error);
    }
}

/**
 * Deletes an activity category.
 * @param {string} documentId - The ID of the document to delete.
 */
export async function deleteActivityCategory(documentId) {
    showCustomModal({
        title: 'Confirm Deletion',
        message: `Are you sure you want to delete this activity category (ID: ${documentId})? This action cannot be undone.`,
        isError: true,
        showCancel: true,
        onConfirm: async () => {
            try {
                await databases.deleteDocument(
                    DATABASE_ID,
                    COLLECTION_IDS.activityCategories,
                    documentId
                );
                displayMessage(`Activity category with ID ${documentId} deleted successfully!`, false, 'modal');
                await listActivityCategoriesAndPopulateSelect();
            } catch (error) {
                displayMessage(`Error deleting activity category ${documentId}: ${error.message}`, true, 'modal');
                console.error('Error deleting activity category:', error);
            }
        },
        onCancel: () => displayMessage('Deletion cancelled.', false)
    });
}

/**
 * Deletes all activity categories for the current user.
 */
export async function deleteAllActivityCategories() {
    showCustomModal({
        title: 'Confirm ALL Activity Category Deletion',
        message: 'Are you absolutely sure you want to delete ALL activity categories? This action is irreversible.',
        isError: true,
        showCancel: true,
        onConfirm: async () => {
            showSpinner('deleteAllActivityCategoriesBtn', 'deleteAllActivityCategoriesSpinner', 'deleteAllActivityCategoriesBtnText');
            const userId = getOrCreateGuestUserId();
            try {
                const response = await databases.listDocuments(
                    DATABASE_ID,
                    COLLECTION_IDS.activityCategories,
                    [Query.equal('userId', userId), Query.limit(100)]
                );

                if (response.documents.length === 0) {
                    displayMessage('No activity categories to delete.', false, 'modal');
                    return;
                }

                for (const doc of response.documents) {
                    await databases.deleteDocument(DATABASE_ID, COLLECTION_IDS.activityCategories, doc.$id);
                }
                displayMessage(`Successfully deleted ${response.documents.length} activity categories.`, false, 'modal');
                await listActivityCategoriesAndPopulateSelect();
            } catch (error) {
                displayMessage(`Error deleting all activity categories: ${error.message}`, true, 'modal');
                console.error('Error deleting all activity categories:', error);
            } finally {
                hideSpinner('deleteAllActivityCategoriesBtn', 'deleteAllActivityCategoriesSpinner', 'deleteAllActivityCategoriesBtnText');
            }
        },
        onCancel: () => displayMessage('Deletion of all activity categories cancelled.', false)
    });
}
