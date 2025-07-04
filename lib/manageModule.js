// lib/manageModule.js
// Import getOrCreateGuestUserId along with other necessary functions from script.js
import { DATABASE_ID, COLLECTION_IDS, databases, ID, Query, displayMessage, teamMembers, updateGlobalTeamMembers, activityCategories, updateGlobalActivityCategories, showCustomModal, showSpinner, hideSpinner, Permission, Role, getOrCreateGuestUserId } from './script.js'; 

/**
 * Adds a new team member.
 * @param {string} name - The name of the team member.
 * @param {number} dailyHours - The daily work hours of the team member.
 * @param {string} userId - The ID of the user creating this record. (Still passed for data consistency, but not for ACLs)
 */
export async function addTeamMember(name, dailyHours, userId) { 
    showSpinner('addTeamMemberBtn', 'addTeamMemberSpinner', 'addTeamMemberBtnText');
    try {
        const response = await databases.createDocument(
            DATABASE_ID,
            COLLECTION_IDS.teamMembers,
            ID.unique(),
            {
                userId: userId, // Store userId as a data attribute (useful for tracking)
                name: name,
                dailyHours: dailyHours
            }
            // REMOVED explicit permissions for the document (ACLs)
            // [
            //     Permission.read(Role.user(userId)),
            //     Permission.write(Role.user(userId))
            // ]
        );
        displayMessage(`Team member ${name} added successfully!`, false, 'modal');
        document.getElementById('addTeamMemberForm').reset();
        await listTeamMembersAndPopulateSelects(); // Refresh lists after adding
    } catch (error) {
        displayMessage(`Error adding team member: ${error.message}`, true, 'modal');
        console.error('Error adding team member:', error);
    } finally {
        hideSpinner('addTeamMemberBtn', 'addTeamMemberSpinner', 'addTeamMemberBtnText');
    }
}

/**
 * Lists team members and populates select dropdowns.
 */
export async function listTeamMembersAndPopulateSelects() {
    const teamMemberTimeSelect = document.getElementById('teamMemberTime');
    const teamMemberHolidaySelect = document.getElementById('teamMemberHoliday');
    const filterTeamMemberSelect = document.getElementById('filterTeamMember');
    const teamMemberListDiv = document.getElementById('teamMemberList');

    // Clear existing options and add default
    if (teamMemberTimeSelect) teamMemberTimeSelect.innerHTML = '<option value="">Select Team Member</option>';
    if (teamMemberHolidaySelect) teamMemberHolidaySelect.innerHTML = '<option value="">Select Team Member</option>';
    if (filterTeamMemberSelect) filterTeamMemberSelect.innerHTML = '<option value="">All Team Members</option>';
    if (teamMemberListDiv) teamMemberListDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Loading team members...</p>';

    // const userId = getOrCreateGuestUserId(); // No longer needed for filtering all data
    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTION_IDS.teamMembers,
            // [Query.equal('userId', userId), Query.limit(100)] // REMOVED: Do not filter by userId for shared data
            [Query.limit(100)]
        );

        updateGlobalTeamMembers(response.documents); // Update global state

        if (response.documents.length === 0) {
            if (teamMemberListDiv) teamMemberListDiv.innerHTML = '<p class="text-gray-500 text-center py-4">No team members added yet.</p>';
            return;
        }

        let memberListHtml = '';
        response.documents.forEach(member => {
            const optionHtml = `<option value="${member.$id}">${member.name}</option>`;
            if (teamMemberTimeSelect) teamMemberTimeSelect.innerHTML += optionHtml;
            if (teamMemberHolidaySelect) teamMemberHolidaySelect.innerHTML += optionHtml;
            if (filterTeamMemberSelect) filterTeamMemberSelect.innerHTML += optionHtml;

            memberListHtml += `
                <div class="flex justify-between items-center bg-gray-600 p-2 rounded-md shadow-sm">
                    <span class="text-gray-200">${member.name} (${member.dailyHours} hrs/day)</span>
                    <div class="flex space-x-2">
                        <button class="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold py-1 px-2 rounded-lg edit-team-member-btn"
                                data-id="${member.$id}" data-name="${member.name}" data-daily-hours="${member.dailyHours}">Edit</button>
                        <button class="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded-lg delete-team-member-btn"
                                data-id="${member.$id}">Delete</button>
                    </div>
                </div>
            `;
        });
        if (teamMemberListDiv) teamMemberListDiv.innerHTML = memberListHtml;

        // Add event listeners for edit/delete buttons using delegation
        const manageTeamMembersSection = document.getElementById('manageTeamMembersSection');
        if (manageTeamMembersSection) {
            manageTeamMembersSection.removeEventListener('click', handleTeamMemberActions); // Prevent multiple listeners
            manageTeamMembersSection.addEventListener('click', handleTeamMemberActions);
        }

    } catch (error) {
        displayMessage(`Error listing team members: ${error.message}`, true);
        console.error('Error listing team members:', error);
        if (teamMemberListDiv) teamMemberListDiv.innerHTML = '<p class="text-red-500 text-center py-4">Failed to load team members.</p>';
    }
}

// Event delegation handler for team member actions
function handleTeamMemberActions(event) {
    const target = event.target;
    if (target.classList.contains('edit-team-member-btn')) {
        const dataset = target.dataset;
        updateTeamMemberPrompt(dataset.id, dataset.name, parseFloat(dataset.dailyHours));
    } else if (target.classList.contains('delete-team-member-btn')) {
        const memberId = target.dataset.id;
        deleteTeamMember(memberId);
    }
}


/**
 * Prompts the user to update a team member.
 * @param {string} memberId - The ID of the team member document.
 * @param {string} currentName - Current name of the team member.
 * @param {number} currentDailyHours - Current daily work hours.
 */
export function updateTeamMemberPrompt(memberId, currentName, currentDailyHours) {
    showCustomModal({
        title: 'Update Team Member',
        message: 'Update the team member\'s details:',
        inputs: [
            { id: 'modalTeamMemberName', label: 'Name', type: 'text', value: currentName, required: true },
            { id: 'modalTeamMemberHours', label: 'Daily Work Hours', type: 'number', value: currentDailyHours, step: '0.5', min: '0', required: true }
        ],
        onConfirm: async () => {
            const newName = document.getElementById('modalTeamMemberName').value;
            const newDailyHours = parseFloat(document.getElementById('modalTeamMemberHours').value);
            if (newName && !isNaN(newDailyHours) && newDailyHours >= 0) {
                await updateTeamMember(memberId, newName, newDailyHours);
            } else {
                displayMessage('Please enter valid name and daily work hours.', true, 'modal');
            }
        },
        onCancel: () => displayMessage('Team member update cancelled.', false)
    });
}

/**
 * Updates an existing team member.
 * @param {string} documentId - The ID of the document to update.
 * @param {string} name - The new name.
 * @param {number} dailyHours - The new daily work hours.
 */
export async function updateTeamMember(documentId, name, dailyHours) {
    const userId = getOrCreateGuestUserId(); // Keep userId for tracking if needed
    try {
        await databases.updateDocument(
            DATABASE_ID,
            COLLECTION_IDS.teamMembers,
            documentId,
            {
                userId: userId, // Keep userId for tracking if needed
                name: name,
                dailyHours: dailyHours
            }
        );
        displayMessage(`Team member ${name} updated successfully!`, false, 'modal');
        await listTeamMembersAndPopulateSelects(); // Refresh lists after update
    } catch (error) {
        displayMessage(`Error updating team member ${name}: ${error.message}`, true, 'modal');
        console.error('Error updating team member:', error);
    }
}

/**
 * Deletes a team member.
 * @param {string} documentId - The ID of the team member document to delete.
 */
export async function deleteTeamMember(documentId) {
    showCustomModal({
        title: 'Confirm Deletion',
        message: `Are you sure you want to delete this team member (ID: ${documentId})? This will also remove their associated time entries and holidays. This action cannot be undone.`,
        isError: true,
        showCancel: true,
        onConfirm: async () => {
            // const userId = getOrCreateGuestUserId(); // No longer needed for filtering all data
            try {
                // Delete associated time entries (no userId filter here for shared data)
                const timeEntriesResponse = await databases.listDocuments(
                    DATABASE_ID,
                    COLLECTION_IDS.timeEntries,
                    [Query.equal('teamMember', documentId), Query.limit(100)]
                );
                for (const entry of timeEntriesResponse.documents) {
                    await databases.deleteDocument(DATABASE_ID, COLLECTION_IDS.timeEntries, entry.$id);
                }
                displayMessage(`Deleted ${timeEntriesResponse.documents.length} associated time entries.`, false);

                // Delete associated holiday entries (no userId filter here for shared data)
                const holidaysResponse = await databases.listDocuments(
                    DATABASE_ID,
                    COLLECTION_IDS.holidays,
                    [Query.equal('teamMember', documentId), Query.limit(100)]
                );
                for (const holiday of holidaysResponse.documents) {
                    await databases.deleteDocument(DATABASE_ID, COLLECTION_IDS.holidays, holiday.$id);
                }
                displayMessage(`Deleted ${holidaysResponse.documents.length} associated holiday records.`, false);

                // Finally, delete the team member
                await databases.deleteDocument(
                    DATABASE_ID,
                    COLLECTION_IDS.teamMembers,
                    documentId
                );
                displayMessage(`Team member deleted successfully!`, false, 'modal');
                await listTeamMembersAndPopulateSelects(); // Refresh lists after deletion
                // Also refresh time entries and holidays if visible
                const currentView = document.querySelector('.flex.justify-center.space-x-2.mb-6.text-xs.text-gray-400 button.bg-indigo-700')?.id;
                if (currentView === 'tableViewBtn') {
                    await displayFilteredTimeEntries();
                } else if (currentView === 'holidaysViewBtn') {
                    await displayHolidays();
                }
            } catch (error) {
                displayMessage(`Error deleting team member: ${error.message}`, true, 'modal');
                console.error('Error deleting team member:', error);
            }
        },
        onCancel: () => displayMessage('Team member deletion cancelled.', false)
    });
}

/**
 * Deletes all team members for the current user.
 */
export async function deleteAllTeamMembers() {
    showSpinner('deleteAllTeamMembersBtn', 'deleteAllTeamMembersSpinner', 'deleteAllTeamMembersBtnText');
    // const userId = getOrCreateGuestUserId(); // No longer needed for filtering all data
    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTION_IDS.teamMembers,
            // [Query.equal('userId', userId), Query.limit(100)] // REMOVED userId filter
            [Query.limit(100)]
        );

        if (response.documents.length === 0) {
            displayMessage('No team members to delete.', false, 'modal');
            return;
        }

        for (const doc of response.documents) {
            // Recursively delete associated time entries and holidays for each team member
            await deleteTeamMember(doc.$id); // Re-use existing deleteTeamMember logic
        }
        displayMessage(`Successfully deleted ${response.documents.length} team members and their associated data.`, false, 'modal');
        await listTeamMembersAndPopulateSelects();
    } catch (error) {
        displayMessage(`Error deleting all team members: ${error.message}`, true, 'modal');
        console.error('Error deleting all team members:', error);
    } finally {
        hideSpinner('deleteAllTeamMembersBtn', 'deleteAllTeamMembersSpinner', 'deleteAllTeamMembersBtnText');
    }
}


/**
 * Adds a new activity category.
 * @param {string} categoryName - The name of the activity category.
 * @param {string} userId - The ID of the user creating this record. (Still passed for data consistency, but not for ACLs)
 */
export async function addActivityCategory(categoryName, userId) { 
    showSpinner('addActivityCategoryBtn', 'addActivityCategorySpinner', 'addActivityCategoryBtnText');
    try {
        const response = await databases.createDocument(
            DATABASE_ID,
            COLLECTION_IDS.activityCategories,
            ID.unique(),
            {
                userId: userId, // Store userId as a data attribute (useful for tracking)
                name: categoryName
            }
            // REMOVED explicit permissions for the document (ACLs)
            // [
            //     Permission.read(Role.user(userId)),
            //     Permission.write(Role.user(userId))
            // ]
        );
        displayMessage(`Activity category "${categoryName}" added successfully!`, false, 'modal');
        document.getElementById('addActivityCategoryForm').reset();
        await listActivityCategoriesAndPopulateSelect(); // Refresh lists
    } catch (error) {
        displayMessage(`Error adding activity category: ${error.message}`, true, 'modal');
        console.error('Error adding activity category:', error);
    } finally {
        hideSpinner('addActivityCategoryBtn', 'addActivityCategorySpinner', 'addActivityCategoryBtnText');
    }
}

/**
 * Lists activity categories and populates select dropdowns.
 */
export async function listActivityCategoriesAndPopulateSelect() {
    const activitySelect = document.getElementById('activity');
    const filterActivitySelect = document.getElementById('filterActivity');
    const activityCategoryListDiv = document.getElementById('activityCategoryList');

    // Clear existing options and add default
    if (activitySelect) activitySelect.innerHTML = '<option value="">Select Activity</option>';
    if (filterActivitySelect) filterActivitySelect.innerHTML = '<option value="">All Activities</option>';
    if (activityCategoryListDiv) activityCategoryListDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Loading categories...</p>';

    // const userId = getOrCreateGuestUserId(); // No longer needed for filtering all data
    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTION_IDS.activityCategories,
            // [Query.equal('userId', userId), Query.limit(100)] // REMOVED: Do not filter by userId for shared data
            [Query.limit(100)]
        );

        updateGlobalActivityCategories(response.documents); // Update global state

        if (response.documents.length === 0) {
            if (activityCategoryListDiv) activityCategoryListDiv.innerHTML = '<p class="text-gray-500 text-center py-4">No categories added yet.</p>';
            return;
        }

        let categoryListHtml = '';
        response.documents.forEach(category => {
            const optionHtml = `<option value="${category.name}">${category.name}</option>`;
            if (activitySelect) activitySelect.innerHTML += optionHtml;
            if (filterActivitySelect) filterActivitySelect.innerHTML += optionHtml;

            categoryListHtml += `
                <div class="flex justify-between items-center bg-gray-600 p-2 rounded-md shadow-sm">
                    <span class="text-gray-200">${category.name}</span>
                    <div class="flex space-x-2">
                        <button class="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold py-1 px-2 rounded-lg edit-activity-category-btn"
                                data-id="${category.$id}" data-name="${category.name}">Edit</button>
                        <button class="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded-lg delete-activity-category-btn"
                                data-id="${category.$id}">Delete</button>
                    </div>
                </div>
            `;
        });
        if (activityCategoryListDiv) activityCategoryListDiv.innerHTML = categoryListHtml;

        // Add event listeners for edit/delete buttons using delegation
        const activityCategoryManagementSection = document.getElementById('activityCategoryManagement');
        if (activityCategoryManagementSection) {
            activityCategoryManagementSection.removeEventListener('click', handleActivityCategoryActions); // Prevent multiple listeners
            activityCategoryManagementSection.addEventListener('click', handleActivityCategoryActions);
        }

    } catch (error) {
        displayMessage(`Error listing activity categories: ${error.message}`, true);
        console.error('Error listing activity categories:', error);
        if (activityCategoryListDiv) activityCategoryListDiv.innerHTML = '<p class="text-red-500 text-center py-4">Failed to load categories.</p>';
    }
}

// Event delegation handler for activity category actions
function handleActivityCategoryActions(event) {
    const target = event.target;
    if (target.classList.contains('edit-activity-category-btn')) {
        const dataset = target.dataset;
        updateActivityCategoryPrompt(dataset.id, dataset.name);
    } else if (target.classList.contains('delete-activity-category-btn')) {
        const categoryId = target.dataset.id;
        deleteActivityCategory(categoryId);
    }
}

/**
 * Prompts the user to update an activity category.
 * @param {string} categoryId - The ID of the activity category document.
 * @param {string} currentName - Current name of the activity category.
 */
export function updateActivityCategoryPrompt(categoryId, currentName) {
    showCustomModal({
        title: 'Update Activity Category',
        message: 'Update the activity category name:',
        inputs: [
            { id: 'modalActivityCategoryName', label: 'Category Name', type: 'text', value: currentName, required: true }
        ],
        onConfirm: async () => {
            const newName = document.getElementById('modalActivityCategoryName').value;
            if (newName) {
                await updateActivityCategory(categoryId, newName);
            } else {
                displayMessage('Please enter a category name.', true, 'modal');
            }
        },
        onCancel: () => displayMessage('Activity category update cancelled.', false)
    });
}

/**
 * Updates an existing activity category.
 * @param {string} documentId - The ID of the document to update.
 * @param {string} name - The new name.
 */
export async function updateActivityCategory(documentId, name) {
    const userId = getOrCreateGuestUserId(); // Keep userId for tracking if needed
    try {
        await databases.updateDocument(
            DATABASE_ID,
            COLLECTION_IDS.activityCategories,
            documentId,
            {
                userId: userId, // Keep userId for tracking if needed
                name: name
            }
        );
        displayMessage(`Activity category "${name}" updated successfully!`, false, 'modal');
        await listActivityCategoriesAndPopulateSelect(); // Refresh lists after update
    } catch (error) {
        displayMessage(`Error updating activity category "${name}": ${error.message}`, true, 'modal');
        console.error('Error updating activity category:', error);
    }
}

/**
 * Deletes an activity category.
 * @param {string} documentId - The ID of the activity category document to delete.
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
                displayMessage(`Activity category deleted successfully!`, false, 'modal');
                await listActivityCategoriesAndPopulateSelect(); // Refresh lists after deletion
            } catch (error) {
                displayMessage(`Error deleting activity category: ${error.message}`, true, 'modal');
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
    showSpinner('deleteAllActivityCategoriesBtn', 'deleteAllActivityCategoriesSpinner', 'deleteAllActivityCategoriesBtnText');
    // const userId = getOrCreateGuestUserId(); // No longer needed for filtering all data
    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTION_IDS.activityCategories,
            // [Query.equal('userId', userId), Query.limit(100)] // REMOVED userId filter
            [Query.limit(100)]
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
}
