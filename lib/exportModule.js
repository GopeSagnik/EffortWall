// lib/exportModule.js
import { databases, COLLECTION_IDS, getOrCreateGuestUserId, displayMessage, showSpinner, hideSpinner, teamMembers, activityCategories, Query, DATABASE_ID } from './script.js';

// JSZip is now globally available because it's loaded via CDN in index.html
// We don't need to import it here using ES module syntax.
// const JSZip = window.JSZip; // This line is not strictly needed if JSZip is truly global, but good for clarity/linting

/**
 * Fetches all documents from a given collection.
 * @param {string} collectionId - The ID of the collection to fetch from.
 * @returns {Promise<Array>} A promise that resolves to an array of documents.
 */
async function fetchCollectionData(collectionId) {
    try {
        const response = await databases.listDocuments(
            DATABASE_ID, 
            collectionId,
            [Query.limit(5000)] // Increased limit for export
        );
        return response.documents;
    } catch (error) {
        console.error(`Error fetching data from ${collectionId}:`, error);
        displayMessage(`Failed to fetch data from ${collectionId} for export.`, true);
        return [];
    }
}

/**
 * Converts an array of JSON objects to a CSV string.
 * Automatically generates headers from the keys of the first object.
 * @param {Array<Object>} data - The array of JSON objects.
 * @param {Array<string>} [headers] - Optional array of headers to use. If not provided, keys from the first object are used.
 * @returns {string} The CSV string.
 */
function convertToCSV(data, headers) {
    if (!data || data.length === 0) {
        return '';
    }

    // If headers are not provided, use keys from the first object
    const actualHeaders = headers || Object.keys(data[0]);

    // Escape values for CSV (handle commas, quotes, newlines)
    const escapeCSV = (value) => {
        if (value === null || value === undefined) {
            return '';
        }
        let stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    };

    const headerRow = actualHeaders.map(escapeCSV).join(',');
    const dataRows = data.map(row =>
        actualHeaders.map(header => escapeCSV(row[header])).join(',')
    );

    return [headerRow, ...dataRows].join('\n');
}

/**
 * Triggers a download of a Blob (e.g., a ZIP file).
 * @param {Blob} blob - The Blob object to download.
 * @param {string} filename - The name of the file to download.
 */
function downloadBlob(blob, filename) {
    const link = document.createElement('a');
    if (link.download !== undefined) { // Feature detection
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Clean up URL object
    } else {
        displayMessage('Your browser does not support automatic file download. Please try a different browser.', true, 'modal');
    }
}

/**
 * Exports data from all relevant collections to a single ZIP file.
 */
export async function exportAllCollectionsToCSV() {
    showSpinner('exportDataBtn', 'exportDataSpinner', 'exportDataBtnText');
    // const userId = getOrCreateGuestUserId(); // Not needed for filtering, but could be used for filename personalization

    try {
        displayMessage('Fetching data for export...', false);

        // Fetch data from each collection
        const teamMembersData = await fetchCollectionData(COLLECTION_IDS.teamMembers);
        const holidaysData = await fetchCollectionData(COLLECTION_IDS.holidays);
        const timeEntriesData = await fetchCollectionData(COLLECTION_IDS.timeEntries);
        const activityCategoriesData = await fetchCollectionData(COLLECTION_IDS.activityCategories);

        // Define specific headers for better readability in CSV
        const teamMemberHeaders = ['name', 'dailyHours', '$id', 'userId'];
        const activityCategoryHeaders = ['name', '$id', 'userId'];
        const timeEntryHeaders = ['date', 'teamMember', 'activity', 'hoursSpent', 'ticketNumber', 'notes', '$id', 'userId'];
        const holidayHeaders = ['startDate', 'endDate', 'teamMember', 'holidayType', 'reason', '$id', 'userId'];

        // Create a new JSZip instance
        const zip = new JSZip();

        // Add each CSV file to the zip
        if (teamMembersData.length > 0) {
            const csv = convertToCSV(teamMembersData, teamMemberHeaders);
            zip.file("effortwall_team_members.csv", csv);
        } else {
            zip.file("effortwall_team_members.csv", "No team members data.");
        }

        if (activityCategoriesData.length > 0) {
            const csv = convertToCSV(activityCategoriesData, activityCategoryHeaders);
            zip.file("effortwall_activity_categories.csv", csv);
        } else {
            zip.file("effortwall_activity_categories.csv", "No activity categories data.");
        }

        if (timeEntriesData.length > 0) {
            // For time entries, enhance with readable names before converting to CSV
            const enhancedTimeEntries = timeEntriesData.map(entry => {
                const member = teamMembers.find(m => m.$id === entry.teamMember);
                return {
                    ...entry,
                    teamMemberName: member ? member.name : 'Unknown',
                    activityCategoryName: entry.activity 
                };
            });
            const enhancedTimeEntryHeaders = ['date', 'teamMemberName', 'activityCategoryName', 'hoursSpent', 'ticketNumber', 'notes', '$id', 'userId'];
            const csv = convertToCSV(enhancedTimeEntries, enhancedTimeEntryHeaders);
            zip.file("effortwall_time_entries.csv", csv);
        } else {
            zip.file("effortwall_time_entries.csv", "No time entries data.");
        }

        if (holidaysData.length > 0) {
            // For holidays, enhance with readable names before converting to CSV
            const enhancedHolidays = holidaysData.map(holiday => {
                const member = teamMembers.find(m => m.$id === holiday.teamMember);
                return {
                    ...holiday,
                    teamMemberName: member ? member.name : 'Unknown'
                };
            });
            const enhancedHolidayHeaders = ['startDate', 'endDate', 'teamMemberName', 'holidayType', 'reason', '$id', 'userId'];
            const csv = convertToCSV(enhancedHolidays, enhancedHolidayHeaders);
            zip.file("effortwall_holiday_records.csv", csv);
        } else {
            zip.file("effortwall_holiday_records.csv", "No holiday records data.");
        }

        displayMessage('Generating ZIP file...', false);

        // Generate the ZIP file
        const zipBlob = await zip.generateAsync({ type: "blob" });

        // Get current date for filename
        const today = new Date();
        const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD
        const filename = `EffortWall DB BackUp ${dateString}.zip`;

        // Trigger download
        downloadBlob(zipBlob, filename);

        displayMessage('Export process completed. Check your downloads folder for the ZIP file.', false, 'modal');

    } catch (error) {
        displayMessage(`Error during export: ${error.message}`, true, 'modal');
        console.error('Export error:', error);
    } finally {
        hideSpinner('exportDataBtn', 'exportDataSpinner', 'exportDataBtnText');
    }
}
